"""
Scheduler Service — APScheduler-based automation engine.
Menjalankan jadwal otomatis ON/OFF perangkat berdasarkan waktu.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from db.connection import SessionRW
from db import crud
from db.models import SavedSelection
from services.bulb_service import control_wiz_light, turn_off_wiz_light

logger = logging.getLogger(__name__)

WIB = pytz.timezone("Asia/Jakarta")

# Day name mapping: lowercase → APScheduler day-of-week (mon=0 .. sun=6)
DAY_MAP = {
    "monday": "mon", "tuesday": "tue", "wednesday": "wed",
    "thursday": "thu", "friday": "fri", "saturday": "sat", "sunday": "sun",
}

# ── WebSocket Manager (simple broadcast) ──────────────────────────────────────
_ws_connections: list = []


def register_ws(websocket):
    _ws_connections.append(websocket)


def unregister_ws(websocket):
    if websocket in _ws_connections:
        _ws_connections.remove(websocket)


async def _broadcast_ws(data: dict):
    """Push data ke semua connected WebSocket clients."""
    msg = json.dumps(data)
    dead = []
    for ws in _ws_connections:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        unregister_ws(ws)


# ── Scheduler Engine ──────────────────────────────────────────────────────────

class SchedulerEngine:
    def __init__(self):
        self._scheduler = BackgroundScheduler(timezone=WIB)
        self._running = False

    def start(self):
        """Load semua jadwal aktif dari DB dan mulai scheduler."""
        if self._running:
            return
        db = SessionRW()
        try:
            schedules = crud.get_all_active_schedules(db)
            for sch in schedules:
                self._add_job(sch)
            self._scheduler.start()
            self._running = True
            logger.info(f"Scheduler started — {len(schedules)} active schedule(s) loaded")
        except Exception as e:
            logger.error(f"Scheduler start failed: {e}")
        finally:
            db.close()

    def shutdown(self):
        if self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False

    def _make_job_id(self, schedule_id: str) -> str:
        return f"sch_{schedule_id}"

    def _add_job(self, sch):
        """Register satu jadwal ke APScheduler."""
        job_id = self._make_job_id(sch.id)
        self._scheduler.remove_job(job_id) if self._scheduler.get_job(job_id) else None

        if not sch.days:
            return  # Tidak ada hari = tidak bisa dijadwalkan

        try:
            hour, minute = map(int, sch.time.split(":"))
        except (ValueError, AttributeError):
            logger.error(f"Invalid time format for schedule {sch.id}: {sch.time}")
            return

        days_of_week = ",".join(DAY_MAP.get(d, d) for d in sch.days if d in DAY_MAP)
        if not days_of_week:
            return

        trigger = CronTrigger(
            hour=hour, minute=minute,
            day_of_week=days_of_week,
            timezone=WIB,
        )
        self._scheduler.add_job(
            _execute_schedule_job,
            trigger=trigger,
            id=job_id,
            args=[sch.id],
            replace_existing=True,
            misfire_grace_time=900,  # 15 menit toleransi
        )
        logger.info(f"Job registered: {sch.id} at {sch.time} on {days_of_week}")

    def remove_job(self, schedule_id: str):
        job_id = self._make_job_id(schedule_id)
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)

    def add_or_update_job(self, sch):
        """Add atau update job di runtime scheduler."""
        if sch.is_active:
            self._add_job(sch)
        else:
            self.remove_job(sch.id)


# Singleton
engine = SchedulerEngine()


# ── Execution Logic ───────────────────────────────────────────────────────────

def _execute_schedule_job(schedule_id: str):
    """
    Dipanggil oleh APScheduler saat trigger aktif.
    Menjalankan flow eksekusi lengkap (synchronous wrapper).
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Jika sudah ada loop (uvicorn), jadwalkan sebagai task
            asyncio.ensure_future(_run_execution(schedule_id))
        else:
            loop.run_until_complete(_run_execution(schedule_id))
    except RuntimeError:
        # Tidak ada event loop — buat baru
        asyncio.run(_run_execution(schedule_id))


async def _run_execution(schedule_id: str):
    """Flow eksekusi utama."""
    db = SessionRW()
    try:
        sch = crud.get_schedule_by_id(db, schedule_id)
        if not sch or not sch.is_active:
            return

        # 1. Set status EXECUTE
        crud.update_schedule_run_status(db, schedule_id, "EXECUTE")
        await _broadcast_ws({"type": "schedule_status", "schedule_id": schedule_id, "status": "EXECUTE"})

        # 2. Cek snooze
        if sch.is_snoozed:
            crud.snooze_schedule(db, schedule_id)  # Reset snooze ke false
            crud.add_schedule_log(db, schedule_id, "SKIPPED", "Eksekusi diabaikan karena status Snooze aktif.")
            crud.update_schedule_run_status(db, schedule_id, "OFF")
            await _broadcast_ws({"type": "schedule_status", "schedule_id": schedule_id, "status": "SKIPPED"})
            return

        # 3. Resolve target IPs
        ips = _resolve_targets(db, sch)
        if not ips:
            crud.add_schedule_log(db, schedule_id, "FAILED", "Tidak ada IP target ditemukan.")
            crud.update_schedule_run_status(db, schedule_id, "FAILED")
            await _broadcast_ws({"type": "schedule_status", "schedule_id": schedule_id, "status": "FAILED"})
            return

        # 4. Execute control with retry
        success_count = 0
        failed_ips = []

        for attempt in range(1, 4):  # Max 3 retries
            target_ips = failed_ips if failed_ips else ips
            failed_ips = []

            tasks = [_control_device(ip, sch) for ip in target_ips]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for ip, res in zip(target_ips, results):
                if isinstance(res, Exception) or (isinstance(res, dict) and res.get("status") == "failed"):
                    failed_ips.append(ip)
                else:
                    success_count += 1

            if not failed_ips:
                break
            if attempt < 3:
                await asyncio.sleep(2)  # Delay sebelum retry

        # 5. Determine final status
        total = len(ips)
        if success_count >= total:
            final_status = sch.action.upper()
        elif success_count > 0:
            final_status = sch.action.upper()  # Partial success still counts
        else:
            final_status = "FAILED"

        # 6. Update device statuses in DB + collect updated devices for WS broadcast
        updated_devices = _update_device_statuses(db, sch.room_id, ips, failed_ips, sch.action)

        # 7. Push WebSocket device_status update (real-time UI card update)
        if updated_devices:
            await _broadcast_ws({
                "type": "device_status",
                "room_id": sch.room_id,
                "devices": updated_devices,
            })

        # 8. Update schedule status + log
        crud.update_schedule_run_status(db, schedule_id, final_status)
        detail = f"Executed {sch.action.upper()}: {success_count}/{total} succeeded"
        if failed_ips:
            detail += f" — Failed IPs: {', '.join(failed_ips)}"
        crud.add_schedule_log(db, schedule_id, final_status, detail)
        crud.cleanup_schedule_logs(db, schedule_id, keep=10)

        # 8. Push WebSocket final status
        await _broadcast_ws({
            "type": "schedule_status",
            "schedule_id": schedule_id,
            "status": final_status,
        })

    except Exception as e:
        logger.error(f"Schedule execution error ({schedule_id}): {e}")
        try:
            crud.add_schedule_log(db, schedule_id, "FAILED", str(e))
            crud.update_schedule_run_status(db, schedule_id, "FAILED")
            await _broadcast_ws({"type": "schedule_status", "schedule_id": schedule_id, "status": "FAILED"})
        except Exception:
            pass
    finally:
        db.close()


def _resolve_targets(db, sch) -> list:
    """Dapatkan daftar IP berdasarkan target_type."""
    if sch.target_type == "device":
        dev = crud.get_device_by_id(db, sch.target_id)
        ip = dev.conn_info.get("ip", "") if dev and dev.conn_info else ""
        return [ip] if ip else []

    if sch.target_type == "selection":
        sel = db.query(SavedSelection).filter(SavedSelection.id == int(sch.target_id)).first()
        if not sel:
            return []
        device_ids = sel.device_ids or []
        ips = []
        for did in device_ids:
            dev = crud.get_device_by_id(db, str(did))
            if dev and dev.conn_info:
                ip = dev.conn_info.get("ip", "")
                if ip:
                    ips.append(ip)
        return ips

    # target_type == "all"
    devices = crud.get_devices_by_room(db, sch.room_id)
    ips = []
    for d in devices:
        if d.conn_info and d.conn_info.get("ip"):
            ips.append(d.conn_info["ip"])
    return ips


async def _control_device(ip: str, sch) -> dict:
    """Kontrol satu perangkat berdasarkan action jadwal."""
    try:
        if sch.action == "off":
            return await turn_off_wiz_light(ip)
        else:
            from services.models import ColorModel
            color = None
            if sch.rgb and len(sch.rgb) == 3:
                color = ColorModel(Red=sch.rgb[0], Green=sch.rgb[1], Blue=sch.rgb[2])
            brightness = sch.brightness if sch.brightness else 200
            return await control_wiz_light(ip=ip, color=color, brightness=brightness)
    except Exception as e:
        return {"status": "failed", "ip": ip, "error": str(e)}


def _update_device_statuses(db, room_id: str, ips: list, failed_ips: list, action: str):
    """Update status perangkat di DB setelah eksekusi. Returns list of updated devices for WS broadcast.
    Menggunakan session DB terpisah agar tidak terpengaruh oleh error di session utama.
    """
    status = "on" if action != "off" else "off"
    updated = []

    # Gunakan session terpisah untuk update device statuses
    dev_db = SessionRW()
    try:
        devices = crud.get_devices_by_room(dev_db, room_id)
        logger.info(f"[_update_device_statuses] room={room_id}, found {len(devices)} devices, ips={ips}, failed={failed_ips}, action={action}")

        for d in devices:
            if d.conn_info and d.conn_info.get("ip"):
                ip = d.conn_info["ip"]
                if ip in ips and ip not in failed_ips:
                    new_status = status
                elif ip in failed_ips:
                    new_status = "failed"
                else:
                    continue  # device bukan target schedule ini

                try:
                    crud.update_device_status(dev_db, d.id, new_status)
                    updated.append({
                        "id": d.id,
                        "kode": d.conn_info.get("kode") if d.conn_info else None,
                        "status": new_status,
                    })
                    logger.info(f"  Device {d.id} ({d.name}) → status={new_status}")
                except Exception as e:
                    logger.error(f"  Failed to update device {d.id}: {e}")

        logger.info(f"[_update_device_statuses] Updated {len(updated)} device(s)")
    except Exception as e:
        logger.error(f"[_update_device_statuses] Error: {e}")
    finally:
        dev_db.close()

    return updated


def generate_schedule_id() -> str:
    return f"sch_{uuid.uuid4().hex[:8]}"
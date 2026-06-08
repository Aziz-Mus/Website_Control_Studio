"""
Router: /api/control — Hardware control endpoints (WiZ, Relay, AC)
Menjembatani database PostgreSQL dengan physical device control.
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from ws_manager import ws_manager

from db.connection import get_db_ro, get_db_rw
from db import crud
from db.models import Device

# Hardware services
from services.bulb_service import control_wiz_light, turn_off_wiz_light
from services.relay_service import RelayService, control_relay_channel
from services.ac_service import ACService
from services.models import ColorModel

router = APIRouter(prefix="/api/control", tags=["Hardware Control"])
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════════════════════

class WizControlRequest(BaseModel):
    """Kontrol satu atau banyak WiZ lamp via IP"""
    ips: List[str]
    action: str = "on"                              # "on" | "off"
    brightness: Optional[int] = Field(None, ge=0, le=255)
    rgb: Optional[List[int]] = None                  # [R, G, B] 0-255
    colortemp: Optional[int] = Field(None, ge=2200, le=6500)
    scene_id: Optional[int] = Field(None, ge=1, le=35)

class WizAnimRequest(BaseModel):
    """Jalankan animasi warna di WiZ lamp"""
    name: str = "Custom"
    ips: List[str]
    interval: float = Field(2.0, ge=0.1, le=60.0)
    frames: List[dict]

class RelayControlRequest(BaseModel):
    """Kontrol relay ESP32"""
    esp_ip: str
    channel_code: str
    power: str                                       # "ON" | "OFF"

class RelayBulkRequest(BaseModel):
    """Kontrol banyak relay sekaligus"""
    esp_ip: str
    relays: List[dict]                               # [{channel_code, power}]

class ACControlRequest(BaseModel):
    """Kontrol single AC"""
    ip: str
    power: str                                       # "ON" | "OFF"
    temperature: int = Field(24, ge=16, le=30)

class ACControlAllRequest(BaseModel):
    """Kontrol semua AC di satu room"""
    room_id: str
    power: str
    temperature: int = Field(24, ge=16, le=30)

class ACTempRequest(BaseModel):
    """Set suhu satu AC"""
    ip: str
    temperature: int = Field(24, ge=16, le=30)
    power: str = "ON"


# ══════════════════════════════════════════════════════════════════════════════
# WIZ LAMP ENDPOINTS (Command Center / Showcase / Neon)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/wiz/lampu")
async def control_wiz(request: WizControlRequest, db: Session = Depends(get_db_rw)):
    """
    Kontrol WiZ lamp. Bisa satu (KodeLampu) atau banyak (ips[]).
    Endpoint ini menggantikan /{room}/lampu dan /{room}/turn-off dari router lama.
    
    Contoh body ON:
        { "ips": ["10.1.50.2"], "action": "on", "brightness": 200, "rgb": [255,100,0] }
    Contoh body OFF:
        { "ips": ["10.1.50.2"], "action": "off" }
    """
    if not request.ips:
        raise HTTPException(status_code=400, detail="No IP selected")

    color = None
    if request.rgb and len(request.rgb) == 3:
        color = ColorModel(Red=request.rgb[0], Green=request.rgb[1], Blue=request.rgb[2])

    async def _control_one(ip: str):
        if request.action == "off":
            return await turn_off_wiz_light(ip)
        else:
            return await control_wiz_light(
                ip=ip,
                color=color,
                brightness=request.brightness or 200,
                scene_id=request.scene_id
            )

    tasks = [_control_one(ip) for ip in request.ips]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    device_results = []
    success_count = 0
    for ip, res in zip(request.ips, results):
        if isinstance(res, Exception):
            device_results.append({"ip": ip, "status": "failed", "error": str(res)})
        else:
            s = res.get("status", "failed")
            if s == "success":
                success_count += 1
            device_results.append({"ip": ip, "status": s, "error": res.get("error")})

    total = len(request.ips)

    if success_count > 0:
        # Update database
        wiz_devices = db.query(Device).filter(Device.type == "wiz").all()
        updated_devices = []
        for dev in wiz_devices:
            if dev.conn_info and dev.conn_info.get("ip") in request.ips:
                dev.status = request.action
                updated_devices.append({"id": dev.id, "status": request.action})
        db.commit()

        # Broadcast real-time device status
        room_ids = list(set(dev.room_id for dev in wiz_devices if dev.conn_info and dev.conn_info.get("ip") in request.ips and dev.room_id))
        for rid in room_ids:
            room_devices = [d for d in updated_devices if any(wd.id == d["id"] and wd.room_id == rid for wd in wiz_devices)]
            if room_devices:
                logger.info(f"[WS] Broadcasting wiz update: room={rid}, devices={room_devices}")
                await ws_manager.broadcast({
                    "type": "device_status",
                    "room_id": rid,
                    "devices": room_devices,
                })

    return {
        "status": "success" if success_count == total else "partial" if success_count > 0 else "failed",
        "summary": {"total": total, "success": success_count, "failed": total - success_count},
        "devices": device_results,
    }


@router.post("/wiz/turn-off")
async def turn_off_wiz(request: WizControlRequest):
    """
    Matikan semua WiZ lamp yang IP-nya dikirim.
    Shortcut dari /wiz/lampu dengan action=off.
    """
    request.action = "off"
    return await control_wiz(request)


@router.post("/wiz/animation/start")
async def start_wiz_animation(request: WizAnimRequest):
    """
    Mulai animasi warna di WiZ lamp.
    Frames: [{ "rgb": [R,G,B], "brightness": 200 }, ...]
    """
    if not request.ips:
        raise HTTPException(status_code=400, detail="No IP selected")
    if not request.frames:
        raise HTTPException(status_code=400, detail="No animation frames provided")

    # Import dari cc_service (yang sudah punya background thread)
    try:
        from services.command_center_service import start_animation
        start_animation(
            name=request.name,
            frames=request.frames,
            interval=request.interval,
            ips=request.ips
        )
        return {"status": "started", "name": request.name, "lights": len(request.ips)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/wiz/animation/stop")
async def stop_wiz_animation():
    """Hentikan animasi yang sedang berjalan."""
    try:
        from services.command_center_service import stop_animation
        stop_animation()
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# RELAY (Headlights ESP32)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/relay")
async def control_relay(request: RelayControlRequest, db: Session = Depends(get_db_rw)):
    """
    Kontrol satu relay ESP32.
    Body: { "esp_ip": "10.1.40.88", "channel_code": "1", "power": "ON" }
    """
    result = await control_relay_channel(request.esp_ip, request.channel_code, request.power)
    
    if result.get("status") == "success":
        # Update database
        devices = db.query(Device).filter(Device.type == "relay").all()
        updated_devices = []
        target_dev = None
        for dev in devices:
            if dev.conn_info and dev.conn_info.get("channel_code") == request.channel_code:
                dev.status = request.power.lower()
                target_dev = dev
                updated_devices.append({"id": dev.id, "status": request.power.lower()})
        db.commit()

        # Broadcast real-time device status
        if target_dev and updated_devices:
            logger.info(f"[WS] Broadcasting relay update: room={target_dev.room_id}, devices={updated_devices}")
            await ws_manager.broadcast({
                "type": "device_status",
                "room_id": target_dev.room_id,
                "devices": updated_devices,
            })

    return {
        "status": result.get("status", "failed"),
        "channel": request.channel_code,
        "power": request.power,
        "error": result.get("error")
    }


@router.post("/relay/bulk")
async def control_relay_bulk(request: RelayBulkRequest):
    """
    Kontrol banyak relay sekaligus (untuk Headlights select all / deselect).
    Body: { "esp_ip": "10.1.40.88", "relays": [{"channel_code": "1", "power": "ON"}, ...] }
    """
    svc = RelayService(request.esp_ip)
    # Pisahkan berdasarkan ON/OFF untuk bulk request
    on_channels  = [r["channel_code"] for r in request.relays if r.get("power", "ON").upper() == "ON"]
    off_channels = [r["channel_code"] for r in request.relays if r.get("power", "ON").upper() == "OFF"]

    tasks = []
    if on_channels:  tasks.append(svc.control_bulk(on_channels, "ON"))
    if off_channels: tasks.append(svc.control_bulk(off_channels, "OFF"))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    success = all(
        not isinstance(r, Exception) and r.get("status") == "success"
        for r in results
    )
    
    if success:
        logger.info(f"[WS] Broadcasting relay_bulk update: esp_ip={request.esp_ip}")
        await ws_manager.broadcast({
            "type": "DEVICE_UPDATE",
            "category": "relay_bulk",
            "esp_ip": request.esp_ip,
            "relays": request.relays,
        })
        
    total = len(on_channels) + len(off_channels)
    return {
        "status": "success" if success else "partial",
        "summary": {"total": total},
        "relays": request.relays,
    }


# ══════════════════════════════════════════════════════════════════════════════
# AC CONTROL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ac")
async def control_ac_single(request: ACControlRequest, db: Session = Depends(get_db_rw)):
    """
    Kontrol satu AC unit.
    Body: { "ip": "10.1.34.52", "power": "ON", "temperature": 24 }
    """
    svc = ACService(request.ip)
    result = await svc.control_ac(request.power, request.temperature)
    
    if result.get("status") == "success":
        # Update database
        devices = db.query(Device).filter(Device.type == "ac").all()
        updated_devices = []
        target_dev = None
        for dev in devices:
            if dev.conn_info and dev.conn_info.get("ip") == request.ip:
                dev.status = request.power.lower()
                new_state = dict(dev.last_state) if dev.last_state else {}
                new_state["temperature"] = request.temperature
                dev.last_state = new_state
                target_dev = dev
                updated_devices.append({"id": dev.id, "status": request.power.lower()})
        db.commit()
        
        # Broadcast real-time device status
        if target_dev and updated_devices:
            logger.info(f"[WS] Broadcasting AC update: room={target_dev.room_id}, devices={updated_devices}")
            await ws_manager.broadcast({
                "type": "device_status",
                "room_id": target_dev.room_id,
                "devices": updated_devices,
            })

    return {
        "status": result.get("status", "failed"),
        "ip": request.ip,
        "power": request.power,
        "temperature": request.temperature,
        "error": result.get("error")
    }


@router.post("/ac/all")
async def control_ac_all(request: ACControlAllRequest, db: Session = Depends(get_db_rw)):
    """
    Kontrol semua AC dalam satu room.
    Data AC diambil dari PostgreSQL (conn_info.ip).
    """
    devices = crud.get_devices_by_room(db, request.room_id)
    ac_devices = [d for d in devices if d.type == "ac"]
    if not ac_devices:
        return {"status": "no_devices", "results": []}

    tasks = [
        ACService(d.conn_info.get("ip", "")).control_ac(request.power, request.temperature)
        for d in ac_devices
        if d.conn_info and d.conn_info.get("ip")
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    ac_results = []
    success_count = 0
    for dev, res in zip(ac_devices, results):
        if isinstance(res, Exception):
            ac_results.append({"id": dev.id, "name": dev.name, "status": "failed", "error": str(res)})
        else:
            s = res.get("status", "failed")
            if s == "success":
                success_count += 1
            ac_results.append({"id": dev.id, "name": dev.name, "status": s, "error": res.get("error")})

    total = len(ac_devices)
    
    if success_count > 0:
        updated_devices = []
        for dev in ac_devices:
            res = next((r for r in ac_results if r["id"] == dev.id), None)
            if res and res["status"] == "success":
                dev.status = request.power.lower()
                new_state = dict(dev.last_state) if dev.last_state else {}
                new_state["temperature"] = request.temperature
                dev.last_state = new_state
                updated_devices.append({"id": dev.id, "status": request.power.lower()})
        db.commit()
        
        if updated_devices:
            logger.info(f"[WS] Broadcasting AC ALL update: room={request.room_id}, devices={updated_devices}")
            await ws_manager.broadcast({
                "type": "device_status",
                "room_id": request.room_id,
                "devices": updated_devices,
            })

    return {
        "status": "success" if success_count == total else "partial" if success_count > 0 else "failed",
        "summary": {"total": total, "success": success_count, "failed": total - success_count},
        "results": ac_results,
    }


@router.post("/ac/temperature")
async def set_ac_temperature(request: ACTempRequest, db: Session = Depends(get_db_rw)):
    """
    Set suhu AC dan nyalakan.
    Body: { "ip": "10.1.34.52", "temperature": 22 }
    """
    svc = ACService(request.ip)
    result = await svc.control_ac(request.power, request.temperature)
    
    if result.get("status") == "success":
        devices = db.query(Device).filter(Device.type == "ac").all()
        updated_devices = []
        target_dev = None
        for dev in devices:
            if dev.conn_info and dev.conn_info.get("ip") == request.ip:
                dev.status = request.power.lower()
                new_state = dict(dev.last_state) if dev.last_state else {}
                new_state["temperature"] = request.temperature
                dev.last_state = new_state
                target_dev = dev
                updated_devices.append({"id": dev.id, "status": request.power.lower()})
        db.commit()
        
        if target_dev and updated_devices:
            logger.info(f"[WS] Broadcasting AC TEMP update: room={target_dev.room_id}, devices={updated_devices}")
            await ws_manager.broadcast({
                "type": "device_status",
                "room_id": target_dev.room_id,
                "devices": updated_devices,
            })
            
    return {
        "status": result.get("status", "failed"),
        "ip": request.ip,
        "temperature": request.temperature,
        "error": result.get("error")
    }

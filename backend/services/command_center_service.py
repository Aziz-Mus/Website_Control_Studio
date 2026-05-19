"""
Command Center Service ΓÇö WiZ Ceiling Light Control
Adapted from Flask app.py to FastAPI async-native pattern.
43 ceiling lights in a grid topology.
"""
import asyncio
import json
import sys
import threading
from pathlib import Path


# Fix for Windows asyncio + UDP (pywizlight uses UDP)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from pywizlight import PilotBuilder, wizlight

# ΓöÇΓöÇΓöÇ Persistent Async Loop (shared singleton) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
_wiz_loop = asyncio.new_event_loop()
_loop_thread = threading.Thread(
    target=lambda: (_wiz_loop.run_forever()),
    daemon=True
)
_loop_thread.start()

# ΓöÇΓöÇΓöÇ Animation State ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
ANIM_STATE = {"running": False, "name": "", "task": None}

# ΓöÇΓöÇΓöÇ Light Topology (43 Lights) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
_LIGHTS_FILE = Path(__file__).parent.parent / "data" / "command_center" / "lights.json"

def _load_lights() -> list:
    """Load light topology from cc_lights.json. Falls back to empty list on error."""
    try:
        return json.loads(_LIGHTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

# Module-level cache ΓÇö reloaded on each /lights or /status request via get_lights()
LIGHTS: list = _load_lights()


def get_lights() -> list:
    """Always return the latest lights from JSON (hot-reload support)."""
    global LIGHTS
    LIGHTS = _load_lights()
    return LIGHTS

# ΓöÇΓöÇΓöÇ Low-level WiZ Helpers (run on the background loop) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async def _control_single(ip: str, action: str, brightness=None, rgb=None, colortemp=None):
    """Control one WiZ light. brightness 0-100 (%), rgb tuple, colortemp 2200-6500."""
    light = wizlight(ip)
    try:
        if action == "off":
            await asyncio.wait_for(light.turn_off(), timeout=5)
        else:
            kwargs = {}
            if brightness is not None:
                kwargs["brightness"] = max(0, min(255, int(brightness * 255 / 100)))
            if rgb:
                kwargs["rgb"] = (
                    max(0, min(255, int(rgb[0]))),
                    max(0, min(255, int(rgb[1]))),
                    max(0, min(255, int(rgb[2]))),
                )
            elif colortemp:
                kwargs["colortemp"] = max(2200, min(6500, int(colortemp)))
            await asyncio.wait_for(light.turn_on(PilotBuilder(**kwargs)), timeout=5)
        return {"ip": ip, "success": True}
    except asyncio.TimeoutError:
        return {"ip": ip, "success": False, "error": "Timeout"}
    except Exception as e:
        return {"ip": ip, "success": False, "error": str(e)}
    finally:
        await light.async_close()


async def _get_status(ip: str) -> dict:
    """Query one WiZ light for its current state."""
    light = wizlight(ip)
    try:
        state = await asyncio.wait_for(light.updateState(), timeout=2.0)
        if state:
            raw_brightness = state.get_brightness()
            rgb = state.get_rgb()
            return {
                "ip": ip,
                "online": True,
                "is_on": state.get_state(),
                "brightness": round((raw_brightness or 0) * 100 / 255),
                "rgb": list(rgb) if rgb else None,
                "colortemp": state.get_colortemp(),
            }
        return {"ip": ip, "online": False}
    except Exception:
        return {"ip": ip, "online": False}
    finally:
        await light.async_close()


# ΓöÇΓöÇΓöÇ Public API (called from FastAPI routes via run_coroutine_threadsafe) ΓöÇΓöÇΓöÇΓöÇΓöÇ

def run_on_wiz_loop(coro):
    """Run a coroutine on the background WiZ event loop and block until done."""
    future = asyncio.run_coroutine_threadsafe(coro, _wiz_loop)
    return future.result()


async def _control_many(ips, action, brightness, rgb, colortemp):
    tasks = [_control_single(ip, action, brightness, rgb, colortemp) for ip in ips]
    return await asyncio.gather(*tasks)


async def _status_all(all_lights):
    tasks = [_get_status(l["ip"]) for l in all_lights]
    return await asyncio.gather(*tasks)


def control_lights(ips: list, action: str, brightness=None, rgb=None, colortemp=None) -> list:
    """Synchronously control multiple lights. Returns list of results."""
    return list(run_on_wiz_loop(_control_many(ips, action, brightness, rgb, colortemp)))


def get_all_status() -> list:
    """Synchronously poll status of all lights (reads latest topology from JSON)."""
    return list(run_on_wiz_loop(_status_all(get_lights())))



# ΓöÇΓöÇΓöÇ Animation Engine ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async def _run_animation_loop(frames: list, interval: float, ips: list):
    step = 0
    while ANIM_STATE["running"]:
        try:
            f = frames[step % len(frames)]
            tasks = [
                asyncio.create_task(
                    _control_single(ip, "on", f.get("brightness"), f.get("rgb"), f.get("colortemp"))
                )
                for ip in ips
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            step += 1
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(1)


def start_animation(name: str, frames: list, interval: float, ips: list):
    """Start an animation loop (non-blocking). Stops any running animation first."""
    stop_animation()
    ANIM_STATE["running"] = True
    ANIM_STATE["name"] = name
    ANIM_STATE["task"] = asyncio.run_coroutine_threadsafe(
        _run_animation_loop(frames, interval, ips), _wiz_loop
    )


def stop_animation():
    """Stop the running animation if any."""
    if ANIM_STATE["task"]:
        ANIM_STATE["running"] = False
        ANIM_STATE["task"].cancel()
        ANIM_STATE["task"] = None
        ANIM_STATE["name"] = ""


def get_animation_state() -> dict:
    return {"running": ANIM_STATE["running"], "name": ANIM_STATE["name"]}

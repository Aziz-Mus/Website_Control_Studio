"""Router: Command Center — WiZ Ceiling Light Control"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.models import CCControlRequest, CCAnimStartRequest, CCPresetCreate, CCAnimationCreate
from services.storage import (
    read_json, write_json, next_kode,
    CC_PRESETS_FILE, CC_ANIMATIONS_FILE,
    CC_DEVICES_FILE, CC_GRID_LAYOUT_FILE, CC_SAVED_SEL_FILE,
)
from services.command_center_service import (
    get_lights, control_lights, get_all_status, get_animation_state,
    start_animation, stop_animation
)


router = APIRouter(prefix="/command-center", tags=["Command Center"])


# ─── Pydantic models (local) ──────────────────────────────────────────────────
class CCDeviceCreate(BaseModel):
    ip: str
    nama: str

class CCDeviceUpdate(BaseModel):
    ip: Optional[str] = None
    nama: Optional[str] = None

class GridLayoutSave(BaseModel):
    cols: int
    rows: int
    cells: Dict[str, int]  # cellIdx(str) → kode(int)

class SavedSelectionCreate(BaseModel):
    name: str
    kodes: List[int]




# ─── Lights topology ─────────────────────────────────────────────────────────

@router.get("/lights")
async def get_lights_endpoint():
    """Return the static topology of all ceiling lights (reads from cc_lights.json)."""
    lights = get_lights()
    return {"count": len(lights), "lights": lights}


@router.get("/status")
async def get_status():
    """Poll online/offline + color state of all lights. Runs concurrently."""
    lights = get_lights()
    statuses = get_all_status()
    # Map ip → status for quick lookup
    status_map = {s["ip"]: s for s in statuses}
    result = []
    for light in lights:
        s = status_map.get(light["ip"], {"ip": light["ip"], "online": False})
        result.append({"id": light["id"], "baris": light["baris"], "kolom": light["kolom"], **s})
    return {
        "lights": result,
        "animation": get_animation_state(),
    }



# ─── Light control ─────────────────────────────────────────────────────────────

@router.post("/control")
async def control(request: CCControlRequest):
    """
    Control selected lights.
    Body: { ips, action, brightness?, rgb?, colortemp? }
    """
    if not request.ips:
        raise HTTPException(status_code=400, detail="No lights selected")

    results = control_lights(
        ips=request.ips,
        action=request.action,
        brightness=request.brightness,
        rgb=request.rgb,
        colortemp=request.colortemp,
    )
    success = sum(1 for r in results if r.get("success"))
    total = len(results)
    return {
        "status": "success" if success == total else "partial_success" if success > 0 else "failed",
        "summary": {"total": total, "success": success, "failed": total - success},
        "results": results,
    }


# ─── Animation ───────────────────────────────────────────────────────────────

@router.post("/animation/start")
async def anim_start(request: CCAnimStartRequest):
    """Start an animation loop on selected lights."""
    if not request.ips:
        raise HTTPException(status_code=400, detail="No lights selected")
    if not request.frames:
        raise HTTPException(status_code=400, detail="No frames provided")
    start_animation(
        name=request.name,
        frames=[f.dict() for f in request.frames],
        interval=request.interval,
        ips=request.ips,
    )
    return {"status": "started", "name": request.name, "lights": len(request.ips)}


@router.post("/animation/stop")
async def anim_stop():
    """Stop the currently running animation."""
    stop_animation()
    return {"status": "stopped"}


@router.get("/animation/state")
async def anim_state():
    """Get current animation running state."""
    return get_animation_state()


# ─── Presets CRUD ─────────────────────────────────────────────────────────────

@router.get("/presets")
async def list_presets():
    return read_json(CC_PRESETS_FILE)


@router.post("/presets", status_code=201)
async def create_preset(data: CCPresetCreate):
    presets = read_json(CC_PRESETS_FILE)
    preset = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "settings": data.settings,
    }
    presets.append(preset)
    write_json(CC_PRESETS_FILE, presets)
    return preset


@router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    presets = read_json(CC_PRESETS_FILE)
    new = [p for p in presets if p["id"] != preset_id]
    if len(new) == len(presets):
        raise HTTPException(status_code=404, detail="Preset not found")
    write_json(CC_PRESETS_FILE, new)
    return {"status": "deleted"}


# ─── Animations CRUD ─────────────────────────────────────────────────────────

@router.get("/animations")
async def list_animations():
    return read_json(CC_ANIMATIONS_FILE)


@router.post("/animations", status_code=201)
async def create_animation(data: CCAnimationCreate):
    animations = read_json(CC_ANIMATIONS_FILE)
    anim = {
        "id": "u_" + str(uuid.uuid4())[:8],
        "name": data.name.strip(),
        "frames": [f.dict() for f in data.frames],
    }
    animations.append(anim)
    write_json(CC_ANIMATIONS_FILE, animations)
    return anim


@router.delete("/animations/{anim_id}")
async def delete_animation(anim_id: str):
    animations = read_json(CC_ANIMATIONS_FILE)
    new = [a for a in animations if a["id"] != anim_id]
    if len(new) == len(animations):
        raise HTTPException(status_code=404, detail="Animation not found")
    write_json(CC_ANIMATIONS_FILE, new)
    return {"status": "deleted"}


# ─── Device CRUD (like showcase/studio_neon) ──────────────────────────────────

@router.get("/devices")
async def list_devices():
    return {"devices": read_json(CC_DEVICES_FILE)}

@router.post("/devices", status_code=201)
async def add_device(device: CCDeviceCreate):
    devices = read_json(CC_DEVICES_FILE)
    kode = next_kode(devices)
    new = {"kode": kode, "ip": device.ip, "nama": device.nama}
    devices.append(new)
    write_json(CC_DEVICES_FILE, devices)
    return {"status": "success", "device": new}

@router.put("/devices/{kode}")
async def update_device(kode: int, update: CCDeviceUpdate):
    devices = read_json(CC_DEVICES_FILE)
    dev = next((d for d in devices if d["kode"] == kode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if update.ip is not None:   dev["ip"]   = update.ip
    if update.nama is not None: dev["nama"] = update.nama
    write_json(CC_DEVICES_FILE, devices)
    return {"status": "success", "device": dev}

@router.delete("/devices/{kode}")
async def delete_device(kode: int):
    devices = read_json(CC_DEVICES_FILE)
    new = [d for d in devices if d["kode"] != kode]
    if len(new) == len(devices):
        raise HTTPException(status_code=404, detail="Device not found")
    write_json(CC_DEVICES_FILE, new)
    return {"status": "deleted"}


# ─── Turn off all devices ─────────────────────────────────────────────────────

@router.post("/turn-off")
async def turn_off_all():
    devices = read_json(CC_DEVICES_FILE)
    if not devices:
        return {"status": "no_devices"}
    ips = [d["ip"] for d in devices]
    results = control_lights(ips=ips, action="off")
    sc = sum(1 for r in results if r.get("success"))
    report = []
    for d, r in zip(devices, results):
        report.append({**d, "status": "success" if r.get("success") else "failed"})
    return {
        "status": "success" if sc == len(results) else "partial_success" if sc > 0 else "failed",
        "summary": {"total": len(results), "success": sc, "failed": len(results) - sc},
        "devices": report,
    }


# ─── Control by kode (like showcase /lampu) ───────────────────────────────────

@router.post("/lampu")
async def control_lampu(request: CCControlRequest):
    """
    Control CC devices by kode (KodeLampu) or all.
    Mirrors the showcase /lampu endpoint pattern.
    """
    devices = read_json(CC_DEVICES_FILE)
    if request.ips:
        # Direct IP control (existing path)
        targets = request.ips
    elif hasattr(request, 'KodeLampu') and request.KodeLampu is not None:
        dev = next((d for d in devices if d["kode"] == request.KodeLampu), None)
        if not dev:
            raise HTTPException(status_code=404, detail="Device not found")
        targets = [dev["ip"]]
    else:
        targets = [d["ip"] for d in devices]
    if not targets:
        return {"status": "no_devices"}
    results = control_lights(
        ips=targets, action=request.action,
        brightness=request.brightness, rgb=request.rgb, colortemp=request.colortemp,
    )
    sc = sum(1 for r in results if r.get("success"))
    report = []
    for ip, r in zip(targets, results):
        dev = next((d for d in devices if d["ip"] == ip), {"ip": ip})
        report.append({**dev, "status": "success" if r.get("success") else "failed"})
    return {
        "status": "success" if sc == len(results) else "partial_success" if sc > 0 else "failed",
        "summary": {"total": len(results), "success": sc, "failed": len(results) - sc},
        "devices": report,
    }


# ─── Grid Layout ─────────────────────────────────────────────────────────────

@router.get("/grid-layout")
async def get_grid_layout():
    layout = read_json(CC_GRID_LAYOUT_FILE, raw=True)
    if not isinstance(layout, dict):
        layout = {"cols": 4, "rows": 5, "cells": {}}
    return layout

@router.put("/grid-layout")
async def save_grid_layout(data: GridLayoutSave):
    layout = {"cols": data.cols, "rows": data.rows, "cells": data.cells}
    write_json(CC_GRID_LAYOUT_FILE, layout, raw=True)
    return {"status": "saved", "layout": layout}


# ─── Saved Selections ─────────────────────────────────────────────────────────

@router.get("/saved-selections")
async def get_saved_selections():
    return read_json(CC_SAVED_SEL_FILE)

@router.post("/saved-selections", status_code=201)
async def create_saved_selection(data: SavedSelectionCreate):
    selections = read_json(CC_SAVED_SEL_FILE)
    sel = {"id": str(uuid.uuid4())[:8], "name": data.name.strip(), "kodes": data.kodes}
    selections.append(sel)
    write_json(CC_SAVED_SEL_FILE, selections)
    return sel

@router.delete("/saved-selections/{sel_id}")
async def delete_saved_selection(sel_id: str):
    selections = read_json(CC_SAVED_SEL_FILE)
    new = [s for s in selections if s["id"] != sel_id]
    if len(new) == len(selections):
        raise HTTPException(status_code=404, detail="Selection not found")
    write_json(CC_SAVED_SEL_FILE, new)
    return {"status": "deleted"}

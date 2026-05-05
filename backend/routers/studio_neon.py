"""Router: Studio Neon endpoints"""
import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
from services.models import ControlRequest, DeviceCreate, DeviceUpdate, parse_warna
from services.storage import (
    read_json, write_json, next_kode,
    STUDIO_NEON_FILE, STUDIO_NEON_GRID_LAYOUT_FILE, STUDIO_NEON_SAVED_SEL_FILE,
)
from services.bulb_service import control_wiz_light, turn_off_wiz_light

router = APIRouter(prefix="/studio/neon", tags=["Studio Neon"])

class GridLayoutSave(BaseModel):
    cols: int; rows: int; cells: Dict[str, int]

class SavedSelectionCreate(BaseModel):
    name: str; kodes: List[int]



async def _neon_control(file: str, request: ControlRequest):
    scene_id = request.SceneId
    color = parse_warna(request.Warna) if not scene_id else None
    devices = read_json(file)
    if request.KodeLampu is not None:
        target = next((d for d in devices if d["kode"] == request.KodeLampu), None)
        if not target:
            raise HTTPException(status_code=404, detail=f"Lampu kode {request.KodeLampu} tidak ditemukan")
        result = await control_wiz_light(target["ip"], color, request.Kecerahan, scene_id=scene_id)
        data_info = {"scene_id": scene_id, "brightness": request.Kecerahan} if scene_id else {"rgb": [color.Red, color.Green, color.Blue], "brightness": request.Kecerahan}
        return {"status": result["status"], "data_sent": data_info, "device": {**target, **result}}
    if not devices:
        return {"status": "no_devices"}
    tasks = [control_wiz_light(d["ip"], color, request.Kecerahan, scene_id=scene_id) for d in devices]
    results = await asyncio.gather(*tasks)
    report = [{**devices[i], **r} for i, r in enumerate(results)]
    sc = sum(1 for r in report if r["status"] == "success")
    return {"status": "success" if sc == len(report) else "partial_success" if sc > 0 else "failed", "summary": {"total": len(report), "success": sc, "failed": len(report) - sc}, "devices": report}


async def _neon_turn_off(file: str):
    devices = read_json(file)
    if not devices:
        return {"status": "no_devices", "devices": []}
    tasks = [turn_off_wiz_light(d["ip"]) for d in devices]
    results = await asyncio.gather(*tasks)
    report = [{**devices[i], **r} for i, r in enumerate(results)]
    sc = sum(1 for r in report if r["status"] == "success")
    return {"status": "success" if sc == len(report) else "partial_success", "summary": {"total": len(report), "success": sc, "failed": len(report) - sc}, "devices": report}


@router.get("/devices")
async def get_studio_neon_devices():
    d = read_json(STUDIO_NEON_FILE)
    return {"count": len(d), "devices": d}


@router.post("/devices")
async def add_studio_neon_device(device: DeviceCreate):
    devices = read_json(STUDIO_NEON_FILE)
    kode = next_kode(devices)
    new = {"ip": device.ip, "nama": device.nama, "kode": kode}
    devices.append(new)
    write_json(STUDIO_NEON_FILE, devices)
    return {"status": "success", "device": new}


@router.put("/devices/{kode}")
async def update_studio_neon_device(kode: int, update: DeviceUpdate):
    devices = read_json(STUDIO_NEON_FILE)
    dev = next((d for d in devices if d["kode"] == kode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Not found")
    if update.ip is not None:
        dev["ip"] = update.ip
    if update.nama is not None:
        dev["nama"] = update.nama
    write_json(STUDIO_NEON_FILE, devices)
    return {"status": "success", "device": dev}


@router.delete("/devices/{kode}")
async def delete_studio_neon_device(kode: int):
    devices = read_json(STUDIO_NEON_FILE)
    new = [d for d in devices if d.get("kode") != kode]
    if len(new) == len(devices):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(STUDIO_NEON_FILE, new)
    return {"status": "success"}


@router.post("/lampu")
async def control_studio_neon(request: ControlRequest):
    return await _neon_control(STUDIO_NEON_FILE, request)


@router.post("/turn-off")
async def turn_off_studio_neon():
    return await _neon_turn_off(STUDIO_NEON_FILE)


# ─── Grid Layout ───────────────────────────────────────────────────────────

@router.get("/grid-layout")
async def get_grid_layout():
    layout = read_json(STUDIO_NEON_GRID_LAYOUT_FILE, raw=True)
    return layout if isinstance(layout, dict) else {"cols": 4, "rows": 5, "cells": {}}

@router.put("/grid-layout")
async def save_grid_layout(data: GridLayoutSave):
    layout = {"cols": data.cols, "rows": data.rows, "cells": data.cells}
    write_json(STUDIO_NEON_GRID_LAYOUT_FILE, layout, raw=True)
    return {"status": "saved", "layout": layout}


# ─── Saved Selections ───────────────────────────────────────────────────────

@router.get("/saved-selections")
async def get_saved_selections():
    return read_json(STUDIO_NEON_SAVED_SEL_FILE)

@router.post("/saved-selections", status_code=201)
async def create_saved_selection(data: SavedSelectionCreate):
    sels = read_json(STUDIO_NEON_SAVED_SEL_FILE)
    sel = {"id": str(uuid.uuid4())[:8], "name": data.name.strip(), "kodes": data.kodes}
    sels.append(sel); write_json(STUDIO_NEON_SAVED_SEL_FILE, sels)
    return sel

@router.delete("/saved-selections/{sel_id}")
async def delete_saved_selection(sel_id: str):
    sels = read_json(STUDIO_NEON_SAVED_SEL_FILE)
    new = [s for s in sels if s["id"] != sel_id]
    if len(new) == len(sels):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(STUDIO_NEON_SAVED_SEL_FILE, new)
    return {"status": "deleted"}

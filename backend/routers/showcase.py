"""Router: Showcase Neon endpoints"""
import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
from services.models import ControlRequest, DeviceCreate, DeviceUpdate, parse_warna
from services.storage import (
    read_json, write_json, next_kode,
    SHOWCASE_NEON_FILE, SHOWCASE_GRID_LAYOUT_FILE, SHOWCASE_SAVED_SEL_FILE,
)
from services.bulb_service import control_wiz_light, turn_off_wiz_light

router = APIRouter(prefix="/showcase", tags=["Showcase Neon"])

class GridLayoutSave(BaseModel):
    cols: int; rows: int; cells: Dict[str, int]

class TurnOffRequest(BaseModel):
    KodeLampu: int | None = None

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


async def _neon_turn_off(file: str, kode_lampu: int = None):
    devices = read_json(file)
    if not devices:
        return {"status": "no_devices", "devices": []}
    if kode_lampu is not None:
        target = next((d for d in devices if d["kode"] == kode_lampu), None)
        if not target:
            raise HTTPException(status_code=404, detail=f"Lampu kode {kode_lampu} tidak ditemukan")
        result = await turn_off_wiz_light(target["ip"])
        return {"status": result["status"], "device": {**target, **result}}
    tasks = [turn_off_wiz_light(d["ip"]) for d in devices]
    results = await asyncio.gather(*tasks)
    report = [{**devices[i], **r} for i, r in enumerate(results)]
    sc = sum(1 for r in report if r["status"] == "success")
    return {"status": "success" if sc == len(report) else "partial_success", "summary": {"total": len(report), "success": sc, "failed": len(report) - sc}, "devices": report}


@router.get("/devices")
async def get_showcase_devices():
    d = read_json(SHOWCASE_NEON_FILE)
    return {"count": len(d), "devices": d}


@router.post("/devices")
async def add_showcase_device(device: DeviceCreate):
    devices = read_json(SHOWCASE_NEON_FILE)
    kode = next_kode(devices)
    new = {"ip": device.ip, "nama": device.nama, "kode": kode}
    devices.append(new)
    write_json(SHOWCASE_NEON_FILE, devices)
    return {"status": "success", "device": new}


@router.put("/devices/{kode}")
async def update_showcase_device(kode: int, update: DeviceUpdate):
    devices = read_json(SHOWCASE_NEON_FILE)
    dev = next((d for d in devices if d["kode"] == kode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device tidak ditemukan")
    if update.ip is not None:
        dev["ip"] = update.ip
    if update.nama is not None:
        dev["nama"] = update.nama
    write_json(SHOWCASE_NEON_FILE, devices)
    return {"status": "success", "device": dev}


@router.delete("/devices/{kode}")
async def delete_showcase_device(kode: int):
    devices = read_json(SHOWCASE_NEON_FILE)
    new = [d for d in devices if d.get("kode") != kode]
    if len(new) == len(devices):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(SHOWCASE_NEON_FILE, new)
    return {"status": "success"}


@router.post("/lampu")
async def control_showcase(request: ControlRequest):
    return await _neon_control(SHOWCASE_NEON_FILE, request)


@router.post("/turn-off")
async def turn_off_showcase(req: TurnOffRequest = None):
    kode = req.KodeLampu if req else None
    return await _neon_turn_off(SHOWCASE_NEON_FILE, kode)


# ─── Grid Layout ─────────────────────────────────────────────────────────────

@router.get("/grid-layout")
async def get_grid_layout():
    layout = read_json(SHOWCASE_GRID_LAYOUT_FILE, raw=True)
    return layout if isinstance(layout, dict) else {"cols": 4, "rows": 5, "cells": {}}

@router.put("/grid-layout")
async def save_grid_layout(data: GridLayoutSave):
    layout = {"cols": data.cols, "rows": data.rows, "cells": data.cells}
    write_json(SHOWCASE_GRID_LAYOUT_FILE, layout, raw=True)
    return {"status": "saved", "layout": layout}


# ─── Saved Selections ─────────────────────────────────────────────────────────

@router.get("/saved-selections")
async def get_saved_selections():
    return read_json(SHOWCASE_SAVED_SEL_FILE)

@router.post("/saved-selections", status_code=201)
async def create_saved_selection(data: SavedSelectionCreate):
    sels = read_json(SHOWCASE_SAVED_SEL_FILE)
    sel = {"id": str(uuid.uuid4())[:8], "name": data.name.strip(), "kodes": data.kodes}
    sels.append(sel); write_json(SHOWCASE_SAVED_SEL_FILE, sels)
    return sel

@router.delete("/saved-selections/{sel_id}")
async def delete_saved_selection(sel_id: str):
    sels = read_json(SHOWCASE_SAVED_SEL_FILE)
    new = [s for s in sels if s["id"] != sel_id]
    if len(new) == len(sels):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(SHOWCASE_SAVED_SEL_FILE, new)
    return {"status": "deleted"}

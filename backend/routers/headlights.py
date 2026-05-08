"""Router: Headlights (Flat — single ESP + relays) endpoints"""
import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from services.models import RelayCreate, RelayUpdate, HLSavedSelCreate
from services.storage import (
    read_json, write_json, next_relay_id,
    HL_CONFIG_FILE, HL_RELAY_SAVED_SEL_FILE, HL_GRID_LAYOUT_FILE,
)

router = APIRouter(prefix="/studio/headlights", tags=["Studio Headlights"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _hl_config():
    return read_json(HL_CONFIG_FILE, raw=True) or {}

def _hl_write(cfg):
    write_json(HL_CONFIG_FILE, cfg, raw=True)


# ─── Config (ESP IP) ─────────────────────────────────────────────────────────

@router.get("/config")
async def get_hl_config():
    cfg = _hl_config()
    return {"espIpAddress": cfg.get("espIpAddress", ""), "relays": cfg.get("relays", [])}


@router.put("/config")
async def update_hl_config(data: dict):
    cfg = _hl_config()
    if "espIpAddress" in data:
        cfg["espIpAddress"] = data["espIpAddress"]
    _hl_write(cfg)
    return {"status": "success", "config": cfg}


# ─── Relays CRUD ──────────────────────────────────────────────────────────────

@router.post("/relays")
async def add_hl_relay(relay: RelayCreate):
    cfg = _hl_config()
    relays = cfg.get("relays", [])
    rlid = next_relay_id(relays)
    new_relay = {"relayId": rlid, "deviceName": relay.deviceName, "channelCode": relay.channelCode}
    relays.append(new_relay)
    cfg["relays"] = relays
    _hl_write(cfg)
    return {"status": "success", "relay": new_relay}


@router.put("/relays/{relay_id}")
async def update_hl_relay(relay_id: str, update: RelayUpdate):
    cfg = _hl_config()
    relays = cfg.get("relays", [])
    relay = next((rl for rl in relays if rl["relayId"] == relay_id), None)
    if not relay:
        raise HTTPException(status_code=404, detail="Not found")
    if update.deviceName is not None:
        relay["deviceName"] = update.deviceName
    if update.channelCode is not None:
        relay["channelCode"] = update.channelCode
    _hl_write(cfg)
    return {"status": "success", "relay": relay}


@router.delete("/relays/{relay_id}")
async def delete_hl_relay(relay_id: str):
    cfg = _hl_config()
    relays = cfg.get("relays", [])
    old = len(relays)
    cfg["relays"] = [rl for rl in relays if rl["relayId"] != relay_id]
    if len(cfg["relays"]) == old:
        raise HTTPException(status_code=404, detail="Not found")
    _hl_write(cfg)
    return {"status": "success"}


# ─── Grid Layout ─────────────────────────────────────────────────────────────

@router.get("/grid-layout")
async def get_grid_layout():
    layout = read_json(HL_GRID_LAYOUT_FILE, raw=True)
    return layout if isinstance(layout, dict) else {"cols": 4, "rows": 5, "cells": {}}


@router.put("/grid-layout")
async def save_grid_layout(data: dict):
    layout = {"cols": data.get("cols", 4), "rows": data.get("rows", 5), "cells": data.get("cells", {})}
    write_json(HL_GRID_LAYOUT_FILE, layout, raw=True)
    return {"status": "saved", "layout": layout}


# ─── Saved Selections ────────────────────────────────────────────────────────

@router.get("/saved-selections")
async def get_saved_selections():
    return read_json(HL_RELAY_SAVED_SEL_FILE)


@router.post("/saved-selections", status_code=201)
async def create_saved_selection(data: HLSavedSelCreate):
    all_sels = read_json(HL_RELAY_SAVED_SEL_FILE)
    relay_ids = data.relay_ids or data.kodes or []
    sel = {"id": str(uuid.uuid4())[:8], "name": data.name.strip(), "relay_ids": relay_ids}
    all_sels.append(sel)
    write_json(HL_RELAY_SAVED_SEL_FILE, all_sels)
    return sel


@router.delete("/saved-selections/{sel_id}")
async def delete_saved_selection(sel_id: str):
    all_sels = read_json(HL_RELAY_SAVED_SEL_FILE)
    new = [s for s in all_sels if s["id"] != sel_id]
    if len(new) == len(all_sels):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(HL_RELAY_SAVED_SEL_FILE, new)
    return {"status": "deleted"}


# ─── Bulk Relay Control ──────────────────────────────────────────────────────

async def _relay_control(relays: list, esp_ip: str, state: str):
    from services.relay_service import RelayService

    if not relays or not esp_ip:
        return {"status": "failed", "error": "No relays or ESP IP configured"}

    svc = RelayService(esp_ip)
    channels = [r["channelCode"] for r in relays]
    relay_ids = [r["relayId"] for r in relays]
    print(f"[HL] Bulk {state} → {esp_ip} | {len(channels)} channels: {channels}")

    res = await svc.control_bulk(channels, state)

    results = []
    status = "success" if isinstance(res, dict) and res.get("status") == "success" else "failed"
    error = str(res) if isinstance(res, Exception) else (res.get("error") if isinstance(res, dict) else None)
    for rid, code in zip(relay_ids, channels):
        results.append({"relayId": rid, "channelCode": code, "status": status, "error": error})

    total   = len(results)
    success = sum(1 for r in results if r["status"] == "success")
    return {
        "status": "success" if success == total else "partial_success" if success > 0 else "failed",
        "summary": {"total": total, "success": success, "failed": total - success},
        "relays": results,
    }


@router.post("/control")
async def control_hl(data: dict):
    """Activate selected relays. Body: { espIpAddress, relays: [{relayId, channelCode}] }"""
    return await _relay_control(data.get("relays", []), data.get("espIpAddress", ""), "ON")


@router.post("/deactivate")
async def deactivate_hl(data: dict):
    """Deactivate selected relays. Body: { espIpAddress, relays: [{relayId, channelCode}] }"""
    return await _relay_control(data.get("relays", []), data.get("espIpAddress", ""), "OFF")
"""Router: Headlights (Room → Relay) endpoints"""
import asyncio
import uuid
from fastapi import APIRouter, HTTPException
from services.models import (
    RoomCreate, RoomUpdate, RelayCreate, RelayUpdate,
    BulkControlRequest,
    HLRelaySavedSelCreate, HLRoomSavedSelCreate, HLRoomGridLayoutSave,
)
from services.storage import (
    read_json, write_json, next_room_id, next_relay_id,
    HL_ROOMS_FILE,
    HL_RELAY_SAVED_SEL_FILE,
    HL_ROOM_SAVED_SEL_FILE,
    HL_ROOM_GRID_LAYOUT_FILE,
)

router = APIRouter(prefix="/studio/headlights", tags=["Studio Headlights"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _hl_rooms():
    return read_json(HL_ROOMS_FILE, "rooms")

def _hl_write(rooms):
    write_json(HL_ROOMS_FILE, rooms, "rooms")


# ─── Bulk Relay Control (Optimized: one HTTP request per ESP) ─────────────────

async def _relay_control(request: BulkControlRequest, state: str):
    from services.relay_service import RelayService

    # Group relays by ESP IP
    esp_groups = {}
    for room_req in request.rooms:
        ip = room_req.espIpAddress
        if ip not in esp_groups:
            esp_groups[ip] = {"roomId": room_req.roomId, "channels": [], "relay_ids": []}
        for relay in room_req.relays:
            esp_groups[ip]["channels"].append(relay.channelCode)
            esp_groups[ip]["relay_ids"].append(relay.relayId)

    if not esp_groups:
        return {"status": "failed", "error": "No target IPs found"}

    # Send ONE bulk request per ESP (avoids ESP32 socket limit)
    tasks = []
    ips = list(esp_groups.keys())
    for ip in ips:
        svc = RelayService(ip)
        channels = esp_groups[ip]["channels"]
        print(f"[HL] Bulk {state} → {ip} | {len(channels)} channels: {channels}")
        tasks.append(svc.control_bulk(channels, state))

    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build structured response
    final_rooms = []
    for ip, res in zip(ips, raw_results):
        group = esp_groups[ip]
        room_res = {"roomId": group["roomId"], "espIpAddress": ip, "relays": []}
        status = "success" if isinstance(res, dict) and res.get("status") == "success" else "failed"
        error = str(res) if isinstance(res, Exception) else (res.get("error") if isinstance(res, dict) else None)
        for rid, code in zip(group["relay_ids"], group["channels"]):
            room_res["relays"].append({"relayId": rid, "channelCode": code, "status": status, "error": error})
        final_rooms.append(room_res)

    total   = sum(len(r["relays"]) for r in final_rooms)
    success = sum(1 for r in final_rooms for rl in r["relays"] if rl["status"] == "success")
    return {
        "status": "success" if success == total else "partial_success" if success > 0 else "failed",
        "summary": {"total": total, "success": success, "failed": total - success},
        "rooms": final_rooms,
    }


# ─── Rooms CRUD ───────────────────────────────────────────────────────────────

@router.get("/rooms")
async def get_hl_rooms():
    rooms = _hl_rooms()
    return {"count": len(rooms), "rooms": rooms}


@router.post("/rooms")
async def add_hl_room(room: RoomCreate):
    rooms = _hl_rooms()
    rid = next_room_id(rooms)
    new_room = {"roomId": rid, "roomName": room.roomName, "espIpAddress": room.espIpAddress, "relays": []}
    rooms.append(new_room)
    _hl_write(rooms)
    return {"status": "success", "room": new_room}


@router.get("/rooms/{room_id}")
async def get_hl_room(room_id: str):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "success", "room": room}


@router.put("/rooms/{room_id}")
async def update_hl_room(room_id: str, update: RoomUpdate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    if update.roomName is not None:
        room["roomName"] = update.roomName
    if update.espIpAddress is not None:
        room["espIpAddress"] = update.espIpAddress
    _hl_write(rooms)
    return {"status": "success", "room": room}


@router.delete("/rooms/{room_id}")
async def delete_hl_room(room_id: str):
    rooms = _hl_rooms()
    new = [r for r in rooms if r["roomId"] != room_id]
    if len(new) == len(rooms):
        raise HTTPException(status_code=404, detail="Not found")
    _hl_write(new)
    return {"status": "success"}


# ─── Relays CRUD ──────────────────────────────────────────────────────────────

@router.post("/rooms/{room_id}/relays")
async def add_hl_relay(room_id: str, relay: RelayCreate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    rlid = next_relay_id(room.get("relays", []))
    new_relay = {"relayId": rlid, "deviceName": relay.deviceName, "channelCode": relay.channelCode}
    room.setdefault("relays", []).append(new_relay)
    _hl_write(rooms)
    return {"status": "success", "relay": new_relay}


@router.put("/rooms/{room_id}/relays/{relay_id}")
async def update_hl_relay(room_id: str, relay_id: str, update: RelayUpdate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    relay = next((rl for rl in room.get("relays", []) if rl["relayId"] == relay_id), None)
    if not relay:
        raise HTTPException(status_code=404, detail="Not found")
    if update.deviceName is not None:
        relay["deviceName"] = update.deviceName
    if update.channelCode is not None:
        relay["channelCode"] = update.channelCode
    _hl_write(rooms)
    return {"status": "success", "relay": relay}


@router.delete("/rooms/{room_id}/relays/{relay_id}")
async def delete_hl_relay(room_id: str, relay_id: str):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    old = len(room.get("relays", []))
    room["relays"] = [rl for rl in room.get("relays", []) if rl["relayId"] != relay_id]
    if len(room["relays"]) == old:
        raise HTTPException(status_code=404, detail="Not found")
    _hl_write(rooms)
    return {"status": "success"}


# ─── Relay Grid Layout (per room) ─────────────────────────────────────────────

@router.get("/rooms/{room_id}/grid-layout")
async def get_relay_grid_layout(room_id: str):
    all_layouts = read_json(HL_ROOM_GRID_LAYOUT_FILE, raw=True) or {}
    layout = all_layouts.get(room_id, {"cols": 4, "rows": 5, "cells": {}})
    return layout


@router.put("/rooms/{room_id}/grid-layout")
async def save_relay_grid_layout(room_id: str, data: HLRoomGridLayoutSave):
    all_layouts = read_json(HL_ROOM_GRID_LAYOUT_FILE, raw=True) or {}
    all_layouts[room_id] = {"cols": data.cols, "rows": data.rows, "cells": data.cells}
    write_json(HL_ROOM_GRID_LAYOUT_FILE, all_layouts, raw=True)
    return {"status": "saved", "layout": all_layouts[room_id]}


# ─── Relay Saved Selections (per room) ────────────────────────────────────────

@router.get("/rooms/{room_id}/saved-selections")
async def get_relay_saved_selections(room_id: str):
    all_sels = read_json(HL_RELAY_SAVED_SEL_FILE)
    return [s for s in all_sels if s.get("room_id") == room_id]


@router.post("/rooms/{room_id}/saved-selections", status_code=201)
async def create_relay_saved_selection(room_id: str, data: HLRelaySavedSelCreate):
    all_sels = read_json(HL_RELAY_SAVED_SEL_FILE)
    relay_ids = data.relay_ids or data.kodes or []
    sel = {
        "id": str(uuid.uuid4())[:8],
        "room_id": room_id,
        "name": data.name.strip(),
        "relay_ids": relay_ids,
    }
    all_sels.append(sel)
    write_json(HL_RELAY_SAVED_SEL_FILE, all_sels)
    return sel


@router.delete("/rooms/{room_id}/saved-selections/{sel_id}")
async def delete_relay_saved_selection(room_id: str, sel_id: str):
    all_sels = read_json(HL_RELAY_SAVED_SEL_FILE)
    new = [s for s in all_sels if not (s["id"] == sel_id and s.get("room_id") == room_id)]
    if len(new) == len(all_sels):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(HL_RELAY_SAVED_SEL_FILE, new)
    return {"status": "deleted"}


# ─── Room Saved Selections (for the rooms list page) ──────────────────────────

@router.get("/saved-rooms")
async def get_room_saved_selections():
    return read_json(HL_ROOM_SAVED_SEL_FILE)


@router.post("/saved-rooms", status_code=201)
async def create_room_saved_selection(data: HLRoomSavedSelCreate):
    sels = read_json(HL_ROOM_SAVED_SEL_FILE)
    room_ids = data.room_ids or data.kodes or []
    sel = {
        "id": str(uuid.uuid4())[:8],
        "name": data.name.strip(),
        "room_ids": room_ids,
    }
    sels.append(sel)
    write_json(HL_ROOM_SAVED_SEL_FILE, sels)
    return sel


@router.delete("/saved-rooms/{sel_id}")
async def delete_room_saved_selection(sel_id: str):
    sels = read_json(HL_ROOM_SAVED_SEL_FILE)
    new = [s for s in sels if s["id"] != sel_id]
    if len(new) == len(sels):
        raise HTTPException(status_code=404, detail="Not found")
    write_json(HL_ROOM_SAVED_SEL_FILE, new)
    return {"status": "deleted"}


# ─── Bulk Control Endpoints ───────────────────────────────────────────────────

@router.post("/control")
async def control_hl(request: BulkControlRequest):
    return await _relay_control(request, "ON")


@router.post("/deactivate")
async def deactivate_hl(request: BulkControlRequest):
    return await _relay_control(request, "OFF")

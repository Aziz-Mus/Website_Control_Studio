"""Router: Headlights (Room → Relay) endpoints"""
import asyncio
from fastapi import APIRouter, HTTPException
from services.models import RoomCreate, RoomUpdate, RelayCreate, RelayUpdate, BulkControlRequest
from services.storage import read_json, write_json, next_room_id, next_relay_id, HL_ROOMS_FILE
from services.relay_service import control_relay_channel

router = APIRouter(prefix="/studio/headlights", tags=["Studio Headlights"])


def _hl_rooms():
    return read_json(HL_ROOMS_FILE, "rooms")


def _hl_write(rooms):
    write_json(HL_ROOMS_FILE, rooms, "rooms")


async def _relay_control(request: BulkControlRequest, state: str):
    results = []
    for room_req in request.rooms:
        rr = {"roomId": room_req.roomId, "espIpAddress": room_req.espIpAddress, "relays": []}
        for relay in room_req.relays:
            res = await control_relay_channel(room_req.espIpAddress, relay.channelCode, state)
            rr["relays"].append({"relayId": relay.relayId, "channelCode": relay.channelCode, "status": res["status"], "error": res.get("error")})
        results.append(rr)
    total = sum(len(r["relays"]) for r in results)
    success = sum(1 for r in results for rl in r["relays"] if rl["status"] == "success")
    return {"status": "success" if success == total else "partial_success" if success > 0 else "failed", "summary": {"total": total, "success": success, "failed": total - success}, "rooms": results}


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


@router.get("/rooms/{room_id}")
async def get_hl_room(room_id: str):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "success", "room": room}


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


@router.post("/control")
async def control_hl(request: BulkControlRequest):
    return await _relay_control(request, "ON")


@router.post("/deactivate")
async def deactivate_hl(request: BulkControlRequest):
    return await _relay_control(request, "OFF")




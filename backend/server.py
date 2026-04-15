import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware

from services.models import (
    ControlRequest, DeviceCreate, DeviceUpdate, parse_warna,
    RoomCreate, RoomUpdate, RelayCreate, RelayUpdate, BulkControlRequest
)
from services.storage import (
    read_json, write_json, next_kode, next_room_id, next_relay_id,
    SHOWCASE_NEON_FILE, STUDIO_NEON_FILE, HL_ROOMS_FILE, AC_ROOMS_FILE
)
from services.bulb_service import control_wiz_light, turn_off_wiz_light
from services.relay_service import control_relay_channel

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Indonesia Indicator - Studio Controller")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== NEON HELPERS =====================
async def _neon_control(file: str, request: ControlRequest):
    color = parse_warna(request.Warna)
    devices = read_json(file)
    if request.KodeLampu is not None:
        target = next((d for d in devices if d["kode"] == request.KodeLampu), None)
        if not target:
            raise HTTPException(status_code=404, detail=f"Lampu kode {request.KodeLampu} tidak ditemukan")
        result = await control_wiz_light(target["ip"], color, request.Kecerahan)
        return {"status": result["status"], "data_sent": {"rgb": [color.Red, color.Green, color.Blue], "brightness": request.Kecerahan}, "device": {**target, **result}}
    if not devices:
        return {"status": "no_devices"}
    tasks = [control_wiz_light(d["ip"], color, request.Kecerahan) for d in devices]
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

# ===================== ROOM/RELAY HELPERS =====================
async def _relay_control(rooms_data, request: BulkControlRequest, state: str):
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

# ===================== SHOWCASE NEON =====================
@api_router.get("/showcase/devices")
async def get_showcase_devices():
    d = read_json(SHOWCASE_NEON_FILE)
    return {"count": len(d), "devices": d}

@api_router.post("/showcase/devices")
async def add_showcase_device(device: DeviceCreate):
    devices = read_json(SHOWCASE_NEON_FILE)
    kode = next_kode(devices)
    new = {"ip": device.ip, "nama": device.nama, "kode": kode}
    devices.append(new)
    write_json(SHOWCASE_NEON_FILE, devices)
    return {"status": "success", "device": new}

@api_router.put("/showcase/devices/{kode}")
async def update_showcase_device(kode: int, update: DeviceUpdate):
    devices = read_json(SHOWCASE_NEON_FILE)
    dev = next((d for d in devices if d["kode"] == kode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device tidak ditemukan")
    if update.ip is not None: dev["ip"] = update.ip
    if update.nama is not None: dev["nama"] = update.nama
    write_json(SHOWCASE_NEON_FILE, devices)
    return {"status": "success", "device": dev}

@api_router.delete("/showcase/devices/{kode}")
async def delete_showcase_device(kode: int):
    devices = read_json(SHOWCASE_NEON_FILE)
    new = [d for d in devices if d.get("kode") != kode]
    if len(new) == len(devices): raise HTTPException(status_code=404, detail="Not found")
    write_json(SHOWCASE_NEON_FILE, new)
    return {"status": "success"}

@api_router.post("/showcase/lampu")
async def control_showcase(request: ControlRequest):
    return await _neon_control(SHOWCASE_NEON_FILE, request)

@api_router.post("/showcase/turn-off")
async def turn_off_showcase():
    return await _neon_turn_off(SHOWCASE_NEON_FILE)

# ===================== STUDIO NEON =====================
@api_router.get("/studio/neon/devices")
async def get_studio_neon_devices():
    d = read_json(STUDIO_NEON_FILE)
    return {"count": len(d), "devices": d}

@api_router.post("/studio/neon/devices")
async def add_studio_neon_device(device: DeviceCreate):
    devices = read_json(STUDIO_NEON_FILE)
    kode = next_kode(devices)
    new = {"ip": device.ip, "nama": device.nama, "kode": kode}
    devices.append(new)
    write_json(STUDIO_NEON_FILE, devices)
    return {"status": "success", "device": new}

@api_router.put("/studio/neon/devices/{kode}")
async def update_studio_neon_device(kode: int, update: DeviceUpdate):
    devices = read_json(STUDIO_NEON_FILE)
    dev = next((d for d in devices if d["kode"] == kode), None)
    if not dev: raise HTTPException(status_code=404, detail="Not found")
    if update.ip is not None: dev["ip"] = update.ip
    if update.nama is not None: dev["nama"] = update.nama
    write_json(STUDIO_NEON_FILE, devices)
    return {"status": "success", "device": dev}

@api_router.delete("/studio/neon/devices/{kode}")
async def delete_studio_neon_device(kode: int):
    devices = read_json(STUDIO_NEON_FILE)
    new = [d for d in devices if d.get("kode") != kode]
    if len(new) == len(devices): raise HTTPException(status_code=404, detail="Not found")
    write_json(STUDIO_NEON_FILE, new)
    return {"status": "success"}

@api_router.post("/studio/neon/lampu")
async def control_studio_neon(request: ControlRequest):
    return await _neon_control(STUDIO_NEON_FILE, request)

@api_router.post("/studio/neon/turn-off")
async def turn_off_studio_neon():
    return await _neon_turn_off(STUDIO_NEON_FILE)

# ===================== HEADLIGHTS (Room → Relay) =====================
def _hl_rooms(): return read_json(HL_ROOMS_FILE, "rooms")
def _hl_write(rooms): write_json(HL_ROOMS_FILE, rooms, "rooms")

@api_router.get("/studio/headlights/rooms")
async def get_hl_rooms():
    rooms = _hl_rooms()
    return {"count": len(rooms), "rooms": rooms}

@api_router.post("/studio/headlights/rooms")
async def add_hl_room(room: RoomCreate):
    rooms = _hl_rooms()
    rid = next_room_id(rooms)
    new_room = {"roomId": rid, "roomName": room.roomName, "espIpAddress": room.espIpAddress, "relays": [], "onAirExitConnected": False}
    if room.connectOnAirExit:
        has_connected = any(r.get("onAirExitConnected") for r in rooms)
        if not has_connected:
            new_room["onAirExitConnected"] = True
            # Auto-add On Air/Exit as a special relay
            new_room["relays"].append({"relayId": "rl_onair_exit", "deviceName": "On Air / Exit Switch", "channelCode": "switch", "isOnAirExit": True})
    rooms.append(new_room)
    _hl_write(rooms)
    return {"status": "success", "room": new_room}

@api_router.put("/studio/headlights/rooms/{room_id}")
async def update_hl_room(room_id: str, update: RoomUpdate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    if update.roomName is not None: room["roomName"] = update.roomName
    if update.espIpAddress is not None: room["espIpAddress"] = update.espIpAddress
    _hl_write(rooms)
    return {"status": "success", "room": room}

@api_router.delete("/studio/headlights/rooms/{room_id}")
async def delete_hl_room(room_id: str):
    rooms = _hl_rooms()
    new = [r for r in rooms if r["roomId"] != room_id]
    if len(new) == len(rooms): raise HTTPException(status_code=404, detail="Not found")
    _hl_write(new)
    return {"status": "success"}

@api_router.get("/studio/headlights/rooms/{room_id}")
async def get_hl_room(room_id: str):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    return {"status": "success", "room": room}

@api_router.post("/studio/headlights/rooms/{room_id}/relays")
async def add_hl_relay(room_id: str, relay: RelayCreate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    rlid = next_relay_id(room.get("relays", []))
    new_relay = {"relayId": rlid, "deviceName": relay.deviceName, "channelCode": relay.channelCode}
    room.setdefault("relays", []).append(new_relay)
    _hl_write(rooms)
    return {"status": "success", "relay": new_relay}

@api_router.put("/studio/headlights/rooms/{room_id}/relays/{relay_id}")
async def update_hl_relay(room_id: str, relay_id: str, update: RelayUpdate):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    relay = next((rl for rl in room.get("relays", []) if rl["relayId"] == relay_id), None)
    if not relay: raise HTTPException(status_code=404, detail="Not found")
    if update.deviceName is not None: relay["deviceName"] = update.deviceName
    if update.channelCode is not None: relay["channelCode"] = update.channelCode
    _hl_write(rooms)
    return {"status": "success", "relay": relay}

@api_router.delete("/studio/headlights/rooms/{room_id}/relays/{relay_id}")
async def delete_hl_relay(room_id: str, relay_id: str):
    rooms = _hl_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    old = len(room.get("relays", []))
    room["relays"] = [rl for rl in room.get("relays", []) if rl["relayId"] != relay_id]
    if len(room["relays"]) == old: raise HTTPException(status_code=404, detail="Not found")
    _hl_write(rooms)
    return {"status": "success"}

@api_router.post("/studio/headlights/control")
async def control_hl(request: BulkControlRequest):
    return await _relay_control(_hl_rooms(), request, "ON")

@api_router.post("/studio/headlights/deactivate")
async def deactivate_hl(request: BulkControlRequest):
    return await _relay_control(_hl_rooms(), request, "OFF")

# On Air/Exit status endpoint
@api_router.get("/studio/headlights/onair-exit-status")
async def get_onair_exit_status():
    rooms = _hl_rooms()
    for room in rooms:
        if room.get("onAirExitConnected"):
            return {"connected": True, "roomId": room["roomId"], "roomName": room["roomName"], "espIpAddress": room["espIpAddress"]}
    return {"connected": False}

@api_router.post("/studio/headlights/onair-exit-control")
async def control_onair_exit(state: str = "ON"):
    """Control the On Air/Exit switch independently."""
    rooms = _hl_rooms()
    for room in rooms:
        if room.get("onAirExitConnected"):
            relay = next((rl for rl in room.get("relays", []) if rl.get("isOnAirExit")), None)
            if relay:
                result = await control_relay_channel(room["espIpAddress"], relay["channelCode"], state)
                return {"status": result["status"], "error": result.get("error"), "roomId": room["roomId"]}
    return {"status": "failed", "error": "No room connected to On Air/Exit switch"}

# ===================== AC (Room → Relay) =====================
def _ac_rooms(): return read_json(AC_ROOMS_FILE, "rooms")
def _ac_write(rooms): write_json(AC_ROOMS_FILE, rooms, "rooms")

@api_router.get("/studio/ac/rooms")
async def get_ac_rooms():
    rooms = _ac_rooms()
    return {"count": len(rooms), "rooms": rooms}

@api_router.post("/studio/ac/rooms")
async def add_ac_room(room: RoomCreate):
    rooms = _ac_rooms()
    rid = next_room_id(rooms)
    new = {"roomId": rid, "roomName": room.roomName, "espIpAddress": room.espIpAddress, "relays": []}
    rooms.append(new)
    _ac_write(rooms)
    return {"status": "success", "room": new}

@api_router.put("/studio/ac/rooms/{room_id}")
async def update_ac_room(room_id: str, update: RoomUpdate):
    rooms = _ac_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    if update.roomName is not None: room["roomName"] = update.roomName
    if update.espIpAddress is not None: room["espIpAddress"] = update.espIpAddress
    _ac_write(rooms)
    return {"status": "success", "room": room}

@api_router.delete("/studio/ac/rooms/{room_id}")
async def delete_ac_room(room_id: str):
    rooms = _ac_rooms()
    new = [r for r in rooms if r["roomId"] != room_id]
    if len(new) == len(rooms): raise HTTPException(status_code=404, detail="Not found")
    _ac_write(new)
    return {"status": "success"}

@api_router.get("/studio/ac/rooms/{room_id}")
async def get_ac_room(room_id: str):
    rooms = _ac_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    return {"status": "success", "room": room}

@api_router.post("/studio/ac/rooms/{room_id}/relays")
async def add_ac_relay(room_id: str, relay: RelayCreate):
    rooms = _ac_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    rlid = next_relay_id(room.get("relays", []))
    new = {"relayId": rlid, "deviceName": relay.deviceName, "channelCode": relay.channelCode}
    room.setdefault("relays", []).append(new)
    _ac_write(rooms)
    return {"status": "success", "relay": new}

@api_router.put("/studio/ac/rooms/{room_id}/relays/{relay_id}")
async def update_ac_relay(room_id: str, relay_id: str, update: RelayUpdate):
    rooms = _ac_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    relay = next((rl for rl in room.get("relays", []) if rl["relayId"] == relay_id), None)
    if not relay: raise HTTPException(status_code=404, detail="Not found")
    if update.deviceName is not None: relay["deviceName"] = update.deviceName
    if update.channelCode is not None: relay["channelCode"] = update.channelCode
    _ac_write(rooms)
    return {"status": "success", "relay": relay}

@api_router.delete("/studio/ac/rooms/{room_id}/relays/{relay_id}")
async def delete_ac_relay(room_id: str, relay_id: str):
    rooms = _ac_rooms()
    room = next((r for r in rooms if r["roomId"] == room_id), None)
    if not room: raise HTTPException(status_code=404, detail="Not found")
    old = len(room.get("relays", []))
    room["relays"] = [rl for rl in room.get("relays", []) if rl["relayId"] != relay_id]
    if len(room["relays"]) == old: raise HTTPException(status_code=404, detail="Not found")
    _ac_write(rooms)
    return {"status": "success"}

@api_router.post("/studio/ac/control")
async def control_ac(request: BulkControlRequest):
    return await _relay_control(_ac_rooms(), request, "ON")

@api_router.post("/studio/ac/deactivate")
async def deactivate_ac(request: BulkControlRequest):
    return await _relay_control(_ac_rooms(), request, "OFF")

# ===================== ROOT =====================
@api_router.get("/")
async def root():
    return {"message": "Indonesia Indicator - Studio Controller API"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

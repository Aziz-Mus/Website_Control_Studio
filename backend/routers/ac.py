"""Router: AC Device endpoints"""
import asyncio
from fastapi import APIRouter, HTTPException
from services.models import ACDeviceCreate, ACDeviceUpdate, ACSingleControl, ACAllControl, ACTempSingle, ACTempAll
from services.storage import read_json, write_json, next_ac_code, AC_DEVICES_FILE
from services.ac_service import ACService

router = APIRouter(prefix="/studio/ac", tags=["Studio AC"])


def _ac_devices():
    return read_json(AC_DEVICES_FILE, "devices")


def _ac_write(devices):
    write_json(AC_DEVICES_FILE, devices, "devices")


@router.get("/devices")
async def get_ac_devices():
    devices = _ac_devices()
    return {"count": len(devices), "devices": devices}


@router.post("/devices")
async def add_ac_device(device: ACDeviceCreate):
    devices = _ac_devices()
    code = next_ac_code(devices)
    new = {"acCode": code, "deviceName": device.deviceName, "ip": device.ip, "lastTemperature": 24}
    devices.append(new)
    _ac_write(devices)
    return {"status": "success", "device": new}


@router.put("/devices/{ac_code}")
async def update_ac_device(ac_code: int, update: ACDeviceUpdate):
    devices = _ac_devices()
    dev = next((d for d in devices if d["acCode"] == ac_code), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    if update.deviceName is not None:
        dev["deviceName"] = update.deviceName
    if update.ip is not None:
        dev["ip"] = update.ip
    _ac_write(devices)
    return {"status": "success", "device": dev}


@router.delete("/devices/{ac_code}")
async def delete_ac_device(ac_code: int):
    devices = _ac_devices()
    new = [d for d in devices if d["acCode"] != ac_code]
    if len(new) == len(devices):
        raise HTTPException(status_code=404, detail="Device not found")
    _ac_write(new)
    return {"status": "success"}


@router.post("/control")
async def control_ac_single(request: ACSingleControl):
    devices = _ac_devices()
    dev = next((d for d in devices if d["acCode"] == request.acCode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    svc = ACService(dev["ip"])
    result = await svc.control_ac(request.power, dev.get("lastTemperature", 24))
    return {"status": result.get("status", "failed"), "acCode": request.acCode, "power": request.power, "error": result.get("error")}


@router.post("/control/all")
async def control_ac_all(request: ACAllControl):
    devices = _ac_devices()
    if not devices:
        return {"status": "no_devices", "results": []}
    tasks = [ACService(d["ip"]).control_ac(request.power, d.get("lastTemperature", 24)) for d in devices]
    results = await asyncio.gather(*tasks)
    device_results = []
    success_count = 0
    for dev, res in zip(devices, results):
        s = res.get("status", "failed")
        if s == "success":
            success_count += 1
        device_results.append({"acCode": dev["acCode"], "deviceName": dev["deviceName"], "status": s, "error": res.get("error")})
    total = len(devices)
    overall = "success" if success_count == total else "partial_success" if success_count > 0 else "failed"
    return {"status": overall, "summary": {"total": total, "success": success_count, "failed": total - success_count}, "results": device_results}


@router.post("/temperature")
async def set_ac_temp_single(request: ACTempSingle):
    devices = _ac_devices()
    dev = next((d for d in devices if d["acCode"] == request.acCode), None)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    svc = ACService(dev["ip"])
    result = await svc.control_ac("ON", request.temperature)
    if result.get("status") == "success":
        dev["lastTemperature"] = request.temperature
        _ac_write(devices)
        return {"status": "success", "acCode": request.acCode, "temperature": request.temperature}
    return {"status": "failed", "acCode": request.acCode, "error": result.get("error"), "temperature": dev.get("lastTemperature", 24)}


@router.post("/temperature/all")
async def set_ac_temp_all(request: ACTempAll):
    devices = _ac_devices()
    if not devices:
        return {"status": "no_devices", "results": []}
    tasks = [ACService(d["ip"]).control_ac("ON", request.temperature) for d in devices]
    results = await asyncio.gather(*tasks)
    device_results = []
    success_count = 0
    for dev, res in zip(devices, results):
        if res.get("status") == "success":
            dev["lastTemperature"] = request.temperature
            success_count += 1
            device_results.append({"acCode": dev["acCode"], "deviceName": dev["deviceName"], "status": "success", "temperature": request.temperature})
        else:
            device_results.append({"acCode": dev["acCode"], "deviceName": dev["deviceName"], "status": "failed", "error": res.get("error"), "temperature": dev.get("lastTemperature", 24)})
    _ac_write(devices)
    total = len(devices)
    overall = "success" if success_count == total else "partial_success" if success_count > 0 else "failed"
    return {"status": overall, "summary": {"total": total, "success": success_count, "failed": total - success_count}, "temperature": request.temperature, "results": device_results}

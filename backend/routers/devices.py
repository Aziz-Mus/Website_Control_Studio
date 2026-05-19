"""
Router: /api/devices
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from db.connection import get_db_ro, get_db_rw
from db import crud

router = APIRouter(prefix="/api/devices", tags=["Devices"])

# ── Pydantic Models ───────────────────────────────────────────────────────────
class DeviceCreate(BaseModel):
    id: Optional[str] = None        # Auto-generated jika kosong
    room_id: str
    name: str
    type: str = "wiz"               # Default ke "wiz" (WiZ smart lamp)
    conn_info: dict = {}

class DeviceStatusUpdate(BaseModel):
    status: str
    last_state: Optional[dict] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    conn_info: Optional[dict] = None   # partial update — di-merge dengan data lama


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("")
def get_devices(room_id: str, db: Session = Depends(get_db_ro)):
    """
    Ambil semua device untuk satu ruangan.
    """
    devices = crud.get_devices_by_room(db, room_id)
    return [
        {
            "id":        d.id,
            "room_id":   d.room_id,
            "name":      d.name,
            "type":      d.type,
            "status":    d.status,
            "last_state": d.last_state,
            "conn_info": d.conn_info,
            # kode integer asli — dipakai untuk matching grid layout cells
            "kode": d.conn_info.get("kode") if d.conn_info else None,
        }
        for d in devices
    ]

@router.post("", status_code=201)
def add_device(data: DeviceCreate, db: Session = Depends(get_db_rw)):
    """
    Tambah perangkat baru.
    - id       : opsional, auto-generate jika kosong
    - type     : opsional, default 'wiz'
    - conn_info: minimal { "ip": "..." } — kode integer di-generate otomatis
    """
    # 1. Generate ID jika kosong
    device_id = data.id or f"{data.room_id}_{str(uuid.uuid4())[:8]}"

    if crud.get_device_by_id(db, device_id):
        raise HTTPException(status_code=409, detail=f"Device ID '{device_id}' sudah ada")

    # 2. Auto-generate kode integer (max existing + 1) jika belum ada
    new_conn_info = dict(data.conn_info)
    if "kode" not in new_conn_info:
        all_devs = crud.get_devices_by_room(db, data.room_id)
        existing_kodes = [
            d.conn_info["kode"]
            for d in all_devs
            if d.conn_info and isinstance(d.conn_info.get("kode"), int)
        ]
        new_conn_info["kode"] = max(existing_kodes) + 1 if existing_kodes else 1

    device = crud.create_device(
        db,
        id=device_id,
        room_id=data.room_id,
        name=data.name,
        type=data.type,
        conn_info=new_conn_info,
    )

    # Return full device object agar frontend langsung punya kode untuk grid
    return {
        "status": "created",
        "device": {
            "id":       device.id,
            "name":     device.name,
            "kode":     device.conn_info.get("kode"),
            "conn_info": device.conn_info,
        }
    }

@router.put("/{device_id}")
def update_device(device_id: str, data: DeviceUpdate, db: Session = Depends(get_db_rw)):
    """
    Update nama, tipe, atau conn_info (IP, channel, dsb) perangkat.
    Contoh: PUT /api/devices/cc_001
    Body: { "name": "Lampu Baru", "conn_info": { "ip": "10.1.50.99" } }
    """
    device = crud.update_device(
        db, device_id,
        name=data.name,
        type=data.type,
        conn_info=data.conn_info,
    )
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' tidak ditemukan")
    return {
        "status": "updated",
        "device": {
            "id":        device.id,
            "name":      device.name,
            "type":      device.type,
            "kode":      device.conn_info.get("kode") if device.conn_info else None,
            "conn_info": device.conn_info,
        }
    }

@router.patch("/{device_id}/status")
def update_status(device_id: str, data: DeviceStatusUpdate, db: Session = Depends(get_db_rw)):
    """
    Update status + last_state sebuah perangkat.
    Contoh: PATCH /api/devices/cc_001/status
    Body: { "status": "ON", "last_state": {"brightness": 80} }
    """
    device = crud.update_device_status(db, device_id, data.status, data.last_state)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' tidak ditemukan")
    return {"status": "updated", "device_id": device_id}

@router.delete("/{device_id}")
def remove_device(device_id: str, db: Session = Depends(get_db_rw)):
    """
    Hapus perangkat dari database.
    """
    device = crud.delete_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' tidak ditemukan")
    return {"status": "deleted", "device": device_id}

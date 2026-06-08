"""
Router ke API /api/room
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.connection import get_db_ro, get_db_rw
from db import crud

router = APIRouter(prefix="/api/room", tags=["Rooms"])

@router.get("")
def get_rooms(db: Session = Depends(get_db_ro)):
    """
    Get menu
    """
    rooms = crud.get_all_rooms(db)
    return [{"id": r.id, "name": r.name, "ui_type": r.ui_type} for r in rooms]

@router.get("/detail")
def get_room_detail(room_id: str, db: Session = Depends(get_db_ro)):
    """
    Ambil detail konfigurasi satu menu
    Contoh : GET /api/room/detail?room_id=cc_room
    """
    room = crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    return {
        "id": room.id,
        "name": room.name,
        "ui_type": room.ui_type,
        "ui_config": room.ui_config
    }

from pydantic import BaseModel
from typing import Any, Optional

class RoomConfigUpdate(BaseModel):
    cols: Optional[int] = None
    rows: Optional[int] = None
    cells: Optional[Any] = None

@router.put("/config")
def update_room_config(room_id: str, body: RoomConfigUpdate, db: Session = Depends(get_db_rw)):
    """
    Update konfigurasi grid/layout menu
    Contoh : PUT /api/room/config?room_id=cc_room
    Body: {"cols":10, "rows":5, "cells":{"0": "cc_001"}}
    """
    ui_config = body.model_dump(exclude_none=True)
    updated = crud.update_room_config(db, room_id, ui_config)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    return {"status": "success", "room_id": room_id}
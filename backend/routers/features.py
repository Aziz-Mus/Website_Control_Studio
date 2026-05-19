"""
Router: /api/presets & /api/animations & /api/selections & /api/schedules
Untuk kelola fitur saved color, animation color, saved selection, dan scheduler
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from db.connection import get_db_ro, get_db_rw
from db import crud
from services.scheduler_service import engine, generate_schedule_id

router = APIRouter(tags=['Features (Presets-Animation-Selections-Schedule)'])

# PRESETS
class PresetCreate(BaseModel):
    room_id: str
    name: str
    settings: dict

@router.get("/api/presets")
def get_presets(room_id: str, db: Session = Depends(get_db_ro)):
    presets = crud.get_presets_by_room(db, room_id)
    return [{"id": p.id, "name": p.name, "settings": p.settings} for p in presets]

@router.post("/api/presets", status_code=201)
def add_presets(data: PresetCreate, db: Session = Depends(get_db_rw)):
    presets = crud.create_preset(db, data.room_id, data.name, data.settings)
    return {"status": "created", "preset_id": presets.id}

@router.delete("/api/presets/{preset_id}")
def remove_preset(preset_id: int, db: Session = Depends(get_db_rw)):
    crud.delete_preset(db, preset_id)
    return {"status": "deleted"}


# ANIMATIONS
class AnimationCreate(BaseModel):
    name: str
    steps: List[dict]

@router.get("/api/animations")
def get_animations(db: Session = Depends(get_db_ro)):
    anims = crud.get_all_animations(db)
    return [{"id": a.id, "name": a.name, "steps": a.steps} for a in anims]

@router.post("/api/animations", status_code=201)
def add_animation(data: AnimationCreate, db: Session = Depends(get_db_rw)):
    anim = crud.create_animation(db, data.name, data.steps)
    return {"status": "created", "animation_id":anim.id}

@router.delete("/api/animations/{anim_id}")
def remove_animation(anim_id: int, db: Session = Depends(get_db_rw)):
    crud.delete_animation(db, anim_id)
    return {"status": "deleted"}


# SAVED SELECTION
class SelectionCreate(BaseModel):
    room_id: str
    name: str
    device_ids: list   # bisa integer kode atau string ID

@router.get("/api/selections")
def get_selections(room_id: str, db: Session = Depends(get_db_ro)):
    sels = crud.get_saved_selections(db, room_id)
    return [{"id": s.id, "name": s.name, "device_ids": s.device_ids} for s in sels]

@router.post("/api/selections", status_code=201)
def add_selection(data: SelectionCreate, db: Session = Depends(get_db_rw)):
    sel = crud.create_saved_selection(db, data.room_id, data.name, data.device_ids)
    return {"status": "created", "selection_id": sel.id}

@router.delete("/api/selections/{sel_id}")
def remove_selection(sel_id: int, db: Session = Depends(get_db_rw)):
    crud.delete_saved_selection(db, sel_id)
    return {"status": "deleted"}


# SCHEDULES
class ScheduleCreate(BaseModel):
    room_id: str
    name: str
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")    # "HH:MM"
    days: List[str] = []                                  # ["monday","wednesday",...]
    action: str = Field(..., pattern=r"^(on|off)$")
    brightness: Optional[int] = Field(None, ge=0, le=100)
    rgb: Optional[List[int]] = None
    target_type: str = "all"                              # "all" | "selection" | "device"
    target_id: Optional[str] = None

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    time: Optional[str] = None
    days: Optional[List[str]] = None
    action: Optional[str] = None
    brightness: Optional[int] = None
    rgb: Optional[List[int]] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None


@router.get("/api/schedules")
def get_schedules(room_id: str, db: Session = Depends(get_db_ro)):
    schedules = crud.get_schedules_by_room(db, room_id)
    return [
        {
            "id": s.id, "room_id": s.room_id, "name": s.name,
            "time": s.time, "days": s.days, "action": s.action,
            "brightness": s.brightness, "rgb": s.rgb,
            "target_type": s.target_type, "target_id": s.target_id,
            "is_active": bool(s.is_active), "is_snoozed": bool(s.is_snoozed),
            "last_run_status": s.last_run_status,
            "last_run_time": str(s.last_run_time) if s.last_run_time else None,
        }
        for s in schedules
    ]


@router.post("/api/schedules", status_code=201)
def add_schedule(data: ScheduleCreate, db: Session = Depends(get_db_rw)):
    sch_id = generate_schedule_id()
    sch = crud.create_schedule(
        db, id=sch_id, room_id=data.room_id, name=data.name,
        time=data.time, days=data.days, action=data.action,
        brightness=data.brightness, rgb=data.rgb,
        target_type=data.target_type, target_id=data.target_id,
    )
    # Register ke APScheduler runtime
    engine.add_or_update_job(sch)
    return {"status": "created", "schedule_id": sch.id}


@router.put("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: str, data: ScheduleUpdate, db: Session = Depends(get_db_rw)):
    kwargs = {k: v for k, v in data.dict().items() if v is not None}
    if not kwargs:
        raise HTTPException(status_code=400, detail="No fields to update")
    sch = crud.update_schedule(db, schedule_id, **kwargs)
    if not sch:
        raise HTTPException(status_code=404, detail="Schedule not found")
    engine.add_or_update_job(sch)
    return {"status": "updated", "schedule_id": sch.id}


@router.patch("/api/schedules/{schedule_id}/toggle")
def toggle_schedule(schedule_id: str, db: Session = Depends(get_db_rw)):
    sch = crud.toggle_schedule(db, schedule_id)
    if not sch:
        raise HTTPException(status_code=404, detail="Schedule not found")
    engine.add_or_update_job(sch)
    return {"status": "updated", "is_active": bool(sch.is_active)}


@router.delete("/api/schedules/{schedule_id}")
def remove_schedule(schedule_id: str, db: Session = Depends(get_db_rw)):
    engine.remove_job(schedule_id)
    sch = crud.delete_schedule(db, schedule_id)
    if not sch:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deleted"}


@router.get("/api/schedules/{schedule_id}/logs")
def get_schedule_logs(schedule_id: str, db: Session = Depends(get_db_ro)):
    logs = crud.get_schedule_logs(db, schedule_id, limit=10)
    return [
        {
            "id": log.id,
            "executed_at": str(log.executed_at) if log.executed_at else None,
            "status": log.status,
            "details": log.details,
        }
        for log in logs
    ]
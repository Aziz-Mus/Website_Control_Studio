"""
FUnsgi CRUD
"""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
import pytz
from db.models import Room, Device, Preset, Animation, SavedSelection, Schedule, ScheduleLog

WIB = pytz.timezone("Asia/Jakarta")


# ROOMS
def get_all_rooms(db: Session):
    """Ambil semua ruangan (untuk Sidebar menu)"""
    return db.query(Room).all()

def get_room_by_id(db: Session, room_id: str):
    """Ambil item menu di room"""
    return db.query(Room).filter(Room.id == room_id).first()

def create_room(db: Session, id: str, name: str, ui_type: str, ui_config: dict):
    """Buat ruang baru"""
    room = Room(id=id, name=name, ui_type=ui_type, ui_config=ui_config)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room

def update_room_config(db: Session, room_id: str, ui_config: dict):
    """Update konfigurasi grid/layout sebuah ruangan"""
    room = get_room_by_id(db, room_id)
    if room:
        room.ui_config = ui_config
        db.commit()
        db.refresh(room)
    return room


# DEVICES
def get_devices_by_room(db: Session, room_id: str):
    """Ambil semua perangkat dari satu menu"""
    return db.query(Device).filter(Device.room_id == room_id).order_by(Device.id).all()

def get_device_by_id(db: Session, device_id: str):
    """Ambil satu perangkat berdasarkan ID"""
    return db.query(Device).filter(Device.id == device_id).first()

def create_device(db: Session, id: str, room_id: str, name: str, type: str, conn_info: dict):
    """Tambah perangkat baru"""
    device = Device(id=id, room_id=room_id, name=name, type=type, conn_info=conn_info)
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

def update_device_status(db: Session, device_id: str, status: str, last_state: dict = None):
    """Update status dan kondisi terakhir sebuah perangkat"""
    device = get_device_by_id(db, device_id)
    if device:
        device.status = status
        if last_state is not None:
            device.last_state = last_state
        db.commit()
        db.refresh(device)
    return device

def update_device(db: Session, device_id: str, name: str = None, conn_info: dict = None, type: str = None):
    """Update nama, conn_info (ip, channel, dsb), atau tipe perangkat"""
    device = get_device_by_id(db, device_id)
    if device:
        if name is not None:
            device.name = name
        if type is not None:
            device.type = type
        if conn_info is not None:
            # Merge conn_info agar kode grid tidak hilang
            merged = dict(device.conn_info or {})
            merged.update(conn_info)
            device.conn_info = merged
        db.commit()
        db.refresh(device)
    return device

def delete_device(db: Session, deviced_id: str):
    """Hapus perangkat dari database"""
    device = get_device_by_id(db, deviced_id)
    if device:
        db.delete(device)
        db.commit()
    return device


# PRESETS
def get_presets_by_room(db: Session, room_id: str):
    return db.query(Preset).filter(Preset.room_id == room_id).all()

def create_preset(db: Session, room_id: str, name: str, settings: dict):
    preset = Preset(room_id=room_id, name=name, settings = settings)
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset

def delete_preset(db: Session, preset_id: int):
    preset = db.query(Preset).filter(Preset.id == preset_id).first()
    if preset:
        db.delete(preset)
        db.commit()
    return preset


# ANIMATIONS
def get_all_animations(db: Session):
    return db.query(Animation).all()

def create_animation(db: Session, name: str, steps: list):
    anim = Animation(name=name, steps=steps)
    db.add(anim)
    db.commit()
    db.refresh(anim)
    return anim

def delete_animation(db: Session, anim_id: int):
    anim = db.query(Animation).filter(Animation.id == anim_id).first()
    if anim:
        db.delete(anim)
        db.commit()
    return anim


# SAVED SELECTIONS
def get_saved_selections(db: Session, room_id: str):
    return db.query(SavedSelection).filter(SavedSelection.room_id == room_id).all()

def create_saved_selection(db: Session, room_id: str, name: str, device_ids: list):
    sel = SavedSelection(room_id=room_id, name=name, device_ids=device_ids)
    db.add(sel)
    db.commit()
    db.refresh(sel)
    return sel

def delete_saved_selection(db: Session, sel_id: int):
    sel = db.query(SavedSelection).filter(SavedSelection.id == sel_id).first()
    if sel:
        db.delete(sel)
        db.commit()
    return sel


# SCHEDULES
def get_schedules_by_room(db: Session, room_id: str):
    return db.query(Schedule).filter(Schedule.room_id == room_id).all()

def get_schedule_by_id(db: Session, schedule_id: str):
    return db.query(Schedule).filter(Schedule.id == schedule_id).first()

def get_all_active_schedules(db: Session):
    return db.query(Schedule).filter(Schedule.is_active == 1).all()

def create_schedule(db: Session, id: str, room_id: str, name: str, time: str,
                    days: list, action: str, brightness=None, rgb=None,
                    target_type="all", target_id=None):
    sch = Schedule(
        id=id, room_id=room_id, name=name, time=time,
        days=days, action=action, brightness=brightness, rgb=rgb,
        target_type=target_type, target_id=target_id,
    )
    db.add(sch)
    db.commit()
    db.refresh(sch)
    return sch

def update_schedule(db: Session, schedule_id: str, **kwargs):
    sch = get_schedule_by_id(db, schedule_id)
    if sch:
        for k, v in kwargs.items():
            if hasattr(sch, k) and v is not None:
                setattr(sch, k, v)
        db.commit()
        db.refresh(sch)
    return sch

def toggle_schedule(db: Session, schedule_id: str):
    sch = get_schedule_by_id(db, schedule_id)
    if sch:
        sch.is_active = 0 if sch.is_active else 1
        db.commit()
        db.refresh(sch)
    return sch


def update_schedule_run_status(db: Session, schedule_id: str, status: str):
    sch = get_schedule_by_id(db, schedule_id)
    if sch:
        sch.last_run_status = status
        sch.last_run_time = datetime.now(WIB).replace(tzinfo=None)
        db.commit()
        db.refresh(sch)
    return sch

def delete_schedule(db: Session, schedule_id: str):
    sch = get_schedule_by_id(db, schedule_id)
    if sch:
        # Hapus logs terkait dulu
        db.query(ScheduleLog).filter(ScheduleLog.schedule_id == schedule_id).delete()
        db.delete(sch)
        db.commit()
    return sch


# SCHEDULE LOGS
def get_schedule_logs(db: Session, schedule_id: str, limit: int = 10):
    return db.query(ScheduleLog).filter(
        ScheduleLog.schedule_id == schedule_id
    ).order_by(ScheduleLog.id.desc()).limit(limit).all()

def add_schedule_log(db: Session, schedule_id: str, status: str, details: str = None):
    log = ScheduleLog(schedule_id=schedule_id, status=status, details=details, executed_at=datetime.now(WIB).replace(tzinfo=None))
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def cleanup_schedule_logs(db: Session, schedule_id: str, keep: int = 10):
    """Rolling cleanup — hapus log ke-11 dst agar hanya menyimpan N baris terakhir."""
    logs = db.query(ScheduleLog).filter(
        ScheduleLog.schedule_id == schedule_id
    ).order_by(ScheduleLog.id.desc()).offset(keep).all()
    for log in logs:
        db.delete(log)
    db.commit()

def clear_schedule_logs(db: Session, schedule_id: str):
    """Hapus semua log untuk schedule tertentu."""
    db.query(ScheduleLog).filter(ScheduleLog.schedule_id == schedule_id).delete()
    db.commit()

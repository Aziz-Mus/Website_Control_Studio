"""
Definisi tabel Database (SQLAlchemy Models)
setiap class = 1 tabel
"""
from sqlalchemy import Column, String, Integer, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from db.connection import Base

class Room(Base):
    """
    Tabel : rooms
    Simpan konsfigurasi UI type setiap menu
    """
    __tablename__ = "rooms"
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    ui_type = Column(String(50), nullable=False)
    ui_config = Column(JSONB, default={})

class Device(Base):
    """
    Tabel : devices
    Simpan setiap devices dan status
    """
    __tablename__ = "devices"

    id = Column(String(50), primary_key=True)
    room_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)
    status = Column(String(20), default="IDLE")
    last_state = Column(JSONB, default={})
    conn_info = Column(JSONB, default={})
    last_updated = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class Preset(Base):
    """
    Tabel : presets
    Menyimpan skenario kendali semua
    """
    __tablename__ = "presets"
    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    settings = Column(JSONB, nullable=False)

class Animation(Base):
    """
    Tabel : animations
    Khusus untuk cc menyimpan animasi custom
    """
    __tablename__ = "animations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    steps = Column(JSONB, nullable=False)

class SavedSelection(Base):
    """
    Tabel : saved_selections
    Menyimpan grup select devices
    """
    __tablename__ =  "saved_selections"
    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    device_ids = Column(JSONB, nullable=False)

class Schedule(Base):
    """
    Tabel : schedules
    Menyimpan aturan otomasi penjadwalan perangkat
    """
    __tablename__ = "schedules"
    id = Column(String(50), primary_key=True)
    room_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    time = Column(String(5), nullable=False)          # Format 24 jam "HH:MM"
    days = Column(JSONB, default=[])                   # ["monday","wednesday",...]
    action = Column(String(10), nullable=False)        # "on" | "off"
    brightness = Column(Integer, nullable=True)        # 0-100 opsional
    rgb = Column(JSONB, nullable=True)                 # [R,G,B] opsional
    target_type = Column(String(15), default="all")    # "all" | "selection" | "device"
    target_id = Column(String(100), nullable=True)     # ID selection atau device
    is_active = Column(Integer, default=1)             # SQLite compat (1=true, 0=false)
    is_snoozed = Column(Integer, default=0)
    last_run_status = Column(String(15), nullable=True)  # EXECUTE, ON, OFF, FAILED, NULL
    last_run_time = Column(TIMESTAMP, nullable=True)

class ScheduleLog(Base):
    """
    Tabel : schedule_logs
    Riwayat 10 eksekusi terakhir per jadwal
    """
    __tablename__ = "schedule_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(String(50), nullable=False)
    executed_at = Column(TIMESTAMP, server_default=func.now())
    status = Column(String(15), nullable=False)        # ON, OFF, FAILED, SKIPPED
    details = Column(Text, nullable=True)

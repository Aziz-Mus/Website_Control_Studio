import json
import logging
from typing import Union
from pydantic import BaseModel, Field
from typing import Optional, List

logger = logging.getLogger(__name__)

# --- Neon/WiZ Models ---
class ColorModel(BaseModel):
    Red: int = Field(..., ge=0, le=255)
    Green: int = Field(..., ge=0, le=255)
    Blue: int = Field(..., ge=0, le=255)

class ControlRequest(BaseModel):
    Warna: Union[str, dict, ColorModel]
    Kecerahan: int = Field(..., ge=0, le=255)
    KodeLampu: Optional[int] = None

class DeviceCreate(BaseModel):
    ip: str
    nama: str

class DeviceUpdate(BaseModel):
    ip: Optional[str] = None
    nama: Optional[str] = None

# --- Room/Relay Models (AC & Headlights) ---
class RoomCreate(BaseModel):
    roomName: str
    espIpAddress: str
    connectOnAirExit: Optional[bool] = False

class RoomUpdate(BaseModel):
    roomName: Optional[str] = None
    espIpAddress: Optional[str] = None

class RelayCreate(BaseModel):
    deviceName: str
    channelCode: str

class RelayUpdate(BaseModel):
    deviceName: Optional[str] = None
    channelCode: Optional[str] = None

class RelayControl(BaseModel):
    relayId: str
    channelCode: str

class RoomControl(BaseModel):
    roomId: str
    espIpAddress: str
    relays: List[RelayControl]

class BulkControlRequest(BaseModel):
    rooms: List[RoomControl]

# --- Helpers ---
def parse_warna(warna) -> ColorModel:
    if isinstance(warna, ColorModel):
        return warna
    if isinstance(warna, dict):
        return ColorModel(**warna)
    if isinstance(warna, str):
        data = json.loads(warna)
        return ColorModel(**data)
    raise ValueError("Format Warna tidak valid")

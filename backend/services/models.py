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

# --- Room/Relay Models (Headlights only — AC uses flat ACDevice* models below) ---
class RoomCreate(BaseModel):
    roomName: str
    espIpAddress: str
    connectOnAirExit: Optional[bool] = False

class RoomUpdate(BaseModel):
    roomName: Optional[str] = None
    espIpAddress: Optional[str] = None
    connectOnAirExit: Optional[bool] = None  # Added: allow editing On Air/Exit connection

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

# --- AC Device Models (flat structure, no room concept) ---
class ACDeviceCreate(BaseModel):
    """Add a new AC device."""
    deviceName: str
    ip: str

class ACDeviceUpdate(BaseModel):
    """Update an existing AC device."""
    deviceName: Optional[str] = None
    ip: Optional[str] = None

class ACSingleControl(BaseModel):
    """Control power for a single AC device by acCode."""
    acCode: int
    power: str  # "ON" or "OFF"

class ACAllControl(BaseModel):
    """Control power for ALL AC devices."""
    power: str  # "ON" or "OFF"

class ACTempSingle(BaseModel):
    """Set temperature for a single AC device."""
    acCode: int
    temperature: int = Field(..., ge=16, le=30)

class ACTempAll(BaseModel):
    """Set temperature for ALL AC devices."""
    temperature: int = Field(..., ge=16, le=30)


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

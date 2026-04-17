import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

def _ensure_file(path: Path, default_content=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(default_content or {}, indent=2))

def read_json(filename: str, default_key: str = "devices") -> list:
    path = DATA_DIR / filename
    default = {default_key: []}
    _ensure_file(path, default)
    data = json.loads(path.read_text())
    return data.get(default_key, [])

def write_json(filename: str, items: list, key: str = "devices"):
    path = DATA_DIR / filename
    _ensure_file(path, {key: []})
    path.write_text(json.dumps({key: items}, indent=2))

def next_kode(items: list) -> int:
    if not items:
        return 1
    return max(d.get("kode", 0) for d in items) + 1

def next_room_id(rooms: list) -> str:
    if not rooms:
        return "rm01"
    nums = []
    for r in rooms:
        try:
            nums.append(int(r.get("roomId", "rm00").replace("rm", "")))
        except ValueError:
            nums.append(0)
    return f"rm{max(nums) + 1:02d}"

def next_relay_id(relays: list) -> str:
    if not relays:
        return "rl01"
    nums = []
    for r in relays:
        try:
            nums.append(int(r.get("relayId", "rl00").replace("rl", "")))
        except ValueError:
            nums.append(0)
    return f"rl{max(nums) + 1:02d}"

def next_ac_code(devices: list) -> int:
    """Generate next acCode integer for AC devices."""
    if not devices:
        return 1
    return max(d.get("acCode", 0) for d in devices) + 1

# --- File constants ---
SHOWCASE_NEON_FILE = "devices_showcase.json"
STUDIO_NEON_FILE = "devices_studio.json"
HL_ROOMS_FILE = "hl_rooms.json"
AC_DEVICES_FILE = "ac_devices.json"

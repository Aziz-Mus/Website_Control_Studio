import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

# ΓöÇΓöÇ Showcase ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
SHOWCASE_NEON_FILE             = "showcase/devices.json"
SHOWCASE_GRID_LAYOUT_FILE      = "showcase/grid_layout.json"
SHOWCASE_SAVED_SEL_FILE        = "showcase/saved_selections.json"

# ΓöÇΓöÇ Studio: Neon ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
STUDIO_NEON_FILE               = "studio/neon/devices.json"
STUDIO_NEON_GRID_LAYOUT_FILE   = "studio/neon/grid_layout.json"
STUDIO_NEON_SAVED_SEL_FILE     = "studio/neon/saved_selections.json"

# ΓöÇΓöÇ Studio: Headlights (flat ΓÇö single ESP + relays) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
HL_CONFIG_FILE                 = "studio/headlights/config.json"
HL_RELAY_SAVED_SEL_FILE        = "studio/headlights/saved_selections.json"
HL_GRID_LAYOUT_FILE            = "studio/headlights/grid_layout.json"

# Legacy (kept for migration reference ΓÇö no longer used)
HL_ROOMS_FILE                  = "studio/headlights/rooms.json"
HL_ROOM_SAVED_SEL_FILE         = "studio/headlights/room_saved_selections.json"
HL_ROOM_GRID_LAYOUT_FILE       = "studio/headlights/room_grid_layouts.json"

# ΓöÇΓöÇ Studio: AC ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
AC_DEVICES_FILE                = "studio/ac/devices.json"

# ΓöÇΓöÇ Command Center ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
CC_DEVICES_FILE                = "command_center/devices.json"
CC_LIGHTS_FILE                 = "command_center/lights.json"
CC_GRID_LAYOUT_FILE            = "command_center/grid_layout.json"
CC_PRESETS_FILE                = "command_center/presets.json"
CC_ANIMATIONS_FILE             = "command_center/animations.json"
CC_SAVED_SEL_FILE              = "command_center/saved_selections.json"




# ΓöÇΓöÇΓöÇ Internal helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

def _ensure_file(path: Path, default_content=None):
    """Create file with default dict content if missing or empty."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        path.write_text(json.dumps(default_content or {}, indent=2))


def _ensure_list_file(path: Path):
    """Create file with empty list if missing or empty."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        path.write_text("[]")


# ΓöÇΓöÇΓöÇ Public read/write ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

def read_json(filename: str, default_key: str = None, raw: bool = False):
    """
    Read a JSON file from DATA_DIR.
    - raw=True       ΓåÆ return the raw parsed object (dict or list)
    - default_key=None ΓåÆ file is a raw JSON array (e.g. presets)
    - default_key=str  ΓåÆ file is a JSON object with that key (e.g. {"devices": [...]})
    """
    path = DATA_DIR / filename
    try:
        if raw:
            if not path.exists() or path.stat().st_size == 0:
                return {}
            return json.loads(path.read_text())
        if default_key is None:
            _ensure_list_file(path)
            data = json.loads(path.read_text())
            return data if isinstance(data, list) else []
        _ensure_file(path, {default_key: []})
        data = json.loads(path.read_text())
        return data.get(default_key, [])
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"Corrupt/empty JSON file: {filename} ΓÇö resetting to default")
        if raw:
            write_json(filename, {}, raw=True)
            return {}
        if default_key is None:
            write_json(filename, [], raw=True)
            return []
        write_json(filename, [], key=default_key)
        return []



def write_json(filename: str, items, key: str = None, raw: bool = False):
    """
    Write data to a JSON file in DATA_DIR.
    - raw=True  ΓåÆ write items directly (any JSON-serialisable type)
    - key=None  ΓåÆ write as raw JSON array
    - key=str   ΓåÆ write as JSON object with that key
    """
    path = DATA_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    if raw:
        path.write_text(json.dumps(items, indent=2))
    elif key is None:
        _ensure_list_file(path)
        path.write_text(json.dumps(items, indent=2))
    else:
        _ensure_file(path, {key: []})
        path.write_text(json.dumps({key: items}, indent=2))



# ΓöÇΓöÇΓöÇ ID generators ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
    if not devices:
        return 1
    return max(d.get("acCode", 0) for d in devices) + 1

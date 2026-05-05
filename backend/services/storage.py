import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

# --- File constants ---
SHOWCASE_NEON_FILE = "devices_showcase.json"
STUDIO_NEON_FILE = "devices_studio.json"
HL_ROOMS_FILE = "hl_rooms.json"
AC_DEVICES_FILE = "ac_devices.json"
CC_PRESETS_FILE = "cc_presets.json"
CC_ANIMATIONS_FILE = "cc_animations.json"
CC_LIGHTS_FILE = "cc_lights.json"

# ── Command Center Devices (CRUD, like showcase/studio_neon) ──────────────────
CC_DEVICES_FILE = "cc_devices.json"

# ── Grid Layout (per-page) ────────────────────────────────────────────────────
SHOWCASE_GRID_LAYOUT_FILE      = "showcase_grid_layout.json"
STUDIO_NEON_GRID_LAYOUT_FILE   = "studio_neon_grid_layout.json"
CC_GRID_LAYOUT_FILE            = "cc_grid_layout.json"

# ── Saved Selections (per-page) ───────────────────────────────────────────────
SHOWCASE_SAVED_SEL_FILE        = "showcase_saved_selections.json"
STUDIO_NEON_SAVED_SEL_FILE     = "studio_neon_saved_selections.json"
CC_SAVED_SEL_FILE              = "cc_saved_selections.json"




# ─── Internal helpers ─────────────────────────────────────────────────────────

def _ensure_file(path: Path, default_content=None):
    """Create file with default dict content if missing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(json.dumps(default_content or {}, indent=2))


def _ensure_list_file(path: Path):
    """Create file with empty list if missing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("[]")


# ─── Public read/write ────────────────────────────────────────────────────────

def read_json(filename: str, default_key: str = None, raw: bool = False):
    """
    Read a JSON file from DATA_DIR.
    - raw=True       → return the raw parsed object (dict or list)
    - default_key=None → file is a raw JSON array (e.g. presets)
    - default_key=str  → file is a JSON object with that key (e.g. {"devices": [...]})
    """
    path = DATA_DIR / filename
    if raw:
        if not path.exists():
            return {}
        return json.loads(path.read_text())
    if default_key is None:
        _ensure_list_file(path)
        data = json.loads(path.read_text())
        return data if isinstance(data, list) else []
    _ensure_file(path, {default_key: []})
    data = json.loads(path.read_text())
    return data.get(default_key, [])



def write_json(filename: str, items, key: str = None, raw: bool = False):
    """
    Write data to a JSON file in DATA_DIR.
    - raw=True  → write items directly (any JSON-serialisable type)
    - key=None  → write as raw JSON array
    - key=str   → write as JSON object with that key
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



# ─── ID generators ────────────────────────────────────────────────────────────

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

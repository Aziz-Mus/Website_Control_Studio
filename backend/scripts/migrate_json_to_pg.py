import json
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import SessionRW, engine_rw, Base
from db.models import Room, Device, Preset, Animation, SavedSelection

#Buat tabel jika belumada
Base.metadata.create_all(bind=engine_rw)

DATA = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

def load(path):
    full = os.path.join(DATA, path)
    if not os.path.exists(full):
        return None
    with open(full, "r", encoding="utf-8") as f:
        return json.load(f)
    
def run():
    db = SessionRW()
    print("Mulai migrasi data JSON -> PostgreSQL....\n")

    # 1. ROOMS
    rooms_seed = [
        {
            "id": "cc_room",
            "name": "Command Center",
            "ui_type": "GRID_SYSTEM",
            "ui_config": load("command_center/grid_layout.json") or {}
        },
        {
            "id": "showcase_room",
            "name": "Showcase Room",
            "ui_type": "GRID_SYSTEM",
            "ui_config": load("showcase/grid_layout.json") or {}
        },
        {
            "id": "studio_neon_room",
            "name": "Kendali Neon Studio",
            "ui_type": "GRID_SYSTEM",
            "ui_config": load("studio/neon/grid_layout.json") or {}
        },
        {
            "id": "headlights_room",
            "name": "Kendali Lampu Utama",
            "ui_type": "GRID_SYSTEM",
            "ui_config": load("studio/headlights/grid_layout.json") or {}
        },
        {
            "id": "ac_room",
            "name": "Kendali AC",
            "ui_type": "AC_CONTROL",
            "ui_config": {}
        },
    ]
    for r in rooms_seed:
        if not db.query(Room).filter_by(id=r['id']).first():
            db.add(Room(**r))
    db.commit()
    print("Tabel rooms terisi")

    # CC LIGHT (WiZ Lamps)
    cc_light = load("command_center/lights.json") or []
    for i, l in enumerate(cc_light):
        dev_id = f"cc_{i+1:03d}"
        if not db.query(Device).filter_by(id=dev_id).first():
            db.add(Device(
                id=dev_id, room_id="cc_room",
                name=l.get("name",f"lampu {i+1}"),
                type="WiZ",
                conn_info={"ip":l.get("ip",""),"id":l.get("id"), "baris":l.get("baris"), "kolom": l.get("kolom")}
            ))
    db.commit()
    print(f"{len(cc_light)} lampu Command Center berhasil di migrasikan")

    # Showcase Devices
    showcase_devs = load("showcase/devices.json") or []
    for d in showcase_devs:
        dev_id = f"showcase_{d.get('kode', d.get('id', ''))}"
        if not db.query(Device).filter_by(id=dev_id).first():
            db.add(Device(
                id=dev_id, room_id="showcase_room",
                name=d.get("name", "Neon"),
                type="RELAY",
                conn_info={"ip":d.get("ip",""), "kode":d.get("kode"), "channel":d.get("channelCode","")}
            ))
    db.commit()
    print(f"{len(showcase_devs)} device Showcase berhasil dimigrasi.")


    # Studio Neon Devices
    neon_devs = load("studio/neon/devices.json") or []
    for d in neon_devs:
        dev_id = f"neon_{d.get('kode', d.get('id',''))}"
        if not db.query(Device).filter_by(id=dev_id).first():
            db.add(Device(
                id=dev_id, room_id="studio_neon_room",
                name=d.get("name", "Neon"),
                type="RELAY",
                conn_info={"ip":d.get("ip",""), "kode":d.get("kode"), "channel":d.get("channelCode","")}
            ))
    db.commit()
    print(f"{len(neon_devs)} device Studio Neon berhasil dimigrasikan")

    # Headlight
    hl_config = load("studio/headlights/config.json") or {}
    relays = hl_config.get("relays", [])
    for rel in relays:
        dev_id = f"hl_{rel['relayId']}"
        if not db.query(Device).filter_by(id=dev_id).first():
            db.add(Device(
                id=dev_id, room_id="headlights_room",
                name=rel.get("deviceName",""),
                type="RELAY",
                conn_info={"ip": hl_config.get("espIpAddress",""), "channel": rel.get("channelCode",""), "relay_id": rel.get("relayId", "")}
            ))
    db.commit()
    print(f"{len(relays)} relay Headlight berhasil dimigrasikan")

    # AC Device
    ac_data = load("studio/ac/devices.json") or {}
    ac_devs = ac_data.get("devices", []) if isinstance(ac_data, dict) else ac_data
    for d in ac_devs:
        dev_id = f"ac_{d.get('acCode', d.get('id',''))}"
        if not db.query(Device).filter_by(id=dev_id).first():
            db.add(Device(
                id=dev_id, room_id="ac_room",
                name=d.get("deviceName", "AC"),
                type="AC",
                last_state={"temperature": d.get("lastTemperature", 24)},
                conn_info={"ip": d.get("ip",""), "ac_code": d.get("acCode")}
            ))
    db.commit()
    print(f"{len(ac_devs)} unit AC berhasil di migrasikan")

    # CC Preset
    presets = load("command_center/presets.json") or []
    for p in presets:
        db.add(Preset(room_id="cc_room", name=p.get("name", "Preset"), settings=p.get("settings", {})))
    db.commit()
    print(f"{len(presets)} preset command center berhasil dimigrasikan")

    # CC Animations
    animations = load("command_center/animations.json") or []
    for a in animations:
        db.add(Animation(name=a.get("name", "Animasi"), steps=a.get("frames", a.get("steps", []))))
    db.commit()
    print(f"{len(animations)} animasi berhasil dimigrasikan")

    db.close()
    print("\n 🎉 Migrasi berhasil! semua data JSOn sudah ada di PostgreSQL")

if __name__ == "__main__":
    run()


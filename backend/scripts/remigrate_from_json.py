"""
Script Re-Migrasi: Hapus data lama di PostgreSQL, isi ulang dengan data
yang TEPAT dari file JSON (nama asli, kode integer asli).

Jalankan dari folder backend/:
    .\\venv\\Scripts\\python.exe scripts/remigrate_from_json.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import engine_rw, Base
from db.models import Room, Device, Preset, Animation, SavedSelection
from sqlalchemy.orm import Session

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

def load_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"  [SKIP] {path}: {e}")
        return default

def remigrate():
    with Session(engine_rw) as db:
        # ══════════════════════════════════════════════════
        # 1. HAPUS SEMUA DATA LAMA
        # ══════════════════════════════════════════════════
        print("Menghapus data lama...")
        db.query(SavedSelection).delete()
        db.query(Preset).delete()
        db.query(Animation).delete()
        db.query(Device).delete()
        db.query(Room).delete()
        db.commit()
        print("  OK - Semua data lama dihapus")

        # ══════════════════════════════════════════════════
        # 2. BUAT ROOMS
        # ══════════════════════════════════════════════════
        print("\nMembuat rooms...")

        # Command Center
        cc_grid = load_json(os.path.join(DATA, 'cc_grid_layout.json'), {})
        db.add(Room(
            id='cc_room', name='Command Center', ui_type='wiz_grid',
            ui_config={
                'cols': cc_grid.get('cols', 5),
                'rows': cc_grid.get('rows', 14),
                'cells': {str(k): int(v) for k, v in cc_grid.get('cells', {}).items()}
            }
        ))

        # Showcase Room
        sc_grid = load_json(os.path.join(DATA, 'showcase_grid_layout.json'), {})
        db.add(Room(
            id='showcase_room', name='Showcase Room', ui_type='wiz_grid',
            ui_config={
                'cols': sc_grid.get('cols', 4),
                'rows': sc_grid.get('rows', 5),
                'cells': {str(k): int(v) for k, v in sc_grid.get('cells', {}).items()}
            }
        ))

        # Studio Neon
        neon_grid = load_json(os.path.join(DATA, 'studio_neon_grid_layout.json'), {})
        db.add(Room(
            id='studio_neon_room', name='Kendali Neon Studio', ui_type='wiz_grid',
            ui_config={
                'cols': neon_grid.get('cols', 4),
                'rows': neon_grid.get('rows', 5),
                'cells': {str(k): int(v) for k, v in neon_grid.get('cells', {}).items()}
            }
        ))

        # Headlights - ambil dari rooms.json / room_grid_layouts.json
        hl_rooms = load_json(os.path.join(DATA, 'studio', 'headlights', 'rooms.json'), [])
        hl_grid_layouts = load_json(os.path.join(DATA, 'studio', 'headlights', 'room_grid_layouts.json'), {})
        db.add(Room(
            id='headlights_room', name='Kendali Lampu Utama', ui_type='relay_grid',
            ui_config=hl_grid_layouts.get('headlights_room', {'cols': 4, 'rows': 5, 'cells': {}})
        ))

        # AC
        db.add(Room(
            id='ac_room', name='Kendali AC', ui_type='ac_panel',
            ui_config={}
        ))

        db.commit()
        print("  OK - 5 rooms dibuat")

        # ══════════════════════════════════════════════════
        # 3. DEVICES - Command Center (kode = integer asli)
        # ══════════════════════════════════════════════════
        print("\nMigrasi devices Command Center...")
        cc_devices = load_json(os.path.join(DATA, 'cc_devices.json'), [])
        count = 0
        for d in cc_devices:
            kode = d.get('kode')
            db.add(Device(
                id=f'cc_{kode:03d}',
                room_id='cc_room',
                name=d.get('nama', f'Lampu {kode}'),
                type='wiz',
                conn_info={
                    'kode': kode,   # integer asli — dipakai grid matching
                    'ip': d.get('ip', ''),
                }
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} devices CC")

        # ══════════════════════════════════════════════════
        # 4. DEVICES - Showcase Room
        # ══════════════════════════════════════════════════
        print("\nMigrasi devices Showcase Room...")
        sc_devices = load_json(os.path.join(DATA, 'devices_showcase.json'), [])
        count = 0
        for d in sc_devices:
            kode = d.get('kode')
            db.add(Device(
                id=f'sc_{kode:03d}',
                room_id='showcase_room',
                name=d.get('nama', str(kode)),
                type='wiz',
                conn_info={
                    'kode': kode,
                    'ip': d.get('ip', ''),
                }
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} devices Showcase")

        # ══════════════════════════════════════════════════
        # 5. DEVICES - Studio Neon
        # ══════════════════════════════════════════════════
        print("\nMigrasi devices Studio Neon...")
        neon_devices = load_json(os.path.join(DATA, 'studio', 'neon', 'devices.json'), [])
        count = 0
        for d in neon_devices:
            kode = d.get('kode')
            db.add(Device(
                id=f'neon_{kode:03d}',
                room_id='studio_neon_room',
                name=d.get('nama', str(kode)),
                type='wiz',
                conn_info={
                    'kode': kode,
                    'ip': d.get('ip', ''),
                }
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} devices Studio Neon")

        # ══════════════════════════════════════════════════
        # 6. DEVICES - Headlights (relay)
        # ══════════════════════════════════════════════════
        print("\nMigrasi devices Headlights...")
        hl_config = load_json(os.path.join(DATA, 'studio', 'headlights', 'config.json'), {})
        esp_ip = hl_config.get('espIpAddress', '')
        hl_relays = hl_config.get('relays', [])
        count = 0
        for relay in hl_relays:
            relay_id = relay.get('relayId', relay.get('id', f'relay_{count}'))
            db.add(Device(
                id=f'hl_{relay_id}',
                room_id='headlights_room',
                name=relay.get('deviceName', relay.get('name', str(relay_id))),
                type='relay',
                conn_info={
                    'relay_id': relay_id,
                    'channel': relay.get('channelCode', relay.get('channel', '')),
                    'ip': esp_ip,
                }
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} relays Headlights (ESP: {esp_ip})")

        # ══════════════════════════════════════════════════
        # 7. DEVICES - AC
        # ══════════════════════════════════════════════════
        print("\nMigrasi devices AC...")
        ac_raw = load_json(os.path.join(DATA, 'studio', 'ac', 'devices.json'), {})
        if not ac_raw:
            ac_raw = load_json(os.path.join(DATA, 'ac_devices.json'), {})
        # JSON bisa berbentuk {"devices": [...]} atau langsung [...]
        ac_devices = ac_raw.get('devices', ac_raw) if isinstance(ac_raw, dict) else ac_raw
        count = 0
        for d in ac_devices:
            ac_code = d.get('acCode', d.get('kode', f'ac{count}'))
            db.add(Device(
                id=f'ac_{ac_code}',
                room_id='ac_room',
                name=d.get('deviceName', d.get('nama', str(ac_code))),
                type='ac',
                conn_info={
                    'ac_code': ac_code,
                    'ip': d.get('ip', ''),
                },
                last_state={'temperature': d.get('lastTemperature', 24)}
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} AC units")

        # ══════════════════════════════════════════════════
        # 8. PRESETS (CC)
        # ══════════════════════════════════════════════════
        print("\nMigrasi presets...")
        cc_presets = load_json(os.path.join(DATA, 'cc_presets.json'), [])
        count = 0
        for p in cc_presets:
            db.add(Preset(
                room_id='cc_room',
                name=p.get('name', 'Preset'),
                settings=p.get('settings', p)
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} presets CC")

        # ══════════════════════════════════════════════════
        # 9. ANIMATIONS (CC)
        # ══════════════════════════════════════════════════
        print("\nMigrasi animasi...")
        cc_anims = load_json(os.path.join(DATA, 'cc_animations.json'), [])
        count = 0
        for a in cc_anims:
            db.add(Animation(
                name=a.get('name', 'Animation'),
                steps=a.get('frames', a.get('steps', []))
            ))
            count += 1
        db.commit()
        print(f"  OK - {count} animasi CC")

        # ══════════════════════════════════════════════════
        # 10. SAVED SELECTIONS
        # ══════════════════════════════════════════════════
        print("\nMigrasi saved selections...")
        sel_files = [
            ('cc_room',         os.path.join(DATA, 'cc_saved_selections.json')),
            ('showcase_room',   os.path.join(DATA, 'showcase_saved_selections.json')),
            ('studio_neon_room',os.path.join(DATA, 'studio_neon_saved_selections.json')),
            ('headlights_room', os.path.join(DATA, 'studio', 'headlights', 'saved_selections.json')),
        ]
        total = 0
        for room_id, path in sel_files:
            sels = load_json(path, [])
            for s in sels:
                db.add(SavedSelection(
                    room_id=room_id,
                    name=s.get('name', 'Selection'),
                    device_ids=s.get('kodes', s.get('device_ids', []))
                ))
                total += 1
        db.commit()
        print(f"  OK - {total} saved selections")

    print("\n✅ Re-migrasi selesai! Semua data sudah di-restore dari JSON asli.")

if __name__ == '__main__':
    remigrate()

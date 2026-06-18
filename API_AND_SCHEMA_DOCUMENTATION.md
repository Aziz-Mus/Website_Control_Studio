# Dokumentasi Skema & Output API — Web Control Studio

## 1. System Overview & Topology

Web Control Studio adalah sistem kendali perangkat IoT berbasis web yang terdiri dari tiga lapisan utama:

```
[Browser / React Frontend]
         │  REST API + WebSocket
         ▼
[FastAPI Backend — Python]
    ├── PostgreSQL (Data Persistence)
    ├── WiZ UDP Protocol (Lampu Pintar)
    ├── ESP32 HTTP (Relay Headlights)
    └── AC Service (Unit AC)
```

- **Frontend**: React (port 3000), Tailwind CSS, Axios, shadcn/ui
- **Backend**: FastAPI v3.0 (port 8000), SQLAlchemy, APScheduler, pytz
- **Database**: PostgreSQL (dual connection: Read-Write port 5432, Read-Only port 4343)
- **Hardware**:
  - Lampu WiZ → UDP port 38899 via `pywizlight`
  - Relay ESP32 → HTTP REST (`/control`, `/status`)
  - AC → HTTP via `ACService`

**Ruangan yang aktif secara hardware:**
| Room ID | Nama Menu | Tipe Hardware |
|---|---|---|
| `showcase_room` | Showcase Room | WiZ Lamps |
| `studio_neon_room` | Studio: Neon Control | WiZ Lamps |
| `cc_room` | Command Center | WiZ Lamps |
| `headlights_room` | Studio: Main Headlights | Relay ESP32 |


**Ruangan yang belum aktif secara hardware:**
| Room ID | Nama Menu | Tipe Hardware |
|---|---|---|
| `ac_room` | Studio: AC Control | AC Service |

---

## 2. Skema Database (PostgreSQL)

### 2.1 Tabel Inti

#### `rooms`
Menyimpan konfigurasi UI untuk setiap menu/ruangan.

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | VARCHAR(50) | NO (PK) | ID unik ruangan. Contoh: `cc_room`, `showcase_room` |
| `name` | VARCHAR(100) | NO | Nama tampilan menu |
| `ui_type` | VARCHAR(50) | NO | Jenis tampilan UI. Contoh: `grid`, `list` |
| `ui_config` | JSONB | YES | Konfigurasi grid layout: `{cols, rows, cells: {"0": "device_id"}}` |

**Contoh data:**
```json
{
  "id": "cc_room",
  "name": "Command Center",
  "ui_type": "grid",
  "ui_config": { "cols": 10, "rows": 5, "cells": { "0": "cc_001", "1": "cc_002" } }
}
```

#### `devices`
Menyimpan profil dan status real-time setiap perangkat.

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | VARCHAR(50) | NO (PK) | ID unik device. Contoh: `cc_001`, `headlights_room_a1b2c3d4` |
| `room_id` | VARCHAR(50) | NO | FK ke `rooms.id` |
| `name` | VARCHAR(100) | NO | Nama perangkat |
| `type` | VARCHAR(30) | NO | Tipe perangkat: `wiz`, `relay`, `ac` |
| `status` | VARCHAR(20) | YES | Status real-time: `on`, `off`, `failed`, `IDLE` |
| `last_state` | JSONB | YES | State terakhir: `{"brightness": 200, "rgb": [255,0,0]}` |
| `conn_info` | JSONB | YES | Info koneksi: `{"ip": "10.1.50.2", "kode": 1, "channel": "1"}` |
| `last_updated` | TIMESTAMP | YES | Waktu terakhir status diperbarui (auto-update) |

**Contoh data (WiZ):**
```json
{
  "id": "cc_001",
  "room_id": "cc_room",
  "name": "Lampu Panggung Kiri",
  "type": "wiz",
  "status": "on",
  "last_state": { "brightness": 200, "rgb": [255, 150, 50] },
  "conn_info": { "ip": "10.1.50.2", "kode": 1 }
}
```

**Contoh data (Relay):**
```json
{
  "id": "headlights_room_a1b2c3d4",
  "room_id": "headlights_room",
  "name": "Sorot Depan 1",
  "type": "relay",
  "status": "off",
  "conn_info": { "ip": "10.1.40.88", "channel": "1", "kode": 1 }
}
```

---

### 2.2 Tabel Personalisasi Kontrol

#### `presets`
Menyimpan skenario warna/pengaturan lampu yang dapat dipanggil kembali.

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | INTEGER | NO (PK, auto) | ID preset |
| `room_id` | VARCHAR(50) | NO | ID ruangan pemilik preset |
| `name` | VARCHAR(100) | NO | Nama preset. Contoh: `"Dramatic Red"` |
| `settings` | JSONB | NO | Pengaturan warna: `{"rgb": [255,0,0], "brightness": 200}` |

#### `animations`
Menyimpan animasi warna custom (khusus Command Center).

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | INTEGER | NO (PK, auto) | ID animasi |
| `name` | VARCHAR(100) | NO | Nama animasi |
| `steps` | JSONB | NO | Array frame animasi: `[{"rgb":[255,0,0],"brightness":200}, ...]` |

#### `saved_selections`
Menyimpan kelompok perangkat yang dipilih oleh pengguna.

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | INTEGER | NO (PK, auto) | ID selection |
| `room_id` | VARCHAR(50) | NO | ID ruangan |
| `name` | VARCHAR(100) | NO | Nama grup. Contoh: `"Lampu Tribun"` |
| `device_ids` | JSONB | NO | Array kode/ID device: `[1, 2, 5]` atau `["cc_001"]` |

---

### 2.3 Tabel Otomasi (Scheduler)

#### `schedules`
Menyimpan aturan penjadwalan otomasi perangkat.

| Kolom | Tipe | Nullable | Default | Deskripsi |
|---|---|---|---|---|
| `id` | VARCHAR(50) | NO (PK) | — | ID jadwal. Contoh: `sch_a1b2c3d4` |
| `room_id` | VARCHAR(50) | NO | — | ID ruangan target |
| `name` | VARCHAR(100) | NO | — | Nama jadwal |
| `time` | VARCHAR(5) | NO | — | Waktu eksekusi format `HH:MM`. Contoh: `"22:00"` |
| `days` | JSONB | YES | `[]` | Hari aktif: `["monday","wednesday","friday"]` |
| `action` | VARCHAR(10) | NO | — | Aksi: `"on"` atau `"off"` |
| `brightness` | INTEGER | YES | NULL | Kecerahan 0-100 (hanya jika action=on) |
| `rgb` | JSONB | YES | NULL | Warna `[R, G, B]` (hanya jika action=on) |
| `target_type` | VARCHAR(15) | YES | `"all"` | Target: `"all"`, `"selection"`, `"device"` |
| `target_id` | VARCHAR(100) | YES | NULL | ID dari `saved_selections` atau `devices` |
| `is_active` | INTEGER | YES | `1` | Status aktif: `1`=aktif, `0`=nonaktif |
| `last_run_status` | VARCHAR(15) | YES | NULL | Status terakhir: `EXECUTE`, `ON`, `OFF`, `PARTIAL`, `FAILED` |
| `last_run_time` | TIMESTAMP | YES | NULL | Waktu eksekusi terakhir |

#### `schedule_logs`
Menyimpan riwayat maksimal 10 eksekusi terakhir per jadwal.

| Kolom | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | INTEGER | NO (PK, auto) | ID log |
| `schedule_id` | VARCHAR(50) | NO | FK ke `schedules.id` (CASCADE DELETE) |
| `executed_at` | TIMESTAMP | YES | Waktu eksekusi (default: `now()`) |
| `status` | VARCHAR(15) | NO | Hasil: `ON`, `OFF`, `PARTIAL`, `FAILED`, `SKIPPED` |
| `details` | TEXT | YES | Keterangan detail. Contoh: `"Sukses 8/10 lampu. Gagal: Lampu A, Lampu B"` |

---

## 3. API Schema Lapis 1: Frontend ↔ Backend (REST API)

**Base URL:** `http://localhost:8000`

> **Catatan Autentikasi:** Semua endpoint (kecuali `/api/auth/login` dan `/api/openapi/token`) dilindungi oleh JWT Bearer Token. Sertakan header berikut di setiap request:
> ```
> Authorization: Bearer <access_token>
> ```

---

### 3.0 Authentication API
**Tag:** `Authentication`

#### `POST /api/auth/login`
Login untuk pengguna UI web. Memerlukan HMAC signature untuk keamanan tambahan.

**Headers yang wajib dikirim:**
```
X-Timestamp: <unix_timestamp>
X-Signature: <hmac_sha256_signature>
```
> Signature dibuat dari: `HMAC-SHA256(key=SECRET_KEY, message="{timestamp}.{json_body}")`

**Request Body:**
```json
{ "username": "admin", "password": "your_password" }
```
**Response `200 OK`:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "username": "admin",
  "role": "admin_all"
}
```
**Response `403`:** `{ "detail": "HMAC signature mismatch. Access denied" }`  
**Response `401`:** `{ "detail": "Invalid username or password" }`

**Role yang tersedia:**
| Role | Izin |
|---|---|
| `admin_all` | Full access (GET, POST, PUT, PATCH, DELETE) |
| `read_only` | Hanya GET request |

#### `POST /api/openapi/token`
Generate long-lived API token (1 tahun) untuk integrasi pihak ketiga atau sistem AI. Menggunakan `form-data`, bukan JSON.

**Request (form-data):**
```
username=admin_all
password=your_password
```
**Response `200 OK`:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in_seconds": 3156000,
  "expires_at_date": "2027-06-18 10:00:00",
  "role": "admin_all",
  "username": "admin_all"
}
```
**Response `401`:** `{ "detail": "Wrong username or password!" }`

---

### 3.1 Rooms API
**Tag:** `Rooms` | **Prefix:** `/api/room`

#### `GET /api/room`
Mengambil daftar semua ruangan (untuk navigasi menu sidebar).

**Response `200 OK`:**
```json
[
  { "id": "cc_room", "name": "Command Center", "ui_type": "grid" },
  { "id": "showcase_room", "name": "Showcase Room", "ui_type": "grid" }
]
```

#### `GET /api/room/detail?room_id={room_id}`
Mengambil detail konfigurasi grid satu ruangan.

**Query Params:** `room_id` (string, required)

**Response `200 OK`:**
```json
{
  "id": "cc_room",
  "name": "Command Center",
  "ui_type": "grid",
  "ui_config": { "cols": 10, "rows": 5, "cells": { "0": "cc_001" } }
}
```
**Response `404`:** `{ "detail": "Room 'xxx' tidak ditemukan" }`

#### `PUT /api/room/config?room_id={room_id}`
Memperbarui konfigurasi layout grid ruangan (drag-and-drop grid editor).

**Request Body:**
```json
{ "cols": 10, "rows": 5, "cells": { "0": "cc_001", "1": "cc_002" } }
```
**Response `200 OK`:** `{ "status": "success", "room_id": "cc_room" }`

---

### 3.2 Devices API
**Tag:** `Devices` | **Prefix:** `/api/devices`

#### `GET /api/devices?room_id={room_id}`
Mengambil semua perangkat untuk satu ruangan beserta status sinkron dari DB.

**Response `200 OK`:**
```json
[
  {
    "id": "cc_001",
    "room_id": "cc_room",
    "name": "Lampu Panggung",
    "type": "wiz",
    "status": "on",
    "last_state": { "brightness": 200, "rgb": [255, 150, 50] },
    "conn_info": { "ip": "10.1.50.2", "kode": 1 },
    "kode": 1
  }
]
```

#### `POST /api/devices` (201 Created)
Menambahkan perangkat baru. `id` dan `kode` di-generate otomatis jika kosong.

**Request Body:**
```json
{
  "room_id": "cc_room",
  "name": "Lampu Baru",
  "type": "wiz",
  "conn_info": { "ip": "10.1.50.99" }
}
```
**Response `201`:**
```json
{
  "status": "created",
  "device": { "id": "cc_room_a1b2c3d4", "name": "Lampu Baru", "kode": 6, "conn_info": { "ip": "10.1.50.99", "kode": 6 } }
}
```
**Response `409`:** `{ "detail": "Device ID '...' sudah ada" }`

#### `PUT /api/devices/{device_id}`
Memperbarui nama, tipe, atau `conn_info` (IP, channel) perangkat.

**Request Body:**
```json
{ "name": "Lampu Panggung Utama", "conn_info": { "ip": "10.1.50.100" } }
```
**Response `200 OK`:**
```json
{
  "status": "updated",
  "device": { "id": "cc_001", "name": "Lampu Panggung Utama", "type": "wiz", "kode": 1, "conn_info": { "ip": "10.1.50.100", "kode": 1 } }
}
```

#### `PATCH /api/devices/{device_id}/status`
Endpoint utama sinkronisasi status. Dipanggil setelah setiap aksi kontrol agar status tersimpan di DB dan sinkron antar-browser.

**Request Body:**
```json
{ "status": "on", "last_state": { "brightness": 200, "rgb": [255, 0, 0] } }
```
**Response `200 OK`:** `{ "status": "updated", "device_id": "cc_001" }`

#### `DELETE /api/devices/{device_id}`
Menghapus perangkat dari database.

**Response `200 OK`:** `{ "status": "deleted", "device": "cc_001" }`
**Response `404`:** `{ "detail": "Device 'xxx' tidak ditemukan" }`

---

### 3.3 Features API

#### 3.3.1 Presets API
**Tag:** `Features` | Prefix: `/api/presets`

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/presets?room_id={id}` | Ambil semua preset ruangan |
| POST | `/api/presets` | Buat preset baru |
| DELETE | `/api/presets/{preset_id}` | Hapus preset |

**GET Response:**
```json
[{ "id": 1, "name": "Dramatic Red", "settings": { "rgb": [255,0,0], "brightness": 200 } }]
```
**POST Body:** `{ "room_id": "cc_room", "name": "Blue Stage", "settings": { "rgb": [0,0,255], "brightness": 180 } }`
**POST Response:** `{ "status": "created", "preset_id": 2 }`

#### 3.3.2 Animations API
**Tag:** `Features` | Prefix: `/api/animations`

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/animations` | Ambil semua animasi (global, tidak per room) |
| POST | `/api/animations` | Buat animasi baru |
| DELETE | `/api/animations/{anim_id}` | Hapus animasi |

**GET Response:**
```json
[{ "id": 1, "name": "Rainbow", "steps": [{"rgb":[255,0,0],"brightness":200}, {"rgb":[0,255,0],"brightness":200}] }]
```
**POST Body:** `{ "name": "Strobe", "steps": [{"rgb":[255,255,255],"brightness":255}, {"rgb":[0,0,0],"brightness":0}] }`

#### 3.3.3 Saved Selections API
**Tag:** `Features` | Prefix: `/api/selections`

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/selections?room_id={id}` | Ambil grup seleksi per ruangan |
| POST | `/api/selections` | Simpan grup seleksi baru |
| DELETE | `/api/selections/{sel_id}` | Hapus grup seleksi |

**GET Response:**
```json
[{ "id": 1, "name": "Lampu Tribun", "device_ids": [1, 3, 5] }]
```
**POST Body:** `{ "room_id": "showcase_room", "name": "Lampu Tribun", "device_ids": [1, 3, 5] }`

#### 3.3.4 Schedule API
**Tag:** `Features` | Prefix: `/api/schedules`

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/schedules?room_id={id}` | Ambil semua jadwal per ruangan |
| POST | `/api/schedules` | Buat jadwal + daftarkan ke APScheduler |
| PUT | `/api/schedules/{id}` | Perbarui jadwal |
| PATCH | `/api/schedules/{id}/toggle` | Aktifkan/nonaktifkan jadwal |
| DELETE | `/api/schedules/{id}` | Hapus jadwal dari DB + APScheduler |
| GET | `/api/schedules/{id}/logs` | Ambil 10 riwayat eksekusi terakhir |
| DELETE | `/api/schedules/{id}/logs` | Hapus semua log jadwal |

**POST Body (Buat Jadwal):**
```json
{
  "room_id": "showcase_room",
  "name": "Matikan Showcase Malam",
  "time": "22:00",
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "action": "off",
  "target_type": "all",
  "target_id": null
}
```
**GET Schedules Response:**
```json
[{
  "id": "sch_a1b2c3d4",
  "room_id": "showcase_room",
  "name": "Matikan Showcase Malam",
  "time": "22:00",
  "days": ["monday","friday"],
  "action": "off",
  "brightness": null,
  "rgb": null,
  "target_type": "all",
  "target_id": null,
  "is_active": true,
  "last_run_status": "OFF",
  "last_run_time": "2026-05-18 22:00:01"
}]
```
**GET Logs Response:**
```json
[{
  "id": 5,
  "executed_at": "2026-05-18 22:00:01",
  "status": "OFF",
  "details": "Berhasil mematikan 10/10 lampu."
}]
```

---

### 3.4 Hardware Control API (Eksekusi ke Perangkat)
**Tag:** `Hardware Control` | **Prefix:** `/api/control`

#### 3.4.1 WiZ Lights Control

##### `POST /api/control/wiz/lampu`
Kontrol satu atau banyak lampu WiZ secara paralel (`asyncio.gather`).

**Request Body:**
```json
{
  "ips": ["10.1.50.2", "10.1.50.3"],
  "action": "on",
  "brightness": 200,
  "rgb": [255, 150, 0],
  "colortemp": null,
  "scene_id": null
}
```
**Response `200 OK` (Semua sukses):**
```json
{
  "status": "success",
  "summary": { "total": 2, "success": 2, "failed": 0 },
  "devices": [
    { "ip": "10.1.50.2", "status": "success", "error": null },
    { "ip": "10.1.50.3", "status": "success", "error": null }
  ]
}
```
**Response `200 OK` (Sebagian gagal — PARTIAL):**
```json
{
  "status": "partial",
  "summary": { "total": 2, "success": 1, "failed": 1 },
  "devices": [
    { "ip": "10.1.50.2", "status": "success", "error": null },
    { "ip": "10.1.50.3", "status": "failed", "error": "Connection timeout" }
  ]
}
```

##### `POST /api/control/wiz/turn-off`
Shortcut mematikan semua lampu WiZ. Schema sama dengan `/wiz/lampu` dengan `action: "off"`.

##### `POST /api/control/wiz/animation/start`
Memulai animasi warna di lampu WiZ.

**Request Body:**
```json
{
  "name": "Rainbow",
  "ips": ["10.1.50.2"],
  "interval": 2.0,
  "frames": [
    { "rgb": [255, 0, 0], "brightness": 200 },
    { "rgb": [0, 255, 0], "brightness": 200 }
  ]
}
```
**Response:** `{ "status": "started", "name": "Rainbow", "lights": 1 }`

##### `POST /api/control/wiz/animation/stop`
Menghentikan animasi yang sedang berjalan.
**Response:** `{ "status": "stopped" }`

#### 3.4.2 Relay Control (Headlights ESP32)

##### `POST /api/control/relay`
Kontrol satu channel relay ESP32.

**Request Body:**
```json
{ "esp_ip": "10.1.40.88", "channel_code": "1", "power": "ON" }
```
**Response `200 OK`:**
```json
{ "status": "success", "channel": "1", "power": "ON", "error": null }
```

##### `POST /api/control/relay/bulk`
Kontrol banyak channel relay sekaligus (untuk Select All / Deselect All).

**Request Body:**
```json
{
  "esp_ip": "10.1.40.88",
  "relays": [
    { "channel_code": "1", "power": "ON" },
    { "channel_code": "2", "power": "ON" },
    { "channel_code": "3", "power": "OFF" }
  ]
}
```
**Response:**
```json
{
  "status": "success",
  "summary": { "total": 3 },
  "relays": [{"channel_code":"1","power":"ON"}, {"channel_code":"2","power":"ON"}, {"channel_code":"3","power":"OFF"}]
}
```

#### 3.4.3 AC Control

##### `POST /api/control/ac`
Kontrol satu unit AC.

**Request Body:**
```json
{ "ip": "10.1.34.52", "power": "ON", "temperature": 24 }
```
**Response:**
```json
{ "status": "success", "ip": "10.1.34.52", "power": "ON", "temperature": 24, "error": null }
```

##### `POST /api/control/ac/all`
Kontrol semua AC dalam satu ruangan (IP diambil dari database `devices` where `type=ac`).

**Request Body:**
```json
{ "room_id": "ac_room", "power": "ON", "temperature": 24 }
```
**Response:**
```json
{
  "status": "success",
  "summary": { "total": 3, "success": 3, "failed": 0 },
  "results": [
    { "id": "ac_001", "name": "AC Kiri", "status": "success", "error": null }
  ]
}
```

##### `POST /api/control/ac/temperature`
Set suhu AC dan nyalakan secara bersamaan.

**Request Body:** `{ "ip": "10.1.34.52", "temperature": 22, "power": "ON" }`

---

### 3.5 Standar Format Error Response

| HTTP Status | Kondisi | Contoh Response |
|---|---|---|
| `400` | Request tidak valid / field kosong | `{ "detail": "Tidak ada IP yang dipilih" }` |
| `404` | Data tidak ditemukan di DB | `{ "detail": "Device 'xxx' tidak ditemukan" }` |
| `409` | Konflik duplikat ID | `{ "detail": "Device ID 'xxx' sudah ada" }` |
| `422` | Validasi Pydantic gagal | `{ "detail": [{ "loc": ["body","room_id"], "msg": "field required" }] }` |
| `500` | Error internal server | `{ "detail": "..." }` |

---

## 4. API Schema Lapis 2: Backend ↔ Hardware

### 4.1 Protokol ESP32 Relay (HTTP REST)

Backend mengirim perintah **HTTP POST** ke ESP32 menggunakan library `httpx` (async).

**Endpoint di ESP32:**

#### `POST http://<ESP_IP>/control`
Perintah kontrol satu channel:
```json
{ "channel": 1, "state": "ON" }
```
Perintah kontrol banyak channel (bulk):
```json
{ "channels": [1, 2, 3], "state": "ON" }
```
**Response dari ESP32 (sukses):**
```json
{ "status": "success" }
```
**Response dari ESP32 (gagal):**
```json
{ "status": "failed", "message": "Channel not found" }
```

#### `GET http://<ESP_IP>/status`
Mengambil status semua relay di ESP32.
**Response dari ESP32:**
```json
{ "relays": { "1": "ON", "2": "OFF", "3": "ON", "4": "OFF" } }
```

**Konfigurasi koneksi:**
- Timeout: `5.0 detik`
- Library: `httpx.AsyncClient`
- Tidak ada autentikasi (koneksi jaringan lokal/LAN)

---

### 4.2 Protokol WiZ Smart Lamp (UDP)

Backend berkomunikasi dengan lampu WiZ menggunakan library `pywizlight` melalui protokol **UDP port 38899**.

**Karakteristik komunikasi:**
- Protokol: UDP (connectionless)
- Port: `38899`
- Format: JSON via UDP datagram
- Library: `pywizlight` (PilotBuilder)
- Timeout per perintah: `3.0 detik`
- Retry otomatis: hingga `5-6 kali` dengan jeda `0.5 detik`

**Payload UDP yang dikirim backend (via pywizlight) — Nyalakan dengan warna:**
```json
{ "method": "setPilot", "params": { "r": 255, "g": 150, "b": 0, "dimming": 78, "state": true } }
```

**Payload UDP — Nyalakan dengan scene:**
```json
{ "method": "setPilot", "params": { "sceneId": 14, "dimming": 50, "state": true } }
```

**Payload UDP — Matikan:**
```json
{ "method": "setPilot", "params": { "state": false } }
```

**Response dari WiZ Lamp:**
```json
{ "method": "setPilot", "env": "pro", "result": { "success": true } }
```

---

### 4.3 WebSocket — Real-time Status Updates

Selain REST API, backend menyediakan koneksi WebSocket untuk pembaruan status secara real-time ke browser tanpa perlu polling.

**WebSocket URL:** `ws://localhost:8000/ws/updates`

#### Event 1: `schedule_status` — Pembaruan status jadwal

Saat jadwal mulai dieksekusi:
```json
{ "type": "schedule_status", "schedule_id": "sch_a1b2c3d4", "status": "EXECUTE" }
```

Saat eksekusi selesai (berhasil semua):
```json
{ "type": "schedule_status", "schedule_id": "sch_a1b2c3d4", "status": "ON" }
```

Saat eksekusi selesai (sebagian berhasil, sebagian gagal):
```json
{ "type": "schedule_status", "schedule_id": "sch_a1b2c3d4", "status": "PARTIAL" }
```

Saat eksekusi gagal semua:
```json
{ "type": "schedule_status", "schedule_id": "sch_a1b2c3d4", "status": "FAILED" }
```

Status yang mungkin dikirim: `EXECUTE`, `ON`, `OFF`, `PARTIAL`, `FAILED`, `SKIPPED`

| Status | Warna Badge | Keterangan |
|---|---|---|
| `EXECUTE` | 🔵 Biru | Sedang mengeksekusi |
| `ON` | 🟢 Hijau | Semua device berhasil dinyalakan |
| `OFF` | ⚪ Abu-abu | Semua device berhasil dimatikan |
| `PARTIAL` | 🟡 Kuning | Sebagian berhasil, sebagian gagal |
| `FAILED` | 🔴 Merah | Semua device gagal |

#### Event 2: `device_status` — Pembaruan status perangkat individual

Dikirim oleh endpoint `/wiz/lampu`, `/relay`, `/ac`, `/ac/all`, dan `/ac/temperature` setelah eksekusi sukses, untuk mengupdate status tiap perangkat di UI secara real-time:
```json
{
  "type": "device_status",
  "room_id": "showcase_room",
  "devices": [
    { "id": "sr_001", "status": "on" },
    { "id": "sr_002", "status": "on" }
  ]
}
```

Per-device status yang mungkin dikirim:

| Status | Keterangan |
|---|---|
| `"on"` | Device berhasil dinyalakan |
| `"off"` | Device berhasil dimatikan |
| `"failed"` | Device gagal dikendalikan |

#### Event 3: `DEVICE_UPDATE` — Pembaruan bulk relay (Headlights)

Khusus dikirim oleh endpoint `/relay/bulk` setelah eksekusi berhasil. Berbeda dengan `device_status`, event ini tidak memuat status per-device melainkan merelay payload mentah dari request:
```json
{
  "type": "DEVICE_UPDATE",
  "category": "relay_bulk",
  "esp_ip": "10.1.40.88",
  "relays": [
    { "channel_code": "1", "power": "ON" },
    { "channel_code": "2", "power": "OFF" }
  ]
}
```

> **Catatan:** Pada status `PARTIAL`, setiap device tetap menerima status individual — yang berhasil mendapat `"on"`/`"off"`, yang gagal mendapat `"failed"`. Status `PARTIAL` hanya berlaku di level schedule, bukan di level device.
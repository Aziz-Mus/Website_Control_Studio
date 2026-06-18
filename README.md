# 🎛️ Web Control Studio

A web-based IoT device control system built for a production studio environment. It provides a real-time dashboard to control smart lights (WiZ), relay-based headlights (ESP32), and air conditioners — all from a single unified interface.

---

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
  - [Option A: Docker (Recommended for Production)](#option-a-docker-recommended-for-production)
  - [Option B: Manual Local Development](#option-b-manual-local-development)
- [Environment Variables](#-environment-variables)
- [Hardware Requirements](#-hardware-requirements)
- [API & Integration](#-api--integration)
- [Active Rooms / Menus](#-active-rooms--menus)

---

## ✨ Features

- 🎨 **WiZ Smart Light Control** — Set color (RGB), brightness, color temperature, or dynamic scenes across multiple lights simultaneously
- 💡 **Relay Headlights Control** — Control relay channels on ESP32 individually or in bulk via drag-and-drop grid UI
- ❄️ **AC Control** — Power and temperature control for air conditioning units
- 📐 **Custom Grid Layout** — Drag-and-drop device arrangement with configurable grid sizes
- 💾 **Saved Selections** — Save and quickly re-apply groups of selected devices
- 🎬 **Animations** — Create and run custom color animation sequences on WiZ lights
- 🗂️ **Presets** — Save and recall color/brightness configurations
- ⏰ **Scheduler** — Automate device control by time and day with execution logs
- 📡 **Real-time WebSocket** — Live status updates pushed from backend to all connected browsers instantly
- 🔐 **JWT Authentication** — Role-based access control with HMAC-secured login

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────┐
│          Browser / React Frontend            │
│    (Port 80 via Nginx in Docker,             │
│     Port 3000 in local dev)                  │
└──────────────┬──────────────────────────────┘
               │  REST API  +  WebSocket (/ws/updates)
               ▼
┌─────────────────────────────────────────────┐
│         FastAPI Backend (Python)             │
│              Port 8000                       │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │APScheduler│  │WS Manager│   │
│  │(Database)│  │(Scheduler)│  │(Broadcast)│  │
│  └──────────┘  └──────────┘  └──────────┘   │
└───┬────────────────┬────────────────┬────────┘
    │ UDP :38899      │ HTTP /control  │ HTTP
    ▼                 ▼               ▼
┌────────┐      ┌──────────┐   ┌──────────┐
│  WiZ   │      │  ESP32   │   │    AC    │
│ Lamps  │      │  Relay   │   │  Units   │
│(pywiz) │      │ (httpx)  │   │ (httpx)  │
└────────┘      └──────────┘   └──────────┘
```

**Database Connection:**
- **Read-Write** connection: Port `5432` — for all write operations (control, CRUD)
- **Read-Only** connection: Port `4343` — for all GET/read operations (optimized for performance)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Axios, shadcn/ui, Lucide Icons, @dnd-kit/core |
| **Backend** | FastAPI 0.110, Uvicorn, SQLAlchemy 2.0, APScheduler 3.10 |
| **Database** | PostgreSQL (with dual connection) |
| **Auth** | PyJWT, bcrypt, HMAC-SHA256 |
| **Hardware - WiZ** | pywizlight (UDP port 38899) |
| **Hardware - Relay** | httpx (async HTTP to ESP32) |
| **Real-time** | WebSocket (native FastAPI + websockets library) |
| **Deployment** | Docker + Docker Compose + Nginx |

---

## 📁 Project Structure

```
Web-Control-Studio/
├── docker-compose.yml          # Orchestrates frontend + backend containers
├── API_AND_SCHEMA_DOCUMENTATION.md
│
├── backend/
│   ├── server.py               # FastAPI app entry point, JWT auth, WebSocket
│   ├── ws_manager.py           # Global WebSocket broadcast manager
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env                    # ⚠️ Not committed — see Environment Variables
│   ├── db/
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   ├── crud.py             # Database CRUD functions
│   │   └── connection.py       # Dual DB connection setup (RW + RO)
│   ├── routers/
│   │   ├── auth.py             # Login + token generation
│   │   ├── rooms.py            # Room config API
│   │   ├── devices.py          # Device CRUD API
│   │   ├── features.py         # Presets, Animations, Selections, Schedules
│   │   └── control.py          # Hardware control (WiZ, Relay, AC)
│   └── services/
│       ├── bulb_service.py     # WiZ UDP control logic
│       ├── relay_service.py    # ESP32 HTTP relay logic
│       ├── ac_service.py       # AC HTTP control logic
│       ├── command_center_service.py  # Animation thread
│       └── scheduler_service.py       # APScheduler engine
│
└── frontend/
    ├── nginx.conf              # Nginx config (reverse proxy to backend)
    ├── Dockerfile
    ├── .env                    # ⚠️ Not committed — see Environment Variables
    └── src/
        ├── pages/              # One file per menu/room
        │   ├── Login.jsx
        │   ├── StudioHeadlights.jsx
        │   ├── StudioNeon.jsx
        │   ├── StudioAC.jsx
        │   ├── ShowcaseRoom.jsx
        │   └── CommandCenter.jsx
        ├── components/shared/  # Reusable UI components
        └── hooks/
            └── useDeviceStatusWS.js  # WebSocket real-time hook
```

---

## 🚀 Setup & Installation

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- A running **PostgreSQL** database (can be on the server or a separate host)
- WiZ lamps, ESP32 relay, and/or AC units on the same LAN (for hardware control)

---

### Option A: Docker (Recommended for Production)

**1. Clone the repository**
```bash
git clone https://github.com/your-username/Web-Control-Studio.git
cd Web-Control-Studio
```

**2. Create the backend environment file**

Create `backend/.env` (see [Environment Variables](#-environment-variables) section):
```bash
cp backend/.env.example backend/.env
# Then edit backend/.env with your actual values
```

**3. Create the frontend environment file**

Create `frontend/.env`:
```env
REACT_APP_BACKEND_URL=
REACT_APP_API_TOKEN=your_secret_key_same_as_backend_SECRET_KEY
```
> ⚠️ Leave `REACT_APP_BACKEND_URL` **empty** when using Docker. Nginx handles the proxy automatically.

**4. Build and run**
```bash
docker compose up -d --build
```

**5. Access the app**

Open your browser at `http://localhost` (or your server's IP address).

> **First-time setup:** You need to manually create at least one user in the `users` table of your PostgreSQL database with a bcrypt-hashed password.

---

### Option B: Manual Local Development

**1. Backend**

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt

# Create and fill backend/.env (see Environment Variables section)

python server.py
# Backend runs at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

**2. Frontend**

```bash
cd frontend

# Create frontend/.env
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env
echo "REACT_APP_API_TOKEN=your_SECRET_KEY_value" >> .env

npm install
npm start
# Frontend runs at http://localhost:3000
```

---

## 🔐 Environment Variables

### `backend/.env`

```env
# PostgreSQL — Read-Write connection
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_rw_user
DB_PASSWORD=your_rw_password

# PostgreSQL — Read-Only connection (optimized for GET requests)
DB_HOST_RO=your_db_host
DB_PORT_RO=4343
DB_NAME_RO=your_db_name
DB_USER_RO=viewer_ro
DB_PASSWORD_RO=your_ro_password

# JWT signing key for user sessions (keep secret!)
SECRET_KEY_USER=your_very_long_random_jwt_secret

# HMAC key — must match REACT_APP_API_TOKEN in frontend
SECRET_KEY=your_shared_hmac_secret

# CORS — set to your frontend domain in production
CORS_ORIGIN="http://localhost:3000"

# Server port (default: 8000)
PORT=8000
```

### `frontend/.env`

```env
# Leave EMPTY when using Docker (Nginx proxies automatically)
# Set to http://localhost:8000 for local development
REACT_APP_BACKEND_URL=

# Must be identical to SECRET_KEY in backend/.env
REACT_APP_API_TOKEN=your_shared_hmac_secret
```

> ⚠️ **Important:** `SECRET_KEY` (backend) and `REACT_APP_API_TOKEN` (frontend) **must be the same value**. This is the shared key for HMAC-secured login.

---

## 🔌 Hardware Requirements

| Hardware | Protocol | Notes |
|---|---|---|
| **WiZ Smart Lamps** | UDP port `38899` | Must be on same LAN as backend server. Uses `pywizlight`. |
| **ESP32 Relay Controller** | HTTP REST | Must expose `/control` (POST) and `/status` (GET) endpoints. See `arduino_code_control/` for firmware. |
| **AC Units** | HTTP REST | Must expose a compatible HTTP control interface via `ACService`. |

All hardware must be reachable from the **backend server** on the local network.

---

## 📡 API & Integration

The backend exposes a fully documented REST API and WebSocket interface.

- **Interactive Swagger UI:** `http://your-server:8000/docs`
- **Full Schema Documentation:** [`API_AND_SCHEMA_DOCUMENTATION.md`](./API_AND_SCHEMA_DOCUMENTATION.md)

### Quick Start: Get an API Token

To integrate with the API (e.g., from an AI system or third-party frontend):

```bash
curl -X POST http://your-server:8000/api/openapi/token \
  -d "username=admin_all&password=your_password"
```

Use the returned `access_token` as a Bearer token in all subsequent requests:
```bash
curl http://your-server:8000/api/devices?room_id=showcase_room \
  -H "Authorization: Bearer eyJ..."
```

### WebSocket (Real-time Status)

Connect to `ws://your-server:8000/ws/updates` (or `ws://your-server/ws` via Nginx in Docker) to receive live device status updates without polling.

---

## 🏠 Active Rooms / Menus

| Room ID | Menu Name | Hardware | Status |
|---|---|---|---|
| `showcase_room` | Showcase Room | WiZ Lamps | ✅ Active |
| `studio_neon_room` | Studio: Neon Control | WiZ Lamps | ✅ Active |
| `cc_room` | Command Center | WiZ Lamps | ✅ Active |
| `headlights_room` | Studio: Main Headlights | ESP32 Relay | ✅ Active |
| `ac_room` | Studio: AC Control | AC Units | 🔧 Hardware Pending |

---

## 📄 License

This project is proprietary and intended for internal studio use. Contact the repository owner for usage permissions.

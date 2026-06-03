"""
Web Control Studio - API Server v3.0
Jalankan langsung  : python server.py
Jalankan dengan reload : uvicorn server:app --reload --port 8000
"""
import logging
import os
import uvicorn
import jwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import text as sa_text
from dotenv import load_dotenv
from routers.auth import router as auth_router

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Database Initialization ───────────────────────────────────────────────────
from db.connection import engine_rw, Base
import db.models
Base.metadata.create_all(bind=engine_rw)  # Auto-create tabel jika belum ada

# Auto-GRANT SELECT untuk read-only user pada tabel baru
try:
    with engine_rw.connect() as conn:
        for tbl in Base.metadata.sorted_tables:
            conn.execute(sa_text(f'GRANT SELECT ON TABLE {tbl.name} TO viewer_ro'))
        conn.commit()
    logger.info("GRANT SELECT on all tables to viewer_ro — OK")
except Exception as _e:
    logger.warning(f"Auto-GRANT skipped: {_e}")

# ── Router Imports ────────────────────────────────────────────────────────────
from routers.rooms   import router as rooms_router
from routers.devices import router as devices_router
from routers.features import router as features_router
from routers.control import router as control_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Skema bearer dari FastAPI
security = HTTPBearer()

# Skema JWT User
SECRET_KEY_USER = os.getenv("SECRET_KEY_USER")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Mencoba membuka token menggunakan SECRET_KEY_USER
        payload = jwt.decode(token, SECRET_KEY_USER, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token sudah kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token palsu atau salah")



# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Web Control Studio API",
    description="""
        Unified API - Room and Device Management  
        Yang sudah berfungsi sistem lampu yang mengandalkan WiZ:  
        * Showcase Room (showcase_room)
        * Studio: Neon Control (studio_neon_room)
        * Command Center (cc_room)

        Untuk Studio : AC Control (ac_room) dan Studio : Main Headlights (headligths_room) belum berfungsi secara hardware
        """,
    version="3.0.0"
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGIN", "*").strip('"').split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(rooms_router, dependencies=[Depends(verify_token)])
app.include_router(devices_router, dependencies=[Depends(verify_token)])
app.include_router(features_router, dependencies=[Depends(verify_token)])
app.include_router(control_router, dependencies=[Depends(verify_token)])   # Hardware control (WiZ, Relay, AC)

# ── Root Endpoint ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "online", "version": "3.0.0"}


# ── Scheduler Startup ────────────────────────────────────────────────────────
@app.on_event("startup")
def _start_scheduler():
    from services.scheduler_service import engine
    engine.start()
    logger.info("Scheduler engine initialized")


# ── WebSocket for Schedule Status ────────────────────────────────────────────
@app.websocket("/ws/schedules")
async def ws_schedules(websocket: WebSocket):
    await websocket.accept()
    from services.scheduler_service import register_ws, unregister_ws
    register_ws(websocket)
    try:
        while True:
            # Keep connection alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        unregister_ws(websocket)


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("ENV", "development") == "development"
    logger.info(f"Starting server on port {port} (reload={reload})")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=reload)

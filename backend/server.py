"""
Indonesia Indicator — Studio Controller API
Main entry point. All business logic lives in routers/.
Run: uvicorn server:app --host 0.0.0.0 --port 8001 --reload
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import showcase, studio_neon, headlights, ac, command_center

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Indonesia Indicator — Studio Controller",
    description="Unified API for Neon, Headlights, AC, and Command Center.",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register all routers under /api prefix ────────────────────────────────────
API_PREFIX = "/api"

app.include_router(showcase.router,        prefix=API_PREFIX)
app.include_router(studio_neon.router,     prefix=API_PREFIX)
app.include_router(headlights.router,      prefix=API_PREFIX)
app.include_router(ac.router,              prefix=API_PREFIX)
app.include_router(command_center.router,  prefix=API_PREFIX)


# ─── Root health check ────────────────────────────────────────────────────────
@app.get("/api/")
async def root():
    return {"message": "Indonesia Indicator — Studio Controller API", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Konfigurasi koneksi PostgreSQL
- engine_rw
- engine_ro
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

def _build_url(user_key: str, pass_key: str) -> str:
    host = os.getenv("DB_RW_HOST", "localhost")
    port = os.getenv("DB_RW_PORT", "5432")
    name = os.getenv("DB_RW_NAME", "web_control_studio")
    user = os.getenv(user_key, "postgres")
    pwd  = os.getenv(pass_key, "")
    return f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{name}"

engine_rw = create_engine(
    _build_url("DB_RW_USER", "DB_RW_PASSWORD"),
    pool_pre_ping=True
)

engine_ro = create_engine(
    _build_url("DB_RO_USER", "DB_RO_PASSWORD"),
    pool_pre_ping=True
)

SessionRW = sessionmaker(autocommit=False, autoflush=False, bind=engine_rw)
SessionRO = sessionmaker(autocommit=False, autoflush=False, bind=engine_ro)

Base = declarative_base()

def get_db_rw():
    "Inject sesi Read-Write (POST, PUT, DELETE)"
    db = SessionRW()
    try:
        yield db
    finally:
        db.close()

def get_db_ro():
    "Inject sesi Read-Only (GET)"
    db = SessionRO()
    try:
        yield db
    finally:
        db.close()
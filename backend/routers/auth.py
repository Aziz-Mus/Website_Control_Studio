from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
import bcrypt
import jwt
import datetime
import os
import hmac
import hashlib
import time
import json

from db.connection import get_db_rw
from db.models import User

router = APIRouter(tags=['Authentication'])
# pwd_context = CryptContext(schemes=['bcrypt'], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY_USER")  # Harus sama persis dengan SECRET_KEY di server.py

FRONTEND_APP_TOKEN = os.getenv("SECRET_KEY", "")

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db_rw), x_timestamp: str = Header(None), x_signature: str = Header(None)):
    if not x_timestamp or not x_signature:
        raise HTTPException(status_code=403, detail="Header keamanan (HMAC tidak lengkap)")
    
    try:
        client_time = int(x_timestamp)
        server_time = int(time.time())

        # Tolak request jika lebih dari 90 detik
        if abs(server_time - client_time) > 90:
            raise HTTPException(status_code=403, detail="Request kedaluwarsa")
    except ValueError:
        raise HTTPException(status_code=403, detail="Format Timestamp salah")
    
    # Buat ulang pesan mentah
    payload_str = json.dumps({"username":request.username, "password":request.password}, separators=(',',':'))
    message_to_sign = f"{x_timestamp}.{payload_str}"

    # Cetak signature
    expected_signature = hmac.new(
        FRONTEND_APP_TOKEN.encode('utf-8'),
        message_to_sign.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Bandingkan cetakan frontend dan backend
    if not hmac.compare_digest(expected_signature, x_signature):
        raise HTTPException(status_code=403, detail="Signature HMAC tidak cocok. Akses ditolak")
    
    # cari user di database
    user = db.query(User).filter(User.username == request.username).first()

    # Cek kecocokan user dan password
    if not user or not bcrypt.checkpw(request.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )
    
    # Generate JWT Token yang berisi informasi ROLE
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }
    

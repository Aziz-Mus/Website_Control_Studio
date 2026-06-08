from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import bcrypt
import jwt
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
        raise HTTPException(status_code=403, detail="Incomplete HMAC security header")
    
    try:
        client_time = int(x_timestamp)
        server_time = int(time.time())

        # Tolak request jika lebih dari 90 detik
        if abs(server_time - client_time) > 90:
            raise HTTPException(status_code=403, detail="Request expired")
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid timestamp format")
    
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
        raise HTTPException(status_code=403, detail="HMAC signature mismatch. Access denied")
    
    # cari user di database
    user = db.query(User).filter(User.username == request.username).first()

    # Cek kecocokan user dan password
    if not user or not bcrypt.checkpw(request.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    
    # Generate JWT Token yang berisi informasi ROLE
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }
    

# API Generate Token For Public Control
@router.post("/api/openapi/token")
def generate_api_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db_rw)):
    # Find user in database
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong username or password!"
        )
    
    # Generate JWT Token jangka waktu 1 tahun
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(days=365)
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    # Expired date
    expire_date = datetime.now() + timedelta(days=365)
    date = expire_date.strftime("%Y-%m-%d %H:%M:%S")

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_seconds": 3156000,
        "expires_at_date": date,
        "role": user.role,
        "username": user.username
    }
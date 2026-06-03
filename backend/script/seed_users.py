import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import SessionRW
from db.models import User
import bcrypt

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_users():
    db = SessionRW()
    # Daftar akun (username, password, role)
    accounts = [
        ("admin", "admin123", "admin"),
        ("user_showcase", "showcase123", "showcase_room"),
        ("user_cc", "cc123", "command_center"),
        ("user_STDneon", "STDneon123", "studio_neon_control"),
        ("user_STDmainLight", "STDmainligth123", "studio_main_headlight"),
        ("user_STDac", "STDac123", "studio_ac_control"),
        ("user_studio", "studio123", "studio_all")
    ]

    for username, password, role in accounts:
        # Cek apakah user sudah ada
        existing = db.query(User).filter(User.username == username).first()
        if not existing:
            new_user = User(
                username=username,
                password_hash=get_password_hash(password),
                role=role
            )
            db.add(new_user)
            print(f"Berhasil membuat akun: {username} (Role: {role})")

    db.commit()
    db.close()

if __name__ == "__main__":
    seed_users()
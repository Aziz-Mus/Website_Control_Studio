import jwt
import datetime

# Kunci rahasia
SECRET_KEY = "dcfc98d91af050132ce20c8e51ab14683c23f92b371ac5b85cd0193fe296961d"

# Payload dan umur token 10 tahun
payload = {
    "sub": "main",
    "role": "admin",
    "exp": datetime.datetime.utcnow() + datetime.timedelta(days=3650)
}

# Cetak Token
token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

print("=== TOKEN ===")
print(token)
print("=============")
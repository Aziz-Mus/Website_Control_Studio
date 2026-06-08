# Gunakan OS Linux + Python versi ringan
FROM python:3.10-slim

# Set folder kerja di dalam kontainer
WORKDIR /app

# Salin requirements dan install library
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin semua kode backend Anda
COPY . .

# Beritahu Docker bahwa backend pakai port 8000
EXPOSE 8000

# Perintah untuk menjalankan backend saat kontainer menyala
CMD ["python", "server.py"]
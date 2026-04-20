# Web Control Studio - Deployment & Maintenance Guide

Dokumentasi ini berisi catatan lengkap mengenai setup server, konfigurasi, serta solusi atas berbagai error yang ditemukan selama proses pengembangan dan deploy ke server Ubuntu.

---

## 🏗️ Arsitektur Sistem
*   **Frontend**: React.js (Disajikan sebagai file statis melalui Nginx).
*   **Backend**: FastAPI (Python) dikelola oleh **PM2** menggunakan **Gunicorn**.
*   **Database/Storage**: File JSON lokal di folder `backend/data/`.
*   **Hardware**: Server Berkomunikasi langsung ke ESP32 melalui jaringan lokal.

---

## 🚀 Setup Awal Server

### 1. Backend (FastAPI)
1.  Buat Virtual Environment: `python3 -m venv venv`
2.  Aktifkan: `source venv/bin/activate`
3.  Install: `pip install -r requirements.txt gunicorn uvicorn`
4.  Jalankan via PM2:
    ```bash
    pm2 start "venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app --bind 0.0.0.0:8000" --name "web-control-backend"
    ```

### 2. Frontend (React)
1.  Konfigurasi `.env`: Pastikan `REACT_APP_BACKEND_URL` menggunakan IP Server (misal: `http://10.1.11.225:8000`).
2.  Build: `npm install && npm run build`
3.  Nginx akan menyajikan folder `build/` tersebut pada Port 80.

---

## 🛠️ Solusi Error & Bug Fixes

### 1. Error: `net::ERR_CONNECTION_REFUSED`
*   **Penyebab**: Browser mencoba menghubungi Backend di alamat yang salah (biasanya `localhost`) atau Firewall memblokir port.
*   **Solusi**: 
    - Pastikan `.env` frontend menggunakan IP Server yang benar.
    - Jalankan `sudo ufw allow 8000` di Ubuntu.
    - Jalankan `npm run build` ulang setelah mengubah `.env`.

### 2. Error: `gunicorn: command not found` (di PM2)
*   **Penyebab**: PM2 tidak bisa menemukan executable `gunicorn` karena berada di dalam folder virtual env.
*   **Solusi**: Gunakan path lengkap di perintah PM2: `venv/bin/gunicorn`.

### 3. Bug: On Air/Exit Status Tidak Update di UI
*   **Penyebab**: Fungsi `fetchRooms()` dijalankan tanpa `await`, sehingga dialog tertutup sebelum data terbaru selesai diambil.
*   **Solusi**: Tambahkan `await fetchRooms()` sebelum menutup dialog (`setDialogOpen(false)`).

### 4. Backend Error: `NameError: ACTemperatureRequest is not defined`
*   **Penyebab**: Ada sisa kode (stale code) dari versi lama yang masih memanggil model yang sudah dihapus.
*   **Solusi**: Melakukan pembersihan (cleanup) total pada `server.py` dan menghapus seluruh endpoint lama yang sudah tidak relevan.

---

## ❄️ Refactor AC Control (Flat Structure)
Kita mengubah sistem AC dari berbasis *Room* menjadi *Flat Device List* untuk efisiensi:
*   **Lama**: User masuk ke Room -> Lihat List AC.
*   **Baru**: Langsung muncul Grid semua AC di halaman utama AC Control.
*   **Storage**: `ac_rooms.json` dihapus, diganti menjadi `ac_devices.json`.
*   **JSON Payload**: Sekarang backend hanya butuh `{ "acCode": 1, "power": "ON" }` karena IP sudah dicari secara otomatis di sisi server.

---

## 📋 Cheat Sheet Perintah Harian

| Tugas | Perintah |
|---|---|
| **Cek Log Backend** | `pm2 logs web-control-backend` |
| **Restart Backend** | `pm2 restart web-control-backend` |
| **Update Kode** | `git pull origin main` |
| **Auto-Start Reboot** | `pm2 startup` lalu `pm2 save` |
| **Cek Port Aktif** | `ss -tuln | grep 8000` |

---

> [!TIP]
> Selalu jalankan `pm2 save` setelah melakukan perubahan status proses agar daftar tersebut tetap tersimpan meskipun server mati mendadak.

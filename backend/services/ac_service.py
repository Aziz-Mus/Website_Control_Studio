import httpx
import logging

logger = logging.getLogger(__name__)


class ACService:
    """
    Service untuk berkomunikasi dengan ESP32 IR Controller yang mengendalikan AC.
    Setiap request mengirim power (ON/OFF) dan temperature sekaligus dalam satu payload.
    """

    def __init__(self, ip_address: str, name: str = "Unknown"):
        self.ip_address = ip_address
        self.name = name
        self.base_url = f"http://{ip_address}"

    async def get_status(self) -> dict:
        """Ambil status online dari ESP32 IR Controller."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/status", timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                return {"error": "Gagal mengambil status AC", "code": response.status_code, "status": "failed"}
        except Exception as e:
            logger.warning(f"Gagal mengambil status AC {self.name} ({self.ip_address}): {e}")
            return {"error": str(e), "status": "failed"}

    async def control_ac(self, power: str, temperature: int) -> dict:
        """
        Kirim perintah kendali ke AC via ESP32 IR Controller.

        Payload yang dikirim ke ESP:
            { "power": "ON" | "OFF", "temperature": 24 }

        Returns:
            { "status": "success" | "failed", "error": str (opsional) }
        """
        try:
            payload = {
                "power": power.upper(),
                "temperature": temperature
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/control",
                    json=payload,
                    timeout=5.0
                )
                if response.status_code == 200:
                    try:
                        body = response.json()
                        if isinstance(body, dict):
                            # Validasi body response — jangan percaya HTTP 200 saja
                            status_val = body.get("status", "").lower()
                            if status_val in ("failed", "error", "fail"):
                                return {
                                    "status": "failed",
                                    "error": body.get("message", "Device melaporkan kegagalan")
                                }
                            if body.get("error"):
                                return {"status": "failed", "error": str(body.get("error"))}
                        return {"status": "success"}
                    except Exception:
                        # Tidak bisa parse body, tapi HTTP 200 → anggap sukses
                        return {"status": "success"}

                return {"status": "failed", "error": f"HTTP {response.status_code}"}

        except Exception as e:
            logger.exception(f"Error kendali AC {self.name} ({self.ip_address}):")
            return {"status": "failed", "error": repr(e)}

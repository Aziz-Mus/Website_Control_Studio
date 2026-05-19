import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)


class RelayService:
    """
    Service untuk berkomunikasi dengan ESP relay controller (digunakan untuk Headlights).
    Mengirim perintah ON/OFF per channel ke endpoint /control pada ESP.
    """

    def __init__(self, ip_address: str, name: str = "Unknown", channels: int = 4):
        self.ip_address = ip_address
        self.name = name
        self.channels = channels
        self.base_url = f"http://{ip_address}"

    async def get_status(self) -> dict:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/status", timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                return {"error": "Failed to get status", "code": response.status_code}
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    async def control_channel(self, channel: int, state: str) -> dict:
        """
        Kendalikan satu channel relay.
        Returns: { "status": "success" | "failed", "error": str (opsional) }
        """
        try:
            payload = {"channel": channel, "state": state.upper()}
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
                            status_val = body.get("status", "").lower()
                            if status_val in ("failed", "error", "fail"):
                                return {
                                    "status": "failed",
                                    "error": body.get("message", "Device reported failure")
                                }
                            if body.get("error"):
                                return {"status": "failed", "error": str(body.get("error"))}
                        return {"status": "success"}
                    except Exception:
                        return {"status": "success"}
                return {"status": "failed", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error controlling channel {channel} on {self.ip_address}: {e}")
            return {"error": str(e), "status": "failed"}

    async def control_bulk(self, channels: list, state: str) -> dict:
        """Kendalikan banyak channel sekaligus dalam satu request (Optimized)."""
        try:
            clean_channels = []
            for c in channels:
                try: clean_channels.append(int(c))
                except: pass

            payload = {"channels": clean_channels, "state": state.upper()}
            print(f"\n[RELAY DEBUG] Sending BULK to {self.ip_address} | Channels: {clean_channels} | State: {state}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/control",
                    json=payload,
                    timeout=5.0
                )
                if response.status_code == 200:
                    return {"status": "success"}
                return {"status": "failed", "error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error in bulk control on {self.ip_address}: {e}")
            return {"error": str(e), "status": "failed"}

    async def control_all(self, state: str) -> dict:
        # Fallback to bulk if possible
        return await self.control_bulk(list(range(1, self.channels + 1)), state)



async def control_relay_channel(esp_ip: str, channel_code: str, state: str) -> dict:
    """
    Fungsi helper: kendalikan satu relay channel pada ESP tertentu.
    Digunakan oleh endpoint Headlights di server.py.
    """
    try:
        svc = RelayService(esp_ip)
        try:
            ch = int(channel_code)
        except ValueError:
            ch = channel_code
        result = await svc.control_channel(ch, state)
        if isinstance(result, dict) and result.get("status") == "failed":
            return {"status": "failed", "error": result.get("error", "Unknown error")}
        if isinstance(result, dict) and result.get("error"):
            return {"status": "failed", "error": result.get("error", "Unknown error")}
        return {"status": "success"}
    except Exception as e:
        logger.warning(f"Failed to control relay at {esp_ip} ch {channel_code}: {e}")
        return {"status": "failed", "error": str(e)}

import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)

class RelayService:
    def __init__(self, ip_address: str, name: str = "Unknown", channels: int = 4):
        self.ip_address = ip_address
        self.name = name
        self.channels = channels
        self.base_url = f"http://{ip_address}"

    async def get_status(self):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/status", timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                return {"error": "Failed to get status", "code": response.status_code}
        except Exception as e:
            return {"error": str(e), "status": "failed"}

    async def control_channel(self, channel: int, state: str):
        try:
            payload = {"channel": channel, "state": state.upper()}
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{self.base_url}/control", json=payload, timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                return {"error": "Failed to control channel", "code": response.status_code}
        except Exception as e:
            logger.error(f"Error controlling channel {channel}: {e}")
            return {"error": str(e), "status": "failed"}

    async def control_all(self, state: str):
        tasks = [self.control_channel(i, state) for i in range(1, self.channels + 1)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return {"status": "success", "detail": results}


async def control_relay_channel(esp_ip: str, channel_code: str, state: str) -> dict:
    """Control a single relay channel on an ESP device."""
    try:
        svc = RelayService(esp_ip)
        try:
            ch = int(channel_code)
        except ValueError:
            ch = channel_code
        result = await svc.control_channel(ch, state)
        if isinstance(result, dict) and result.get("error"):
            return {"status": "failed", "error": result.get("error", "Unknown error")}
        return {"status": "success"}
    except Exception as e:
        logger.warning(f"Failed to control relay at {esp_ip} ch {channel_code}: {e}")
        return {"status": "failed", "error": str(e)}

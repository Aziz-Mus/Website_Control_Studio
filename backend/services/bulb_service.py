import asyncio
import logging
from pywizlight import wizlight, PilotBuilder
from services.models import ColorModel

logger = logging.getLogger(__name__)

class WizService:
    def __init__(self, ip_address: str, name: str = "Unknown", max_retries: int = 10):
        self.ip_address = ip_address
        self.name = name
        self.max_retries = max_retries

    async def execute_with_retry(self, func, *args, **kwargs):
        last_exception = None
        for attempt in range(1, self.max_retries + 1):
            try:
                return await asyncio.wait_for(func(*args, **kwargs), timeout=5.0)
            except Exception as e:
                last_exception = e
                logger.warning(f"Attempt {attempt}/{self.max_retries} failed for {self.name} ({self.ip_address}): {e}")
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5)
        raise last_exception

    async def turn_on(self, color: ColorModel = None, brightness: int = None, scene_id: int = None):
        async def _action():
            light = wizlight(self.ip_address)
            try:
                if scene_id is not None:
                    pilot = PilotBuilder(scene=scene_id, brightness=brightness if brightness is not None else 128)
                    await light.turn_on(pilot)
                elif color and brightness is not None:
                    pilot = PilotBuilder(rgb=(color.Red, color.Green, color.Blue), brightness=brightness)
                    await light.turn_on(pilot)
                else:
                    await light.turn_on()
                return True
            finally:
                await light.async_close()
        return await self.execute_with_retry(_action)

    async def turn_off(self):
        async def _action():
            light = wizlight(self.ip_address)
            try:
                await light.turn_off()
                return True
            finally:
                await light.async_close()
        return await self.execute_with_retry(_action)

    async def get_status(self):
        async def _action():
            light = wizlight(self.ip_address)
            try:
                state = await light.updateState()
                return {"name": self.name, "ip": self.ip_address, "on": state.get_state(), "brightness": state.get_brightness(), "rgb": state.get_rgb()}
            finally:
                await light.async_close()
        try:
            return await self.execute_with_retry(_action)
        except Exception as e:
            return {"name": self.name, "ip": self.ip_address, "error": str(e)}


async def control_wiz_light(ip: str, color: ColorModel, brightness: int, scene_id: int = None) -> dict:
    try:
        svc = WizService(ip, max_retries=5)
        await svc.turn_on(color, brightness, scene_id=scene_id)
        return {"status": "success", "ip": ip}
    except Exception as e:
        logger.warning(f"Failed to control light at {ip}: {e}")
        return {"status": "failed", "ip": ip, "error": str(e)}


async def turn_off_wiz_light(ip: str) -> dict:
    try:
        svc = WizService(ip, max_retries=5)
        await svc.turn_off()
        return {"status": "success", "ip": ip}
    except Exception as e:
        logger.warning(f"Failed to turn off light at {ip}: {e}")
        return {"status": "failed", "ip": ip, "error": str(e)}

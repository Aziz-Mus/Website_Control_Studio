import { useEffect, useRef } from "react";

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace("http", "ws");

/**
 * Hook: Listen WebSocket untuk real-time device status updates dari scheduler.
 * @param {string} roomId - Room ID yang ingin didengarkan
 * @param {function} onDeviceStatus - Callback ketika menerima update, menerima object { room_id, devices: [{kode, status}] }
 */
export default function useDeviceStatusWS(roomId, onDeviceStatus) {
  const wsRef = useRef(null);
  const callbackRef = useRef(onDeviceStatus);
  callbackRef.current = onDeviceStatus;

  useEffect(() => {
    if (!roomId) return;

    const ws = new WebSocket(`${WS_URL}/ws/schedules`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "device_status" && data.room_id === roomId) {
          callbackRef.current(data);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => { /* silent */ };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId]);
}
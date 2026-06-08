import { useEffect, useRef } from "react";

const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace("http", "ws");

/**
 * Hook: Listen WebSocket untuk real-time device status updates dari seluruh sistem.
 * 
 * Menghandle 3 tipe pesan dari backend:
 *   1. device_status  — dari scheduler/control.py setelah eksekusi sukses
 *   2. DEVICE_UPDATE  — dari control relay bulk (legacy, trigger refresh)
 *   3. schedule_status — dari scheduler engine
 * 
 * @param {function} onMessage - Callback dipanggil dengan data pesan WebSocket
 */
export default function useDeviceStatusWS(onMessage) {
  const wsRef = useRef(null);
  const callbackRef = useRef(onMessage);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let stopped = false;

    function connect() {
      if (stopped) return;
      const ws = new WebSocket(`${WS_URL}/ws/updates`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Terhubung ke real-time Backend");
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          // Forward semua tipe pesan ke callback
          if (callbackRef.current) callbackRef.current(data);
        } catch (err) {
          console.error("[WS] Gagal membaca pesan:", err);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Terputus — reconnect dalam 3s");
        if (!stopped) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // onclose akan dipanggil setelah ini
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
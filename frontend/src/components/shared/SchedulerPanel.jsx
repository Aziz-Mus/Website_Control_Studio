import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import ScheduleFormModal from "./ScheduleFormModal";
import ScheduleLogModal from "./ScheduleLogModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace("http", "ws");

const DAY_SHORT = { monday: "M", tuesday: "T", wednesday: "W", thursday: "T", friday: "F", saturday: "S", sunday: "S" };

const STATUS_GLOW = {
  EXECUTE: { bg: "bg-blue-500", ring: "ring-blue-400/50", text: "text-blue-600", pulse: true },
  ON:      { bg: "bg-[#10B981]", ring: "ring-emerald-400/50", text: "text-emerald-600", pulse: false },
  OFF:     { bg: "bg-gray-400", ring: "ring-gray-300/50", text: "text-gray-500", pulse: false },
  PARTIAL: { bg: "bg-[#F59E0B]", ring: "ring-amber-400/50", text: "text-amber-600", pulse: false },
  FAILED:  { bg: "bg-[#EF4444]", ring: "ring-red-400/50", text: "text-red-600", pulse: false },
};

export default function SchedulerPanel({ roomId, selections = [], devices = [], embedded = false, hideColorBrightness = false }) {
  const [schedules, setSchedules] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState({ id: "", name: "" });
  const wsRef = useRef(null);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/schedules?room_id=${roomId}`);
      setSchedules(r.data || []);
    } catch { /* silent */ }
  }, [roomId]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // WebSocket for real-time status updates
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/updates`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "schedule_status") {
          setSchedules(prev => prev.map(s =>
            s.id === data.schedule_id ? { ...s, last_run_status: data.status } : s
          ));
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => { /* ignore */ };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, []);

  // Handlers
  const handleToggle = async (id) => {
    try {
      const r = await axios.patch(`${API}/schedules/${id}/toggle`);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: r.data.is_active } : s));
    } catch { toast.error("Failed to toggle"); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/schedules/${id}`);
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast.success("Schedule deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleEdit = (sch) => {
    setEditingSchedule(sch);
    setFormOpen(true);
  };

  const handleOpenLog = (sch) => {
    setLogTarget({ id: sch.id, name: sch.name });
    setLogOpen(true);
  };

  return (
    <div className={`flex flex-col overflow-hidden ${embedded ? "" : "bg-white border border-[#E5E7EB] rounded-lg"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${embedded ? "px-3 py-2 border-b border-[#E5E7EB] bg-[#FAFAFA]" : "px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]"}`}>
        <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: "Work Sans, sans-serif" }}>
          Schedules
        </h3>
        <Button size="sm" onClick={() => { setEditingSchedule(null); setFormOpen(true); }}
          className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs h-7">
          + Add Schedule
        </Button>
      </div>

      {/* Schedule Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {schedules.length === 0 && (
          <p className="text-xs text-[#637083] text-center py-6">No schedules configured.</p>
        )}
        {schedules.map(sch => {
          const st = STATUS_GLOW[sch.last_run_status] || STATUS_GLOW.OFF;
          return (
            <div key={sch.id}
              className={`relative p-3 rounded-lg border backdrop-blur-sm transition-all ${sch.is_active ? "bg-white/80 border-[#E5E7EB]" : "bg-gray-50/60 border-gray-200 opacity-60"}`}>
              {/* Top row: Name + Status indicator */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.bg} ${st.pulse ? "animate-pulse" : ""} ring-2 ${st.ring}`} />
                  <span className="text-sm font-medium text-[#1C2025] truncate">{sch.name}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase ${st.text}`}>{sch.last_run_status || "IDLE"}</span>
              </div>

              {/* Time + Days */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-semibold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
                  {sch.time}
                </span>
                <span className="text-[#637083]">|</span>
                <div className="flex gap-0.5">
                  {(sch.days || []).map((d, i) => (
                    <span key={i} className="w-5 h-5 flex items-center justify-center rounded-full bg-[#F3F4F6] text-[9px] font-semibold text-[#637083]">
                      {DAY_SHORT[d] || "?"}
                    </span>
                  ))}
                </div>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${sch.action === "on" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                  {sch.action.toUpperCase()}
                </span>
              </div>

              {/* Action buttons row */}
              <div className="flex items-center gap-1.5">
                {/* Master Toggle */}
                <button onClick={() => handleToggle(sch.id)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${sch.is_active ? "bg-[#DA2C38]" : "bg-[#D1D5DB]"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sch.is_active ? "left-[18px]" : "left-0.5"}`} />
                </button>

                {/* Logs */}
                <button onClick={() => handleOpenLog(sch)}
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#E5E7EB] text-[#637083] hover:bg-gray-50">
                  Logs
                </button>

                {/* Edit */}
                <button onClick={() => handleEdit(sch)}
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#E5E7EB] text-[#637083] hover:bg-gray-50">
                  Edit
                </button>

                {/* Delete */}
                <button onClick={() => handleDelete(sch.id)}
                  className="ml-auto px-2 py-1 text-[10px] font-medium rounded border border-red-200 text-red-500 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form Modal */}
      <ScheduleFormModal
        open={formOpen} onOpenChange={setFormOpen}
        roomId={roomId} selections={selections} devices={devices}
        editingSchedule={editingSchedule} onDone={fetchSchedules}
        hideColorBrightness={hideColorBrightness}
      />

      {/* Log Modal */}
      <ScheduleLogModal
        open={logOpen} onOpenChange={setLogOpen}
        scheduleId={logTarget.id} scheduleName={logTarget.name}
      />
    </div>
  );
}
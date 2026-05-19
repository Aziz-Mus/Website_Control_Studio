import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  ON: "bg-[#10B981] text-white",
  OFF: "bg-[#9CA3AF] text-white",
  EXECUTE: "bg-[#3B82F6] text-white",
  FAILED: "bg-[#EF4444] text-white",
  SKIPPED: "bg-[#F59E0B] text-white",
};

export default function ScheduleLogModal({ open, onOpenChange, scheduleId, scheduleName }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && scheduleId) {
      setLoading(true);
      axios.get(`${API}/schedules/${scheduleId}/logs`)
        .then(r => setLogs(r.data || []))
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    }
  }, [open, scheduleId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Work Sans, sans-serif" }}>
            Logs: {scheduleName || "Schedule"}
          </DialogTitle>
          <DialogDescription>Last 10 execution records.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading && <p className="text-xs text-[#637083] text-center py-4">Loading...</p>}
          {!loading && logs.length === 0 && <p className="text-xs text-[#637083] text-center py-4">No logs yet.</p>}
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-3 bg-[#FAFAFA] rounded-md border border-[#E5E7EB]">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[log.status] || "bg-gray-200 text-gray-600"}`}>
                {log.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#637083]">{log.executed_at ? new Date(log.executed_at).toLocaleString("id-ID") : "-"}</p>
                <p className="text-xs text-[#1C2025] mt-0.5 truncate">{log.details || "-"}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
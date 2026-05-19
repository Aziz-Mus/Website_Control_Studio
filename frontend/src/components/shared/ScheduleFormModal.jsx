import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

const COLOR_PRESETS = [
  "#FF0000", "#FF4500", "#FF8C00", "#FFD700", "#FFFF00",
  "#00FF00", "#00CED1", "#00BFFF", "#0000FF", "#8A2BE2",
  "#FF00FF", "#FF1493", "#FFFFFF", "#808080", "#000000",
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export default function ScheduleFormModal({ open, onOpenChange, roomId, selections, devices, editingSchedule, onDone }) {
  const [name, setName] = useState("");
  const [hour, setHour] = useState("18");
  const [minute, setMinute] = useState("00");
  const [selectedDays, setSelectedDays] = useState([]);
  const [action, setAction] = useState("on");
  const [targetType, setTargetType] = useState("all");
  const [targetId, setTargetId] = useState("");
  const [brightness, setBrightness] = useState(80);
  const [rgb, setRgb] = useState([255, 255, 255]);
  const [hexInput, setHexInput] = useState("#FFFFFF");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name || "");
      const [h, m] = (editingSchedule.time || "18:00").split(":");
      setHour(h);
      setMinute(m);
      setSelectedDays(editingSchedule.days || []);
      setAction(editingSchedule.action || "on");
      setTargetType(editingSchedule.target_type || "all");
      setTargetId(editingSchedule.target_id || "");
      setBrightness(editingSchedule.brightness ?? 80);
      const r = editingSchedule.rgb || [255, 255, 255];
      setRgb(r);
      setHexInput(rgbToHex(r[0], r[1], r[2]));
    } else {
      setName(""); setHour("18"); setMinute("00"); setSelectedDays([]);
      setAction("on"); setTargetType("all"); setTargetId(""); setBrightness(80);
      setRgb([255, 255, 255]); setHexInput("#FFFFFF");
    }
  }, [editingSchedule, open]);

  const toggleDay = (d) => setSelectedDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const handlePresetColor = (color) => {
    const [r, g, b] = hexToRgb(color);
    setRgb([r, g, b]);
    setHexInput(color);
  };

  const handleHexChange = (val) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setRgb(hexToRgb(val));
    }
  };

  const handleRgbChange = (i, val) => {
    const n = [...rgb];
    n[i] = Math.max(0, Math.min(255, Number(val) || 0));
    setRgb(n);
    setHexInput(rgbToHex(n[0], n[1], n[2]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !selectedDays.length) { toast.error("Name and at least 1 day required"); return; }
    setSaving(true);
    const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
    const payload = {
      room_id: roomId, name: name.trim(), time, days: selectedDays, action,
      target_type: targetType, target_id: targetId || null,
      brightness: action === "on" ? brightness : null,
      rgb: action === "on" ? rgb : null,
    };
    try {
      if (editingSchedule) {
        await axios.put(`${API}/schedules/${editingSchedule.id}`, payload);
        toast.success("Schedule updated");
      } else {
        await axios.post(`${API}/schedules`, payload);
        toast.success("Schedule created");
      }
      onDone?.();
      onOpenChange(false);
    } catch { toast.error("Failed to save schedule"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Work Sans, sans-serif" }}>
            {editingSchedule ? "Edit Schedule" : "Add Schedule"}
          </DialogTitle>
          <DialogDescription>Configure automated on/off schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Schedule Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Evening Lights" required />
          </div>

          {/* Time */}
          <div className="space-y-1">
            <Label className="text-xs">Time (24h)</Label>
            <div className="flex gap-2">
              <Input type="number" min="0" max="23" value={hour} onChange={e => setHour(e.target.value)} className="w-20 text-center" />
              <span className="self-center text-lg font-bold">:</span>
              <Input type="number" min="0" max="59" value={minute} onChange={e => setMinute(e.target.value)} className="w-20 text-center" />
            </div>
          </div>

          {/* Days */}
          <div className="space-y-1">
            <Label className="text-xs">Days</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`w-9 h-9 rounded-full text-[10px] font-semibold border transition-all ${selectedDays.includes(d)
                    ? "bg-[#DA2C38] text-white border-[#DA2C38]" : "bg-white text-[#637083] border-[#E5E7EB] hover:border-[#DA2C38]"}`}>
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <div className="flex gap-2">
              {["on", "off"].map(a => (
                <button key={a} type="button" onClick={() => setAction(a)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md border transition-all ${action === a
                    ? a === "on" ? "bg-[#DA2C38] text-white border-[#DA2C38]" : "bg-[#1C2025] text-white border-[#1C2025]"
                    : "bg-white text-[#637083] border-[#E5E7EB]"}`}>
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div className="space-y-1">
            <Label className="text-xs">Target</Label>
            <select value={targetType} onChange={e => { setTargetType(e.target.value); setTargetId(""); }}
              className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm">
              <option value="all">All Devices</option>
              <option value="selection">Saved Selection</option>
              <option value="device">Single Device</option>
            </select>
            {targetType === "selection" && (
              <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm mt-1">
                <option value="">-- Select --</option>
                {(selections || []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            )}
            {targetType === "device" && (
              <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm mt-1">
                <option value="">-- Select --</option>
                {(devices || []).map(d => <option key={d.id || d.kode} value={d.id || d.kode}>{d.nama || d.name}</option>)}
              </select>
            )}
          </div>

          {/* Brightness + Color (only if action=on) */}
          {action === "on" && (
            <div className="space-y-3">
              {/* Brightness */}
              <div className="space-y-1">
                <Label className="text-xs">Brightness: {brightness}%</Label>
                <input type="range" min="0" max="100" value={brightness} onChange={e => setBrightness(Number(e.target.value))}
                  className="w-full accent-[#DA2C38]" />
              </div>

              {/* Color Presets */}
              <div className="space-y-1">
                <Label className="text-xs">Color Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button key={color} type="button" onClick={() => handlePresetColor(color)}
                      title={color}
                      className={`w-7 h-7 rounded-md border-2 transition-all ${hexInput.toUpperCase() === color.toUpperCase()
                        ? "border-[#DA2C38] scale-110 shadow-md" : "border-[#E5E7EB] hover:border-[#DA2C38]"}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>

              {/* Hex Input + Preview */}
              <div className="space-y-1">
                <Label className="text-xs">Hex Color</Label>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-md border border-[#E5E7EB] flex-shrink-0"
                    style={{ backgroundColor: `rgb(${rgb.join(",")})` }} />
                  <Input value={hexInput} onChange={e => handleHexChange(e.target.value)}
                    placeholder="#FF0000" className="flex-1 font-mono text-sm" />
                </div>
              </div>

              {/* RGB Inputs */}
              <div className="space-y-1">
                <Label className="text-xs">RGB Values</Label>
                <div className="flex gap-2">
                  {["R", "G", "B"].map((c, i) => (
                    <div key={c} className="flex-1">
                      <span className="text-[10px] text-[#637083]">{c}</span>
                      <Input type="number" min="0" max="255" value={rgb[i]}
                        onChange={e => handleRgbChange(i, e.target.value)}
                        className="text-center text-sm h-8" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-md">Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md">
              {saving ? "Saving..." : editingSchedule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
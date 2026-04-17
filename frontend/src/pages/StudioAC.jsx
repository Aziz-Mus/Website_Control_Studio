import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Snowflake, Trash2, Power, Sun, Thermometer, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUS_KEY = "ac_device_statuses";
const TEMP_KEY = "ac_device_temps";
const TEMP_MIN = 16;
const TEMP_MAX = 30;

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function TempStepper({ value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(TEMP_MIN, value - 1))} disabled={disabled || value <= TEMP_MIN}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#E5E7EB] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-[#3B82F6] transition-colors">
        <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
      <span className="text-xs font-semibold text-[#1C2025] min-w-[38px] text-center">{value}°C</span>
      <button type="button" onClick={() => onChange(Math.min(TEMP_MAX, value + 1))} disabled={disabled || value >= TEMP_MAX}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#E5E7EB] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-[#3B82F6] transition-colors">
        <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function StudioAC() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState({});  // keyed by acCode for individual loads
  const [allLoading, setAllLoading] = useState(false);

  // Persistent states
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STATUS_KEY, {}));
  const [deviceTemps, setDeviceTemps] = useState(() => loadStorage(TEMP_KEY, {}));
  const [lastTemps, setLastTemps] = useState({});
  const [tempLoading, setTempLoading] = useState({});
  const [masterTemp, setMasterTemp] = useState(24);
  const [masterTempLoading, setMasterTempLoading] = useState(false);

  useEffect(() => { localStorage.setItem(STATUS_KEY, JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(TEMP_KEY, JSON.stringify(deviceTemps)); }, [deviceTemps]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/ac/devices`);
      const devs = res.data.devices || [];
      setDevices(devs);
      // Init lastTemps from storage data
      const lt = {};
      const savedTemps = loadStorage(TEMP_KEY, {});
      devs.forEach(d => {
        lt[d.acCode] = d.lastTemperature || 24;
        if (savedTemps[d.acCode] === undefined) savedTemps[d.acCode] = d.lastTemperature || 24;
      });
      setLastTemps(lt);
      setDeviceTemps(prev => ({ ...savedTemps, ...prev }));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const openAdd = () => { setEditingDevice(null); setDeviceName(""); setDeviceIp(""); setDialogOpen(true); };
  const openEdit = (dev) => { setEditingDevice(dev); setDeviceName(dev.deviceName); setDeviceIp(dev.ip); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!deviceName.trim() || !deviceIp.trim()) return; setSaving(true);
    try {
      if (editingDevice) {
        await axios.put(`${API}/studio/ac/devices/${editingDevice.acCode}`, { deviceName: deviceName.trim(), ip: deviceIp.trim() });
        toast.success("Device updated");
      } else {
        await axios.post(`${API}/studio/ac/devices`, { deviceName: deviceName.trim(), ip: deviceIp.trim() });
        toast.success(`"${deviceName}" added`);
      }
      await fetchDevices(); setDialogOpen(false);
    } catch (e) { toast.error("Failed to save device"); }
    setSaving(false);
  };

  const handleDelete = async (acCode) => {
    try {
      await axios.delete(`${API}/studio/ac/devices/${acCode}`);
      toast.success("Device deleted");
      setDeviceStatuses(p => { const n = { ...p }; delete n[acCode]; return n; });
      setDeviceTemps(p => { const n = { ...p }; delete n[acCode]; return n; });
      setLastTemps(p => { const n = { ...p }; delete n[acCode]; return n; });
      await fetchDevices();
    } catch (e) { toast.error("Failed to delete"); }
  };

  // Control single device
  const controlDevice = async (dev, power) => {
    setLoading(p => ({ ...p, [dev.acCode]: true }));
    try {
      const res = await axios.post(`${API}/studio/ac/control`, { acCode: dev.acCode, power });
      const st = res.data.status === "success" ? power.toLowerCase() : "failed";
      setDeviceStatuses(p => ({ ...p, [dev.acCode]: st }));
      if (st === "failed") toast.error(`"${dev.deviceName}" failed`);
      else toast.success(`"${dev.deviceName}" ${power === "ON" ? "turned on" : "turned off"}`);
    } catch (e) {
      setDeviceStatuses(p => ({ ...p, [dev.acCode]: "failed" }));
      toast.error("Control failed");
    }
    setLoading(p => ({ ...p, [dev.acCode]: false }));
  };

  // Control ALL devices
  const controlAll = async (power) => {
    if (!devices.length) return; setAllLoading(true);
    try {
      const res = await axios.post(`${API}/studio/ac/control/all`, { power });
      const ns = {};
      (res.data.results || []).forEach(r => { ns[r.acCode] = r.status === "success" ? power.toLowerCase() : "failed"; });
      setDeviceStatuses(p => ({ ...p, ...ns }));
      const fc = res.data.summary?.failed || 0;
      const sc = res.data.summary?.success || 0;
      if (fc > 0 && sc > 0) toast.warning(`${sc} succeeded, ${fc} AC(s) failed`);
      else if (fc > 0) toast.error(`${fc} AC(s) failed`);
      else toast.success(`All ACs ${power === "ON" ? "turned on" : "turned off"}`);
    } catch (e) { toast.error("Control failed"); }
    setAllLoading(false);
  };

  // Set temperature for single device
  const handleApplyTemp = async (dev) => {
    const temp = deviceTemps[dev.acCode] ?? lastTemps[dev.acCode] ?? 24;
    const prevTemp = lastTemps[dev.acCode] ?? 24;
    setTempLoading(p => ({ ...p, [dev.acCode]: true }));
    try {
      const res = await axios.post(`${API}/studio/ac/temperature`, { acCode: dev.acCode, temperature: temp });
      if (res.data.status === "success") {
        setLastTemps(p => ({ ...p, [dev.acCode]: temp }));
        toast.success(`"${dev.deviceName}" set to ${temp}°C`);
      } else {
        setDeviceTemps(p => ({ ...p, [dev.acCode]: prevTemp }));
        toast.error(`Failed to set temperature for "${dev.deviceName}"`);
      }
    } catch (e) {
      setDeviceTemps(p => ({ ...p, [dev.acCode]: prevTemp }));
      toast.error("Failed to reach server");
    }
    setTempLoading(p => ({ ...p, [dev.acCode]: false }));
  };

  // Set temperature for ALL devices
  const handleApplyMasterTemp = async () => {
    if (!devices.length) return; setMasterTempLoading(true);
    try {
      const res = await axios.post(`${API}/studio/ac/temperature/all`, { temperature: masterTemp });
      const newTemps = { ...lastTemps };
      const newDevTemps = { ...deviceTemps };
      (res.data.results || []).forEach(r => {
        if (r.status === "success") { newTemps[r.acCode] = masterTemp; newDevTemps[r.acCode] = masterTemp; }
      });
      setLastTemps(newTemps); setDeviceTemps(newDevTemps);
      const sc = res.data.summary?.success || 0;
      const fc = res.data.summary?.failed || 0;
      if (fc > 0 && sc > 0) toast.warning(`${sc} succeeded, ${fc} AC(s) failed`);
      else if (fc > 0) toast.error(`Failed to set temperature for ${fc} AC(s)`);
      else toast.success(`All ACs set to ${masterTemp}°C`);
    } catch (e) { toast.error("Failed to reach server"); }
    setMasterTempLoading(false);
  };

  const onCount = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;
  const ms = devices.length === 0 ? "empty" : onCount === devices.length ? "all_active" : onCount > 0 || failedCount > 0 ? "partially_active" : "all_inactive";

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-ac-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-studio-btn">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Studio
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="studio-ac-title">Studio: AC Controls</h1>
            <p className="text-sm text-[#637083] mt-1">Manage and control all AC units. {devices.length} device(s) total.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" onClick={() => controlAll("ON")} disabled={allLoading || !devices.length} data-testid="ac-activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs" onClick={() => controlAll("OFF")} disabled={allLoading || !devices.length} data-testid="ac-deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider" style={{ fontFamily: 'Work Sans, sans-serif' }}>AC Device Grid</h2>
              <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-ac-btn">
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add AC
              </Button>
            </div>
            {devices.length === 0 ? (
              <div className="text-center py-16 text-[#637083]" data-testid="ac-devices-empty">
                <Snowflake className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
                <p className="text-sm">No AC devices added yet.</p>
                <p className="text-xs mt-1">Click "Add AC" to add a new device.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {devices.map((dev) => {
                  const st = deviceStatuses[dev.acCode] || "idle";
                  const bc = st === "on" ? "border-[#DA2C38]" : st === "failed" ? "border-[#F59E0B]" : "border-[#E5E7EB]";
                  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : "bg-blue-50";
                  const ic = st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : "text-[#3B82F6]";
                  const pendingTemp = deviceTemps[dev.acCode] ?? lastTemps[dev.acCode] ?? 24;
                  const confirmedTemp = lastTemps[dev.acCode] ?? dev.lastTemperature ?? 24;
                  const isTempLoading = tempLoading[dev.acCode] || false;
                  const isDevLoading = loading[dev.acCode] || false;
                  return (
                    <div key={dev.acCode} data-testid={`ac-device-${dev.acCode}`} className={`bg-white border-2 ${bc} rounded-md p-3 transition-all relative group`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`p-2 rounded-md ${bg}`}><Snowflake className={`w-5 h-5 ${ic}`} strokeWidth={1.5} /></div>
                        <div className="text-center w-full">
                          <p className="text-[10px] uppercase tracking-wider text-[#637083]">#{dev.acCode}</p>
                          <p className="text-xs font-medium text-[#1C2025] truncate" title={dev.deviceName}>{dev.deviceName}</p>
                          <p className="text-[10px] text-[#637083] truncate" title={dev.ip}>{dev.ip}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${st === "on" ? "bg-[#10B981]" : st === "failed" ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"}`} />
                          <span className={`text-[10px] font-medium ${st === "on" ? "text-[#10B981]" : st === "failed" ? "text-[#F59E0B]" : "text-[#637083]"}`}>
                            {st === "on" ? "ON" : st === "failed" ? "FAILED" : st === "off" ? "OFF" : "IDLE"}
                          </span>
                        </div>
                        <div className="flex gap-1 w-full">
                          <Button size="sm" className="flex-1 h-7 text-[10px] bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" onClick={() => controlDevice(dev, "ON")} disabled={isDevLoading} data-testid={`ac-on-${dev.acCode}`}>ON</Button>
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] rounded-md" onClick={() => controlDevice(dev, "OFF")} disabled={isDevLoading} data-testid={`ac-off-${dev.acCode}`}>OFF</Button>
                        </div>
                        <div className="w-full border-t border-[#F3F4F6] pt-2 space-y-1.5">
                          <TempStepper value={pendingTemp} onChange={(v) => setDeviceTemps(p => ({ ...p, [dev.acCode]: v }))} disabled={isTempLoading} />
                          <Button size="sm" className="w-full h-6 text-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-md" onClick={() => handleApplyTemp(dev)} disabled={isTempLoading} data-testid={`ac-apply-temp-${dev.acCode}`}>
                            {isTempLoading ? "..." : "Apply"}
                          </Button>
                          <div className="flex items-center justify-center gap-1">
                            <Thermometer className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
                            <span className="text-[9px] text-[#637083]">Last: {confirmedTemp}°C</span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-0.5 rounded hover:bg-blue-50" onClick={() => openEdit(dev)} data-testid={`edit-ac-${dev.acCode}`}><Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                        <button className="p-0.5 rounded hover:bg-red-50" onClick={() => handleDelete(dev.acCode)} data-testid={`delete-ac-${dev.acCode}`}><Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="lg:w-72 space-y-4">
            {/* Master Status */}
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="ac-master-status">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>Master AC Status</h3>
              <div className={`border rounded-md p-4 flex items-center gap-3 ${ms === "all_active" || ms === "partially_active" ? "border-[#DA2C38]" : "border-[#E5E7EB]"}`}>
                {ms === "all_inactive" || ms === "empty" ? <Power className="w-6 h-6 text-[#637083]" strokeWidth={1.5} /> : <Sun className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />}
                <div>
                  <p className={`text-sm font-semibold ${ms === "all_active" ? "text-[#10B981]" : ms === "partially_active" ? "text-[#DA2C38]" : "text-[#637083]"}`}>
                    {ms === "all_active" ? "ALL ACTIVE" : ms === "partially_active" ? "PARTIALLY ACTIVE" : ms === "empty" ? "NO DEVICES" : "ALL INACTIVE"}
                  </p>
                  <p className="text-xs text-[#637083]">{onCount} / {devices.length} Active</p>
                </div>
              </div>
              {failedCount > 0 && <div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B] font-medium">{failedCount} FAILED</span></div>}
            </div>

            {/* Master Temperature */}
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="ac-master-temp">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.5} />
                <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>Master Temperature</h3>
              </div>
              <p className="text-[10px] text-[#637083]">Set temperature for all AC devices at once</p>
              <div className="space-y-2">
                <TempStepper value={masterTemp} onChange={setMasterTemp} disabled={masterTempLoading || !devices.length} />
                <Button className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-md text-xs" onClick={handleApplyMasterTemp} disabled={masterTempLoading || !devices.length} data-testid="ac-apply-master-temp-btn">
                  {masterTempLoading ? "Applying..." : `Apply ${masterTemp}°C to All`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="ac-device-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{editingDevice ? "Edit AC Device" : "Add AC Device"}</DialogTitle>
            <DialogDescription>{editingDevice ? "Update the device name and IP address." : "Enter the device name and IP address of the AC controller."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Device Name</Label><Input data-testid="ac-device-name-input" placeholder="Meeting Room AC" value={deviceName} onChange={e => setDeviceName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>IP Address</Label><Input data-testid="ac-device-ip-input" placeholder="192.168.1.50" value={deviceIp} onChange={e => setDeviceIp(e.target.value)} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="ac-device-save-btn">{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

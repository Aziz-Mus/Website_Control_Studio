import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import NeonGrid from "@/components/shared/NeonGrid";
import ChromaControl from "@/components/shared/ChromaControl";
import MasterStatus from "@/components/shared/MasterStatus";
import AddLightDialog from "@/components/shared/AddLightDialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "showcase_device_statuses";
const SELECTED_KEY = "showcase_selected_ids";

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function ShowcaseRoom() {
  const [devices, setDevices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => loadStorage(SELECTED_KEY, []));
  const [brightness, setBrightness] = useState(255);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds)); }, [selectedIds]);

  const fetchDevices = useCallback(async () => {
    try { const res = await axios.get(`${API}/showcase/devices`); setDevices(res.data.devices || []); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleAdd = async ({ ip, nama }) => {
    try { await axios.post(`${API}/showcase/devices`, { ip, nama }); toast.success(`"${nama}" added`); fetchDevices(); } catch (e) { toast.error("Failed to add light"); }
  };
  const handleUpdate = async (kode, data) => {
    try { await axios.put(`${API}/showcase/devices/${kode}`, data); toast.success("Light updated"); fetchDevices(); } catch (e) { toast.error("Failed to update"); }
  };
  const handleDelete = async (kode) => {
    try {
      await axios.delete(`${API}/showcase/devices/${kode}`);
      toast.success("Light deleted");
      setSelectedIds(p => p.filter(id => id !== kode));
      setDeviceStatuses(p => { const n = { ...p }; delete n[kode]; return n; });
      fetchDevices();
    } catch (e) { toast.error("Failed to delete"); }
  };
  const handleEdit = (device) => { setEditingDevice(device); setDialogOpen(true); };
  const openAdd = () => { setEditingDevice(null); setDialogOpen(true); };
  const handleToggleSelect = (kode) => { setSelectedIds(p => p.includes(kode) ? p.filter(id => id !== kode) : [...p, kode]); };
  const handleSelectAll = () => { setSelectedIds(selectedIds.length === devices.length ? [] : devices.map(d => d.kode)); };

  const updateStatusesFromResponse = (report, action) => {
    const ns = {};
    report.forEach(d => { ns[d.kode] = d.status === "success" ? action : "failed"; });
    setDeviceStatuses(p => ({ ...p, ...ns }));
    const failedCount = report.filter(d => d.status !== "success").length;
    const successCount = report.filter(d => d.status === "success").length;
    if (failedCount > 0 && successCount > 0) toast.warning(`${successCount} succeeded, ${failedCount} failed`);
    else if (failedCount > 0) toast.error(`${failedCount} light(s) failed`);
    else toast.success("All lights successful");
  };

  const handleApplyColor = async ({ rgb, brightness: br }) => {
    if (!devices.length) { toast.error("No lights configured"); return; }
    setLoading(true);
    const payload = { Warna: { Red: rgb.r, Green: rgb.g, Blue: rgb.b }, Kecerahan: br || brightness };
    try {
      if (selectedIds.length > 0 && selectedIds.length < devices.length) {
        const results = await Promise.allSettled(selectedIds.map(kode => axios.post(`${API}/showcase/lampu`, { ...payload, KodeLampu: kode })));
        const ns = {};
        results.forEach((r, i) => { ns[selectedIds[i]] = r.status === "fulfilled" && r.value.data.status === "success" ? "on" : "failed"; });
        setDeviceStatuses(p => ({ ...p, ...ns }));
        const fc = Object.values(ns).filter(s => s === "failed").length;
        const sc = Object.values(ns).filter(s => s === "on").length;
        if (fc > 0 && sc > 0) toast.warning(`${sc} succeeded, ${fc} failed`);
        else if (fc > 0) toast.error(`${fc} light(s) failed`);
        else toast.success(`Applied to ${selectedIds.length} light(s)`);
      } else {
        const res = await axios.post(`${API}/showcase/lampu`, payload);
        if (res.data.devices) updateStatusesFromResponse(res.data.devices, "on");
        else toast.success("Applied to all lights");
      }
    } catch (e) { toast.error("Failed to reach server"); }
    setLoading(false);
  };

  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const res = await axios.post(`${API}/showcase/lampu`, { Warna: { Red: 255, Green: 255, Blue: 255 }, Kecerahan: brightness });
      if (res.data.devices) updateStatusesFromResponse(res.data.devices, "on");
      else toast.success("All lights turned on");
    } catch (e) { toast.error("Failed to reach server"); }
    setLoading(false);
  };

  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const res = await axios.post(`${API}/showcase/turn-off`);
      if (res.data.devices) updateStatusesFromResponse(res.data.devices, "off");
      else {
        const ao = {}; devices.forEach(d => { ao[d.kode] = "off"; });
        setDeviceStatuses(p => ({ ...p, ...ao }));
        toast.success("All lights turned off");
      }
    } catch (e) { toast.error("Failed to reach server"); }
    setLoading(false);
  };

  const onCount = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="showcase-room-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="showcase-title">Showcase Room</h1>
            <p className="text-sm text-[#637083] mt-1">Managing {devices.length} neon module(s).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" onClick={handleActivateAll} disabled={loading} data-testid="activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs" onClick={handleDeactivateAll} disabled={loading} data-testid="deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider" style={{ fontFamily: 'Work Sans, sans-serif' }}>Module Grid</h2>
              <div className="flex gap-2">
                {devices.length > 0 && <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs" data-testid="select-all-btn">{selectedIds.length === devices.length ? "Deselect All" : "Select All"}</Button>}
                <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-light-btn"><Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Light</Button>
              </div>
            </div>
            <NeonGrid devices={devices} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onDelete={handleDelete} onEdit={handleEdit} deviceStatuses={deviceStatuses} />
          </div>
          <div className="lg:w-80 space-y-4">
            <ChromaControl onApply={handleApplyColor} selectedCount={selectedIds.length} brightness={brightness} onBrightnessChange={setBrightness} />
            <MasterStatus total={devices.length} onCount={onCount} failedCount={failedCount} />
          </div>
        </div>
      </div>
      <AddLightDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={handleAdd} editingDevice={editingDevice} onUpdate={handleUpdate} />
    </div>
  );
}

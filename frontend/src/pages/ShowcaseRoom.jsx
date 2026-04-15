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

export default function ShowcaseRoom() {
  const [devices, setDevices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [brightness, setBrightness] = useState(255);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState({});

  const fetchDevices = useCallback(async () => {
    try { const res = await axios.get(`${API}/showcase/devices`); setDevices(res.data.devices || []); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleAdd = async ({ ip, nama }) => {
    try { await axios.post(`${API}/showcase/devices`, { ip, nama }); toast.success(`"${nama}" ditambahkan`); fetchDevices(); } catch (e) { toast.error("Gagal"); }
  };
  const handleUpdate = async (kode, data) => {
    try { await axios.put(`${API}/showcase/devices/${kode}`, data); toast.success("Diupdate"); fetchDevices(); } catch (e) { toast.error("Gagal"); }
  };
  const handleDelete = async (kode) => {
    try { await axios.delete(`${API}/showcase/devices/${kode}`); toast.success("Dihapus"); setSelectedIds(p => p.filter(id => id !== kode)); setDeviceStatuses(p => { const n={...p}; delete n[kode]; return n; }); fetchDevices(); } catch (e) { toast.error("Gagal"); }
  };
  const handleEdit = (device) => { setEditingDevice(device); setDialogOpen(true); };
  const openAdd = () => { setEditingDevice(null); setDialogOpen(true); };
  const handleToggleSelect = (kode) => { setSelectedIds(p => p.includes(kode) ? p.filter(id => id !== kode) : [...p, kode]); };
  const handleSelectAll = () => { setSelectedIds(selectedIds.length === devices.length ? [] : devices.map(d => d.kode)); };

  const updateStatusesFromResponse = (report, action) => {
    const ns = {}; report.forEach(d => { ns[d.kode] = d.status === "success" ? action : "failed"; }); setDeviceStatuses(p => ({ ...p, ...ns }));
  };

  const handleApplyColor = async ({ rgb, brightness: br }) => {
    if (!devices.length) { toast.error("Tidak ada lampu"); return; }
    setLoading(true);
    const payload = { Warna: { Red: rgb.r, Green: rgb.g, Blue: rgb.b }, Kecerahan: br || brightness };
    try {
      if (selectedIds.length > 0 && selectedIds.length < devices.length) {
        const results = await Promise.allSettled(selectedIds.map(kode => axios.post(`${API}/showcase/lampu`, { ...payload, KodeLampu: kode })));
        const ns = {}; results.forEach((r, i) => { ns[selectedIds[i]] = r.status === "fulfilled" && r.value.data.status === "success" ? "on" : "failed"; }); setDeviceStatuses(p => ({ ...p, ...ns }));
        toast.success(`Diterapkan ke ${selectedIds.length} lampu`);
      } else {
        const res = await axios.post(`${API}/showcase/lampu`, payload);
        if (res.data.devices) updateStatusesFromResponse(res.data.devices, "on");
        toast.success("Diterapkan ke semua lampu");
      }
    } catch (e) { toast.error("Gagal"); }
    setLoading(false);
  };

  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try { const res = await axios.post(`${API}/showcase/lampu`, { Warna: { Red: 255, Green: 255, Blue: 255 }, Kecerahan: brightness }); if (res.data.devices) updateStatusesFromResponse(res.data.devices, "on"); toast.success("Semua lampu dinyalakan"); } catch (e) { toast.error("Gagal"); }
    setLoading(false);
  };
  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try { const res = await axios.post(`${API}/showcase/turn-off`); if (res.data.devices) updateStatusesFromResponse(res.data.devices, "off"); else { const ao = {}; devices.forEach(d => { ao[d.kode] = "off"; }); setDeviceStatuses(p => ({ ...p, ...ao })); } toast.success("Semua lampu dimatikan"); } catch (e) { toast.error("Gagal"); }
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
            <p className="text-sm text-[#637083] mt-1">Managing {devices.length} neon modules.</p>
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

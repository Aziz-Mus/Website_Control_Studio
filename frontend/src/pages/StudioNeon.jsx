import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, List, Grid3X3, Settings2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import DeviceModuleGrid from "@/components/shared/DeviceModuleGrid";
import ChromaControl from "@/components/shared/ChromaControl";
import MasterStatus from "@/components/shared/MasterStatus";
import AddLightDialog from "@/components/shared/AddLightDialog";
import GridConfigDialog from "@/components/shared/GridConfigDialog";
import SavedSelectionPanel from "@/components/shared/SavedSelectionPanel";

const API  = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE = `${API}/studio/neon`;
const STORAGE_KEY  = "studio_neon_device_statuses";
const SELECTED_KEY = "studio_neon_selected_ids";
const VIEW_KEY     = "studio_neon_view_mode";
const GRIDMODE_KEY = "studio_neon_grid_mode";

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function StudioNeon() {
  const navigate = useNavigate();

  const [devices, setDevices]               = useState([]);
  const [selectedIds, setSelectedIds]       = useState(() => loadStorage(SELECTED_KEY, []));
  const [brightness, setBrightness]         = useState(255);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editingDevice, setEditingDevice]   = useState(null);
  const [loading, setLoading]               = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));

  const [viewMode, setViewMode]           = useState(() => loadStorage(VIEW_KEY, "list"));
  const [gridConfig, setGridConfig]       = useState({ cols: 4, rows: 5 });
  const [gridLayout, setGridLayout]       = useState({});
  const [gridMode, setGridMode]           = useState(() => loadStorage(GRIDMODE_KEY, "control"));
  const [configOpen, setConfigOpen]       = useState(false);
  const [pendingCellIdx, setPendingCellIdx] = useState(null);
  const [savedSelections, setSavedSel]    = useState([]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY,  JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds)); },   [selectedIds]);
  useEffect(() => { localStorage.setItem(VIEW_KEY,     viewMode); },                       [viewMode]);
  useEffect(() => { localStorage.setItem(GRIDMODE_KEY, gridMode); },                       [gridMode]);

  const fetchDevices = useCallback(async () => {
    try { const r = await axios.get(`${BASE}/devices`); setDevices(r.data.devices || []); } catch {}
  }, []);

  const fetchGridLayout = useCallback(async () => {
    try {
      const r = await axios.get(`${BASE}/grid-layout`);
      setGridConfig({ cols: r.data.cols, rows: r.data.rows });
      setGridLayout(r.data.cells || {});
    } catch {}
  }, []);

  const fetchSavedSel = useCallback(async () => {
    try { const r = await axios.get(`${BASE}/saved-selections`); setSavedSel(r.data || []); } catch {}
  }, []);

  useEffect(() => { fetchDevices(); fetchGridLayout(); fetchSavedSel(); }, [fetchDevices, fetchGridLayout, fetchSavedSel]);

  /* ── Device CRUD ──────────────────────────────────────────────────────── */
  const handleAdd = async ({ ip, nama }) => {
    try {
      const r = await axios.post(`${BASE}/devices`, { ip, nama });
      toast.success(`"${nama}" added`);
      await fetchDevices();
      if (pendingCellIdx !== null && r.data.device) {
        const newLayout = { ...gridLayout, [String(pendingCellIdx)]: r.data.device.kode };
        setGridLayout(newLayout);
        await axios.put(`${BASE}/grid-layout`, { ...gridConfig, cells: newLayout });
        setPendingCellIdx(null);
      }
    } catch { toast.error("Failed to add"); }
  };

  const handleUpdate = async (kode, data) => {
    try { await axios.put(`${BASE}/devices/${kode}`, data); toast.success("Updated"); fetchDevices(); }
    catch { toast.error("Failed"); }
  };

  const handleDelete = async (kode) => {
    try {
      await axios.delete(`${BASE}/devices/${kode}`);
      toast.success("Deleted");
      setSelectedIds(p => p.filter(id => id !== kode));
      setDeviceStatuses(p => { const n = { ...p }; delete n[kode]; return n; });
      const newLayout = Object.fromEntries(Object.entries(gridLayout).filter(([, v]) => v !== kode));
      setGridLayout(newLayout);
      await axios.put(`${BASE}/grid-layout`, { ...gridConfig, cells: newLayout });
      fetchDevices();
    } catch { toast.error("Failed"); }
  };

  const handleEdit         = d  => { setEditingDevice(d); setDialogOpen(true); };
  const openAdd            = () => { setEditingDevice(null); setPendingCellIdx(null); setDialogOpen(true); };
  const handleToggleSelect = k  => setSelectedIds(p => p.includes(k) ? p.filter(id => id !== k) : [...p, k]);
  const handleSelectAll    = () => setSelectedIds(selectedIds.length === devices.length ? [] : devices.map(d => d.kode));

  /* ── Grid Layout ──────────────────────────────────────────────────────── */
  const handleLayoutChange = async (newLayout) => {
    setGridLayout(newLayout);
    try { await axios.put(`${BASE}/grid-layout`, { ...gridConfig, cells: newLayout }); } catch {}
  };

  const handleGridConfigConfirm = async ({ cols, rows }) => {
    const newConfig = { cols, rows };
    const newLayout = {};
    devices.forEach((d, i) => { if (i < cols * rows) newLayout[String(i)] = d.kode; });
    setGridConfig(newConfig); setGridLayout(newLayout);
    try { await axios.put(`${BASE}/grid-layout`, { ...newConfig, cells: newLayout }); } catch {}
  };

  /* ── Saved Selections ─────────────────────────────────────────────────── */
  const handleSaveSel   = async (name, kodes) => {
    try { await axios.post(`${BASE}/saved-selections`, { name, kodes }); toast.success(`"${name}" saved`); fetchSavedSel(); }
    catch { toast.error("Failed to save"); }
  };
  const handleDeleteSel = async (id) => { try { await axios.delete(`${BASE}/saved-selections/${id}`); fetchSavedSel(); } catch {} };
  const handleApplySel  = sel => {
    const valid = (sel.kodes || []).filter(k => devices.some(d => d.kode === k));
    setSelectedIds(valid);
    toast.success(`"${sel.name}" applied — ${valid.length} selected`);
  };

  /* ── Light Control ────────────────────────────────────────────────────── */
  const updateFromResponse = (report, action) => {
    const ns = {};
    report.forEach(d => { ns[d.kode] = d.status === "success" ? action : "failed"; });
    setDeviceStatuses(p => ({ ...p, ...ns }));
    const fc = report.filter(d => d.status !== "success").length;
    const sc = report.filter(d => d.status === "success").length;
    if (fc > 0 && sc > 0) toast.warning(`${sc} ok, ${fc} failed`);
    else if (fc > 0) toast.error(`${fc} failed`);
    else toast.success("All lights successful");
  };

  const handleApplyColor = async ({ rgb, brightness: br, sceneId }) => {
    if (!devices.length) return; setLoading(true);
    const payload = sceneId
      ? { SceneId: sceneId, Kecerahan: br || brightness }
      : { Warna: { Red: rgb.r, Green: rgb.g, Blue: rgb.b }, Kecerahan: br || brightness };
    try {
      if (selectedIds.length > 0 && selectedIds.length < devices.length) {
        const results = await Promise.allSettled(selectedIds.map(k => axios.post(`${BASE}/lampu`, { ...payload, KodeLampu: k })));
        const ns = {};
        results.forEach((r, i) => { ns[selectedIds[i]] = r.status === "fulfilled" && r.value.data.status === "success" ? "on" : "failed"; });
        setDeviceStatuses(p => ({ ...p, ...ns }));
        const fc = Object.values(ns).filter(s => s === "failed").length;
        if (fc > 0) toast.warning(`${selectedIds.length - fc} ok, ${fc} failed`);
        else toast.success(`Applied to ${selectedIds.length} light(s)`);
      } else {
        const res = await axios.post(`${BASE}/lampu`, payload);
        if (res.data.devices) updateFromResponse(res.data.devices, "on");
        else toast.success("Applied to all");
      }
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try { const r = await axios.post(`${BASE}/lampu`, { Warna: { Red: 255, Green: 255, Blue: 255 }, Kecerahan: brightness }); if (r.data.devices) updateFromResponse(r.data.devices, "on"); } catch { toast.error("Failed"); }
    setLoading(false);
  };
  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const r = await axios.post(`${BASE}/turn-off`);
      if (r.data.devices) updateFromResponse(r.data.devices, "off");
      else { const ao = {}; devices.forEach(d => { ao[d.kode] = "off"; }); setDeviceStatuses(p => ({ ...p, ...ao })); toast.success("All off"); }
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  const onCount     = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-neon-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio")}
          className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors"
          data-testid="back-to-studio-btn">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Studio
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]"
              style={{ fontFamily: "Work Sans, sans-serif" }} data-testid="studio-neon-title">
              Studio: Neon Controls
            </h1>
            <p className="text-sm text-[#637083] mt-1">Managing {devices.length} neon node(s).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs"
              onClick={handleActivateAll} disabled={loading} data-testid="studio-activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs"
              onClick={handleDeactivateAll} disabled={loading} data-testid="studio-deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Module Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider"
                style={{ fontFamily: "Work Sans, sans-serif" }}>Module Grid</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View toggle */}
                <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                  {[["list","List",List],["grid","Grid",Grid3X3]].map(([mode,label,Icon]) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors
                        ${viewMode===mode ? "bg-[#DA2C38] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
                {/* Grid-only controls */}
                {viewMode === "grid" && <>
                  <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                    {[["edit","Edit",Pencil],["control","Control",Check]].map(([mode,label,Icon]) => (
                      <button key={mode} onClick={() => setGridMode(mode)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors
                          ${gridMode===mode ? "bg-[#1C2025] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)} className="rounded-md text-xs border-[#E5E7EB]">
                    <Settings2 className="w-3.5 h-3.5 mr-1" />{gridConfig.cols}×{gridConfig.rows}
                  </Button>
                </>}
                {devices.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs" data-testid="studio-select-all-btn">
                    {selectedIds.length === devices.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
                <Button size="sm" onClick={openAdd}
                  className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="studio-add-light-btn">
                  <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Light
                </Button>
              </div>
            </div>

            <DeviceModuleGrid
              devices={devices} selectedIds={selectedIds} deviceStatuses={deviceStatuses}
              viewMode={viewMode} gridConfig={gridConfig} gridLayout={gridLayout} gridMode={gridMode}
              onToggleSelect={handleToggleSelect} onDelete={handleDelete} onEdit={handleEdit}
              onAddAtCell={idx => { setPendingCellIdx(idx); setEditingDevice(null); setDialogOpen(true); }}
              onLayoutChange={handleLayoutChange}
            />
          </div>

          {/* Right: Control + Status + Saved Selections */}
          <div className="lg:w-80 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <ChromaControl onApply={handleApplyColor} selectedCount={selectedIds.length}
              brightness={brightness} onBrightnessChange={setBrightness} />
            <MasterStatus total={devices.length} onCount={onCount} failedCount={failedCount} />
            <SavedSelectionPanel selections={savedSelections} selectedIds={selectedIds}
              onSave={handleSaveSel} onApply={handleApplySel} onDelete={handleDeleteSel} />
          </div>
        </div>
      </div>

      <AddLightDialog open={dialogOpen} onOpenChange={setDialogOpen}
        onAdd={handleAdd} editingDevice={editingDevice} onUpdate={handleUpdate} />
      <GridConfigDialog open={configOpen} onOpenChange={setConfigOpen}
        initial={gridConfig} onConfirm={handleGridConfigConfirm} />
    </div>
  );
}

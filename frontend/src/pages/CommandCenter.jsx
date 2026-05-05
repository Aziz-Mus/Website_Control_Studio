import { useState, useEffect, useCallback } from "react";
import { Plus, List, Grid3X3, Settings2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

import AddLightDialog from "@/components/shared/AddLightDialog";
import DeviceModuleGrid from "@/components/shared/DeviceModuleGrid";
import GridConfigDialog from "@/components/shared/GridConfigDialog";
import SavedSelectionPanel from "@/components/shared/SavedSelectionPanel";
import ChromaControl from "@/components/shared/ChromaControl";
import MasterStatus from "@/components/shared/MasterStatus";
import ControlPanel from "@/components/command-center/ControlPanel";

const API  = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE = `${API}/command-center`;

const STORAGE_KEY  = "cc_device_statuses";
const SELECTED_KEY = "cc_selected_ids";
const VIEW_KEY     = "cc_view_mode";
const GRIDMODE_KEY = "cc_grid_mode";

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function CommandCenter() {
  // ── Devices & selection ───────────────────────────────────────────────────
  const [devices, setDevices]             = useState([]);
  const [selectedIds, setSelectedIds]     = useState(() => loadStorage(SELECTED_KEY, []));
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));
  const [loading, setLoading]             = useState(false);

  // ── View mode ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode]       = useState(() => loadStorage(VIEW_KEY, "list"));
  const [gridConfig, setGridConfig]   = useState({ cols: 4, rows: 5 });
  const [gridLayout, setGridLayout]   = useState({});
  const [gridMode, setGridMode]       = useState(() => loadStorage(GRIDMODE_KEY, "control"));
  const [configOpen, setConfigOpen]   = useState(false);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [pendingCellIdx, setPendingCellIdx] = useState(null);

  // ── CC extra: presets, animations, saved selections ───────────────────────
  const [presets, setPresets]           = useState([]);
  const [savedSelections, setSavedSel]  = useState([]);
  const [controlTab, setControlTab]     = useState("Color");
  const [brightness, setBrightness]     = useState(200);
  // Track current color picked by AdvancedColorPicker (updated on every picker change)
  const [currentColor, setCurrentColor] = useState({ rgb: [218,44,56], mode: "solid" });
  const [animState, setAnimState]       = useState({ running: false });
  const [animations, setAnimations]     = useState([]);

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds)); }, [selectedIds]);
  useEffect(() => { localStorage.setItem(VIEW_KEY, viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem(GRIDMODE_KEY, gridMode); }, [gridMode]);

  // ── Fetch devices ─────────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try { const r = await axios.get(`${BASE}/devices`); setDevices(r.data.devices || []); } catch (e) { console.error(e); }
  }, []);

  // ── Fetch grid layout ─────────────────────────────────────────────────────
  const fetchGridLayout = useCallback(async () => {
    try {
      const r = await axios.get(`${BASE}/grid-layout`);
      setGridConfig({ cols: r.data.cols, rows: r.data.rows });
      setGridLayout(r.data.cells || {});
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch extras ──────────────────────────────────────────────────────────
  const fetchExtras = useCallback(async () => {
    try {
      const [pRes, aRes, sRes] = await Promise.all([
        axios.get(`${BASE}/presets`),
        axios.get(`${BASE}/animations`),
        axios.get(`${BASE}/saved-selections`),
      ]);
      setPresets(pRes.data || []);
      setAnimations(aRes.data || []);
      setSavedSel(sRes.data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchGridLayout();
    fetchExtras();
  }, [fetchDevices, fetchGridLayout, fetchExtras]);

  // ── Device CRUD ────────────────────────────────────────────────────────────
  const handleAdd = async ({ ip, nama }) => {
    try {
      const r = await axios.post(`${BASE}/devices`, { ip, nama });
      toast.success(`"${nama}" added`);
      await fetchDevices();
      // If added from a cell, place it there automatically
      if (pendingCellIdx !== null && r.data.device) {
        const newLayout = { ...gridLayout, [String(pendingCellIdx)]: r.data.device.kode };
        setGridLayout(newLayout);
        saveGridLayout(newLayout);
        setPendingCellIdx(null);
      }
    } catch (e) { toast.error("Failed to add light"); }
  };

  const handleUpdate = async (kode, data) => {
    try { await axios.put(`${BASE}/devices/${kode}`, data); toast.success("Updated"); fetchDevices(); }
    catch (e) { toast.error("Failed to update"); }
  };

  const handleDelete = async (kode) => {
    try {
      await axios.delete(`${BASE}/devices/${kode}`);
      toast.success("Deleted");
      setSelectedIds(p => p.filter(id => id !== kode));
      setDeviceStatuses(p => { const n = { ...p }; delete n[kode]; return n; });
      // Remove from grid layout
      const newLayout = Object.fromEntries(Object.entries(gridLayout).filter(([, v]) => v !== kode));
      setGridLayout(newLayout);
      saveGridLayout(newLayout);
      fetchDevices();
    } catch (e) { toast.error("Failed to delete"); }
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const handleToggleSelect   = kode => setSelectedIds(p => p.includes(kode) ? p.filter(id => id !== kode) : [...p, kode]);
  const handleSelectAll      = () => setSelectedIds(selectedIds.length === devices.length ? [] : devices.map(d => d.kode));

  // ── Grid Layout save to backend ───────────────────────────────────────────
  const saveGridLayout = useCallback(async (cells = gridLayout, config = gridConfig) => {
    try { await axios.put(`${BASE}/grid-layout`, { ...config, cells }); } catch (e) { console.error(e); }
  }, [gridLayout, gridConfig]);

  const handleLayoutChange = async (newLayout) => {
    setGridLayout(newLayout);
    await saveGridLayout(newLayout, gridConfig);
  };

  const handleGridConfigConfirm = async ({ cols, rows }) => {
    // Auto-populate empty layout with devices in order
    const newConfig = { cols, rows };
    const newLayout = {};
    devices.forEach((d, i) => {
      if (i < cols * rows) newLayout[String(i)] = d.kode;
    });
    setGridConfig(newConfig);
    setGridLayout(newLayout);
    try { await axios.put(`${BASE}/grid-layout`, { ...newConfig, cells: newLayout }); }
    catch (e) { console.error(e); }
  };

  // ── Saved Selections ───────────────────────────────────────────────────────
  const handleSaveSel = async (name, kodes) => {
    try {
      await axios.post(`${BASE}/saved-selections`, { name, kodes });
      toast.success(`"${name}" saved`);
      fetchExtras();
    } catch (e) { toast.error("Failed to save"); }
  };
  const handleDeleteSel = async (id) => {
    try { await axios.delete(`${BASE}/saved-selections/${id}`); fetchExtras(); } catch (e) {}
  };
  const handleApplySel = (sel) => {
    const valid = (sel.kodes || []).filter(k => devices.some(d => d.kode === k));
    setSelectedIds(valid);
    toast.success(`"${sel.name}" applied — ${valid.length} device(s) selected`);
  };

  // ── Light control helpers ─────────────────────────────────────────────────
  const updateFromResponse = (report, action) => {
    const ns = {};
    report.forEach(d => { ns[d.kode] = d.status === "success" ? action : "failed"; });
    setDeviceStatuses(p => ({ ...p, ...ns }));
    const fc = report.filter(d => d.status !== "success").length;
    const sc = report.filter(d => d.status === "success").length;
    if (fc > 0 && sc > 0) toast.warning(`${sc} succeeded, ${fc} failed`);
    else if (fc > 0) toast.error(`${fc} failed`);
    else toast.success("All lights successful");
  };

  // Selected IPs from selected kode list
  const selectedIps = selectedIds
    .map(k => devices.find(d => d.kode === k)?.ip)
    .filter(Boolean);

  /**
   * Core color apply — called with explicit payload OR uses tracked currentColor.
   * brightness parameter is 0-255 (UI range); normalized to 0-100 before sending.
   */
  const handleApplyColor = async (opts = {}) => {
    if (!devices.length) { toast.error("No lights configured"); return; }
    setLoading(true);
    const ips = selectedIps.length > 0 ? selectedIps : devices.map(d => d.ip);
    // Resolve color from opts or tracked currentColor
    const color  = opts.rgb ?? (currentColor.rgb ? { r: currentColor.rgb[0], g: currentColor.rgb[1], b: currentColor.rgb[2] } : null);
    const colorA = Array.isArray(opts.rgb) ? opts.rgb : (color ? [color.r, color.g, color.b] : currentColor.rgb);
    const br255  = opts.brightness ?? brightness;
    const br100  = Math.round(br255 / 255 * 100);   // CCControlRequest expects 0-100
    const payload = opts.sceneId
      ? { action: "on", ips, colortemp: opts.sceneId, brightness: br100 }
      : { action: "on", ips, rgb: colorA, brightness: br100 };
    try {
      const r = await axios.post(`${BASE}/control`, payload);
      if (r.data.devices) updateFromResponse(r.data.devices, "on");
      else toast.success("Color applied");
    } catch (e) { toast.error("Failed"); }
    setLoading(false);
  };

  // No-arg version for ControlPanel's "Apply to Selected Lights" button
  const handleApplyColorNoArg = () => handleApplyColor();

  // onColorChange from AdvancedColorPicker — just track state, don't apply yet
  const handleColorChange = (payload) => setCurrentColor(payload);

  // ── Color Preset apply ────────────────────────────────────────────────────
  const handleApplyPreset = async (preset) => {
    if (!selectedIds.length && selectedIps.length === 0) { toast.error("Select devices first"); return; }
    const rgb = preset.settings?.rgb;
    const br  = preset.settings?.brightness ?? 100;   // already 0-100
    if (!rgb) return;
    const ips = selectedIps.length > 0 ? selectedIps : devices.map(d => d.ip);
    try {
      const r = await axios.post(`${BASE}/control`, {
        action: "on", ips, rgb, brightness: br,        // send 0-100 directly
      });
      if (r.data.devices) updateFromResponse(r.data.devices, "on");
    } catch (e) { toast.error("Failed to apply preset"); }
  };

  const handleSavePreset = async (name, settings) => {
    try { await axios.post(`${BASE}/presets`, { name, settings }); toast.success(`Preset "${name}" saved`); fetchExtras(); }
    catch (e) { toast.error("Failed to save preset"); }
  };
  const handleDeletePreset = async (id) => {
    try { await axios.delete(`${BASE}/presets/${id}`); fetchExtras(); } catch (e) {}
  };

  // ── Animation handlers ────────────────────────────────────────────────────
  const handlePlayAnim = async (anim) => {
    try { await axios.post(`${BASE}/animation/start`, { ...anim, ips: selectedIps }); toast.success(`Animation "${anim.name}" started`); }
    catch (e) { toast.error("Failed"); }
  };
  const handleStopAnim = async () => {
    try { await axios.post(`${BASE}/animation/stop`); } catch (e) {}
  };
  const handleSaveAnim = async (anim) => {
    try { await axios.post(`${BASE}/animations`, anim); fetchExtras(); } catch (e) {}
  };
  const handleDeleteAnim = async (id) => {
    try { await axios.delete(`${BASE}/animations/${id}`); fetchExtras(); } catch (e) {}
  };

  // ── Activate / Deactivate All ─────────────────────────────────────────────
  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const r = await axios.post(`${BASE}/control`, { action: "color", ips: devices.map(d => d.ip), rgb: [255,255,255], brightness });
      if (r.data.devices) updateFromResponse(r.data.devices, "on");
    } catch (e) { toast.error("Failed"); }
    setLoading(false);
  };
  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const r = await axios.post(`${BASE}/turn-off`);
      if (r.data.devices) updateFromResponse(r.data.devices, "off");
    } catch (e) { toast.error("Failed"); }
    setLoading(false);
  };

  const onCount     = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="command-center-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]"
              style={{ fontFamily: "Work Sans, sans-serif" }}>
              Command Center
            </h1>
            <p className="text-sm text-[#637083] mt-1">Managing {devices.length} ceiling light(s).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs"
              onClick={handleActivateAll} disabled={loading}>ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs"
              onClick={handleDeactivateAll} disabled={loading}>DEACTIVATE ALL</Button>
          </div>
        </div>

        {/* ── Main layout ──────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: Module Grid */}
          <div className="flex-1">
            {/* Grid toolbar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider"
                style={{ fontFamily: "Work Sans, sans-serif" }}>Module Grid</h2>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View mode toggle */}
                <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                  {[["list","List",List],["grid","Grid",Grid3X3]].map(([mode, label, Icon]) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        viewMode === mode ? "bg-[#DA2C38] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* Grid table specific controls */}
                {viewMode === "grid" && <>
                  <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                    {[["edit","Edit",Pencil],["control","Control",Check]].map(([mode, label, Icon]) => (
                      <button key={mode} onClick={() => setGridMode(mode)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          gridMode === mode ? "bg-[#1C2025] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}
                    className="rounded-md text-xs border-[#E5E7EB]">
                    <Settings2 className="w-3.5 h-3.5 mr-1" />{gridConfig.cols}×{gridConfig.rows}
                  </Button>
                </>}

                {/* Select All / Add Light */}
                {devices.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs">
                    {selectedIds.length === devices.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
                <Button size="sm" onClick={() => { setEditingDevice(null); setPendingCellIdx(null); setDialogOpen(true); }}
                  className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Light
                </Button>
              </div>
            </div>

            <DeviceModuleGrid
              devices={devices}
              selectedIds={selectedIds}
              deviceStatuses={deviceStatuses}
              viewMode={viewMode}
              gridConfig={gridConfig}
              gridLayout={gridLayout}
              gridMode={gridMode}
              onToggleSelect={handleToggleSelect}
              onDelete={handleDelete}
              onEdit={(device) => { setEditingDevice(device); setDialogOpen(true); }}
              onAddAtCell={(cellIdx) => { setPendingCellIdx(cellIdx); setEditingDevice(null); setDialogOpen(true); }}
              onLayoutChange={handleLayoutChange}
              onViewModeChange={setViewMode}
              onGridModeChange={setGridMode}
              onGridConfigOpen={() => setConfigOpen(true)}
            />
          </div>

          {/* Right: Control panels */}
          <div className="lg:w-80 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <ControlPanel
              selectedCount={selectedIds.length}
              tab={controlTab}
              onTabChange={setControlTab}
              brightness={brightness}
              onBrightnessChange={setBrightness}
              onPowerOn={() => handleApplyColor({ rgb: [255,255,255], brightness })}
              onPowerOff={handleDeactivateAll}
              onColorChange={handleColorChange}
              onApplyColor={handleApplyColorNoArg}
              presets={presets}
              onApplyPreset={handleApplyPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
              currentSettings={{ is_on: true, brightness: Math.round(brightness / 255 * 100) }}
              animations={animations}
              animState={animState}
              interval={2000}
              onIntervalChange={() => {}}
              selectedIps={selectedIps}
              onPlayAnim={handlePlayAnim}
              onStopAnim={handleStopAnim}
              onDeleteAnim={handleDeleteAnim}
              onSaveAnim={handleSaveAnim}
            />

            <MasterStatus total={devices.length} onCount={onCount} failedCount={failedCount} />

            {/* Saved Selections */}
            <SavedSelectionPanel
              selections={savedSelections}
              selectedIds={selectedIds}
              onSave={handleSaveSel}
              onApply={handleApplySel}
              onDelete={handleDeleteSel}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddLightDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAdd}
        editingDevice={editingDevice}
        onUpdate={handleUpdate}
      />
      <GridConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        initial={gridConfig}
        onConfirm={handleGridConfigConfirm}
      />
    </div>
  );
}

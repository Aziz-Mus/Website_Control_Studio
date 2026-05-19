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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE = `${API}/command-center`;     // prefix lama (untuk referensi)
const CTRL = `${API}/control/wiz`;        // endpoint kontrol hardware baru
const ROOM_ID = "cc_room"

const STORAGE_KEY = "cc_device_statuses";
const SELECTED_KEY = "cc_selected_ids";
const VIEW_KEY = "cc_view_mode";
const GRIDMODE_KEY = "cc_grid_mode";
const GRIDCONFIG_KEY = "cc_grid_config";
const GRIDLAYOUT_KEY = "cc_grid_layout";
const DISPLAY_KEY = "cc_display_mode";

function loadStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    try { return JSON.parse(v); } catch { return v; } // handle raw (non-JSON) strings
  } catch { return fallback; }
}

export default function CommandCenter() {
  // ── Devices & selection ───────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => loadStorage(SELECTED_KEY, []));
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));
  const [loading, setLoading] = useState(false);

  // ── View mode ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("grid");
  const [gridConfig, setGridConfig] = useState({ cols: 4, rows: 5 });
  const [gridLayout, setGridLayout] = useState({});
  const [gridMode, setGridMode] = useState(() => loadStorage(GRIDMODE_KEY, "control"));
  const [displayMode, setDisplayMode] = useState(() => loadStorage(DISPLAY_KEY, "detailed"));
  const [configOpen, setConfigOpen] = useState(false);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [pendingCellIdx, setPendingCellIdx] = useState(null);

  // ── CC extra: presets, animations, saved selections ───────────────────────
  const [presets, setPresets] = useState([]);
  const [savedSelections, setSavedSel] = useState([]);
  const [controlTab, setControlTab] = useState("Color");
  const [brightness, setBrightness] = useState(200);
  // Track current color picked by AdvancedColorPicker (updated on every picker change)
  const [currentColor, setCurrentColor] = useState({ rgb: [218, 44, 56], mode: "solid" });
  const [animState, setAnimState] = useState({ running: false });
  const [animations, setAnimations] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null); // indikator preset yang sedang aktif

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(SELECTED_KEY, JSON.stringify(selectedIds)); }, [selectedIds]);
  useEffect(() => { localStorage.setItem(GRIDMODE_KEY, JSON.stringify(gridMode)); }, [gridMode]);
  useEffect(() => { localStorage.setItem(GRIDCONFIG_KEY, JSON.stringify(gridConfig)); }, [gridConfig]);
  useEffect(() => { localStorage.setItem(GRIDLAYOUT_KEY, JSON.stringify(gridLayout)); }, [gridLayout]);
  useEffect(() => { localStorage.setItem(DISPLAY_KEY, JSON.stringify(displayMode)); }, [displayMode]);

  // ── Fetch devices ─────────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/devices?room_id=${ROOM_ID}`);
      const raw = Array.isArray(r.data) ? r.data : [];
      const mapped = raw.map(d => ({
        kode: d.kode,
        nama: d.name,
        ip:   d.conn_info?.ip || "",
        id:   d.id,
      }));
      setDevices(mapped);
      // Init status dari DB (DB sebagai source of truth)
      const dbStatuses = {};
      raw.forEach(d => { if (d.status) dbStatuses[d.kode] = d.status; });
      if (Object.keys(dbStatuses).length > 0) {
        setDeviceStatuses(prev => ({ ...prev, ...dbStatuses }));
      }
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch grid layout (only config, don't overwrite localStorage viewMode) ─
  const fetchGridLayout = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/room/detail?room_id=${ROOM_ID}`);
      const cfg = r.data.ui_config || {};
      setGridConfig({ cols: cfg.cols || 4, rows: cfg.rows || 5 });
      setGridLayout(cfg.cells || {});
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch extras ──────────────────────────────────────────────────────────
  const fetchExtras = useCallback(async () => {
    try {
      const [pRes, aRes, sRes] = await Promise.all([
        axios.get(`${API}/presets?room_id=${ROOM_ID}`),
        axios.get(`${API}/animations`),
        axios.get(`${API}/selections?room_id=${ROOM_ID}`),
      ]);
      setPresets(pRes.data || []);
      // Backend returns { id, name, steps } — AnimationPanel expects frames
      setAnimations((aRes.data || []).map(a => ({ ...a, frames: a.steps || a.frames || [] })));
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
      const r = await axios.post(`${API}/devices`, {
        room_id: ROOM_ID,
        name: nama,
        conn_info: { ip }
      });
      toast.success(`"${nama}" added`);
      await fetchDevices();

      // Place it in the grid automatically
      if (r.data.device) {
        let cellIdx = pendingCellIdx;
        if (cellIdx === null) {
          const usedIndices = new Set(Object.keys(gridLayout).map(Number));
          const totalCells = gridConfig.cols * gridConfig.rows;
          const found = Array.from({ length: totalCells }).findIndex((_, i) => !usedIndices.has(i));
          if (found !== -1) cellIdx = found;
        }

        if (cellIdx !== null) {
          const newLayout = { ...gridLayout, [String(cellIdx)]: r.data.device.kode };
          setGridLayout(newLayout);
          saveGridLayout(newLayout);
        }
        setPendingCellIdx(null);
      }
    } catch (e) { toast.error("Failed to add light"); }
  };

  const handleUpdate = async (kode, data) => {
    const dev = devices.find(d => d.kode === kode);
    if (!dev?.id) { toast.error("Device not found"); return; }
    try {
      await axios.put(`${API}/devices/${dev.id}`, {
        name: data.nama,
        conn_info: { ip: data.ip },
      });
      toast.success("Updated");
      fetchDevices();
    }
    catch (e) { toast.error("Failed to update"); }
  };

  const handleDelete = async (kode) => {
    const dev = devices.find(d => d.kode === kode);
    if (!dev?.id) { toast.error("Device not found"); return; }
    try {
      await axios.delete(`${API}/devices/${dev.id}`);
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
  const handleToggleSelect = kode => setSelectedIds(p => p.includes(kode) ? p.filter(id => id !== kode) : [...p, kode]);
  const handleSelectAll = () => setSelectedIds(selectedIds.length === devices.length ? [] : devices.map(d => d.kode));

  // ── Grid Layout save to backend ───────────────────────────────────────────
  const saveGridLayout = useCallback(async (cells = gridLayout, config = gridConfig) => {
    try {
      await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...config, cells });
    } catch (e) { console.error(e); }
  }, [gridLayout, gridConfig]);

  const handleLayoutChange = async (newLayout) => {
    setGridLayout(newLayout);
    await saveGridLayout(newLayout, gridConfig);
  };

  const handleGridConfigConfirm = async ({ cols, rows }) => {
    const newConfig = { cols, rows };
    const totalCells = cols * rows;

    // Preserve existing positions — only move devices that fall outside new grid
    const newLayout = {};
    const overflowKodes = [];

    const oldCols = gridConfig.cols;

    // First pass: maintain (row, col) coordinates where possible
    Object.entries(gridLayout).forEach(([cellIdx, kode]) => {
      const idx = Number(cellIdx);
      const r = Math.floor(idx / oldCols);
      const c = idx % oldCols;

      if (r < rows && c < cols) {
        const newIdx = r * cols + c;
        newLayout[String(newIdx)] = kode;
      } else {
        overflowKodes.push(kode);
      }
    });

    // Second pass: place overflow devices AND missing devices into empty cells
    const kodesCurrentlyIn = new Set(Object.values(newLayout).concat(overflowKodes));
    const missingKodes = devices.map(d => d.kode).filter(k => !kodesCurrentlyIn.has(k));
    const toPlace = [...overflowKodes, ...missingKodes];

    if (toPlace.length > 0) {
      const usedCells = new Set(Object.keys(newLayout).map(Number));
      for (const kode of toPlace) {
        const emptyIdx = Array.from({ length: totalCells }).findIndex((_, i) => !usedCells.has(i));
        if (emptyIdx !== -1) {
          newLayout[String(emptyIdx)] = kode;
          usedCells.add(emptyIdx);
        }
      }
    }

    setGridConfig(newConfig);
    setGridLayout(newLayout);
    try { await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...newConfig, cells: newLayout }); }
    catch (e) { console.error(e); }
  };

  // ── Saved Selections ───────────────────────────────────────────────────────
  const handleSaveSel = async (name, kodes) => {
    try {
      await axios.post(`${API}/selections`, { room_id: ROOM_ID, name, device_ids: kodes });
      toast.success(`"${name}" saved`);
      fetchExtras();
    } catch (e) { toast.error("Failed to save"); }
  };
  const handleDeleteSel = async (id) => {
    try { await axios.delete(`${API}/selections/${id}`); fetchExtras(); } catch (e) { }
  };
  const handleApplySel = (sel) => {
    const selIds = sel.device_ids || [];
    // devices.kode adalah integer; selIds bisa integer atau string — pakai String() untuk safe match
    const valid = devices.filter(d => selIds.some(k => String(d.kode) === String(k))).map(d => d.kode);
    if (sel._action === "deselect") {
      setSelectedIds(prev => prev.filter(id => !valid.includes(id)));
      toast.success(`"${sel.name}" deselected — ${valid.length} device(s) removed`);
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...valid])));
      toast.success(`"${sel.name}" added — ${valid.length} device(s) added to selection`);
    }
  };


  // ── Light control helpers ─────────────────────────────────────────────────
  // Build ip→kode lookup for mapping control results back to device kodes
  const ipToKode = Object.fromEntries(devices.map(d => [d.ip, d.kode]));

  // Handles response from /api/control/wiz/* endpoints:
  //   { devices: [{ ip, status, error }] }   ← current format
  const updateFromControlResponse = (data, action) => {
    const ns = {};
    if (data.devices) {
      data.devices.forEach(d => {
        const kode = ipToKode[d.ip];
        if (kode !== undefined) ns[kode] = d.status === "success" ? action : "failed";
      });
    } else if (data.results) {
      data.results.forEach(r => {
        const kode = ipToKode[r.ip];
        if (kode !== undefined) ns[kode] = r.success ? action : "failed";
      });
    }
    setDeviceStatuses(p => ({ ...p, ...ns }));
    // Persist status ke database
    const devMap = Object.fromEntries(devices.map(d => [d.kode, d.id]));
    Promise.allSettled(
      Object.entries(ns).map(([kode, st]) => {
        const devId = devMap[Number(kode)];
        return devId ? axios.patch(`${API}/devices/${devId}/status`, { status: st }) : Promise.resolve();
      })
    );
    const fc = Object.values(ns).filter(s => s === "failed").length;
    const sc = Object.values(ns).filter(s => s !== "failed").length;
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
    const color = opts.rgb ?? (currentColor.rgb ? { r: currentColor.rgb[0], g: currentColor.rgb[1], b: currentColor.rgb[2] } : null);
    const colorA = Array.isArray(opts.rgb) ? opts.rgb : (color ? [color.r, color.g, color.b] : currentColor.rgb);
    const br255 = opts.brightness ?? brightness;
    const br100 = Math.round(br255 / 255 * 100);   // CCControlRequest expects 0-100
    const payload = opts.sceneId
      ? { action: "on", ips, colortemp: opts.sceneId, brightness: br100 }
      : { action: "on", ips, rgb: colorA, brightness: br100 };
    try {
      const r = await axios.post(`${CTRL}/lampu`, payload);
      updateFromControlResponse(r.data, "on");
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
    const br = preset.settings?.brightness ?? 100;
    if (!rgb) return;
    const ips = selectedIps.length > 0 ? selectedIps : devices.map(d => d.ip);
    try {
      const r = await axios.post(`${CTRL}/lampu`, { action: "on", ips, rgb, brightness: br });
      updateFromControlResponse(r.data, "on");
      setActivePresetId(preset.id);  // tandai preset aktif
    } catch (e) { toast.error("Failed to apply preset"); }
  };

  const handleSavePreset = async (name, settings) => {
    try {
      await axios.post(`${API}/presets`, { room_id: ROOM_ID, name, settings });
      toast.success(`Preset "${name}" saved`);
      fetchExtras();
    }
    catch (e) { toast.error("Failed to save preset"); }
  };
  const handleDeletePreset = async (id) => {
    try { await axios.delete(`${API}/presets/${id}`); fetchExtras(); } catch (e) { }
  };

  // ── Animation handlers ────────────────────────────────────────────────────
  const handlePlayAnim = async (anim) => {
    try { await axios.post(`${CTRL}/animation/start`, { ...anim, ips: selectedIps }); toast.success(`Animation "${anim.name}" started`); }
    catch (e) { toast.error("Failed"); }
  };
  const handleStopAnim = async () => {
    try { await axios.post(`${CTRL}/animation/stop`); } catch (e) { }
  };
  const handleSaveAnim = async (name, frames) => {
    try {
      await axios.post(`${API}/animations`, { name, steps: frames });
      toast.success(`Animation "${name}" saved`);
      fetchExtras();
    } catch (e) {
      toast.error("Failed to save animation");
      console.error(e);
    }
  };
  const handleDeleteAnim = async (id) => {
    try { await axios.delete(`${API}/animations/${id}`); fetchExtras(); } catch (e) { }
  };

  // ── Activate / Deactivate All ─────────────────────────────────────────────
  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const r = await axios.post(`${CTRL}/lampu`, { action: "on", ips: devices.map(d => d.ip), rgb: [255, 255, 255], brightness });
      updateFromControlResponse(r.data, "on");
    } catch (e) { toast.error("Failed"); }
    setLoading(false);
  };
  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    // If devices are selected, only turn off selected; otherwise turn off all
    const ips = selectedIps.length > 0 ? selectedIps : devices.map(d => d.ip);
    try {
      const r = await axios.post(`${CTRL}/turn-off`, { action: "off", ips });
      updateFromControlResponse(r.data, "off");
    } catch (e) { toast.error("Failed"); }
    setLoading(false);
  };

  const onCount = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="command-center-page">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

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
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start w-full">

          {/* Left: Module Grid */}
          <div className="flex-1 w-full">
            {/* Grid toolbar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider"
                style={{ fontFamily: "Work Sans, sans-serif" }}>Module Grid</h2>

              <div className="flex items-center gap-2 flex-wrap">
                {/* View mode toggle */}
                <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                  {[["list", "List", List], ["grid", "Grid", Grid3X3]].map(([mode, label, Icon]) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === mode ? "bg-[#DA2C38] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* Grid table specific controls */}
                {viewMode === "grid" && <>
                  <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                    {[["edit", "Edit", Pencil], ["control", "Control", Check]].map(([mode, label, Icon]) => (
                      <button key={mode} onClick={() => setGridMode(mode)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${gridMode === mode ? "bg-[#1C2025] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}
                    className="rounded-md text-xs border-[#E5E7EB]">
                    <Settings2 className="w-3.5 h-3.5 mr-1" />{gridConfig.cols}×{gridConfig.rows}
                  </Button>
                  {/* Show Detail toggle — pill style */}
                  <button
                    onClick={() => setDisplayMode(displayMode === "detailed" ? "icon" : "detailed")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all select-none ${displayMode === "detailed"
                        ? "bg-[#1C2025] border-[#1C2025] text-white"
                        : "border-[#E5E7EB] text-[#637083] hover:bg-[#F3F4F6]"
                      }`}
                  >
                    {/* Pill switch */}
                    <span className={`relative inline-flex items-center w-7 h-4 rounded-full transition-colors flex-shrink-0 ${displayMode === "detailed" ? "bg-[#DA2C38]" : "bg-[#D1D5DB]"
                      }`}>
                      <span className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${displayMode === "detailed" ? "translate-x-3.5" : "translate-x-0.5"
                        }`} />
                    </span>
                    Detail
                  </button>
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
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              onGridConfigOpen={() => setConfigOpen(true)}
            />
          </div>

          {/* Right: Control + Status + Saved Selections — sticky */}
          <div className="w-full lg:w-80 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <ControlPanel
              selectedCount={selectedIds.length}
              tab={controlTab}
              onTabChange={setControlTab}
              brightness={brightness}
              onBrightnessChange={setBrightness}
              onPowerOn={() => handleApplyColor({ rgb: [255, 255, 255], brightness })}
              onPowerOff={handleDeactivateAll}
              onColorChange={handleColorChange}
              onApplyColor={handleApplyColorNoArg}
              presets={presets}
              onApplyPreset={handleApplyPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
              currentSettings={{ is_on: true, brightness: Math.round(brightness / 255 * 100) }}
              activePresetId={activePresetId}
              animations={animations}
              animState={animState}
              interval={2000}
              onIntervalChange={() => { }}
              selectedIps={selectedIps}
              onPlayAnim={handlePlayAnim}
              onStopAnim={handleStopAnim}
              onDeleteAnim={handleDeleteAnim}
              onSaveAnim={handleSaveAnim}
              roomId={ROOM_ID}
              selections={savedSelections}
              devices={devices}
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
        deviceCount={devices.length}
        onConfirm={handleGridConfigConfirm}
      />
    </div>
  );
}

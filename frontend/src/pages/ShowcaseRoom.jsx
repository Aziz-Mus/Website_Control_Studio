import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, List, Grid3X3, Settings2, Pencil, Check, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import DeviceModuleGrid from "@/components/shared/DeviceModuleGrid";
import ChromaControl from "@/components/shared/ChromaControl";
import MasterStatus from "@/components/shared/MasterStatus";
import AddLightDialog from "@/components/shared/AddLightDialog";
import GridConfigDialog from "@/components/shared/GridConfigDialog";
import SavedSelectionPanel from "@/components/shared/SavedSelectionPanel";
import SelectedControlPanel from "@/components/shared/SelectedControlPanel";
import SchedulerPanel from "@/components/shared/SchedulerPanel";
import useDeviceStatusWS from "@/hooks/useDeviceStatusWS";

const API     = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE    = `${API}/showcase`;
const CTRL    = `${API}/control/wiz`;   // hardware control baru
const ROOM_ID = "showcase_room"
const STORAGE_KEY  = "showcase_device_statuses";
const SELECTED_KEY = "showcase_selected_ids";
const VIEW_KEY     = "showcase_view_mode";
const GRIDMODE_KEY = "showcase_grid_mode";
const GRIDCONFIG_KEY = "showcase_grid_config";
const GRIDLAYOUT_KEY = "showcase_grid_layout";
const DISPLAY_KEY    = "showcase_display_mode";

function loadStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    try { return JSON.parse(v); } catch { return v; }
  } catch { return fallback; }
}

export default function ShowcaseRoom() {
  const [devices, setDevices]               = useState([]);
  const [selectedIds, setSelectedIds]       = useState(() => loadStorage(SELECTED_KEY, []));
  const [brightness, setBrightness]         = useState(255);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editingDevice, setEditingDevice]   = useState(null);
  const [loading, setLoading]               = useState(false);
  const [deviceStatuses, setDeviceStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));

  const [viewMode, setViewMode]           = useState("grid");
  const [gridConfig, setGridConfig]       = useState({ cols: 4, rows: 5 });
  const [gridLayout, setGridLayout]       = useState({});
  const [gridMode, setGridMode]           = useState(() => loadStorage(GRIDMODE_KEY, "control"));
  const [displayMode, setDisplayMode]     = useState(() => loadStorage(DISPLAY_KEY, "detailed"));
  const [configOpen, setConfigOpen]       = useState(false);
  const [pendingCellIdx, setPendingCellIdx] = useState(null);
  const [savedSelections, setSavedSel]    = useState([]);
  const [gridLoaded, setGridLoaded]       = useState(false);
  const [controlTab, setControlTab]       = useState("Color");

  const devicesRef = useRef(devices);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // ── WebSocket: Real-time device status from backend ────────────────────
  useDeviceStatusWS((data) => {
    if (data.type === "device_status" && data.room_id === ROOM_ID && data.devices) {
      setDeviceStatuses(prev => {
        const ns = { ...prev };
        data.devices.forEach(d => {
          const dev = devicesRef.current.find(x => x.id === d.id);
          if (dev) ns[dev.kode] = d.status;
        });
        return ns;
      });
    }
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY,    JSON.stringify(deviceStatuses)); }, [deviceStatuses]);
  useEffect(() => { localStorage.setItem(SELECTED_KEY,   JSON.stringify(selectedIds)); },   [selectedIds]);
  useEffect(() => { localStorage.setItem(GRIDMODE_KEY,    JSON.stringify(gridMode)); },      [gridMode]);
  useEffect(() => { localStorage.setItem(GRIDCONFIG_KEY, JSON.stringify(gridConfig)); },    [gridConfig]);
  useEffect(() => { localStorage.setItem(GRIDLAYOUT_KEY, JSON.stringify(gridLayout)); },    [gridLayout]);
  useEffect(() => { localStorage.setItem(DISPLAY_KEY,    JSON.stringify(displayMode)); },   [displayMode]);

  const fetchDevices = useCallback(async () => {
    try { 
      const r = await axios.get(`${API}/devices?room_id=${ROOM_ID}`);
      const raw = Array.isArray(r.data) ? r.data : [];
      const mapped = raw.map(d => ({
        kode: d.kode,
        nama: d.name,
        name: d.name,
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
    } catch {}
  }, []);

  const fetchGridLayout = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/room/detail?room_id=${ROOM_ID}`);
      const cfg = r.data.ui_config || {};
      setGridConfig({ cols: cfg.cols || 4, rows: cfg.rows || 5 });
      setGridLayout(cfg.cells || {});
      setGridLoaded(true);
    } catch { setGridLoaded(true); }
  }, []);

  const fetchSavedSel = useCallback(async () => {
    try { const r = await axios.get(`${API}/selections?room_id=${ROOM_ID}`); setSavedSel(r.data || []); } catch {}
  }, []);

  useEffect(() => { fetchDevices(); fetchGridLayout(); fetchSavedSel(); }, [fetchDevices, fetchGridLayout, fetchSavedSel]);

  // Sync grid: auto-place devices not yet in grid — runs once per device-list change
  const gridSyncedRef = useRef(false);
  useEffect(() => { gridSyncedRef.current = false; }, [devices]);

  useEffect(() => {
    if (!devices.length || gridSyncedRef.current || !gridLoaded) return;
    const currentKodesInGrid = new Set(Object.values(gridLayout).map(String));
    const missingDevices = devices.filter(d => !currentKodesInGrid.has(String(d.kode)));

    if (missingDevices.length > 0) {
      gridSyncedRef.current = true;
      setGridLayout(prev => {
        const newLayout = { ...prev };
        const totalCells = gridConfig.cols * gridConfig.rows;
        const usedCells = new Set(Object.keys(prev).map(Number));
        let emptyIdx = 0;
        missingDevices.forEach(device => {
          while (emptyIdx < totalCells && usedCells.has(emptyIdx)) emptyIdx++;
          if (emptyIdx < totalCells) {
            newLayout[String(emptyIdx)] = device.kode;
            usedCells.add(emptyIdx);
            emptyIdx++;
          }
        });
        axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout }).catch(() => {});
        return newLayout;
      });
    } else {
      gridSyncedRef.current = true;
    }
  }, [devices, gridConfig]); // gridLayout intentionally NOT in deps

  /* ── Device CRUD ──────────────────────────────────────────────────────── */
  const handleAdd = async ({ ip, nama }) => {
    try {
      const r = await axios.post(`${API}/devices`, { 
        room_id: ROOM_ID, 
        name: nama, 
        conn_info: { ip } 
      });
      toast.success(`"${nama}" added`);
      await fetchDevices();
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
          await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout });
        }
        setPendingCellIdx(null);
      }
    } catch { toast.error("Failed to add"); }
  };

  const handleUpdate = async (kode, data) => {
    const dev = devices.find(d => d.kode === kode);
    if (!dev?.id) return;
    try {
      await axios.put(`${API}/devices/${dev.id}`, {
        name: data.nama,
        conn_info: { ip: data.ip },
      });
      toast.success("Updated");
      fetchDevices();
    } catch { toast.error("Failed to update"); }
  };

  const handleDelete = async (kode) => {
    const dev = devices.find(d => d.kode === kode);
    if (!dev?.id) return;
    try {
      await axios.delete(`${API}/devices/${dev.id}`);
      toast.success("Deleted");
      setSelectedIds(p => p.filter(id => id !== kode));
      setDeviceStatuses(p => { const n = { ...p }; delete n[kode]; return n; });
      const newLayout = Object.fromEntries(Object.entries(gridLayout).filter(([, v]) => v !== kode));
      setGridLayout(newLayout);
      await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout });
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
    try { await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout }); } catch {}
  };

  const handleGridConfigConfirm = async ({ cols, rows }) => {
    const newConfig = { cols, rows };
    const totalCells = cols * rows;
    const newLayout = {};
    const oldCols = gridConfig.cols;
    const overflowKodes = [];

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
        if (emptyIdx !== -1) { newLayout[String(emptyIdx)] = kode; usedCells.add(emptyIdx); }
      }
    }
    setGridConfig(newConfig); setGridLayout(newLayout);
    try { await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...newConfig, cells: newLayout }); } catch {}
  };

  /* ── Saved Selections ─────────────────────────────────────────────────── */
  const handleSaveSel = async (name, kodes) => {
    try {
      await axios.post(`${API}/selections`, { room_id: ROOM_ID, name, device_ids: kodes });
      toast.success(`"${name}" saved`);
      fetchSavedSel();
    } catch { toast.error("Failed to save selection"); }
  };
  const handleDeleteSel = async (id) => { try { await axios.delete(`${API}/selections/${id}`); fetchSavedSel(); } catch {} };
  const handleApplySel  = sel => {
    const selIds = sel.device_ids || [];
    const valid = devices.filter(d => selIds.some(k => String(d.kode) === String(k))).map(d => d.kode);
    if (sel._action === "deselect") {
      setSelectedIds(prev => prev.filter(id => !valid.includes(id)));
      toast.success(`"${sel.name}" deselected — ${valid.length} device(s) removed`);
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...valid])));
      toast.success(`"${sel.name}" added — ${valid.length} device(s) added to selection`);
    }
  };


  /* ── Light Control ────────────────────────────────────────────────────── */
  // Helper: simpan status ke DB — dipanggil setelah setiap setDeviceStatuses
  const persistStatuses = (ns) => {
    const devMap = Object.fromEntries(devices.map(d => [d.kode, d.id]));
    Promise.allSettled(
      Object.entries(ns).map(([kode, st]) => {
        const devId = devMap[Number(kode)];
        return devId ? axios.patch(`${API}/devices/${devId}/status`, { status: st }) : Promise.resolve();
      })
    );
  };

  const updateStatuses = (report, action) => {
    const ns = {};
    report.forEach(d => { ns[d.kode] = d.status === "success" ? action : "failed"; });
    setDeviceStatuses(p => ({ ...p, ...ns }));
    persistStatuses(ns);
    const fc = report.filter(d => d.status !== "success").length;
    const sc = report.filter(d => d.status === "success").length;
    if (fc > 0 && sc > 0) toast.warning(`${sc} ok, ${fc} failed`);
    else if (fc > 0) toast.error(`${fc} failed`);
    else toast.success("All lights successful");
  };


  const handleControlSelected = async (action) => {
    if (!selectedIds.length) return;
    setLoading(true);
    try {
      const targetDevices = devices.filter(d => selectedIds.includes(d.kode));
      const ips = targetDevices.map(d => d.ip).filter(Boolean);
      const r = await axios.post(`${CTRL}/lampu`, {
        ips, action,
        brightness,
        rgb: action === "on" ? [255, 255, 255] : undefined,
      });
      const ns = {};
      (r.data.devices || []).forEach(res => {
        const dev = targetDevices.find(d => d.ip === res.ip);
        if (dev) ns[dev.kode] = res.status === "success" ? action : "failed";
      });
      setDeviceStatuses(p => ({ ...p, ...ns }));
      persistStatuses(ns);
      const fc = Object.values(ns).filter(s => s === "failed").length;
      if (fc > 0) toast.warning(`${selectedIds.length - fc} ok, ${fc} failed`);
      else toast.success(`${selectedIds.length} light(s) turned ${action}`);
    } catch { toast.error("Control failed"); }
    setLoading(false);
  };

  const handleControlSolid = async ({ rgb, brightness: br, sceneId }) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    const targetDevices = devices.filter(d => selectedIds.includes(d.kode));
    const ips = targetDevices.map(d => d.ip).filter(Boolean);
    try {
      const r = await axios.post(`${CTRL}/lampu`, {
        ips,
        action: "on",
        brightness: br || brightness,
        rgb: rgb ? [rgb.r, rgb.g, rgb.b] : undefined,
        scene_id: sceneId || undefined,
      });
      const ns = {};
      (r.data.devices || []).forEach(res => {
        const dev = targetDevices.find(d => d.ip === res.ip);
        if (dev) ns[dev.kode] = res.status === "success" ? "on" : "failed";
      });
      setDeviceStatuses(p => ({ ...p, ...ns }));
      persistStatuses(ns);
      toast.success("Applied to selection");
    } catch { toast.error("Failed"); }
    setLoading(false);
  };

  const handleActivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      const r = await axios.post(`${CTRL}/lampu`, { action: "on", ips: devices.map(d => d.ip).filter(Boolean), rgb: [255,255,255], brightness });
      const ns = {};
      (r.data.devices || []).forEach(res => {
        const dev = devices.find(d => d.ip === res.ip);
        if (dev) ns[dev.kode] = res.status === "success" ? "on" : "failed";
      });
      setDeviceStatuses(p => ({ ...p, ...ns }));
      persistStatuses(ns);
    } catch { toast.error("Failed"); }
    setLoading(false);
  };
  const handleDeactivateAll = async () => {
    if (!devices.length) return; setLoading(true);
    try {
      await axios.post(`${CTRL}/turn-off`, { action: "off", ips: devices.map(d => d.ip).filter(Boolean) });
      const ns = {};
      devices.forEach(d => { ns[d.kode] = "off"; });
      setDeviceStatuses(p => ({ ...p, ...ns }));
      persistStatuses(ns);
      toast.success("All off");
    } catch { toast.error("Failed"); }
    setLoading(false);
  };


  const onCount     = Object.values(deviceStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(deviceStatuses).filter(s => s === "failed").length;

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="showcase-room-page">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]"
              style={{ fontFamily: "Work Sans, sans-serif" }} data-testid="showcase-title">Showcase Room</h1>
            <p className="text-sm text-[#637083] mt-1">Managing {devices.length} neon module(s).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs"
              onClick={handleActivateAll} disabled={loading} data-testid="activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs"
              onClick={handleDeactivateAll} disabled={loading} data-testid="deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:items-start w-full">
          {/* Left: Module Grid */}
          <div className="flex-1 w-full">
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
                  {/* Show Detail toggle — pill style */}
                  <button
                    onClick={() => setDisplayMode(displayMode === "detailed" ? "icon" : "detailed")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all select-none ${
                      displayMode === "detailed"
                        ? "bg-[#1C2025] border-[#1C2025] text-white"
                        : "border-[#E5E7EB] text-[#637083] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <span className={`relative inline-flex items-center w-7 h-4 rounded-full transition-colors flex-shrink-0 ${
                      displayMode === "detailed" ? "bg-[#DA2C38]" : "bg-[#D1D5DB]"
                    }`}>
                      <span className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        displayMode === "detailed" ? "translate-x-3.5" : "translate-x-0.5"
                      }`} />
                    </span>
                    Detail
                  </button>
                </>}
                {devices.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs" data-testid="select-all-btn">
                    {selectedIds.length === devices.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
                <Button size="sm" onClick={openAdd}
                  className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-light-btn">
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
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
            />
          </div>

          {/* Right: Tab-based Control Panel — sticky */}
          <div className="w-full lg:w-80 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Unified Control Panel */}
            <div className="flex flex-col bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
              {/* Header — selection count + power buttons */}
              <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#637083] font-medium">Selected</p>
                    <p className="text-2xl font-bold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
                      {selectedIds.length}
                      <span className="text-sm font-normal text-[#9CA3AF] ml-1">light{selectedIds.length !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  {selectedIds.length === 0 && (
                    <span className="text-[10px] text-[#F59E0B] bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full">
                      Select lights first
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleControlSelected("on")} disabled={!selectedIds.length || loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md bg-[#DA2C38] text-white hover:bg-[#B9252F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Power className="w-4 h-4" /> ON
                  </button>
                  <button onClick={() => handleControlSelected("off")} disabled={!selectedIds.length || loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md border border-[#E5E7EB] text-[#637083] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <PowerOff className="w-4 h-4" /> OFF
                  </button>
                </div>
              </div>

              {/* Tab selector */}
              <div className="flex border-b border-[#E5E7EB]">
                {["Color", "Scheduler"].map(t => (
                  <button key={t} onClick={() => setControlTab(t)}
                    className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors ${
                      controlTab === t
                        ? "text-[#DA2C38] border-b-2 border-[#DA2C38] bg-white"
                        : "text-[#637083] hover:text-[#1C2025] hover:bg-gray-50"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className={`flex-1 overflow-y-auto ${controlTab === "Scheduler" ? "p-0" : "p-4"}`}>
                {controlTab === "Color" && (
                  <ChromaControl onApply={handleControlSolid} selectedCount={selectedIds.length}
                    brightness={brightness} onBrightnessChange={setBrightness} embedded />
                )}
                {controlTab === "Scheduler" && (
                  <SchedulerPanel roomId={ROOM_ID} selections={savedSelections} devices={devices} embedded />
                )}
              </div>
            </div>

            <MasterStatus total={devices.length} onCount={onCount} failedCount={failedCount} />
            <SavedSelectionPanel selections={savedSelections} selectedIds={selectedIds}
              onSave={handleSaveSel} onApply={handleApplySel} onDelete={handleDeleteSel} />
          </div>
        </div>
      </div>

      <AddLightDialog open={dialogOpen} onOpenChange={setDialogOpen}
        onAdd={handleAdd} editingDevice={editingDevice} onUpdate={handleUpdate} />
      <GridConfigDialog open={configOpen} onOpenChange={setConfigOpen}
        initial={gridConfig} deviceCount={devices.length} onConfirm={handleGridConfigConfirm} />
    </div>
  );
}

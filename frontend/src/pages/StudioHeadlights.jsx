import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Lamp, Trash2, Sun, Power, CheckCircle, Pencil, List, Grid3X3, Settings2, Check, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import RelayModuleGrid from "@/components/shared/RelayModuleGrid";
import SavedSelectionPanel from "@/components/shared/SavedSelectionPanel";
import GridConfigDialog from "@/components/shared/GridConfigDialog";
import SelectedControlPanel from "@/components/shared/SelectedControlPanel";
import SchedulerPanel from "@/components/shared/SchedulerPanel";
import useDeviceStatusWS from "@/hooks/useDeviceStatusWS";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const HL_BASE =  `${API}/studio/headlights`;
const ROOM_ID = "headlights_room"

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function StudioHeadlights() {
  const navigate = useNavigate();

  // Config (ESP IP + relays)
  const [espIp,             setEspIp]           = useState("");
  const [relays,            setRelays]           = useState([]);
  const [ipDialogOpen,      setIpDialogOpen]     = useState(false);
  const [ipInput,           setIpInput]          = useState("");

  // Device dialog
  const [dialogOpen,        setDialogOpen]       = useState(false);
  const [editingRelay,      setEditingRelay]     = useState(null);
  const [deviceName,        setDeviceName]       = useState("");
  const [channelCode,       setChannelCode]      = useState("");
  const [saving,            setSaving]           = useState(false);
  const [loading,           setLoading]          = useState(false);

  // Relay statuses from localStorage
  const [relayStatuses,     setRelayStatuses]    = useState(() => loadStorage("hl_relay_statuses", {}));

  // Selection & View State
  const [selectedIds,       setSelectedIds]      = useState(() => loadStorage("hl_selected_ids", []));
  const [viewMode,          setViewMode]         = useState("grid");
  const [gridConfig,        setGridConfig]       = useState({ cols: 4, rows: 5 });
  const [gridLayout,        setGridLayout]       = useState({});
  const [gridMode,          setGridMode]         = useState(() => loadStorage("hl_grid_mode", "control"));
  const [displayMode,       setDisplayMode]      = useState(() => loadStorage("hl_display_mode", "detailed"));
  const [configOpen,        setConfigOpen]       = useState(false);
  const [savedSels,         setSavedSels]        = useState([]);
  const [gridLoaded,        setGridLoaded]       = useState(false);

  // ── WebSocket: Real-time device status from scheduler ────────────────────
  useDeviceStatusWS(ROOM_ID, (data) => {
    const ns = {};
    (data.devices || []).forEach(d => { ns[d.id] = d.status; });
    if (Object.keys(ns).length > 0) {
      setRelayStatuses(prev => ({ ...prev, ...ns }));
    }
  });

  // Persist state
  useEffect(() => { localStorage.setItem("hl_relay_statuses", JSON.stringify(relayStatuses)); }, [relayStatuses]);
  useEffect(() => { localStorage.setItem("hl_selected_ids",   JSON.stringify(selectedIds));   }, [selectedIds]);
  useEffect(() => { localStorage.setItem("hl_grid_mode",      JSON.stringify(gridMode));      }, [gridMode]);
  useEffect(() => { localStorage.setItem("hl_display_mode",   JSON.stringify(displayMode));   }, [displayMode]);

  // ── Fetch config (ESP IP + relays) ────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/devices?room_id=${ROOM_ID}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      if (raw.length > 0) {
        setEspIp(raw[0].conn_info?.ip || "");
      }
      const mappedRelays = raw.map(d => ({
        relayId:     d.id,
        deviceName:  d.name,
        channelCode: d.conn_info?.channel || "",
        ip:          d.conn_info?.ip || "",
      }));
      setRelays(mappedRelays);
      // Init status dari database (overwrite localStorage jika ada data DB)
      const dbStatuses = {};
      raw.forEach(d => { if (d.status) dbStatuses[d.id] = d.status; });
      if (Object.keys(dbStatuses).length > 0) {
        setRelayStatuses(prev => ({ ...prev, ...dbStatuses }));
      }
    } catch { console.error("Failed to fetch config"); }
  }, []);

  const fetchGridLayout = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/room/detail?room_id=${ROOM_ID}`);
      const cfg = res.data.ui_config || {};
      setGridConfig({ cols: cfg.cols || 4, rows: cfg.rows || 5 });
      setGridLayout(cfg.cells || {});
      setGridLoaded(true);
    } catch { setGridLoaded(true); }
  }, []);

  const fetchSavedSels = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/selections?room_id=${ROOM_ID}`);
      setSavedSels(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchConfig(); fetchGridLayout(); fetchSavedSels(); }, [fetchConfig, fetchGridLayout, fetchSavedSels]);

  // ── Sync grid with relays ─────────────────────────────────────────────────
  const gridSyncedRef = useRef(false);
  useEffect(() => { gridSyncedRef.current = false; }, [relays]);

  useEffect(() => {
    if (!relays.length || gridSyncedRef.current || !gridLoaded) return;
    const currentIdsInGrid = new Set(Object.values(gridLayout));
    const missing = relays.filter(r => !currentIdsInGrid.has(r.relayId));
    if (missing.length > 0) {
      gridSyncedRef.current = true;
      setGridLayout(prev => {
        const newLayout = { ...prev };
        const totalCells = gridConfig.cols * gridConfig.rows;
        const usedCells = new Set(Object.keys(prev).map(Number));
        let emptyIdx = 0;
        missing.forEach(relay => {
          while (emptyIdx < totalCells && usedCells.has(emptyIdx)) emptyIdx++;
          if (emptyIdx < totalCells) {
            newLayout[String(emptyIdx)] = relay.relayId;
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
  }, [relays, gridConfig, gridLoaded]); // gridLayout intentionally NOT in deps

  // ── ESP IP Dialog ─────────────────────────────────────────────────────────
  const openIpDialog = () => { setIpInput(espIp); setIpDialogOpen(true); };
  const handleIpSave = async (e) => {
    e.preventDefault();
    if (!ipInput.trim()) return;
    setSaving(true);
    try {
      // Update IP di semua relay yang ada di room ini
      await Promise.all(
        relays.map(r =>
          axios.put(`${API}/devices/${r.relayId}`, {
            conn_info: { ip: ipInput.trim() }
          })
        )
      );
      setEspIp(ipInput.trim());
      toast.success("ESP IP updated");
      setIpDialogOpen(false);
      fetchConfig();
    } catch { toast.error("Failed to update IP"); }
    setSaving(false);
  };

  // ── Relay CRUD ────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditingRelay(null); setDeviceName(""); setChannelCode(""); setDialogOpen(true); };
  const openEdit = (relay) => { setEditingRelay(relay); setDeviceName(relay.deviceName); setChannelCode(relay.channelCode); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceName.trim() || !channelCode.trim()) return;
    setSaving(true);
    try {
      if (editingRelay) {
        // Update nama dan channel via PUT /api/devices/{id}
        await axios.put(`${API}/devices/${editingRelay.relayId}`, {
          name:      deviceName.trim(),
          conn_info: { channel: channelCode.trim(), ip: espIp }
        });
        toast.success("Device updated");
      } else {
        // Add relay baru ke database
        const ip = espIp || "10.1.40.88";
        await axios.post(`${API}/devices`, {
          room_id:   ROOM_ID,
          name:      deviceName.trim(),
          type:      "relay",
          conn_info: { channel: channelCode.trim(), ip }
        });
        toast.success(`"${deviceName}" added`);
      }
      fetchConfig(); setDialogOpen(false);
    } catch { toast.error("Failed to save device"); }
    setSaving(false);
  };

  const handleDelete = async (relayId) => {
    try {
      // relayId = d.id dari DB (e.g. "hl_rl01" atau "headlights_room_xxx")
      await axios.delete(`${API}/devices/${relayId}`);
      toast.success("Device deleted");
      setRelayStatuses(p => { const n = { ...p }; delete n[relayId]; return n; });
      setSelectedIds(p => p.filter(id => id !== relayId));
      const newLayout = Object.fromEntries(Object.entries(gridLayout).filter(([, v]) => v !== relayId));
      setGridLayout(newLayout);
      await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout });
      fetchConfig();
    } catch { toast.error("Failed to delete"); }
  };


  // ── Grid Layout ───────────────────────────────────────────────────────────
  const handleLayoutChange = async (newLayout) => {
    setGridLayout(newLayout);
    try { await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...gridConfig, cells: newLayout }); } catch {}
  };

  const handleGridConfigConfirm = async ({ cols, rows }) => {
    const newConfig  = { cols, rows };
    const totalCells = cols * rows;
    const newLayout  = {};
    const oldCols    = gridConfig.cols;
    const overflow   = [];

    Object.entries(gridLayout).forEach(([cellIdx, relayId]) => {
      const idx = Number(cellIdx);
      const r   = Math.floor(idx / oldCols);
      const c   = idx % oldCols;
      if (r < rows && c < cols) {
        newLayout[String(r * cols + c)] = relayId;
      } else {
        overflow.push(relayId);
      }
    });

    const currentIdsInGrid = new Set(Object.values(newLayout));
    const allRelayIds = relays.map(r => r.relayId);
    const missing = allRelayIds.filter(id => !currentIdsInGrid.has(id));
    const toPlace = [...overflow, ...missing];

    const usedCells = new Set(Object.keys(newLayout).map(Number));
    let emptyIdx = 0;
    for (const relayId of toPlace) {
      while (emptyIdx < totalCells && usedCells.has(emptyIdx)) emptyIdx++;
      if (emptyIdx < totalCells) {
        newLayout[String(emptyIdx)] = relayId;
        usedCells.add(emptyIdx);
      }
    }

    setGridConfig(newConfig);
    setGridLayout(newLayout);
    try { await axios.put(`${API}/room/config?room_id=${ROOM_ID}`, { ...newConfig, cells: newLayout }); } catch {}
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleToggleSelect = (relayId) => setSelectedIds(p => p.includes(relayId) ? p.filter(id => id !== relayId) : [...p, relayId]);
  const handleSelectAll    = () => setSelectedIds(selectedIds.length === relays.length ? [] : relays.map(r => r.relayId));

  // ── Saved Selections ──────────────────────────────────────────────────────
  const handleSaveSel  = async (name, ids) => {
    try {
      await axios.post(`${API}/selections`, { room_id: ROOM_ID, name, device_ids: ids });
      toast.success(`"${name}" saved`);
      fetchSavedSels();
    } catch { toast.error("Failed to save selection"); }
  };
  const handleDeleteSel = async (id) => { try { await axios.delete(`${API}/selections/${id}`); fetchSavedSels(); } catch {} };
  const handleApplySel  = (sel) => {
    const ids   = sel.device_ids || sel.relay_ids || sel.kodes || [];
    const valid = ids.filter(id => relays.some(r => r.relayId === id || String(r.relayId) === String(id)));
    if (sel._action === "deselect") {
      setSelectedIds(prev => prev.filter(id => !valid.includes(id)));
      toast.success(`"${sel.name}" deselected`);
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...valid])));
      toast.success(`"${sel.name}" applied — ${valid.length} selected`);
    }
  };
  const adaptedSels = savedSels.map(s => ({ ...s, device_ids: s.device_ids || s.relay_ids || s.kodes || [] }));

  // ── Relay Control ────────────────────────────────────────────────────────
  const controlRelays = async (targetRelays, action) => {
    if (!targetRelays.length) return;
    if (!espIp) { toast.error("ESP IP not configured"); return; }
    setLoading(true);
    const power = action === "on" ? "ON" : "OFF";
    const relaysPayload = targetRelays.map(r => ({ channel_code: r.channelCode, power }));
    try {
      const res = await axios.post(`${API}/control/relay/bulk`, {
        esp_ip: espIp,
        relays: relaysPayload,
      });
      // Map result back to relayId statuses
      const ns = {};
      const overallOk = res.data.status === "success";
      targetRelays.forEach(r => { ns[r.relayId] = overallOk ? action : "failed"; });
      setRelayStatuses(p => ({ ...p, ...ns }));
      // Persist status ke database
      await Promise.allSettled(
        Object.entries(ns).map(([relayId, st]) =>
          axios.patch(`${API}/devices/${relayId}/status`, { status: st })
        )
      );
      const fc = Object.values(ns).filter(s => s === "failed").length;
      const sc = Object.values(ns).filter(s => s !== "failed").length;
      if (fc > 0 && sc > 0) toast.warning(`${sc} ok, ${fc} failed`);
      else if (fc > 0) toast.error(`${fc} failed`);
      else toast.success("Success");
    } catch { toast.error("Control failed"); }
    setLoading(false);
  };

  const handleControlSingle  = (relay, action) => controlRelays([relay], action);
  const handleActivateAll    = () => controlRelays(relays, "on");
  const handleDeactivateAll  = () => controlRelays(relays, "off");
  const handleControlSelected = (action) => {
    const target = relays.filter(r => selectedIds.includes(r.relayId));
    controlRelays(target, action);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const onCount     = relays.filter(r => relayStatuses[r.relayId] === "on").length;
  const failedCount = relays.filter(r => relayStatuses[r.relayId] === "failed").length;
  const totalCount  = relays.length;
  const powerLoad   = totalCount > 0 ? Math.round((onCount / totalCount) * 100) : 0;
  const ms          = totalCount === 0 ? "empty" : onCount === totalCount ? "all_active" : onCount > 0 || failedCount > 0 ? "partially_active" : "all_inactive";

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-headlights-page">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-studio-btn">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Studio
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }} data-testid="headlights-title">Studio: Main Headlights</h1>
            <p className="text-sm text-[#637083] mt-1">Control relay-based headlight arrays via ESP.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" onClick={handleActivateAll} disabled={loading || !relays.length || !espIp} data-testid="hl-activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs" onClick={handleDeactivateAll} disabled={loading || !relays.length || !espIp} data-testid="hl-deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>

        {/* ESP IP Config Bar */}
        <div className="bg-white border border-[#E5E7EB] rounded-md p-3 mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-4 h-4 text-[#637083]" strokeWidth={1.5} />
            <span className="text-xs text-[#637083] uppercase tracking-wider font-medium">ESP IP:</span>
          </div>
          <span className="text-sm font-medium text-[#1C2025]">{espIp || "Not configured"}</span>
          <Button size="sm" variant="outline" onClick={openIpDialog} className="rounded-md text-xs ml-auto">
            <Pencil className="w-3 h-3 mr-1" />{espIp ? "Change" : "Set IP"}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:items-start w-full">
          {/* Left: Relay Grid */}
          <div className="flex-1 w-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider" style={{ fontFamily: "Work Sans, sans-serif" }}>Headlight Grid</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View toggle */}
                <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                  {[["list", "List", List], ["grid", "Grid", Grid3X3]].map(([mode, label, Icon]) => (
                    <button key={mode} onClick={() => setViewMode(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === mode ? "bg-[#DA2C38] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
                {/* Grid-only controls */}
                {viewMode === "grid" && <>
                  <div className="flex items-center border border-[#E5E7EB] rounded-md overflow-hidden">
                    {[["edit", "Edit", Pencil], ["control", "Control", Check]].map(([mode, label, Icon]) => (
                      <button key={mode} onClick={() => setGridMode(mode)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${gridMode === mode ? "bg-[#1C2025] text-white" : "text-[#637083] hover:bg-[#F3F4F6]"}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)} className="rounded-md text-xs border-[#E5E7EB]">
                    <Settings2 className="w-3.5 h-3.5 mr-1" />{gridConfig.cols}×{gridConfig.rows}
                  </Button>
                  {/* Detail/Icon toggle */}
                  <button
                    onClick={() => setDisplayMode(displayMode === "detailed" ? "icon" : "detailed")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all select-none ${displayMode === "detailed" ? "bg-[#1C2025] border-[#1C2025] text-white" : "border-[#E5E7EB] text-[#637083] hover:bg-[#F3F4F6]"}`}>
                    <span className={`relative inline-flex items-center w-7 h-4 rounded-full transition-colors flex-shrink-0 ${displayMode === "detailed" ? "bg-[#DA2C38]" : "bg-[#D1D5DB]"}`}>
                      <span className={`absolute w-3 h-3 rounded-full bg-white shadow transition-transform ${displayMode === "detailed" ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </span>
                    Detail
                  </button>
                </>}
                {relays.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs" data-testid="hl-select-all-btn">
                    {selectedIds.length === relays.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
                <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-hl-device-btn">
                  <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Headlight
                </Button>
              </div>
            </div>

            <RelayModuleGrid
              relays={relays}
              selectedIds={selectedIds}
              relayStatuses={relayStatuses}
              viewMode={viewMode}
              gridConfig={gridConfig}
              gridLayout={gridLayout}
              gridMode={gridMode}
              displayMode={displayMode}
              onToggleSelect={handleToggleSelect}
              onControlSingle={handleControlSingle}
              onDelete={handleDelete}
              onEdit={openEdit}
              onAddAtCell={idx => { setEditingRelay(null); setDeviceName(""); setChannelCode(""); setDialogOpen(true); }}
              onLayoutChange={handleLayoutChange}
            />
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-72 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Selected Control Panel */}
            <SelectedControlPanel 
              count={selectedIds.length} 
              onAction={handleControlSelected} 
              loading={loading} 
            />

            {/* Saved Selections Panel */}
            <SavedSelectionPanel
              selections={adaptedSels}
              selectedIds={selectedIds}
              onSave={handleSaveSel}
              onApply={handleApplySel}
              onDelete={handleDeleteSel}
            />

            {/* Master Status */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3" data-testid="hl-master-status">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: "Work Sans, sans-serif" }}>Master Light Status</h3>
              <div className={`border rounded-md p-4 flex items-center gap-3 ${ms === "all_active" || ms === "partially_active" ? "border-[#DA2C38]" : "border-[#E5E7EB]"}`}>
                {ms === "all_inactive" || ms === "empty" ? <Power className="w-6 h-6 text-[#637083]" strokeWidth={1.5} /> : <Sun className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />}
                <div>
                  <p className={`text-sm font-semibold ${ms === "all_active" ? "text-[#10B981]" : ms === "partially_active" ? "text-[#DA2C38]" : "text-[#637083]"}`}>
                    {ms === "all_active" ? "ALL ACTIVE" : ms === "partially_active" ? "PARTIALLY ACTIVE" : ms === "empty" ? "NO DEVICES" : "ALL INACTIVE"}
                  </p>
                  <p className="text-xs text-[#637083]">{onCount} / {totalCount} Online</p>
                </div>
              </div>
              {failedCount > 0 && <div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B] font-medium">{failedCount} FAILED</span></div>}
            </div>

            {/* System Status */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: "Work Sans, sans-serif" }}>System Status</h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#637083]">POWER LOAD</span>
                  <span className="text-xs font-medium text-[#1C2025]">{powerLoad}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#DA2C38] rounded-full transition-all" style={{ width: `${powerLoad}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} /><span className="text-xs text-[#10B981] font-medium">ARRAYS NOMINAL</span></div>
            </div>

            {/* Scheduler */}
            <SchedulerPanel
              roomId={ROOM_ID}
              selections={adaptedSels}
              devices={relays.map(r => ({ id: r.relayId, name: r.deviceName, kode: r.relayId }))}
            />
          </div>
        </div>
      </div>

      {/* ESP IP Dialog */}
      <Dialog open={ipDialogOpen} onOpenChange={setIpDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="hl-ip-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Work Sans, sans-serif" }}>ESP IP Address</DialogTitle>
            <DialogDescription>Enter the IP address of the ESP controller.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleIpSave} className="space-y-4">
            <div className="space-y-2"><Label>IP Address</Label><Input data-testid="hl-ip-input" placeholder="192.168.1.5" value={ipInput} onChange={e => setIpInput(e.target.value)} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIpDialogOpen(false)} className="rounded-md">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="hl-ip-save-btn">{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Device Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="hl-device-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Work Sans, sans-serif" }}>{editingRelay ? "Edit Headlight" : "Add Headlight"}</DialogTitle>
            <DialogDescription>Enter device name and channel code.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Device Name</Label><Input data-testid="hl-device-name-input" value={deviceName} onChange={e => setDeviceName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Channel Code</Label><Input data-testid="hl-device-channel-input" value={channelCode} onChange={e => setChannelCode(e.target.value)} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="hl-device-save-btn">{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <GridConfigDialog open={configOpen} onOpenChange={setConfigOpen} initial={gridConfig} deviceCount={relays.length} onConfirm={handleGridConfigConfirm} />
    </div>
  );
}
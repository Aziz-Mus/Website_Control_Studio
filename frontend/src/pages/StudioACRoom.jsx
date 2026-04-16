import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Snowflake, Trash2, Sun, Power, Pencil, Thermometer, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TEMP_MIN = 16;
const TEMP_MAX = 30;

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

// Temperature Stepper Component (- [24°C] +)
function TempStepper({ value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(TEMP_MIN, value - 1))}
        disabled={disabled || value <= TEMP_MIN}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#E5E7EB] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-[#3B82F6] transition-colors"
        aria-label="Decrease temperature"
      >
        <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
      <span className="text-xs font-semibold text-[#1C2025] min-w-[38px] text-center">{value}°C</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(TEMP_MAX, value + 1))}
        disabled={disabled || value >= TEMP_MAX}
        className="w-6 h-6 flex items-center justify-center rounded border border-[#E5E7EB] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-[#3B82F6] transition-colors"
        aria-label="Increase temperature"
      >
        <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function StudioACRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const STORAGE_KEY = `ac_relay_statuses_${roomId}`;
  const TEMP_STORAGE_KEY = `ac_relay_temps_${roomId}`;

  const [room, setRoom] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRelay, setEditingRelay] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [channelCode, setChannelCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  // Load relay ON/OFF statuses from localStorage
  const [relayStatuses, setRelayStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));
  // Temperature per device: { relayId: pendingTemp }
  const [deviceTemps, setDeviceTemps] = useState(() => loadStorage(TEMP_STORAGE_KEY, {}));
  // Last confirmed temperature per device (persisted, reverts on failure)
  const [lastTemps, setLastTemps] = useState({});
  // Temperature loading per device
  const [tempLoading, setTempLoading] = useState({});
  // Master temperature control
  const [masterTemp, setMasterTemp] = useState(24);
  const [masterTempLoading, setMasterTempLoading] = useState(false);

  // Persist statuses and temps
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(relayStatuses)); }, [relayStatuses, STORAGE_KEY]);
  useEffect(() => { localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(deviceTemps)); }, [deviceTemps, TEMP_STORAGE_KEY]);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/ac/rooms/${roomId}`);
      const r = res.data.room;
      setRoom(r);
      // Initialize lastTemps from room data
      const lt = {};
      const dt = loadStorage(TEMP_STORAGE_KEY, {});
      (r.relays || []).forEach(rl => {
        lt[rl.relayId] = rl.lastTemperature || 24;
        if (dt[rl.relayId] === undefined) {
          dt[rl.relayId] = rl.lastTemperature || 24;
        }
      });
      setLastTemps(lt);
      setDeviceTemps(dt);
    } catch (e) { toast.error("Room tidak ditemukan"); navigate("/studio/ac"); }
  }, [roomId, navigate]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  const openAdd = () => { setEditingRelay(null); setDeviceName(""); setChannelCode(""); setDialogOpen(true); };
  const openEdit = (relay) => { setEditingRelay(relay); setDeviceName(relay.deviceName); setChannelCode(relay.channelCode); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!deviceName.trim() || !channelCode.trim()) return; setSaving(true);
    try {
      if (editingRelay) { await axios.put(`${API}/studio/ac/rooms/${roomId}/relays/${editingRelay.relayId}`, { deviceName: deviceName.trim(), channelCode: channelCode.trim() }); toast.success("Diupdate"); }
      else { await axios.post(`${API}/studio/ac/rooms/${roomId}/relays`, { deviceName: deviceName.trim(), channelCode: channelCode.trim() }); toast.success("Ditambahkan"); }
      fetchRoom(); setDialogOpen(false);
    } catch (e) { toast.error("Gagal"); } setSaving(false);
  };

  const handleDelete = async (relayId) => {
    try {
      await axios.delete(`${API}/studio/ac/rooms/${roomId}/relays/${relayId}`);
      toast.success("Dihapus");
      setRelayStatuses(p => { const n = { ...p }; delete n[relayId]; return n; });
      setDeviceTemps(p => { const n = { ...p }; delete n[relayId]; return n; });
      setLastTemps(p => { const n = { ...p }; delete n[relayId]; return n; });
      fetchRoom();
    } catch (e) { toast.error("Gagal"); }
  };

  const controlRelays = async (relays, action) => {
    if (!room) return; setLoading(true);
    const ep = action === "on" ? `${API}/studio/ac/control` : `${API}/studio/ac/deactivate`;
    const payload = { rooms: [{ roomId: room.roomId, espIpAddress: room.espIpAddress, relays: relays.map(r => ({ relayId: r.relayId, channelCode: r.channelCode })) }] };
    try {
      const res = await axios.post(ep, payload);
      const ns = {};
      res.data.rooms?.forEach(rm => rm.relays.forEach(rl => { ns[rl.relayId] = rl.status === "success" ? action : "failed"; }));
      setRelayStatuses(p => ({ ...p, ...ns }));
      const fc = Object.values(ns).filter(s => s === "failed").length;
      const sc = Object.values(ns).filter(s => s !== "failed").length;
      if (fc > 0 && sc > 0) toast.warning(`${sc} berhasil, ${fc} AC gagal`);
      else if (fc > 0) toast.error(`${fc} AC gagal`);
      else toast.success("Berhasil");
    } catch (e) { toast.error("Gagal"); }
    setLoading(false);
  };

  // Apply temperature to a single AC device
  const handleApplyTemp = async (relay) => {
    if (!room) return;
    const temp = deviceTemps[relay.relayId] ?? lastTemps[relay.relayId] ?? 24;
    const prevTemp = lastTemps[relay.relayId] ?? 24;
    setTempLoading(p => ({ ...p, [relay.relayId]: true }));
    try {
      const res = await axios.post(`${API}/studio/ac/temperature`, {
        roomId: room.roomId,
        espIpAddress: room.espIpAddress,
        relayId: relay.relayId,
        channelCode: relay.channelCode,
        temperature: temp
      });
      if (res.data.status === "success") {
        setLastTemps(p => ({ ...p, [relay.relayId]: temp }));
        toast.success(`Suhu AC "${relay.deviceName}" diset ke ${temp}°C`);
      } else {
        // Revert on failure
        setDeviceTemps(p => ({ ...p, [relay.relayId]: prevTemp }));
        toast.error(`Gagal set suhu "${relay.deviceName}"`);
      }
    } catch (e) {
      setDeviceTemps(p => ({ ...p, [relay.relayId]: prevTemp }));
      toast.error("Gagal menghubungi server");
    }
    setTempLoading(p => ({ ...p, [relay.relayId]: false }));
  };

  // Apply temperature to all AC devices in the room
  const handleApplyMasterTemp = async () => {
    if (!room) return;
    const relays = room.relays || [];
    if (relays.length === 0) { toast.error("Tidak ada device"); return; }
    const prevTemps = { ...lastTemps };
    setMasterTempLoading(true);
    try {
      const res = await axios.post(`${API}/studio/ac/temperature/all`, {
        roomId: room.roomId,
        espIpAddress: room.espIpAddress,
        temperature: masterTemp
      });

      const results = res.data.results || [];
      const newTemps = { ...lastTemps };
      const newDeviceTemps = { ...deviceTemps };
      results.forEach(r => {
        if (r.status === "success") {
          newTemps[r.relayId] = masterTemp;
          newDeviceTemps[r.relayId] = masterTemp;
        }
        // Failed ones revert to previous temp automatically (we don't update them)
      });
      setLastTemps(newTemps);
      setDeviceTemps(newDeviceTemps);

      const sc = res.data.summary?.success || 0;
      const fc = res.data.summary?.failed || 0;
      if (fc > 0 && sc > 0) toast.warning(`${sc} berhasil, ${fc} AC gagal diset suhu`);
      else if (fc > 0) toast.error(`Gagal set suhu ke ${fc} AC`);
      else toast.success(`Semua AC diset ke ${masterTemp}°C`);
    } catch (e) {
      toast.error("Gagal menghubungi server");
    }
    setMasterTempLoading(false);
  };

  if (!room) return <div className="min-h-screen bg-[#F7F8F9] flex items-center justify-center text-[#637083]">Loading...</div>;

  const relays = room.relays || [];
  const onCount = Object.values(relayStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(relayStatuses).filter(s => s === "failed").length;
  const ms = relays.length === 0 ? "empty" : onCount === relays.length ? "all_active" : onCount > 0 || failedCount > 0 ? "partially_active" : "all_inactive";

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-ac-room-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio/ac")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-ac-btn"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to AC Rooms</button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="ac-room-title">{room.roomName}</h1><p className="text-sm text-[#637083] mt-1">ESP: {room.espIpAddress} &middot; {relays.length} AC(s)</p></div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" onClick={() => controlRelays(relays, "on")} disabled={loading || !relays.length} data-testid="ac-activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs" onClick={() => controlRelays(relays, "off")} disabled={loading || !relays.length} data-testid="ac-deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider" style={{ fontFamily: 'Work Sans, sans-serif' }}>AC Devices</h2><Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-ac-btn"><Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add AC</Button></div>
            {relays.length === 0
              ? <div className="text-center py-12 text-[#637083]"><Snowflake className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} /><p className="text-sm">Belum ada AC.</p></div>
              : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {relays.map((relay) => {
                    const st = relayStatuses[relay.relayId] || "idle";
                    const bc = st === "on" ? "border-[#DA2C38]" : st === "failed" ? "border-[#F59E0B]" : "border-[#E5E7EB]";
                    const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : "bg-blue-50";
                    const ic = st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : "text-[#3B82F6]";
                    const pendingTemp = deviceTemps[relay.relayId] ?? lastTemps[relay.relayId] ?? 24;
                    const confirmedTemp = lastTemps[relay.relayId] ?? relay.lastTemperature ?? 24;
                    const isTempLoading = tempLoading[relay.relayId] || false;
                    return (
                      <div key={relay.relayId} data-testid={`ac-relay-${relay.relayId}`} className={`bg-white border-2 ${bc} rounded-md p-3 transition-all relative group`}>
                        <div className="flex flex-col items-center gap-2">
                          <div className={`p-2 rounded-md ${bg}`}><Snowflake className={`w-5 h-5 ${ic}`} strokeWidth={1.5} /></div>
                          <div className="text-center w-full">
                            <p className="text-[10px] uppercase tracking-wider text-[#637083]">CH {relay.channelCode}</p>
                            <p className="text-xs font-medium text-[#1C2025] truncate">{relay.deviceName}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${st === "on" ? "bg-[#10B981]" : st === "failed" ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"}`} />
                            <span className={`text-[10px] font-medium ${st === "on" ? "text-[#10B981]" : st === "failed" ? "text-[#F59E0B]" : "text-[#637083]"}`}>
                              {st === "on" ? "ON" : st === "failed" ? "FAILED" : st === "off" ? "OFF" : "IDLE"}
                            </span>
                          </div>

                          {/* ON/OFF buttons */}
                          <div className="flex gap-1 w-full">
                            <Button size="sm" className="flex-1 h-7 text-[10px] bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" onClick={() => controlRelays([relay], "on")} disabled={loading} data-testid={`ac-on-${relay.relayId}`}>ON</Button>
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] rounded-md" onClick={() => controlRelays([relay], "off")} disabled={loading} data-testid={`ac-off-${relay.relayId}`}>OFF</Button>
                          </div>

                          {/* Temperature control */}
                          <div className="w-full border-t border-[#F3F4F6] pt-2 space-y-1.5">
                            <TempStepper
                              value={pendingTemp}
                              onChange={(v) => setDeviceTemps(p => ({ ...p, [relay.relayId]: v }))}
                              disabled={isTempLoading}
                            />
                            <Button
                              size="sm"
                              className="w-full h-6 text-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-md"
                              onClick={() => handleApplyTemp(relay)}
                              disabled={isTempLoading}
                              data-testid={`ac-apply-temp-${relay.relayId}`}
                            >
                              {isTempLoading ? "..." : "Apply"}
                            </Button>
                            {/* Last set temperature display */}
                            <div className="flex items-center justify-center gap-1">
                              <Thermometer className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
                              <span className="text-[9px] text-[#637083]">Set: {confirmedTemp}°C</span>
                            </div>
                          </div>
                        </div>

                        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-0.5 rounded hover:bg-blue-50" onClick={() => openEdit(relay)} data-testid={`edit-ac-relay-${relay.relayId}`}><Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                          <button className="p-0.5 rounded hover:bg-red-50" onClick={() => handleDelete(relay.relayId)} data-testid={`delete-relay-${relay.relayId}`}><Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          {/* Right Panel: Status + Master Temperature */}
          <div className="lg:w-72 space-y-4">
            {/* Master AC Status */}
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="ac-master-status">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>Master AC Status</h3>
              <div className={`border rounded-md p-4 flex items-center gap-3 ${ms === "all_active" || ms === "partially_active" ? "border-[#DA2C38]" : "border-[#E5E7EB]"}`}>
                {ms === "all_inactive" || ms === "empty" ? <Power className="w-6 h-6 text-[#637083]" strokeWidth={1.5} /> : <Sun className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />}
                <div>
                  <p className={`text-sm font-semibold ${ms === "all_active" ? "text-[#10B981]" : ms === "partially_active" ? "text-[#DA2C38]" : "text-[#637083]"}`}>
                    {ms === "all_active" ? "ALL ACTIVE" : ms === "partially_active" ? "PARTIALLY ACTIVE" : ms === "empty" ? "NO DEVICES" : "ALL INACTIVE"}
                  </p>
                  <p className="text-xs text-[#637083]">{onCount} / {relays.length} Active</p>
                </div>
              </div>
              {failedCount > 0 && <div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B] font-medium">{failedCount} FAILED</span></div>}
            </div>

            {/* Master Temperature Control */}
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="ac-master-temp">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.5} />
                <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>Kendali Suhu Semua AC</h3>
              </div>
              <p className="text-[10px] text-[#637083]">Set suhu untuk semua device sekaligus</p>
              <div className="space-y-2">
                <TempStepper
                  value={masterTemp}
                  onChange={setMasterTemp}
                  disabled={masterTempLoading || relays.length === 0}
                />
                <Button
                  className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-md text-xs"
                  onClick={handleApplyMasterTemp}
                  disabled={masterTempLoading || relays.length === 0}
                  data-testid="ac-apply-master-temp-btn"
                >
                  {masterTempLoading ? "Menerapkan..." : `Apply ${masterTemp}°C ke Semua`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="ac-device-dialog">
          <DialogHeader><DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{editingRelay ? "Edit AC" : "Tambah AC"}</DialogTitle><DialogDescription>Masukkan nama dan channel code.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Device</Label><Input data-testid="add-ac-name-input" value={deviceName} onChange={e => setDeviceName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Channel Code</Label><Input data-testid="add-ac-channel-input" value={channelCode} onChange={e => setChannelCode(e.target.value)} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Batal</Button><Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="add-ac-save-btn">{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

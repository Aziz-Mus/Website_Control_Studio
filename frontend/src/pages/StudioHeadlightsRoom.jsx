import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Lamp, Trash2, Sun, Power, CheckCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function StudioHeadlightsRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const STORAGE_KEY = `hl_relay_statuses_${roomId}`;

  const [room, setRoom] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRelay, setEditingRelay] = useState(null);
  const [deviceName, setDeviceName] = useState("");
  const [channelCode, setChannelCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  // Load relay statuses from localStorage (set by StudioHeadlights switch or previous session)
  const [relayStatuses, setRelayStatuses] = useState(() => loadStorage(STORAGE_KEY, {}));

  // Persist relay statuses to localStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(relayStatuses)); }, [relayStatuses, STORAGE_KEY]);

  const fetchRoom = useCallback(async () => {
    try { const res = await axios.get(`${API}/studio/headlights/rooms/${roomId}`); setRoom(res.data.room); }
    catch (e) { toast.error("Room tidak ditemukan"); navigate("/studio/headlights"); }
  }, [roomId, navigate]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  const openAdd = () => { setEditingRelay(null); setDeviceName(""); setChannelCode(""); setDialogOpen(true); };
  const openEdit = (relay) => { setEditingRelay(relay); setDeviceName(relay.deviceName); setChannelCode(relay.channelCode); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceName.trim() || !channelCode.trim()) return;
    setSaving(true);
    try {
      if (editingRelay) {
        await axios.put(`${API}/studio/headlights/rooms/${roomId}/relays/${editingRelay.relayId}`, { deviceName: deviceName.trim(), channelCode: channelCode.trim() });
        toast.success("Device berhasil diupdate");
      } else {
        await axios.post(`${API}/studio/headlights/rooms/${roomId}/relays`, { deviceName: deviceName.trim(), channelCode: channelCode.trim() });
        toast.success(`Device "${deviceName}" ditambahkan`);
      }
      fetchRoom(); setDialogOpen(false);
    } catch (e) { toast.error("Gagal menyimpan"); }
    setSaving(false);
  };

  const handleDelete = async (relayId) => {
    try {
      await axios.delete(`${API}/studio/headlights/rooms/${roomId}/relays/${relayId}`);
      toast.success("Dihapus");
      setRelayStatuses(p => { const n = { ...p }; delete n[relayId]; return n; });
      fetchRoom();
    }
    catch (e) { toast.error("Gagal"); }
  };

  const controlRelays = async (relays, action) => {
    if (!room) return;
    setLoading(true);
    const ep = action === "on" ? `${API}/studio/headlights/control` : `${API}/studio/headlights/deactivate`;
    const payload = { rooms: [{ roomId: room.roomId, espIpAddress: room.espIpAddress, relays: relays.map(r => ({ relayId: r.relayId, channelCode: r.channelCode })) }] };
    try {
      const res = await axios.post(ep, payload);
      const ns = {};
      res.data.rooms?.forEach(rm => rm.relays.forEach(rl => { ns[rl.relayId] = rl.status === "success" ? action : "failed"; }));
      setRelayStatuses(p => ({ ...p, ...ns }));

      const fc = Object.values(ns).filter(s => s === "failed").length;
      const sc = Object.values(ns).filter(s => s !== "failed").length;
      if (fc > 0 && sc > 0) toast.warning(`${sc} berhasil, ${fc} device gagal`);
      else if (fc > 0) toast.error(`${fc} device gagal`);
      else toast.success("Berhasil");
    } catch (e) { toast.error("Gagal"); }
    setLoading(false);
  };

  const handleActivateAll = () => { const normal = (room?.relays || []).filter(r => !r.isOnAirExit); controlRelays(normal, "on"); };
  const handleDeactivateAll = () => { const normal = (room?.relays || []).filter(r => !r.isOnAirExit); controlRelays(normal, "off"); };

  if (!room) return <div className="min-h-screen bg-[#F7F8F9] flex items-center justify-center text-[#637083]">Loading...</div>;

  const normalRelays = (room.relays || []).filter(r => !r.isOnAirExit);
  const onCount = Object.values(relayStatuses).filter(s => s === "on").length;
  const failedCount = Object.values(relayStatuses).filter(s => s === "failed").length;
  const totalCount = normalRelays.length;
  const powerLoad = totalCount > 0 ? Math.round((onCount / totalCount) * 100) : 0;
  const ms = totalCount === 0 ? "empty" : onCount === totalCount ? "all_active" : onCount > 0 || failedCount > 0 ? "partially_active" : "all_inactive";

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-hl-room-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio/headlights")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-hl-rooms-btn">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Headlight Rooms
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="hl-room-title">{room.roomName}</h1>
            <p className="text-sm text-[#637083] mt-1">ESP: {room.espIpAddress} &middot; {normalRelays.length} headlight(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" onClick={handleActivateAll} disabled={loading || normalRelays.length === 0} data-testid="hl-activate-all-btn">ACTIVATE ALL</Button>
            <Button variant="outline" className="border-[#DA2C38] text-[#DA2C38] hover:bg-red-50 rounded-md text-xs" onClick={handleDeactivateAll} disabled={loading || normalRelays.length === 0} data-testid="hl-deactivate-all-btn">DEACTIVATE ALL</Button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#1C2025] uppercase tracking-wider" style={{ fontFamily: 'Work Sans, sans-serif' }}>Headlight Grid</h2>
              <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-hl-device-btn">
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Headlight
              </Button>
            </div>
            {normalRelays.length === 0 ? (
              <div className="text-center py-12 text-[#637083]" data-testid="hl-relays-empty"><Lamp className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} /><p className="text-sm">Belum ada headlight.</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {normalRelays.map((relay) => {
                  const st = relayStatuses[relay.relayId] || "idle";
                  const bc = st === "on" ? "border-[#DA2C38]" : st === "failed" ? "border-[#F59E0B]" : "border-[#E5E7EB]";
                  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : "bg-gray-50";
                  const ic = st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : "text-[#D1D5DB]";
                  return (
                    <div key={relay.relayId} data-testid={`hl-relay-${relay.relayId}`} className={`bg-white border-2 ${bc} rounded-md p-3 transition-all relative group`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`p-2 rounded-md ${bg}`}><Lamp className={`w-6 h-6 ${ic}`} strokeWidth={1.5} /></div>
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
                        <div className="flex gap-1 w-full">
                          <Button size="sm" className="flex-1 h-7 text-[10px] bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" onClick={() => controlRelays([relay], "on")} disabled={loading} data-testid={`hl-on-${relay.relayId}`}>ON</Button>
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] rounded-md" onClick={() => controlRelays([relay], "off")} disabled={loading} data-testid={`hl-off-${relay.relayId}`}>OFF</Button>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-0.5 rounded hover:bg-blue-50" onClick={() => openEdit(relay)} data-testid={`edit-hl-relay-${relay.relayId}`}><Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                        <button className="p-0.5 rounded hover:bg-red-50" onClick={() => handleDelete(relay.relayId)} data-testid={`delete-hl-relay-${relay.relayId}`}><Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="lg:w-72 space-y-4">
            {/* Master Light Status panel - syncs with switch from StudioHeadlights */}
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="hl-master-status">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>Master Light Status</h3>
              <div className={`border rounded-md p-4 flex items-center gap-3 ${ms === "all_active" || ms === "partially_active" ? "border-[#DA2C38]" : "border-[#E5E7EB]"}`}>
                {ms === "all_inactive" || ms === "empty" ? <Power className="w-6 h-6 text-[#637083]" strokeWidth={1.5} /> : <Sun className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />}
                <div>
                  <p className={`text-sm font-semibold ${ms === "all_active" ? "text-[#10B981]" : ms === "partially_active" ? "text-[#DA2C38]" : "text-[#637083]"}`}>
                    {ms === "all_active" ? "ALL ACTIVE" : ms === "partially_active" ? "PARTIALLY ACTIVE" : ms === "empty" ? "NO DEVICES" : "ALL INACTIVE"}</p>
                  <p className="text-xs text-[#637083]">{onCount} / {totalCount} Online</p>
                </div>
              </div>
              {failedCount > 0 && <div className="flex items-center gap-2 text-xs"><div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B] font-medium">{failedCount} FAILED</span></div>}
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>System Status</h3>
              <div><div className="flex items-center justify-between mb-1"><span className="text-xs text-[#637083]">POWER LOAD</span><span className="text-xs font-medium text-[#1C2025]">{powerLoad}%</span></div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#DA2C38] rounded-full transition-all" style={{ width: `${powerLoad}%` }} /></div></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} /><span className="text-xs text-[#10B981] font-medium">ALL ARRAYS NOMINAL</span></div>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="hl-device-dialog">
          <DialogHeader><DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{editingRelay ? "Edit Headlight" : "Tambah Headlight"}</DialogTitle><DialogDescription>Masukkan nama dan channel code.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Device</Label><Input data-testid="hl-device-name-input" value={deviceName} onChange={e => setDeviceName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Channel Code</Label><Input data-testid="hl-device-channel-input" value={channelCode} onChange={e => setChannelCode(e.target.value)} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Batal</Button><Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="hl-device-save-btn">{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

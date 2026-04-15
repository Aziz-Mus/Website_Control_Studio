import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Lamp, Trash2, Wifi, Pencil, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StudioHeadlights() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [espIp, setEspIp] = useState("");
  const [connectSwitch, setConnectSwitch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasOnAirConnected, setHasOnAirConnected] = useState(false);
  const [roomSwitchStates, setRoomSwitchStates] = useState({});
  const [roomSwitchLoading, setRoomSwitchLoading] = useState({});

  const fetchRooms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/headlights/rooms`);
      const r = res.data.rooms || [];
      setRooms(r);
      setHasOnAirConnected(r.some(rm => rm.onAirExitConnected));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openAdd = () => { setEditingRoom(null); setRoomName(""); setEspIp(""); setConnectSwitch(false); setDialogOpen(true); };
  const openEdit = (room) => { setEditingRoom(room); setRoomName(room.roomName); setEspIp(room.espIpAddress); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !espIp.trim()) return;
    setSaving(true);
    try {
      if (editingRoom) {
        await axios.put(`${API}/studio/headlights/rooms/${editingRoom.roomId}`, { roomName: roomName.trim(), espIpAddress: espIp.trim() });
        toast.success("Room berhasil diupdate");
      } else {
        await axios.post(`${API}/studio/headlights/rooms`, { roomName: roomName.trim(), espIpAddress: espIp.trim(), connectOnAirExit: connectSwitch });
        toast.success(`Room "${roomName}" berhasil ditambahkan`);
      }
      fetchRooms(); setDialogOpen(false);
    } catch (e) { toast.error("Gagal menyimpan room"); }
    setSaving(false);
  };

  const handleDelete = async (roomId) => {
    try { await axios.delete(`${API}/studio/headlights/rooms/${roomId}`); toast.success("Room dihapus"); fetchRooms(); }
    catch (e) { toast.error("Gagal menghapus"); }
  };

  const handleRoomSwitch = async (room, checked) => {
    const normalRelays = (room.relays || []).filter(r => !r.isOnAirExit);
    if (normalRelays.length === 0) { toast.error("Tidak ada device di room ini"); return; }
    setRoomSwitchLoading(p => ({ ...p, [room.roomId]: true }));
    const ep = checked ? `${API}/studio/headlights/control` : `${API}/studio/headlights/deactivate`;
    const payload = { rooms: [{ roomId: room.roomId, espIpAddress: room.espIpAddress, relays: normalRelays.map(r => ({ relayId: r.relayId, channelCode: r.channelCode })) }] };
    try {
      const res = await axios.post(ep, payload);
      const sc = res.data.summary?.success || 0;
      const fc = res.data.summary?.failed || 0;
      if (sc > 0) {
        setRoomSwitchStates(p => ({ ...p, [room.roomId]: checked }));
        toast.success(`${sc} device ${checked ? "dinyalakan" : "dimatikan"}`);
      }
      if (fc > 0) {
        setRoomSwitchStates(p => ({ ...p, [room.roomId]: false }));
        toast.error(`${fc} device gagal`);
      }
    } catch (e) {
      setRoomSwitchStates(p => ({ ...p, [room.roomId]: false }));
      toast.error("Gagal mengendalikan");
    }
    setRoomSwitchLoading(p => ({ ...p, [room.roomId]: false }));
  };

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-headlights-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-studio-btn">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Studio
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="headlights-title">Studio: Main Headlights</h1>
            <p className="text-sm text-[#637083] mt-1">Control high-precision lighting arrays. Add rooms and configure headlight relays.</p>
          </div>
          <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-hl-room-btn">
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Room
          </Button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-16 text-[#637083]" data-testid="hl-rooms-empty">
            <Lamp className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
            <p className="text-sm">Belum ada room yang ditambahkan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {rooms.map((room) => (
              <div key={room.roomId} data-testid={`hl-room-${room.roomId}`}
                className="bg-white border border-[#E5E7EB] rounded-md p-4 hover:shadow-md hover:border-[#DA2C38] transition-all cursor-pointer group relative"
                onClick={() => navigate(`/studio/headlights/${room.roomId}`)}>
                {/* Top-left: Switch to control all devices */}
                <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    data-testid={`room-switch-${room.roomId}`}
                    checked={roomSwitchStates[room.roomId] || false}
                    onCheckedChange={(checked) => handleRoomSwitch(room, checked)}
                    disabled={roomSwitchLoading[room.roomId] || (room.relays || []).filter(r => !r.isOnAirExit).length === 0}
                    className="data-[state=checked]:bg-[#DA2C38] scale-75"
                  />
                </div>                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-md bg-red-50"><Lamp className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} /></div>
                  <div className="text-center w-full">
                    <p className="text-[10px] uppercase tracking-wider text-[#637083]">{room.roomId}</p>
                    <p className="text-sm font-medium text-[#1C2025] truncate" title={room.roomName}>{room.roomName}</p>
                  </div>
                  <div className="flex items-center gap-1"><Wifi className="w-3 h-3 text-[#637083]" strokeWidth={1.5} /><span className="text-[10px] text-[#637083] truncate">{room.espIpAddress}</span></div>
                  <p className="text-[10px] text-[#637083]">{(room.relays || []).filter(r => !r.isOnAirExit).length} device(s)</p>
                  {room.onAirExitConnected && (
                    <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded">
                      <Radio className="w-3 h-3 text-[#DA2C38]" strokeWidth={2} />
                      <span className="text-[9px] text-[#DA2C38] font-medium">ON AIR/EXIT</span>
                    </div>
                  )}
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-testid={`edit-hl-room-${room.roomId}`} className="p-1 rounded hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openEdit(room); }}>
                    <Pencil className="w-3 h-3 text-[#637083]" strokeWidth={1.5} />
                  </button>
                  <button data-testid={`delete-hl-room-${room.roomId}`} className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDelete(room.roomId); }}>
                    <Trash2 className="w-3 h-3 text-[#637083]" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="hl-room-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{editingRoom ? "Edit Room" : "Tambah Room Baru"}</DialogTitle>
            <DialogDescription>{editingRoom ? "Update nama dan IP room." : "Masukkan nama room dan IP ESP."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Room</Label>
              <Input data-testid="hl-room-name-input" placeholder="Studio Utama" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>ESP IP Address</Label>
              <Input data-testid="hl-room-ip-input" placeholder="192.168.1.5" value={espIp} onChange={(e) => setEspIp(e.target.value)} required />
            </div>
            {!editingRoom && !hasOnAirConnected && (
              <div className="border border-[#E5E7EB] rounded-md p-3 space-y-2" data-testid="onair-exit-connect-section">
                <Label className="text-xs text-[#637083]">Connect Switch On Air/Exit?</Label>
                <Button type="button" size="sm" variant={connectSwitch ? "default" : "outline"}
                  className={`w-full text-xs rounded-md ${connectSwitch ? "bg-[#DA2C38] hover:bg-[#B9252F] text-white" : ""}`}
                  onClick={() => setConnectSwitch(!connectSwitch)} data-testid="connect-onair-btn">
                  <Radio className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                  {connectSwitch ? "Connected - On Air/Exit akan terhubung" : "Klik untuk hubungkan On Air/Exit"}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Batal</Button>
              <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="hl-room-save-btn">
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Snowflake, Trash2, Wifi, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StudioAC() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [espIp, setEspIp] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRooms = useCallback(async () => { try { const res = await axios.get(`${API}/studio/ac/rooms`); setRooms(res.data.rooms || []); } catch (e) { console.error(e); } }, []);
  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openAdd = () => { setEditingRoom(null); setRoomName(""); setEspIp(""); setDialogOpen(true); };
  const openEdit = (room) => { setEditingRoom(room); setRoomName(room.roomName); setEspIp(room.espIpAddress); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!roomName.trim() || !espIp.trim()) return; setSaving(true);
    try {
      if (editingRoom) { await axios.put(`${API}/studio/ac/rooms/${editingRoom.roomId}`, { roomName: roomName.trim(), espIpAddress: espIp.trim() }); toast.success("Room diupdate"); }
      else { await axios.post(`${API}/studio/ac/rooms`, { roomName: roomName.trim(), espIpAddress: espIp.trim() }); toast.success(`Room "${roomName}" ditambahkan`); }
      fetchRooms(); setDialogOpen(false);
    } catch (e) { toast.error("Gagal"); } setSaving(false);
  };
  const handleDelete = async (roomId) => { try { await axios.delete(`${API}/studio/ac/rooms/${roomId}`); toast.success("Dihapus"); fetchRooms(); } catch (e) { toast.error("Gagal"); } };

  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-ac-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button onClick={() => navigate("/studio")} className="flex items-center gap-1.5 text-sm text-[#637083] hover:text-[#1C2025] mb-4 transition-colors" data-testid="back-to-studio-btn"><ArrowLeft className="w-4 h-4" strokeWidth={1.5} />Back to Studio</button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="studio-ac-title">Studio: AC Controls</h1><p className="text-sm text-[#637083] mt-1">Manage AC by room.</p></div>
          <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-room-btn"><Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Room</Button>
        </div>
        {rooms.length === 0 ? (
          <div className="text-center py-16 text-[#637083]" data-testid="ac-rooms-empty"><Snowflake className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} /><p className="text-sm">Belum ada room.</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {rooms.map((room) => (
              <div key={room.roomId} data-testid={`ac-room-${room.roomId}`} className="bg-white border border-[#E5E7EB] rounded-md p-4 hover:shadow-md hover:border-[#DA2C38] transition-all cursor-pointer group relative" onClick={() => navigate(`/studio/ac/${room.roomId}`)}>
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-md bg-blue-50"><Snowflake className="w-6 h-6 text-[#3B82F6]" strokeWidth={1.5} /></div>
                  <div className="text-center w-full"><p className="text-[10px] uppercase tracking-wider text-[#637083]">{room.roomId}</p><p className="text-sm font-medium text-[#1C2025] truncate">{room.roomName}</p></div>
                  <div className="flex items-center gap-1"><Wifi className="w-3 h-3 text-[#637083]" strokeWidth={1.5} /><span className="text-[10px] text-[#637083] truncate">{room.espIpAddress}</span></div>
                  <p className="text-[10px] text-[#637083]">{(room.relays || []).length} relay(s)</p>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 rounded hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); openEdit(room); }} data-testid={`edit-room-${room.roomId}`}><Pencil className="w-3 h-3 text-[#637083]" strokeWidth={1.5} /></button>
                  <button className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDelete(room.roomId); }} data-testid={`delete-room-${room.roomId}`}><Trash2 className="w-3 h-3 text-[#637083]" strokeWidth={1.5} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="ac-room-dialog">
          <DialogHeader><DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{editingRoom ? "Edit Room" : "Tambah Room"}</DialogTitle><DialogDescription>Masukkan nama dan IP ESP.</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Nama Room</Label><Input data-testid="add-room-name-input" value={roomName} onChange={e => setRoomName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>ESP IP Address</Label><Input data-testid="add-room-ip-input" value={espIp} onChange={e => setEspIp(e.target.value)} required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Batal</Button><Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="add-room-save-btn">{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

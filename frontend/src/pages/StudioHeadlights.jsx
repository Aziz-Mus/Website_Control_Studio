import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Lamp, Trash2, Wifi, Pencil, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";
import SelectedControlPanel from "@/components/shared/SelectedControlPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function StudioHeadlights() {
  const navigate = useNavigate();
  const [rooms,             setRooms]           = useState([]);
  const [dialogOpen,        setDialogOpen]       = useState(false);
  const [editingRoom,       setEditingRoom]       = useState(null);
  const [roomName,          setRoomName]          = useState("");
  const [espIp,             setEspIp]             = useState("");
  const [saving,            setSaving]            = useState(false);
  const [loading,           setLoading]           = useState(false);

  // Switch states computed from relay localStorage
  const [roomSwitchStates,  setRoomSwitchStates]  = useState({});
  const [roomSwitchLoading, setRoomSwitchLoading] = useState({});

  // Selection
  const [selectedRoomIds,   setSelectedRoomIds]   = useState([]);
  const [savedRoomSels,     setSavedRoomSels]      = useState([]);
  const [selName,           setSelName]            = useState("");

  // Compute switch state from localStorage relay statuses
  const computeSwitchStates = useCallback((roomList) => {
    const states = {};
    roomList.forEach(room => {
      const relayStatuses = loadStorage(`hl_relay_statuses_${room.roomId}`, {});
      const allRelays = (room.relays || []);
      states[room.roomId] = allRelays.length > 0 && allRelays.every(r => relayStatuses[r.relayId] === "on");
    });
    setRoomSwitchStates(states);
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/headlights/rooms`);
      const r = res.data.rooms || [];
      setRooms(r);
      computeSwitchStates(r);
    } catch { console.error("Failed to fetch rooms"); }
  }, [computeSwitchStates]);

  const fetchSavedRoomSels = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/headlights/saved-rooms`);
      setSavedRoomSels(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchRooms(); fetchSavedRoomSels(); }, [fetchRooms, fetchSavedRoomSels]);

  // Recompute switch when page becomes visible
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) computeSwitchStates(rooms); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [rooms, computeSwitchStates]);

  // ── Room CRUD ──────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditingRoom(null); setRoomName(""); setEspIp(""); setDialogOpen(true); };
  const openEdit = (room) => { setEditingRoom(room); setRoomName(room.roomName); setEspIp(room.espIpAddress); setDialogOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !espIp.trim()) return;
    setSaving(true);
    try {
      if (editingRoom) {
        await axios.put(`${API}/studio/headlights/rooms/${editingRoom.roomId}`, { roomName: roomName.trim(), espIpAddress: espIp.trim() });
        toast.success("Room updated");
      } else {
        await axios.post(`${API}/studio/headlights/rooms`, { roomName: roomName.trim(), espIpAddress: espIp.trim() });
        toast.success(`Room "${roomName}" added`);
      }
      fetchRooms(); setDialogOpen(false);
    } catch { toast.error("Failed to save room"); }
    setSaving(false);
  };

  const handleDelete = async (roomId) => {
    try { await axios.delete(`${API}/studio/headlights/rooms/${roomId}`); toast.success("Room deleted"); fetchRooms(); }
    catch { toast.error("Failed to delete room"); }
  };

  // ── Room Switch (ON/OFF all relays in room) ────────────────────────────────
  const handleRoomSwitch = async (room, checked) => {
    const allRelays = (room.relays || []);
    if (!allRelays.length) { toast.error("No devices in this room"); return; }
    setRoomSwitchLoading(p => ({ ...p, [room.roomId]: true }));
    const ep      = checked ? `${API}/studio/headlights/control` : `${API}/studio/headlights/deactivate`;
    const payload = { rooms: [{ roomId: room.roomId, espIpAddress: room.espIpAddress, relays: allRelays.map(r => ({ relayId: r.relayId, channelCode: r.channelCode })) }] };
    try {
      const res = await axios.post(ep, payload);
      const relayResults = res.data.rooms?.[0]?.relays || [];
      if (relayResults.length > 0) {
        const action = checked ? "on" : "off";
        const ns = {};
        relayResults.forEach(rl => { ns[rl.relayId] = rl.status === "success" ? action : "failed"; });
        const existing = loadStorage(`hl_relay_statuses_${room.roomId}`, {});
        localStorage.setItem(`hl_relay_statuses_${room.roomId}`, JSON.stringify({ ...existing, ...ns }));
      }
      const sc = res.data.summary?.success || 0;
      const fc = res.data.summary?.failed  || 0;
      computeSwitchStates(rooms);
      if (fc > 0 && sc > 0) toast.warning(`${sc} ok, ${fc} failed`);
      else if (fc > 0) toast.error(`${fc} failed`);
      else toast.success(`${sc} device(s) ${checked ? "on" : "off"}`);
    } catch { computeSwitchStates(rooms); toast.error("Control failed"); }
    setRoomSwitchLoading(p => ({ ...p, [room.roomId]: false }));
  };

  // ── Room Selection ─────────────────────────────────────────────────────────
  const handleToggleRoomSelect = (roomId) =>
    setSelectedRoomIds(p => p.includes(roomId) ? p.filter(id => id !== roomId) : [...p, roomId]);
  const handleSelectAll = () =>
    setSelectedRoomIds(selectedRoomIds.length === rooms.length ? [] : rooms.map(r => r.roomId));

  // ── Control Selected Rooms ─────────────────────────────────────────────────
  const handleControlSelected = async (action) => {
    const targetRooms = rooms.filter(r => selectedRoomIds.includes(r.roomId) && (r.relays || []).length > 0);
    if (!targetRooms.length) return;
    setLoading(true);
    const ep      = action === "on" ? `${API}/studio/headlights/control` : `${API}/studio/headlights/deactivate`;
    const payload = {
      rooms: targetRooms.map(room => ({
        roomId: room.roomId,
        espIpAddress: room.espIpAddress,
        relays: (room.relays || []).map(r => ({ relayId: r.relayId, channelCode: r.channelCode })),
      })),
    };
    try {
      const res = await axios.post(ep, payload);
      // Update localStorage for each room
      res.data.rooms?.forEach(rm => {
        const ns = {};
        rm.relays.forEach(rl => { ns[rl.relayId] = rl.status === "success" ? action : "failed"; });
        const existing = loadStorage(`hl_relay_statuses_${rm.roomId}`, {});
        localStorage.setItem(`hl_relay_statuses_${rm.roomId}`, JSON.stringify({ ...existing, ...ns }));
      });
      computeSwitchStates(rooms);
      const sc = res.data.summary?.success || 0;
      const fc = res.data.summary?.failed  || 0;
      if (fc > 0 && sc > 0) toast.warning(`${sc} ok, ${fc} failed`);
      else if (fc > 0) toast.error(`${fc} failed`);
      else toast.success(`${selectedRoomIds.length} room(s) ${action === "on" ? "activated" : "deactivated"}`);
    } catch { toast.error("Control failed"); }
    setLoading(false);
  };

  // ── Saved Room Selections ──────────────────────────────────────────────────
  const handleSaveRoomSel = async () => {
    if (!selName.trim() || !selectedRoomIds.length) return;
    try {
      await axios.post(`${API}/studio/headlights/saved-rooms`, { name: selName.trim(), kodes: selectedRoomIds });
      toast.success(`"${selName}" saved`);
      setSelName("");
      fetchSavedRoomSels();
    } catch { toast.error("Failed to save group"); }
  };

  const handleDeleteRoomSel = async (id) => {
    try { await axios.delete(`${API}/studio/headlights/saved-rooms/${id}`); fetchSavedRoomSels(); } catch {}
  };

  const isSavedSelActive = (sel) => {
    if (!sel.room_ids?.length) return false;
    return sel.room_ids.every(id => selectedRoomIds.includes(id));
  };

  const handleToggleSavedSel = (sel) => {
    const valid = (sel.room_ids || []).filter(id => rooms.some(r => r.roomId === id));
    const active = isSavedSelActive(sel);
    if (active) {
      setSelectedRoomIds(prev => prev.filter(id => !valid.includes(id)));
      toast.success(`"${sel.name}" deselected`);
    } else {
      setSelectedRoomIds(prev => Array.from(new Set([...prev, ...valid])));
      toast.success(`"${sel.name}" added to selection`);
    }
  };

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
            <p className="text-sm text-[#637083] mt-1">Control high-precision lighting arrays. Add rooms and configure headlight relays.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {rooms.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="rounded-md text-xs">
                {selectedRoomIds.length === rooms.length ? "Deselect All" : "Select All"}
              </Button>
            )}
            <Button size="sm" onClick={openAdd} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid="add-hl-room-btn">
              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />Add Room
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
          {/* Room Grid */}
          <div className="flex-1">
            {rooms.length === 0 ? (
              <div className="text-center py-16 text-[#637083]" data-testid="hl-rooms-empty">
                <Lamp className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
                <p className="text-sm">No rooms added yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {rooms.map((room) => {
                  const isSelected = selectedRoomIds.includes(room.roomId);
                  return (
                    <div key={room.roomId} data-testid={`hl-room-${room.roomId}`}
                      className={`bg-white border-2 rounded-md p-4 hover:shadow-md transition-all cursor-pointer group relative ${isSelected ? "border-[#DA2C38] shadow-md" : "border-[#E5E7EB] hover:border-[#DA2C38]"}`}
                      onClick={() => handleToggleRoomSelect(room.roomId)}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-full bg-[#DA2C38] flex items-center justify-center z-10">
                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                      {/* Switch */}
                      <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                        <Switch
                          data-testid={`room-switch-${room.roomId}`}
                          checked={roomSwitchStates[room.roomId] || false}
                          onCheckedChange={checked => handleRoomSwitch(room, checked)}
                          disabled={roomSwitchLoading[room.roomId] || !(room.relays || []).length}
                          className="data-[state=checked]:bg-[#DA2C38] scale-75"
                        />
                      </div>
                      {/* Card content */}
                      <div className="flex flex-col items-center gap-2 pt-2">
                        <div className={`p-2.5 rounded-md ${isSelected ? "bg-red-50" : "bg-red-50"}`}>
                          <Lamp className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />
                        </div>
                        <div className="text-center w-full">
                          <p className="text-[10px] uppercase tracking-wider text-[#637083]">{room.roomId}</p>
                          <p className="text-sm font-medium text-[#1C2025] truncate" title={room.roomName}>{room.roomName}</p>
                        </div>
                        <div className="flex items-center gap-1"><Wifi className="w-3 h-3 text-[#637083]" strokeWidth={1.5} /><span className="text-[10px] text-[#637083] truncate">{room.espIpAddress}</span></div>
                        <p className="text-[10px] text-[#637083]">{(room.relays || []).length} device(s)</p>
                        <Button size="sm" variant="link" className="text-[10px] text-[#DA2C38] h-auto p-0" onClick={e => { e.stopPropagation(); navigate(`/studio/headlights/${room.roomId}`); }}>
                          Open Room →
                        </Button>
                      </div>
                      {/* Edit/Delete hover */}
                      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button data-testid={`edit-hl-room-${room.roomId}`} className="p-1 rounded hover:bg-blue-50" onClick={e => { e.stopPropagation(); openEdit(room); }}>
                          <Pencil className="w-3 h-3 text-[#637083]" strokeWidth={1.5} />
                        </button>
                        <button data-testid={`delete-hl-room-${room.roomId}`} className="p-1 rounded hover:bg-red-50" onClick={e => { e.stopPropagation(); handleDelete(room.roomId); }}>
                          <Trash2 className="w-3 h-3 text-[#637083]" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Saved Room Selections */}
          {rooms.length > 0 && (
            <div className="w-full lg:w-72 lg:sticky lg:top-20 lg:self-start space-y-4">
              {/* Selected Control Panel */}
              <SelectedControlPanel
                count={selectedRoomIds.length}
                onAction={handleControlSelected}
                loading={loading}
                unit="rooms"
              />

              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#DA2C38]" strokeWidth={2} />
                  <h3 className="text-sm font-semibold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>Saved Room Groups</h3>
                </div>
                {/* Save current */}
                <div className="space-y-2">
                  <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">
                    Save Current ({selectedRoomIds.length} selected)
                  </p>
                  <div className="flex gap-2">
                    <Input value={selName} onChange={e => setSelName(e.target.value)} placeholder="e.g. Studio Utama" className="text-xs h-8 rounded-md" onKeyDown={e => e.key === "Enter" && handleSaveRoomSel()} />
                    <Button size="sm" onClick={handleSaveRoomSel} disabled={!selName.trim() || !selectedRoomIds.length}
                      className="h-8 px-3 bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs whitespace-nowrap">Save</Button>
                  </div>
                  {!selectedRoomIds.length && <p className="text-[10px] text-[#9CA3AF]">Select at least 1 room to save.</p>}
                </div>
                {/* Saved list */}
                {savedRoomSels.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">Saved</p>
                    <div className={`space-y-1.5 ${savedRoomSels.length > 5 ? "max-h-[200px] overflow-y-auto pr-1" : ""}`} style={savedRoomSels.length > 5 ? { scrollbarWidth: "thin" } : undefined}>
                      {savedRoomSels.map(sel => {
                        const active = isSavedSelActive(sel);
                        return (
                          <div key={sel.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors group cursor-pointer ${active ? "border-[#DA2C38] bg-red-50" : "border-[#E5E7EB] hover:border-[#DA2C38]"}`}
                            onClick={() => handleToggleSavedSel(sel)}>
                            <div className="flex-1">
                              <p className={`text-xs font-medium ${active ? "text-[#DA2C38]" : "text-[#1C2025]"}`}>{sel.name}</p>
                              <p className="text-[10px] text-[#9CA3AF]">{sel.room_ids?.length ?? 0} room(s)</p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleDeleteRoomSel(sel.id); }}
                              className="p-1 rounded hover:bg-red-50 text-[#637083] opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF] text-center py-2">No saved groups yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Room Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-md" data-testid="hl-room-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Work Sans, sans-serif" }}>{editingRoom ? "Edit Room" : "Add New Room"}</DialogTitle>
            <DialogDescription>{editingRoom ? "Update room name and ESP IP address." : "Enter room name and ESP IP address."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Room Name</Label><Input data-testid="hl-room-name-input" placeholder="Main Studio" value={roomName} onChange={e => setRoomName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>ESP IP Address</Label><Input data-testid="hl-room-ip-input" placeholder="192.168.1.5" value={espIp} onChange={e => setEspIp(e.target.value)} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-md">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="hl-room-save-btn">{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

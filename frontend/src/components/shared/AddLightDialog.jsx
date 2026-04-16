import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AddLightDialog({ open, onOpenChange, onAdd, editingDevice, onUpdate }) {
  const [ip, setIp] = useState("");
  const [nama, setNama] = useState("");
  const [loading, setLoading] = useState(false);

  const isEdit = !!editingDevice;

  // Sync fields when editingDevice changes (Bug Fix: was using useState instead of useEffect)
  useEffect(() => {
    if (editingDevice) {
      setIp(editingDevice.ip || "");
      setNama(editingDevice.nama || "");
    } else {
      setIp("");
      setNama("");
    }
  }, [editingDevice]);

  // Also sync when dialog opens
  const handleOpen = (o) => {
    if (o && editingDevice) {
      setIp(editingDevice.ip || "");
      setNama(editingDevice.nama || "");
    } else if (o) {
      setIp("");
      setNama("");
    }
    onOpenChange(o);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ip.trim() || !nama.trim()) return;
    setLoading(true);
    if (isEdit && onUpdate) { await onUpdate(editingDevice.kode, { ip: ip.trim(), nama: nama.trim() }); }
    else { await onAdd({ ip: ip.trim(), nama: nama.trim() }); }
    setLoading(false);
    setIp(""); setNama("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md rounded-md" data-testid="add-light-dialog">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{isEdit ? "Edit Lampu" : "Tambah Lampu Baru"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update IP dan nama lampu." : "Masukkan IP dan nama lampu."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>IP Lampu</Label>
            <Input data-testid="add-light-ip-input" placeholder="192.168.1.100" value={ip} onChange={(e) => setIp(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Nama Lampu</Label>
            <Input data-testid="add-light-name-input" placeholder="Lampu Utama" value={nama} onChange={(e) => setNama(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-md">Batal</Button>
            <Button type="submit" disabled={loading || !ip.trim() || !nama.trim()} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="add-light-save-btn">
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

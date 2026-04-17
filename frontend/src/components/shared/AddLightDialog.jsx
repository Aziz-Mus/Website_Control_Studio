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

  useEffect(() => {
    if (editingDevice) {
      setIp(editingDevice.ip || "");
      setNama(editingDevice.nama || "");
    } else {
      setIp("");
      setNama("");
    }
  }, [editingDevice]);

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
          <DialogTitle style={{ fontFamily: 'Work Sans, sans-serif' }}>{isEdit ? "Edit Light" : "Add New Light"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update the light's IP address and name." : "Enter the light's IP address and name."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>IP Address</Label>
            <Input data-testid="add-light-ip-input" placeholder="192.168.1.100" value={ip} onChange={(e) => setIp(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Light Name</Label>
            <Input data-testid="add-light-name-input" placeholder="Main Light" value={nama} onChange={(e) => setNama(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-md">Cancel</Button>
            <Button type="submit" disabled={loading || !ip.trim() || !nama.trim()} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md" data-testid="add-light-save-btn">
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

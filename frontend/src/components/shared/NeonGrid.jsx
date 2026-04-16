import { Lightbulb, AlertTriangle, Trash2, Pencil } from "lucide-react";

export default function NeonGrid({ devices, selectedIds, onToggleSelect, onDelete, onEdit, deviceStatuses = {} }) {
  if (!devices || devices.length === 0) {
    return (
      <div className="text-center py-12 text-[#637083]" data-testid="neon-grid-empty">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
        <p className="text-sm">Belum ada lampu yang ditambahkan.</p>
        <p className="text-xs mt-1">Klik "Add Light" untuk menambahkan lampu baru.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="neon-grid">
      {devices.map((device) => {
        const isSelected = selectedIds.includes(device.kode);
        const st = deviceStatuses[device.kode] || "idle";

        // Bug Fix: Border ONLY follows selection state, not device status.
        // This allows unselecting a card back to gray even if status is ON or FAILED.
        const bc = isSelected ? "border-[#DA2C38]" : "border-[#E5E7EB]";

        // Background still follows status for visual feedback inside the card
        const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : isSelected ? "bg-red-50" : "bg-gray-50";

        return (
          <div key={device.kode} data-testid={`neon-module-${device.kode}`}
            className={`module-card relative bg-white border-2 rounded-md p-3 cursor-pointer transition-all ${bc}`}
            onClick={() => onToggleSelect(device.kode)}>
            {st === "failed" && <div className="absolute top-1.5 left-1.5 warning-indicator"><AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={2} /></div>}
            <div className="flex flex-col items-center gap-2">
              <div className={`p-2 rounded-md ${bg}`}>
                <Lightbulb className={`w-5 h-5 ${st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : isSelected ? "text-[#DA2C38]" : "text-[#637083]"}`} strokeWidth={1.5} />
              </div>
              <div className="text-center w-full">
                <p className="text-[10px] uppercase tracking-wider text-[#637083]">Kode {device.kode}</p>
                <p className="text-xs font-medium text-[#1C2025] truncate" title={device.nama}>{device.nama}</p>
                {device.ip && <p className="text-[10px] text-[#637083] truncate" title={device.ip}>{device.ip}</p>}
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${st === "on" ? "bg-[#10B981]" : st === "failed" ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"}`} />
                <span className={`text-[10px] font-medium ${st === "on" ? "text-[#10B981]" : st === "failed" ? "text-[#F59E0B]" : "text-[#637083]"}`}>
                  {st === "on" ? "ON" : st === "failed" ? "FAILED" : st === "off" ? "OFF" : "IDLE"}
                </span>
              </div>
            </div>
            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
              {onEdit && <button className="p-1 rounded hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); onEdit(device); }} data-testid={`edit-light-${device.kode}`}><Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>}
              <button className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(device.kode); }} data-testid={`delete-light-${device.kode}`}><Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

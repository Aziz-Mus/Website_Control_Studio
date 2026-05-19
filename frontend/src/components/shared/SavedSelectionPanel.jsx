import { useState } from "react";
import { Bookmark, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * SavedSelectionPanel
 * Props:
 *   selections   : [{ id, name, device_ids }]   — device_ids berisi integer kode
 *   selectedIds  : current selected kodes (numbers)
 *   onSave       : (name, kodes) => void
 *   onApply      : (sel) => void   — receives { ...sel, _action: "select"|"deselect" }
 *   onDelete     : (id) => void
 */
export default function SavedSelectionPanel({ selections = [], selectedIds = [], onSave, onApply, onDelete }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const MAX_VISIBLE = 5;

  const handleSave = async () => {
    if (!name.trim() || !selectedIds.length) return;
    setSaving(true);
    await onSave?.(name.trim(), selectedIds);
    setName("");
    setSaving(false);
  };

  // Normalkan device_ids ke array (support integer kode dan string relayId)
  const getKodes = (sel) => sel.device_ids || sel.kodes || [];

  // Cek apakah seluruh kode dari sel sudah ada di selectedIds (perbandingan string-safe)
  const isSelActive = (sel) => {
    const kodes = getKodes(sel);
    if (kodes.length === 0) return false;
    return kodes.every(k => selectedIds.some(s => String(s) === String(k)));
  };

  // Cek apakah sebagian kode sudah ada (partial active)
  const isSelPartial = (sel) => {
    const kodes = getKodes(sel);
    if (kodes.length === 0) return false;
    const someIn  = kodes.some(k => selectedIds.some(s => String(s) === String(k)));
    const allIn   = kodes.every(k => selectedIds.some(s => String(s) === String(k)));
    return someIn && !allIn;
  };

  // Toggle: if active → deselect; if not active → select
  const handleToggleSel = (sel) => {
    const active = isSelActive(sel);
    onApply?.({ ...sel, device_ids: getKodes(sel), _action: active ? "deselect" : "select" });
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-[#DA2C38]" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
          Saved Selections
        </h3>
      </div>

      {/* Save current selection */}
      <div className="space-y-2">
        <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">
          Save Current ({selectedIds.length} selected)
        </p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Lampu Kiri"
            className="text-xs h-8 rounded-md"
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !selectedIds.length}
            className="h-8 px-3 bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs whitespace-nowrap">
            Save
          </Button>
        </div>
        {selectedIds.length === 0 && (
          <p className="text-[10px] text-[#9CA3AF]">Select at least 1 device to save.</p>
        )}
      </div>

      {/* Saved list */}
      {selections.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">Saved</p>
          <div className={`space-y-1.5 ${selections.length > MAX_VISIBLE ? "max-h-[200px] overflow-y-auto pr-1" : ""}`}
            style={selections.length > MAX_VISIBLE ? { scrollbarWidth: "thin" } : undefined}>
            {selections.map(sel => {
              const active  = isSelActive(sel);
              const partial = isSelPartial(sel);
              const kodeCount = getKodes(sel).length;
              return (
                <div key={sel.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors group cursor-pointer ${
                    active
                      ? "border-[#DA2C38] bg-red-50"
                      : partial
                      ? "border-yellow-400 bg-yellow-50"
                      : "border-[#E5E7EB] hover:border-[#DA2C38]"
                  }`}
                  onClick={() => handleToggleSel(sel)}>
                  {/* Indicator dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                    active ? "bg-[#DA2C38] animate-pulse" : partial ? "bg-yellow-400" : "bg-[#E5E7EB]"
                  }`} />
                  <div className="flex-1 text-left">
                    <p className={`text-xs font-medium ${active ? "text-[#DA2C38]" : partial ? "text-yellow-700" : "text-[#1C2025]"}`}>
                      {sel.name}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      {kodeCount} device(s)
                      {partial && <span className="text-yellow-600 ml-1">· partial</span>}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 ${active || partial ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                    <button
                      className={`p-1 rounded ${active ? "bg-[#DA2C38] text-white" : "hover:bg-green-50 text-[#10B981]"}`}
                      title={active ? "Deselect" : "Apply selection"}
                      onClick={(e) => { e.stopPropagation(); handleToggleSel(sel); }}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete?.(sel.id); }}
                      className="p-1 rounded hover:bg-red-50 text-[#637083] opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF] text-center py-2">No saved selections yet.</p>
      )}
    </div>
  );
}

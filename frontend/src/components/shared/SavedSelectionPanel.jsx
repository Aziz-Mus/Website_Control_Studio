import { useState } from "react";
import { Bookmark, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * SavedSelectionPanel
 * Props:
 *   selections   : [{ id, name, kodes }]
 *   selectedIds  : current selected kodes (numbers)
 *   onSave       : (name, kodes) => void
 *   onApply      : (sel) => void
 *   onDelete     : (id) => void
 */
export default function SavedSelectionPanel({ selections = [], selectedIds = [], onSave, onApply, onDelete }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !selectedIds.length) return;
    setSaving(true);
    await onSave?.(name.trim(), selectedIds);
    setName("");
    setSaving(false);
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
          {selections.map(sel => (
            <div key={sel.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#E5E7EB] hover:border-[#DA2C38] transition-colors group">
              <button className="flex-1 text-left" onClick={() => onApply?.(sel)}>
                <p className="text-xs font-medium text-[#1C2025]">{sel.name}</p>
                <p className="text-[10px] text-[#9CA3AF]">{sel.kodes?.length ?? 0} device(s)</p>
              </button>
              <button onClick={() => onApply?.(sel)}
                className="p-1 rounded hover:bg-green-50 text-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity"
                title="Apply selection">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete?.(sel.id)}
                className="p-1 rounded hover:bg-red-50 text-[#637083] opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#9CA3AF] text-center py-2">No saved selections yet.</p>
      )}
    </div>
  );
}

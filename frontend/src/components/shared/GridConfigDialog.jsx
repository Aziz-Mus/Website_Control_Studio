import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function GridConfigDialog({ open, onOpenChange, initial = { cols: 4, rows: 5 }, onConfirm }) {
  const [cols, setCols] = useState(initial.cols);
  const [rows, setRows] = useState(initial.rows);

  const handleConfirm = () => {
    onConfirm?.({ cols, rows });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
            Grid Table Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Columns */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-[#1C2025]">Columns</label>
              <span className="text-sm font-bold text-[#DA2C38]">{cols}</span>
            </div>
            <input type="range" min={1} max={8} value={cols}
              onChange={e => setCols(Number(e.target.value))}
              className="w-full accent-[#DA2C38]" />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
              <span>1</span><span>Max: 8</span>
            </div>
          </div>

          {/* Rows */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-[#1C2025]">Rows</label>
              <span className="text-sm font-bold text-[#DA2C38]">{rows}</span>
            </div>
            <input type="range" min={1} max={20} value={rows}
              onChange={e => setRows(Number(e.target.value))}
              className="w-full accent-[#DA2C38]" />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
              <span>1</span><span>Max: 20</span>
            </div>
          </div>

          {/* Mini preview */}
          <div>
            <p className="text-xs text-[#637083] mb-2">Preview ({cols} × {rows} = {cols * rows} cells)</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 2,
                border: "1px solid #E5E7EB",
                borderRadius: 4,
                padding: 4,
              }}
            >
              {Array.from({ length: Math.min(cols * rows, 40) }).map((_, i) => (
                <div key={i} className="bg-[#F3F4F6] rounded"
                  style={{ height: Math.max(8, Math.min(16, 80 / rows)) }} />
              ))}
              {cols * rows > 40 && (
                <div className="col-span-full text-center text-[9px] text-[#9CA3AF] pt-1">
                  + {cols * rows - 40} more cells
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-md text-xs">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs">
            Apply Grid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

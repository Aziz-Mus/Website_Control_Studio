import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GridConfigDialog({ open, onOpenChange, initial = { cols: 4, rows: 5 }, deviceCount = 0, onConfirm }) {
  const [cols, setCols] = useState(initial.cols);
  const [rows, setRows] = useState(initial.rows);

  // Sync state when dialog opens or initial changes
  useEffect(() => {
    if (open) {
      setCols(initial.cols);
      setRows(initial.rows);
    }
  }, [open, initial.cols, initial.rows]);

  const totalCells = cols * rows;
  const isTooSmall = deviceCount > 0 && totalCells < deviceCount;

  const handleConfirm = () => {
    if (isTooSmall) return; // safety guard
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

          {/* Warning if cells < devices */}
          {isTooSmall && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#DA2C38] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#DA2C38]">Not enough cells</p>
                <p className="text-[11px] text-[#637083] mt-0.5">
                  You have <strong>{deviceCount}</strong> device(s) but only <strong>{totalCells}</strong> cells.
                  Need at least <strong>{deviceCount}</strong> cells ({Math.ceil(deviceCount / cols)} rows × {cols} cols).
                </p>
              </div>
            </div>
          )}

          {/* Mini preview */}
          <div>
            <p className="text-xs text-[#637083] mb-2">
              Preview ({cols} × {rows} = {totalCells} cells
              {deviceCount > 0 && <>, {deviceCount} device(s)</>})
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 3,
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                padding: 6,
                background: "#F9FAFB",
              }}
            >
              {Array.from({ length: Math.min(totalCells, 80) }).map((_, i) => (
                <div key={i}
                  className="rounded"
                  style={{
                    height: Math.max(10, Math.min(20, 120 / rows)),
                    background: i < deviceCount
                      ? "linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%)"
                      : "linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)",
                    border: i < deviceCount ? "1px solid #F87171" : "1px solid #C7C9CC",
                  }}
                />
              ))}
              {totalCells > 80 && (
                <div className="col-span-full text-center text-[9px] text-[#9CA3AF] pt-1">
                  + {totalCells - 80} more cells
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-md text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isTooSmall}
            className={`rounded-md text-xs ${isTooSmall ? "bg-gray-300 cursor-not-allowed" : "bg-[#DA2C38] hover:bg-[#B9252F] text-white"}`}>
            Apply Grid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
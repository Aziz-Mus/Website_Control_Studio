import { Power, Moon } from "lucide-react";

/**
 * SelectedControlPanel
 * Desain: persis seperti foto user
 *  - "SELECTED" label kecil abu-abu
 *  - Angka besar + satuan ("lights" / "rooms")
 *  - Badge "Select X first" saat 0 terpilih
 *  - Tombol ON merah solid / pink muted | OFF abu-abu
 */
export default function SelectedControlPanel({ count = 0, onAction, loading = false, unit = "lights" }) {
  const hasSelection = count > 0;
  const label = count === 1 ? unit.replace(/s$/, "") : unit; // "light" vs "lights"

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
      data-testid="selected-control-panel"
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
            SELECTED
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold leading-none text-gray-900">{count}</span>
            <span className="text-base text-gray-400 font-medium">{label}</span>
          </div>
        </div>

        {/* Badge — only when nothing selected */}
        {!hasSelection && (
          <span className="mt-1 inline-flex items-center border border-yellow-400 text-yellow-600 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-yellow-50 whitespace-nowrap">
            Select {unit} first
          </span>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {/* ON */}
        <button
          onClick={() => onAction?.("on")}
          disabled={loading || !hasSelection}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold
            transition-all duration-150 select-none
            ${hasSelection
              ? "bg-[#DA2C38] hover:bg-[#B9252F] text-white shadow-sm active:scale-95"
              : "bg-[#f8b4b8] text-white cursor-not-allowed"
            }
          `}
        >
          <Power className="w-4 h-4" />
          ON
        </button>

        {/* OFF */}
        <button
          onClick={() => onAction?.("off")}
          disabled={loading || !hasSelection}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold
            border transition-all duration-150 select-none
            ${hasSelection
              ? "border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95"
              : "border-gray-200 text-gray-300 cursor-not-allowed"
            }
          `}
        >
          <Moon className="w-4 h-4" />
          OFF
        </button>
      </div>
    </div>
  );
}

import { Trash2, Play, Square } from "lucide-react";
import AnimationBuilder from "./AnimationBuilder";

/**
 * AnimationPanel
 * Props:
 *   animations     : [{ id, name, frames }]
 *   animState      : { running, name }
 *   interval       : number (seconds)
 *   onIntervalChange: (v) => void
 *   selectedIps    : string[]
 *   onPlay         : (anim) => void
 *   onStop         : () => void
 *   onDelete       : (id) => void
 *   onSaveAnim     : (name, frames) => void
 */
export default function AnimationPanel({
  animations = [], animState = {}, interval = 2,
  onIntervalChange, selectedIps = [],
  onPlay, onStop, onDelete, onSaveAnim,
}) {
  return (
    <div className="space-y-3">
      {/* Live badge + interval */}
      <div className="flex items-center gap-3">
        {animState.running ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 border border-[#DA2C38] rounded-full text-xs font-medium text-[#DA2C38]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DA2C38] animate-pulse" />
            LIVE · {animState.name}
          </span>
        ) : (
          <span className="text-xs text-[#9CA3AF]">No animation running</span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <label className="text-[10px] text-[#637083] uppercase tracking-wider">Interval</label>
          <input type="number" min={0.1} max={60} step={0.5}
            value={interval}
            onChange={(e) => onIntervalChange?.(parseFloat(e.target.value)||2)}
            className="w-14 h-7 text-xs border border-[#E5E7EB] rounded-md text-center focus:outline-none focus:ring-1 focus:ring-[#DA2C38]"
          />
          <span className="text-[10px] text-[#9CA3AF]">s</span>
        </div>
      </div>

      {/* Stop button */}
      {animState.running && (
        <button onClick={onStop}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-[#DA2C38] hover:bg-[#B9252F] rounded-md transition-colors"
        >
          <Square className="w-4 h-4" /> Stop Animation
        </button>
      )}

      {/* Animation list */}
      {animations.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] text-center py-2">No animations saved yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[135px] overflow-y-auto pr-0.5 custom-scrollbar">
          {animations.map((a) => (
            <div key={a.id}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-md transition-colors group
                ${animState.running && animState.name === a.name
                  ? "bg-red-50 border-[#DA2C38]"
                  : "bg-white border-[#E5E7EB] hover:border-[#DA2C38]"}`}
            >
              {/* Colour preview */}
              <div className="flex gap-0.5 flex-shrink-0">
                {a.frames.slice(0,4).map((f,i) => (
                  <div key={i} className="w-3 h-5 rounded-sm"
                    style={{backgroundColor: f.rgb ? `rgb(${f.rgb.join(",")})` : "#ccc"}} />
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1C2025] truncate">{a.name}</p>
                <p className="text-[10px] text-[#9CA3AF]">{a.frames.length} frames</p>
              </div>

              <button onClick={() => onPlay?.(a)}
                disabled={selectedIps.length === 0}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-[#DA2C38] text-white hover:bg-[#B9252F] disabled:opacity-30 transition-all"
                title={selectedIps.length===0 ? "Select lights first" : "Play animation"}
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete?.(a.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-[#637083] hover:text-red-500 hover:bg-red-50 transition-all"
                title="Delete animation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Builder */}
      <AnimationBuilder onSave={onSaveAnim} />
    </div>
  );
}

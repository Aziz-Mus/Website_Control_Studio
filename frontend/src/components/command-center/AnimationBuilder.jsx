import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FRAME_PRESETS = [
  "#FF0000","#FF4500","#FF8C00","#FFD700","#00FF00",
  "#00BFFF","#0000FF","#8A2BE2","#FF00FF","#FFFFFF",
];

/**
 * AnimationBuilder — UI to compose a custom animation frame-by-frame.
 *
 * Props:
 *   onSave : (name, frames) => void
 */
export default function AnimationBuilder({ onSave }) {
  const [name,   setName]   = useState("");
  const [frames, setFrames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingColor, setPendingColor] = useState("#FF0000");

  const addFrame = (hex) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    setFrames((f) => [...f, { rgb: [r,g,b], hex }]);
  };

  const removeFrame = (idx) => setFrames((f) => f.filter((_,i) => i !== idx));
  const clearFrames  = () => setFrames([]);

  const moveUp   = (idx) => setFrames((f) => { const a=[...f]; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; return a; });
  const moveDown = (idx) => setFrames((f) => { const a=[...f]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; return a; });

  const handleSave = async () => {
    if (!name.trim() || frames.length < 2) return;
    setSaving(true);
    await onSave?.(name.trim(), frames.map(f => ({ rgb: f.rgb })));
    setName(""); setFrames([]);
    setSaving(false);
  };

  return (
    <div className="space-y-3 border border-dashed border-[#E5E7EB] rounded-lg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-[#637083] font-medium">
          Build Custom Animation
        </p>
        {frames.length > 0 && (
          <button onClick={clearFrames} className="text-[9px] text-red-500 hover:underline font-medium">
            Clear all
          </button>
        )}
      </div>

      {/* Colour picker palette */}
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-[#637083]">Add Frame Color</Label>
        <div className="flex items-center gap-3 mt-1.5">
          {/* Preset Swatches */}
          <div className="flex flex-wrap gap-1 flex-1">
            {FRAME_PRESETS.map((c) => (
              <button key={c} onClick={() => setPendingColor(c)}
                className={`w-6 h-6 rounded border-2 transition-all ${pendingColor === c ? "border-[#DA2C38] scale-110 shadow-sm" : "border-transparent hover:border-gray-300"}`}
                style={{backgroundColor:c}} title={c}
              />
            ))}
            <label title="Custom color" className="w-6 h-6 rounded border-2 border-dashed border-[#D1D5DB] flex items-center justify-center cursor-pointer hover:border-[#DA2C38] transition-colors bg-white relative">
              <Plus className="w-3 h-3 text-[#9CA3AF]" />
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                value={pendingColor} onChange={(e) => setPendingColor(e.target.value.toUpperCase())} />
            </label>
          </div>

          {/* Add Action Section */}
          <div className="flex items-center gap-2 pl-3 border-l border-[#E5E7EB]">
            <div className="w-8 h-8 rounded border border-[#E5E7EB] shadow-inner" style={{backgroundColor: pendingColor}} />
            <Button size="sm" onClick={() => addFrame(pendingColor)}
              className="bg-[#DA2C38] hover:bg-[#B9252F] text-white h-8 text-[10px] px-2.5 font-bold tracking-tight">
              ADD FRAME
            </Button>
          </div>
        </div>
      </div>

      {/* Frame list */}
      {frames.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {frames.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white border border-[#E5E7EB] rounded-md">
              <div className="w-5 h-5 rounded-sm border border-[#E5E7EB] flex-shrink-0"
                style={{backgroundColor:`rgb(${f.rgb[0]},${f.rgb[1]},${f.rgb[2]})`}} />
              <span className="text-xs font-mono text-[#637083] flex-1">Frame {i+1}</span>
              <div className="flex gap-0.5">
                <button disabled={i===0} onClick={()=>moveUp(i)}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#1C2025] disabled:opacity-30 transition-colors text-[10px] font-bold">↑</button>
                <button disabled={i===frames.length-1} onClick={()=>moveDown(i)}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#1C2025] disabled:opacity-30 transition-colors text-[10px] font-bold">↓</button>
                <button onClick={()=>removeFrame(i)}
                  className="p-1 rounded text-[#9CA3AF] hover:text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Name + save */}
      <div className="flex gap-2">
        <Input value={name} onChange={(e)=>setName(e.target.value)}
          placeholder="Animation name…" className="h-8 text-sm"
          onKeyDown={(e)=>e.key==="Enter"&&handleSave()} />
        <Button size="sm" disabled={!name.trim()||frames.length<2||saving}
          onClick={handleSave}
          className="bg-[#DA2C38] hover:bg-[#B9252F] text-white h-8 px-3 flex-shrink-0">
          {saving ? "…" : "Save"}
        </Button>
      </div>
      {frames.length < 2 && name.trim() && (
        <p className="text-[10px] text-[#F59E0B]">Add at least 2 frames to save.</p>
      )}
    </div>
  );
}

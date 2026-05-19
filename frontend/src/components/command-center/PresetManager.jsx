import { useState } from "react";
import { Plus, Trash2, CheckCircle, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Convert hex string (#RRGGBB) to {r,g,b} */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** Convert {r,g,b} to hex */
function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * PresetManager
 * Props:
 *   presets       : [{ id, name, settings }]
 *   onApply       : (preset) => void
 *   onSave        : (name, settings) => void
 *   onDelete      : (id) => void
 *   currentSettings: { brightness, rgb?, colortemp? }
 */
export default function PresetManager({ presets = [], onApply, onSave, onDelete, currentSettings, activePresetId = null }) {
  const [newName, setNewName] = useState("");
  const [saving,  setSaving]  = useState(false);
  
  // Local color picker state for preset creation
  const [hex, setHex] = useState("#FFFFFF");
  const [brightness, setBr] = useState(100);
  const [hexError, setHexError] = useState(false);

  const handleHexChange = (val) => {
    const cleaned = val.startsWith("#") ? val : "#" + val;
    setHex(cleaned.toUpperCase());
    setHexError(!/^#[0-9A-Fa-f]{6}$/.test(cleaned));
  };

  const handleSave = async () => {
    if (!newName.trim() || hexError) return;
    setSaving(true);
    const rgbObj = hexToRgb(hex);
    const settings = {
      rgb: [rgbObj.r, rgbObj.g, rgbObj.b],
      brightness: brightness
    };
    await onSave?.(newName.trim(), settings);
    setNewName("");
    setSaving(false);
  };

  const describePreset = (s) => {
    if (!s) return "—";
    if (s.rgb) return `RGB(${s.rgb.join(",")}) • ${s.brightness ?? "—"}%`;
    if (s.colortemp) return `${s.colortemp}K • ${s.brightness ?? "—"}%`;
    return `${s.brightness ?? "—"}%`;
  };

  const swatches = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF", "#FFA500"];

  return (
    <div className="space-y-4">
      {/* Create Preset Section */}
      <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-md space-y-3">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-[#DA2C38]" />
          <p className="text-[10px] uppercase tracking-wider text-[#637083] font-bold">
            Create Color Preset
          </p>
        </div>
        
        {/* Color Picker inputs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded border border-[#E5E7EB] overflow-hidden cursor-pointer flex-shrink-0"
              style={{ backgroundColor: hexError ? "#FFF" : hex }}>
              <input
                type="color"
                value={hexError ? "#FFFFFF" : hex}
                onChange={e => handleHexChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <Input
              value={hex}
              onChange={e => handleHexChange(e.target.value)}
              maxLength={7}
              placeholder="#FFFFFF"
              className={`text-[10px] h-7 px-2 font-mono ${hexError ? "border-red-400 text-red-500" : ""}`}
            />
          </div>

          {/* Quick Swatches */}
          <div className="flex gap-1">
            {swatches.map(c => (
              <button key={c} onClick={() => handleHexChange(c)}
                className="w-4 h-4 rounded-full border border-[#E5E7EB] hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Brightness slider for preset */}
          <div className="space-y-1.5 py-1">
            <div className="flex justify-between items-center px-0.5">
              <label className="text-[9px] text-[#637083] font-bold uppercase tracking-wider">Brightness</label>
              <span className="text-[10px] text-[#DA2C38] font-black">{brightness}%</span>
            </div>
            <div className="relative h-6 flex items-center group">
              {/* Custom Track Background */}
              <div className="absolute w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#DA2C38] to-[#FF4D5A] transition-all duration-150"
                  style={{ width: `${brightness}%` }}
                />
              </div>
              {/* Actual Input Range (Hidden but functional) */}
              <input 
                type="range" 
                min={1} 
                max={100} 
                value={brightness}
                onChange={e => setBr(Number(e.target.value))}
                className="absolute w-full h-full opacity-0 cursor-pointer z-10" 
              />
              {/* Visual Thumb */}
              <div 
                className="absolute w-4 h-4 bg-white border-2 border-[#DA2C38] rounded-full shadow-md pointer-events-none transition-all duration-150 group-hover:scale-110"
                style={{ left: `calc(${brightness}% - 8px)` }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1 border-t border-[#E5E7EB]">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Preset name…"
            className="h-7 text-[10px] flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button
            size="sm"
            disabled={!newName.trim() || saving || hexError}
            onClick={handleSave}
            className="bg-[#DA2C38] hover:bg-[#B9252F] text-white h-7 px-2 text-[10px]"
          >
            <Plus className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Preset list */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-[#637083] font-bold px-1">
          Saved Presets
        </p>
        {presets.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] text-center py-4">No presets saved yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {presets.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 p-2 bg-white border rounded-md group transition-colors
                  ${activePresetId === p.id
                    ? "border-green-400 bg-green-50"
                    : "border-[#E5E7EB] hover:border-[#DA2C38]"}`}
              >
                {/* Active indicator */}
                {activePresetId === p.id && (
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" title="Currently active" />
                )}
                {/* Color preview swatch in list */}
                {p.settings?.rgb && (
                  <div className="w-3 h-3 rounded-full border border-gray-100 flex-shrink-0" 
                    style={{ backgroundColor: rgbToHex({r: p.settings.rgb[0], g: p.settings.rgb[1], b: p.settings.rgb[2]}) }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1C2025] truncate">{p.name}</p>
                  <p className="text-[9px] text-[#9CA3AF] truncate">{describePreset(p.settings)}</p>
                </div>
                <button
                  onClick={() => onApply?.(p)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-[#DA2C38] text-white hover:bg-[#B9252F] transition-all"
                  title="Apply"
                >
                  <CheckCircle className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onDelete?.(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#637083] hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


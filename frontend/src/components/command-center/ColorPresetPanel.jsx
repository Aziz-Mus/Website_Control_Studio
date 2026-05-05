import { useState, useRef } from "react";
import { Palette, Trash2, Play } from "lucide-react";
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
 * ColorPresetPanel — save named color presets, apply to selected lights later.
 *
 * Props:
 *   presets         : [{ id, name, settings: { rgb, brightness } }]
 *   selectedCount   : number of currently selected devices
 *   onSavePreset    : (name, settings) => void
 *   onApplyPreset   : (preset) => void
 *   onDeletePreset  : (id) => void
 */
export default function ColorPresetPanel({
  presets = [],
  selectedCount = 0,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) {
  const [hex, setHex]         = useState("#FFFFFF");
  const [brightness, setBr]   = useState(100);
  const [presetName, setName] = useState("");
  const [hexError, setHexError] = useState(false);

  const handleHexChange = (val) => {
    const cleaned = val.startsWith("#") ? val : "#" + val;
    setHex(cleaned.toUpperCase());
    setHexError(!/^#[0-9A-Fa-f]{6}$/.test(cleaned));
  };

  const handleSave = () => {
    if (!presetName.trim() || hexError) return;
    const rgb = hexToRgb(hex);
    onSavePreset?.(presetName.trim(), { rgb: [rgb.r, rgb.g, rgb.b], brightness });
    setName("");
  };

  const previewBg = hexError ? "#FFFFFF" : hex;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-[#DA2C38]" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
          Color Presets
        </h3>
      </div>

      {/* Color Picker Section */}
      <div className="space-y-3">
        <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">Pick Color</p>

        {/* Native color picker + preview */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg border border-[#E5E7EB] overflow-hidden cursor-pointer flex-shrink-0"
            style={{ backgroundColor: hexError ? "#FFF" : hex }}>
            <input
              type="color"
              value={hexError ? "#FFFFFF" : hex}
              onChange={e => handleHexChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Click to open color picker"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-[#637083] font-medium">HEX CODE</label>
            <Input
              value={hex}
              onChange={e => handleHexChange(e.target.value)}
              maxLength={7}
              className={`text-xs h-7 mt-0.5 rounded-md font-mono ${hexError ? "border-red-400 text-red-500" : ""}`}
            />
          </div>
        </div>

        {/* Solid color quick swatches */}
        <div className="grid grid-cols-8 gap-1">
          {["#FF0000","#FF6600","#FFCC00","#00CC00","#00CCFF","#0066FF","#9900CC","#FF00CC",
            "#FFFFFF","#CCCCCC","#888888","#444444","#000000","#FF4444","#44FF88","#FFD700"].map(c => (
            <button key={c} onClick={() => handleHexChange(c)}
              className="w-full aspect-square rounded border border-[#E5E7EB] hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Brightness */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[10px] text-[#637083] font-medium uppercase tracking-wider">BRIGHTNESS</label>
            <span className="text-[10px] text-[#DA2C38] font-bold">{brightness}%</span>
          </div>
          <input type="range" min={1} max={100} value={brightness}
            onChange={e => setBr(Number(e.target.value))}
            className="w-full accent-[#DA2C38]" />
        </div>

        {/* Preset name + save */}
        <div className="flex gap-2">
          <Input
            value={presetName}
            onChange={e => setName(e.target.value)}
            placeholder="Preset name..."
            className="text-xs h-8 rounded-md"
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" onClick={handleSave}
            disabled={!presetName.trim() || hexError}
            className="h-8 px-3 bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs whitespace-nowrap">
            Save
          </Button>
        </div>
      </div>

      {/* Saved presets list */}
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#637083] uppercase tracking-wider font-medium">
            Saved Presets
          </p>
          {presets.map(preset => {
            const rgb   = preset.settings?.rgb;
            const color = rgb ? rgbToHex({ r: rgb[0], g: rgb[1], b: rgb[2] }) : "#CCCCCC";
            const br    = preset.settings?.brightness ?? 100;
            return (
              <div key={preset.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#E5E7EB] hover:border-[#DA2C38] transition-colors group">
                {/* Color swatch */}
                <div className="w-5 h-5 rounded border border-[#E5E7EB] flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#1C2025] truncate">{preset.name}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{color} · {br}%</p>
                </div>
                {/* Apply */}
                <button
                  onClick={() => onApplyPreset?.(preset)}
                  className="p-1 rounded hover:bg-green-50 text-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity"
                  title={selectedCount > 0 ? `Apply to ${selectedCount} device(s)` : "Select devices first"}>
                  <Play className="w-3 h-3" fill="currentColor" />
                </button>
                {/* Delete */}
                <button
                  onClick={() => onDeletePreset?.(preset.id)}
                  className="p-1 rounded hover:bg-red-50 text-[#637083] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete preset">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {presets.length === 0 && (
        <p className="text-xs text-[#9CA3AF] text-center py-2">No presets saved yet.</p>
      )}

      {selectedCount === 0 && presets.length > 0 && (
        <p className="text-[10px] text-[#9CA3AF] text-center">
          Select devices first to apply a preset.
        </p>
      )}
    </div>
  );
}

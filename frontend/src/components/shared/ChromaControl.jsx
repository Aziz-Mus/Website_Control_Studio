import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

const PRESETS = [
  "#FF0000", "#FF4500", "#FF8C00", "#FFD700", "#FFFF00",
  "#00FF00", "#00CED1", "#00BFFF", "#0000FF", "#8A2BE2",
  "#FF00FF", "#FF1493", "#FFFFFF", "#808080", "#000000"
];

// WiZ Dynamic Scenes — id: name: representative color
const DYNAMIC_SCENES = [
  { id: 35, name: "Alarm",       color: "#FF4444" },
  { id: 10, name: "Bedtime",     color: "#4A2060" },
  { id: 29, name: "Candlelight", color: "#FF8C00" },
  { id: 27, name: "Christmas",   color: "#2ECC40" },
  { id: 6,  name: "Cozy",        color: "#FF6B35" },
  { id: 13, name: "Cool White",  color: "#C8E6FF" },
  { id: 12, name: "Daylight",    color: "#FFF9E6" },
  { id: 33, name: "Diwali",      color: "#FFD700" },
  { id: 23, name: "Deep Dive",   color: "#006994" },
  { id: 22, name: "Fall",        color: "#C0622F" },
  { id: 5,  name: "Fireplace",   color: "#FF4500" },
  { id: 7,  name: "Forest",      color: "#228B22" },
  { id: 15, name: "Focus",       color: "#E8F4FF" },
  { id: 30, name: "Golden White",color: "#FFD580" },
  { id: 28, name: "Halloween",   color: "#FF6600" },
  { id: 24, name: "Jungle",      color: "#3A7D44" },
  { id: 25, name: "Mojito",      color: "#98FB98" },
  { id: 14, name: "Night Light", color: "#2C1810" },
  { id: 1,  name: "Ocean",       color: "#006994" },
  { id: 4,  name: "Party",       color: "#FF1493" },
  { id: 31, name: "Pulse",       color: "#DA2C38" },
  { id: 8,  name: "Pastel Colors",color:"#FFB3DE" },
  { id: 19, name: "Plant Growth",color: "#00C851" },
  { id: 2,  name: "Romance",     color: "#FF4484" },
  { id: 16, name: "Relax",       color: "#F4A460" },
  { id: 3,  name: "Sunset",      color: "#FF6B35" },
  { id: 20, name: "Spring",      color: "#90EE90" },
  { id: 21, name: "Summer",      color: "#FFD700" },
  { id: 32, name: "Steampunk",   color: "#8B7355" },
  { id: 17, name: "True Colors", color: "#FF3366" },
  { id: 18, name: "TV Time",     color: "#6495ED" },
  { id: 34, name: "White",       color: "#FFFFFF" },
  { id: 9,  name: "Wake-up",     color: "#FFE066" },
  { id: 11, name: "Warm White",  color: "#FFD27F" },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = v; g = t; b = p;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = 0, v = max;
  if (max !== 0) s = d / max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s, v };
}

export default function ChromaControl({ onApply, selectedCount = 0, brightness, onBrightnessChange }) {
  const [hex, setHex] = useState("#DA2C38");
  const [rgb, setRgb] = useState({ r: 218, g: 44, b: 56 });
  const [hue, setHue] = useState(0);
  const [satPos, setSatPos] = useState({ x: 0.9, y: 0.1 });

  // Dynamic scene selection — null = solid color mode
  const [selectedScene, setSelectedScene] = useState(null);

  const canvasRef = useRef(null);
  const hueRef = useRef(null);
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const isHueDragging = useRef(false);

  const updateFromRgb = useCallback((r, g, b) => {
    setRgb({ r, g, b });
    setHex(rgbToHex(r, g, b));
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const s = x / w;
        const v = 1 - y / h;
        const { r, g, b } = hsvToRgb(hue, s, v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [hue]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const drawHueBar = useCallback(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 6; i++) {
      const { r, g, b } = hsvToRgb(i / 6, 1, 1);
      gradient.addColorStop(i / 6, `rgb(${r},${g},${b})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, []);

  useEffect(() => { drawHueBar(); }, [drawHueBar]);

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleCanvasInteraction = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { clientX, clientY } = getEventCoords(e);
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setSatPos({ x, y });
    const { r, g, b } = hsvToRgb(hue, x, 1 - y);
    updateFromRgb(r, g, b);
    setSelectedScene(null); // deselect dynamic when picking solid
  };

  const handleHueInteraction = (e) => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const { clientX } = getEventCoords(e);
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHue(x);
    const { r, g, b } = hsvToRgb(x, satPos.x, 1 - satPos.y);
    updateFromRgb(r, g, b);
    setSelectedScene(null);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging.current) handleCanvasInteraction(e);
      if (isHueDragging.current) handleHueInteraction(e);
    };
    const handlePointerUp = () => {
      isDragging.current = false;
      isHueDragging.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
    };
  });

  const handleHexInput = (val) => {
    setHex(val);
    setSelectedScene(null);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      const { r, g, b } = hexToRgb(val);
      setRgb({ r, g, b });
      const { h, s, v } = rgbToHsv(r, g, b);
      setHue(h);
      setSatPos({ x: s, y: 1 - v });
    }
  };

  const handleRgbInput = (channel, val) => {
    const num = Math.max(0, Math.min(255, parseInt(val) || 0));
    const newRgb = { ...rgb, [channel]: num };
    setRgb(newRgb);
    setHex(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    setSelectedScene(null);
  };

  const handlePreset = (color) => {
    setHex(color);
    const { r, g, b } = hexToRgb(color);
    setRgb({ r, g, b });
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(h);
    setSatPos({ x: s, y: 1 - v });
    setSelectedScene(null); // deselect dynamic when picking solid preset
  };

  const handleSceneSelect = (scene) => {
    setSelectedScene(prev => prev?.id === scene.id ? null : scene);
  };

  const handleApply = () => {
    if (!onApply) return;
    if (selectedScene) {
      // Dynamic mode → send SceneId + Kecerahan
      onApply({ sceneId: selectedScene.id, sceneName: selectedScene.name, brightness });
    } else {
      // Solid mode → send RGB + Kecerahan (existing behaviour)
      onApply({ hex, rgb, brightness });
    }
  };

  // Split scenes into two rows for horizontal scroll
  const half = Math.ceil(DYNAMIC_SCENES.length / 2);
  const row1 = DYNAMIC_SCENES.slice(0, half);
  const row2 = DYNAMIC_SCENES.slice(half);

  const SceneCard = ({ scene }) => {
    const isSelected = selectedScene?.id === scene.id;
    return (
      <button
        key={scene.id}
        onClick={() => handleSceneSelect(scene)}
        data-testid={`scene-${scene.id}`}
        title={scene.name}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap transition-all flex-shrink-0
          ${isSelected
            ? "border-[#DA2C38] bg-[#FFF1F2] text-[#DA2C38] font-semibold shadow-sm"
            : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#DA2C38] hover:bg-[#FFF7F7]"}`}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
          style={{ backgroundColor: scene.color, boxShadow: `0 0 0 1px ${isSelected ? "#DA2C38" : "#E5E7EB"}` }}
        />
        {scene.name}
      </button>
    );
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-4" data-testid="chroma-control">
      <h3 className="text-base font-semibold text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }}>
        Chroma Control
      </h3>

      {/* Color picker canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={240}
          height={160}
          className="w-full h-40 rounded-md border border-[#E5E7EB] cursor-crosshair touch-none"
          data-testid="color-picker-canvas"
          onMouseDown={(e) => { isDragging.current = true; handleCanvasInteraction(e); }}
          onTouchStart={(e) => { isDragging.current = true; handleCanvasInteraction(e); }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `calc(${satPos.x * 100}% - 8px)`,
            top: `calc(${satPos.y * 100}% - 8px)`,
            backgroundColor: hex
          }}
        />
      </div>

      {/* Hue bar */}
      <div className="relative">
        <canvas
          ref={hueRef}
          width={240}
          height={16}
          className="w-full h-4 rounded-md cursor-pointer touch-none"
          data-testid="hue-bar"
          onMouseDown={(e) => { isHueDragging.current = true; handleHueInteraction(e); }}
          onTouchStart={(e) => { isHueDragging.current = true; handleHueInteraction(e); }}
        />
        <div
          className="absolute top-0 w-3 h-4 rounded-sm border-2 border-white shadow pointer-events-none"
          style={{ left: `calc(${hue * 100}% - 6px)` }}
        />
      </div>

      {/* Selected color preview + HEX */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-md border border-[#E5E7EB]"
          style={{ backgroundColor: hex }}
          data-testid="color-preview"
        />
        <div className="flex-1">
          <Label className="text-xs uppercase tracking-wider text-[#637083]">HEX Code</Label>
          <Input
            data-testid="hex-input"
            value={hex}
            onChange={(e) => handleHexInput(e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder="#DA2C38"
          />
        </div>
      </div>

      {/* RGB inputs */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#637083]">RGB Values</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {["r", "g", "b"].map((ch) => (
            <div key={ch}>
              <span className="text-xs text-[#637083]">{ch.toUpperCase()}</span>
              <Input
                data-testid={`rgb-${ch}-input`}
                type="number" min={0} max={255}
                value={rgb[ch]}
                onChange={(e) => handleRgbInput(ch, e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Brightness Slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs uppercase tracking-wider text-[#637083]">Brightness</Label>
          <span className="text-sm font-medium text-[#1C2025]">{Math.round(brightness / 255 * 100)}%</span>
        </div>
        <Slider
          data-testid="brightness-slider"
          value={[brightness]}
          onValueChange={(v) => onBrightnessChange(v[0])}
          max={255}
          step={1}
          className="[&_[role=slider]]:border-[#DA2C38] [&_span:first-child>span]:bg-[#DA2C38]"
        />
      </div>

      {/* Presets */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#637083]">Color Presets</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESETS.map((color) => (
            <button
              key={color}
              data-testid={`preset-${color.replace("#", "")}`}
              className={`color-swatch ${hex.toUpperCase() === color.toUpperCase() && !selectedScene ? "selected" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => handlePreset(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* ─── Dynamic Color Section ─── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-[#DA2C38]" strokeWidth={2} />
          <Label className="text-xs uppercase tracking-wider text-[#637083]">Dynamic Color</Label>
        </div>

        {/* Vertical Scroll Grid */}
        <div
          className="max-h-[240px] overflow-y-auto pr-1 custom-scrollbar rounded-md border border-[#F3F4F6] p-1 bg-[#F9FAFB]"
          data-testid="dynamic-scene-picker"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {DYNAMIC_SCENES.map((scene) => {
              const isSelected = selectedScene?.id === scene.id;
              return (
                <button
                  key={scene.id}
                  onClick={() => handleSceneSelect(scene)}
                  data-testid={`scene-${scene.id}`}
                  className={`flex items-center gap-2 px-2 py-2 rounded-md border text-[11px] transition-all
                    ${isSelected
                      ? "border-[#DA2C38] bg-white text-[#DA2C38] font-semibold shadow-sm ring-1 ring-[#DA2C38]"
                      : "border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#DA2C38] hover:text-[#DA2C38]"}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white shadow-sm"
                    style={{ backgroundColor: scene.color }}
                  />
                  <span className="truncate text-left">{scene.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected scene display */}
        {selectedScene ? (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-[#DA2C38] bg-[#FFF1F2] animate-in fade-in slide-in-from-top-1"
            data-testid="selected-scene-display"
          >
            <div className="relative">
              <span
                className="w-4 h-4 rounded-full block border border-white shadow-sm"
                style={{ backgroundColor: selectedScene.color }}
              />
              <Sparkles className="w-2 h-2 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] text-[#DA2C38] uppercase font-bold tracking-tighter leading-none">Active Scene</p>
              <p className="text-xs font-semibold text-[#1C2025] truncate">{selectedScene.name}</p>
            </div>
            <button
              onClick={() => setSelectedScene(null)}
              className="p-1 hover:bg-white rounded-full text-[#DA2C38] transition-colors"
              title="Clear scene"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-[#9CA3AF] italic text-center" data-testid="no-scene-hint">
            No dynamic scene selected — using solid color.
          </p>
        )}
      </div>


      {/* Apply button */}
      <Button
        data-testid="apply-color-btn"
        onClick={handleApply}
        className="w-full bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md"
      >
        {selectedScene
          ? `Apply "${selectedScene.name}"${selectedCount > 0 ? ` to ${selectedCount} Selected` : " to All"}`
          : selectedCount > 0 ? `Apply to ${selectedCount} Selected` : "Apply to All"}
      </Button>
    </div>
  );
}

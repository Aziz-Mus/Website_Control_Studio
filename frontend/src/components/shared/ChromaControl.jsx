import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const PRESETS = [
  "#FF0000", "#FF4500", "#FF8C00", "#FFD700", "#FFFF00",
  "#00FF00", "#00CED1", "#00BFFF", "#0000FF", "#8A2BE2",
  "#FF00FF", "#FF1493", "#FFFFFF", "#808080", "#000000"
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

// Bug Fix: Added rgbToHsv conversion so preset selection syncs canvas picker position
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
  const canvasRef = useRef(null);
  const hueRef = useRef(null);
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

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

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

  useEffect(() => {
    drawHueBar();
  }, [drawHueBar]);

  // Get pointer coords for both mouse and touch
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
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      const { r, g, b } = hexToRgb(val);
      setRgb({ r, g, b });
      // Also sync canvas position when hex is typed manually
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
  };

  // Bug Fix: handlePreset now ALSO updates hue and satPos so canvas picker
  // position syncs with the selected preset color
  const handlePreset = (color) => {
    setHex(color);
    const { r, g, b } = hexToRgb(color);
    setRgb({ r, g, b });
    // Convert to HSV and update canvas picker position & hue slider
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(h);
    setSatPos({ x: s, y: 1 - v });
  };

  const handleApply = () => {
    if (onApply) {
      onApply({ hex, rgb, brightness });
    }
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
          <div>
            <span className="text-xs text-[#637083]">R</span>
            <Input
              data-testid="rgb-r-input"
              type="number"
              min={0}
              max={255}
              value={rgb.r}
              onChange={(e) => handleRgbInput("r", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <span className="text-xs text-[#637083]">G</span>
            <Input
              data-testid="rgb-g-input"
              type="number"
              min={0}
              max={255}
              value={rgb.g}
              onChange={(e) => handleRgbInput("g", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <span className="text-xs text-[#637083]">B</span>
            <Input
              data-testid="rgb-b-input"
              type="number"
              min={0}
              max={255}
              value={rgb.b}
              onChange={(e) => handleRgbInput("b", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
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
              className={`color-swatch ${hex.toUpperCase() === color.toUpperCase() ? "selected" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => handlePreset(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Apply button */}
      <Button
        data-testid="apply-color-btn"
        onClick={handleApply}
        className="w-full bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md"
      >
        {selectedCount > 0 ? `Apply to ${selectedCount} Selected` : "Apply to All"}
      </Button>
    </div>
  );
}

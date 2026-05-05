import { useState, useRef, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SOLID_PRESETS = [
  "#FF0000","#FF4500","#FF8C00","#FFD700","#FFFF00",
  "#00FF00","#00CED1","#00BFFF","#0000FF","#8A2BE2",
  "#FF00FF","#FF1493","#FFFFFF","#808080","#000000",
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}
function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}
function hsvToRgb(h, s, v) {
  let r,g,b;
  const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;}
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,s=0,v=max;
  if(max)s=d/max;
  if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;if(h<0)h+=1;}
  return {h,s,v};
}

const TABS = ["Solid","Gradient","Color Temp"];

/**
 * AdvancedColorPicker
 * Props:
 *   onColorChange(payload) → { rgb, colortemp, brightness, mode }
 *   brightness, onBrightnessChange
 */
export default function AdvancedColorPicker({ onColorChange, brightness = 200, onBrightnessChange }) {
  const [tab, setTab] = useState("Solid");

  /* ── solid ──────────────────────────────────────────────────── */
  const [hex, setHex]       = useState("#DA2C38");
  const [rgb, setRgb]       = useState([218,44,56]);
  const [hue, setHue]       = useState(0);
  const [satPos, setSatPos] = useState({ x: 0.9, y: 0.1 });
  const canvasRef = useRef(null);
  const hueRef    = useRef(null);
  const isDragging    = useRef(false);
  const isHueDragging = useRef(false);

  /* ── gradient ───────────────────────────────────────────────── */
  const [gradA, setGradA] = useState("#FF0000");
  const [gradB, setGradB] = useState("#0000FF");

  /* ── color temp ─────────────────────────────────────────────── */
  const [colorTemp, setColorTemp] = useState(4000);

  /* ── canvas draw ────────────────────────────────────────────── */
  const drawCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); const w=c.width, h=c.height;
    for(let x=0;x<w;x++) for(let y=0;y<h;y++){
      const [r,g,b]=hsvToRgb(hue,x/w,1-y/h);
      ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(x,y,1,1);
    }
  }, [hue]);

  const drawHueBar = useCallback(() => {
    const c = hueRef.current; if (!c) return;
    const ctx = c.getContext("2d"); const w=c.width, h=c.height;
    const g = ctx.createLinearGradient(0,0,w,0);
    for(let i=0;i<=6;i++){const [r,b2,b]=hsvToRgb(i/6,1,1);g.addColorStop(i/6,`rgb(${r},${b2},${b})`);}
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }, []);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);
  useEffect(() => { drawHueBar(); }, [drawHueBar]);

  const getCoords = (e) => e.touches?.[0] ?? e;

  const handleCanvas = (e) => {
    const c = canvasRef.current; if (!c) return;
    const {clientX,clientY} = getCoords(e);
    const rect = c.getBoundingClientRect();
    const x = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    const y = Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
    setSatPos({x,y});
    const [r,g,b] = hsvToRgb(hue,x,1-y);
    setRgb([r,g,b]); setHex(rgbToHex(r,g,b));
    onColorChange?.({ rgb:[r,g,b], brightness, mode:"solid" });
  };

  const handleHue = (e) => {
    const c = hueRef.current; if (!c) return;
    const {clientX} = getCoords(e);
    const rect = c.getBoundingClientRect();
    const x = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    setHue(x);
    const [r,g,b] = hsvToRgb(x,satPos.x,1-satPos.y);
    setRgb([r,g,b]); setHex(rgbToHex(r,g,b));
    onColorChange?.({ rgb:[r,g,b], brightness, mode:"solid" });
  };

  useEffect(() => {
    const mv = (e) => {
      if(isDragging.current) handleCanvas(e);
      if(isHueDragging.current) handleHue(e);
    };
    const up = () => { isDragging.current=false; isHueDragging.current=false; };
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    window.addEventListener("touchend",up);
    return () => { window.removeEventListener("mousemove",mv); window.removeEventListener("mouseup",up); window.removeEventListener("touchend",up); };
  });

  const applyPreset = (color) => {
    setHex(color);
    const [r,g,b] = hexToRgb(color);
    setRgb([r,g,b]);
    const {h,s,v} = rgbToHsv(r,g,b);
    setHue(h); setSatPos({x:s,y:1-v});
    onColorChange?.({ rgb:[r,g,b], brightness, mode:"solid" });
  };

  const applyHexInput = (val) => {
    setHex(val);
    if(/^#[0-9A-Fa-f]{6}$/.test(val)){
      const [r,g,b]=hexToRgb(val); setRgb([r,g,b]);
      const {h,s,v}=rgbToHsv(r,g,b); setHue(h); setSatPos({x:s,y:1-v});
      onColorChange?.({ rgb:[r,g,b], brightness, mode:"solid" });
    }
  };

  const brightnessPercent = Math.round(brightness/255*100);

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-lg">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              tab===t ? "bg-white text-[#1C2025] shadow-sm" : "text-[#637083] hover:text-[#1C2025]"
            }`}
          >{t}</button>
        ))}
      </div>

      {/* ── SOLID ─── */}
      {tab==="Solid" && (
        <div className="space-y-3">
          {/* Canvas picker */}
          <div className="relative">
            <canvas ref={canvasRef} width={240} height={140}
              className="w-full rounded-md border border-[#E5E7EB] cursor-crosshair touch-none"
              onMouseDown={(e)=>{isDragging.current=true;handleCanvas(e);}}
              onTouchStart={(e)=>{isDragging.current=true;handleCanvas(e);}}
            />
            <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow pointer-events-none"
              style={{left:`calc(${satPos.x*100}% - 7px)`,top:`calc(${satPos.y*100}% - 7px)`,backgroundColor:hex}} />
          </div>
          {/* Hue bar */}
          <div className="relative">
            <canvas ref={hueRef} width={240} height={14}
              className="w-full rounded-md cursor-pointer touch-none"
              onMouseDown={(e)=>{isHueDragging.current=true;handleHue(e);}}
              onTouchStart={(e)=>{isHueDragging.current=true;handleHue(e);}}
            />
            <div className="absolute top-0 w-2.5 h-3.5 rounded-sm border-2 border-white shadow pointer-events-none"
              style={{left:`calc(${hue*100}% - 5px)`}} />
          </div>
          {/* Hex + preview */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md border border-[#E5E7EB] flex-shrink-0" style={{backgroundColor:hex}} />
            <div className="flex-1">
              <Label className="text-[10px] uppercase tracking-wider text-[#637083]">HEX</Label>
              <Input value={hex} onChange={(e)=>applyHexInput(e.target.value)} className="h-7 text-xs font-mono" />
            </div>
          </div>
          {/* Color presets */}
          <div className="flex flex-wrap gap-1.5">
            {SOLID_PRESETS.map((c) => (
              <button key={c} onClick={()=>applyPreset(c)}
                className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${hex.toUpperCase()===c?"border-[#1C2025]":"border-transparent"}`}
                style={{backgroundColor:c}} title={c} />
            ))}
          </div>
        </div>
      )}

      {/* ── GRADIENT ─── */}
      {tab==="Gradient" && (
        <div className="space-y-3">
          <p className="text-xs text-[#637083]">
            Pick two colours — the gradient is distributed linearly across all selected lights.
          </p>
          <div className="flex gap-3 items-start">
            {[["Color A", gradA, setGradA], ["Color B", gradB, setGradB]].map(([label, val, setter]) => (
              <div key={label} className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-[#637083]">{label}</Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md border border-[#E5E7EB]" style={{backgroundColor:val}} />
                  <input type="color" value={val}
                    onChange={(e) => {
                      setter(e.target.value.toUpperCase());
                      const aRgb = hexToRgb(gradA); const bRgb = hexToRgb(gradB);
                      onColorChange?.({ gradA: hexToRgb(label==="Color A"?e.target.value:gradA), gradB: hexToRgb(label==="Color B"?e.target.value:gradB), brightness, mode:"gradient" });
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>
                <Input value={val} onChange={(e)=>{ setter(e.target.value.toUpperCase()); }} className="h-7 text-xs font-mono" placeholder="#RRGGBB" />
              </div>
            ))}
          </div>
          {/* Preview gradient */}
          <div className="h-6 rounded-md border border-[#E5E7EB]"
            style={{background:`linear-gradient(to right, ${gradA}, ${gradB})`}} />
          <button
            className="w-full py-2 text-xs font-medium bg-[#DA2C38] text-white rounded-md hover:bg-[#B9252F] transition-colors"
            onClick={() => onColorChange?.({ gradA: hexToRgb(gradA), gradB: hexToRgb(gradB), brightness, mode:"gradient" })}
          >
            Apply Gradient to Selected
          </button>
        </div>
      )}

      {/* ── COLOR TEMP ─── */}
      {tab==="Color Temp" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-[#637083]">Color Temperature</Label>
            <span className="text-sm font-medium text-[#1C2025]">{colorTemp}K</span>
          </div>
          {/* Temp gradient bar */}
          <div className="h-4 rounded-md" style={{background:"linear-gradient(to right,#FF8C00,#FFF4E0,#E8F4FF,#CCE5FF)"}} />
          <Slider value={[colorTemp]} onValueChange={(v)=>{setColorTemp(v[0]);onColorChange?.({colortemp:v[0],brightness,mode:"colortemp"});}}
            min={2200} max={6500} step={100}
            className="[&_[role=slider]]:border-[#DA2C38] [&_span:first-child>span]:bg-[#DA2C38]"
          />
          <div className="flex justify-between text-[10px] text-[#9CA3AF]">
            <span>2200K Warm</span><span>6500K Cool</span>
          </div>
          {/* Quick temps */}
          <div className="flex gap-2 flex-wrap">
            {[2700,3000,4000,5000,6500].map((k) => (
              <button key={k} onClick={()=>{setColorTemp(k);onColorChange?.({colortemp:k,brightness,mode:"colortemp"});}}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${colorTemp===k?"bg-[#DA2C38] border-[#DA2C38] text-white":"border-[#E5E7EB] text-[#637083] hover:border-[#DA2C38]"}`}
              >{k}K</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Brightness (always visible) ─── */}
      <div className="pt-1 border-t border-[#F3F4F6]">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-[10px] uppercase tracking-wider text-[#637083]">Brightness</Label>
          <span className="text-xs font-medium text-[#1C2025]">{brightnessPercent}%</span>
        </div>
        <Slider value={[brightness]} onValueChange={(v)=>onBrightnessChange?.(v[0])}
          min={0} max={255} step={1}
          className="[&_[role=slider]]:border-[#DA2C38] [&_span:first-child>span]:bg-[#DA2C38]"
        />
      </div>
    </div>
  );
}

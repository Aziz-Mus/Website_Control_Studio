import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import LightNode from "./LightNode";

const CELL_W   = 52;
const CELL_H   = 64;
const GAP_H    = 20;   // gap between baris columns
const GAP_V    = 0;    // gap between lights in a column
const CEIL_Y   = 10;   // ceiling rail Y
const FIRST_PAD = 50;  // ceiling → first light distance (baris 1, offset 0)

// Vertical offset per baris in lamp-units (cumulative +2 for each of 2,3,4)
const BARIS_OFFSET = { 1: 0, 2: 2, 3: 2, 4: 2, 5: 0 };

export default function LightGrid({
  lights = [], statuses = {}, selectedIds = [],
  onToggle, onSelectRow, onSelectAll, onDeselectAll, showIp = false,
}) {
  const [transform, setTransform] = useState({ x: 20, y: 10, scale: 0.7 });
  const isPanning     = useRef(false);
  const lastPan       = useRef({ x: 0, y: 0 });
  const lastTouch     = useRef(null);
  const lastPinchDist = useRef(null);
  const containerRef  = useRef(null);

  /* ── build per-baris map ─────────────────────────────── */
  const barisMap = {};
  lights.forEach(l => {
    (barisMap[l.baris] = barisMap[l.baris] || []).push(l);
  });
  const sortedBaris = Object.keys(barisMap).map(Number).sort((a, b) => a - b);

  /* ── coordinate helpers ──────────────────────────────── */
  const colX = baris => sortedBaris.indexOf(baris) * (CELL_W + GAP_H);
  const cX   = baris => colX(baris) + CELL_W / 2;

  const lightY = (baris, kolom) => {
    const sortedK = (barisMap[baris] || []).map(l => l.kolom).sort((a,b)=>a-b);
    const kIdx    = sortedK.indexOf(kolom);
    const offset  = BARIS_OFFSET[baris] ?? 0;
    return CEIL_Y + FIRST_PAD + (offset + kIdx) * (CELL_H + GAP_V);
  };

  /* ── grid dimensions ─────────────────────────────────── */
  const gridW = sortedBaris.length * (CELL_W + GAP_H) - GAP_H;
  let gridH = 0;
  lights.forEach(l => { const b = lightY(l.baris, l.kolom) + CELL_H; if (b > gridH) gridH = b; });
  gridH += 24;

  /* ── SVG elements ────────────────────────────────────── */
  const railX1 = cX(sortedBaris[0]);
  const railX2 = cX(sortedBaris[sortedBaris.length - 1]);

  const wires = sortedBaris.map(b => {
    const firstK = Math.min(...barisMap[b].map(l => l.kolom));
    return { x: cX(b), y1: CEIL_Y, y2: lightY(b, firstK) + 6 };
  });

  const connectors = sortedBaris.flatMap(b => {
    const ks = barisMap[b].map(l => l.kolom).sort((a,b)=>a-b);
    return ks.slice(0,-1).map((k, i) => ({
      x:  cX(b),
      y1: lightY(b, k)     + CELL_H - 4,
      y2: lightY(b, ks[i+1]) + 4,
    }));
  });

  /* ── pan / zoom ─────────────────────────────────────── */
  const onMouseDown = e => {
    if (e.target.closest("[data-ln]")) return;
    isPanning.current = true; lastPan.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };
  const onMouseMove = useCallback(e => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPan.current.x, dy = e.clientY - lastPan.current.y;
    lastPan.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);
  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const onTouchStart = e => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDist.current = null;
    } else if (e.touches.length === 2) {
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
      lastTouch.current = null;
    }
  };
  const onTouchMove = e => {
    if (e.touches.length === 1 && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      e.preventDefault();
    } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setTransform(t => ({ ...t, scale: Math.max(0.2, Math.min(3, t.scale * (d / lastPinchDist.current))) }));
      lastPinchDist.current = d; e.preventDefault();
    }
  };
  const onWheel = e => {
    e.preventDefault();
    setTransform(t => ({ ...t, scale: Math.max(0.2, Math.min(3, t.scale * (e.deltaY < 0 ? 1.1 : 0.9))) }));
  };

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const zoomIn  = () => setTransform(t => ({ ...t, scale: Math.min(3, t.scale * 1.2) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(0.2, t.scale / 1.2) }));

  const onlineCount = lights.filter(l => statuses[l.id]?.online).length;

  return (
    <div className="flex flex-col h-full gap-2">

      {/* ── Toolbar (Top) ─────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.4)" }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
          <span className="text-xs font-medium text-green-400">{onlineCount} / {lights.length} Online</span>
        </div>
        {[["Select All", onSelectAll], ["Deselect All", onDeselectAll]].map(([label, fn]) => (
          <button key={label} onClick={fn}
            className="px-3 py-1 text-xs font-medium rounded-md transition-colors"
            style={{ background:"rgba(255,255,255,0.08)", color:"#D1D5DB", border:"1px solid rgba(255,255,255,0.12)" }}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color:"#6B7280" }}>{selectedIds.length} selected</span>
      </div>

      {/* ── Main Layout (Left Sidebar + Canvas) ─────────────── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* Left Sidebar: Row Selector + Legend */}
        <div className="flex flex-col gap-6 w-28 flex-shrink-0">
          
          {/* Row Selectors (Vertical) */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#4B5563] mb-1">ROWS</span>
            {sortedBaris.map(b => (
              <button key={b} onClick={() => onSelectRow(b)}
                className="w-full py-3 text-xs font-medium rounded-md transition-all"
                style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#9CA3AF" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(218,44,56,0.6)"; e.currentTarget.style.color="#DA2C38"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#9CA3AF"; }}
              >
                Row {b}
              </button>
            ))}
          </div>

          {/* Legend (Vertical) */}
          <div className="flex flex-col gap-3 mt-auto pb-4">
            <span className="text-[10px] font-bold tracking-widest text-[#4B5563]">LEGEND</span>
            {[
              ["Smart Light (ON)", { background:"radial-gradient(circle at 35% 30%,rgba(255,248,200,1),rgba(200,160,60,0.6))", boxShadow:"0 0 5px rgba(255,220,100,0.7)" }],
              ["Standard / Offline", { background:"radial-gradient(circle at 35% 30%,#4B5563,#1F2937)", border:"1px solid rgba(255,255,255,0.1)" }],
              ["Selected", { border:"2px solid #DA2C38", boxShadow:"0 0 4px rgba(218,44,56,0.5)" }],
            ].map(([label, style]) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="w-5 h-5 rounded-full" style={style}/>
                <span className="text-[9px] leading-tight" style={{ color:"#9CA3AF" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef}
          className="flex-1 rounded-xl overflow-hidden relative cursor-grab active:cursor-grabbing"
          style={{ background:"#0D1117", border:"1px solid rgba(255,255,255,0.06)", minHeight:300 }}
          onMouseDown={onMouseDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove}
        >
          {/* Transformable content */}
          <div style={{
            transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "top left",
            position: "relative", width: gridW, height: gridH,
          }}>
            {/* SVG lines */}
            <svg style={{ position:"absolute", inset:0, width:gridW, height:gridH, overflow:"visible" }}
              className="pointer-events-none">
              {/* Ceiling rail */}
              <line x1={railX1} y1={CEIL_Y} x2={railX2} y2={CEIL_Y}
                stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}/>
              {/* Ceiling anchor dots */}
              {wires.map((w, i) => <circle key={i} cx={w.x} cy={CEIL_Y} r={3} fill="rgba(255,255,255,0.4)"/>)}
              {/* Wires: ceiling → first light */}
              {wires.map((w, i) => (
                <line key={i} x1={w.x} y1={CEIL_Y} x2={w.x} y2={w.y2}
                  stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>
              ))}
              {/* Column connectors */}
              {connectors.map((c, i) => (
                <line key={i} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3"/>
              ))}
            </svg>

            {/* Light nodes */}
            {lights.map(light => (
              <div key={light.id} data-ln="true" style={{
                position: "absolute",
                left: colX(light.baris),
                top:  lightY(light.baris, light.kolom),
                width: CELL_W, height: CELL_H,
              }}>
                <LightNode
                  light={light}
                  status={statuses[light.id] ?? null}
                  isSelected={selectedIds.includes(light.id)}
                  showIp={showIp}
                  onClick={onToggle}
                />
              </div>
            ))}
          </div>

          {/* Zoom buttons */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
            {[[ZoomIn, zoomIn], [ZoomOut, zoomOut]].map(([Icon, fn], i) => (
              <button key={i} onClick={fn}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"#E5E7EB" }}>
                <Icon className="w-4 h-4"/>
              </button>
            ))}
          </div>

          {/* Scale badge */}
          <div className="absolute bottom-3 left-3 text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background:"rgba(0,0,0,0.5)", color:"#6B7280", border:"1px solid rgba(255,255,255,0.06)" }}>
            {Math.round(transform.scale * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}


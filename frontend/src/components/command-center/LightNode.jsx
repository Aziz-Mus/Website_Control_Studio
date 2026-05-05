/**
 * LightNode — single ceiling pendant light, visual style matching the reference UI.
 *
 * Props:
 *   light      : { id, baris, kolom, ip }
 *   status     : { online, is_on, brightness, rgb } | null
 *   isSelected : boolean
 *   showIp     : boolean
 *   onClick    : (id) => void
 */
export default function LightNode({ light, status, isSelected, showIp, onClick }) {
  const online   = status?.online ?? false;
  const isOn     = status?.is_on  ?? false;
  const rgb      = status?.rgb;
  const brightness = status?.brightness ?? 85;

  /* ── Determine glow colour ─────────────────────────────── */
  let glowColor  = "rgba(255,255,200,0)";   // off / offline
  let orbColor   = "#2A2D35";               // dark when offline
  let orbBorder  = "rgba(255,255,255,0.08)";

  if (online && isOn) {
    if (rgb && (rgb[0] > 10 || rgb[1] > 10 || rgb[2] > 10)) {
      glowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.75)`;
      orbColor  = `rgb(${Math.min(255,rgb[0]+60)},${Math.min(255,rgb[1]+60)},${Math.min(255,rgb[2]+60)})`;
      orbBorder = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)`;
    } else {
      // white/warm white default
      const br = Math.max(0.3, brightness / 100);
      glowColor = `rgba(255,240,180,${0.55 * br})`;
      orbColor  = `rgba(255,248,220,${br})`;
      orbBorder = `rgba(255,230,120,0.7)`;
    }
  } else if (online) {
    orbColor  = "#4B5563"; // online but off
    orbBorder = "rgba(255,255,255,0.15)";
  }

  const glowSize   = isOn && online ? 18 : 0;
  const selected   = isSelected;

  return (
    <div
      className={`flex flex-col items-center gap-0.5 cursor-pointer select-none transition-transform active:scale-90 hover:scale-105`}
      style={{ width: 44 }}
      onClick={() => onClick(light.id)}
      title={`${light.id} · ${light.ip}${!online ? " (offline)" : isOn ? " (on)" : " (off)"}`}
    >
      {/* Orb wrapper — contains glow + orb + selection ring */}
      <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
        {/* Glow halo */}
        {online && isOn && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 36 + glowSize * 2,
              height: 36 + glowSize * 2,
              top: -glowSize,
              left: -glowSize,
              background: glowColor,
              filter: `blur(${glowSize * 0.8}px)`,
              opacity: 0.9,
            }}
          />
        )}

        {/* Selection ring */}
        {selected && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none animate-pulse"
            style={{ border: "2.5px solid #DA2C38", boxShadow: "0 0 0 2px rgba(218,44,56,0.3)" }}
          />
        )}

        {/* The orb */}
        <div
          className="rounded-full transition-all duration-300 relative z-10"
          style={{
            width: 28,
            height: 28,
            background: online && isOn
              ? `radial-gradient(circle at 38% 32%, ${orbColor}, ${
                  rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.6)` : "rgba(200,160,60,0.6)"
                })`
              : `radial-gradient(circle at 38% 32%, ${orbColor}, rgba(0,0,0,0.5))`,
            border: `1.5px solid ${orbBorder}`,
            boxShadow: online && isOn
              ? `0 0 8px 2px ${glowColor}, inset 0 1px 3px rgba(255,255,255,0.4)`
              : "inset 0 1px 2px rgba(255,255,255,0.07)",
          }}
        />
      </div>

      {/* Base / socket indicator */}
      <div
        className="rounded-sm transition-colors"
        style={{
          width: 10,
          height: 5,
          backgroundColor: online ? (isOn ? "#F59E0B" : "#6B7280") : "#374151",
          boxShadow: online && isOn ? "0 0 4px rgba(245,158,11,0.6)" : "none",
        }}
      />

      {/* IP address (conditional) */}
      {showIp && (
        <span
          className="text-center leading-tight font-mono"
          style={{ fontSize: 7, color: online ? "#9CA3AF" : "#4B5563", maxWidth: 44, wordBreak: "break-all" }}
        >
          {light.ip}
        </span>
      )}
    </div>
  );
}

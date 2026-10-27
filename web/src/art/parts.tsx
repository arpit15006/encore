import { useId, type ReactNode } from "react";

/**
 * Encore's illustrations are original SVG drawn for this project (no album art, posters or stills).
 * Colors come from classes in art.css, so every piece follows light and dark mode.
 * All art is decorative: hidden from screen readers, and the words beside it carry the meaning.
 */
export function Art({ viewBox, className, children }: { viewBox: string; className?: string; children: ReactNode }) {
  return (
    <svg className={className ? `art ${className}` : "art"} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** A unique id safe to use inside url(#…) references. */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** An eighth note with its head at (x, y). */
export function Note({ x, y, scale = 1, tone = "t" }: { x: number; y: number; scale?: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className={tone}>
      <ellipse cx="0" cy="0" rx="9" ry="6.5" transform="rotate(-20)" />
      <rect x="6" y="-34" width="3.4" height="33" rx="1.5" />
      <path d="M8 -34 C21 -29 24 -18 18 -9 C19 -17 15 -23 8 -24 Z" />
    </g>
  );
}

/** A four-point sparkle centered on (x, y). */
export function Sparkle({ x, y, size = 10, tone = "m" }: { x: number; y: number; size?: number; tone?: string }) {
  const s = size;
  return (
    <path
      className={tone}
      d={`M${x} ${y - s} Q${x + s * 0.15} ${y - s * 0.15} ${x + s} ${y} Q${x + s * 0.15} ${y + s * 0.15} ${x} ${y + s} Q${x - s * 0.15} ${y + s * 0.15} ${x - s} ${y} Q${x - s * 0.15} ${y - s * 0.15} ${x} ${y - s} Z`}
    />
  );
}

/** A heart centered on (x, y), about 2·size wide. */
export function Heart({ x, y, size = 8, tone = "t" }: { x: number; y: number; size?: number; tone?: string }) {
  const s = size / 8;
  return (
    <path
      className={tone}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 7 C-11 -1 -9 -11 0 -6 C9 -11 11 -1 0 7 Z"
    />
  );
}

/** A vinyl record: grooves, a colored label and the spindle hole. */
export function Record({ cx, cy, r, label = "t" }: { cx: number; cy: number; r: number; label?: string }) {
  const grooves = [0.9, 0.78, 0.66, 0.54];
  return (
    <g>
      <circle className="v" cx={cx} cy={cy} r={r} />
      {grooves.map((g) => (
        <circle key={g} className="groove" cx={cx} cy={cy} r={r * g} />
      ))}
      <path className="shine" d={`M${cx - r * 0.62} ${cy - r * 0.5} A${r * 0.8} ${r * 0.8} 0 0 1 ${cx + r * 0.1} ${cy - r * 0.8}`} />
      <circle className={label} cx={cx} cy={cy} r={r * 0.34} />
      <circle className="label-ring" cx={cx} cy={cy} r={r * 0.24} />
      <circle className="p" cx={cx} cy={cy} r={Math.max(2, r * 0.05)} />
    </g>
  );
}

/** Wedges radiating from a center: the warm sunburst behind hero scenes. */
export function Sunburst({ cx, cy, r, rays = 18, tone = "sun-ray" }: { cx: number; cy: number; r: number; rays?: number; tone?: string }) {
  const paths: string[] = [];
  for (let i = 0; i < rays; i += 2) {
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = ((i + 1) / rays) * Math.PI * 2;
    const x1 = (cx + r * Math.cos(a1)).toFixed(1);
    const y1 = (cy + r * Math.sin(a1)).toFixed(1);
    const x2 = (cx + r * Math.cos(a2)).toFixed(1);
    const y2 = (cy + r * Math.sin(a2)).toFixed(1);
    paths.push(`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`);
  }
  return (
    <g>
      <circle className="sun-disc" cx={cx} cy={cy} r={r} />
      {paths.map((d) => (
        <path key={d} className={tone} d={d} />
      ))}
    </g>
  );
}

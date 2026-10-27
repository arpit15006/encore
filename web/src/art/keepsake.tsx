import type { ReactNode } from "react";
import { Art, Record, useSvgId } from "./parts";

/**
 * Generated keepsake art for each pick: a record sleeve, a film frame or a TV set, patterned in the style
 * of the decade the pick comes from. The pattern is seeded by the item's id, so it stays the same on every
 * visit. It is abstract on purpose: Encore never shows real album covers or posters.
 */
export type KeepsakeKind = "music" | "films" | "tv";

const TONES = ["t", "m", "g", "r", "d", "c"];

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

/** Three different tones, background first. */
function tonesFor(random: () => number): [string, string, string] {
  const pool = [...TONES];
  const out: string[] = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  return out as [string, string, string];
}

type Style = "deco" | "atomic" | "op" | "groovy" | "memphis";

const STYLES: Style[] = ["deco", "atomic", "op", "groovy", "memphis"];

/** The decade's look; without a year, the seed picks one. */
export function styleFor(year: number | null, random: () => number): Style {
  if (year == null) return pick(random, STYLES);
  if (year < 1950) return "deco";
  if (year < 1960) return "atomic";
  if (year < 1970) return "op";
  if (year < 1980) return "groovy";
  return "memphis";
}

export function decadeLabel(year: number | null): string | undefined {
  if (year == null) return undefined;
  const decade = Math.floor(year / 10) * 10;
  return decade >= 2000 ? `${decade}s` : `’${String(decade).slice(2)}s`;
}

/** The pattern itself, drawn in a 100 × 100 square. */
function Pattern({ style, random, tones }: { style: Style; random: () => number; tones: [string, string, string] }): ReactNode {
  const [bg, a, b] = tones;
  const nodes: ReactNode[] = [<rect key="bg" className={bg} x="0" y="0" width="100" height="100" />];
  if (style === "deco") {
    const variant = Math.floor(random() * 3);
    if (variant === 1) {
      // Chevrons stacked like a 1930s cinema front.
      for (let i = 0; i < 7; i++) {
        const y = 100 - i * 18;
        nodes.push(<path key={`v${i}`} className={i % 2 ? a : b} d={`M0 ${y} L50 ${y - 26} L100 ${y} V${y + 10} L50 ${y - 16} L0 ${y + 10} Z`} />);
      }
      nodes.push(<circle key="dot" className="p o2" cx="50" cy={24 + random() * 20} r="7" />);
      return nodes;
    }
    if (variant === 2) {
      // Stepped towers and a moon, skyline deco.
      const widths = [18, 14, 22, 16, 20];
      let x = -4;
      widths.forEach((w, i) => {
        const h = 30 + random() * 45;
        nodes.push(<path key={`s${i}`} className={i % 2 ? a : b} d={`M${x} 100 V${100 - h} H${x + w * 0.25} V${96 - h - 6} H${x + w * 0.75} V${100 - h} H${x + w} V100 Z`} />);
        x += w + 2;
      });
      nodes.push(<circle key="moon" className="p" cx={20 + random() * 60} cy="20" r="9" />);
      return nodes;
    }
    // A fan rising from the bottom, with stepped arcs.
    const cx = 20 + random() * 60;
    for (let i = 0; i < 12; i += 2) {
      const a1 = Math.PI + (i / 12) * Math.PI;
      const a2 = Math.PI + ((i + 1) / 12) * Math.PI;
      nodes.push(
        <path key={`f${i}`} className={a} d={`M${cx} 100 L${cx + 130 * Math.cos(a1)} ${100 + 130 * Math.sin(a1)} L${cx + 130 * Math.cos(a2)} ${100 + 130 * Math.sin(a2)} Z`} />,
      );
    }
    [30, 22, 14].forEach((r, i) => nodes.push(<circle key={`c${i}`} className={i % 2 ? bg : b} cx={cx} cy="100" r={r} />));
  } else if (style === "atomic") {
    // Starbursts and boomerangs, the 1950s "atomic" look.
    for (let s = 0; s < 3; s++) {
      const x = 15 + random() * 70;
      const y = 15 + random() * 70;
      const r = 8 + random() * 10;
      const tone = s % 2 ? a : b;
      nodes.push(
        <g key={`s${s}`}>
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            return <line key={i} className={`ln-${tone}`} x1={x} y1={y} x2={x + r * Math.cos(angle)} y2={y + r * Math.sin(angle)} />;
          })}
          <circle className={tone} cx={x} cy={y} r={2.6} />
        </g>,
      );
    }
    for (let k = 0; k < 2; k++) {
      const x = 10 + random() * 60;
      const y = 10 + random() * 60;
      const turn = Math.floor(random() * 360);
      nodes.push(<path key={`b${k}`} className={k ? b : a} transform={`rotate(${turn} ${x + 15} ${y + 8})`} d={`M${x} ${y + 10} Q${x + 15} ${y - 6} ${x + 30} ${y + 10} Q${x + 15} ${y + 2} ${x} ${y + 10} Z`} />);
    }
    for (let d = 0; d < 10; d++) nodes.push(<circle key={`d${d}`} className={a} cx={random() * 100} cy={random() * 100} r="1.4" />);
  } else if (style === "op") {
    // Offset concentric rings and a flower, 1960s op art.
    const x = 30 + random() * 40;
    const y = 30 + random() * 40;
    for (let r = 70; r > 0; r -= 10) nodes.push(<circle key={`r${r}`} className={(r / 10) % 2 ? a : bg} cx={x} cy={y} r={r} />);
    const fx = 20 + random() * 60;
    const fy = 20 + random() * 60;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      nodes.push(<circle key={`p${i}`} className={b} cx={fx + 8 * Math.cos(angle)} cy={fy + 8 * Math.sin(angle)} r="6" />);
    }
    nodes.push(<circle key="pc" className="p" cx={fx} cy={fy} r="5" />);
  } else if (style === "groovy") {
    // Rainbow arcs from a corner, 1970s.
    const corner = pick(random, [
      [0, 100],
      [100, 100],
      [0, 0],
      [100, 0],
    ] as const);
    const bands = [a, b, "p", a, b];
    bands.forEach((tone, i) => nodes.push(<circle key={`a${i}`} className={tone} cx={corner[0]} cy={corner[1]} r={110 - i * 16} />));
    nodes.push(<circle key="core" className={bg} cx={corner[0]} cy={corner[1]} r="30" />);
    const sx = 100 - corner[0] * 0.7 - 15;
    const sy = 100 - corner[1] * 0.7 - 15;
    nodes.push(<circle key="sun" className="m" cx={Math.max(18, Math.min(82, sx))} cy={Math.max(18, Math.min(82, sy))} r="9" />);
  } else {
    // Memphis: triangles, a squiggle and a dot grid.
    for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 5; gy++) nodes.push(<circle key={`g${gx}-${gy}`} className={a} cx={10 + gx * 20} cy={10 + gy * 20} r="1.6" />);
    for (let t = 0; t < 3; t++) {
      const x = 10 + random() * 70;
      const y = 10 + random() * 70;
      const turn = Math.floor(random() * 360);
      nodes.push(<path key={`t${t}`} className={t % 2 ? a : b} transform={`rotate(${turn} ${x + 10} ${y + 10})`} d={`M${x} ${y + 20} L${x + 10} ${y} L${x + 20} ${y + 20} Z`} />);
    }
    const y = 30 + random() * 40;
    nodes.push(<path key="sq" className={`ln-${b}`} style={{ strokeWidth: 4 }} d={`M6 ${y} q8 -10 16 0 t16 0 t16 0 t16 0 t16 0 t16 0`} />);
    nodes.push(<circle key="o" className="p o2" cx={20 + random() * 60} cy={20 + random() * 60} r="9" />);
  }
  return nodes;
}

function DecadeTag({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect className="v" x={x} y={y} width={text.length * 7.6 + 10} height="17" rx="8.5" />
      <text className="tag-text" x={x + 5 + (text.length * 7.6) / 2} y={y + 12.5} fontSize="11.5" textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

export function Keepsake({ kind, seed, year, className }: { kind: KeepsakeKind; seed: string; year: number | null; className?: string }) {
  const clip = useSvgId("keepsake");
  const random = seeded(seed);
  const tones = tonesFor(random);
  const style = styleFor(year, random);
  const label = decadeLabel(year);
  const pattern = <Pattern style={style} random={random} tones={tones} />;
  const recordLabel = pick(random, TONES.filter((tone) => tone !== tones[0]));

  if (kind === "music") {
    return (
      <Art viewBox="0 0 150 104" className={`keepsake-art ${className ?? ""}`}>
        <defs>
          <clipPath id={clip}>
            <rect x="2" y="2" width="100" height="100" rx="3" />
          </clipPath>
        </defs>
        <g className="sleeve-record">
          <Record cx={100} cy={52} r={46} label={recordLabel} />
        </g>
        <g clipPath={`url(#${clip})`}>{pattern}</g>
        <rect className="o2" fill="none" x="2" y="2" width="100" height="100" rx="3" />
        {label && <DecadeTag x={8} y={80} text={label} />}
      </Art>
    );
  }
  if (kind === "films") {
    return (
      <Art viewBox="0 0 150 104" className={`keepsake-art ${className ?? ""}`}>
        <defs>
          <clipPath id={clip}>
            <rect x="12" y="18" width="126" height="68" rx="2" />
          </clipPath>
        </defs>
        <rect className="v" x="2" y="4" width="146" height="96" rx="4" />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect className="p" x={8 + i * 16} y="8" width="8" height="6" rx="1.5" />
            <rect className="p" x={8 + i * 16} y="90" width="8" height="6" rx="1.5" />
          </g>
        ))}
        <g clipPath={`url(#${clip})`}>
          <g className="film-roll">
            <g transform="translate(12 -11) scale(1.26)">{pattern}</g>
          </g>
        </g>
        {label && <DecadeTag x={18} y={64} text={label} />}
      </Art>
    );
  }
  return (
    <Art viewBox="0 0 150 104" className={`keepsake-art ${className ?? ""}`}>
      <defs>
        <clipPath id={clip}>
          <rect x="22" y="22" width="84" height="66" rx="12" />
        </clipPath>
      </defs>
      <path className="ln" d="M58 14 L44 2 M72 14 L90 0" />
      <rect className={`${tones[1] === "d" ? "t" : "d"} o2`} x="12" y="14" width="128" height="86" rx="14" />
      <g clipPath={`url(#${clip})`}>
        <g transform="translate(22 6) scale(0.98)">{pattern}</g>
        <g className="tv-static">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((line) => (
            <rect key={line} className="p" x="22" y={24 + line * 8} width="84" height="2" opacity="0.35" />
          ))}
        </g>
      </g>
      <rect className="o2" fill="none" x="22" y="22" width="84" height="66" rx="12" />
      <circle className="m o2" cx="124" cy="38" r="7" />
      <circle className="c o2" cx="124" cy="60" r="5" />
      <path className="ln-light" d="M116 78 H132 M116 84 H132" />
      {label && <DecadeTag x={28} y={66} text={label} />}
    </Art>
  );
}

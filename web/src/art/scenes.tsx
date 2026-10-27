import { Art, Heart, Note, Record, Sparkle, Sunburst, useSvgId } from "./parts";

/** A cassette tape centered on the origin, 120 × 76. */
function Cassette({ body = "m" }: { body?: string }) {
  return (
    <g>
      <rect className={`${body} o`} x="-60" y="-38" width="120" height="76" rx="8" />
      <rect className="p o2" x="-50" y="-31" width="100" height="14" rx="3" />
      <path className="ln2" d="M-42 -24 H30" />
      <rect className="c o2" x="-36" y="-11" width="72" height="26" rx="7" />
      <circle className="i" cx="-18" cy="2" r="9" />
      <circle className="p" cx="-18" cy="2" r="3.2" />
      <circle className="i" cx="18" cy="2" r="9" />
      <circle className="p" cx="18" cy="2" r="3.2" />
      <path className="p o2" d="M-34 38 L-26 24 H26 L34 38 Z" />
    </g>
  );
}

/** A strip of film centered on the origin, 48 wide. */
function FilmStrip({ length = 190, frames = ["g", "m", "r", "t"] }: { length?: number; frames?: string[] }) {
  const top = -length / 2;
  const holes = Math.floor(length / 16);
  const frameHeight = (length - 20) / frames.length - 8;
  return (
    <g>
      <rect className="v" x="-24" y={top} width="48" height={length} rx="3" />
      {Array.from({ length: holes }, (_, i) => (
        <g key={i}>
          <rect className="p" x="-20" y={top + 6 + i * 16} width="6" height="8" rx="1.5" />
          <rect className="p" x="14" y={top + 6 + i * 16} width="6" height="8" rx="1.5" />
        </g>
      ))}
      {frames.map((tone, i) => (
        <rect key={i} className={tone} x="-11" y={top + 12 + i * (frameHeight + 8)} width="22" height={frameHeight} rx="2" />
      ))}
    </g>
  );
}

/** A small instant photo: a sun over hills, nobody in it. */
function Polaroid({ sky = "sky2" }: { sky?: string }) {
  return (
    <g>
      <rect className="p o" x="-46" y="-56" width="92" height="108" rx="3" />
      <rect className={sky} x="-37" y="-47" width="74" height="70" />
      <circle className="m" cx="14" cy="-24" r="11" />
      <path className="g" d="M-37 8 Q-18 -14 2 4 Q20 -10 37 2 V23 H-37 Z" />
      <path className="ln2" d="M-28 36 H10" />
    </g>
  );
}

/** A postcard with a stamp and a few handwritten lines. */
function Postcard() {
  return (
    <g>
      <rect className="p o" x="-58" y="-38" width="116" height="76" rx="3" />
      <rect className="r o2" x="20" y="-30" width="30" height="34" rx="2" />
      <Heart x={35} y={-13} size={7} tone="p" />
      <path className="ln2" d="M-48 -18 H6 M-48 -4 H6 M-48 10 H-4 M-48 24 H-12" />
      <path className="ln2" d="M14 12 H50 M14 24 H44" />
    </g>
  );
}

/**
 * Landing hero: an open keepsake box with a record, a cassette, film and photographs rising out of it.
 * It says what Encore does before a word is read: the things from someone's youth, kept together.
 */
export function HeroScene() {
  return (
    <Art viewBox="0 0 560 440" className="hero-art">
      <Sunburst cx={280} cy={300} r={210} rays={22} />
      <ellipse className="shade" cx="280" cy="412" rx="200" ry="14" />

      <Sparkle x={150} y={70} size={11} tone="m" />
      <Sparkle x={432} y={58} size={8} tone="t" />
      <Sparkle x={512} y={282} size={9} tone="m" />
      <Sparkle x={44} y={318} size={7} tone="t" />
      <g className="float2">
        <Note x={92} y={150} scale={1.25} tone="t" />
      </g>
      <g className="float3">
        <Note x={470} y={140} scale={1} tone="g" />
      </g>
      <g className="float1">
        <Note x={500} y={220} scale={0.8} tone="m" />
      </g>

      {/* Lid, then the open top of the box. */}
      <path className="m o" d="M156 282 L404 282 L434 206 L180 194 Z" />
      <path className="ln-light" d="M170 262 L414 266" />
      <path className="d" d="M140 302 L420 302 L404 282 L156 282 Z" />

      <g transform="translate(300 168) rotate(7)">
        <g className="float3">
          <FilmStrip length={200} />
        </g>
      </g>
      <g className="float1">
        <Record cx={222} cy={214} r={86} label="t" />
      </g>
      <g transform="translate(360 196) rotate(14)">
        <g className="float2">
          <Cassette body="g" />
        </g>
      </g>

      {/* The front of the box hides whatever is still inside. */}
      <rect className="t o" x="140" y="300" width="280" height="110" rx="8" />
      <rect className="m" x="141.5" y="320" width="277" height="14" />
      <path className="ln2" d="M142 320 H418 M142 334 H418" />
      <rect className="p o2" x="236" y="352" width="88" height="40" rx="6" />
      <Heart x={280} y={372} size={10} tone="t" />
      <circle className="m o2" cx="160" cy="394" r="5" />
      <circle className="m o2" cx="400" cy="394" r="5" />

      <g transform="translate(110 300) rotate(-11)">
        <Polaroid />
      </g>
      <g transform="translate(456 344) rotate(-8)">
        <Postcard />
      </g>
    </Art>
  );
}

/** A record player whose record turns while Encore works. */
export function Turntable() {
  return (
    <Art viewBox="0 0 260 180" className="turntable-art">
      <ellipse className="shade" cx="130" cy="168" rx="112" ry="8" />
      <rect className="t o" x="14" y="44" width="232" height="116" rx="14" />
      <rect className="d" x="26" y="54" width="208" height="96" rx="9" />
      <g className="turn">
        <Record cx={104} cy={102} r={44} label="m" />
      </g>
      <circle className="p o2" cx="206" cy="72" r="10" />
      <path className="ln" d="M206 72 L194 118 L170 126" />
      <rect className="p o2" x="160" y="120" width="14" height="10" rx="2" transform="rotate(-18 167 125)" />
      <circle className="m o2" cx="212" cy="136" r="6" />
      <circle className="g o2" cx="192" cy="136" r="6" />
      <g className="rise">
        <Note x={140} y={46} scale={0.7} tone="t" />
      </g>
      <g className="rise later">
        <Note x={118} y={40} scale={0.55} tone="g" />
      </g>
      <g className="rise latest">
        <Note x={160} y={36} scale={0.6} tone="m" />
      </g>
    </Art>
  );
}

/** An open, empty keepsake box: for empty states. */
export function EmptyBox() {
  return (
    <Art viewBox="0 0 220 160" className="empty-art">
      <ellipse className="shade" cx="110" cy="150" rx="84" ry="7" />
      <path className="m o" d="M56 84 L164 84 L178 40 L68 34 Z" />
      <path className="d" d="M46 98 L174 98 L164 84 L56 84 Z" />
      <rect className="t o" x="46" y="96" width="128" height="52" rx="6" />
      <rect className="m" x="47.5" y="106" width="125" height="8" />
      <rect className="p o2" x="92" y="120" width="36" height="20" rx="4" />
      <Sparkle x={40} y={50} size={7} tone="m" />
      <Sparkle x={190} y={84} size={6} tone="t" />
      <Sparkle x={116} y={18} size={5} tone="m" />
    </Art>
  );
}

/** An envelope with a letter rising out of it: the family Visit Kit. */
export function Envelope() {
  return (
    <Art viewBox="0 0 280 190" className="envelope-art">
      <ellipse className="shade" cx="140" cy="180" rx="118" ry="7" />
      <path className="d o" d="M30 66 L250 66 L140 14 Z" />
      <g className="float1">
        <rect className="p o" x="52" y="24" width="176" height="112" rx="4" />
        <rect className="r o2" x="186" y="34" width="28" height="32" rx="2" />
        <Note x={196} y={58} scale={0.42} tone="p" />
        <path className="ln2" d="M66 44 H160 M66 60 H170 M66 76 H150" />
      </g>
      <path className="m o" d="M30 66 L140 134 L250 66 L250 172 L30 172 Z" />
      <path className="ln2" d="M30 172 L112 118 M250 172 L168 118" />
      <circle className="t o" cx="140" cy="132" r="15" />
      <Heart x={140} y={132} size={7} tone="p" />
    </Art>
  );
}

/** A small stage with a microphone and guitar, and an audience seen from behind: the group session. */
export function Stage() {
  const seats = ["g", "r", "m", "t", "c", "g"];
  return (
    <Art viewBox="0 0 400 230" className="stage-art">
      <polygon className="beam" points="200,0 128,168 272,168" />
      <path className="t o" d="M20 8 H380 V40 Q362 56 344 40 Q326 56 308 40 Q290 56 272 40 Q254 56 236 40 Q218 56 200 40 Q182 56 164 40 Q146 56 128 40 Q110 56 92 40 Q74 56 56 40 Q38 56 20 40 Z" />
      <path className="t o" d="M20 8 Q40 90 22 170 H64 Q52 90 76 40 Z" />
      <path className="t o" d="M380 8 Q360 90 378 170 H336 Q348 90 324 40 Z" />
      <path className="ln-light" d="M38 60 Q44 110 38 160 M362 60 Q356 110 362 160" />
      <rect className="d o" x="40" y="164" width="320" height="20" rx="3" />
      <path className="ln" d="M200 164 V100" />
      <path className="ln" d="M188 164 H212" />
      <rect className="v" x="193" y="80" width="14" height="24" rx="7" />
      <g transform="translate(252 128) rotate(-14)">
        <rect className="d o2" x="-3" y="-62" width="6" height="46" rx="2" />
        <circle className="m o2" cx="0" cy="-6" r="15" />
        <circle className="m o2" cx="0" cy="16" r="19" />
        <circle className="v" cx="0" cy="8" r="5" />
      </g>
      <g className="float2">
        <Note x={150} y={92} scale={0.8} tone="m" />
      </g>
      <g className="float3">
        <Note x={300} y={78} scale={0.65} tone="p" />
      </g>
      {seats.map((tone, i) => {
        const x = 70 + i * 52;
        return (
          <g key={i}>
            <path className={`${tone} o2`} d={`M${x - 22} 232 Q${x - 22} 206 ${x} 204 Q${x + 22} 206 ${x + 22} 232 Z`} />
            <circle className="d o2" cx={x} cy={194} r="13" />
          </g>
        );
      })}
    </Art>
  );
}

/** A desert island with a gramophone: how we tested Encore on real people's lifetime records. */
export function Island() {
  return (
    <Art viewBox="0 0 340 210" className="island-art">
      <circle className="m" cx="262" cy="56" r="30" />
      <path className="p o2" d="M44 52 q8 -14 22 -8 q10 -12 24 0 q14 0 12 10 H40 q-4 -2 4 -2 Z" />
      <path className="g" d="M0 150 Q40 140 80 150 T160 150 T240 150 T340 150 V184 Q170 214 0 184 Z" />
      <path className="ln-light" d="M24 172 q12 -6 24 0 M112 186 q12 -6 24 0 M220 176 q12 -6 24 0 M268 186 q12 -6 24 0" />
      <path className="c o" d="M66 156 Q170 104 276 156 Z" />
      <path className="ln" d="M128 148 Q122 104 146 60" style={{ strokeWidth: 8, stroke: "var(--art-deep)" }} />
      <path className="g o2" d="M146 60 Q120 40 92 54 Q118 50 146 60 Z" />
      <path className="g o2" d="M146 60 Q132 26 106 22 Q128 36 146 60 Z" />
      <path className="g o2" d="M146 60 Q160 26 188 26 Q164 38 146 60 Z" />
      <path className="g o2" d="M146 60 Q178 48 200 66 Q174 56 146 60 Z" />
      <path className="g o2" d="M146 60 Q142 76 130 90 Q144 80 146 60 Z" />
      <g transform="translate(206 120)">
        <rect className="t o2" x="-16" y="4" width="32" height="18" rx="2" />
        <ellipse className="v" cx="0" cy="4" rx="16" ry="4" />
        <path className="m o2" d="M2 2 L6 -6 Q14 -22 26 -34 L44 -42 Q42 -22 30 -16 Q18 -12 8 -4 Z" />
      </g>
      <g className="float2">
        <Note x={262} y={102} scale={0.6} tone="t" />
      </g>
      <g className="float3">
        <Note x={286} y={84} scale={0.45} tone="d" />
      </g>
    </Art>
  );
}

/** An open notebook with a pen and a pressed flower: telling Encore about someone. */
export function Notebook() {
  return (
    <Art viewBox="0 0 240 170" className="notebook-art">
      <ellipse className="shade" cx="120" cy="160" rx="104" ry="7" />
      <path className="t o" d="M14 34 Q66 24 120 38 Q174 24 226 34 V150 Q174 140 120 154 Q66 140 14 150 Z" />
      <path className="p o2" d="M22 30 Q70 20 120 34 V146 Q70 134 22 144 Z" />
      <path className="p o2" d="M218 30 Q170 20 120 34 V146 Q170 134 218 144 Z" />
      <path className="ln2" d="M34 52 Q70 44 108 54 M34 70 Q70 62 108 72 M34 88 Q70 80 108 90 M34 106 Q60 100 86 106" />
      <g transform="translate(170 82) rotate(6)">
        <rect className="p o2" x="-30" y="-36" width="60" height="68" rx="2" />
        <rect className="sky1" x="-24" y="-30" width="48" height="44" />
        <circle className="m" cx="10" cy="-16" r="7" />
        <path className="g" d="M-24 4 Q-8 -10 6 2 Q16 -6 24 0 V14 H-24 Z" />
        <rect className="m" x="-12" y="-42" width="24" height="10" rx="1" opacity="0.8" transform="rotate(-6)" />
      </g>
      <g transform="translate(70 122)">
        <path className="ln" d="M0 0 Q-4 -12 -2 -22" style={{ stroke: "var(--art-teal)", strokeWidth: 2.5 }} />
        <circle className="r" cx="-2" cy="-27" r="5" />
        <circle className="r" cx="-8" cy="-22" r="5" />
        <circle className="r" cx="4" cy="-22" r="5" />
        <circle className="m" cx="-2" cy="-23" r="3" />
      </g>
      <g transform="translate(196 136) rotate(-40)">
        <rect className="g o2" x="-6" y="-52" width="12" height="60" rx="3" />
        <path className="m o2" d="M-6 8 L0 22 L6 8 Z" />
        <rect className="d" x="-6" y="-52" width="12" height="8" rx="2" />
      </g>
    </Art>
  );
}

/** A picture to open the "try it" door: a photo, a record and a heart. */
export function KeepsakeTrio() {
  return (
    <Art viewBox="0 0 200 130" className="door-art">
      <Sunburst cx={100} cy={96} r={74} rays={16} />
      <g transform="translate(130 70)">
        <g className="float1">
          <Record cx={0} cy={0} r={44} label="t" />
        </g>
      </g>
      <g transform="translate(76 70) rotate(-9) scale(0.78)">
        <Polaroid sky="sky1" />
      </g>
      <g className="float3">
        <circle className="p o2" cx="164" cy="24" r="14" />
        <Heart x={164} y={24} size={7} tone="t" />
      </g>
      <Sparkle x={28} y={22} size={7} tone="m" />
    </Art>
  );
}

/** A picture for the guided tour: a care home at the end of a dotted path. */
export function CareHome() {
  return (
    <Art viewBox="0 0 200 130" className="door-art">
      <Sunburst cx={112} cy={104} r={74} rays={16} />
      <path className="g" d="M0 118 Q60 96 120 110 Q170 100 200 112 V130 H0 Z" />
      <rect className="c o2" x="78" y="54" width="76" height="56" />
      <path className="t o2" d="M70 56 L116 22 L162 56 Z" />
      <rect className="d" x="134" y="26" width="10" height="20" />
      <rect className="m o2" x="108" y="80" width="16" height="30" rx="2" />
      <rect className="p o2" x="86" y="64" width="16" height="14" />
      <rect className="p o2" x="130" y="64" width="16" height="14" />
      <path className="ln2" d="M94 64 V78 M86 71 H102 M138 64 V78 M130 71 H146" />
      <circle className="g o2" cx="176" cy="84" r="14" />
      <rect className="d" x="174" y="96" width="4" height="14" />
      <path className="trail" d="M20 112 Q40 86 64 106 Q86 120 112 112" />
      <g transform="translate(24 66)">
        <g className="float2">
          <path className="t o2" d="M0 -26 C14 -26 18 -12 12 -2 L0 16 L-12 -2 C-18 -12 -14 -26 0 -26 Z" />
          <circle className="p" cx="0" cy="-12" r="5" />
        </g>
      </g>
    </Art>
  );
}

/** The three ways to choose, as small badges for the comparison columns. */
export function SystemBadge({ system }: { system: "plain_ai" | "naive_qloo" | "encore" }) {
  const clip = useSvgId("badge");
  return (
    <Art viewBox="0 0 64 64" className="badge-art">
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>
      <circle className={system === "encore" ? "sky1" : system === "naive_qloo" ? "sky2" : "sky3"} cx="32" cy="32" r="30" />
      <g clipPath={`url(#${clip})`}>
        {system === "plain_ai" && (
          <>
            <path className="p o2" d="M14 18 H50 Q54 18 54 22 V40 Q54 44 50 44 H30 L20 52 V44 H14 Q10 44 10 40 V22 Q10 18 14 18 Z" />
            <circle className="i" cx="22" cy="31" r="3" />
            <circle className="i" cx="32" cy="31" r="3" />
            <circle className="i" cx="42" cy="31" r="3" />
          </>
        )}
        {system === "naive_qloo" && (
          <>
            {[14, 26, 38, 50].map((x) => [44, 54].map((y) => <circle key={`${x}-${y}`} className="g" cx={x} cy={y} r="4" opacity="0.55" />))}
            <path className="g o2" d="M32 8 C42 8 46 18 42 26 L32 42 L22 26 C18 18 22 8 32 8 Z" />
            <circle className="p" cx="32" cy="20" r="5" />
          </>
        )}
        {system === "encore" && (
          <>
            <path className="m o2" d="M16 36 L48 36 L52 24 L20 22 Z" />
            <circle className="v" cx="28" cy="30" r="12" />
            <circle className="t" cx="28" cy="30" r="4" />
            <rect className="t o2" x="12" y="36" width="40" height="18" rx="3" />
            <Heart x={32} y={45} size={5} tone="p" />
          </>
        )}
      </g>
    </Art>
  );
}

/** Encore's mark: a record whose label is a heart. */
export function BrandMark() {
  return (
    <svg className="art brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className="v" cx="20" cy="20" r="18" />
      <circle className="groove" cx="20" cy="20" r="14.5" />
      <circle className="groove" cx="20" cy="20" r="11.5" />
      <circle className="t" cx="20" cy="20" r="7.5" />
      <path className="p" transform="translate(20 20.2) scale(0.48)" d="M0 7 C-11 -1 -9 -11 0 -6 C9 -11 11 -1 0 7 Z" />
    </svg>
  );
}

/** A wavy groove line used to divide sections, like the sound in a record's groove. */
export function GrooveDivider() {
  return (
    <svg className="art groove-divider" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="trail" d="M0 12 Q15 2 30 12 T60 12 T90 12 T120 12 T150 12 T180 12 T210 12 T240 12 T270 12 T300 12 T330 12 T360 12 T390 12 T420 12 T450 12 T480 12 T510 12 T540 12 T570 12 T600 12" style={{ strokeDasharray: "none", strokeWidth: 2 }} />
    </svg>
  );
}

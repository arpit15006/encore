import type { ReactNode } from "react";
import { Art, useSvgId } from "./parts";

/**
 * Postage stamps for where someone grew up. Each scene is a generic, original sketch of a place
 * (sea, hills, buildings), never a photo or a real stamp design. Religious symbols are left out on purpose.
 * The picture sits in a 96 × 100 frame starting at (12, 12).
 */
const SCENES: Record<string, ReactNode> = {
  mumbai: (
    <>
      <rect className="sky1" x="12" y="12" width="96" height="100" />
      <circle className="m" cx="88" cy="36" r="11" />
      <rect className="g" x="12" y="90" width="96" height="22" />
      <path className="ln-light" d="M18 98 q6 -3 12 0 M50 104 q6 -3 12 0 M82 98 q6 -3 12 0" />
      <rect className="c o2" x="30" y="50" width="56" height="42" />
      <path className="d" d="M50 92 V72 Q58 58 66 72 V92 Z" />
      <path className="d" d="M36 70 Q40 63 44 70 V80 H36 Z M72 70 Q76 63 80 70 V80 H72 Z" />
      <rect className="c o2" x="26" y="46" width="64" height="6" />
      <path className="c o2" d="M30 46 Q34 36 38 46 Z M78 46 Q82 36 86 46 Z M48 46 Q58 30 68 46 Z" />
    </>
  ),
  "san antonio": (
    <>
      <rect className="sky3" x="12" y="12" width="96" height="100" />
      <circle className="t" cx="30" cy="34" r="10" />
      <rect className="m" x="12" y="92" width="96" height="20" />
      <path className="c o2" d="M28 92 V56 H38 Q44 48 48 40 Q58 28 68 40 Q72 48 78 56 H88 V92 Z" />
      <path className="d" d="M52 92 V74 Q58 64 64 74 V92 Z" />
      <path className="d" d="M55 52 Q58 46 61 52 V58 H55 Z" />
      <circle className="d" cx="38" cy="70" r="4" />
      <circle className="d" cx="78" cy="70" r="4" />
      <path className="g o2" d="M98 92 V66 Q98 60 102 60 Q106 60 106 66 V92 Z" />
      <path className="g o2" d="M98 78 H94 Q92 78 92 74 V70" />
    </>
  ),
  dublin: (
    <>
      <rect className="t" x="12" y="12" width="96" height="100" />
      <path
        className="ln-light"
        style={{ opacity: 0.35 }}
        d="M12 24 H108 M12 36 H108 M12 48 H108 M12 60 H108 M12 72 H108 M12 84 H108 M12 96 H108 M30 12 V24 M60 12 V24 M90 12 V24 M20 24 V36 M50 24 V36 M80 24 V36 M30 36 V48 M90 36 V48 M20 48 V60 M100 48 V60 M24 60 V72 M96 60 V72 M20 72 V84 M100 72 V84 M24 84 V96 M96 84 V96"
      />
      <path className="p o2" d="M38 54 A22 22 0 0 1 82 54 Z" />
      <path className="ln2" d="M60 54 V34 M60 54 L46 40 M60 54 L74 40 M60 54 L40 48 M60 54 L80 48" />
      <rect className="g o2" x="38" y="54" width="44" height="46" />
      <path className="ln2" d="M60 54 V100 M42 62 H56 V74 H42 Z M64 62 H78 V74 H64 Z M42 80 H56 V94 H42 Z M64 80 H78 V94 H64 Z" />
      <circle className="m" cx="60" cy="68" r="3" />
      <rect className="c o2" x="30" y="100" width="60" height="6" />
      <rect className="c o2" x="24" y="106" width="72" height="6" />
    </>
  ),
  detroit: (
    <>
      <rect className="sky1" x="12" y="12" width="96" height="100" />
      <circle className="m" cx="60" cy="58" r="16" />
      <path className="d" d="M12 76 V56 H22 V48 H30 V62 H38 V40 H48 V62 H54 V52 H66 V30 H72 V22 H76 V30 H82 V62 H90 V46 H100 V58 H108 V76 Z" />
      <rect className="v" x="12" y="88" width="96" height="24" />
      <path className="ln-light" d="M18 100 H30 M44 100 H56 M70 100 H82 M96 100 H108" />
      <path className="r o2" d="M18 88 V80 Q18 76 24 76 L36 70 Q42 66 52 66 H66 Q74 66 80 72 L96 76 Q104 77 104 84 V88 Z" />
      <path className="p" d="M42 72 Q46 69 52 69 H58 V76 H40 Z M62 69 H66 Q71 69 74 72 L77 76 H62 Z" />
      <path className="r o2" d="M100 76 L106 70 L104 80 Z" />
      <circle className="v" cx="34" cy="88" r="7" />
      <circle className="p" cx="34" cy="88" r="2.5" />
      <circle className="v" cx="86" cy="88" r="7" />
      <circle className="p" cx="86" cy="88" r="2.5" />
    </>
  ),
  kingston: (
    <>
      <rect className="sky3" x="12" y="12" width="96" height="100" />
      <circle className="t" cx="74" cy="38" r="13" />
      <path className="g" style={{ opacity: 0.55 }} d="M12 76 L36 46 L52 62 L72 40 L108 72 V84 H12 Z" />
      <path className="g" d="M12 84 L30 66 L46 78 L62 64 L84 80 L108 70 V90 H12 Z" />
      <rect className="g" x="12" y="88" width="96" height="24" style={{ opacity: 0.8 }} />
      <path className="ln-light" d="M20 98 q6 -3 12 0 M58 104 q6 -3 12 0 M86 96 q6 -3 12 0" />
      <path className="ln" d="M28 112 Q24 90 34 68" style={{ stroke: "var(--art-deep)", strokeWidth: 4 }} />
      <path className="d" d="M34 68 Q22 58 14 66 Q24 62 34 68 Z M34 68 Q30 54 40 50 Q36 58 34 68 Z M34 68 Q46 58 54 66 Q44 62 34 68 Z" />
      <path className="p o2" d="M70 100 H92 L88 106 H74 Z" />
      <path className="ln2" d="M81 100 V88" />
      <path className="p" d="M82 88 L90 98 H82 Z" />
    </>
  ),
  lagos: (
    <>
      <rect className="sky1" x="12" y="12" width="96" height="100" />
      <circle className="m" cx="36" cy="38" r="12" />
      <path className="d" d="M44 80 V54 H52 V44 H58 V54 H64 V36 H72 V58 H78 V48 H88 V62 H94 V54 H102 V80 Z" />
      <rect className="g" x="12" y="80" width="96" height="32" />
      <path className="ln-light" d="M18 104 q6 -3 12 0 M50 108 q6 -3 12 0 M84 104 q6 -3 12 0" />
      <path className="ln" d="M12 86 H108" />
      <path className="ln2" style={{ opacity: 0.9 }} d="M12 96 Q22 86 32 96 Q42 86 52 96 Q62 86 72 96 Q82 86 92 96 Q100 88 108 96" />
      <path className="ln2" style={{ opacity: 0.9 }} d="M22 86 V92 M42 86 V92 M62 86 V92 M82 86 V92 M102 86 V92" />
    </>
  ),
  home: (
    <>
      <rect className="sky2" x="12" y="12" width="96" height="100" />
      <circle className="m" cx="82" cy="36" r="12" />
      <path className="g" style={{ opacity: 0.6 }} d="M12 80 Q40 56 70 74 Q90 62 108 70 V112 H12 Z" />
      <path className="g" d="M12 92 Q44 76 76 90 Q94 84 108 88 V112 H12 Z" />
      <rect className="c o2" x="34" y="66" width="28" height="22" />
      <path className="t o2" d="M30 68 L48 52 L66 68 Z" />
      <rect className="m o2" x="44" y="76" width="8" height="12" />
    </>
  ),
};

const KEYS = Object.keys(SCENES).filter((key) => key !== "home");

/** Which stamp to draw for a place name: a known demo city, or a generic home scene. */
export function sceneFor(place: string | undefined): string {
  const lower = (place ?? "").toLowerCase();
  return KEYS.find((key) => lower.includes(key)) ?? "home";
}

export function PlaceStamp({ place, label, tilt = 0 }: { place?: string; label?: string; tilt?: number }) {
  const clip = useSvgId("stamp");
  const text = (label ?? place?.split(",")[0] ?? "Home").trim();
  const long = text.length > 9;
  return (
    <Art viewBox="0 0 120 150" className="stamp-art">
      <defs>
        <clipPath id={clip}>
          <rect x="12" y="12" width="96" height="100" />
        </clipPath>
      </defs>
      <g transform={tilt ? `rotate(${tilt} 60 75)` : undefined}>
        <rect className="p" x="2" y="2" width="116" height="146" />
        <rect className="perf" x="2" y="2" width="116" height="146" />
        <g clipPath={`url(#${clip})`}>{SCENES[sceneFor(place)]}</g>
        <rect x="12" y="12" width="96" height="100" fill="none" className="o2" />
        <text className="stamp-text" x="60" y="134" textAnchor="middle" fontSize="14" textLength={long ? 92 : undefined} lengthAdjust="spacingAndGlyphs">
          {text}
        </text>
      </g>
    </Art>
  );
}

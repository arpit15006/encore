import type { ReactNode } from "react";
import type { FavoriteKind } from "../api";
import { Art, Heart, Note, Record, Sparkle } from "./parts";

/** Small illustrated icons (64 × 64) that stand in for words: categories, steps and promises. */

function Disc({ children, tone = "sky1" }: { children: ReactNode; tone?: string }) {
  return (
    <>
      <circle className={tone} cx="32" cy="32" r="30" />
      {children}
    </>
  );
}

export function CategoryArt({ kind }: { kind: FavoriteKind }) {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      {kind === "music" && (
        <Disc tone="sky1">
          <g className="spin-on-hover">
            <Record cx={32} cy={32} r={20} label="t" />
          </g>
          <Note x={50} y={22} scale={0.42} tone="g" />
        </Disc>
      )}
      {kind === "film" && (
        <Disc tone="sky2">
          <g className="spin-on-hover">
            <circle className="d o2" cx="32" cy="32" r="20" />
            {[0, 72, 144, 216, 288].map((angle) => (
              <circle key={angle} className="c" cx={32 + 11 * Math.cos((angle * Math.PI) / 180)} cy={32 + 11 * Math.sin((angle * Math.PI) / 180)} r="5" />
            ))}
            <circle className="m" cx="32" cy="32" r="3" />
          </g>
          <path className="ln" d="M46 46 Q54 50 58 44" />
        </Disc>
      )}
      {kind === "tv" && (
        <Disc tone="sky3">
          <path className="ln2" d="M26 16 L20 8 M36 16 L44 8" />
          <rect className="t o2" x="12" y="16" width="40" height="32" rx="7" />
          <rect className="g" x="17" y="21" width="24" height="22" rx="5" />
          <path className="ln-light" d="M20 27 H38 M20 33 H34" />
          <circle className="m" cx="46" cy="26" r="2.5" />
          <circle className="c" cx="46" cy="34" r="2" />
        </Disc>
      )}
      {kind === "star" && (
        <Disc tone="sky1">
          <path className="beam" d="M32 4 L14 56 H50 Z" />
          <path className="m o2" d="M32 16 L36 27 L48 27 L38 34 L42 46 L32 38 L22 46 L26 34 L16 27 L28 27 Z" />
          <Sparkle x={50} y={14} size={4} tone="t" />
        </Disc>
      )}
      {kind === "book" && (
        <Disc tone="sky2">
          <path className="t o2" d="M12 20 Q22 16 32 21 Q42 16 52 20 V48 Q42 44 32 49 Q22 44 12 48 Z" />
          <path className="p" d="M15 21 Q23 18 31 22 V46 Q23 42 15 45 Z M49 21 Q41 18 33 22 V46 Q41 42 49 45 Z" />
          <path className="ln2" d="M18 27 H28 M18 32 H28 M36 27 H46 M36 32 H46" />
          <path className="r" d="M40 18 V30 L43 27 L46 30 V17 Z" />
        </Disc>
      )}
    </Art>
  );
}

/** A stopwatch whose face is a record: plans in seconds. */
export function Stopwatch() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky3">
        <rect className="d" x="28" y="6" width="8" height="6" rx="2" />
        <circle className="p o2" cx="32" cy="36" r="20" />
        <circle className="groove" style={{ stroke: "var(--art-ink)", opacity: 0.15 }} cx="32" cy="36" r="14" />
        <g className="tick-hand">
          <path className="ln" d="M32 36 L32 22" style={{ stroke: "var(--art-terracotta)" }} />
        </g>
        <circle className="t" cx="32" cy="36" r="3" />
      </Disc>
    </Art>
  );
}

/** A price tag: a monthly fee per resident. */
export function PriceTag() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky2">
        <g className="sway">
          <path className="m o2" d="M14 30 L30 14 H48 V32 L32 48 Z" />
          <circle className="p o2" cx="41" cy="21" r="3.5" />
          <Heart x={30} y={33} size={6} tone="t" />
        </g>
      </Disc>
    </Art>
  );
}

/** A keepsake box with a padlock: private by design. */
export function LockedBox() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky2">
        <rect className="t o2" x="12" y="26" width="40" height="24" rx="4" />
        <rect className="m" x="13" y="32" width="38" height="5" />
        <path className="ln" d="M26 26 V20 Q26 13 32 13 Q38 13 38 20 V26" />
        <rect className="m o2" x="25" y="34" width="14" height="12" rx="2" />
        <circle className="i" cx="32" cy="39" r="1.8" />
      </Disc>
    </Art>
  );
}

/** Stamps from several places: their culture, not a stereotype. */
export function GlobeStamps() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky1">
        <circle className="g o2" cx="32" cy="34" r="17" />
        <path className="c" d="M22 26 Q28 22 32 28 Q30 34 24 34 Z M36 38 Q44 34 46 42 Q40 48 36 44 Z" />
        <g transform="rotate(-12 16 16)">
          <rect className="p o2" x="8" y="8" width="16" height="18" />
          <rect className="r" x="11" y="11" width="10" height="9" />
        </g>
        <g transform="rotate(10 48 48)">
          <rect className="p o2" x="40" y="40" width="16" height="18" />
          <rect className="m" x="43" y="43" width="10" height="9" />
        </g>
      </Disc>
    </Art>
  );
}

/** A face for each reaction staff can tap. Simple and warm; never a clinical scale. */
export function ReactionFace({ value }: { value: "lit_up" | "calm" | "none" | "distressed" }) {
  const tone = value === "lit_up" ? "m" : value === "calm" ? "g" : value === "none" ? "c" : "r";
  return (
    <Art viewBox="0 0 64 64" className="icon-art face-art">
      <circle className={`${tone} o2`} cx="32" cy="32" r="24" />
      {value === "lit_up" && (
        <>
          <path className="ln" d="M22 28 Q25 24 28 28 M36 28 Q39 24 42 28" />
          <path className="p o2" d="M22 37 Q32 48 42 37 Z" />
          <Sparkle x={52} y={12} size={6} tone="t" />
          <Sparkle x={10} y={18} size={4} tone="t" />
        </>
      )}
      {value === "calm" && (
        <>
          <path className="ln" d="M22 29 Q25 31 28 29 M36 29 Q39 31 42 29" />
          <path className="ln" d="M24 39 Q32 44 40 39" />
        </>
      )}
      {value === "none" && (
        <>
          <circle className="i" cx="25" cy="29" r="2.5" />
          <circle className="i" cx="39" cy="29" r="2.5" />
          <path className="ln" d="M25 40 H39" />
        </>
      )}
      {value === "distressed" && (
        <>
          <path className="ln" d="M22 27 L28 29 M42 27 L36 29" />
          <path className="ln" d="M24 42 Q32 35 40 42" />
        </>
      )}
    </Art>
  );
}

/** A speech bubble holding a record: ask Encore's agent. */
export function AskArt() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky3">
        <path className="p o2" d="M12 14 H52 Q56 14 56 18 V40 Q56 44 52 44 H30 L20 54 V44 H12 Q8 44 8 40 V18 Q8 14 12 14 Z" />
        <g className="spin-on-hover">
          <Record cx={32} cy={29} r={11} label="t" />
        </g>
      </Disc>
    </Art>
  );
}

/** A winding route with stops: how Encore decided. */
export function RouteArt() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky1">
        <path className="trail" d="M14 48 Q22 30 32 38 Q44 46 48 20" />
        <circle className="g o2" cx="14" cy="48" r="5" />
        <circle className="m o2" cx="32" cy="38" r="4" />
        <path className="t o2" d="M48 8 C55 8 57 15 54 20 L48 28 L42 20 C39 15 41 8 48 8 Z" />
        <circle className="p" cx="48" cy="15" r="2.5" />
      </Disc>
    </Art>
  );
}

/** A window with a shield on the sill: what Qloo sees. */
export function WindowArt() {
  return (
    <Art viewBox="0 0 64 64" className="icon-art">
      <Disc tone="sky2">
        <rect className="p o2" x="14" y="12" width="36" height="32" rx="3" />
        <rect className="sky1" x="18" y="16" width="12" height="11" />
        <rect className="sky1" x="34" y="16" width="12" height="11" />
        <rect className="sky1" x="18" y="29" width="12" height="11" />
        <rect className="sky1" x="34" y="29" width="12" height="11" />
        <path className="g o2" d="M32 34 L44 38 V46 Q44 54 32 58 Q20 54 20 46 V38 Z" />
        <path className="ln" d="M27 46 L31 50 L38 42" style={{ stroke: "var(--art-paper)" }} />
      </Disc>
    </Art>
  );
}

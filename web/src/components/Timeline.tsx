import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { MemorySection, SectionKind } from "../api";

const HEIGHT = 156;
const LABEL_SIZE = 13;
const LANES: Record<SectionKind, { y: number; label: string }> = {
  music: { y: 56, label: "Music" },
  films: { y: 86, label: "Films" },
  tv: { y: 116, label: "TV" },
};

function Marker({ kind, x, y }: { kind: SectionKind; x: number; y: number }) {
  if (kind === "music") return <circle cx={x} cy={y} r={6} />;
  if (kind === "films") return <rect x={x - 5.5} y={y - 5.5} width={11} height={11} />;
  return <rect x={x - 5.5} y={y - 5.5} width={11} height={11} transform={`rotate(45 ${x} ${y})`} />;
}

/** Width of an element, kept current as the layout changes, so the drawing matches real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The person's life as a band of years, with ages 10–30 highlighted and each recommendation placed
 * on the year it came out. It makes Encore's core idea visible: familiar things come from youth.
 * It is drawn at the real on-screen width so its labels stay readable on phones.
 */
export function Timeline({ birthYear, sections }: { birthYear: number; sections: MemorySection[] }) {
  const titleId = useId();
  const descId = useId();
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = Math.max(measured, 300);
  const narrow = width < 560;
  const left = narrow ? 44 : 56;
  const right = 16;

  const items = sections.flatMap((section) => section.items.filter((item) => item.interpretation.year != null));
  const years = items.map((item) => item.interpretation.year!);
  const firstYear = Math.min(birthYear, ...years) - 2;
  const lastYear = Math.max(birthYear + 40, ...years) + 2;
  const x = (year: number) => left + ((year - firstYear) / (lastYear - firstYear)) * (width - left - right);
  const youthStart = birthYear + 10;
  const youthEnd = birthYear + 30;
  const inYouth = items.filter((item) => item.interpretation.band === "in_era").length;
  const step = narrow ? 20 : 10;
  const ticks: number[] = [];
  for (let year = Math.ceil(firstYear / step) * step; year <= lastYear; year += step) ticks.push(year);

  return (
    <figure className="timeline">
      <div ref={ref}>
        {measured > 0 && (
          <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
            <title id={titleId}>Their life, with ages 10 to 30 highlighted</title>
            <desc id={descId}>
              {`Born ${birthYear}. Ages 10 to 30 run from ${youthStart} to ${youthEnd}. ${inYouth} of ${items.length} dated picks come from that window or earlier.`}
            </desc>
            <rect className="youth-band" x={x(youthStart)} y={26} width={x(youthEnd) - x(youthStart)} height={104} rx={8} fill="var(--youth-band)" />
            <text x={(x(youthStart) + x(youthEnd)) / 2} y={18} textAnchor="middle" fontSize={LABEL_SIZE} fill="var(--ink)" fontWeight={700}>
              Ages 10–30
            </text>
            <line x1={left} x2={width - right} y1={136} y2={136} stroke="var(--control-border)" strokeWidth={1.5} />
            {ticks.map((year) => (
              <g key={year}>
                <line x1={x(year)} x2={x(year)} y1={132} y2={140} stroke="var(--ink-muted)" />
                <text x={x(year)} y={154} textAnchor="middle" fontSize={LABEL_SIZE} fill="var(--ink-muted)">
                  {year}
                </text>
              </g>
            ))}
            <line x1={x(birthYear)} x2={x(birthYear)} y1={30} y2={136} stroke="var(--ink-muted)" strokeDasharray="3 4" />
            {(Object.keys(LANES) as SectionKind[]).map((kind) => (
              <text key={kind} x={0} y={LANES[kind].y + 4} fontSize={LABEL_SIZE} fill="var(--ink-muted)">
                {LANES[kind].label}
              </text>
            ))}
            {items.map((item, index) => (
              <g
                key={`${item.kind}-${item.entityId}`}
                className="timeline-marker"
                style={{ "--i": index } as CSSProperties}
                fill={item.interpretation.band === "too_late" ? "var(--caution-border)" : "var(--primary)"}
                opacity={0.85}
              >
                <title>{`${item.name}, ${item.interpretation.year}`}</title>
                <Marker kind={item.kind} x={x(item.interpretation.year!)} y={LANES[item.kind].y} />
              </g>
            ))}
          </svg>
        )}
      </div>
      <figcaption className="timeline-legend">
        <span>Born {birthYear}, shown by the dashed line.</span>
        <span>
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="6" fill="var(--caution-border)" />
          </svg>
          After their youth
        </span>
      </figcaption>
    </figure>
  );
}

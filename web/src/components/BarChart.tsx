import { useId } from "react";

export interface Bar {
  label: string;
  value: number;
  /** Emphasized bars use the accent; the rest use the recessive gray (emphasis form). */
  highlight?: boolean;
  display: string;
}

const ROW = 46;
const LABEL_WIDTH = 230;
const VALUE_GAP = 8;
const WIDTH = 640;

/**
 * Horizontal bars for one measure, one highlighted. Values are direct-labeled (identity never by
 * color alone), each bar has a tooltip, and the page shows the same numbers as a table.
 */
export function HorizontalBars({ bars, max, title, description }: { bars: Bar[]; max: number; title: string; description: string }) {
  const titleId = useId();
  const descId = useId();
  const plot = WIDTH - LABEL_WIDTH - 64;
  const height = bars.length * ROW + 8;
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      <line x1={LABEL_WIDTH} x2={LABEL_WIDTH} y1={0} y2={height - 4} stroke="var(--border)" strokeWidth={1} />
      {bars.map((bar, index) => {
        const y = index * ROW + 10;
        const width = Math.max(2, (bar.value / max) * plot);
        return (
          <g key={bar.label}>
            <title>{`${bar.label}: ${bar.display}`}</title>
            <text x={LABEL_WIDTH - 12} y={y + 17} textAnchor="end" fontSize={15} fill="var(--ink)" fontWeight={bar.highlight ? 700 : 400}>
              {bar.label}
            </text>
            {/* Anchored at the baseline, rounded only at the data end. */}
            <path
              className="chart-bar"
              style={{ animationDelay: `${index * 120}ms` }}
              d={`M${LABEL_WIDTH + 1},${y} h${width - 4} a4,4 0 0 1 4,4 v18 a4,4 0 0 1 -4,4 h${-(width - 4)} z`}
              fill={bar.highlight ? "var(--chart-accent)" : "var(--chart-rest)"}
            />
            <text x={LABEL_WIDTH + width + VALUE_GAP} y={y + 18} fontSize={15} fill="var(--ink)" fontWeight={bar.highlight ? 700 : 400}>
              {bar.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Vertical histogram of counts by bucket, with some buckets emphasized. */
export function Histogram({ buckets, title, description }: { buckets: Array<{ label: string; count: number; highlight?: boolean }>; title: string; description: string }) {
  const titleId = useId();
  const descId = useId();
  const width = 640;
  const height = 240;
  const base = 196;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const slot = (width - 20) / buckets.length;
  const barWidth = slot - 14;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      <line x1={10} x2={width - 10} y1={base} y2={base} stroke="var(--control-border)" strokeWidth={1.5} />
      {buckets.map((bucket, index) => {
        const h = (bucket.count / max) * 150;
        const x = 10 + index * slot + 7;
        const top = base - h;
        return (
          <g key={bucket.label}>
            <title>{`Ages ${bucket.label}: ${bucket.count}`}</title>
            {h > 0 && (
              <path
                className="chart-column"
                style={{ animationDelay: `${index * 90}ms` }}
                d={`M${x},${base} v${-(h - 4)} a4,4 0 0 1 4,-4 h${barWidth - 8} a4,4 0 0 1 4,4 v${h - 4} z`}
                fill={bucket.highlight ? "var(--chart-accent)" : "var(--chart-rest)"}
              />
            )}
            <text x={x + barWidth / 2} y={top - 8} textAnchor="middle" fontSize={15} fill="var(--ink)" fontWeight={bucket.highlight ? 700 : 400}>
              {bucket.count}
            </text>
            <text x={x + barWidth / 2} y={base + 22} textAnchor="middle" fontSize={14} fill="var(--ink-muted)">
              {bucket.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

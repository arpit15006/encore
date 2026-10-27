import { ArrowDownUp, Ban, CalendarRange, ChevronDown, Database, Heart, Route, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { RouteArt } from "../art/icons";
import type { TraceStep } from "../api";

const ICONS: Record<TraceStep["kind"], typeof Route> = {
  window: CalendarRange,
  signals: Heart,
  qloo: Database,
  rerank: ArrowDownUp,
  learned: Heart,
  exclude: Ban,
  caution: TriangleAlert,
};

/** "How Encore decided": each step of the plan in plain words, built by the server as it worked. */
export function DecisionTrace({ steps, defaultOpen = false }: { steps: TraceStep[]; defaultOpen?: boolean }) {
  return (
    <details className="qloo-sees" id="trace" open={defaultOpen}>
      <summary>
        <span className="summary-art">
          <RouteArt />
        </span>
        How Encore decided: {steps.length} steps
        <ChevronDown className="chevron" aria-hidden="true" size={22} />
      </summary>
      <div className="qloo-sees-body">
        <ol className="trace-list">
          {steps.map((step, index) => {
            const Icon = ICONS[step.kind];
            return (
              <li key={index} data-kind={step.kind} style={{ "--i": index } as CSSProperties}>
                <Icon aria-hidden="true" size={20} />
                <span>{step.text}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}

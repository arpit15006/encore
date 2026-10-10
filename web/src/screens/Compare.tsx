import { Bot, Check, Database, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ComparisonColumn, type LoggedRequest } from "../api";
import { Notice } from "../components/Notice";
import { ResidentHeader } from "../components/ResidentHeader";
import { WhatQlooSees } from "../components/WhatQlooSees";
import { useResident } from "../useResident";

const ICONS = { plain_ai: Bot, naive_qloo: Database, encore: Sparkles };

/** What each column can and can't tell you, stated honestly. */
const VERDICT: Record<ComparisonColumn["system"], string> = {
  plain_ai: "Names can sound right, but there is no evidence behind them, no years to check, and it can't learn from reactions.",
  naive_qloo: "Age group and today's location pull the list toward what's popular nearby, away from their own culture and youth.",
  encore: "Built only from their favorites, then ordered so their youth comes first. Every pick shows Qloo's evidence.",
};

function Column({ column }: { column: ComparisonColumn }) {
  const Icon = ICONS[column.system];
  const empty = column.items.length === 0;
  return (
    <section className="compare-col" data-system={column.system} aria-labelledby={`col-${column.system}`}>
      <div className="compare-head">
        <h2 id={`col-${column.system}`}>
          <Icon aria-hidden="true" size={24} style={{ verticalAlign: "-4px", marginRight: 8 }} />
          {column.title}
        </h2>
        <p className="hint">{column.how}</p>
        <p className="compare-score">
          {column.inYouthCount != null ? (
            <>
              <strong>
                {column.inYouthCount} of {column.datedCount}
              </strong>{" "}
              dated picks from their youth
            </>
          ) : (
            "Years not available, so it can't be checked"
          )}
        </p>
      </div>
      {empty ? (
        <Notice tone={column.status === "model_failed" ? "error" : "info"}>
          <p>{column.status === "model_failed" ? "The AI model didn't answer this time." : "Qloo returned nothing for these signals."}</p>
        </Notice>
      ) : (
        <ol className="compare-list">
          {column.items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              {item.inYouth === true && (
                <span className="tag-yes">
                  <Check aria-hidden="true" size={14} /> {item.year}
                </span>
              )}
              {item.inYouth === false && (
                <span className="tag-no">
                  <X aria-hidden="true" size={14} /> {item.year}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="compare-verdict">{VERDICT[column.system]}</p>
    </section>
  );
}

export function CompareScreen({ residentId }: { residentId: string }) {
  const { view, error: viewError } = useResident(residentId);
  const [data, setData] = useState<{ columns: ComparisonColumn[]; whatQlooSaw: LoggedRequest[] }>();
  const [error, setError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api
      .compare(residentId)
      .then(setData)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Something went wrong."));
  }, [residentId]);

  if (viewError || error)
    return (
      <Notice tone="error">
        <p>{viewError ?? error}</p>
      </Notice>
    );
  if (!view || !data)
    return (
      <div className="progress" role="status" aria-live="polite">
        <h1>Comparing three ways to choose</h1>
        <p>
          <Loader2 className="spin" aria-hidden="true" size={22} style={{ verticalAlign: "-5px" }} /> Asking a plain AI model, Qloo used naively, and Encore…
        </p>
      </div>
    );

  return (
    <div className="stack">
      <ResidentHeader view={view} title="Same favorites, three ways to choose" headingRef={headingRef} />
      <p className="lede">
        All three get the same facts: birth year, where they grew up, and the same favorites. A check mark means the artist started out by
        the end of their youth, using Qloo's career years.
      </p>
      <div className="compare-grid">
        {data.columns.map((column) => (
          <Column key={column.system} column={column} />
        ))}
      </div>
      <WhatQlooSees requests={data.whatQlooSaw} favorites={view.favorites} />
    </div>
  );
}

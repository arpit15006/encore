import { useEffect, useState } from "react";
import { api, ApiError, type Evaluation, type EvaluationSystem } from "../api";
import { HorizontalBars, Histogram } from "../components/BarChart";
import { Notice } from "../components/Notice";

const pct = (value: number | null) => (value == null ? "not measurable" : `${Math.round(value * 100)}%`);
const SHORT: Record<EvaluationSystem["id"], string> = {
  plain_ai: "Plain AI model",
  qloo_naive: "Qloo + location & age",
  qloo_raw: "Qloo, no era re-rank",
  encore: "Encore",
};

function SystemsTable({ systems, caption }: { systems: EvaluationSystem[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">System</th>
            <th scope="col">Found a hidden favorite</th>
            <th scope="col">Hidden favorites found</th>
            <th scope="col">Picks from their youth</th>
            <th scope="col">List overlap between people</th>
          </tr>
        </thead>
        <tbody>
          {systems.map((system) => (
            <tr key={system.id} data-highlight={system.id === "encore" ? "true" : undefined}>
              <th scope="row">{system.label}</th>
              <td>{pct(system.hitRate)}</td>
              <td>{pct(system.recall)}</td>
              <td>{pct(system.youthShare)}</td>
              <td>{pct(system.listOverlap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvaluationScreen() {
  const [data, setData] = useState<Evaluation>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api
      .evaluation()
      .then(setData)
      .catch((caught) => setError(caught instanceof ApiError && caught.status === 404 ? "The evaluation results aren't published yet." : "We couldn't load the evaluation."));
  }, []);

  if (error)
    return (
      <div className="stack">
        <h1>How we tested Encore</h1>
        <Notice tone="info">
          <p>{error}</p>
        </Notice>
      </div>
    );
  if (!data) return <p role="status">Loading…</p>;

  const bump = data.reminiscenceBump;
  const youthBuckets = new Set(["10–19", "20–29"]);
  const youthCount = bump.buckets.filter((b) => youthBuckets.has(b.label)).reduce((sum, b) => sum + b.count, 0);
  const best = [...data.systems].sort((a, b) => b.hitRate - a.hitRate)[0];

  return (
    <div className="stack">
      <div>
        <h1>How we tested Encore</h1>
        <p className="lede">
          On real people's lifetime favorites, not on our own guesses. Every guest on BBC Radio's <em>Desert Island Discs</em> picks the
          records they'd keep for life. We gave each system the same three of a guest's artists, plus their birth year and birthplace, and hid
          the rest. Then we checked who found the hidden ones.
        </p>
      </div>

      <section className="form-section" aria-labelledby="eval-hits">
        <h2 id="eval-hits">Who found the hidden favorites?</h2>
        <p className="hint">
          Share of {data.sample.evaluated} people for whom the system's top 20 contained at least one of their hidden artists.
        </p>
        <HorizontalBars
          title="Share of people with at least one hidden favorite found"
          description={data.systems.map((s) => `${SHORT[s.id]}: ${pct(s.hitRate)}`).join(". ")}
          max={1}
          bars={data.systems.map((system) => ({ label: SHORT[system.id], value: system.hitRate, display: pct(system.hitRate), highlight: system.id === "encore" }))}
        />
        {best && best.id !== "encore" && (
          <Notice tone="info">
            <p>
              On this measure, <strong>{SHORT[best.id]}</strong> scored highest. We report that as measured. Encore's other advantages are its
              evidence, its youth window and its ability to learn from reactions; see the other columns below.
            </p>
          </Notice>
        )}
        <SystemsTable systems={data.systems} caption={`All ${data.sample.evaluated} people`} />
        {data.systemsBornAbroad.length > 0 && <SystemsTable systems={data.systemsBornAbroad} caption={`The ${data.sample.bornAbroad} people born outside the UK`} />}
      </section>

      <section className="form-section" aria-labelledby="eval-bump">
        <h2 id="eval-bump">Do lifetime favorites come from youth?</h2>
        <p className="hint">{bump.note}</p>
        <Histogram
          title="Age of each guest when their chosen artists started out"
          description={bump.buckets.map((b) => `Ages ${b.label}: ${b.count}`).join(". ")}
          buckets={bump.buckets.map((bucket) => ({ ...bucket, highlight: youthBuckets.has(bucket.label) }))}
        />
        <p>
          {youthCount} of {bump.total} chosen artists ({Math.round((youthCount / Math.max(1, bump.total)) * 100)}%) started out when the guest was
          10 to 29. That's the window Encore searches first.
        </p>
      </section>

      <section className="form-section" aria-labelledby="eval-method">
        <h2 id="eval-method">Method and limits</h2>
        <ul className="method-list">
          {Object.entries(data.method).map(([key, text]) => (
            <li key={key}>{text}</li>
          ))}
          <li>
            Sample: {data.sample.evaluated} people born {data.sample.birthYears[0]}–{data.sample.birthYears[1]} ({data.sample.bornAbroad} born outside the UK), from{" "}
            {data.sample.eligible} eligible guests. {data.sample.skipped ? `${data.sample.skipped} skipped because fewer than 5 of their artists matched Qloo exactly.` : ""}
          </li>
          <li>These are mostly British public figures, and this measures recommendation accuracy, not outcomes for people with dementia. Encore hasn't been tested with caregivers yet.</li>
        </ul>
        <p className="hint">
          Data: {data.dataset.name}, {data.dataset.license},{" "}
          <a href={data.dataset.url} target="_blank" rel="noreferrer">
            doi:{data.dataset.doi}
          </a>
          . Only aggregate results are published. Names were never sent to Qloo or the AI model.
        </p>
      </section>
    </div>
  );
}

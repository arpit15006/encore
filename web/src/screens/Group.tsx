import { Printer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type GroupPlan } from "../api";
import { Keepsake } from "../art/keepsake";
import { Stage, Turntable } from "../art/scenes";
import { Notice } from "../components/Notice";

const shortLabel = (label: string) => label.replace("Grew up in ", "").replace(", born", " ·");

/** A setlist for a volunteer musician playing for the demo care home: everyone gets songs that are theirs. */
export function GroupScreen() {
  const [plan, setPlan] = useState<GroupPlan>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api
      .groupSession()
      .then(setPlan)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Something went wrong."));
  }, []);

  if (error)
    return (
      <Notice tone="error">
        <p>{error}</p>
      </Notice>
    );
  if (!plan)
    return (
      <div className="progress" role="status" aria-live="polite">
        <div className="progress-art">
          <Turntable />
        </div>
        <h1>Planning the group session</h1>
        <p>Finding songs for each resident…</p>
      </div>
    );

  const label = Object.fromEntries(plan.members.map((member) => [member.id, shortLabel(member.label)]));
  return (
    <div className="stack">
      <div className="page-hero">
        <div>
          <h1>Group session setlist</h1>
          <p className="lede">
            For a volunteer musician playing for the six residents of the demo care home. Encore makes sure every resident gets at least two
            songs from their own youth and culture.
          </p>
          <button className="btn btn-quiet no-print" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={20} /> Print setlist
          </button>
        </div>
        <div className="page-hero-art no-print">
          <Stage />
        </div>
      </div>

      {plan.unmet.length > 0 ? (
        <Notice tone="caution">
          <p>
            Not everyone could get two strong picks: {plan.unmet.map((id) => label[id]).join(", ")}. Consider a one-to-one session for them.
          </p>
        </Notice>
      ) : (
        <Notice tone="info">
          <p>
            <Users aria-hidden="true" size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Every resident has at least two songs that are theirs. These residents share little musical history, so most songs are for one
            person; that's the point of planning it.
          </p>
        </Notice>
      )}

      <ol className="setlist">
        {plan.setlist.map((entry, index) => (
          <li key={entry.entityId}>
            <span className="setlist-sleeve" aria-hidden="true">
              <Keepsake kind="music" seed={entry.entityId} year={entry.year ?? null} />
              <span className="setlist-number">{index + 1}</span>
            </span>
            <div>
              <p className="setlist-song">{entry.song ? `“${entry.song}”` : entry.name}</p>
              <p className="setlist-artist">
                {entry.song ? entry.name : "Any well-known song"}
                {entry.year ? ` · recording since ${entry.year}` : ""}
              </p>
            </div>
            <ul className="setlist-for" aria-label="For">
              {entry.forMembers.map((id) => (
                <li key={id}>{label[id]}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section className="form-section" aria-labelledby="how-group">
        <h2 id="how-group">How Encore chose</h2>
        <p>
          Each resident's picks come from their own favorites, ordered so their youth comes first. Qloo's raw scores can't be compared between
          people, so Encore uses each person's own ranking. It first adds songs that help the residents who have the fewest strong picks,
          until everyone has two, then fills the rest with the songs that suit the most people.
        </p>
        <p className="hint">Songs are the notable songs Qloo lists for each artist. Play them from your own music service.</p>
      </section>
    </div>
  );
}

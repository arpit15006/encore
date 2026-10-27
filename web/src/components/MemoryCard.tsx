import { AlertTriangle, BookOpen, ChevronDown, Database, ExternalLink, Sparkles } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { MemoryItem, ReactionValue } from "../api";
import { ReactionFace } from "../art/icons";
import { Keepsake } from "../art/keepsake";
import { appleMusicSearch, youTubeSearch } from "../listen";

const pct = (share: number) => `${Math.round(share * 100)}%`;
/** Name a single favorite only when Qloo says it clearly drove the pick; otherwise say so plainly. */
const CLEAR_LEAD = 0.4;

function evidenceSentence(item: MemoryItem): string {
  const [first, second] = item.qloo.becauseOf;
  if (!first) return "Qloo matched this to their favorites.";
  if (first.share >= CLEAR_LEAD && (!second || first.share - second.share >= 0.1)) return `People who love ${first.name} often enjoy this.`;
  const count = item.qloo.becauseOf.length;
  if (count === 1) return `People who love ${first.name} often enjoy this.`;
  // No single favorite stands out: say so plainly (the page header already names them).
  const all = count === 2 ? "both" : count === 3 ? "all three" : `all ${count}`;
  return `People who share ${all} of their favorites often enjoy this.`;
}

const REACTIONS: Array<{ value: ReactionValue; label: string }> = [
  { value: "lit_up", label: "Lit up" },
  { value: "calm", label: "Calm" },
  { value: "none", label: "No response" },
  { value: "distressed", label: "Distressed" },
];

/** Sparkles flying out of a button: a small celebration when something lands. */
function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ "--angle": `${i * 36}deg`, "--hue": i % 3 } as CSSProperties} />
      ))}
    </span>
  );
}

/** One-tap reactions for staff mid-session. Big targets; the pressed state is announced. */
function ReactionButtons({ name, onReact }: { name: string; onReact: (value: ReactionValue) => Promise<void> }) {
  const [saving, setSaving] = useState<ReactionValue>();
  const [saved, setSaved] = useState<ReactionValue>();
  const [celebrate, setCelebrate] = useState(0);
  return (
    <div className="reactions" role="group" aria-label={`How did they respond to ${name}?`}>
      {REACTIONS.map(({ value, label }) => (
        <button
          key={value}
          className="reaction"
          data-value={value}
          aria-pressed={saved === value}
          disabled={saving !== undefined}
          onClick={async () => {
            setSaving(value);
            try {
              await onReact(value);
              setSaved(value);
              setCelebrate((count) => count + 1);
            } finally {
              setSaving(undefined);
            }
          }}
        >
          <span className="reaction-face">
            <ReactionFace value={value} />
          </span>
          {label}
          {saved === value && value === "lit_up" && <Burst key={celebrate} />}
          {saved === value && value === "calm" && <span key={celebrate} className="ripple" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

export function MemoryCard({ item, onReact, index = 0 }: { item: MemoryItem; onReact?: (value: ReactionValue) => Promise<void>; index?: number }) {
  const { qloo, interpretation } = item;
  const late = interpretation.band === "too_late";

  return (
    <li className="memory-card" data-band={interpretation.band} data-pinned={item.reaction ? "true" : undefined} style={{ "--i": index % 6 } as CSSProperties}>
      <div className="memory-card-art" data-kind={item.kind}>
        <Keepsake kind={item.kind} seed={item.entityId} year={interpretation.year} />
      </div>
      <div className="memory-card-title">
        {item.reaction && (
          <span className="pinned-badge">
            <Sparkles aria-hidden="true" size={14} /> {item.reaction === "lit_up" ? "Lit up last time" : "Calm last time"}
          </span>
        )}
        <h3>{item.name}</h3>
      </div>

      <div className="panel panel-interp">
        <div className="panel-label">
          {late ? <AlertTriangle aria-hidden="true" size={16} /> : <BookOpen aria-hidden="true" size={16} />}
          {late ? "Encore's reading · less likely familiar" : "Encore's reading"}
        </div>
        <p>{interpretation.note}</p>
      </div>

      <div className="panel panel-evidence">
        <div className="panel-label">
          <Database aria-hidden="true" size={16} />
          From Qloo
        </div>
        <p>{item.reaction ? "Known to land well. Qloo now also uses it as a signal for new picks." : evidenceSentence(item)}</p>
        {qloo.notableSongs && (
          <ul className="songs" aria-label={`Songs Qloo lists for ${item.name}`}>
            {qloo.notableSongs.map((song) => (
              <li key={song}>{song}</li>
            ))}
          </ul>
        )}
        {(qloo.becauseOf.length > 0 || qloo.affinity != null) && (
          <details className="why">
            <summary>
              Why this? <ChevronDown className="chevron" aria-hidden="true" size={16} />
            </summary>
            {qloo.becauseOf.length > 0 && (
              <>
                <p>How much each of their favorites led here, according to Qloo:</p>
                <ul className="because">
                  {qloo.becauseOf.map((because) => (
                    <li key={because.name}>
                      {because.name} {pct(because.share)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {qloo.affinity != null && <p className="why-score">Qloo affinity score: {qloo.affinity.toFixed(2)} (0 to 1)</p>}
          </details>
        )}
      </div>

      {item.kind === "music" && (
        <div className="listen">
          <a href={appleMusicSearch(item.name)} target="_blank" rel="noreferrer">
            Apple Music <ExternalLink aria-hidden="true" size={14} />
            <span className="visually-hidden">(opens in a new tab)</span>
          </a>
          <a href={youTubeSearch(`${item.name} ${qloo.notableSongs?.[0] ?? ""}`.trim())} target="_blank" rel="noreferrer">
            YouTube <ExternalLink aria-hidden="true" size={14} />
            <span className="visually-hidden">(opens in a new tab)</span>
          </a>
        </div>
      )}
      {onReact && <ReactionButtons name={item.name} onReact={onReact} />}
    </li>
  );
}

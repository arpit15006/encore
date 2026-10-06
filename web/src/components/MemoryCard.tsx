import { AlertTriangle, BookOpen, ChevronDown, Database, ExternalLink } from "lucide-react";
import type { MemoryItem } from "../api";
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

export function MemoryCard({ item }: { item: MemoryItem }) {
  const { qloo, interpretation } = item;
  const late = interpretation.band === "too_late";

  return (
    <li className="memory-card" data-band={interpretation.band}>
      <div className="memory-card-title">
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
        <p>{evidenceSentence(item)}</p>
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
    </li>
  );
}

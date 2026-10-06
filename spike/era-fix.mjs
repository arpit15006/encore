// Music-era fix spike: build the artist pool from the person's own favorites only, then
// demote artists whose debut came after the person's youth window (ages 10–30).
import { readFile, writeFile } from "node:fs/promises";
import { debutYear, qlooInsights, stats } from "./lib.mjs";

const GRACE_YEARS = 2; // a debut just after the window can still be a youth memory
const SINGER_DEBUT_AGE = 20;

// MusicBrainz often lists only later reissues for older and non-Western artists
// (e.g. a 2003 "debut" for a singer who died in 1953), so take the earliest credible signal.
function estimateDebut({ year, type, lifeSpanBegin }) {
  const signals = [year];
  if (type === "Group" && lifeSpanBegin) signals.push(lifeSpanBegin);
  if (type === "Person" && lifeSpanBegin) signals.push(lifeSpanBegin + SINGER_DEBUT_AGE);
  const known = signals.filter(Boolean);
  return known.length ? Math.min(...known) : null;
}
const report = JSON.parse(await readFile(new URL("./out/spike-report.json", import.meta.url), "utf8"));
const results = [];

for (const persona of report.personas) {
  const [windowStart, windowEnd] = persona.window;
  const seedIds = persona.resolved.filter((seed) => seed.id).map((seed) => seed.id);
  const seedNames = new Set(persona.resolved.map((seed) => seed.selected?.toLowerCase()));
  // 40 candidates from the person's own favorites only (no location/age signals: they erased culture in the spike).
  const pool = await qlooInsights("artist", seedIds, 40);
  const poolEntities = Array.isArray(pool) ? pool : [];
  const candidates = poolEntities.filter((entity) => !seedIds.includes(entity.entity_id) && !seedNames.has(entity.name.toLowerCase()));

  const scored = [];
  for (const [index, entity] of candidates.entries()) {
    const year = estimateDebut(await debutYear(entity.name));
    const era = year == null ? "unknown" : year <= windowEnd + GRACE_YEARS ? "in_era" : "too_late";
    scored.push({ name: entity.name, qlooRank: index + 1, debut: year, era });
  }
  // Stable re-rank: in-era first, unknown next (labelled lower confidence), too-late last; Qloo order within each band.
  const band = { in_era: 0, unknown: 1, too_late: 2 };
  const reranked = [...scored].sort((a, b) => band[a.era] - band[b.era] || a.qlooRank - b.qlooRank);
  const lateInTop10 = (list) => list.slice(0, 10).filter((item) => item.era === "too_late").length;

  results.push({
    id: persona.id,
    born: persona.born,
    window: persona.window,
    poolStatus: Array.isArray(pool) ? (pool.length ? "ok" : "empty") : pool.status,
    poolSize: candidates.length,
    before: scored.slice(0, 10),
    after: reranked.slice(0, 10),
    tooLateInTop10: { before: lateInTop10(scored), after: lateInTop10(reranked) },
    unknownDebut: scored.filter((item) => item.era === "unknown").map((item) => item.name),
  });
}

await writeFile(new URL("./out/era-fix-report.json", import.meta.url), JSON.stringify(results, null, 1));
for (const r of results) {
  const show = (list) => list.map((i) => `${i.name} (${i.debut ?? "?"})${i.era === "too_late" ? " ✗" : ""}`).join(", ");
  console.log(`\n${r.id} born ${r.born}, window ${r.window.join("–")} | pool ${r.poolStatus} n=${r.poolSize} | too-late in top 10: ${r.tooLateInTop10.before} → ${r.tooLateInTop10.after}`);
  console.log(`  before: ${show(r.before)}`);
  console.log(`  after:  ${show(r.after)}`);
  if (r.unknownDebut.length) console.log(`  unknown debut: ${r.unknownDebut.join(", ")}`);
}
console.log(`\nNew Qloo calls: ${stats.qlooCalls}, MusicBrainz calls: ${stats.musicBrainzCalls}`);

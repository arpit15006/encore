// Evaluation on real people's documented favorites (Desert Island Discs; see eval/prepare_sample.py).
//
// Each person chose up to 8 records for life. We give every system the same intake (birth year,
// place of birth, 3 of their chosen artists) and hide the rest. A system scores when its top 20
// contains a hidden artist. Names are never sent to Qloo or the model.
//
// Writes eval/results.json (aggregates only; the dataset's license forbids republishing it) and
// eval/out/details.json (gitignored, per-person, for debugging).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cached, qlooExec, qlooInsights, stats } from "../spike/lib.mjs";

const TOP = 20;
const SEEDS = 3;
const MIN_RESOLVED = 4; // 3 given + at least 1 hidden
const MAX_LOOKUPS = 8;
const GROQ_MODEL = "openai/gpt-oss-120b";

const norm = (name) =>
  String(name)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const year = (value) => {
  const y = Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(y) && y > 1800 ? y : null;
};
const debut = (properties = {}) => year(properties.start_year) ?? (year(properties.date_of_birth) && properties.is_group !== true ? year(properties.date_of_birth) + 20 : null);
const band = (debutYear, born) => (debutYear == null ? "unknown" : debutYear <= born + 32 ? "in_era" : "too_late");
const ORDER = { in_era: 0, unknown: 1, too_late: 2 };

async function groq(prompt) {
  return cached("groq-eval", { model: GROQ_MODEL, prompt }, async () => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: GROQ_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    });
    const body = await response.json();
    return JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  });
}

function jaccard(a, b) {
  const A = new Set(a.map(norm));
  const B = new Set(b.map(norm));
  const shared = [...A].filter((x) => B.has(x)).length;
  return A.size + B.size ? shared / (A.size + B.size - shared) : 0;
}
const meanPairwise = (lists) => {
  const scores = [];
  for (let i = 0; i < lists.length; i++) for (let j = i + 1; j < lists.length; j++) scores.push(jaccard(lists[i], lists[j]));
  return scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
};
const round = (x, digits = 3) => (x == null ? null : Math.round(x * 10 ** digits) / 10 ** digits);

const sample = JSON.parse(await readFile(new URL("../data/eval-sample.json", import.meta.url), "utf8"));
const details = [];
const bumpAges = [];

for (const person of sample.people) {
  // 1. Resolve their chosen artists to Qloo, exact matches only.
  const resolved = [];
  for (const artist of person.artists.slice(0, MAX_LOOKUPS)) {
    if (resolved.length >= 7) break;
    const result = await qlooExec("describe", { entity: artist, type: "artist" });
    const outcome = result.resolution?.outcomes?.[0];
    if (result.status === "ok" && outcome?.status === "resolved" && outcome.match === "exact") {
      resolved.push({ name: outcome.selected.name, id: outcome.selected.id });
    }
  }
  if (resolved.length < MIN_RESOLVED) {
    details.push({ id: person.id, skipped: `only ${resolved.length} artists resolved` });
    continue;
  }
  const seeds = resolved.slice(0, SEEDS);
  const hidden = resolved.slice(SEEDS);
  const hiddenIds = new Set(hidden.map((h) => h.id));
  const hiddenNames = new Set(hidden.map((h) => norm(h.name)));
  const place = [person.place, person.country].filter(Boolean).join(", ");
  const seedIds = seeds.map((s) => s.id);
  const notSeed = (entity) => !seedIds.includes(entity.entity_id) && !seeds.some((s) => norm(s.name) === norm(entity.name));

  // 2. Systems, all with the same intake.
  const pool = await qlooInsights("artist", seedIds, 40, {});
  const poolList = (Array.isArray(pool) ? pool : []).filter(notSeed);
  const raw = poolList.slice(0, TOP);
  const encore = poolList
    .map((entity, index) => ({ entity, index, band: band(debut(entity.properties), person.born) }))
    .sort((a, b) => ORDER[a.band] - ORDER[b.band] || a.index - b.index)
    .map((x) => x.entity)
    .slice(0, TOP);
  const naiveResult = await qlooExec("recommend", { target_type: "artist", signals: seedIds, demographic: "seniors", signal_location: place || person.country, limit: TOP });
  const naiveTop = (naiveResult.results ?? []).filter(notSeed).slice(0, TOP);
  // The recommend workflow returns no career data; fetch it for exactly these entities.
  const naiveDetails = naiveTop.length ? await qlooInsights("artist", seedIds, naiveTop.length, { "filter.entities": naiveTop.map((e) => e.entity_id).join(",") }) : [];
  const naive = naiveTop.map((entity) => ({ ...entity, properties: (Array.isArray(naiveDetails) ? naiveDetails : []).find((d) => d.entity_id === entity.entity_id)?.properties ?? entity.properties }));
  const plainAnswer = await groq(
    `A family member describes an older relative so care staff can plan familiar music.
Born ${person.born}. Grew up in ${place || person.country}. Favorites: ${seeds.map((s) => s.name).join(", ")}.
List the ${TOP} singers or bands this person is most likely to recognize and love from their youth. Don't repeat the favorites.
Respond only with JSON: {"artists": ["name", ...]}`,
  );
  const plain = (plainAnswer.artists ?? []).filter((n) => typeof n === "string").slice(0, TOP);

  const score = (names, ids = []) => {
    const found = new Set();
    names.forEach((name, i) => {
      if (hiddenNames.has(norm(name))) found.add(norm(name));
      if (ids[i] && hiddenIds.has(ids[i])) found.add(norm(hidden.find((h) => h.id === ids[i]).name));
    });
    return { hits: found.size, any: found.size > 0, recall: found.size / hidden.length };
  };
  const youthShare = (entities) => {
    const dated = entities.map((e) => band(debut(e.properties), person.born)).filter((b) => b !== "unknown");
    return dated.length ? dated.filter((b) => b === "in_era").length / dated.length : null;
  };

  // Reminiscence bump: the person's own chosen artists with Qloo's career start years, fetched in
  // one Insights call restricted to those entities (filter.entities).
  const chosen = await qlooInsights("artist", seedIds, resolved.length, { "filter.entities": resolved.map((r) => r.id).join(",") });
  for (const entity of Array.isArray(chosen) ? chosen : []) {
    const d = debut(entity.properties);
    if (d) bumpAges.push(d - person.born);
  }

  details.push({
    id: person.id,
    born: person.born,
    abroad: !["United Kingdom", "United Kingdom of Great Britain and Ireland"].includes(person.country),
    hidden: hidden.length,
    systems: {
      plain_ai: { ...score(plain), list: plain, youth: null },
      qloo_raw: { ...score(raw.map((e) => e.name), raw.map((e) => e.entity_id)), list: raw.map((e) => e.name), youth: youthShare(raw) },
      qloo_naive: { ...score(naive.map((e) => e.name), naive.map((e) => e.entity_id)), list: naive.map((e) => e.name), youth: youthShare(naive) },
      encore: { ...score(encore.map((e) => e.name), encore.map((e) => e.entity_id)), list: encore.map((e) => e.name), youth: youthShare(encore) },
    },
  });
  process.stdout.write(".");
}

const people = details.filter((d) => d.systems);
const LABELS = {
  plain_ai: "Plain AI model (same intake, no Qloo)",
  qloo_naive: "Qloo with location and age signals",
  qloo_raw: "Qloo, favorites only, no era re-rank",
  encore: "Encore (favorites only + era re-rank)",
};
const summarize = (group) =>
  Object.keys(LABELS).map((id) => {
    const runs = group.map((p) => p.systems[id]);
    const youth = runs.map((r) => r.youth).filter((x) => x != null);
    return {
      id,
      label: LABELS[id],
      hitRate: round(runs.filter((r) => r.any).length / runs.length),
      recall: round(runs.reduce((s, r) => s + r.recall, 0) / runs.length),
      youthShare: youth.length ? round(youth.reduce((s, x) => s + x, 0) / youth.length) : null,
      listOverlap: round(meanPairwise(runs.map((r) => r.list))),
    };
  });

const buckets = [
  ["before birth", (a) => a < 0],
  ["0–9", (a) => a >= 0 && a < 10],
  ["10–19", (a) => a >= 10 && a < 20],
  ["20–29", (a) => a >= 20 && a < 30],
  ["30–39", (a) => a >= 30 && a < 40],
  ["40+", (a) => a >= 40],
];
const results = {
  generatedAt: new Date().toISOString(),
  dataset: {
    name: "Desert Island Disks (Finnegan, Rangel Smith & Van Stroud, 2021), built on Gustar (2020) and Morgan (2018)",
    license: "CC BY-NC-SA 4.0",
    doi: "10.17613/2gg4-hw68",
    url: "https://doi.org/10.17613/2gg4-hw68",
  },
  method: {
    intake: "Birth year, place of birth and 3 of the person's own chosen artists. Names withheld from every system.",
    hidden: "The person's other chosen artists that resolve exactly in Qloo (1–4 per person).",
    metric: `A hit is a hidden artist in the system's top ${TOP}. Hit rate = share of people with at least one hit; recall = share of hidden artists found.`,
    youth: "Share of dated picks whose career started by the end of the person's youth (+2 years), using Qloo's start_year. Not available for the plain model, which gives no evidence.",
    overlap: "Average list overlap between people (Jaccard). Lower means more personal lists.",
  },
  sample: {
    eligible: sample.eligible,
    evaluated: people.length,
    skipped: details.length - people.length,
    bornAbroad: people.filter((p) => p.abroad).length,
    birthYears: [Math.min(...people.map((p) => p.born)), Math.max(...people.map((p) => p.born))],
  },
  systems: summarize(people),
  systemsBornAbroad: summarize(people.filter((p) => p.abroad)),
  reminiscenceBump: {
    note: "Age of each person when the artists they chose for life started their careers (Qloo start_year). This is artist debut, not song release, so it is a rough proxy.",
    total: bumpAges.length,
    buckets: buckets.map(([label, test]) => ({ label, count: bumpAges.filter(test).length })),
  },
  qlooCallsThisRun: stats.qlooCalls,
};

await mkdir(new URL("./out/", import.meta.url), { recursive: true });
await writeFile(new URL("./out/details.json", import.meta.url), JSON.stringify(details, null, 1));
await writeFile(new URL("./results.json", import.meta.url), JSON.stringify(results, null, 1));
console.log(`\nEvaluated ${people.length} people (${results.sample.skipped} skipped). New Qloo calls: ${stats.qlooCalls}`);
console.table(results.systems);
console.log(results.reminiscenceBump.buckets);

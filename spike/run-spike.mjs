// Day-one feasibility spike. Fictional personas only; Qloo sees entity IDs,
// an age description, and a city. Every Qloo/Groq response is cached in spike/out/cache
// (gitignored) so re-runs cost no quota.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const CACHE_DIR = new URL("./out/cache/", import.meta.url);
const OUT_DIR = new URL("./out/", import.meta.url);
const GROQ_MODEL = "openai/gpt-oss-120b";
const AGE = "seniors"; // harness maps this to Qloo's 55_and_older bracket
let qlooCalls = 0;

const PERSONAS = [
  { id: "P1", born: 1942, hometown: "Memphis, Tennessee", seeds: [["Patsy Cline", "artist"], ["Jim Reeves", "artist"], ["The Sound of Music", "movie"]] },
  { id: "P2", born: 1945, hometown: "Detroit, Michigan", seeds: [["The Supremes", "artist"], ["Marvin Gaye", "artist"], ["In the Heat of the Night", "movie"]] },
  { id: "P3", born: 1940, hometown: "Mumbai, India", seeds: [["Lata Mangeshkar", "artist"], ["Mohammed Rafi", "artist"], ["Mughal-e-Azam", "movie"]] },
  { id: "P4", born: 1948, hometown: "San Antonio, Texas", seeds: [["Vicente Fernández", "artist"], ["Javier Solís", "artist"], ["Bonanza", "tv_show"]] },
  { id: "P5", born: 1938, hometown: "Dublin, Ireland", seeds: [["The Clancy Brothers", "artist"], ["Bing Crosby", "artist"], ["The Quiet Man", "movie"]] },
];

const redact = (text) => (process.env.QLOO_API_KEY ? text.split(process.env.QLOO_API_KEY).join("<REDACTED>") : text);

async function cached(kind, request, fetcher) {
  const key = createHash("sha256").update(JSON.stringify([kind, request])).digest("hex").slice(0, 16);
  const file = new URL(`${kind}-${key}.json`, CACHE_DIR);
  try {
    return JSON.parse(await readFile(file, "utf8")).response;
  } catch {
    const response = await fetcher();
    await writeFile(file, JSON.stringify({ kind, request, response }, null, 1));
    return response;
  }
}

async function qlooExec(operation, input) {
  return cached(`exec-${operation}`, input, async () => {
    qlooCalls++;
    try {
      const { stdout } = await run("qloo", ["exec", operation, "--input", JSON.stringify(input)], { env: process.env, maxBuffer: 1 << 26 });
      return JSON.parse(redact(stdout));
    } catch (error) {
      const text = redact(String(error.stdout || error.message));
      try { return JSON.parse(text); } catch { return { status: "error", summary: text.slice(0, 500) }; }
    }
  });
}

async function qlooInsights(type, signalIds, params) {
  return cached("api-insights", { type, signalIds, params }, async () => {
    qlooCalls++;
    const args = ["api", "insights", "-t", type, "-s", signalIds.join(","), "-n", "15", "--params", JSON.stringify(params), "--json"];
    try {
      const { stdout } = await run("qloo", args, { env: process.env, maxBuffer: 1 << 26 });
      return JSON.parse(redact(stdout));
    } catch (error) {
      return { status: "error", summary: redact(String(error.stdout || error.message)).slice(0, 500) };
    }
  });
}

async function groq(prompt) {
  return cached("groq", { model: GROQ_MODEL, prompt }, async () => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const body = await response.json();
    return JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  });
}

const names = (result) => (result?.results ?? []).map((entity) => entity.name);
const norm = (name) => name.toLowerCase().replace(/^the\s+/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function jaccard(a, b) {
  const setA = new Set(a.map(norm));
  const setB = new Set(b.map(norm));
  const shared = [...setA].filter((x) => setB.has(x)).length;
  return setA.size + setB.size === 0 ? 0 : shared / (setA.size + setB.size - shared);
}
function meanPairwise(lists) {
  const scores = [];
  for (let i = 0; i < lists.length; i++) for (let j = i + 1; j < lists.length; j++) scores.push(jaccard(lists[i], lists[j]));
  return scores.reduce((sum, x) => sum + x, 0) / scores.length;
}
const releaseYear = (entity) => Number(entity?.properties?.release_year ?? String(entity?.properties?.release_date ?? "").slice(0, 4)) || null;

await mkdir(CACHE_DIR, { recursive: true });
const report = { personas: [], checks: {} };

for (const persona of PERSONAS) {
  const window = [persona.born + 10, persona.born + 30];
  const resolved = [];
  for (const [entity, type] of persona.seeds) {
    const result = await qlooExec("describe", { entity, type });
    const outcome = result.resolution?.outcomes?.[0];
    resolved.push({
      input: entity,
      type,
      status: result.status,
      match: outcome?.match ?? null,
      id: outcome?.status === "resolved" && outcome?.match === "exact" ? outcome.selected.id : null,
      selected: outcome?.selected?.name ?? null,
      alternatives: (outcome?.alternatives ?? []).map((alt) => alt.name).slice(0, 3),
    });
  }
  const ids = resolved.filter((seed) => seed.id).map((seed) => seed.id);
  const seedNames = persona.seeds.map(([name]) => norm(name));
  const withoutSeeds = (list) => list.filter((name) => !seedNames.includes(norm(name)));

  const base = { signals: ids, demographic: AGE, limit: 15 };
  const artists = ids.length ? await qlooExec("recommend", { ...base, target_type: "artist", signal_location: persona.hometown }) : null;
  const movies = ids.length ? await qlooExec("recommend", { ...base, target_type: "movie", signal_location: persona.hometown }) : null;
  const windowed = ids.length
    ? await qlooInsights("movie", ids, {
        "filter.release_year.min": window[0],
        "filter.release_year.max": window[1],
        "signal.demographics.age": "55_and_older",
        "feature.explainability": true,
      })
    : null;
  const windowedList = Array.isArray(windowed) ? windowed : windowed?.results?.entities ?? windowed?.results ?? [];
  const windowedYears = (Array.isArray(windowedList) ? windowedList : []).map((e) => ({ name: e.name, year: releaseYear(e) }));
  const unfilteredYears = (movies?.results ?? []).map((e) => ({ name: e.name, year: releaseYear(e) }));

  const baseline = await groq(
    `A family member is describing an older relative so care staff can plan familiar activities. ` +
      `Born ${persona.born}. Grew up in ${persona.hometown}. Favorites: ${persona.seeds.map(([n, t]) => `${n} (${t.replace("_", " ")})`).join(", ")}. ` +
      `List the 15 music artists and the 15 films this person is most likely to recognize and love from their youth. ` +
      `Do not repeat the favorites. Respond only with JSON: {"artists": ["name", ...], "movies": [{"title": "...", "year": 1960}, ...]}`,
  );

  report.personas.push({
    id: persona.id,
    born: persona.born,
    hometown: persona.hometown,
    window,
    resolved,
    qloo: {
      artistsStatus: artists?.status,
      artistsSummary: artists?.summary,
      artists: withoutSeeds(names(artists)),
      moviesStatus: movies?.status,
      movies: unfilteredYears,
      windowedStatus: Array.isArray(windowed) ? (windowed.length ? "ok" : "empty") : windowed?.status ?? "unknown",
      windowedMovies: windowedYears,
    },
    llm: { artists: withoutSeeds(baseline.artists ?? []), movies: baseline.movies ?? [] },
  });
}

// Check 3: same persona, Memphis vs Detroit hometown (and no location), artists only.
const p1Ids = report.personas[0].resolved.filter((seed) => seed.id).map((seed) => seed.id);
const asDetroit = await qlooExec("recommend", { signals: p1Ids, demographic: AGE, limit: 15, target_type: "artist", signal_location: "Detroit, Michigan" });
const noLocation = await qlooExec("recommend", { signals: p1Ids, demographic: AGE, limit: 15, target_type: "artist" });
const memphisList = report.personas[0].qloo.artists;
report.checks.hometown = {
  memphis: memphisList,
  detroit: names(asDetroit),
  noLocation: names(noLocation),
  jaccardMemphisDetroit: jaccard(memphisList, names(asDetroit)),
  jaccardMemphisNoLocation: jaccard(memphisList, names(noLocation)),
};

// Check 4: regional signal.
report.checks.wherePopular = {
  patsyUS: await qlooExec("where_popular", { entity: "Patsy Cline", entity_type: "artist", within: "United States", limit: 10 }),
  lataUS: await qlooExec("where_popular", { entity: "Lata Mangeshkar", entity_type: "artist", within: "United States", limit: 10 }),
};

// Check 5: age skew, classic vs modern.
report.checks.demographics = {};
for (const artist of ["Patsy Cline", "The Supremes", "Frank Sinatra", "Taylor Swift", "Bad Bunny", "Billie Eilish"]) {
  report.checks.demographics[artist] = await qlooExec("audience_demographics", { entity: artist, entity_type: "artist" });
}

// Check 6: distinctness across personas, and agreement between systems.
const qlooArtistLists = report.personas.map((p) => p.qloo.artists);
const llmArtistLists = report.personas.map((p) => p.llm.artists);
report.checks.comparison = {
  meanPairwiseOverlapArtists: { qloo: meanPairwise(qlooArtistLists), llm: meanPairwise(llmArtistLists) },
  qlooVsLlmOverlapPerPersona: report.personas.map((p) => ({ id: p.id, artists: jaccard(p.qloo.artists, p.llm.artists) })),
};
report.qlooCallsThisRun = qlooCalls;

await writeFile(new URL("spike-report.json", OUT_DIR), JSON.stringify(report, null, 1));
console.log(`Done. New Qloo calls this run: ${qlooCalls}. Report: spike/out/spike-report.json`);

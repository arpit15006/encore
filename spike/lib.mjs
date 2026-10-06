// Shared spike helpers: cached Qloo harness calls and cached MusicBrainz lookups.
// Every response is cached in spike/out/cache (gitignored), so re-runs cost no quota.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const CACHE_DIR = new URL("./out/cache/", import.meta.url);
export const stats = { qlooCalls: 0, musicBrainzCalls: 0 };

const redact = (text) => (process.env.QLOO_API_KEY ? text.split(process.env.QLOO_API_KEY).join("<REDACTED>") : text);

export async function cached(kind, request, fetcher) {
  await mkdir(CACHE_DIR, { recursive: true });
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

export async function qlooExec(operation, input) {
  return cached(`exec-${operation}`, input, async () => {
    stats.qlooCalls++;
    try {
      const { stdout } = await run("qloo", ["exec", operation, "--input", JSON.stringify(input)], { env: process.env, maxBuffer: 1 << 26 });
      return JSON.parse(redact(stdout));
    } catch (error) {
      const text = redact(String(error.stdout || error.message));
      try { return JSON.parse(text); } catch { return { status: "error", summary: text.slice(0, 500) }; }
    }
  });
}

// MusicBrainz asks for at most 1 request per second and a descriptive User-Agent.
const MB_USER_AGENT = "EncoreHackathonSpike/0.1 (taste-grounded activity planning research)";
let lastMusicBrainzCall = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function musicBrainz(path, attempt = 1) {
  const wait = lastMusicBrainzCall + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastMusicBrainzCall = Date.now();
  stats.musicBrainzCalls++;
  const response = await fetch(`https://musicbrainz.org/ws/2/${path}`, { headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" } });
  // 503 means "slow down": back off and retry a bounded number of times.
  if (response.status === 503 && attempt < 5) {
    await sleep(2000 * attempt);
    return musicBrainz(path, attempt + 1);
  }
  // Throw instead of returning, so a failed request is never cached as "no match".
  if (!response.ok) throw new Error(`MusicBrainz ${response.status} for ${path}`);
  return response.json();
}

const normalizeName = (name) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Earliest year of an original album or single by the artist, or null if MusicBrainz can't tell us. */
export async function debutYear(artistName) {
  return cached("mb-debut-v2", artistName, async () => {
    const wanted = normalizeName(artistName);
    const search = await musicBrainz(`artist?query=${encodeURIComponent(wanted)}&fmt=json&limit=5`);
    const names = (artist) => [artist.name, ...(artist.aliases ?? []).map((alias) => alias.name)].map(normalizeName);
    const match = (search.artists ?? []).find((artist) => artist.score >= 90 && names(artist).includes(wanted));
    if (!match) return { year: null, reason: "no confident MusicBrainz match" };
    const groups = await musicBrainz(`release-group?artist=${match.id}&type=album|single&fmt=json&limit=100`);
    const years = (groups["release-groups"] ?? [])
      .filter((group) => !(group["secondary-types"] ?? []).length)
      .map((group) => Number(String(group["first-release-date"] ?? "").slice(0, 4)))
      .filter((year) => year > 1900);
    const lifeSpanBegin = Number(String(match["life-span"]?.begin ?? "").slice(0, 4)) || null;
    const year = years.length ? Math.min(...years) : null;
    return { year, mbid: match.id, type: match.type, lifeSpanBegin, releaseGroupsSeen: years.length };
  });
}

/** Raw Insights through the harness (`qloo api insights --params`), for parameters and page sizes the workflows don't expose. */
export async function qlooInsights(type, signalIds, take, params = {}) {
  return cached("api-insights", { type, signalIds, take, params }, async () => {
    stats.qlooCalls++;
    const args = ["api", "insights", "-t", type, "-s", signalIds.join(","), "-n", String(take), "--params", JSON.stringify(params), "--json"];
    try {
      const { stdout } = await run("qloo", args, { env: process.env, maxBuffer: 1 << 26 });
      return JSON.parse(redact(stdout));
    } catch (error) {
      return { status: "error", summary: redact(String(error.stdout || error.message)).slice(0, 500) };
    }
  });
}

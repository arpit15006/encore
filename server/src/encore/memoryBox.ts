import type { QlooClient, QlooEntity } from "../qloo/client.js";
import type { QlooStatus } from "../qloo/envelope.js";
import { artistDebutYear, eraBand, rankByEra, youthWindow, type EraBand, type YouthWindow } from "./era.js";
import type { FavoriteKind } from "./intake.js";
import type { Reaction, ReactionValue } from "../store/appStore.js";

export interface Favorite {
  entityId: string;
  name: string;
  kind: FavoriteKind;
}

export interface Person {
  birthYear: number;
  favorites: Favorite[];
  /** Learned from reactions: picks that landed well are pinned first and used as extra signals. */
  pinned?: Reaction[];
  /** Never shown again: items that caused distress, plus tags staff chose to exclude. */
  exclude?: { entityIds: string[]; tagIds: string[] };
}

/** One step of "How Encore decided", in plain words. */
export interface TraceStep {
  kind: "window" | "signals" | "qloo" | "rerank" | "learned" | "exclude" | "caution";
  text: string;
}

export type SectionKind = "music" | "films" | "tv";

export interface MemoryItem {
  entityId: string;
  name: string;
  kind: SectionKind;
  /** Set on pinned items: the latest reaction staff recorded. */
  reaction?: ReactionValue;
  /** What Qloo returned, shown as evidence. */
  qloo: {
    affinity: number | null;
    popularity: number | null;
    /** Which of the person's favorites drove this result, from Qloo's explainability (shares sum to ~1). */
    becauseOf: Array<{ name: string; share: number }>;
    notableSongs?: string[];
  };
  /** Encore's reading of that evidence, shown separately. */
  interpretation: {
    year: number | null;
    ageThen: number | null;
    band: EraBand;
    note: string;
  };
}

export interface MemorySection {
  kind: SectionKind;
  status: QlooStatus;
  /**
   * "direct" when the person has favorites of this kind; "inferred" when the section comes only from
   * other kinds (e.g. TV picked from music and films), which the UI labels lower confidence.
   */
  basis: "direct" | "inferred";
  summary?: string;
  items: MemoryItem[];
}

export interface MemoryBox {
  window: YouthWindow;
  sections: MemorySection[];
  trace: TraceStep[];
}

const SECTION_SIZE = 12;
/** Before this age, an artist's start date says "already established", not "met them then". */
const TEEN_AGE = 13;
const DIRECT_KINDS: Record<SectionKind, FavoriteKind[]> = { music: ["music"], films: ["film", "star"], tv: ["tv", "star"] };
const ARTIST_POOL = 40;
const SCREEN_POOL = 20;
/** Qloo signals per request; family favorites come first, then what reactions taught us. */
const MAX_SIGNALS = 10;
const SECTION_NOUN: Record<SectionKind, string> = { music: "singers and bands", films: "films", tv: "TV shows" };
/** Picks from after their youth are filler, so they only appear when the section would be thin. */
const THIN_SECTION = 6;
const MAX_LATE = 3;

/** In-era and undated picks first; too-late picks only to fill a thin section, and only a few. */
export function limitLate(ranked: MemoryItem[]): MemoryItem[] {
  const familiar = ranked.filter((item) => item.interpretation.band !== "too_late");
  if (familiar.length >= THIN_SECTION) return familiar;
  return [...familiar, ...ranked.filter((item) => item.interpretation.band === "too_late").slice(0, MAX_LATE)];
}

const normalizeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Qloo can return a favorite back under another spelling ("Mohd Rafi" for "Mohammed Rafi"). */
function isFavorite(entity: QlooEntity, favorites: Favorite[]): boolean {
  if (favorites.some((favorite) => favorite.entityId === entity.entity_id)) return true;
  const favoriteNames = new Set(favorites.map((favorite) => normalizeName(favorite.name)));
  const properties = entity.properties ?? {};
  const otherNames = [...asStrings(properties.akas), ...asStrings(properties.aliases)];
  return [entity.name, ...otherNames].some((name) => favoriteNames.has(normalizeName(name)));
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? [item] : typeof item?.value === "string" ? [item.value] : []));
}

function becauseOf(entity: QlooEntity, favorites: Favorite[]): Array<{ name: string; share: number }> {
  const contributions = entity.query?.explainability?.["signal.interests.entities"] ?? [];
  const total = contributions.reduce((sum, item) => sum + item.score, 0) || 1;
  return contributions
    .map((item) => ({
      name: favorites.find((favorite) => favorite.entityId === item.entity_id)?.name ?? "",
      share: Math.round((item.score / total) * 100) / 100,
    }))
    .filter((item) => item.name)
    .sort((a, b) => b.share - a.share);
}

function screenYear(entity: QlooEntity): number | null {
  const year = Number(entity.properties?.release_year);
  return Number.isInteger(year) && year > 1800 ? year : null;
}

function note(kind: SectionKind, year: number | null, ageThen: number | null, band: EraBand): string {
  if (year == null || ageThen == null) return "Qloo has no date for this one, so we can't place it in their youth.";
  if (kind === "music" && ageThen < TEEN_AGE) return `Recording since ${year}, so already established by their teenage years.`;
  const when = `in ${year}, when they were about ${ageThen}`;
  const lead = kind === "music" ? `Started recording ${when}.` : kind === "tv" ? `First aired ${when}.` : `Came out ${when}.`;
  return band === "too_late" ? `${lead} That's after their youth, so it's less likely to feel familiar.` : lead;
}

function toItem(entity: QlooEntity, kind: SectionKind, person: Person, window: YouthWindow): MemoryItem {
  const properties = entity.properties ?? {};
  const year = kind === "music" ? artistDebutYear(properties) : screenYear(entity);
  const band = eraBand(year, window);
  const ageThen = year == null ? null : year - person.birthYear;
  const songs = asStrings(properties.notable_songs).slice(0, 3);
  return {
    entityId: entity.entity_id,
    name: entity.name,
    kind,
    qloo: {
      affinity: entity.query?.affinity ?? null,
      popularity: entity.popularity ?? null,
      becauseOf: becauseOf(entity, person.favorites),
      ...(songs.length ? { notableSongs: songs } : {}),
    },
    interpretation: { year, ageThen, band, note: note(kind, year, ageThen, band) },
  };
}

function pinnedItem(reaction: Reaction, person: Person, window: YouthWindow): MemoryItem {
  const { year } = reaction.item;
  const band = eraBand(year, window);
  const ageThen = year == null ? null : year - person.birthYear;
  return {
    entityId: reaction.entityId,
    name: reaction.item.name,
    kind: reaction.item.kind,
    reaction: reaction.value,
    qloo: { affinity: null, popularity: null, becauseOf: [], ...(reaction.item.notableSongs ? { notableSongs: reaction.item.notableSongs } : {}) },
    interpretation: {
      year,
      ageThen,
      band,
      note: reaction.value === "lit_up" ? "This lit them up last time. Encore keeps known hits first." : "They were calm and content with this last time.",
    },
  };
}

/**
 * Builds a Memory Box from the person's own favorites only. Hometown and age-group signals are
 * deliberately not sent: in our spike they pulled results toward local mainstream taste and erased
 * an Indian persona's culture.
 */
export async function buildMemoryBox(qloo: QlooClient, person: Person, scope: string): Promise<MemoryBox> {
  const window = youthWindow(person.birthYear);
  const pinned = person.pinned ?? [];
  const exclude = person.exclude ?? { entityIds: [], tagIds: [] };
  const family = person.favorites;
  const learned = pinned
    .filter((reaction) => !family.some((favorite) => favorite.entityId === reaction.entityId))
    .map((reaction) => ({ entityId: reaction.entityId, name: reaction.item.name, kind: (reaction.item.kind === "music" ? "music" : reaction.item.kind === "films" ? "film" : "tv") as FavoriteKind }));
  const signals = [...family, ...learned].slice(0, MAX_SIGNALS);
  const signalIds = signals.map((favorite) => favorite.entityId);
  const trace: TraceStep[] = [
    { kind: "window", text: `Born ${person.birthYear}, so their youth (ages 10–30) is ${window.start}–${window.end}.` },
    {
      kind: "signals",
      text: learned.length
        ? `Asked Qloo using ${family.length} family favorites plus ${learned.length} ${learned.length === 1 ? "pick" : "picks"} that landed well in past sessions.`
        : `Asked Qloo using only their ${family.length} confirmed favorites. Hometown and age group are left out on purpose: in testing they pulled picks toward local mainstream taste.`,
    },
  ];

  const exclusionParams: Record<string, string> = {};
  if (exclude.entityIds.length) exclusionParams["filter.exclude.entities"] = exclude.entityIds.join(",");
  if (exclude.tagIds.length) exclusionParams["filter.exclude.tags"] = exclude.tagIds.join(",");
  if (exclude.entityIds.length || exclude.tagIds.length) {
    trace.push({
      kind: "exclude",
      text: `Told Qloo to leave out ${exclude.entityIds.length} ${exclude.entityIds.length === 1 ? "item" : "items"} that caused distress${exclude.tagIds.length ? ` and ${exclude.tagIds.length} ${exclude.tagIds.length === 1 ? "theme" : "themes"} staff chose to avoid` : ""}.`,
    });
  }
  const explain = { "feature.explainability": true, ...exclusionParams };
  const inWindow = { ...explain, "filter.release_year.min": window.start, "filter.release_year.max": window.end };

  const [music, films, tv] = await Promise.all([
    // Artists have no release-year filter, so take a wider pool and re-rank by Qloo's start_year.
    qloo.insights({ type: "artist", signalIds, take: ARTIST_POOL, params: explain }, { scope }),
    qloo.insights({ type: "movie", signalIds, take: SCREEN_POOL, params: inWindow }, { scope }),
    qloo.insights({ type: "tv_show", signalIds, take: SCREEN_POOL, params: inWindow }, { scope }),
  ]);

  const excludedIds = new Set([...exclude.entityIds, ...pinned.map((reaction) => reaction.entityId)]);
  const section = (kind: SectionKind, envelope: typeof music): MemorySection => {
    const noun = SECTION_NOUN[kind];
    const fresh = envelope.results
      .filter((entity) => !isFavorite(entity, signals) && !excludedIds.has(entity.entity_id))
      .map((entity) => toItem(entity, kind, { ...person, favorites: signals }, window));
    const ranked = rankByEra(fresh, (item) => item.interpretation.band);
    const late = fresh.filter((item) => item.interpretation.band === "too_late").length;
    const ownPinned = pinned.filter((reaction) => reaction.item.kind === kind).map((reaction) => pinnedItem(reaction, person, window));
    const direct = family.some((favorite) => DIRECT_KINDS[kind].includes(favorite.kind)) || ownPinned.length > 0;

    const asked = kind === "music" ? `Asked Qloo for ${noun} that fans of these favorites love` : `Asked Qloo for ${noun} released ${window.start}–${window.end} that fans of these favorites love`;
    trace.push({ kind: "qloo", text: `${asked}: ${envelope.status === "ok" ? `${envelope.resultCount} results` : `status "${envelope.status}"${envelope.summary ? ` (${envelope.summary})` : ""}`}.` });
    if (kind === "music" && late) trace.push({ kind: "rerank", text: `Moved ${late} ${late === 1 ? "artist" : "artists"} who started after ${window.end + 2} below the ones from their youth, using Qloo's career start years.` });
    if (ownPinned.length) trace.push({ kind: "learned", text: `Kept ${ownPinned.length} ${ownPinned.length === 1 ? "pick" : "picks"} that landed well in past sessions at the top of ${noun}.` });
    if (!direct && fresh.length) trace.push({ kind: "caution", text: `None of their favorites were ${noun}, so these are inferred from other favorites and marked lower confidence.` });

    return {
      kind,
      status: envelope.status,
      basis: direct ? "direct" : "inferred",
      ...(envelope.summary ? { summary: envelope.summary } : {}),
      items: [...ownPinned, ...limitLate(ranked)].slice(0, SECTION_SIZE),
    };
  };

  const sections = [section("music", music), section("films", films), section("tv", tv)];
  return { window, sections, trace };
}

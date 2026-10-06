import type { QlooClient, QlooEntity } from "../qloo/client.js";
import type { QlooStatus } from "../qloo/envelope.js";
import { artistDebutYear, eraBand, rankByEra, youthWindow, type EraBand, type YouthWindow } from "./era.js";
import type { FavoriteKind } from "./intake.js";

export interface Favorite {
  entityId: string;
  name: string;
  kind: FavoriteKind;
}

export interface Person {
  birthYear: number;
  favorites: Favorite[];
}

export type SectionKind = "music" | "films" | "tv";

export interface MemoryItem {
  entityId: string;
  name: string;
  kind: SectionKind;
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
}

const SECTION_SIZE = 12;
/** Before this age, an artist's start date says "already established", not "met them then". */
const TEEN_AGE = 13;
const DIRECT_KINDS: Record<SectionKind, FavoriteKind[]> = { music: ["music"], films: ["film", "star"], tv: ["tv", "star"] };
const ARTIST_POOL = 40;
const SCREEN_POOL = 20;

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

/**
 * Builds a Memory Box from the person's own favorites only. Hometown and age-group signals are
 * deliberately not sent: in our spike they pulled results toward local mainstream taste and erased
 * an Indian persona's culture.
 */
export async function buildMemoryBox(qloo: QlooClient, person: Person, scope: string): Promise<MemoryBox> {
  const window = youthWindow(person.birthYear);
  const signalIds = person.favorites.map((favorite) => favorite.entityId);
  const explain = { "feature.explainability": true };
  const inWindow = { ...explain, "filter.release_year.min": window.start, "filter.release_year.max": window.end };

  const [music, films, tv] = await Promise.all([
    // Artists have no release-year filter, so take a wider pool and re-rank by Qloo's start_year.
    qloo.insights({ type: "artist", signalIds, take: ARTIST_POOL, params: explain }, { scope }),
    qloo.insights({ type: "movie", signalIds, take: SCREEN_POOL, params: inWindow }, { scope }),
    qloo.insights({ type: "tv_show", signalIds, take: SCREEN_POOL, params: inWindow }, { scope }),
  ]);

  const section = (kind: SectionKind, envelope: typeof music): MemorySection => {
    const items = envelope.results.filter((entity) => !isFavorite(entity, person.favorites)).map((entity) => toItem(entity, kind, person, window));
    const direct = person.favorites.some((favorite) => DIRECT_KINDS[kind].includes(favorite.kind));
    return {
      kind,
      status: envelope.status,
      basis: direct ? "direct" : "inferred",
      ...(envelope.summary ? { summary: envelope.summary } : {}),
      items: rankByEra(items, (item) => item.interpretation.band).slice(0, SECTION_SIZE),
    };
  };

  return { window, sections: [section("music", music), section("films", films), section("tv", tv)] };
}

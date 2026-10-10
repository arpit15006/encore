import type { MemoryBox, MemoryItem } from "./memoryBox.js";
import type { Language, Starter } from "./starters.js";

/** What a Visit Kit page shows. It never contains names, only the person's era and their picks. */
export interface VisitKitContent {
  language: Language;
  youth: { start: number; end: number };
  songs: Array<{ artist: string; song?: string; year: number | null }>;
  film?: { name: string; year: number | null; lowerConfidence: boolean };
  starters: Starter[];
}

const SONGS = 3;

/** Picks for a visit: three songs from the top music picks (known hits first) and one film. */
export function visitPicks(box: MemoryBox): MemoryItem[] {
  const music = box.sections.find((section) => section.kind === "music")?.items ?? [];
  const film = box.sections.find((section) => section.kind === "films")?.items.find((item) => item.interpretation.band !== "too_late");
  const songs = music.filter((item) => item.interpretation.band !== "too_late").slice(0, SONGS);
  return film ? [...songs, film] : songs;
}

export function visitKitContent(box: MemoryBox, picks: MemoryItem[], starters: Starter[], language: Language): VisitKitContent {
  const filmSection = box.sections.find((section) => section.kind === "films");
  const film = picks.find((item) => item.kind === "films");
  return {
    language,
    youth: box.window,
    songs: picks
      .filter((item) => item.kind === "music")
      .map((item) => ({ artist: item.name, year: item.interpretation.year, ...(item.qloo.notableSongs?.[0] ? { song: item.qloo.notableSongs[0] } : {}) })),
    ...(film ? { film: { name: film.name, year: film.interpretation.year, lowerConfidence: filmSection?.basis === "inferred" } } : {}),
    starters,
  };
}

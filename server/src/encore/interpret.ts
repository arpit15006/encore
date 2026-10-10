import type { JsonModel } from "../llm.js";
import { FAVORITE_TYPES, type FavoriteKind } from "./intake.js";

export interface InterpretedStory {
  birthYear?: number;
  grewUp?: string;
  favorites: Array<{ text: string; kind: FavoriteKind }>;
  /** Things the agent noticed but deliberately did not keep (names, health details). */
  leftOut: string[];
}

const KINDS = Object.keys(FAVORITE_TYPES) as FavoriteKind[];
const MAX_FAVORITES = 10;

/**
 * Turns a family's own words into intake fields. It only extracts: every favorite still goes
 * through Qloo resolution and the user's confirmation, and the user can edit everything.
 * Names and health details are dropped and listed, never kept.
 */
export async function interpretStory(model: JsonModel, text: string, currentYear = new Date().getFullYear()): Promise<InterpretedStory | undefined> {
  const prompt = `A family member is describing an older relative so a care team can find familiar music, films and TV.
Extract ONLY:
- birthYear: a 4-digit year if they give one, or ${currentYear} minus their age if they give an age. Omit if unknown.
- grewUp: the city or country where they spent their youth, if given.
- favorites: singers/bands ("music"), films ("film"), TV shows ("tv"), film or TV stars ("star"), books ("book") they loved. Use the work or artist name only. If a song is given, use the singer's name if stated, otherwise the song title as "music".
Never keep anyone's name (the relative's or family's), addresses, or health details. List what you dropped in leftOut as short phrases like "a first name" or "a health detail" (not the content itself).
Text: """${text.slice(0, 2000)}"""
Respond only with JSON: {"birthYear": 1940, "grewUp": "...", "favorites": [{"text": "...", "kind": "music"}], "leftOut": ["..."]}`;

  const answer = await model.json<{ birthYear?: unknown; grewUp?: unknown; favorites?: unknown[]; leftOut?: unknown[] }>("interpret-v1", prompt);
  if (!answer) return undefined;

  const year = Number(answer.birthYear);
  const favorites = (answer.favorites ?? [])
    .flatMap((favorite) => {
      const candidate = favorite as { text?: unknown; kind?: unknown };
      const kind = KINDS.find((k) => k === candidate.kind);
      const name = typeof candidate.text === "string" ? candidate.text.trim() : "";
      return kind && name && name.length <= 120 ? [{ text: name, kind }] : [];
    })
    .slice(0, MAX_FAVORITES);
  return {
    ...(Number.isInteger(year) && year >= 1915 && year <= currentYear - 40 ? { birthYear: year } : {}),
    ...(typeof answer.grewUp === "string" && answer.grewUp.trim() ? { grewUp: answer.grewUp.trim().slice(0, 80) } : {}),
    favorites,
    leftOut: (answer.leftOut ?? []).filter((item): item is string => typeof item === "string").slice(0, 5),
  };
}

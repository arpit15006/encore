// Types mirror the server's API (server/src/encore and server/src/http/app.ts).

export type FavoriteKind = "music" | "film" | "tv" | "book" | "star";
export type QlooStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";
export type EraBand = "in_era" | "unknown" | "too_late";
export type SectionKind = "music" | "films" | "tv";

export interface Candidate {
  entityId: string;
  name: string;
  description?: string;
}

export type Resolution =
  | { status: "resolved"; input: string; kind: FavoriteKind; entity: Candidate; alternatives: Candidate[] }
  | { status: "choose"; input: string; kind: FavoriteKind; candidates: Candidate[]; reason: string }
  | { status: "not_found"; input: string; kind: FavoriteKind; reason: string }
  | { status: "error"; input: string; kind: FavoriteKind; reason: string };

export interface Favorite {
  entityId: string;
  name: string;
  kind: FavoriteKind;
}

export interface Person {
  birthYear: number;
  grewUp?: string;
  favorites: Favorite[];
}

export interface LoggedRequest {
  at: string;
  tool: string;
  args: Record<string, unknown>;
  status: string;
  cacheHit: boolean;
}

export interface MemoryItem {
  entityId: string;
  name: string;
  kind: SectionKind;
  qloo: {
    affinity: number | null;
    popularity: number | null;
    becauseOf: Array<{ name: string; share: number }>;
    notableSongs?: string[];
  };
  interpretation: { year: number | null; ageThen: number | null; band: EraBand; note: string };
}

export interface MemorySection {
  kind: SectionKind;
  status: QlooStatus;
  basis: "direct" | "inferred";
  summary?: string;
  items: MemoryItem[];
}

export interface MemoryBox {
  window: { start: number; end: number };
  sections: MemorySection[];
  whatQlooSaw: LoggedRequest[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("We couldn't reach Encore. Check your connection and try again.", 0);
  }
  if (response.status === 429) throw new ApiError("Lots of people are trying Encore right now. Please wait a minute and try again.", 429);
  if (!response.ok) throw new ApiError("Something went wrong on our side. Please try again.", response.status);
  return response.json() as Promise<T>;
}

export const resolveFavorites = (items: Array<{ text: string; kind: FavoriteKind }>) =>
  post<{ results: Resolution[]; whatQlooSaw: LoggedRequest[] }>("/api/intake/resolve", { items });

export const buildMemoryBox = (person: Person) =>
  post<MemoryBox>("/api/memory-box", { birthYear: person.birthYear, favorites: person.favorites });

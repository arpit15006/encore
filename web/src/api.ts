// Types mirror the server's API (server/src/encore and server/src/http/app.ts).

export type FavoriteKind = "music" | "film" | "tv" | "book" | "star";
export type QlooStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";
export type EraBand = "in_era" | "unknown" | "too_late";
export type SectionKind = "music" | "films" | "tv";
export type ReactionValue = "lit_up" | "calm" | "none" | "distressed";
export type Language = "en" | "hi" | "es";

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
  reaction?: ReactionValue;
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

export interface TraceStep {
  kind: "window" | "signals" | "qloo" | "rerank" | "learned" | "exclude" | "caution";
  text: string;
}

export interface MemoryBox {
  window: { start: number; end: number };
  sections: MemorySection[];
  trace: TraceStep[];
  whatQlooSaw: LoggedRequest[];
}

export interface Resident {
  id: string;
  birthYear: number;
  grewUp?: string;
  livesIn?: string;
  demoId?: string;
}

export interface ResidentView {
  resident: Resident;
  favorites: Favorite[];
  reactions: Array<{ entityId: string; value: ReactionValue; item: { name: string; kind: SectionKind; year: number | null }; at: string }>;
  exclusions: Array<{ target: string; kind: "entity" | "tag"; label: string }>;
  visitKits: Array<{ hint: string; language: Language; createdAt: string; expiresAt: string; revoked: boolean }>;
}

export interface DemoResident {
  id: string;
  label: string;
  birthYear: number;
  grewUp: string;
  favorites: Favorite[];
}

export interface ComparisonColumn {
  system: "plain_ai" | "naive_qloo" | "encore";
  title: string;
  how: string;
  status: QlooStatus | "model_failed";
  items: Array<{ name: string; year: number | null; inYouth: boolean | null }>;
  inYouthCount: number | null;
  datedCount: number;
}

export interface Starter {
  text: string;
  about: string;
  tag: string;
  source: "model" | "template";
}

export interface VisitKitContent {
  language: Language;
  youth: { start: number; end: number };
  songs: Array<{ artist: string; song?: string; year: number | null }>;
  film?: { name: string; year: number | null; lowerConfidence: boolean };
  starters: Starter[];
}

export interface AgentAnswer {
  answer: string;
  stoppedEarly: boolean;
  steps: Array<{ tool: string; args: Record<string, unknown>; status: string; resultCount: number; summary?: string; removed?: string[] }>;
  whatQlooSaw: LoggedRequest[];
}

export interface GroupPlan {
  members: Array<{ id: string; label: string }>;
  setlist: Array<{ entityId: string; name: string; song?: string; year: number | null; forMembers: string[]; score: number }>;
  unmet: string[];
  coverage: Record<string, number>;
}

export interface EvaluationSystem {
  id: "plain_ai" | "qloo_naive" | "qloo_raw" | "encore";
  label: string;
  hitRate: number;
  recall: number;
  youthShare: number | null;
  listOverlap: number;
}

export interface Evaluation {
  generatedAt: string;
  dataset: { name: string; license: string; doi: string; url: string };
  method: Record<string, string>;
  sample: { eligible: number; evaluated: number; skipped: number; bornAbroad: number; birthYears: [number, number] };
  systems: EvaluationSystem[];
  systemsBornAbroad: EvaluationSystem[];
  reminiscenceBump: { note: string; total: number; buckets: Array<{ label: string; count: number }> };
}

export interface InterpretedStory {
  birthYear?: number;
  grewUp?: string;
  favorites: Array<{ text: string; kind: FavoriteKind }>;
  leftOut: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError("We couldn't reach Encore. Check your connection and try again.", 0);
  }
  if (response.status === 429) throw new ApiError("Lots of people are trying Encore right now. Please wait a minute and try again.", 429);
  if (response.status === 404) throw new ApiError("We couldn't find that. The link may be old or mistyped.", 404);
  if (!response.ok) throw new ApiError("Something went wrong on our side. Please try again.", response.status);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/**
 * A small in-memory cache for reads. Pages that were already visited, or prefetched in the background,
 * open instantly; identical requests in flight are shared. Any change to a resident clears its entries.
 */
const FRESH_MS = 2 * 60_000;
const reads = new Map<string, { at: number; value: Promise<unknown> }>();
function cachedGet<T>(path: string): Promise<T> {
  const hit = reads.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.value as Promise<T>;
  const value = request<T>("GET", path);
  reads.set(path, { at: Date.now(), value });
  value.catch(() => reads.delete(path));
  return value;
}
function forgetResident<T>(id: string, change: Promise<T>): Promise<T> {
  return change.finally(() => {
    for (const key of reads.keys()) if (key.startsWith(`/api/residents/${id}`)) reads.delete(key);
  });
}
const quietly = (promise: Promise<unknown>) => void promise.catch(() => undefined);

export const api = {
  resolveFavorites: (items: Array<{ text: string; kind: FavoriteKind }>) =>
    request<{ results: Resolution[]; whatQlooSaw: LoggedRequest[] }>("POST", "/api/intake/resolve", { items }),
  interpret: (text: string) => request<InterpretedStory>("POST", "/api/intake/interpret", { text }),
  demoResidents: () => cachedGet<DemoResident[]>("/api/demo-residents"),
  createResident: (input: { birthYear: number; grewUp?: string; livesIn?: string; favorites: Favorite[] }) =>
    request<{ id: string }>("POST", "/api/residents", input),
  copyDemo: (demoId: string) => request<{ id: string }>("POST", `/api/residents/from-demo/${encodeURIComponent(demoId)}`),
  resident: (id: string) => cachedGet<ResidentView>(`/api/residents/${id}`),
  memoryBox: (id: string) => cachedGet<MemoryBox>(`/api/residents/${id}/memory-box`),
  react: (id: string, value: ReactionValue, item: MemoryItem) =>
    forgetResident(id, request<{ similarThemes: Array<{ id: string; name: string }> }>("POST", `/api/residents/${id}/reactions`, { value, item })),
  exclude: (id: string, exclusion: { target: string; kind: "entity" | "tag"; label: string }) =>
    forgetResident(id, request<void>("POST", `/api/residents/${id}/exclusions`, exclusion)),
  unexclude: (id: string, target: string) => forgetResident(id, request<void>("DELETE", `/api/residents/${id}/exclusions/${encodeURIComponent(target)}`)),
  compare: (id: string) => cachedGet<{ columns: ComparisonColumn[]; whatQlooSaw: LoggedRequest[] }>(`/api/residents/${id}/compare`),
  createVisitKit: (id: string, language: Language) =>
    forgetResident(id, request<{ token: string; expiresAt: string; content: VisitKitContent; whatQlooSaw: LoggedRequest[] }>("POST", `/api/residents/${id}/visit-kits`, { language })),
  revokeVisitKit: (id: string, hint: string) => forgetResident(id, request<void>("POST", `/api/residents/${id}/visit-kits/${hint}/revoke`)),
  visitKit: (token: string) => cachedGet<{ content: VisitKitContent; expiresAt: string }>(`/api/visit-kits/${token}`),
  ask: (id: string, question: string) => request<AgentAnswer>("POST", `/api/residents/${id}/ask`, { question }),
  groupSession: () => cachedGet<GroupPlan>("/api/group-session"),
  evaluation: () => cachedGet<Evaluation>("/api/evaluation"),
  /** Loads a resident's other pages in the background, so moving between them is instant. */
  prefetchResident: (id: string) => {
    for (const path of ["", "/memory-box", "/compare"]) quietly(cachedGet(`/api/residents/${id}${path}`));
  },
  /** Loads the public pages a visitor is likely to open next. */
  prefetchPublic: () => {
    for (const path of ["/api/demo-residents", "/api/group-session", "/api/evaluation"]) quietly(cachedGet(path));
  },
};

import type { QlooClient } from "../qloo/client.js";

/** Favorite categories on the intake form, mapped to Qloo's search types. */
export const FAVORITE_TYPES = { music: "artist", film: "movie", tv: "tv_show", book: "book", star: "actor" } as const;
export type FavoriteKind = keyof typeof FAVORITE_TYPES;

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

interface DescribeOutcome {
  status?: string;
  match?: string;
  selected?: { id: string; name: string; description?: string };
  alternatives?: Array<{ id: string; name: string; description?: string }>;
}

const toCandidate = (item: { id: string; name: string; description?: string }): Candidate => ({
  entityId: item.id,
  name: item.name,
  ...(item.description ? { description: item.description } : {}),
});

/**
 * Resolve → confirm. An exact name match is still shown to the user for confirmation, with
 * alternatives, because names collide (typing "Rafi" exactly matches a different artist called Rafi).
 * Anything less than exact becomes a choice. An unconfirmed match is never passed into later Qloo requests.
 */
export async function resolveFavorite(qloo: QlooClient, input: string, kind: FavoriteKind, scope: string): Promise<Resolution> {
  const envelope = await qloo.call("qloo_describe", { entity: input, type: FAVORITE_TYPES[kind] }, { scope });
  const outcome = ((envelope.resolution as { outcomes?: DescribeOutcome[] } | undefined)?.outcomes ?? [])[0];
  const options = [outcome?.selected, ...(outcome?.alternatives ?? [])].filter((item) => item !== undefined).slice(0, 5).map(toCandidate);

  switch (envelope.status) {
    case "ok":
    case "partial":
    case "degraded":
      if (outcome?.status === "resolved" && outcome.match === "exact" && outcome.selected) {
        return { status: "resolved", input, kind, entity: toCandidate(outcome.selected), alternatives: options.slice(1) };
      }
      return options.length
        ? { status: "choose", input, kind, candidates: options, reason: "We found close matches. Which one did they love?" }
        : { status: "not_found", input, kind, reason: "We couldn't find that. Try another spelling." };
    case "needs_input":
      return options.length
        ? { status: "choose", input, kind, candidates: options, reason: envelope.summary ?? "Which one did they love?" }
        : { status: "not_found", input, kind, reason: envelope.summary ?? "We couldn't find that. Try another spelling." };
    case "empty":
      return { status: "not_found", input, kind, reason: "We couldn't find that. Try another spelling." };
    case "error":
      return { status: "error", input, kind, reason: envelope.error?.recovery ?? "Something went wrong looking that up. Please try again." };
  }
}

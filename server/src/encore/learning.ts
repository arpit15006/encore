import type { Exclusion, Reaction, ReactionValue, StoredFavorite } from "../store/appStore.js";

/**
 * Familiarity-biased learning from staff reactions.
 *
 * Each item has a Beta(α, β) belief that it lands well. The prior leans positive (α=2, β=1)
 * because these picks already come from the person's own favorites and youth. "Lit up" counts as
 * two successes, "calm" as one, "no response" is neutral (it often reflects the moment, not the
 * song), and "distressed" is not a data point at all: it is a hard exclusion.
 *
 * Encore ranks by the posterior mean rather than a random draw, so a care plan doesn't reshuffle on
 * every visit. Favoring known hits over exploring new ones is deliberate: in dementia care,
 * recognition matters more than discovery.
 */
const PRIOR = { alpha: 2, beta: 1 };
const EVIDENCE: Record<Exclude<ReactionValue, "distressed">, { successes: number; failures: number }> = {
  lit_up: { successes: 2, failures: 0 },
  calm: { successes: 1, failures: 0 },
  none: { successes: 0, failures: 0 },
};

export interface ItemBelief {
  entityId: string;
  alpha: number;
  beta: number;
  mean: number;
  last: ReactionValue;
  reactions: number;
}

export function beliefs(reactions: Reaction[]): Map<string, ItemBelief> {
  const result = new Map<string, ItemBelief>();
  for (const reaction of reactions) {
    const current = result.get(reaction.entityId) ?? { entityId: reaction.entityId, alpha: PRIOR.alpha, beta: PRIOR.beta, mean: 0, last: reaction.value, reactions: 0 };
    if (reaction.value !== "distressed") {
      current.alpha += EVIDENCE[reaction.value].successes;
      current.beta += EVIDENCE[reaction.value].failures;
    }
    current.last = reaction.value;
    current.reactions += 1;
    current.mean = current.alpha / (current.alpha + current.beta);
    result.set(reaction.entityId, current);
  }
  return result;
}

/** Positive reactions (lit up, calm) make an item a "known hit": pinned first and used as a new signal. */
export const isPositive = (value: ReactionValue) => value === "lit_up" || value === "calm";

export interface LearnedPlan {
  /** Items that landed well, best first. */
  pinned: Reaction[];
  /** Entity IDs Qloo must not return again. */
  excludedEntityIds: string[];
  /** Tag URNs staff chose to exclude ("similar war films"). */
  excludedTagIds: string[];
  /** Favorites learned from reactions, to add as Qloo signals. */
  learnedFavorites: StoredFavorite[];
}

export function planFromReactions(reactions: Reaction[], exclusions: Exclusion[]): LearnedPlan {
  const belief = beliefs(reactions);
  const latest = new Map<string, Reaction>();
  for (const reaction of reactions) latest.set(reaction.entityId, reaction);

  const distressed = [...latest.values()].filter((reaction) => reaction.value === "distressed").map((reaction) => reaction.entityId);
  const pinned = [...latest.values()]
    .filter((reaction) => isPositive(reaction.value))
    .sort((a, b) => (belief.get(b.entityId)?.mean ?? 0) - (belief.get(a.entityId)?.mean ?? 0));

  return {
    pinned,
    excludedEntityIds: [...new Set([...distressed, ...exclusions.filter((e) => e.kind === "entity").map((e) => e.target)])],
    excludedTagIds: exclusions.filter((e) => e.kind === "tag").map((e) => e.target),
    // Only music and films/TV that lit someone up become signals; that is what Qloo can expand from.
    learnedFavorites: pinned.map((reaction) => ({
      entityId: reaction.entityId,
      name: reaction.item.name,
      kind: reaction.item.kind === "music" ? "music" : reaction.item.kind === "films" ? "film" : "tv",
      source: "learned" as const,
    })),
  };
}

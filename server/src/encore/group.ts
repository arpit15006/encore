/**
 * Group sessions: choose one setlist for several residents so that everyone gets songs that are
 * theirs. Each resident's list is already ordered by Encore (familiar first). Qloo's raw scores
 * aren't comparable across requests, so we use each resident's own rank, normalized to 0–1.
 */

export interface GroupCandidate {
  entityId: string;
  name: string;
  song?: string;
  year: number | null;
}

export interface GroupMember {
  id: string;
  label: string;
  /** Best first. */
  items: GroupCandidate[];
}

export interface SetlistEntry extends GroupCandidate {
  /** Members for whom this pick scores at or above the threshold. */
  forMembers: string[];
  score: number;
}

export interface GroupPlan {
  setlist: SetlistEntry[];
  /** Members who couldn't get the minimum number of strong picks (reported, never hidden). */
  unmet: string[];
  coverage: Record<string, number>;
}

export interface GroupOptions {
  size?: number;
  minPerMember?: number;
  /** A pick counts as "theirs" when its normalized rank score is at least this. */
  threshold?: number;
}

/** 1.0 for a member's top pick, falling linearly to just above 0 for their last; 0 if absent. */
export function memberScore(member: GroupMember, entityId: string): number {
  const index = member.items.findIndex((item) => item.entityId === entityId);
  return index < 0 ? 0 : 1 - index / member.items.length;
}

/**
 * Greedy coverage: first, repeatedly add the pick that helps the most under-covered members
 * (each still below `minPerMember` strong picks); then fill the remaining slots by total score.
 */
export function planGroupSession(members: GroupMember[], options: GroupOptions = {}): GroupPlan {
  const size = options.size ?? 10;
  const minPerMember = options.minPerMember ?? 2;
  const threshold = options.threshold ?? 0.5;

  const candidates = new Map<string, GroupCandidate>();
  for (const member of members) for (const item of member.items) if (!candidates.has(item.entityId)) candidates.set(item.entityId, item);

  const chosen: SetlistEntry[] = [];
  const coverage: Record<string, number> = Object.fromEntries(members.map((member) => [member.id, 0]));
  const strongFor = (entityId: string) => members.filter((member) => memberScore(member, entityId) >= threshold).map((member) => member.id);
  const total = (entityId: string) => members.reduce((sum, member) => sum + memberScore(member, entityId), 0);
  const take = (entityId: string) => {
    const forMembers = strongFor(entityId);
    for (const id of forMembers) coverage[id] = (coverage[id] ?? 0) + 1;
    chosen.push({ ...candidates.get(entityId)!, forMembers, score: Math.round(total(entityId) * 100) / 100 });
    candidates.delete(entityId);
  };

  // Phase 1: coverage. Gain = summed strong scores for members still under the minimum.
  while (chosen.length < size) {
    const needy = members.filter((member) => (coverage[member.id] ?? 0) < minPerMember);
    if (!needy.length) break;
    let best: { id: string; gain: number; total: number } | undefined;
    for (const id of candidates.keys()) {
      const gain = needy.reduce((sum, member) => {
        const score = memberScore(member, id);
        return sum + (score >= threshold ? score : 0);
      }, 0);
      const candidateTotal = total(id);
      if (gain > 0 && (!best || gain > best.gain || (gain === best.gain && candidateTotal > best.total))) best = { id, gain, total: candidateTotal };
    }
    if (!best) break;
    take(best.id);
  }

  // Phase 2: fill by overall appeal to the group.
  while (chosen.length < size && candidates.size) {
    const next = [...candidates.keys()].sort((a, b) => total(b) - total(a))[0]!;
    take(next);
  }

  const unmet = members.filter((member) => (coverage[member.id] ?? 0) < minPerMember).map((member) => member.id);
  return { setlist: chosen, unmet, coverage };
}

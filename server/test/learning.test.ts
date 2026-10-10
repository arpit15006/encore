import { describe, expect, it } from "vitest";
import { beliefs, planFromReactions } from "../src/encore/learning.js";
import type { Reaction } from "../src/store/appStore.js";

const reaction = (entityId: string, value: Reaction["value"], kind: Reaction["item"]["kind"] = "music"): Reaction => ({
  entityId,
  value,
  item: { name: entityId, kind, year: 1960 },
  at: "2026-10-11T00:00:00Z",
});

describe("beliefs", () => {
  it("starts from a familiarity-leaning prior and counts lit up double", () => {
    const belief = beliefs([reaction("a", "lit_up"), reaction("b", "calm")]);
    expect(belief.get("a")).toMatchObject({ alpha: 4, beta: 1 });
    expect(belief.get("b")).toMatchObject({ alpha: 3, beta: 1 });
    expect(belief.get("a")!.mean).toBeGreaterThan(belief.get("b")!.mean);
  });

  it("treats no response as neutral", () => {
    const belief = beliefs([reaction("a", "none")]);
    expect(belief.get("a")).toMatchObject({ alpha: 2, beta: 1, last: "none" });
  });
});

describe("planFromReactions", () => {
  it("pins positive items best first and turns them into learned favorites", () => {
    const plan = planFromReactions([reaction("calm-one", "calm"), reaction("hit", "lit_up"), reaction("hit", "lit_up"), reaction("film", "lit_up", "films")], []);
    expect(plan.pinned.map((r) => r.entityId)).toEqual(["hit", "film", "calm-one"]);
    expect(plan.learnedFavorites.find((f) => f.entityId === "film")?.kind).toBe("film");
    expect(plan.learnedFavorites.every((f) => f.source === "learned")).toBe(true);
  });

  it("makes distress a hard exclusion, even after earlier positive reactions", () => {
    const plan = planFromReactions([reaction("a", "lit_up"), reaction("a", "distressed")], []);
    expect(plan.excludedEntityIds).toEqual(["a"]);
    expect(plan.pinned).toEqual([]);
  });

  it("does not pin items that got no response", () => {
    expect(planFromReactions([reaction("a", "none")], []).pinned).toEqual([]);
  });

  it("includes staff-chosen entity and tag exclusions", () => {
    const plan = planFromReactions([], [
      { target: "urn:tag:keyword:media:war", kind: "tag", label: "War" },
      { target: "e1", kind: "entity", label: "Some film" },
    ]);
    expect(plan.excludedTagIds).toEqual(["urn:tag:keyword:media:war"]);
    expect(plan.excludedEntityIds).toEqual(["e1"]);
  });
});

import { describe, expect, it } from "vitest";
import { memberScore, planGroupSession, type GroupMember } from "../src/encore/group.js";

const member = (id: string, items: string[]): GroupMember => ({ id, label: id, items: items.map((name) => ({ entityId: name, name, year: 1960 })) });

describe("memberScore", () => {
  it("normalizes rank to 1 for the top pick and 0 when absent", () => {
    const m = member("a", ["x", "y", "z", "w"]);
    expect(memberScore(m, "x")).toBe(1);
    expect(memberScore(m, "z")).toBe(0.5);
    expect(memberScore(m, "missing")).toBe(0);
  });
});

describe("planGroupSession", () => {
  it("gives every member at least two strong picks when possible", () => {
    const members = [member("a", ["a1", "a2", "a3", "a4"]), member("b", ["b1", "b2", "b3", "b4"]), member("c", ["c1", "c2", "c3", "c4"])];
    const plan = planGroupSession(members, { size: 6, minPerMember: 2, threshold: 0.5 });
    expect(plan.unmet).toEqual([]);
    expect(plan.coverage).toEqual({ a: 2, b: 2, c: 2 });
    expect(plan.setlist).toHaveLength(6);
  });

  it("prefers a shared pick that serves several members", () => {
    const members = [member("a", ["shared", "a1", "a2", "a3"]), member("b", ["shared", "b1", "b2", "b3"])];
    const plan = planGroupSession(members, { size: 3, minPerMember: 2 });
    expect(plan.setlist[0]!.entityId).toBe("shared");
    expect(plan.setlist[0]!.forMembers.sort()).toEqual(["a", "b"]);
    expect(plan.unmet).toEqual([]);
  });

  it("reports members it cannot cover instead of hiding them", () => {
    const members = [member("a", ["a1", "a2", "a3", "a4"]), member("b", ["b1", "b2", "b3", "b4"]), member("c", ["c1", "c2", "c3", "c4"])];
    const plan = planGroupSession(members, { size: 3, minPerMember: 2 });
    expect(plan.setlist).toHaveLength(3);
    expect(plan.unmet.length).toBeGreaterThan(0);
  });

  it("fills spare slots by overall appeal once everyone is covered", () => {
    const members = [member("a", ["a1", "a2", "x", "y"]), member("b", ["b1", "b2", "x", "z"])];
    const plan = planGroupSession(members, { size: 5, minPerMember: 2 });
    expect(plan.setlist.map((entry) => entry.entityId)).toContain("x");
  });
});

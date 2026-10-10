import { afterEach, describe, expect, it } from "vitest";
import { AppStore, hashToken } from "../src/store/appStore.js";

let store: AppStore | undefined;
afterEach(() => store?.close());

describe("residents", () => {
  it("stores residents without any name field", () => {
    store = new AppStore(":memory:");
    const resident = store.createResident({ birthYear: 1940, grewUp: "Mumbai, India", favorites: [{ entityId: "e1", name: "Lata Mangeshkar", kind: "music" }] });
    expect(Object.keys(store.getResident(resident.id)!).sort()).toEqual(["birthYear", "createdAt", "grewUp", "id"]);
    expect(store.favorites(resident.id)).toEqual([{ entityId: "e1", name: "Lata Mangeshkar", kind: "music", source: "family" }]);
  });
});

describe("visit kits", () => {
  it("stores only a hash of the token", () => {
    store = new AppStore(":memory:");
    const kit = store.createVisitKit("r1", "en", { songs: [] });
    expect(kit.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(hashToken(kit.token)).not.toContain(kit.token);
    expect(store.getVisitKit(kit.token)?.content).toEqual({ songs: [] });
  });

  it("expires after 30 days", () => {
    store = new AppStore(":memory:");
    const kit = store.createVisitKit("r1", "en", {});
    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(store.getVisitKit(kit.token, later)).toBeUndefined();
  });

  it("can be revoked by its owner only", () => {
    store = new AppStore(":memory:");
    const kit = store.createVisitKit("r1", "en", {});
    const hint = kit.token.slice(0, 6);
    expect(store.revokeVisitKit("someone-else", hint)).toBe(false);
    expect(store.getVisitKit(kit.token)).toBeDefined();
    expect(store.revokeVisitKit("r1", hint)).toBe(true);
    expect(store.getVisitKit(kit.token)).toBeUndefined();
  });

  it("returns nothing for unknown tokens", () => {
    store = new AppStore(":memory:");
    expect(store.getVisitKit("x".repeat(32))).toBeUndefined();
  });
});

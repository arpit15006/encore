import { afterEach, describe, expect, it } from "vitest";
import { canonicalJson, QlooStore, requestKey } from "../src/qloo/store.js";

describe("canonicalJson and requestKey", () => {
  it("is independent of key order at every level", () => {
    const a = { signals: ["x"], target_type: "artist", nested: { b: 1, a: 2 } };
    const b = { nested: { a: 2, b: 1 }, target_type: "artist", signals: ["x"] };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(requestKey("qloo_recommend", a)).toBe(requestKey("qloo_recommend", b));
  });

  it("keeps array order, because signal order is meaningful", () => {
    expect(requestKey("t", { signals: ["a", "b"] })).not.toBe(requestKey("t", { signals: ["b", "a"] }));
  });

  it("separates tools with identical arguments", () => {
    expect(requestKey("qloo_describe", { entity: "x" })).not.toBe(requestKey("qloo_entity_tags", { entity: "x" }));
  });
});

describe("QlooStore", () => {
  let store: QlooStore | undefined;
  afterEach(() => store?.close());

  it("round-trips cached responses", () => {
    store = new QlooStore(":memory:");
    expect(store.getCached("qloo_describe", { entity: "x" })).toBeUndefined();
    store.putCached("qloo_describe", { entity: "x" }, { status: "ok", results: [1] }, "ok");
    expect(store.getCached("qloo_describe", { entity: "x" })).toEqual({ status: "ok", results: [1] });
  });

  it("logs exactly what was sent, per scope and in order", () => {
    store = new QlooStore(":memory:");
    store.logRequest({ scope: "resident-1", tool: "qloo_describe", args: { entity: "Patsy Cline" }, status: "ok", cacheHit: false });
    store.logRequest({ scope: "resident-2", tool: "qloo_recommend", args: { signals: ["id"] }, status: "ok", cacheHit: false });
    store.logRequest({ scope: "resident-1", tool: "qloo_recommend", args: { signals: ["id"] }, status: "empty", cacheHit: true });
    const log = store.requestsFor("resident-1");
    expect(log.map((entry) => entry.tool)).toEqual(["qloo_describe", "qloo_recommend"]);
    expect(log[0]?.args).toEqual({ entity: "Patsy Cline" });
    expect(log[1]?.cacheHit).toBe(true);
  });
});

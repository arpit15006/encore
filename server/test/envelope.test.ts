import { describe, expect, it } from "vitest";
import { isCacheable, normalizeEnvelope, shouldRetry } from "../src/qloo/envelope.js";

describe("normalizeEnvelope", () => {
  it("keeps ok results", () => {
    const envelope = normalizeEnvelope({ status: "ok", results: [{ name: "Patsy Cline" }], result_count: 1 });
    expect(envelope.status).toBe("ok");
    expect(envelope.results).toHaveLength(1);
  });

  it("treats ok with zero results as empty (seen live in the spike)", () => {
    const envelope = normalizeEnvelope({ status: "ok", results: [], result_count: 0 });
    expect(envelope.status).toBe("empty");
  });

  it.each(["empty", "needs_input", "partial", "degraded"] as const)("passes %s through with its summary", (status) => {
    const envelope = normalizeEnvelope({ status, summary: "why", results: [] });
    expect(envelope.status).toBe(status);
    expect(envelope.summary).toBe("why");
  });

  it("reads error code, retryable and recovery", () => {
    const envelope = normalizeEnvelope({ status: "error", error: { code: "RATE_LIMITED", retryable: true, recovery: "wait" } });
    expect(envelope.error).toEqual({ code: "RATE_LIMITED", retryable: true, recovery: "wait" });
  });

  it("turns a missing or unknown status into a non-retryable error", () => {
    for (const input of [undefined, {}, { status: "weird" }]) {
      const envelope = normalizeEnvelope(input);
      expect(envelope.status).toBe("error");
      expect(envelope.error?.code).toBe("MALFORMED_ENVELOPE");
      expect(envelope.error?.retryable).toBe(false);
    }
  });
});

describe("retry and cache rules", () => {
  it("retries only errors Qloo marks retryable", () => {
    expect(shouldRetry(normalizeEnvelope({ status: "error", error: { code: "X", retryable: true } }))).toBe(true);
    expect(shouldRetry(normalizeEnvelope({ status: "error", error: { code: "X", retryable: false } }))).toBe(false);
    expect(shouldRetry(normalizeEnvelope({ status: "degraded", results: [{}] }))).toBe(false);
  });

  it("never caches errors", () => {
    expect(isCacheable(normalizeEnvelope({ status: "error", error: { code: "X" } }))).toBe(false);
    expect(isCacheable(normalizeEnvelope({ status: "ok", results: [], result_count: 0 }))).toBe(true);
  });
});

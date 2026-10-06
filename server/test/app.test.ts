import { describe, expect, it } from "vitest";
import { buildApp } from "../src/http/app.js";
import type { QlooClient } from "../src/qloo/client.js";
import { normalizeEnvelope } from "../src/qloo/envelope.js";

function fakeQloo(overrides: Partial<QlooClient> = {}): QlooClient {
  return {
    capabilities: async () => ({ ready: true, toolCount: 10, detail: {} }),
    call: async () => normalizeEnvelope({ status: "ok", results: [{ name: "Patsy Cline" }] }),
    ...overrides,
  } as unknown as QlooClient;
}

describe("health routes", () => {
  it("never rate-limits the platform health check", async () => {
    const app = await buildApp({ qloo: fakeQloo(), rateLimitPerMinute: 2, logger: false });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await app.inject({ url: "/api/health" })).statusCode);
    expect(codes).toEqual([200, 200, 200, 200, 200]);
    await app.close();
  });

  it("rate-limits other API routes per visitor", async () => {
    const app = await buildApp({ qloo: fakeQloo(), rateLimitPerMinute: 2, logger: false });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await app.inject({ url: "/api/health/qloo" })).statusCode);
    expect(codes).toEqual([200, 200, 429]);
    await app.close();
  });

  it("reports 503 when the Qloo credential is not ready", async () => {
    const app = await buildApp({
      qloo: fakeQloo({ capabilities: async () => ({ ready: false, toolCount: 10, detail: {} }) }),
      rateLimitPerMinute: 10,
      logger: false,
    });
    const response = await app.inject({ url: "/api/health/qloo" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ ready: false, tools: 10 });
    await app.close();
  });

  it("reports the live check's Qloo status without leaking details", async () => {
    const app = await buildApp({
      qloo: fakeQloo({ call: async () => normalizeEnvelope({ status: "error", error: { code: "UNAUTHORIZED", retryable: false } }) }) as QlooClient,
      rateLimitPerMinute: 10,
      logger: false,
    });
    const response = await app.inject({ url: "/api/health/qloo/live" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "error", error: "UNAUTHORIZED" });
    await app.close();
  });
});

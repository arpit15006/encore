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

const noLog = { requestsFor: () => [] };

describe("health routes", () => {
  it("never rate-limits the platform health check", async () => {
    const app = await buildApp({ qloo: fakeQloo(), store: noLog, rateLimitPerMinute: 2, logger: false });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await app.inject({ url: "/api/health" })).statusCode);
    expect(codes).toEqual([200, 200, 200, 200, 200]);
    await app.close();
  });

  it("rate-limits other API routes per visitor", async () => {
    const app = await buildApp({ qloo: fakeQloo(), store: noLog, rateLimitPerMinute: 2, logger: false });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await app.inject({ url: "/api/health/qloo" })).statusCode);
    expect(codes).toEqual([200, 200, 429]);
    await app.close();
  });

  it("reports 503 when the Qloo credential is not ready", async () => {
    const app = await buildApp({
      qloo: fakeQloo({ capabilities: async () => ({ ready: false, toolCount: 10, detail: {} }) }),
      store: noLog,
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
      store: noLog,
      rateLimitPerMinute: 10,
      logger: false,
    });
    const response = await app.inject({ url: "/api/health/qloo/live" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "error", error: "UNAUTHORIZED" });
    await app.close();
  });
});

describe("serving the web app", () => {
  it("loads the app for client routes but 404s missing files and API paths", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dist = mkdtempSync(join(tmpdir(), "encore-web-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
    const app = await buildApp({ qloo: fakeQloo(), store: noLog, rateLimitPerMinute: 100, webDist: dist, logger: false });
    writeFileSync(join(dist, "late.js"), "console.log(1)"); // added after startup, like a rebuild
    expect((await app.inject({ url: "/demo" })).body).toContain("<title>app</title>");
    expect((await app.inject({ url: "/late.js" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/assets/missing-abc123.js" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/nope" })).statusCode).toBe(404);
    await app.close();
  });

  it("never rate-limits pages and assets, only the API", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dist = mkdtempSync(join(tmpdir(), "encore-web-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
    writeFileSync(join(dist, "app.js"), "console.log(1)");
    const app = await buildApp({ qloo: fakeQloo(), store: noLog, rateLimitPerMinute: 2, webDist: dist, logger: false });
    const pageCodes = [];
    for (let i = 0; i < 6; i++) pageCodes.push((await app.inject({ url: i % 2 ? "/app.js" : "/demo" })).statusCode);
    expect(pageCodes.every((code) => code === 200)).toBe(true);
    const apiCodes = [];
    for (let i = 0; i < 3; i++) apiCodes.push((await app.inject({ url: "/api/health/qloo" })).statusCode);
    expect(apiCodes).toEqual([200, 200, 429]);
    await app.close();
  });
});

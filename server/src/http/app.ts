import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { FAVORITE_TYPES, resolveFavorite, type FavoriteKind } from "../encore/intake.js";
import { buildMemoryBox } from "../encore/memoryBox.js";
import type { QlooClient } from "../qloo/client.js";
import type { QlooStore } from "../qloo/store.js";

export interface AppDeps {
  qloo: QlooClient;
  store: Pick<QlooStore, "requestsFor">;
  rateLimitPerMinute: number;
  logger?: boolean;
}

const currentYear = new Date().getFullYear();

const ResolveBody = z.object({
  items: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(120),
        kind: z.enum(Object.keys(FAVORITE_TYPES) as [FavoriteKind, ...FavoriteKind[]]),
      }),
    )
    .min(1)
    .max(10),
});

// No name, address or health fields exist: only a birth year and confirmed Qloo entities.
const MemoryBoxBody = z.object({
  birthYear: z.number().int().min(1915).max(currentYear - 40),
  favorites: z
    .array(
      z.object({
        entityId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        kind: z.enum(Object.keys(FAVORITE_TYPES) as [FavoriteKind, ...FavoriteKind[]]),
      }),
    )
    .min(1)
    .max(10),
});

export async function buildApp({ qloo, store, rateLimitPerMinute, logger = true }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger, trustProxy: true });
  // Public visitors share one Qloo quota with the judges, so every API route is rate-limited per IP.
  await app.register(rateLimit, { max: rateLimitPerMinute, timeWindow: "1 minute" });

  // Hosting platforms poll this to decide whether to restart the app, so it must never be rate-limited.
  app.get("/api/health", { config: { rateLimit: false } }, async () => ({ ok: true, uptimeSeconds: Math.round(process.uptime()) }));

  // Uses the kit's readiness check, which does not contact Qloo or spend quota.
  app.get("/api/health/qloo", async (_request, reply) => {
    try {
      const readiness = await qloo.capabilities();
      return reply.code(readiness.ready ? 200 : 503).send({ ready: readiness.ready, tools: readiness.toolCount });
    } catch (error) {
      app.log.error(error, "qloo capabilities failed");
      return reply.code(503).send({ ready: false, error: "Qloo harness unavailable" });
    }
  });

  // One real, cached Qloo request: proves the key and the hackathon base URL work in this deployment.
  app.get("/api/health/qloo/live", async (_request, reply) => {
    const envelope = await qloo.call("qloo_describe", { entity: "Patsy Cline", type: "artist" }, { scope: "health" });
    const ok = envelope.status === "ok";
    return reply.code(ok ? 200 : 503).send({ status: envelope.status, ...(envelope.error ? { error: envelope.error.code } : {}) });
  });

  app.post("/api/intake/resolve", async (request, reply) => {
    const parsed = ResolveBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues.map((issue) => issue.message) });
    const scope = `intake-${randomUUID()}`;
    const results = await Promise.all(parsed.data.items.map((item) => resolveFavorite(qloo, item.text, item.kind, scope)));
    return { results, whatQlooSaw: store.requestsFor(scope) };
  });

  app.post("/api/memory-box", async (request, reply) => {
    const parsed = MemoryBoxBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues.map((issue) => issue.message) });
    const scope = `box-${randomUUID()}`;
    const box = await buildMemoryBox(qloo, parsed.data, scope);
    return { ...box, whatQlooSaw: store.requestsFor(scope) };
  });

  return app;
}

import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import type { QlooClient } from "../qloo/client.js";

export interface AppDeps {
  qloo: QlooClient;
  rateLimitPerMinute: number;
  logger?: boolean;
}

export async function buildApp({ qloo, rateLimitPerMinute, logger = true }: AppDeps): Promise<FastifyInstance> {
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

  return app;
}

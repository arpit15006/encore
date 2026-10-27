import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { DEMO_RESIDENTS } from "../encore/demoResidents.js";
import { FAVORITE_TYPES, resolveFavorite, type FavoriteKind } from "../encore/intake.js";
import { interpretStory } from "../encore/interpret.js";
import type { EncoreService } from "../encore/service.js";
import { LANGUAGES, type Language } from "../encore/starters.js";
import type { JsonModel } from "../llm.js";
import type { QlooClient } from "../qloo/client.js";
import type { QlooStore } from "../qloo/store.js";

export interface AppDeps {
  qloo: QlooClient;
  store: Pick<QlooStore, "requestsFor">;
  rateLimitPerMinute: number;
  /** Product features (residents, reactions, Visit Kits, comparison). Health checks work without it. */
  service?: EncoreService;
  model?: JsonModel;
  /** Aggregate evaluation results (JSON) to publish at /api/evaluation. */
  evaluationFile?: string;
  /** Built web app to serve (production). Omitted in development, where Vite serves it. */
  webDist?: string;
  logger?: boolean;
}

const currentYear = new Date().getFullYear();
const kinds = Object.keys(FAVORITE_TYPES) as [FavoriteKind, ...FavoriteKind[]];
const languages = Object.keys(LANGUAGES) as [Language, ...Language[]];

const ResolveBody = z.object({
  items: z.array(z.object({ text: z.string().trim().min(1).max(120), kind: z.enum(kinds) })).min(1).max(10),
});
const InterpretBody = z.object({ text: z.string().trim().min(10).max(2000) });

// No name, address or health fields exist: a birth year, places, and confirmed Qloo entities.
const ResidentBody = z.object({
  birthYear: z.number().int().min(1915).max(currentYear - 40),
  grewUp: z.string().trim().min(1).max(80).optional(),
  livesIn: z.string().trim().min(1).max(80).optional(),
  favorites: z.array(z.object({ entityId: z.string().uuid(), name: z.string().trim().min(1).max(120), kind: z.enum(kinds) })).min(1).max(10),
});
const ItemSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().max(200),
  kind: z.enum(["music", "films", "tv"]),
  qloo: z.object({ notableSongs: z.array(z.string().max(200)).max(5).optional() }).passthrough(),
  interpretation: z.object({ year: z.number().int().nullable() }).passthrough(),
});
const ReactionBody = z.object({ value: z.enum(["lit_up", "calm", "none", "distressed"]), item: ItemSchema });
const ExclusionBody = z.object({ target: z.string().min(3).max(200), kind: z.enum(["entity", "tag"]), label: z.string().trim().min(1).max(120) });
const KitBody = z.object({ language: z.enum(languages).default("en") });
const AskBody = z.object({ question: z.string().trim().min(3).max(300) });
const Id = z.object({ id: z.string().uuid() });

/** Public, slow-changing answers: browsers and proxies may reuse them for five minutes. */
const PUBLIC_CACHE = "public, max-age=300";

const invalid = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({ error: "invalid_request", issues: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) });
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found" });

export async function buildApp({ qloo, store, rateLimitPerMinute, service, model, evaluationFile, webDist, logger = true }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger, trustProxy: true });
  // Public visitors share one Qloo quota with the judges, so API routes are rate-limited per IP.
  // Pages, scripts and fonts are not: a single page load makes several of those requests.
  await app.register(rateLimit, {
    max: rateLimitPerMinute,
    timeWindow: "1 minute",
    allowList: (request) => !request.url.startsWith("/api/"),
  });

  // Unexpected failures are logged in full but never shown to visitors (no provider messages, no keys).
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 429) return reply.code(429).send({ error: "rate_limited" });
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: "bad_request" });
    request.log.error(error, "request failed");
    return reply.code(500).send({ error: "server_error" });
  });

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
    if (!parsed.success) return invalid(reply, parsed.error);
    const scope = `intake-${randomUUID()}`;
    const results = await Promise.all(parsed.data.items.map((item) => resolveFavorite(qloo, item.text, item.kind, scope)));
    return { results, whatQlooSaw: store.requestsFor(scope) };
  });

  // The model reads the family's words; Qloo never sees them. Everything extracted is shown for editing.
  app.post("/api/intake/interpret", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = InterpretBody.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error);
    if (!model) return reply.code(503).send({ error: "model_unavailable" });
    const story = await interpretStory(model, parsed.data.text);
    return story ? story : reply.code(502).send({ error: "model_failed" });
  });

  app.get("/api/demo-residents", async (_request, reply) => {
    reply.header("Cache-Control", PUBLIC_CACHE);
    return DEMO_RESIDENTS.map(({ id, label, birthYear, grewUp, favorites }) => ({ id, label, birthYear, grewUp, favorites }));
  });

  if (service) {
    app.post("/api/residents", async (request, reply) => {
      const parsed = ResidentBody.safeParse(request.body);
      if (!parsed.success) return invalid(reply, parsed.error);
      const resident = service.createResident(parsed.data);
      return reply.code(201).send({ id: resident.id });
    });

    app.post("/api/residents/from-demo/:demoId", async (request, reply) => {
      const resident = service.copyDemoResident((request.params as { demoId: string }).demoId);
      return resident ? reply.code(201).send({ id: resident.id }) : notFound(reply);
    });

    app.get("/api/residents/:id", async (request, reply) => {
      const params = Id.safeParse(request.params);
      if (!params.success) return notFound(reply);
      return service.view(params.data.id) ?? notFound(reply);
    });

    app.get("/api/residents/:id/memory-box", async (request, reply) => {
      const params = Id.safeParse(request.params);
      if (!params.success) return notFound(reply);
      return (await service.memoryBox(params.data.id)) ?? notFound(reply);
    });

    app.post("/api/residents/:id/reactions", async (request, reply) => {
      const params = Id.safeParse(request.params);
      const body = ReactionBody.safeParse(request.body);
      if (!params.success) return notFound(reply);
      if (!body.success) return invalid(reply, body.error);
      const item = body.data.item as unknown as Parameters<EncoreService["react"]>[1]["item"];
      const result = await service.react(params.data.id, { entityId: item.entityId, value: body.data.value, item });
      return result ?? notFound(reply);
    });

    app.post("/api/residents/:id/exclusions", async (request, reply) => {
      const params = Id.safeParse(request.params);
      const body = ExclusionBody.safeParse(request.body);
      if (!params.success) return notFound(reply);
      if (!body.success) return invalid(reply, body.error);
      return service.addExclusion(params.data.id, body.data) ? reply.code(204).send() : notFound(reply);
    });

    app.delete("/api/residents/:id/exclusions/:target", async (request, reply) => {
      const params = Id.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const target = decodeURIComponent((request.params as { target: string }).target);
      return service.removeExclusion(params.data.id, target) ? reply.code(204).send() : notFound(reply);
    });

    app.get("/api/residents/:id/compare", async (request, reply) => {
      const params = Id.safeParse(request.params);
      if (!params.success) return notFound(reply);
      return (await service.compare(params.data.id)) ?? notFound(reply);
    });

    app.post("/api/residents/:id/visit-kits", async (request, reply) => {
      const params = Id.safeParse(request.params);
      const body = KitBody.safeParse(request.body ?? {});
      if (!params.success) return notFound(reply);
      if (!body.success) return invalid(reply, body.error);
      const kit = await service.createVisitKit(params.data.id, body.data.language);
      return kit ? reply.code(201).send(kit) : notFound(reply);
    });

    app.post("/api/residents/:id/visit-kits/:hint/revoke", async (request, reply) => {
      const params = Id.safeParse(request.params);
      if (!params.success) return notFound(reply);
      const hint = (request.params as { hint: string }).hint;
      return service.revokeVisitKit(params.data.id, hint) ? reply.code(204).send() : notFound(reply);
    });

    // Public, by unguessable token. Expired and revoked kits are indistinguishable from missing ones.
    app.get("/api/visit-kits/:token", async (request, reply) => {
      const token = (request.params as { token: string }).token;
      if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return notFound(reply);
      return service.visitKit(token) ?? notFound(reply);
    });

    // The agent calls Groq and Qloo several times per question, so it gets a tighter limit.
    app.post("/api/residents/:id/ask", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (request, reply) => {
      const params = Id.safeParse(request.params);
      const body = AskBody.safeParse(request.body);
      if (!params.success) return notFound(reply);
      if (!body.success) return invalid(reply, body.error);
      return (await service.ask(params.data.id, body.data.question)) ?? notFound(reply);
    });

    // The same for every visitor and slow to compute on a small CPU, so it is built once and reused.
    let groupPlan: { at: number; plan: Promise<unknown> } | undefined;
    app.get("/api/group-session", async (_request, reply) => {
      if (!groupPlan || Date.now() - groupPlan.at > 10 * 60_000) {
        const plan = service.groupSession();
        groupPlan = { at: Date.now(), plan };
        plan.catch(() => (groupPlan = undefined));
      }
      reply.header("Cache-Control", PUBLIC_CACHE);
      return groupPlan.plan;
    });
  }

  const evaluation = evaluationFile && existsSync(evaluationFile) ? JSON.parse(readFileSync(evaluationFile, "utf8")) : undefined;
  app.get("/api/evaluation", async (_request, reply) => {
    if (!evaluation) return reply.code(404).send({ error: "not_available" });
    reply.header("Cache-Control", PUBLIC_CACHE);
    return evaluation;
  });

  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      // The build writes .br and .gz copies, so nothing is compressed per request on a small CPU.
      preCompressed: true,
      // Hashed assets never change; the page itself is always revalidated so a deploy shows at once.
      setHeaders: (reply, filePath) =>
        reply.header("Cache-Control", /[\\/]assets[\\/]/.test(filePath) ? "public, max-age=31536000, immutable" : "no-cache"),
    });
    // Client-side routes load the app. Missing files (anything with an extension) and unknown API
    // paths stay 404, so a broken asset never comes back as HTML.
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split("?")[0] ?? "";
      const isAppRoute = request.method === "GET" && !path.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(path);
      if (isAppRoute) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not_found" });
    });
  }

  return app;
}

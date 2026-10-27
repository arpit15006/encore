import { fileURLToPath } from "node:url";
import { EncoreAgent } from "./agent/loop.js";
import { loadConfig } from "./config.js";
import { EncoreService } from "./encore/service.js";
import { buildApp } from "./http/app.js";
import { GroqJsonModel } from "./llm.js";
import { QlooClient } from "./qloo/client.js";
import { QlooStore } from "./qloo/store.js";
import { AppStore } from "./store/appStore.js";

const config = loadConfig();
const qlooStore = new QlooStore(config.DATA_DIR);
const appStore = new AppStore(config.DATA_DIR);
const qloo = new QlooClient(qlooStore);
const model = new GroqJsonModel(config.GROQ_API_KEY, config.GROQ_MODEL, appStore);
const agent = new EncoreAgent(qloo, config.GROQ_API_KEY, config.GROQ_MODEL);
const service = new EncoreService(qloo, qlooStore, appStore, model, agent);

const app = await buildApp({
  qloo,
  store: qlooStore,
  service,
  model,
  rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE,
  evaluationFile: fileURLToPath(new URL("../../eval/results.json", import.meta.url)),
  webDist: fileURLToPath(new URL("../../web/dist", import.meta.url)),
});

// Readiness at boot, per the kit's backend pattern. A missing credential is logged, not fatal,
// so the health endpoint can report it.
try {
  const readiness = await qloo.capabilities();
  app.log.info({ ready: readiness.ready, tools: readiness.toolCount }, "qloo mcp connected");
} catch (error) {
  app.log.error(error, "qloo mcp failed to start");
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await qloo.close();
  qlooStore.close();
  appStore.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: config.PORT, host: config.HOST });

// Load the harness for raw Insights calls now, so the first visitor doesn't wait for it.
void qloo.warm();

// Warm every demo resident's Qloo and model answers in the background. With a persistent volume
// this costs Qloo quota once; afterwards judges are always served from cache.
if (config.PREWARM) {
  service.prewarm((message) => app.log.info(message)).catch((error) => app.log.error(error, "prewarm failed"));
}

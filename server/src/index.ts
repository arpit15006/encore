import { loadConfig } from "./config.js";
import { buildApp } from "./http/app.js";
import { QlooClient } from "./qloo/client.js";
import { QlooStore } from "./qloo/store.js";

const config = loadConfig();
const store = new QlooStore(config.DATA_DIR);
const qloo = new QlooClient(store);
const app = await buildApp({ qloo, store, rateLimitPerMinute: config.RATE_LIMIT_PER_MINUTE });

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
  store.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: config.PORT, host: config.HOST });

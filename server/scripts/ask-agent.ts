// Local check of the agent loop: npm run agent --workspace server -- "your question"
import { EncoreAgent } from "../src/agent/loop.js";
import { loadConfig } from "../src/config.js";
import { QlooClient } from "../src/qloo/client.js";
import { QlooStore } from "../src/qloo/store.js";

const question = process.argv.slice(2).join(" ") || "Someone born in 1945 who grew up in Detroit loved Marvin Gaye. Suggest 5 artists they likely knew.";
const config = loadConfig();
const store = new QlooStore(config.DATA_DIR);
const qloo = new QlooClient(store);
const agent = new EncoreAgent(qloo, config.GROQ_API_KEY, config.GROQ_MODEL);

try {
  const scope = `cli-${Date.now()}`;
  const result = await agent.ask(question, scope);
  console.log("\nSteps:");
  for (const step of result.steps) console.log(`  ${step.tool} ${JSON.stringify(step.args)} -> ${step.status} (${step.resultCount})`);
  console.log(`\nWhat Qloo saw:\n${store.requestsFor(scope).map((r) => `  ${r.tool} ${JSON.stringify(r.args)}${r.cacheHit ? " [cache]" : ""}`).join("\n")}`);
  console.log(`\nAnswer:\n${result.answer}`);
} finally {
  await qloo.close();
  store.close();
}

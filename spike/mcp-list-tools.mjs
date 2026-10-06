// Spike helper: start `qloo mcp` over stdio and print each tool's input schema.
// tools/list makes no Qloo data request, so it costs no quota.
import { spawn } from "node:child_process";

const child = spawn("qloo", ["mcp"], { env: process.env, stdio: ["pipe", "pipe", "inherit"] });
let buffer = "";
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    pending.get(message.id)?.(message);
  }
});

function request(id, method, params = {}) {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

await request(1, "initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "encore-spike", version: "0.0.1" },
});
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const { result } = await request(2, "tools/list");
for (const tool of result.tools) {
  console.log(`\n=== ${tool.name} ===\n${tool.description}\n${JSON.stringify(tool.inputSchema, null, 1)}`);
}
child.kill();

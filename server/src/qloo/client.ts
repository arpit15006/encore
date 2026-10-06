import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeEnvelope, isCacheable, shouldRetry, type QlooEnvelope } from "./envelope.js";
import type { QlooStore } from "./store.js";

/** The Qloo MCP tools Encore uses, each with a documented job. `qloo_trends` has no job yet, so it is not exposed. */
export const QLOO_TOOLS = [
  "qloo_describe",
  "qloo_find_tags",
  "qloo_recommend",
  "qloo_rank",
  "qloo_where_popular",
  "qloo_audience_demographics",
  "qloo_compare_audiences",
  "qloo_entity_tags",
] as const;
export type QlooToolName = (typeof QLOO_TOOLS)[number];

export interface QlooReadiness {
  ready: boolean;
  toolCount: number;
  detail: unknown;
}

export interface QlooCallOptions {
  /** Groups requests for the "What Qloo sees" panel (e.g. one resident's Memory Box). */
  scope: string;
}

const MAX_RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Talks to Qloo only through the kit's `qloo mcp` stdio server.
 * Every call is cached, logged exactly as sent, and normalized to one of six statuses.
 */
export class QlooClient {
  private client: Client | undefined;
  private connecting: Promise<Client> | undefined;
  private tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];

  constructor(private readonly store: QlooStore) {}

  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    this.connecting ??= (async () => {
      // The SDK forwards only a few variables by default; QLOO_API_KEY and QLOO_HOME must reach the harness.
      const transport = new StdioClientTransport({ command: "qloo", args: ["mcp"], env: process.env as Record<string, string> });
      const client = new Client({ name: "encore-server", version: "0.1.0" });
      transport.onclose = () => {
        this.client = undefined;
      };
      try {
        await client.connect(transport);
      } catch (error) {
        throw (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error("Cannot start `qloo`. Install it with: npm install --global @qloo/qloo-harness")
          : error;
      }
      this.tools = (await client.listTools()).tools;
      this.client = client;
      return client;
    })().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  /** Readiness check from the kit; it does not contact Qloo or use quota. */
  async capabilities(): Promise<QlooReadiness> {
    const client = await this.connect();
    const result = await client.callTool({ name: "qloo_capabilities", arguments: {} });
    const detail = result.structuredContent ?? {};
    const adapter = (detail as { adapter?: { ready?: boolean } }).adapter;
    return { ready: adapter?.ready === true, toolCount: this.tools.length, detail };
  }

  /** MCP tool definitions for the agent, limited to the tools Encore uses. */
  async toolDefinitions() {
    await this.connect();
    return this.tools.filter((tool) => (QLOO_TOOLS as readonly string[]).includes(tool.name));
  }

  async call<T = unknown>(tool: QlooToolName, args: Record<string, unknown>, options: QlooCallOptions): Promise<QlooEnvelope<T>> {
    const cached = this.store.getCached(tool, args);
    if (cached !== undefined) {
      const envelope = normalizeEnvelope<T>(cached);
      this.store.logRequest({ scope: options.scope, tool, args, status: envelope.status, cacheHit: true });
      return envelope;
    }

    let envelope: QlooEnvelope<T> = normalizeEnvelope<T>(undefined);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
      envelope = await this.callOnce<T>(tool, args);
      if (!shouldRetry(envelope)) break;
    }

    this.store.logRequest({ scope: options.scope, tool, args, status: envelope.status, cacheHit: false });
    if (isCacheable(envelope)) this.store.putCached(tool, args, envelope.raw, envelope.status);
    return envelope;
  }

  private async callOnce<T>(tool: QlooToolName, args: Record<string, unknown>): Promise<QlooEnvelope<T>> {
    try {
      const client = await this.connect();
      const result = await client.callTool({ name: tool, arguments: args });
      return normalizeEnvelope<T>(result.structuredContent);
    } catch (error) {
      // A crashed or unreachable harness is retryable; the next attempt reconnects.
      return normalizeEnvelope<T>({
        status: "error",
        summary: error instanceof Error ? error.message : String(error),
        error: { code: "TRANSPORT", retryable: true },
      });
    }
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
  }
}

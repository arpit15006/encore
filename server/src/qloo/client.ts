import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { normalizeEnvelope, isCacheable, shouldRetry, type QlooEnvelope } from "./envelope.js";
import { InsightsWorker, WorkerUnavailable } from "./insightsWorker.js";
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
const execFileAsync = promisify(execFile);
/** Generous, because a small host (0.1 CPU) is slow; failures are never cached, so a timeout costs a retry. */
const INSIGHTS_TIMEOUT_MS = 120_000;

/** Entity types Encore requests from the Insights API. */
export type InsightsType = "artist" | "movie" | "tv_show" | "book" | "person";

export interface InsightsRequest {
  type: InsightsType;
  signalIds: string[];
  take: number;
  /** Raw Insights parameters, e.g. `filter.release_year.min` or `feature.explainability`. */
  params?: Record<string, string | number | boolean>;
}

/** The parts of a Qloo entity Encore reads. Qloo returns more; unknown fields are ignored. */
export interface QlooEntity {
  entity_id: string;
  name: string;
  popularity?: number;
  properties?: Record<string, unknown>;
  query?: {
    affinity?: number;
    explainability?: { "signal.interests.entities"?: Array<{ entity_id: string; score: number }> };
  };
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Talks to Qloo only through the kit's `qloo mcp` stdio server.
 * Every call is cached, logged exactly as sent, and normalized to one of six statuses.
 */
export class QlooClient {
  private client: Client | undefined;
  private readonly worker = new InsightsWorker();
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
    return this.execute<T>(tool, args, options, () => this.callOnce<T>(tool, args));
  }

  /**
   * Raw Insights request through the harness (`qloo api insights --params`), for parameters the
   * workflows don't expose: release-year windows, explainability, larger result pages.
   */
  async insights<T = QlooEntity>(request: InsightsRequest, options: QlooCallOptions): Promise<QlooEnvelope<T>> {
    const args = { type: request.type, signals: request.signalIds, take: request.take, params: request.params ?? {} };
    return this.execute<T>("insights", args, options, () => this.insightsOnce<T>(request));
  }

  /** Shared path for every Qloo request: cache, bounded retries, request log. */
  private async execute<T>(
    tool: string,
    args: Record<string, unknown>,
    options: QlooCallOptions,
    once: () => Promise<QlooEnvelope<T>>,
  ): Promise<QlooEnvelope<T>> {
    const cached = this.store.getCached(tool, args);
    if (cached !== undefined) {
      const envelope = normalizeEnvelope<T>(cached);
      this.store.logRequest({ scope: options.scope, tool, args, status: envelope.status, cacheHit: true });
      return envelope;
    }

    let envelope: QlooEnvelope<T> = normalizeEnvelope<T>(undefined);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
      envelope = await once();
      if (!shouldRetry(envelope)) break;
    }

    this.store.logRequest({ scope: options.scope, tool, args, status: envelope.status, cacheHit: false });
    if (isCacheable(envelope)) this.store.putCached(tool, args, envelope.raw, envelope.status);
    return envelope;
  }

  private async insightsOnce<T>(request: InsightsRequest): Promise<QlooEnvelope<T>> {
    const cliArgs = ["api", "insights", "-t", request.type, "-s", request.signalIds.join(","), "-n", String(request.take)];
    cliArgs.push("--params", JSON.stringify(request.params ?? {}), "--json");
    try {
      const stdout = await this.runApi(cliArgs);
      const parsed: unknown = JSON.parse(stdout);
      // The raw endpoint returns a bare list of entities; wrap it in the kit's envelope shape.
      if (Array.isArray(parsed)) return normalizeEnvelope<T>({ status: "ok", results: parsed, result_count: parsed.length });
      return normalizeEnvelope<T>(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Never echo the API key, even if the CLI includes it in an error.
      const summary = (process.env.QLOO_API_KEY ? message.split(process.env.QLOO_API_KEY).join("<redacted>") : message).slice(0, 300);
      return normalizeEnvelope<T>({
        status: "error",
        summary,
        error: { code: "INSIGHTS_FAILED", retryable: /429|5\d\d|timed? ?out|ETIMEDOUT|ECONNRESET/i.test(message) },
      });
    }
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

  /** Loads the harness for raw Insights calls ahead of the first request. */
  warm(): Promise<void> {
    return this.worker.start().catch(() => undefined);
  }

  /** `qloo api …` inside the long-lived worker; if the worker itself fails, the CLI is run directly. */
  private async runApi(cliArgs: string[]): Promise<string> {
    try {
      return await this.worker.run(cliArgs, INSIGHTS_TIMEOUT_MS);
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error;
      const { stdout } = await execFileAsync("qloo", cliArgs, { env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: INSIGHTS_TIMEOUT_MS });
      return stdout;
    }
  }

  async close(): Promise<void> {
    this.worker.close();
    await this.client?.close();
    this.client = undefined;
  }
}

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Stable JSON: object keys sorted at every level, so equal requests produce equal cache keys. */
export function canonicalJson(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, sort(v)]),
      );
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

export function requestKey(tool: string, args: unknown): string {
  return createHash("sha256").update(`${tool}\n${canonicalJson(args)}`).digest("hex");
}

export interface LoggedRequest {
  at: string;
  scope: string;
  tool: string;
  /** Exactly the arguments sent to Qloo (or that would have been sent, on a cache hit). */
  args: unknown;
  status: string;
  cacheHit: boolean;
}

/**
 * SQLite-backed cache of Qloo responses plus a log of what was sent to Qloo.
 * The log is the only source for the "What Qloo sees" panel, so the panel can never drift from reality.
 */
export class QlooStore {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    if (dataDir !== ":memory:") mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(dataDir === ":memory:" ? ":memory:" : join(dataDir, "encore.sqlite"));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS qloo_cache (
        request_key TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        args_json TEXT NOT NULL,
        response_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS qloo_request_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        scope TEXT NOT NULL,
        tool TEXT NOT NULL,
        args_json TEXT NOT NULL,
        status TEXT NOT NULL,
        cache_hit INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS qloo_request_log_scope ON qloo_request_log (scope, id);
    `);
  }

  getCached(tool: string, args: unknown): unknown | undefined {
    const row = this.db.prepare("SELECT response_json FROM qloo_cache WHERE request_key = ?").get(requestKey(tool, args)) as
      | { response_json: string }
      | undefined;
    return row ? JSON.parse(row.response_json) : undefined;
  }

  putCached(tool: string, args: unknown, response: unknown, status: string): void {
    this.db
      .prepare(
        `INSERT INTO qloo_cache (request_key, tool, args_json, response_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(request_key) DO UPDATE SET response_json = excluded.response_json, status = excluded.status, created_at = excluded.created_at`,
      )
      .run(requestKey(tool, args), tool, canonicalJson(args), JSON.stringify(response), status, new Date().toISOString());
  }

  logRequest(entry: Omit<LoggedRequest, "at">): void {
    this.db
      .prepare("INSERT INTO qloo_request_log (at, scope, tool, args_json, status, cache_hit) VALUES (?, ?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), entry.scope, entry.tool, canonicalJson(entry.args), entry.status, entry.cacheHit ? 1 : 0);
  }

  requestsFor(scope: string): LoggedRequest[] {
    const rows = this.db
      .prepare("SELECT at, scope, tool, args_json, status, cache_hit FROM qloo_request_log WHERE scope = ? ORDER BY id")
      .all(scope) as Array<{ at: string; scope: string; tool: string; args_json: string; status: string; cache_hit: number }>;
    return rows.map((row) => ({
      at: row.at,
      scope: row.scope,
      tool: row.tool,
      args: JSON.parse(row.args_json),
      status: row.status,
      cacheHit: row.cache_hit === 1,
    }));
  }

  close(): void {
    this.db.close();
  }
}

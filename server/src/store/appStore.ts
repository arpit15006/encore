import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FavoriteKind } from "../encore/intake.js";

/** A person Encore plans for. There is deliberately no name field. */
export interface Resident {
  id: string;
  birthYear: number;
  grewUp?: string;
  /** Where they live now (city only). Used only by the "naive Qloo" comparison column. */
  livesIn?: string;
  /** Set when the resident was copied from a fictional demo resident. */
  demoId?: string;
  createdAt: string;
}

export interface StoredFavorite {
  entityId: string;
  name: string;
  kind: FavoriteKind;
  source: "family" | "learned";
}

export type ReactionValue = "lit_up" | "calm" | "none" | "distressed";

/** A reaction keeps a snapshot of the item so pinned favorites render without new Qloo calls. */
export interface Reaction {
  entityId: string;
  value: ReactionValue;
  item: { name: string; kind: "music" | "films" | "tv"; year: number | null; notableSongs?: string[] };
  at: string;
}

export interface Exclusion {
  /** An entity ID or a Qloo tag URN. */
  target: string;
  kind: "entity" | "tag";
  label: string;
}

export interface VisitKitRecord {
  token: string;
  residentId: string;
  language: string;
  content: unknown;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

const KIT_DAYS = 30;

/**
 * Encore's own data: residents, reactions (behavioral data that never leaves this database),
 * exclusions, Visit Kits and cached model answers.
 */
export class AppStore {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    if (dataDir !== ":memory:") mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(dataDir === ":memory:" ? ":memory:" : join(dataDir, "app.sqlite"));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resident (
        id TEXT PRIMARY KEY, birth_year INTEGER NOT NULL, grew_up TEXT, lives_in TEXT, demo_id TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS favorite (
        resident_id TEXT NOT NULL, entity_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL,
        PRIMARY KEY (resident_id, entity_id)
      );
      CREATE TABLE IF NOT EXISTS reaction (
        resident_id TEXT NOT NULL, entity_id TEXT NOT NULL, value TEXT NOT NULL, item_json TEXT NOT NULL, at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS exclusion (
        resident_id TEXT NOT NULL, target TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
        PRIMARY KEY (resident_id, target)
      );
      CREATE TABLE IF NOT EXISTS visit_kit (
        token_hash TEXT PRIMARY KEY, resident_id TEXT NOT NULL, language TEXT NOT NULL, content_json TEXT NOT NULL,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, token_hint TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, response_json TEXT NOT NULL, created_at TEXT NOT NULL);
    `);
  }

  createResident(input: { birthYear: number; grewUp?: string; livesIn?: string; demoId?: string; favorites: Array<Omit<StoredFavorite, "source">> }): Resident {
    const resident: Resident = {
      id: randomUUID(),
      birthYear: input.birthYear,
      ...(input.grewUp ? { grewUp: input.grewUp } : {}),
      ...(input.livesIn ? { livesIn: input.livesIn } : {}),
      ...(input.demoId ? { demoId: input.demoId } : {}),
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO resident (id, birth_year, grew_up, lives_in, demo_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(resident.id, resident.birthYear, resident.grewUp ?? null, resident.livesIn ?? null, resident.demoId ?? null, resident.createdAt);
    for (const favorite of input.favorites) this.addFavorite(resident.id, { ...favorite, source: "family" });
    return resident;
  }

  getResident(id: string): Resident | undefined {
    const row = this.db.prepare("SELECT * FROM resident WHERE id = ?").get(id) as
      | { id: string; birth_year: number; grew_up: string | null; lives_in: string | null; demo_id: string | null; created_at: string }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      birthYear: row.birth_year,
      ...(row.grew_up ? { grewUp: row.grew_up } : {}),
      ...(row.lives_in ? { livesIn: row.lives_in } : {}),
      ...(row.demo_id ? { demoId: row.demo_id } : {}),
      createdAt: row.created_at,
    };
  }

  addFavorite(residentId: string, favorite: StoredFavorite): void {
    this.db
      .prepare("INSERT OR IGNORE INTO favorite (resident_id, entity_id, name, kind, source) VALUES (?, ?, ?, ?, ?)")
      .run(residentId, favorite.entityId, favorite.name, favorite.kind, favorite.source);
  }

  removeFavorite(residentId: string, entityId: string): void {
    this.db.prepare("DELETE FROM favorite WHERE resident_id = ? AND entity_id = ?").run(residentId, entityId);
  }

  favorites(residentId: string): StoredFavorite[] {
    return (this.db.prepare("SELECT entity_id, name, kind, source FROM favorite WHERE resident_id = ? ORDER BY rowid").all(residentId) as Array<{
      entity_id: string;
      name: string;
      kind: FavoriteKind;
      source: StoredFavorite["source"];
    }>).map((row) => ({ entityId: row.entity_id, name: row.name, kind: row.kind, source: row.source }));
  }

  addReaction(residentId: string, reaction: Omit<Reaction, "at">): Reaction {
    const at = new Date().toISOString();
    this.db
      .prepare("INSERT INTO reaction (resident_id, entity_id, value, item_json, at) VALUES (?, ?, ?, ?, ?)")
      .run(residentId, reaction.entityId, reaction.value, JSON.stringify(reaction.item), at);
    return { ...reaction, at };
  }

  reactions(residentId: string): Reaction[] {
    return (this.db.prepare("SELECT entity_id, value, item_json, at FROM reaction WHERE resident_id = ? ORDER BY rowid").all(residentId) as Array<{
      entity_id: string;
      value: ReactionValue;
      item_json: string;
      at: string;
    }>).map((row) => ({ entityId: row.entity_id, value: row.value, item: JSON.parse(row.item_json), at: row.at }));
  }

  addExclusion(residentId: string, exclusion: Exclusion): void {
    this.db
      .prepare("INSERT OR REPLACE INTO exclusion (resident_id, target, kind, label) VALUES (?, ?, ?, ?)")
      .run(residentId, exclusion.target, exclusion.kind, exclusion.label);
  }

  removeExclusion(residentId: string, target: string): void {
    this.db.prepare("DELETE FROM exclusion WHERE resident_id = ? AND target = ?").run(residentId, target);
  }

  exclusions(residentId: string): Exclusion[] {
    return this.db.prepare("SELECT target, kind, label FROM exclusion WHERE resident_id = ? ORDER BY rowid").all(residentId) as unknown as Exclusion[];
  }

  /**
   * Creates a Visit Kit and returns its token. Only a hash of the token is stored, so the link
   * can't be reconstructed from the database; the token itself is 192 random bits.
   */
  createVisitKit(residentId: string, language: string, content: unknown): VisitKitRecord {
    const token = randomBytes(24).toString("base64url");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + KIT_DAYS * 24 * 60 * 60 * 1000);
    this.db
      .prepare("INSERT INTO visit_kit (token_hash, resident_id, language, content_json, created_at, expires_at, token_hint) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(hashToken(token), residentId, language, JSON.stringify(content), createdAt.toISOString(), expiresAt.toISOString(), token.slice(0, 6));
    return { token, residentId, language, content, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString(), revoked: false };
  }

  /** Returns the kit only while it is valid; expired and revoked kits look the same as missing ones. */
  getVisitKit(token: string, now = new Date()): VisitKitRecord | undefined {
    const row = this.db.prepare("SELECT * FROM visit_kit WHERE token_hash = ?").get(hashToken(token)) as
      | { resident_id: string; language: string; content_json: string; created_at: string; expires_at: string; revoked: number }
      | undefined;
    if (!row || row.revoked || new Date(row.expires_at) <= now) return undefined;
    return {
      token,
      residentId: row.resident_id,
      language: row.language,
      content: JSON.parse(row.content_json),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revoked: false,
    };
  }

  visitKitsFor(residentId: string): Array<{ hint: string; language: string; createdAt: string; expiresAt: string; revoked: boolean }> {
    return (this.db
      .prepare("SELECT token_hint, language, created_at, expires_at, revoked FROM visit_kit WHERE resident_id = ? ORDER BY created_at DESC")
      .all(residentId) as Array<{ token_hint: string; language: string; created_at: string; expires_at: string; revoked: number }>).map((row) => ({
      hint: row.token_hint,
      language: row.language,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revoked: row.revoked === 1,
    }));
  }

  /** Revokes every Visit Kit for a resident whose token starts with the given hint. */
  revokeVisitKit(residentId: string, hint: string): boolean {
    const result = this.db.prepare("UPDATE visit_kit SET revoked = 1 WHERE resident_id = ? AND token_hint = ?").run(residentId, hint);
    return Number(result.changes) > 0;
  }

  getLlmCache(key: string): unknown | undefined {
    const row = this.db.prepare("SELECT response_json FROM llm_cache WHERE key = ?").get(key) as { response_json: string } | undefined;
    return row ? JSON.parse(row.response_json) : undefined;
  }

  putLlmCache(key: string, response: unknown): void {
    this.db
      .prepare("INSERT OR REPLACE INTO llm_cache (key, response_json, created_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(response), new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

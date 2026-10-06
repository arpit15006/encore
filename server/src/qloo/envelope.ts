/**
 * The Qloo kit's normalized result envelope, and the rules for reading it.
 * Every Qloo call in Encore goes through `normalizeEnvelope`, so each of the six statuses
 * is handled explicitly and the UI can show the right state.
 */

export type QlooStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";

export interface QlooError {
  code: string;
  retryable: boolean;
  recovery?: string;
}

export interface QlooEnvelope<T = unknown> {
  status: QlooStatus;
  summary?: string;
  results: T[];
  resultCount: number;
  error?: QlooError;
  /** Resolution details (matches and alternatives), used for the "did you mean?" screen. */
  resolution?: unknown;
  /** The raw envelope, kept for provenance and debugging. */
  raw: Record<string, unknown>;
}

const STATUSES: readonly QlooStatus[] = ["ok", "empty", "needs_input", "partial", "degraded", "error"];

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readError(value: unknown): QlooError {
  const error = asRecord(value);
  return {
    code: typeof error.code === "string" ? error.code : "UNKNOWN",
    retryable: error.retryable === true,
    ...(typeof error.recovery === "string" ? { recovery: error.recovery } : {}),
  };
}

export function normalizeEnvelope<T = unknown>(input: unknown): QlooEnvelope<T> {
  const raw = asRecord(input);
  const results = Array.isArray(raw.results) ? (raw.results as T[]) : [];
  const resultCount = typeof raw.result_count === "number" ? raw.result_count : results.length;
  const summary = typeof raw.summary === "string" ? raw.summary : undefined;
  const base = { results, resultCount, raw, ...(summary ? { summary } : {}), ...(raw.resolution ? { resolution: raw.resolution } : {}) };

  const status = STATUSES.find((candidate) => candidate === raw.status);
  if (!status) {
    return { ...base, status: "error", error: readError({ code: "MALFORMED_ENVELOPE", ...asRecord(raw.error) }) };
  }
  if (status === "error") {
    return { ...base, status, error: readError(raw.error) };
  }
  // Qloo sometimes answers "ok" with zero results (seen in the day-one spike); that is an empty state.
  if (status === "ok" && results.length === 0) {
    return { ...base, status: "empty" };
  }
  return { ...base, status };
}

/** Only errors that Qloo marks retryable are retried. */
export function shouldRetry(envelope: QlooEnvelope): boolean {
  return envelope.status === "error" && envelope.error?.retryable === true;
}

/** Errors are never cached; every other status is a stable answer for the same request. */
export function isCacheable(envelope: QlooEnvelope): boolean {
  return envelope.status !== "error";
}

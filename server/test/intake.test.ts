import { describe, expect, it } from "vitest";
import { resolveFavorite } from "../src/encore/intake.js";
import type { QlooClient } from "../src/qloo/client.js";
import { normalizeEnvelope } from "../src/qloo/envelope.js";

const selected = { id: "a", name: "Patsy Cline", description: "Country singer" };
const alternatives = [{ id: "b", name: "Nels Cline" }];

function describeReturning(raw: unknown): QlooClient {
  return { call: async () => normalizeEnvelope(raw) } as unknown as QlooClient;
}

const outcome = (match: string, status = "resolved") => ({ resolution: { outcomes: [{ status, match, selected, alternatives }] } });

describe("resolveFavorite", () => {
  it("uses an exact match directly", async () => {
    const result = await resolveFavorite(describeReturning({ status: "ok", results: [{}], ...outcome("exact") }), "Patsy Cline", "music", "s");
    expect(result).toEqual({
      status: "resolved",
      input: "Patsy Cline",
      kind: "music",
      entity: { entityId: "a", name: "Patsy Cline", description: "Country singer" },
      alternatives: [{ entityId: "b", name: "Nels Cline" }],
    });
  });

  it("asks the user to choose when the match is not exact", async () => {
    const result = await resolveFavorite(describeReturning({ status: "ok", results: [{}], ...outcome("fuzzy") }), "Patsy", "music", "s");
    expect(result.status).toBe("choose");
    expect(result.status === "choose" && result.candidates.map((c) => c.name)).toEqual(["Patsy Cline", "Nels Cline"]);
  });

  it("turns needs_input into a choice with Qloo's own explanation", async () => {
    const result = await resolveFavorite(
      describeReturning({ status: "needs_input", summary: "Several artists match.", ...outcome("ambiguous", "ambiguous") }),
      "Cline",
      "music",
      "s",
    );
    expect(result).toMatchObject({ status: "choose", reason: "Several artists match." });
  });

  it("reports not found for empty results", async () => {
    const result = await resolveFavorite(describeReturning({ status: "ok", results: [] }), "zzzz", "music", "s");
    expect(result.status).toBe("not_found");
  });

  it("reports errors with Qloo's recovery hint", async () => {
    const result = await resolveFavorite(
      describeReturning({ status: "error", error: { code: "X", retryable: false, recovery: "Try again later." } }),
      "Patsy Cline",
      "music",
      "s",
    );
    expect(result).toMatchObject({ status: "error", reason: "Try again later." });
  });
});

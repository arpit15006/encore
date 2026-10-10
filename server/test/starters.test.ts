import { describe, expect, it } from "vitest";
import type { MemoryItem } from "../src/encore/memoryBox.js";
import { conversationStarters } from "../src/encore/starters.js";
import type { JsonModel } from "../src/llm.js";
import type { QlooClient } from "../src/qloo/client.js";
import { normalizeEnvelope } from "../src/qloo/envelope.js";

const item = (entityId: string, name: string): MemoryItem => ({
  entityId,
  name,
  kind: "films",
  qloo: { affinity: 0.9, popularity: 0.9, becauseOf: [] },
  interpretation: { year: 1965, ageThen: 25, band: "in_era", note: "" },
});

const qloo = {
  call: async () =>
    normalizeEnvelope({
      status: "ok",
      results: [
        { name: "Dancer", id: "urn:tag:keyword:qloo:dancer", type: "urn:tag:keyword:qloo" },
        { name: "Aesthetic", id: "urn:tag:style:qloo:aesthetic", type: "urn:tag:style:qloo" },
        { name: "bollywood", id: "urn:tag:genre:music:bollywood", type: "urn:tag:genre:music" },
      ],
    }),
} as unknown as QlooClient;

const modelReturning = (answer: unknown): JsonModel => ({ json: async () => answer as never });

describe("conversationStarters", () => {
  it("keeps model starters that cite a real Qloo tag", async () => {
    const model = modelReturning({ starters: [{ index: 0, text: "Tell me about the dancing in Guide.", tag: "dancer" }] });
    const { starters } = await conversationStarters(qloo, model, [item("1", "Guide")], "en", "s");
    expect(starters[0]).toEqual({ text: "Tell me about the dancing in Guide.", about: "Guide", tag: "Dancer", source: "model" });
  });

  it("replaces a starter that cites a tag Qloo didn't return", async () => {
    const model = modelReturning({ starters: [{ index: 0, text: "Tell me about the war scenes.", tag: "War" }] });
    const { starters } = await conversationStarters(qloo, model, [item("1", "Guide")], "en", "s");
    expect(starters[0]!.source).toBe("template");
    expect(starters[0]!.tag).toBe("Dancer");
  });

  it("falls back to templates when the model is unavailable", async () => {
    const { starters } = await conversationStarters(qloo, modelReturning(undefined), [item("1", "Guide"), item("2", "Padosan")], "hi", "s");
    expect(starters.map((s) => s.source)).toEqual(["template", "template"]);
  });

  it("ignores vague style tags", async () => {
    const { tagsByItem } = await conversationStarters(qloo, modelReturning(undefined), [item("1", "Guide")], "en", "s");
    expect(tagsByItem["1"]).toEqual(["Dancer", "bollywood"]);
  });
});

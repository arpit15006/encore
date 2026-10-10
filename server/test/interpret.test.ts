import { describe, expect, it } from "vitest";
import { interpretStory } from "../src/encore/interpret.js";
import type { JsonModel } from "../src/llm.js";

const modelReturning = (answer: unknown): JsonModel => ({ json: async () => answer as never });

describe("interpretStory", () => {
  it("keeps valid fields and the list of what was left out", async () => {
    const story = await interpretStory(
      modelReturning({
        birthYear: 1940,
        grewUp: "Mumbai",
        favorites: [
          { text: "Lata Mangeshkar", kind: "music" },
          { text: "Mughal-e-Azam", kind: "film" },
        ],
        leftOut: ["a first name", "a health detail"],
      }),
      "My mother Asha, born 1940 in Mumbai, has dementia and loved Lata and Mughal-e-Azam.",
      2026,
    );
    expect(story).toEqual({
      birthYear: 1940,
      grewUp: "Mumbai",
      favorites: [
        { text: "Lata Mangeshkar", kind: "music" },
        { text: "Mughal-e-Azam", kind: "film" },
      ],
      leftOut: ["a first name", "a health detail"],
    });
  });

  it("drops impossible birth years and unknown kinds", async () => {
    const story = await interpretStory(
      modelReturning({ birthYear: 2010, favorites: [{ text: "Something", kind: "podcast" }, { text: "  ", kind: "music" }] }),
      "Some text that is long enough.",
      2026,
    );
    expect(story).toEqual({ favorites: [], leftOut: [] });
  });

  it("returns undefined when the model fails, so the form stays usable", async () => {
    expect(await interpretStory(modelReturning(undefined), "Some text that is long enough.")).toBeUndefined();
  });
});

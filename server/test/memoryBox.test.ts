import { describe, expect, it } from "vitest";
import { buildMemoryBox } from "../src/encore/memoryBox.js";
import type { InsightsRequest, QlooClient, QlooEntity } from "../src/qloo/client.js";
import { normalizeEnvelope } from "../src/qloo/envelope.js";

const RAFI = "11111111-1111-4111-8111-111111111111";
const LATA = "22222222-2222-4222-8222-222222222222";
const person = {
  birthYear: 1940,
  favorites: [
    { entityId: RAFI, name: "Mohammed Rafi", kind: "music" as const },
    { entityId: LATA, name: "Lata Mangeshkar", kind: "music" as const },
  ],
};

const artist = (name: string, start: number | undefined, extra: Partial<QlooEntity> = {}): QlooEntity => ({
  entity_id: `${name}-id`,
  name,
  properties: { ...(start ? { start_year: start } : {}), notable_songs: [`${name} song 1`, `${name} song 2`, `${name} song 3`, `${name} song 4`] },
  query: {
    affinity: 0.9,
    explainability: { "signal.interests.entities": [{ entity_id: RAFI, score: 0.3 }, { entity_id: LATA, score: 0.1 }] },
  },
  ...extra,
});

function fakeQloo(byType: Partial<Record<InsightsRequest["type"], unknown>>, seen: InsightsRequest[] = []): QlooClient {
  return {
    insights: async (request: InsightsRequest) => {
      seen.push(request);
      return normalizeEnvelope(byType[request.type] ?? { status: "ok", results: [] });
    },
  } as unknown as QlooClient;
}

describe("buildMemoryBox", () => {
  it("moves too-late artists below in-era ones and keeps Qloo's order within each band", async () => {
    const qloo = fakeQloo({
      artist: { status: "ok", results: [artist("Sonu Nigam", 1990), artist("Kishore Kumar", 1946), artist("Mystery", undefined), artist("Mukesh", 1941)] },
    });
    const box = await buildMemoryBox(qloo, person, "test");
    const music = box.sections.find((section) => section.kind === "music")!;
    expect(music.items.map((item) => item.name)).toEqual(["Kishore Kumar", "Mukesh", "Mystery", "Sonu Nigam"]);
    expect(music.items.map((item) => item.interpretation.band)).toEqual(["in_era", "in_era", "unknown", "too_late"]);
  });

  it("leaves out too-late picks when there are enough from their youth", async () => {
    const era = Array.from({ length: 7 }, (_, i) => artist(`Era ${i}`, 1945 + i));
    const qloo = fakeQloo({ artist: { status: "ok", results: [artist("Late", 1995), ...era] } });
    const music = (await buildMemoryBox(qloo, person, "test")).sections[0]!;
    expect(music.items.some((item) => item.name === "Late")).toBe(false);
    expect(music.items).toHaveLength(7);
  });

  it("drops favorites, including ones Qloo returns under another spelling", async () => {
    const qloo = fakeQloo({
      artist: {
        status: "ok",
        results: [
          artist("Lata Mangeshkar", 1942, { entity_id: LATA }),
          artist("Mohd Rafi", 1944, { properties: { start_year: 1944, akas: [{ value: "Mohammed Rafi" }] } }),
          artist("Manna Dey", 1942),
        ],
      },
    });
    const box = await buildMemoryBox(qloo, person, "test");
    expect(box.sections[0]!.items.map((item) => item.name)).toEqual(["Manna Dey"]);
  });

  it("separates Qloo evidence from Encore's interpretation", async () => {
    const qloo = fakeQloo({ artist: { status: "ok", results: [artist("Kishore Kumar", 1946)] } });
    const [item] = (await buildMemoryBox(qloo, person, "test")).sections[0]!.items;
    expect(item!.qloo.becauseOf).toEqual([
      { name: "Mohammed Rafi", share: 0.75 },
      { name: "Lata Mangeshkar", share: 0.25 },
    ]);
    expect(item!.qloo.notableSongs).toHaveLength(3);
    expect(item!.interpretation).toMatchObject({ year: 1946, ageThen: 6, band: "in_era" });
    expect(item!.interpretation.note).toBe("Recording since 1946, so already established by their teenage years.");
  });

  it("sends only favorite IDs and the youth window to Qloo (no location or age signals)", async () => {
    const seen: InsightsRequest[] = [];
    await buildMemoryBox(fakeQloo({}, seen), person, "test");
    expect(seen.map((request) => request.type).sort()).toEqual(["artist", "movie", "tv_show"]);
    for (const request of seen) {
      expect(request.signalIds).toEqual([RAFI, LATA]);
      expect(Object.keys(request.params ?? {}).some((key) => key.includes("location") || key.includes("demographics"))).toBe(false);
    }
    const movie = seen.find((request) => request.type === "movie")!;
    expect(movie.params).toMatchObject({ "filter.release_year.min": 1950, "filter.release_year.max": 1970 });
  });

  it("passes empty and error statuses through so the UI can show the right state", async () => {
    const qloo = fakeQloo({
      movie: { status: "ok", results: [] },
      tv_show: { status: "error", summary: "boom", error: { code: "X", retryable: false } },
    });
    const box = await buildMemoryBox(qloo, person, "test");
    expect(box.sections.find((section) => section.kind === "films")!.status).toBe("empty");
    expect(box.sections.find((section) => section.kind === "tv")!.status).toBe("error");
  });

  it("labels sections inferred when the person has no favorites of that kind", async () => {
    const box = await buildMemoryBox(fakeQloo({}), person, "test");
    expect(Object.fromEntries(box.sections.map((section) => [section.kind, section.basis]))).toEqual({ music: "direct", films: "inferred", tv: "inferred" });
  });

  it("says when an artist started during their youth", async () => {
    const qloo = fakeQloo({ artist: { status: "ok", results: [artist("Pankaj Udhas", 1970)] } });
    const [item] = (await buildMemoryBox(qloo, person, "test")).sections[0]!.items;
    expect(item!.interpretation.note).toBe("Started recording in 1970, when they were about 30.");
  });
});

import type { JsonModel } from "../llm.js";
import type { QlooClient, QlooEntity } from "../qloo/client.js";
import type { QlooStatus } from "../qloo/envelope.js";
import { artistDebutYear, eraBand, youthWindow } from "./era.js";
import type { Favorite, MemoryBox } from "./memoryBox.js";

export interface CompareInput {
  birthYear: number;
  grewUp?: string;
  livesIn?: string;
  favorites: Favorite[];
}

export interface ComparisonColumn {
  system: "plain_ai" | "naive_qloo" | "encore";
  title: string;
  how: string;
  status: QlooStatus | "model_failed";
  items: Array<{ name: string; year: number | null; inYouth: boolean | null }>;
  /** Picks from their youth among those with a known year, e.g. "7 of 10". */
  inYouthCount: number | null;
  datedCount: number;
}

const SIZE = 10;

function summarize(items: ComparisonColumn["items"]) {
  const dated = items.filter((item) => item.inYouth != null);
  return { inYouthCount: dated.length ? dated.filter((item) => item.inYouth).length : null, datedCount: dated.length };
}

/**
 * The same intake through three systems, to show why Encore exists:
 * 1. a plain AI model (same birth year, hometown and favorites, no Qloo);
 * 2. "naive Qloo": favorites plus age group and the place they live now as Qloo signals, which is
 *    what a straightforward integration does;
 * 3. Encore: favorites only, youth window, and re-ranking by career start.
 */
export async function compareSystems(qloo: QlooClient, model: JsonModel, input: CompareInput, box: MemoryBox, scope: string): Promise<ComparisonColumn[]> {
  const window = youthWindow(input.birthYear);
  const place = input.livesIn ?? input.grewUp ?? "United States";

  const prompt = `A family member describes an older relative so care staff can plan familiar music.
Born ${input.birthYear}.${input.grewUp ? ` Grew up in ${input.grewUp}.` : ""} Favorites: ${input.favorites.map((f) => f.name).join(", ")}.
List the ${SIZE} singers or bands this person is most likely to recognize and love from their youth. Don't repeat the favorites.
Respond only with JSON: {"artists": ["name", ...]}`;
  const [answer, naive] = await Promise.all([
    model.json<{ artists?: unknown[] }>("compare-plain-v1", prompt),
    qloo.call<QlooEntity>(
      "qloo_recommend",
      { target_type: "artist", signals: input.favorites.map((f) => f.entityId), demographic: "seniors", signal_location: place, limit: SIZE },
      { scope },
    ),
  ]);

  const plainItems = (answer?.artists ?? [])
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .slice(0, SIZE)
    .map((name) => ({ name: name.trim(), year: null, inYouth: null }));
  // The recommend workflow returns no career data, so fetch it for exactly these entities
  // (one Insights call restricted with filter.entities) to check them the same way as Encore's picks.
  const naiveTop = naive.results.slice(0, SIZE);
  const details = naiveTop.length
    ? await qloo.insights(
        { type: "artist", signalIds: input.favorites.map((f) => f.entityId), take: naiveTop.length, params: { "filter.entities": naiveTop.map((e) => e.entity_id).join(",") } },
        { scope },
      )
    : undefined;
  const naiveItems = naiveTop.map((entity) => {
    const detail = details?.results.find((candidate) => candidate.entity_id === entity.entity_id);
    const year = artistDebutYear(detail?.properties ?? entity.properties ?? {});
    return { name: entity.name, year, inYouth: year == null ? null : eraBand(year, window) === "in_era" };
  });
  const encoreItems = (box.sections.find((section) => section.kind === "music")?.items ?? []).slice(0, SIZE).map((item) => ({
    name: item.name,
    year: item.interpretation.year,
    inYouth: item.interpretation.year == null ? null : item.interpretation.band === "in_era",
  }));

  return [
    {
      system: "plain_ai",
      title: "A plain AI model",
      how: "Same birth year, hometown and favorites. No Qloo, so no evidence behind the list.",
      status: answer ? "ok" : "model_failed",
      items: plainItems,
      ...summarize(plainItems),
    },
    {
      system: "naive_qloo",
      title: "Qloo, used naively",
      how: `Favorites plus "seniors" and where they live now (${place}) as Qloo signals.`,
      status: naive.status,
      items: naiveItems,
      ...summarize(naiveItems),
    },
    {
      system: "encore",
      title: "Encore",
      how: "Their favorites only, then re-ranked so artists from their youth come first.",
      status: box.sections[0]?.status ?? "error",
      items: encoreItems,
      ...summarize(encoreItems),
    },
  ];
}

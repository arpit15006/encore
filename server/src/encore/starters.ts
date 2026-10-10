import type { JsonModel } from "../llm.js";
import type { QlooClient } from "../qloo/client.js";
import type { MemoryItem, SectionKind } from "./memoryBox.js";

export const LANGUAGES = { en: "English", hi: "Hindi", es: "Spanish" } as const;
export type Language = keyof typeof LANGUAGES;

export interface Starter {
  /** What to say, in the chosen language. */
  text: string;
  /** The item it's about. */
  about: string;
  /** The Qloo tag it is grounded in (always shown in English, as Qloo returned it). */
  tag: string;
  source: "model" | "template";
}

interface Tag {
  name: string;
  id: string;
  type: string;
}

const ENTITY_TYPE: Record<SectionKind, string> = { music: "artist", films: "movie", tv: "tv_show" };
/** Concrete tags make good conversation; vague ones ("Aesthetic", "Emotionally driven") don't. */
const USEFUL_TAG = /:(keyword|genre|theme|subgenre|plot)/;

export async function tagsFor(qloo: QlooClient, item: Pick<MemoryItem, "entityId" | "kind">, scope: string): Promise<Tag[]> {
  const envelope = await qloo.call<{ name?: string; id?: string; type?: string }>(
    "qloo_entity_tags",
    { entities: [item.entityId], entity_type: ENTITY_TYPE[item.kind], limit: 12 },
    { scope },
  );
  if (envelope.status !== "ok" && envelope.status !== "partial" && envelope.status !== "degraded") return [];
  const seen = new Set<string>();
  return envelope.results
    .flatMap((tag) => (tag.name && tag.id && tag.type ? [{ name: tag.name.trim(), id: tag.id, type: tag.type }] : []))
    .filter((tag) => USEFUL_TAG.test(tag.type) && tag.name.length > 1)
    .filter((tag) => !seen.has(tag.name.toLowerCase()) && seen.add(tag.name.toLowerCase()));
}

function template(item: MemoryItem, tag: Tag | undefined): Starter {
  const subject = item.kind === "music" ? `the songs of ${item.name}` : item.name;
  const text = tag
    ? `${subject[0]!.toUpperCase()}${subject.slice(1)} is often described as "${tag.name.toLowerCase()}". What did it make you feel back then?`
    : `Tell me about ${subject}. What was life like back then?`;
  return { text, about: item.name, tag: tag?.name ?? "", source: "template" };
}

/**
 * One starter per item, grounded in Qloo's tags. The model may only use the item's name, its year,
 * the person's age then, and the listed tags; any starter that cites a tag Qloo didn't return is
 * dropped and replaced by a plain template.
 */
export async function conversationStarters(
  qloo: QlooClient,
  model: JsonModel,
  items: MemoryItem[],
  language: Language,
  scope: string,
): Promise<{ starters: Starter[]; tagsByItem: Record<string, string[]> }> {
  const withTags = await Promise.all(items.map(async (item) => ({ item, tags: (await tagsFor(qloo, item, scope)).slice(0, 6) })));
  const tagsByItem = Object.fromEntries(withTags.map(({ item, tags }) => [item.entityId, tags.map((tag) => tag.name)]));

  const facts = withTags.map(({ item, tags }, index) => {
    // Only mention an age when the relative was old enough to have met it themselves.
    const age = item.interpretation.ageThen;
    const met = age != null && age >= 10;
    return {
      index,
      item: item.name,
      kind: item.kind === "music" ? "singer or band" : item.kind === "films" ? "film" : "TV show",
      ...(met ? { year: item.interpretation.year, relative_was_about: age } : {}),
      tags: tags.map((tag) => tag.name),
    };
  });
  const prompt = `You help a family member talk with an older relative who may have memory loss.
Write ONE short, warm conversation starter for each item below, in natural, everyday ${LANGUAGES[language]}. The family member says it to the relative, so speak to them as "you".
Rules:
- Use only these facts: the item name, the year and "relative_was_about" (the RELATIVE's age at the time, never the artist's) when given, and the meaning of ONE tag from that item's list. Add no other facts.
- Work the tag's meaning naturally into the sentence${language === "en" ? "" : ` in ${LANGUAGES[language]}; don't paste the English word`}.
- Invite stories; never quiz. Don't ask "Do you remember...?". Prefer "Tell me about..." or "What was it like...".
- At most 22 words. No medical words. No names of people other than the item.
- Return the tag you used exactly as written in the list (in English).
Example (English): "What was it like hearing Kishore Kumar's joyful songs on the radio when you were about 20?"
Items: ${JSON.stringify(facts)}
Respond only with JSON: {"starters": [{"index": 0, "text": "...", "tag": "..."}]}`;

  const answer = await model.json<{ starters?: Array<{ index?: number; text?: string; tag?: string }> }>("starters-v2", prompt);
  const starters = withTags.map(({ item, tags }, index) => {
    const proposed = answer?.starters?.find((starter) => starter.index === index);
    const tag = tags.find((candidate) => candidate.name.toLowerCase() === proposed?.tag?.trim().toLowerCase());
    if (proposed?.text && tag && proposed.text.length <= 220) return { text: proposed.text.trim(), about: item.name, tag: tag.name, source: "model" as const };
    return template(item, tags[0]);
  });
  return { starters, tagsByItem };
}

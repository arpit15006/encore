import { createHash } from "node:crypto";
import Groq from "groq-sdk";
import type { AppStore } from "./store/appStore.js";

/** A JSON-answering language model. Swappable in tests. */
export interface JsonModel {
  json<T>(task: string, prompt: string): Promise<T | undefined>;
}

/**
 * Groq-backed model. Answers are cached by prompt so demos are stable and repeat visits are free.
 * Returns undefined on any failure; every caller has a non-AI fallback.
 */
export class GroqJsonModel implements JsonModel {
  private readonly groq: Groq;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly store: Pick<AppStore, "getLlmCache" | "putLlmCache">,
  ) {
    this.groq = new Groq({ apiKey, timeout: 30_000, maxRetries: 1 });
  }

  async json<T>(task: string, prompt: string): Promise<T | undefined> {
    const key = createHash("sha256").update(`${this.model}\n${task}\n${prompt}`).digest("hex");
    const cached = this.store.getLlmCache(key);
    if (cached !== undefined) return cached as T;
    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) return undefined;
      const parsed = JSON.parse(content) as T;
      this.store.putLlmCache(key, parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }
}

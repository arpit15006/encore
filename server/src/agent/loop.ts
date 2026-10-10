import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { QLOO_TOOLS, type QlooClient, type QlooToolName } from "../qloo/client.js";
import type { QlooEnvelope } from "../qloo/envelope.js";

export interface AgentStep {
  tool: QlooToolName;
  args: Record<string, unknown>;
  status: QlooEnvelope["status"];
  summary?: string;
  resultCount: number;
  /** Arguments Encore removed before calling Qloo. */
  removed?: string[];
}

export interface AgentAnswer {
  answer: string;
  steps: AgentStep[];
  stoppedEarly: boolean;
}

const MAX_TOOL_ROUNDS = 6;
const STRIPPED_ARGS = ["signal_location", "demographic"];

const SYSTEM_PROMPT = `You are Encore's planning agent. You help care staff and families find familiar music, films and shows for an older person.
Rules:
- Use the Qloo tools for every taste claim. Resolve names with qloo_describe before using them as signals.
- If a tool returns needs_input, list the candidates and ask which one is meant. Never guess.
- If a tool returns empty, partial or degraded, say so plainly.
- Never ask for or repeat a person's name, address or health details.
- Don't send signal_location or demographic. In testing, location and age signals pulled results toward local mainstream taste and erased the person's own culture. Use their favorites as signals.
- Prefer things from their youth (the years given below). Mention the year when you know it.
- Phrase taste as "People who love X often enjoy Y". Never present it as a certainty about one person.
- Start from the Memory Box picks listed below; they are already checked against their youth. Use at most two tool calls, only to add something the list lacks.
- Keep the answer short: at most 6 suggestions, each with one line of why.`;

/** Trim a Qloo envelope to what the model needs, to save tokens and keep it focused. */
function compactForModel(envelope: QlooEnvelope): string {
  const results = (envelope.results as Array<Record<string, unknown>>).slice(0, 20).map((entity) => {
    const properties = (entity.properties ?? {}) as Record<string, unknown>;
    return {
      name: entity.name,
      entity_id: entity.entity_id,
      popularity: entity.popularity,
      ...(properties.release_year ? { release_year: properties.release_year } : {}),
    };
  });
  return JSON.stringify({ status: envelope.status, summary: envelope.summary, result_count: envelope.resultCount, results, error: envelope.error });
}

export class EncoreAgent {
  private readonly groq: Groq;

  constructor(
    private readonly qloo: QlooClient,
    apiKey: string,
    private readonly model: string,
  ) {
    this.groq = new Groq({ apiKey });
  }

  /** `context` describes the person (birth year, youth window, confirmed favorites with Qloo IDs). */
  async ask(question: string, scope: string, context?: string): Promise<AgentAnswer> {
    const tools: ChatCompletionTool[] = (await this.qloo.toolDefinitions()).map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema as Record<string, unknown> },
    }));
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: context ? `${SYSTEM_PROMPT}\n\nAbout this person:\n${context}` : SYSTEM_PROMPT },
      { role: "user", content: question },
    ];
    const steps: AgentStep[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const message = await this.complete(messages, tools);
      if (message === undefined) return this.answerWithoutTools(messages, steps);
      if (!message) break;
      messages.push(message);
      if (!message.tool_calls?.length) return { answer: message.content ?? "", steps, stoppedEarly: false };

      for (const call of message.tool_calls) {
        messages.push({ role: "tool", tool_call_id: call.id, content: await this.runTool(call.function.name, call.function.arguments, scope, steps) });
      }
    }
    // Out of tool rounds: answer with what has been gathered rather than giving up.
    return this.answerWithoutTools(messages, steps);
  }

  /**
   * One model turn. The model occasionally emits a malformed tool call, which the provider rejects;
   * retry once with a little variation, then give up on tools for this question.
   */
  private async complete(messages: ChatCompletionMessageParam[], tools: ChatCompletionTool[]) {
    for (const temperature of [0, 0.3]) {
      try {
        const completion = await this.groq.chat.completions.create({ model: this.model, messages, tools, tool_choice: "auto", temperature });
        return completion.choices[0]?.message ?? null;
      } catch {
        // Fall through to the retry, then to an answer without tools.
      }
    }
    return undefined;
  }

  private async answerWithoutTools(messages: ChatCompletionMessageParam[], steps: AgentStep[]): Promise<AgentAnswer> {
    try {
      const final = await this.groq.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages: [...messages, { role: "user", content: "Answer now using only what you already know from the context and tool results above." }],
      });
      const answer = final.choices[0]?.message?.content?.trim();
      if (answer) return { answer, steps, stoppedEarly: true };
    } catch {
      // Reported below.
    }
    return { answer: "Encore couldn't answer that right now. Please try again in a moment.", steps, stoppedEarly: true };
  }

  /** Runs one model-requested tool call; problems are reported back to the model instead of calling Qloo. */
  private async runTool(name: string, rawArgs: string, scope: string, steps: AgentStep[]): Promise<string> {
    if (!(QLOO_TOOLS as readonly string[]).includes(name)) {
      return JSON.stringify({ status: "error", summary: `Tool ${name} is not available.` });
    }
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(rawArgs || "{}");
    } catch {
      return JSON.stringify({ status: "error", summary: "Arguments were not valid JSON. Try again." });
    }
    // Enforced, not just requested: location and age-group signals erased culture in testing.
    const stripped = STRIPPED_ARGS.filter((key) => key in args);
    for (const key of stripped) delete args[key];
    const envelope = await this.qloo.call(name as QlooToolName, args, { scope });
    steps.push({
      tool: name as QlooToolName,
      args,
      status: envelope.status,
      resultCount: envelope.resultCount,
      ...(envelope.summary ? { summary: envelope.summary } : {}),
      ...(stripped.length ? { removed: stripped } : {}),
    });
    return compactForModel(envelope);
  }
}

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
}

export interface AgentAnswer {
  answer: string;
  steps: AgentStep[];
  stoppedEarly: boolean;
}

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are Encore's planning agent. You help care staff and families find familiar music, films and shows for an older person.
Rules:
- Use the Qloo tools for every taste claim. Resolve names with qloo_describe before using them as signals.
- If a tool returns needs_input, list the candidates and ask which one is meant. Never guess.
- If a tool returns empty, partial or degraded, say so plainly.
- Never ask for or repeat a person's name, address or health details.
- Phrase taste as "People who love X often enjoy Y". Never present it as a certainty about one person.`;

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

  async ask(question: string, scope: string): Promise<AgentAnswer> {
    const tools: ChatCompletionTool[] = (await this.qloo.toolDefinitions()).map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description ?? "", parameters: tool.inputSchema as Record<string, unknown> },
    }));
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ];
    const steps: AgentStep[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await this.groq.chat.completions.create({ model: this.model, messages, tools, tool_choice: "auto", temperature: 0 });
      const message = completion.choices[0]?.message;
      if (!message) break;
      messages.push(message);
      if (!message.tool_calls?.length) return { answer: message.content ?? "", steps, stoppedEarly: false };

      for (const call of message.tool_calls) {
        messages.push({ role: "tool", tool_call_id: call.id, content: await this.runTool(call.function.name, call.function.arguments, scope, steps) });
      }
    }
    return { answer: "I couldn't finish within the step limit. Please narrow the question.", steps, stoppedEarly: true };
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
    const envelope = await this.qloo.call(name as QlooToolName, args, { scope });
    steps.push({
      tool: name as QlooToolName,
      args,
      status: envelope.status,
      resultCount: envelope.resultCount,
      ...(envelope.summary ? { summary: envelope.summary } : {}),
    });
    return compactForModel(envelope);
  }
}

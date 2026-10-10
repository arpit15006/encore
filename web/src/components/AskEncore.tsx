import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiError, type AgentAnswer } from "../api";
import { Notice } from "./Notice";

const EXAMPLES = ["What could we watch on a quiet Sunday afternoon?", "Which songs might suit a sing-along?", "Something calm for the evening?"];

const TOOL_LABELS: Record<string, string> = {
  qloo_describe: "Looked up a name",
  qloo_recommend: "Asked for related picks",
  qloo_rank: "Ranked a shortlist",
  qloo_entity_tags: "Read Qloo's tags",
  qloo_find_tags: "Searched Qloo's themes",
  qloo_where_popular: "Checked where it's popular",
  qloo_audience_demographics: "Checked who loves it",
  qloo_compare_audiences: "Compared two audiences",
};

/** A question to Encore's agent: it plans its own Qloo calls, and every call is shown. */
export function AskEncore({ residentId }: { residentId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AgentAnswer>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function ask(event?: FormEvent, text = question) {
    event?.preventDefault();
    if (text.trim().length < 3) return;
    setQuestion(text);
    setLoading(true);
    setError(undefined);
    try {
      setAnswer(await api.ask(residentId, text.trim()));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="form-section ask" aria-labelledby="ask-heading">
      <h2 id="ask-heading">
        <MessageCircleQuestion aria-hidden="true" size={26} style={{ verticalAlign: "-4px", marginRight: 8 }} />
        Ask Encore
      </h2>
      <p className="hint">Encore's agent answers from their Memory Box and asks Qloo when it needs more. Every Qloo step is shown.</p>
      <form className="ask-form" onSubmit={ask}>
        <label htmlFor="ask-input" className="visually-hidden">
          Your question
        </label>
        <input id="ask-input" className="input" value={question} maxLength={300} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about music, films or a visit…" />
        <button className="btn btn-primary" type="submit" disabled={loading || question.trim().length < 3}>
          {loading ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Send aria-hidden="true" size={20} />}
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
      <div className="ask-examples">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="btn btn-quiet btn-small" disabled={loading} onClick={() => ask(undefined, example)}>
            {example}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {error && (
          <Notice tone="error">
            <p>{error}</p>
          </Notice>
        )}
        {answer && (
          <div className="ask-answer">
            <div className="panel panel-interp">
              <div className="panel-label">Encore's answer (written by AI from Qloo results; check before using)</div>
              <div className="ask-text">{answer.answer}</div>
            </div>
            {answer.steps.length > 0 && (
              <div className="panel panel-evidence">
                <div className="panel-label">What the agent asked Qloo</div>
                <ol className="ask-steps">
                  {answer.steps.map((step, index) => (
                    <li key={index}>
                      {TOOL_LABELS[step.tool] ?? step.tool}: {step.status === "ok" ? `${step.resultCount} results` : `status "${step.status}"`}
                      {step.removed?.length ? " (Encore removed location and age signals first)" : ""}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

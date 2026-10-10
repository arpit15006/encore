import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { api, ApiError, type Language, type VisitKitContent } from "../api";
import { Notice } from "../components/Notice";
import { ResidentHeader } from "../components/ResidentHeader";
import { useResident } from "../useResident";
import { KitView } from "./VisitKit";

const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी (Hindi)" },
  { id: "es", label: "Español (Spanish)" },
];

export function VisitKitManager({ residentId }: { residentId: string }) {
  const { view, error: viewError, reload } = useResident(residentId);
  const [language, setLanguage] = useState<Language>("en");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ url: string; content: VisitKitContent; expiresAt: string }>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function create() {
    setCreating(true);
    setError(undefined);
    try {
      const kit = await api.createVisitKit(residentId, language);
      setCreated({ url: `${window.location.origin}/kit/${kit.token}`, content: kit.content, expiresAt: kit.expiresAt });
      setCopied(false);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(hint: string) {
    await api.revokeVisitKit(residentId, hint);
    if (created?.url.includes(`/kit/${hint}`)) setCreated(undefined);
    reload();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (viewError)
    return (
      <Notice tone="error">
        <p>{viewError}</p>
      </Notice>
    );
  if (!view) return <p role="status">Loading…</p>;
  const kits = view.visitKits;

  return (
    <div className="stack">
      <ResidentHeader view={view} title="Family Visit Kit" headingRef={headingRef} />
      <p className="lede">
        A private page for family before a visit: three songs, a film, and conversation starters built from Qloo's descriptions. The link has
        no name in it, expires in 30 days, and you can turn it off at any time.
      </p>

      <section className="form-section" aria-labelledby="new-kit">
        <h2 id="new-kit">Make a Visit Kit</h2>
        <fieldset className="favorite-group">
          <legend className="field">
            <strong>Language for the conversation starters</strong>
            <span className="hint">Song and film names stay as Qloo lists them.</span>
          </legend>
          <div className="language-options">
            {LANGUAGES.map((option) => (
              <label key={option.id} className="candidate">
                <input type="radio" name="language" checked={language === option.id} onChange={() => setLanguage(option.id)} />
                <span className="candidate-name">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Link2 aria-hidden="true" size={20} />}
          {creating ? "Writing starters from Qloo's tags…" : "Make a private link"}
        </button>
        {error && (
          <Notice tone="error">
            <p>{error}</p>
          </Notice>
        )}
      </section>

      {created && (
        <section className="form-section" aria-labelledby="kit-ready">
          <h2 id="kit-ready">Ready to share</h2>
          <div className="share-row">
            <input className="input" readOnly value={created.url} aria-label="Visit Kit link" onFocus={(event) => event.target.select()} />
            <button className="btn btn-quiet" onClick={() => copy(created.url)}>
              {copied ? <Check aria-hidden="true" size={20} /> : <Copy aria-hidden="true" size={20} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="hint">Expires {new Date(created.expiresAt).toLocaleDateString()}. Anyone with the link can see this page, so share it only with family.</p>
          <h3 style={{ marginTop: "var(--space-5)" }}>Preview</h3>
          <KitView content={created.content} />
        </section>
      )}

      {kits.length > 0 && (
        <section className="form-section" aria-labelledby="kit-list">
          <h2 id="kit-list">Links you've made</h2>
          <ul className="kit-list">
            {kits.map((kit) => {
              const expired = new Date(kit.expiresAt) <= new Date();
              return (
                <li key={kit.hint + kit.createdAt}>
                  <span>
                    {LANGUAGES.find((l) => l.id === kit.language)?.label} · made {new Date(kit.createdAt).toLocaleDateString()} ·{" "}
                    {kit.revoked ? "turned off" : expired ? "expired" : `works until ${new Date(kit.expiresAt).toLocaleDateString()}`}
                  </span>
                  {!kit.revoked && !expired && (
                    <button className="btn btn-quiet btn-small" onClick={() => revoke(kit.hint)}>
                      <Trash2 aria-hidden="true" size={18} /> Turn off
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

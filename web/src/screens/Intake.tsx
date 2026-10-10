import { ArrowLeft, Loader2, Lock, Plus, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, type Candidate, type Favorite, type FavoriteKind, type LoggedRequest, type Resolution } from "../api";
import { navigate } from "../router";
import { Notice } from "../components/Notice";
import { WhatQlooSees } from "../components/WhatQlooSees";

const GROUPS: Array<{ kind: FavoriteKind; label: string; hint: string }> = [
  { kind: "music", label: "Singers or bands", hint: "For example: Patsy Cline, Lata Mangeshkar, The Supremes" },
  { kind: "film", label: "Films", hint: "For example: The Sound of Music, Mother India" },
  { kind: "tv", label: "TV shows", hint: "For example: Bonanza, I Love Lucy" },
  { kind: "star", label: "Film or TV stars", hint: "For example: Audrey Hepburn, Dilip Kumar" },
  { kind: "book", label: "Books or authors", hint: "For example: Agatha Christie, Gone with the Wind" },
];
const MAX_FAVORITES = 10;
const NONE = "none";
const CURRENT_YEAR = new Date().getFullYear();

type Drafts = Record<FavoriteKind, string[]>;
const EMPTY_DRAFTS: Drafts = { music: ["", ""], film: [""], tv: [""], star: [], book: [] };

/** First sentence of Qloo's description, kept short for older readers; Qloo sometimes sends "None". */
function shortDescription(description?: string): string | undefined {
  const text = description?.trim();
  if (!text || text.toLowerCase() === "none") return undefined;
  // End at the first sentence break that isn't an initial or a short title ("K. Asif", "Dr. No").
  let end = text.length;
  for (const match of text.matchAll(/[.!?](?=\s|$)/g)) {
    const before = text.slice(0, match.index).split(/\s/).pop() ?? "";
    if (/^[A-Z]$/.test(before) || /^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Vol|No)$/.test(before)) continue;
    end = match.index + 1;
    break;
  }
  const firstSentence = text.slice(0, end).trim();
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157).trimEnd()}…` : firstSentence;
}

const VISIBLE_CHOICES = 3;

function optionsFor(resolution: Resolution): Candidate[] {
  if (resolution.status === "resolved") return [resolution.entity, ...resolution.alternatives];
  if (resolution.status === "choose") return resolution.candidates;
  return [];
}

export function Intake() {
  const [step, setStep] = useState<"about" | "confirm">("about");
  const [birthYear, setBirthYear] = useState("");
  const [grewUp, setGrewUp] = useState("");
  const [livesIn, setLivesIn] = useState("");
  const [story, setStory] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpreted, setInterpreted] = useState<{ count: number; leftOut: string[] }>();
  const [interpretError, setInterpretError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [errors, setErrors] = useState<{ birthYear?: string; favorites?: string }>({});
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [sent, setSent] = useState<LoggedRequest[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryKey, setSummaryKey] = useState(0);

  useEffect(() => headingRef.current?.focus(), [step]);
  // After a failed submit, move focus to the error summary so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (summaryKey) summaryRef.current?.focus();
  }, [summaryKey]);

  const filled = GROUPS.flatMap(({ kind }) => drafts[kind].map((text) => ({ text: text.trim(), kind }))).filter((item) => item.text);

  const updateDraft = (kind: FavoriteKind, index: number, value: string) =>
    setDrafts((current) => ({ ...current, [kind]: current[kind].map((text, i) => (i === index ? value : text)) }));
  const addDraft = (kind: FavoriteKind) => setDrafts((current) => ({ ...current, [kind]: [...current[kind], ""] }));
  const removeDraft = (kind: FavoriteKind, index: number) =>
    setDrafts((current) => ({ ...current, [kind]: current[kind].filter((_, i) => i !== index) }));

  const birthYearError = (value: string) => {
    const year = Number(value);
    return Number.isInteger(year) && year >= 1915 && year <= CURRENT_YEAR - 40 ? undefined : `Enter a year between 1915 and ${CURRENT_YEAR - 40}.`;
  };

  /** Encore's agent reads the family's own words and fills in the form; nothing is final until confirmed. */
  async function fillFromStory() {
    setInterpreting(true);
    setInterpretError(undefined);
    try {
      const result = await api.interpret(story);
      if (result.birthYear) setBirthYear(String(result.birthYear));
      if (result.grewUp) setGrewUp(result.grewUp);
      const next: Drafts = { music: [], film: [], tv: [], star: [], book: [] };
      for (const favorite of result.favorites) next[favorite.kind].push(favorite.text);
      for (const { kind } of GROUPS) if (!next[kind].length) next[kind] = kind === "star" || kind === "book" ? [] : [""];
      setDrafts(next);
      setInterpreted({ count: result.favorites.length, leftOut: result.leftOut });
    } catch (error) {
      setInterpretError(error instanceof ApiError ? error.message : "Encore couldn't read that. Please fill in the form below.");
    } finally {
      setInterpreting(false);
    }
  }

  async function findThem(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const yearProblem = birthYearError(birthYear);
    if (yearProblem) nextErrors.birthYear = yearProblem;
    if (filled.length === 0) nextErrors.favorites = "Add at least one favorite.";
    if (filled.length > MAX_FAVORITES) nextErrors.favorites = `Please keep it to ${MAX_FAVORITES} favorites or fewer.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setSummaryKey((key) => key + 1);
      return;
    }

    setLoading(true);
    setRequestError(undefined);
    try {
      const response = await api.resolveFavorites(filled);
      setResolutions(response.results);
      setSent(response.whatQlooSaw);
      // Pre-select exact matches; ambiguous ones wait for the user's choice.
      setChoices(Object.fromEntries(response.results.flatMap((result, index) => (result.status === "resolved" ? [[index, result.entity.entityId]] : []))));
      setExpanded({});
      setStep("confirm");
    } catch (error) {
      setRequestError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const needsChoice = resolutions.some((result, index) => (result.status === "resolved" || result.status === "choose") && !choices[index]);

  async function continueToBox() {
    const favorites: Favorite[] = [];
    resolutions.forEach((result, index) => {
      const choice = choices[index];
      const picked = optionsFor(result).find((candidate) => candidate.entityId === choice);
      if (picked && !favorites.some((favorite) => favorite.entityId === picked.entityId)) {
        favorites.push({ entityId: picked.entityId, name: picked.name, kind: result.kind });
      }
    });
    if (favorites.length === 0) {
      setRequestError("Confirm at least one favorite to build their Memory Box.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await api.createResident({
        birthYear: Number(birthYear),
        ...(grewUp.trim() ? { grewUp: grewUp.trim() } : {}),
        ...(livesIn.trim() ? { livesIn: livesIn.trim() } : {}),
        favorites,
      });
      navigate(`/r/${id}`);
    } catch (error) {
      setRequestError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="stack">
        <div>
          <span className="step-indicator">Step 2 of 2</span>
          <h1 ref={headingRef} tabIndex={-1}>
            Is this who you meant?
          </h1>
          <p className="lede">Names can be shared by different artists and films, so please check each one.</p>
        </div>
        <ol className="confirm-list">
          {resolutions.map((result, index) => {
            const options = optionsFor(result);
            const confirmed = choices[index] && choices[index] !== NONE;
            return (
              <li key={index} className="confirm-card" data-state={options.length === 0 ? "problem" : confirmed ? "confirmed" : undefined}>
                <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                  <legend className="typed">
                    You typed <strong>“{result.input}”</strong>
                  </legend>
                  {options.length === 0 ? (
                    <Notice tone={result.status === "error" ? "error" : "caution"}>
                      <p>{result.status === "not_found" || result.status === "error" ? result.reason : ""} We'll leave this one out.</p>
                    </Notice>
                  ) : (
                    <>
                      {result.status === "choose" && <p>{result.reason}</p>}
                      {(() => {
                        // Progressive disclosure: an exact match shows alone; a choice shows the top few.
                        const visibleCount = expanded[index] ? options.length : result.status === "resolved" ? 1 : VISIBLE_CHOICES;
                        const hidden = options.length - visibleCount;
                        return (
                          <>
                            {options.slice(0, visibleCount).map((candidate) => {
                              const description = shortDescription(candidate.description);
                              return (
                                <label key={candidate.entityId} className="candidate">
                                  <input
                                    type="radio"
                                    name={`favorite-${index}`}
                                    checked={choices[index] === candidate.entityId}
                                    onChange={() => setChoices((current) => ({ ...current, [index]: candidate.entityId }))}
                                  />
                                  <span>
                                    <span className="candidate-name">{candidate.name}</span>
                                    {description && <span className="candidate-desc">{description}</span>}
                                  </span>
                                </label>
                              );
                            })}
                            {hidden > 0 && (
                              <button
                                type="button"
                                className="btn btn-quiet btn-small more-matches"
                                onClick={() => setExpanded((current) => ({ ...current, [index]: true }))}
                              >
                                Show {hidden} other {hidden === 1 ? "match" : "matches"}
                              </button>
                            )}
                            {(expanded[index] || result.status !== "resolved") && (
                              <label className="candidate">
                                <input
                                  type="radio"
                                  name={`favorite-${index}`}
                                  checked={choices[index] === NONE}
                                  onChange={() => setChoices((current) => ({ ...current, [index]: NONE }))}
                                />
                                <span className="candidate-name">None of these, leave it out</span>
                              </label>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>

        {requestError && (
          <Notice tone="error">
            <p>{requestError}</p>
          </Notice>
        )}
        {needsChoice && (
          <Notice tone="info">
            <p>Pick an answer for each favorite to continue.</p>
          </Notice>
        )}
        <div className="confirm-actions">
          <button className="btn btn-quiet" onClick={() => setStep("about")}>
            <ArrowLeft aria-hidden="true" size={20} /> Edit favorites
          </button>
          <button className="btn btn-primary" onClick={continueToBox} disabled={needsChoice || saving}>
            {saving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
            Build their Memory Box
          </button>
        </div>
        <WhatQlooSees requests={sent} favorites={[]} />
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={findThem} noValidate>
      <div>
        <span className="step-indicator">Step 1 of 2</span>
        <h1 ref={headingRef} tabIndex={-1}>
          Tell us about them
        </h1>
        <p className="lede">A few things they loved when they were young are enough.</p>
      </div>

      {summaryKey > 0 && Object.keys(errors).length > 0 && (
        <div className="error-summary" ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="error-summary-title">
          <h2 id="error-summary-title">Please check {Object.keys(errors).length === 1 ? "one thing" : "two things"}</h2>
          <ul>
            {errors.birthYear && (
              <li>
                <a href="#birth-year">{errors.birthYear}</a>
              </li>
            )}
            {errors.favorites && (
              <li>
                <a href="#favorites-heading">{errors.favorites}</a>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="privacy-note">
        <Lock aria-hidden="true" size={22} />
        <p>
          <strong>No names, please.</strong> Encore never asks for names, addresses or health details. Qloo only sees the favorites you
          confirm and a range of years.
        </p>
      </div>

      <section className="form-section" aria-labelledby="story-heading">
        <h2 id="story-heading">
          <Wand2 aria-hidden="true" size={24} style={{ verticalAlign: "-3px", marginRight: 8 }} />
          Describe them in your own words
        </h2>
        <div className="field" style={{ marginBottom: "var(--space-3)" }}>
          <label htmlFor="story">Optional: Encore's agent will fill in the form below for you to check.</label>
          <textarea
            id="story"
            className="input textarea"
            rows={4}
            maxLength={2000}
            value={story}
            onChange={(event) => setStory(event.target.value)}
            aria-describedby="story-hint"
            placeholder="She was born in 1940 and grew up in Pune. She loved Lata Mangeshkar and Kishore Kumar, and the film Mughal-e-Azam…"
          />
          <span id="story-hint" className="hint">
            This text goes to Encore's AI model only, never to Qloo. Names and health details are left out automatically.
          </span>
        </div>
        <button type="button" className="btn btn-quiet" onClick={fillFromStory} disabled={interpreting || story.trim().length < 10}>
          {interpreting ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Wand2 aria-hidden="true" size={20} />}
          {interpreting ? "Reading…" : "Fill in the form for me"}
        </button>
        <div aria-live="polite">
          {interpreted && (
            <Notice tone="info">
              <p>
                Encore found {interpreted.count} {interpreted.count === 1 ? "favorite" : "favorites"}. Please check the form below.
                {interpreted.leftOut.length ? ` It left out ${interpreted.leftOut.join(", ")}.` : ""}
              </p>
            </Notice>
          )}
          {interpretError && (
            <Notice tone="error">
              <p>{interpretError}</p>
            </Notice>
          )}
        </div>
      </section>

      <section className="form-section" aria-labelledby="about-heading">
        <h2 id="about-heading">About them</h2>
        <div className="field">
          <label htmlFor="birth-year">Year they were born</label>
          <input
            id="birth-year"
            className="input input-narrow"
            inputMode="numeric"
            autoComplete="off"
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
            onBlur={() => birthYear && setErrors((current) => ({ ...current, birthYear: birthYearError(birthYear) }))}
            aria-invalid={Boolean(errors.birthYear)}
            aria-describedby={errors.birthYear ? "birth-year-error" : "birth-year-hint"}
          />
          <span id="birth-year-hint" className="hint">
            We use it to find what they knew between about ages 10 and 30.
          </span>
          {errors.birthYear && (
            <span id="birth-year-error" className="field-error">
              {errors.birthYear}
            </span>
          )}
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="grew-up">Where they grew up (optional)</label>
          <input id="grew-up" className="input" autoComplete="off" value={grewUp} onChange={(event) => setGrewUp(event.target.value)} aria-describedby="grew-up-hint" />
          <span id="grew-up-hint" className="hint">
            A city or country. It helps tell their story on screen and is not sent to Qloo.
          </span>
        </div>
        <div className="field" style={{ marginBottom: 0, marginTop: "var(--space-5)" }}>
          <label htmlFor="lives-in">Where they live now (optional)</label>
          <input id="lives-in" className="input" autoComplete="off" value={livesIn} onChange={(event) => setLivesIn(event.target.value)} aria-describedby="lives-in-hint" />
          <span id="lives-in-hint" className="hint">
            City only. Used only on the comparison page, to show what a naive approach would pick.
          </span>
        </div>
      </section>

      <section className="form-section" aria-labelledby="favorites-heading">
        <h2 id="favorites-heading" tabIndex={-1}>
          What they loved
        </h2>
        <p className="hint">Fill in whatever you remember. Spelling doesn't need to be perfect.</p>
        {errors.favorites && (
          <p className="field-error" role="alert">
            {errors.favorites}
          </p>
        )}
        {GROUPS.map(({ kind, label, hint }) => (
          <fieldset key={kind} className="favorite-group">
            <legend className="field" style={{ marginBottom: "var(--space-2)" }}>
              <strong>{label}</strong>
              <span className="hint">{hint}</span>
            </legend>
            {drafts[kind].map((text, index) => (
              <div key={index} className="favorite-row">
                <input
                  className="input"
                  aria-label={`${label} ${index + 1}`}
                  autoComplete="off"
                  value={text}
                  maxLength={120}
                  onChange={(event) => updateDraft(kind, index, event.target.value)}
                />
                <button type="button" className="icon-btn" onClick={() => removeDraft(kind, index)} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}>
                  <X aria-hidden="true" size={22} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-quiet btn-small" onClick={() => addDraft(kind)} disabled={filled.length >= MAX_FAVORITES}>
              <Plus aria-hidden="true" size={18} /> Add {drafts[kind].length ? "another" : "one"}
            </button>
          </fieldset>
        ))}
      </section>

      {requestError && (
        <Notice tone="error">
          <p>{requestError}</p>
        </Notice>
      )}
      <div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
          {loading ? "Looking them up…" : "Find their favorites"}
        </button>
      </div>
    </form>
  );
}

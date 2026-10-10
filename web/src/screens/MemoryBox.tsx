import { CircleCheck, Film, Loader2, Music, RotateCcw, Tv } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type MemoryBox as Box, type MemoryItem, type MemorySection, type ReactionValue, type SectionKind } from "../api";
import { AskEncore } from "../components/AskEncore";
import { DecisionTrace } from "../components/DecisionTrace";
import { MemoryCard } from "../components/MemoryCard";
import { Notice } from "../components/Notice";
import { ResidentHeader } from "../components/ResidentHeader";
import { SectionTabs } from "../components/SectionTabs";
import { SimilarThemesDialog } from "../components/SimilarThemesDialog";
import { Timeline } from "../components/Timeline";
import { WhatQlooSees } from "../components/WhatQlooSees";
import { useResident } from "../useResident";

const SECTION_COPY: Record<SectionKind, { title: string; icon: typeof Music; noun: string }> = {
  music: { title: "Music", icon: Music, noun: "singers or bands" },
  films: { title: "Films", icon: Film, noun: "films" },
  tv: { title: "TV", icon: Tv, noun: "TV shows" },
};

const REACTION_WORDS: Record<ReactionValue, string> = { lit_up: "lit up", calm: "calm", none: "no response", distressed: "distressed" };

function SectionStatus({ section }: { section: MemorySection }) {
  const noun = SECTION_COPY[section.kind].noun;
  switch (section.status) {
    case "empty":
      return (
        <Notice tone="info">
          <p>Qloo didn't find {noun} from their youth for these favorites. Adding another favorite often helps.</p>
        </Notice>
      );
    case "needs_input":
      return (
        <Notice tone="info">
          <p>Qloo needs more to go on for {noun}. {section.summary}</p>
        </Notice>
      );
    case "error":
      return (
        <Notice tone="error">
          <p>We couldn't load {noun} right now. Please try again in a moment.</p>
        </Notice>
      );
    case "partial":
    case "degraded":
      return (
        <Notice tone="caution">
          <p>
            <strong>Lower confidence.</strong> Qloo returned incomplete results{section.summary ? `: ${section.summary}` : "."}
          </p>
        </Notice>
      );
    default:
      return null;
  }
}

const PAGE_SIZE = 6;

function Section({ section, onReact }: { section: MemorySection; onReact: (item: MemoryItem, value: ReactionValue) => Promise<void> }) {
  const { noun } = SECTION_COPY[section.kind];
  const [shown, setShown] = useState(PAGE_SIZE);
  const remaining = section.items.length - shown;
  return (
    <div className="stack">
      <SectionStatus section={section} />
      {section.basis === "inferred" && section.items.length > 0 && (
        <Notice tone="caution">
          <p>
            <strong>Lower confidence.</strong> None of their favorites were {noun}, so these come from their other favorites. Check with
            family before using them.
          </p>
        </Notice>
      )}
      {section.items.length > 0 && (
        <ul className="cards">
          {section.items.slice(0, shown).map((item) => (
            <MemoryCard key={item.entityId} item={item} onReact={(value) => onReact(item, value)} />
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <button className="btn btn-quiet" onClick={() => setShown((count) => count + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, remaining)} more {noun}
        </button>
      )}
    </div>
  );
}

const STEPS = ["Working out the years of their youth", "Asking Qloo what people with the same favorites love", "Placing each pick in their life"];

function Progress({ step }: { step: number }) {
  return (
    <div className="progress" role="status" aria-live="polite">
      <h1>Building their Memory Box</h1>
      <ol>
        {STEPS.map((label, index) => (
          <li key={label} data-state={index < step ? "done" : index === step ? "active" : "waiting"}>
            {index < step ? <CircleCheck aria-hidden="true" size={22} /> : index === step ? <Loader2 className="spin" aria-hidden="true" size={22} /> : <span style={{ width: 22 }} />}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MemoryBoxScreen({ residentId, openTrace = false }: { residentId: string; openTrace?: boolean }) {
  const { view, error: viewError, reload } = useResident(residentId);
  const [box, setBox] = useState<Box>();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<string>();
  const [themes, setThemes] = useState<{ item: MemoryItem; options: Array<{ id: string; name: string }> }>();
  const [tab, setTab] = useState<SectionKind>("music");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      setBox(await api.memoryBox(residentId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    }
  }, [residentId]);

  useEffect(() => {
    setBox(undefined);
    setError(undefined);
    setStep(0);
    // The steps describe the real work in order; the request runs while they advance.
    const timers = [setTimeout(() => setStep(1), 600), setTimeout(() => setStep(2), 2600)];
    void load().finally(() => timers.forEach(clearTimeout));
    return () => timers.forEach(clearTimeout);
  }, [load]);

  useEffect(() => {
    // Focus the heading only when the box first appears, not after each reaction.
    if (box && !updating) headingRef.current?.focus();
  }, [Boolean(box)]);

  async function react(item: MemoryItem, value: ReactionValue) {
    const result = await api.react(residentId, value, item);
    setStatus(`Saved: ${item.name}, ${REACTION_WORDS[value]}. Updating the plan…`);
    if (value === "distressed" && result.similarThemes.length) setThemes({ item, options: result.similarThemes });
    await refresh(value === "distressed" ? `${item.name} won't be suggested again.` : value === "none" ? `Noted. "No response" doesn't change the plan.` : `${item.name} is now pinned and helps Qloo find more like it.`);
  }

  async function refresh(message: string) {
    setUpdating(true);
    await load();
    reload();
    setUpdating(false);
    setStatus(`Plan updated. ${message}`);
  }

  async function avoidThemes(chosen: Array<{ id: string; name: string }>) {
    setThemes(undefined);
    if (!chosen.length) return;
    for (const theme of chosen) await api.exclude(residentId, { target: theme.id, kind: "tag", label: theme.name });
    await refresh(`Also avoiding: ${chosen.map((theme) => theme.name).join(", ")}.`);
  }

  if (viewError || error) {
    return (
      <div className="stack">
        <h1>We couldn't open this Memory Box</h1>
        <Notice tone="error">
          <p>{viewError ?? error}</p>
        </Notice>
        <button className="btn btn-primary" onClick={() => void load()}>
          <RotateCcw aria-hidden="true" size={20} /> Try again
        </button>
      </div>
    );
  }
  if (!box || !view) return <Progress step={step} />;

  return (
    <div className="stack">
      <ResidentHeader view={view} title="Their Memory Box" headingRef={headingRef} />
      <p className="sr-status" role="status" aria-live="polite">
        {status}
      </p>
      {status && (
        <Notice tone="info">
          <p>
            {updating && <Loader2 className="spin" aria-hidden="true" size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />}
            {status}
          </p>
        </Notice>
      )}
      <Timeline birthYear={view.resident.birthYear} sections={box.sections} />
      <DecisionTrace steps={box.trace} defaultOpen={openTrace} />
      <WhatQlooSees requests={box.whatQlooSaw} favorites={view.favorites} />
      <SectionTabs
        label="Kinds of memories"
        selected={tab}
        onSelect={(id) => setTab(id as SectionKind)}
        tabs={box.sections.map((section) => {
          const { title, icon: Icon } = SECTION_COPY[section.kind];
          return {
            id: section.kind,
            label: (
              <>
                <Icon aria-hidden="true" size={20} />
                {title}
                <span className="tab-count">{section.items.length}</span>
              </>
            ),
            panel: <Section key={section.kind} section={section} onReact={react} />,
          };
        })}
      />
      <AskEncore residentId={residentId} />
      {themes && <SimilarThemesDialog itemName={themes.item.name} themes={themes.options} onDone={avoidThemes} />}
    </div>
  );
}

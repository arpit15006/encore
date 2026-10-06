import { CircleCheck, Film, Loader2, Music, RotateCcw, Tv } from "lucide-react";
import { SectionTabs } from "../components/SectionTabs";
import { useEffect, useRef, useState } from "react";
import { ApiError, buildMemoryBox, type MemoryBox as Box, type MemorySection, type Person, type SectionKind } from "../api";
import { MemoryCard } from "../components/MemoryCard";
import { Notice } from "../components/Notice";
import { Timeline } from "../components/Timeline";
import { WhatQlooSees } from "../components/WhatQlooSees";
import { navigate } from "../router";

const SECTION_COPY: Record<SectionKind, { title: string; icon: typeof Music; noun: string }> = {
  music: { title: "Music", icon: Music, noun: "singers or bands" },
  films: { title: "Films", icon: Film, noun: "films" },
  tv: { title: "TV", icon: Tv, noun: "TV shows" },
};

function SectionStatus({ section }: { section: MemorySection }) {
  const noun = SECTION_COPY[section.kind].noun;
  switch (section.status) {
    case "empty":
      return (
        <Notice tone="info">
          <p>Qloo didn't find {noun} from their youth for these favorites. Adding another favorite often helps.</p>
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

function Section({ section }: { section: MemorySection }) {
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
            <MemoryCard key={item.entityId} item={item} />
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
            {index < step ? (
              <CircleCheck aria-hidden="true" size={22} />
            ) : index === step ? (
              <Loader2 className="spin" aria-hidden="true" size={22} />
            ) : (
              <span style={{ width: 22 }} />
            )}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MemoryBoxScreen({ person }: { person: Person }) {
  const [box, setBox] = useState<Box>();
  const [error, setError] = useState<string>();
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<SectionKind>("music");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    setBox(undefined);
    setError(undefined);
    setStep(0);
    // The steps describe the real work in order; the request runs while they advance.
    const timers = [setTimeout(() => setStep(1), 600), setTimeout(() => setStep(2), 2600)];
    buildMemoryBox(person)
      .then((result) => !cancelled && setBox(result))
      .catch((caught) => !cancelled && setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again."))
      .finally(() => timers.forEach(clearTimeout));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [person, attempt]);

  useEffect(() => {
    if (box) headingRef.current?.focus();
  }, [box]);

  if (error) {
    return (
      <div className="stack">
        <h1>We couldn't build the Memory Box</h1>
        <Notice tone="error">
          <p>{error}</p>
        </Notice>
        <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          <RotateCcw aria-hidden="true" size={20} /> Try again
        </button>
      </div>
    );
  }
  if (!box) return <Progress step={step} />;

  const { start, end } = box.window;
  return (
    <div className="stack">
      <div className="box-header">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            Their Memory Box
          </h1>
          <p className="lede" style={{ marginBottom: "var(--space-2)" }}>
            Born {person.birthYear}
            {person.grewUp ? `, grew up in ${person.grewUp}` : ""}. Their youth: {start}–{end}.
          </p>
          <p className="favorites-line">Built from what they loved: {person.favorites.map((favorite) => favorite.name).join(", ")}.</p>
        </div>
        <button className="btn btn-quiet" onClick={() => navigate("/start")}>
          <RotateCcw aria-hidden="true" size={20} /> Start over
        </button>
      </div>

      <Timeline birthYear={person.birthYear} sections={box.sections} />
      <WhatQlooSees requests={box.whatQlooSaw} favorites={person.favorites} />
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
            panel: <Section key={section.kind} section={section} />,
          };
        })}
      />
    </div>
  );
}

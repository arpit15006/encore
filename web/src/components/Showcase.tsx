import { useId, useState } from "react";
import { ReactionFace } from "../art/icons";
import { Keepsake, type KeepsakeKind } from "../art/keepsake";
import { Envelope, Notebook } from "../art/scenes";
import { Reveal } from "../motion";

const SHELF: Array<{ kind: KeepsakeKind; year: number }> = [
  { kind: "music", year: 1938 },
  { kind: "films", year: 1946 },
  { kind: "music", year: 1952 },
  { kind: "tv", year: 1957 },
  { kind: "music", year: 1961 },
  { kind: "films", year: 1964 },
  { kind: "music", year: 1968 },
  { kind: "tv", year: 1972 },
  { kind: "music", year: 1975 },
  { kind: "films", year: 1979 },
  { kind: "music", year: 1983 },
  { kind: "tv", year: 1986 },
];

/** A shelf of keepsakes from six decades drifting past. Decorative; it pauses on hover. */
export function RecordShelf() {
  // The row is drawn twice so the loop is seamless.
  return (
    <div className="shelf" aria-hidden="true">
      <ul className="shelf-track">
        {[...SHELF, ...SHELF].map((item, index) => (
          <li key={index}>
            <Keepsake kind={item.kind} seed={`shelf-${index % SHELF.length}`} year={item.year} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000];

/**
 * The core idea, to play with: move the birth year and watch which decades light up as their youth.
 * A native range input, so it works with keyboard, touch and screen readers.
 */
export function YouthWindow() {
  const [born, setBorn] = useState(1945);
  const id = useId();
  const start = born + 10;
  const end = born + 30;
  return (
    <section className="youth" aria-labelledby={`${id}-title`}>
      <div className="youth-head">
        <h2 id={`${id}-title`}>Familiar beats new</h2>
        <p className="hint">Memories stick best between about ages 10 and 30. Try a birth year.</p>
      </div>
      <div className="youth-control">
        <label htmlFor={`${id}-range`} className="youth-label">
          Born <span className="youth-year">{born}</span>
        </label>
        <input id={`${id}-range`} type="range" min={1925} max={1975} value={born} onChange={(event) => setBorn(Number(event.target.value))} aria-describedby={`${id}-out`} />
        <output id={`${id}-out`} htmlFor={`${id}-range`} className="youth-out" aria-live="polite">
          Their youth: <strong>{start}–{end}</strong>
        </output>
      </div>
      <ul className="youth-decades">
        {DECADES.map((decade) => {
          const lit = decade + 9 >= start && decade <= end;
          return (
            <li key={decade} data-lit={lit ? "" : undefined}>
              <Keepsake kind={decade % 20 ? "films" : "music"} seed={`youth-${decade}`} year={decade + 4} />
              <span className="youth-decade">{decade}s</span>
              <span className="visually-hidden">{lit ? ": part of their youth" : ""}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Four steps, mostly pictures: tell, find, react, share. */
export function HowItWorks() {
  const steps = [
    { title: "Tell us what they loved", art: <Notebook /> },
    {
      title: "Qloo finds their era",
      art: (
        <div className="fan">
          {[1952, 1961, 1968].map((year, index) => (
            <Keepsake key={year} kind="music" seed={`fan-${index}`} year={year} />
          ))}
        </div>
      ),
    },
    {
      title: "Tap how they respond",
      art: (
        <div className="faces">
          {(["lit_up", "calm", "none", "distressed"] as const).map((value) => (
            <ReactionFace key={value} value={value} />
          ))}
        </div>
      ),
    },
    { title: "Share a Visit Kit", art: <Envelope /> },
  ];
  return (
    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title" className="visually-hidden">
        How Encore works
      </h2>
      <ol className="how-steps">
        {steps.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 120}>
            <div className="how-art">{step.art}</div>
            <p className="how-title">
              <span className="how-number" aria-hidden="true">
                {index + 1}
              </span>
              {step.title}
            </p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

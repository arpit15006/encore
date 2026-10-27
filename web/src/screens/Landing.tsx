import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { api, type Evaluation } from "../api";
import { GlobeStamps, LockedBox, PriceTag, Stopwatch } from "../art/icons";
import { CareHome, HeroScene, Island, KeepsakeTrio, Stage } from "../art/scenes";
import { HowItWorks, RecordShelf, YouthWindow } from "../components/Showcase";
import { CountUp, Reveal, Tilt, usePointerVars } from "../motion";
import { navigate } from "../router";
import { startTour } from "../tour";

const pct = (value: number) => Math.round(value * 100);

/**
 * Real measured numbers, shown only once the evaluation has been run. Includes where Encore loses:
 * the honest overall result sits beside the born-abroad result it is strongest on.
 */
function Proof() {
  const [data, setData] = useState<Evaluation>();
  useEffect(() => {
    api.evaluation().then(setData).catch(() => undefined);
  }, []);
  if (!data) return null;
  const find = (list: Evaluation["systems"], id: string) => list.find((s) => s.id === id);
  const encore = find(data.systems, "encore");
  const plain = find(data.systems, "plain_ai");
  const naive = find(data.systems, "qloo_naive");
  const encoreAbroad = find(data.systemsBornAbroad, "encore");
  const plainAbroad = find(data.systemsBornAbroad, "plain_ai");
  if (!encore || !plain || !naive || !encoreAbroad || !plainAbroad) return null;
  const stats = [
    { value: pct(encoreAbroad.hitRate), vs: pct(plainAbroad.hitRate), text: `Born outside the UK (${data.sample.bornAbroad} people): Encore found a hidden favorite; a plain AI model ${pct(plainAbroad.hitRate)}%.` },
    { value: pct(encore.youthShare ?? 0), vs: pct(naive.youthShare ?? 0), text: "Of Encore's picks come from their youth, against Qloo used naively." },
    { value: pct(encore.hitRate), vs: pct(plain.hitRate), text: "Across everyone, the plain AI model did better, mostly on famous British music." },
  ];
  return (
    <Reveal as="section" className="proof" aria-labelledby="proof-heading">
      <div className="proof-art">
        <Island />
      </div>
      <h2 id="proof-heading">Tested on real people's lifetime favorites</h2>
      <p className="hint">
        {data.sample.evaluated} guests of BBC Radio's <em>Desert Island Discs</em>. Each system got three of their artists and had to find the
        hidden rest. A small sample: early evidence.
      </p>
      <div className="proof-stats">
        {stats.map((stat, index) => (
          <Reveal key={stat.text} delay={index * 150} className="proof-stat">
            <p className="proof-number">
              <CountUp value={stat.value} /> <span className="proof-vs">vs {stat.vs}%</span>
            </p>
            <div className="meter" aria-hidden="true">
              <span className="meter-bar" style={{ width: `${stat.value}%` }} />
              <span className="meter-mark" style={{ left: `${stat.vs}%` }} />
            </div>
            <p>{stat.text}</p>
          </Reveal>
        ))}
      </div>
      <a
        href="/evaluation"
        onClick={(event) => {
          event.preventDefault();
          navigate("/evaluation");
        }}
      >
        See the method and every number
      </a>
    </Reveal>
  );
}

function Tile({ art, title, children, delay = 0 }: { art: ReactNode; title: string; children: ReactNode; delay?: number }) {
  return (
    <Reveal className="tile" delay={delay}>
      <div className="tile-art">{art}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </Reveal>
  );
}

/** Who pays, for the people deciding whether Encore is a business. Figures are sourced in the README. */
function ForCareHomes() {
  return (
    <Reveal as="section" className="form-section care-homes" aria-labelledby="care-homes-heading">
      <div className="section-art">
        <Stage />
      </div>
      <h2 id="care-homes-heading">For care homes</h2>
      <div className="tiles">
        <Tile art={<CareHome />} title="Who it's for">
          Activity directors at 14,742 US nursing homes and ~32,000 assisted-living communities, who must match activities to each resident.
        </Tile>
        <Tile art={<Stopwatch />} title="What it saves" delay={120}>
          A family's description becomes a full plan in seconds, and reactions record what landed.
        </Tile>
        <Tile art={<PriceTag />} title="How it earns" delay={240}>
          A monthly fee per resident, paid by the home. Visit Kits stay free and bring families in.
        </Tile>
      </div>
      <p className="hint">Encore supports activities and engagement; it doesn't certify compliance or replace care professionals.</p>
    </Reveal>
  );
}

function MoreLink({ to, art, label }: { to: string; art: ReactNode; label: string }) {
  return (
    <Tilt
      as="a"
      className="more-card"
      href={to}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      <span className="more-art">{art}</span>
      <span className="more-label">
        {label} <ArrowRight aria-hidden="true" size={18} />
      </span>
    </Tilt>
  );
}

export function Landing() {
  const [starting, setStarting] = useState(false);
  const hero = usePointerVars<HTMLDivElement>();
  return (
    <>
      <div className="hero">
        <div className="hero-text">
          <p className="eyebrow">For dementia care teams and families</p>
          <h1>The songs, films and shows that still bring them back.</h1>
          <p className="lede">Tell Encore what they loved when they were young. It finds the familiar music, films and TV of their youth, and learns from how they respond.</p>
        </div>
        <div className="hero-visual" ref={hero.ref} onPointerMove={hero.onPointerMove} onPointerLeave={hero.onPointerLeave}>
          <HeroScene />
        </div>
      </div>

      <RecordShelf />

      <div className="doors">
        <Tilt as="section" className="door" aria-labelledby="door-try">
          <div className="door-visual">
            <KeepsakeTrio />
          </div>
          <h2 id="door-try">Try it on someone you love</h2>
          <p>Birth year and a few favorites. Two minutes, no names, no sign-up.</p>
          <button className="btn btn-primary" onClick={() => navigate("/start")}>
            Start <ArrowRight aria-hidden="true" size={20} />
          </button>
        </Tilt>

        <Tilt as="section" className="door" aria-labelledby="door-tour">
          <div className="door-visual">
            <CareHome />
          </div>
          <h2 id="door-tour">Take the 90-second tour</h2>
          <p>Follow a fictional resident who grew up in Mumbai, from first match to Visit Kit.</p>
          <button
            className="btn btn-quiet"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await startTour().finally(() => setStarting(false));
            }}
          >
            {starting ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null} Start the tour
          </button>
        </Tilt>
      </div>

      <HowItWorks />
      <Reveal>
        <YouthWindow />
      </Reveal>
      <Proof />
      <ForCareHomes />

      <div className="tiles promise">
        <Tile art={<GlobeStamps />} title="Their culture, not a stereotype">
          Picks grow from their own favorites, not from what's popular where they live now.
        </Tile>
        <Tile art={<LockedBox />} title="Private by design" delay={120}>
          Qloo only sees the favorites you confirm and a range of years. Reactions stay with Encore.
        </Tile>
      </div>

      <div className="more-links">
        <MoreLink to="/demo" art={<CareHome />} label="Visit the demo care home" />
        <MoreLink to="/group" art={<Stage />} label="Group session setlist" />
        <MoreLink to="/evaluation" art={<Island />} label="How we tested it" />
      </div>
    </>
  );
}

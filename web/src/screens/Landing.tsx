import { BarChart3, CalendarClock, Heart, Loader2, Map, Music4, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Evaluation } from "../api";
import { navigate } from "../router";
import { startTour } from "../tour";

const pct = (value: number) => `${Math.round(value * 100)}%`;

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
  return (
    <section className="proof" aria-labelledby="proof-heading">
      <h2 id="proof-heading">Tested on real people's lifetime favorites</h2>
      <p className="hint">
        {data.sample.evaluated} guests of BBC Radio's <em>Desert Island Discs</em>. Each system got three of a guest's artists and had to find
        the ones we hid. A small sample, so read these as early evidence.
      </p>
      <div className="proof-stats">
        <div>
          <p className="proof-number">
            {pct(encoreAbroad.hitRate)} <span className="proof-vs">vs {pct(plainAbroad.hitRate)}</span>
          </p>
          <p>
            For the {data.sample.bornAbroad} born outside the UK, Encore found a hidden favorite; a plain AI model did for {pct(plainAbroad.hitRate)}.
          </p>
        </div>
        <div>
          <p className="proof-number">
            {encore.youthShare != null ? pct(encore.youthShare) : "–"} <span className="proof-vs">vs {naive.youthShare != null ? pct(naive.youthShare) : "–"}</span>
          </p>
          <p>Of Encore's picks come from their youth, against Qloo used naively with location and age.</p>
        </div>
        <div>
          <p className="proof-number">
            {pct(encore.hitRate)} <span className="proof-vs">vs {pct(plain.hitRate)}</span>
          </p>
          <p>Across everyone, the plain AI model did better, mostly on famous British music it knows well.</p>
        </div>
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
    </section>
  );
}

export function Landing() {
  const [starting, setStarting] = useState(false);
  return (
    <>
      <h1>The songs, films and shows that still bring them back.</h1>
      <p className="lede">
        Tell Encore a few things your loved one enjoyed when they were young. It finds the music, films and TV from their youth that people
        with the same tastes love, so visits and activities feel familiar. It learns from how they respond.
      </p>

      <div className="doors">
        <section className="door" aria-labelledby="door-try">
          <div className="door-icon">
            <Heart aria-hidden="true" size={28} />
          </div>
          <h2 id="door-try">Try it on someone you love</h2>
          <p>Their birth year and a few favorites, in your own words. About two minutes. No names, no sign-up.</p>
          <button className="btn btn-primary" onClick={() => navigate("/start")}>
            Start
          </button>
        </section>

        <section className="door" aria-labelledby="door-tour">
          <div className="door-icon">
            <Map aria-hidden="true" size={28} />
          </div>
          <h2 id="door-tour">Take the 90-second tour</h2>
          <p>Follow a fictional resident who grew up in Mumbai: the comparison, her Memory Box, a reaction, a Visit Kit, and the test results.</p>
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
        </section>
      </div>

      <Proof />

      <div className="promise">
        <div className="promise-item">
          <CalendarClock aria-hidden="true" size={24} />
          <p>
            <strong>Familiar first.</strong> Most recommenders hunt for something new. Encore looks for what they met between about ages 10
            and 30, when memories stick best.
          </p>
        </div>
        <div className="promise-item">
          <Users aria-hidden="true" size={24} />
          <p>
            <strong>Their culture, not a stereotype.</strong> Picks come from their own favorites, not from what's popular where they live now.
          </p>
        </div>
        <div className="promise-item">
          <ShieldCheck aria-hidden="true" size={24} />
          <p>
            <strong>Private by design.</strong> Qloo only ever sees the favorites you confirm and a range of years. Reactions stay with Encore.
          </p>
        </div>
      </div>

      <div className="more-links">
        <a
          href="/demo"
          onClick={(event) => {
            event.preventDefault();
            navigate("/demo");
          }}
        >
          <Users aria-hidden="true" size={20} /> Visit the demo care home
        </a>
        <a
          href="/group"
          onClick={(event) => {
            event.preventDefault();
            navigate("/group");
          }}
        >
          <Music4 aria-hidden="true" size={20} /> Group session setlist
        </a>
        <a
          href="/evaluation"
          onClick={(event) => {
            event.preventDefault();
            navigate("/evaluation");
          }}
        >
          <BarChart3 aria-hidden="true" size={20} /> How we tested it
        </a>
      </div>
    </>
  );
}

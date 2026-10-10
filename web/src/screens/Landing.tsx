import { BarChart3, CalendarClock, Heart, Loader2, Map, Music4, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Evaluation } from "../api";
import { navigate } from "../router";
import { startTour } from "../tour";

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Real measured numbers, shown only once the evaluation has been run. */
function Proof() {
  const [data, setData] = useState<Evaluation>();
  useEffect(() => {
    api.evaluation().then(setData).catch(() => undefined);
  }, []);
  if (!data) return null;
  const encore = data.systems.find((s) => s.id === "encore");
  const naive = data.systems.find((s) => s.id === "qloo_naive");
  const plain = data.systems.find((s) => s.id === "plain_ai");
  if (!encore || !naive || !plain) return null;
  return (
    <section className="proof" aria-labelledby="proof-heading">
      <h2 id="proof-heading">Tested on real people's lifetime favorites</h2>
      <p className="hint">
        {data.sample.evaluated} guests of BBC Radio's <em>Desert Island Discs</em>. Each system got three of a guest's artists and had to find
        the ones we hid.
      </p>
      <div className="proof-stats">
        <div>
          <p className="proof-number">{pct(encore.hitRate)}</p>
          <p>Encore found a hidden favorite</p>
        </div>
        <div>
          <p className="proof-number">{pct(plain.hitRate)}</p>
          <p>A plain AI model, same input</p>
        </div>
        <div>
          <p className="proof-number">{encore.youthShare != null ? pct(encore.youthShare) : "–"}</p>
          <p>Encore's picks from their youth{naive.youthShare != null ? ` (naive Qloo: ${pct(naive.youthShare)})` : ""}</p>
        </div>
      </div>
      <a
        href="/evaluation"
        onClick={(event) => {
          event.preventDefault();
          navigate("/evaluation");
        }}
      >
        See the method, every number, and where Encore loses
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

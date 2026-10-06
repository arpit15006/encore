import { CalendarClock, Heart, House, ShieldCheck, Users } from "lucide-react";
import { navigate } from "../router";

export function Landing() {
  return (
    <>
      <h1>The songs, films and shows that still bring them back.</h1>
      <p className="lede">
        Tell Encore a few things your loved one enjoyed when they were young. It finds the music, films and TV from their youth that
        people with the same tastes love, so visits and activities feel familiar.
      </p>

      <div className="doors">
        <section className="door" aria-labelledby="door-try">
          <div className="door-icon">
            <Heart aria-hidden="true" size={28} />
          </div>
          <h2 id="door-try">Try it on someone you love</h2>
          <p>Their birth year and a few favorites. About two minutes. No names, no sign-up.</p>
          <button className="btn btn-primary" onClick={() => navigate("/start")}>
            Start
          </button>
        </section>

        <section className="door" aria-labelledby="door-demo">
          <div className="door-icon">
            <House aria-hidden="true" size={28} />
          </div>
          <h2 id="door-demo">Visit a demo care home</h2>
          <p>Four fictional residents who grew up in Mumbai, San Antonio, Dublin and Detroit. See how each Memory Box differs.</p>
          <button className="btn btn-quiet" onClick={() => navigate("/demo")}>
            Open the demo
          </button>
        </section>
      </div>

      <div className="promise">
        <div className="promise-item">
          <CalendarClock aria-hidden="true" size={24} />
          <p>
            <strong>Familiar first.</strong> We look for what they met between about ages 10 and 30, when memories stick best.
          </p>
        </div>
        <div className="promise-item">
          <Users aria-hidden="true" size={24} />
          <p>
            <strong>Their culture, not a stereotype.</strong> Picks come from their own favorites, not from what's popular nearby.
          </p>
        </div>
        <div className="promise-item">
          <ShieldCheck aria-hidden="true" size={24} />
          <p>
            <strong>Private by design.</strong> Qloo only ever sees the favorites you confirm and a range of years.
          </p>
        </div>
      </div>
    </>
  );
}

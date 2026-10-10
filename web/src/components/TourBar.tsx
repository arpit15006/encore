import { ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { navigate } from "../router";
import { goToStep, TOUR } from "../tour";

/** Shown at the bottom of each tour stop: where you are, what to notice, and the way on. */
export function TourBar({ step }: { step: number }) {
  const [busy, setBusy] = useState(false);
  const current = TOUR[step - 1];
  if (!current) return null;
  const last = step === TOUR.length;

  return (
    <aside className="tour-bar" aria-label="Guided tour">
      <div className="container tour-inner">
        <div>
          <p className="tour-step">
            Tour {step} of {TOUR.length}: {current.title}
          </p>
          <p className="tour-text">{current.text}</p>
        </div>
        <div className="tour-actions">
          <button className="btn btn-quiet btn-small" onClick={() => navigate(window.location.pathname)} aria-label="Leave the tour">
            <X aria-hidden="true" size={18} /> Exit
          </button>
          <button
            className="btn btn-primary btn-small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (last) navigate("/");
              else await goToStep(step + 1);
              setBusy(false);
            }}
          >
            {last ? "Finish" : "Next"} <ArrowRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

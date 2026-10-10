import { useEffect, useRef, useState } from "react";

/**
 * After a distressed reaction the item is already excluded. This asks, never assumes, whether to
 * also avoid similar themes (Qloo tags). Uses the native <dialog> for focus trapping and Escape.
 */
export function SimilarThemesDialog({
  itemName,
  themes,
  onDone,
}: {
  itemName: string;
  themes: Array<{ id: string; name: string }>;
  onDone: (chosen: Array<{ id: string; name: string }>) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const finish = (ids: string[]) => {
    ref.current?.close();
    onDone(themes.filter((theme) => ids.includes(theme.id)));
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="themes-title" onCancel={() => finish([])}>
      <h2 id="themes-title">We won't suggest {itemName} again</h2>
      <p>Should Encore also avoid things like it? Qloo describes it with these themes. Choose any to avoid, or none.</p>
      <fieldset className="theme-options">
        <legend className="visually-hidden">Themes to avoid</legend>
        {themes.map((theme) => (
          <label key={theme.id} className="candidate">
            <input
              type="checkbox"
              checked={chosen.includes(theme.id)}
              onChange={(event) => setChosen((current) => (event.target.checked ? [...current, theme.id] : current.filter((id) => id !== theme.id)))}
            />
            <span className="candidate-name">{theme.name}</span>
          </label>
        ))}
      </fieldset>
      <div className="confirm-actions">
        <button className="btn btn-quiet" onClick={() => finish([])}>
          Just this one
        </button>
        <button className="btn btn-primary" onClick={() => finish(chosen)} disabled={!chosen.length}>
          Avoid selected themes
        </button>
      </div>
    </dialog>
  );
}

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Tab {
  id: string;
  label: ReactNode;
  panel: ReactNode;
}

/** Accessible tabs (WAI-ARIA pattern): arrow keys, Home and End move between tabs. */
export function SectionTabs({ tabs, selected, onSelect, label }: { tabs: Tab[]; selected: string; onSelect: (id: string) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next == null) return;
    event.preventDefault();
    const tab = tabs[next]!;
    onSelect(tab.id);
    refs.current[tab.id]?.focus();
  };

  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            className="tab"
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== selected} tabIndex={0} className="tabpanel">
          {tab.id === selected && tab.panel}
        </div>
      ))}
    </div>
  );
}

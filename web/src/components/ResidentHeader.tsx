import type { ResidentView } from "../api";
import { ResidentNav } from "./ResidentNav";

/** Who this page is about, without a name: birth year, places and the favorites everything is built from. */
export function ResidentHeader({ view, title, headingRef }: { view: ResidentView; title: string; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const { resident, favorites } = view;
  return (
    <header className="resident-header">
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className="lede" style={{ marginBottom: "var(--space-2)" }}>
        Born {resident.birthYear}
        {resident.grewUp ? `, grew up in ${resident.grewUp}` : ""}. Their youth: {resident.birthYear + 10}–{resident.birthYear + 30}.
        {resident.demoId ? " (A fictional demo resident.)" : ""}
      </p>
      <p className="favorites-line">Built from what they loved: {favorites.map((favorite) => favorite.name).join(", ")}.</p>
      <ResidentNav residentId={resident.id} />
    </header>
  );
}

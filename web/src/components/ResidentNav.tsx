import type { MouseEvent } from "react";
import { navigate, usePath } from "../router";

/** Wayfinding between one resident's pages. Keeps any tour step in the URL. */
export function ResidentNav({ residentId }: { residentId: string }) {
  const path = usePath();
  const links = [
    { to: `/r/${residentId}`, label: "Memory Box" },
    { to: `/r/${residentId}/compare`, label: "Comparison" },
    { to: `/r/${residentId}/visit-kit`, label: "Visit Kit" },
  ];
  const go = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    event.preventDefault();
    navigate(to);
  };
  return (
    <nav className="resident-nav" aria-label="This person">
      {links.map((link) => (
        <a key={link.to} href={link.to} aria-current={path === link.to ? "page" : undefined} onClick={(event) => go(event, link.to)}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}

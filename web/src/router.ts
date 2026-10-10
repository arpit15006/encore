import { useEffect, useState } from "react";

// A small router: paths and the query string live in the URL so the back button and deep links
// (e.g. /demo, /kit/<token>) work. Screens are matched with simple patterns in App.

export function navigate(to: string): void {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

export function useLocation(): { path: string; search: URLSearchParams } {
  const read = () => ({ path: window.location.pathname, search: new URLSearchParams(window.location.search) });
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const update = () => setLocation(read());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return location;
}

export const usePath = () => useLocation().path;

/** Matches "/r/:id/compare" style patterns; returns the params or undefined. */
export function match(pattern: string, path: string): Record<string, string> | undefined {
  const names: string[] = [];
  const regex = new RegExp(
    `^${pattern.replace(/:[a-zA-Z]+/g, (segment) => {
      names.push(segment.slice(1));
      return "([^/]+)";
    })}/?$`,
  );
  const found = regex.exec(path);
  if (!found) return undefined;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1]!)]));
}

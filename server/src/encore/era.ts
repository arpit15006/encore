/**
 * Familiarity-first timing. People remember best what they met between roughly ages 10 and 30
 * (the "reminiscence bump"), so Encore looks for music, films and shows from that window.
 */

export interface YouthWindow {
  start: number;
  end: number;
}

export type EraBand = "in_era" | "unknown" | "too_late";

/** A debut just after the window can still be a youth memory. */
export const GRACE_YEARS = 2;
/** Used only when Qloo has a singer's birth date but no career start year. */
const SINGER_DEBUT_AGE = 20;

export function youthWindow(birthYear: number): YouthWindow {
  return { start: birthYear + 10, end: birthYear + 30 };
}

function yearOf(value: unknown): number | null {
  const year = Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
}

/** When an artist started out, from Qloo's own metadata. */
export function artistDebutYear(properties: Record<string, unknown> = {}): number | null {
  const start = yearOf(properties.start_year);
  if (start) return start;
  const born = yearOf(properties.date_of_birth);
  return born && properties.is_group !== true ? born + SINGER_DEBUT_AGE : null;
}

export function eraBand(year: number | null, window: YouthWindow): EraBand {
  if (year == null) return "unknown";
  return year <= window.end + GRACE_YEARS ? "in_era" : "too_late";
}

const BAND_ORDER: Record<EraBand, number> = { in_era: 0, unknown: 1, too_late: 2 };

/** Stable re-rank: in-era first, unknown next, too late last; Qloo's order is kept within each band. */
export function rankByEra<T>(items: readonly T[], bandOf: (item: T) => EraBand): T[] {
  return items
    .map((item, index) => ({ item, index, order: BAND_ORDER[bandOf(item)] }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ item }) => item);
}

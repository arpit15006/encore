import { describe, expect, it } from "vitest";
import { artistDebutYear, eraBand, rankByEra, youthWindow } from "../src/encore/era.js";

describe("youthWindow", () => {
  it("spans ages 10 to 30", () => {
    expect(youthWindow(1942)).toEqual({ start: 1952, end: 1972 });
  });
});

describe("artistDebutYear", () => {
  it("prefers Qloo's start_year", () => {
    expect(artistDebutYear({ start_year: 1930, date_of_birth: "1911-11-30" })).toBe(1930);
  });

  it("falls back to a singer's birth year + 20", () => {
    expect(artistDebutYear({ date_of_birth: "1929-08-04", is_group: false })).toBe(1949);
  });

  it("does not guess for groups without a start year", () => {
    expect(artistDebutYear({ date_of_birth: "1929-08-04", is_group: true })).toBeNull();
  });

  it("returns null when Qloo has no dates", () => {
    expect(artistDebutYear({})).toBeNull();
    expect(artistDebutYear({ start_year: "unknown" })).toBeNull();
  });
});

describe("eraBand", () => {
  const window = youthWindow(1940); // 1950–1970

  it("accepts anything up to the window end plus grace", () => {
    expect(eraBand(1930, window)).toBe("in_era");
    expect(eraBand(1972, window)).toBe("in_era");
  });

  it("flags later debuts as too late", () => {
    expect(eraBand(1973, window)).toBe("too_late");
    expect(eraBand(2002, window)).toBe("too_late");
  });

  it("marks missing years as unknown", () => {
    expect(eraBand(null, window)).toBe("unknown");
  });
});

describe("rankByEra", () => {
  it("orders bands but keeps Qloo's order inside each band", () => {
    const items = [
      { name: "late-1", band: "too_late" as const },
      { name: "era-1", band: "in_era" as const },
      { name: "unknown-1", band: "unknown" as const },
      { name: "era-2", band: "in_era" as const },
      { name: "late-2", band: "too_late" as const },
    ];
    expect(rankByEra(items, (item) => item.band).map((item) => item.name)).toEqual(["era-1", "era-2", "unknown-1", "late-1", "late-2"]);
  });
});

import type { AgeBand } from "./types";

export const AGE_BANDS: AgeBand[] = ["U12", "U13", "U14", "U15", "U16"];
export const DEFAULT_AGE_BAND: AgeBand = "U13";

export const AGE_LEGEND =
  "MLS NEXT = birth year · ECNL / US Club-style = school year where applicable.";

/** Official 2026–27 Homegrown (born on/after Jan 1 of BY). No Homegrown U12. */
export const MLS_NEXT_BAND_BIRTH_YEAR: Record<AgeBand, number> = {
  U12: 2015,
  U13: 2014,
  U14: 2013,
  U15: 2012,
  U16: 2011,
};

export function ageTabHint(band: AgeBand): string {
  if (band === "U12") return "GotSport / school year · no MLS NEXT Homegrown";
  return `MLS NEXT ${MLS_NEXT_BAND_BIRTH_YEAR[band]} BY`;
}

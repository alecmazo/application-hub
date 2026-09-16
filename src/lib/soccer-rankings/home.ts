/** Alec’s home side for 2025–26. */
export const HOME_TEAM_ID = "gs-56506";
export const HOME_GOTSPORT_ID = 56506;
export const HOME_LABEL = "Marin FC 2013/14 ECNL";
export const HOME_LISTING_NAME = "Marin FC ECNL B2013/14";

/**
 * Same program last year. GotSport reused id 56506: listings were
 * `Marin FC B14Blue` through 2024–25 / spring 2026, then renamed to
 * `Marin FC ECNL B2013/14` for this ECNL school-year side.
 * NOT 2014/15, NOT Blue 2015, NOT gs-252973.
 */
export const HOME_LAST_YEAR_LABEL = "Marin FC Blue 2014";
export const HOME_LAST_YEAR_LISTING = "Marin FC B14Blue";
export const HOME_LAST_YEAR_ID = HOME_TEAM_ID;
export const HOME_LAST_YEAR_GOTSPORT_ID = HOME_GOTSPORT_ID;

export const HOME_CONTINUITY_COPY =
  "This year: Marin FC 2013/14 ECNL · Last year: Marin FC Blue 2014";

export const HOME_NOTE =
  "This year: Marin FC 2013/14 ECNL · Last year: Marin FC Blue 2014. Same GotSport listing (56506), renamed from B14Blue. Marin FC Blue 2014/15 is a separate team — not Home and not last year.";

/**
 * Real GotSport sides that stay in the global seed, but must never be
 * Home, last-year continuity, or a “related Marin” suggestion on the Home card.
 */
export const HOME_EXCLUDED_TEAM_IDS = new Set([
  "gs-252973", // Marin FC B2014/15 Blue — this year 2014/15; last year B15Blue
  "gs-260095", // Marin FC B2014/15 Red
  "gs-367188", // Marin FC B2014/15 Steel
]);

/** Birth-year / name tokens that cannot appear on the home continuity path. */
const HOME_CONTINUITY_EXCLUDE_TOKEN =
  /2015|b2015|b15(?!\d)|\/\s*15|2014\s*\/\s*15|14\s*\/\s*15|b2014\/15/i;

export function isHomeTeam(id: string): boolean {
  return id === HOME_TEAM_ID;
}

export function isExcludedFromHomeContinuity(
  idOrName: string | undefined | null,
): boolean {
  if (!idOrName) return false;
  if (HOME_EXCLUDED_TEAM_IDS.has(idOrName)) return true;
  return HOME_CONTINUITY_EXCLUDE_TOKEN.test(idOrName);
}

export function homeSearchAliases(id: string): string {
  if (id === HOME_TEAM_ID) {
    return "home marin fc ecnl 2013-14 2013/14 marin fc blue 2014 last year b14blue";
  }
  return "";
}

/** Second-row last-year link. Same-id rename → none. Never a 2014/15 or 2015 side. */
export function resolveLinkedLastYearTeam<T extends { id: string; name: string }>(
  teams: T[],
): T | undefined {
  if (!HOME_LAST_YEAR_ID || HOME_LAST_YEAR_ID === HOME_TEAM_ID) return undefined;
  if (isExcludedFromHomeContinuity(HOME_LAST_YEAR_ID)) return undefined;
  const hit = teams.find((t) => t.id === HOME_LAST_YEAR_ID);
  if (!hit) return undefined;
  if (isExcludedFromHomeContinuity(hit.id) || isExcludedFromHomeContinuity(hit.name)) {
    return undefined;
  }
  return hit;
}

export function relatedMarinSuggestions<T extends { id: string; name: string; club?: string }>(
  teams: T[],
): T[] {
  return teams.filter((t) => {
    if (t.id === HOME_TEAM_ID) return false;
    const blob = `${t.id} ${t.name} ${t.club ?? ""}`;
    if (!/marin\s*fc/i.test(blob)) return false;
    return !isExcludedFromHomeContinuity(t.id) && !isExcludedFromHomeContinuity(blob);
  });
}

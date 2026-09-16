/** Alec’s home side for 2025–26. */
export const HOME_TEAM_ID = "gs-56506";
export const HOME_GOTSPORT_ID = 56506;
export const HOME_LABEL = "Marin FC ECNL 2013-14 boys";
export const HOME_RELATED_ID = "gs-252973";
export const HOME_RELATED_LABEL = "Marin FC B2014/15 Blue";
export const HOME_NOTE =
  "Same program last year was Marin FC 2014 Blue (renamed / realigned with this year’s school-year adjustment). ECNL U13 = 2013/14 school year.";

export function isHomeTeam(id: string): boolean {
  return id === HOME_TEAM_ID;
}

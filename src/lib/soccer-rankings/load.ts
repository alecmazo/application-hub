import boys2013 from "@/data/soccer-rankings/boys-2013.json";
import boys2014 from "@/data/soccer-rankings/boys-2014.json";
import { rankTeams } from "./compute";
import type { BirthYear, RankedDataset, TeamSeed } from "./types";

type SeedFile = {
  birthYear: BirthYear;
  ageBand: string;
  season: string;
  asOf: string;
  teams: TeamSeed[];
};

const FILES: Record<BirthYear, SeedFile> = {
  2013: boys2013 as SeedFile,
  2014: boys2014 as SeedFile,
};

export function loadRankedYear(year: BirthYear): RankedDataset {
  return rankTeams(FILES[year].teams, year);
}

export function seedAsOf(year: BirthYear): string {
  return FILES[year].asOf;
}

export function seedTeamCount(year: BirthYear): number {
  return FILES[year].teams.length;
}

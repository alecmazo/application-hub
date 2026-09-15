import catalog from "@/data/soccer-rankings/teams.json";
import { CA_UNIVERSE_ESTIMATE, COMPILED_AS_OF, rankTeams } from "./compute";
import type {
  AgeAlignment,
  BirthYear,
  CoverageMeta,
  RankedDataset,
  TeamSeed,
} from "./types";

type CatalogFile = {
  season: string;
  asOf: string;
  caUniverseEstimate?: number;
  counts?: {
    uniqueTeams: number;
    caUnique: number;
    y2013: number;
    y2014: number;
  };
  teams: Array<
    Omit<TeamSeed, "birthYear"> & {
      birthYears: BirthYear[];
    }
  >;
};

const FILE = catalog as CatalogFile;

export const COVERAGE: CoverageMeta = {
  asOf: FILE.asOf || COMPILED_AS_OF,
  uniqueTeams: FILE.counts?.uniqueTeams ?? FILE.teams.length,
  caUnique: FILE.counts?.caUnique ?? 0,
  caUniverseEstimate: FILE.caUniverseEstimate ?? CA_UNIVERSE_ESTIMATE,
  y2013: FILE.counts?.y2013 ?? 0,
  y2014: FILE.counts?.y2014 ?? 0,
};

export function loadRankedYear(year: BirthYear): RankedDataset {
  const seeds: TeamSeed[] = FILE.teams
    .filter((t) => t.birthYears.includes(year))
    .map((t) => ({
      ...t,
      birthYear: year,
    }));
  const ranked = rankTeams(seeds, year);
  return { ...ranked, coverage: COVERAGE };
}

export function alignmentLabel(alignment?: AgeAlignment): string | null {
  switch (alignment) {
    case "mls-next-u13-2014-by":
      return "MLS NEXT U13 = 2014 BY";
    case "ecnl-u13-2013-14":
      return "ECNL U13 = 2013/14 school year";
    case "school-year-2013-14":
      return "2013/14 school-year listing";
    case "u12-2014-15":
      return "GotSport U12 (2014/15 band)";
    case "u13-year-unpublished":
      return "U13 listing — birth year not published";
    default:
      return null;
  }
}

export function seedAsOf(_year?: BirthYear): string {
  return COVERAGE.asOf;
}

export function seedTeamCount(year: BirthYear): number {
  return year === 2013 ? COVERAGE.y2013 : COVERAGE.y2014;
}

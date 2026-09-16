import catalog from "@/data/soccer-rankings/teams.json";
import { AGE_BANDS, MLS_NEXT_BAND_BIRTH_YEAR } from "./age-map";
import { CA_UNIVERSE_ESTIMATE, COMPILED_AS_OF, rankTeams } from "./compute";
import type {
  AgeAlignment,
  AgeBand,
  CoverageMeta,
  RankedDataset,
  TeamSeed,
} from "./types";

type CatalogFile = {
  season: string;
  asOf: string;
  compiledAt?: string;
  caUniverseEstimate?: number;
  counts?: {
    uniqueTeams: number;
    caUnique: number;
    y2013?: number;
    y2014?: number;
    byAge?: Partial<Record<AgeBand, number>>;
  };
  teams: Array<
    Omit<TeamSeed, "ageBand" | "birthYear"> & {
      ageBands?: AgeBand[];
      birthYears?: number[];
    }
  >;
};

const FILE = catalog as CatalogFile;

export const COVERAGE: CoverageMeta = {
  asOf: FILE.asOf || COMPILED_AS_OF,
  compiledAt: FILE.compiledAt || FILE.asOf || COMPILED_AS_OF,
  uniqueTeams: FILE.counts?.uniqueTeams ?? FILE.teams.length,
  caUnique: FILE.counts?.caUnique ?? 0,
  caUniverseEstimate: FILE.caUniverseEstimate ?? CA_UNIVERSE_ESTIMATE,
  y2013: FILE.counts?.y2013 ?? 0,
  y2014: FILE.counts?.y2014 ?? 0,
  byAge: FILE.counts?.byAge ?? {},
};

export function loadRankedAge(ageBand: AgeBand): RankedDataset {
  const seeds: TeamSeed[] = FILE.teams
    .filter((t) => (t.ageBands ?? []).includes(ageBand))
    .map((t) => ({
      ...t,
      ageBand,
      birthYear: t.birthYears?.[0] ?? MLS_NEXT_BAND_BIRTH_YEAR[ageBand],
    }));
  const ranked = rankTeams(seeds, ageBand);
  return { ...ranked, coverage: COVERAGE };
}

/** @deprecated use loadRankedAge */
export function loadRankedYear(year: 2013 | 2014): RankedDataset {
  return loadRankedAge(year === 2014 ? "U13" : "U14");
}

export function alignmentLabel(alignment?: AgeAlignment): string | null {
  if (!alignment || alignment === "gotsport") return null;
  const mls = /^mls-next-(u1[2-6])-(\d{4})-by$/.exec(alignment);
  if (mls) return `MLS NEXT ${mls[1].toUpperCase()} = ${mls[2]} BY`;
  const ecnlMix = /^ecnl-(u1[2-6])-(\d{4})-(\d{2})$/.exec(alignment);
  if (ecnlMix) {
    return `ECNL ${ecnlMix[1].toUpperCase()} = ${ecnlMix[2]}/${ecnlMix[3]} school year`;
  }
  if (alignment.startsWith("ecnl-") && alignment.endsWith("-school-year")) {
    const band = alignment.slice(5, 8).toUpperCase();
    return `ECNL ${band} = school year`;
  }
  const school = /^school-year-(\d{4})-(\d{2})$/.exec(alignment);
  if (school) return `${school[1]}/${school[2]} school-year listing`;
  if (alignment.endsWith("-year-unpublished")) {
    return "Listing — birth year not published";
  }
  if (alignment === "u12-2014-15") return "2014/15 school-year listing";
  return null;
}

export function seedAsOf(_age?: AgeBand): string {
  return COVERAGE.asOf;
}

export function seedTeamCount(age: AgeBand): number {
  return COVERAGE.byAge?.[age] ?? 0;
}

export function ageBandLabels(): { key: AgeBand; label: string }[] {
  return AGE_BANDS.map((key) => ({ key, label: key }));
}

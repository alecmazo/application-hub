import catalog from "@/data/soccer-rankings/teams.json";
import type {
  BirthYear,
  LeaguePlatform,
  RankedDataset,
  RankedTeam,
  TeamSeed,
} from "./types";

type CatalogDates = { asOf?: string; compiledAt?: string };

export const SEASON_LABEL = "2025–26";
export const GOTSPORT_AS_OF =
  (catalog as CatalogDates).asOf ?? "2026-09-15";
export const COMPILED_AS_OF =
  (catalog as CatalogDates).compiledAt ?? GOTSPORT_AS_OF;
export const CA_UNIVERSE_ESTIMATE = 1100;

export const LEAGUE_LABEL: Record<LeaguePlatform, string> = {
  "mls-next": "MLS NEXT",
  "mls-next-hg": "MLS NEXT Homegrown",
  ecnl: "ECNL",
  "ecnl-rl": "ECNL-RL",
  other: "GotSport / other",
};

export const LEAGUE_FILTERS: { key: "all" | LeaguePlatform; label: string }[] =
  [
    { key: "all", label: "All leagues" },
    { key: "mls-next", label: "MLS NEXT" },
    { key: "mls-next-hg", label: "MLS NEXT HG" },
    { key: "ecnl", label: "ECNL" },
    { key: "ecnl-rl", label: "ECNL-RL" },
    { key: "other", label: "GotSport / other" },
  ];

/** League-tier prior only — slight edge, not a 90-point floor. */
export function leagueTierScore(league: LeaguePlatform): number {
  switch (league) {
    case "mls-next-hg":
      return 72;
    case "mls-next":
      return 70;
    case "ecnl":
      return 68;
    case "ecnl-rl":
      return 55;
    default:
      return 42;
  }
}

/** Map a published national list position to 0–100. Rank 1 → 100. */
export function listPositionScore(rank: number, fade = 2): number {
  if (!Number.isFinite(rank) || rank < 1) return 0;
  return Math.max(6, 100 - (rank - 1) * fade);
}

export function gotsportScore(
  points: number | undefined,
  maxPoints: number,
): number | null {
  if (points == null || !(maxPoints > 0)) return null;
  return Math.min(100, (points / maxPoints) * 100);
}

export function mlsNextScore(team: TeamSeed): number | null {
  const m = team.mlsNext;
  if (!m) return null;
  let cup: number | null = null;
  switch (m.cup) {
    case "champion":
      cup = 100;
      break;
    case "finalist":
      cup = 93;
      break;
    case "semifinalist":
      cup = 86;
      break;
    case "quarterfinalist":
      cup = 80;
      break;
    case "championship-bracket":
      cup = 74;
      break;
    case "premier-bracket":
      cup = 62;
      break;
    default:
      cup = null;
  }
  const upnext = m.upnextRank ? listPositionScore(m.upnextRank, 3) : null;
  if (cup == null && upnext == null) return null;
  if (cup == null) return upnext;
  if (upnext == null) return cup;
  return cup * 0.62 + upnext * 0.38;
}

export function compositeScore(
  team: TeamSeed,
  maxGotsportPoints: number,
): RankedTeam["scoreParts"] & { score: number } {
  const tds = team.tdsRank
    ? listPositionScore(team.tdsRank, 2)
    : team.tdsPeakRank
      ? listPositionScore(team.tdsPeakRank, 2.6) * 0.72
      : null;
  const mls = mlsNextScore(team);
  const gs = gotsportScore(team.gotsport?.points, maxGotsportPoints);
  const leagueTier = leagueTierScore(team.league);

  const parts: { w: number; v: number }[] = [];
  if (tds != null) parts.push({ w: 0.42, v: tds });
  if (mls != null) parts.push({ w: 0.28, v: mls });
  if (gs != null) parts.push({ w: 0.2, v: gs });
  parts.push({ w: 0.1, v: leagueTier });

  const totalW = parts.reduce((sum, p) => sum + p.w, 0);
  const score = parts.reduce((sum, p) => sum + p.v * (p.w / totalW), 0);

  return { tds, mlsNext: mls, gotsport: gs, leagueTier, score };
}

function compareTeams(a: RankedTeam, b: RankedTeam): number {
  if (b.score !== a.score) return b.score - a.score;
  const ga = a.gotsport?.points ?? -1;
  const gb = b.gotsport?.points ?? -1;
  if (gb !== ga) return gb - ga;
  const ta = a.tdsRank ?? 999;
  const tb = b.tdsRank ?? 999;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name);
}

export function rankTeams(
  seeds: TeamSeed[],
  birthYear: BirthYear,
): RankedDataset {
  const yearSeeds = seeds.filter((t) => t.birthYear === birthYear);
  const maxGs = yearSeeds.reduce(
    (max, t) => Math.max(max, t.gotsport?.points ?? 0),
    0,
  );

  const scored: RankedTeam[] = yearSeeds.map((seed) => {
    const parts = compositeScore(seed, maxGs);
    return {
      ...seed,
      score: parts.score,
      usRank: 0,
      stateRank: 0,
      scoreParts: {
        tds: parts.tds,
        mlsNext: parts.mlsNext,
        gotsport: parts.gotsport,
        leagueTier: parts.leagueTier,
      },
    };
  });

  scored.sort(compareTeams);
  scored.forEach((team, i) => {
    team.usRank = i + 1;
  });

  const byState = new Map<string, RankedTeam[]>();
  for (const team of scored) {
    const list = byState.get(team.state) ?? [];
    list.push(team);
    byState.set(team.state, list);
  }
  for (const list of byState.values()) {
    list
      .slice()
      .sort(compareTeams)
      .forEach((team, i) => {
        team.stateRank = i + 1;
      });
  }

  return {
    meta: {
      birthYear,
      ageBand:
        birthYear === 2014
          ? "2014 BY · MLS NEXT U13"
          : "2013 BY · ECNL U13 is 2013/14",
      season: SEASON_LABEL,
      asOf: GOTSPORT_AS_OF,
      teamCount: scored.length,
    },
    teams: scored,
  };
}

export function formatRecord(record?: {
  w: number;
  d: number;
  l: number;
}): string {
  if (!record) return "N/A";
  return `${record.w}–${record.d}–${record.l}`;
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function winPct(record?: { w: number; d: number; l: number }): number | null {
  if (!record) return null;
  const n = record.w + record.d + record.l;
  if (!n) return null;
  return (record.w + record.d * 0.5) / n;
}

export function formatPoints(points?: number): string {
  if (points == null) return "—";
  return points.toLocaleString();
}

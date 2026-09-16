export type BirthYear = 2013 | 2014;

export type LeaguePlatform =
  | "mls-next"
  | "mls-next-hg"
  | "ecnl"
  | "ecnl-rl"
  | "other";

export type AgeAlignment =
  | "mls-next-u13-2014-by"
  | "ecnl-u13-2013-14"
  | "school-year-2013-14"
  | "u12-2014-15"
  | "u13-year-unpublished"
  | "gotsport"
  | string;

export type LeagueBandFilter = "all" | "mls-next-u13" | "ecnl-u13" | "other";

export type MlsNextCupRound =
  | "champion"
  | "finalist"
  | "semifinalist"
  | "quarterfinalist"
  | "championship-bracket"
  | "premier-bracket";

export type RecordLine = {
  w: number;
  d: number;
  l: number;
  asOf?: string;
  note?: string;
};

export type TeamSeed = {
  id: string;
  name: string;
  club: string;
  city?: string;
  state: string;
  birthYear: BirthYear;
  birthYears?: BirthYear[];
  league: LeaguePlatform;
  leagueLabel: string;
  ageAlignment?: AgeAlignment;
  gotsportAge?: number;
  record?: RecordLine;
  gotsport?: {
    rank?: number;
    points?: number;
    associationRank?: number;
    asOf: string;
  };
  tdsRank?: number;
  tdsPeakRank?: number;
  tdsAsOf?: string;
  mlsNext?: {
    cup?: MlsNextCupRound;
    upnextRank?: number;
    upnextAsOf?: string;
    qopNote?: string;
    record?: RecordLine;
  };
  sources: string[];
};

export type RankedTeam = TeamSeed & {
  score: number;
  usRank: number;
  stateRank: number;
  scoreParts: {
    tds: number | null;
    mlsNext: number | null;
    gotsport: number | null;
    leagueTier: number;
  };
};

export type CompactMatch = {
  id: number;
  date: string | null;
  event: string;
  eventId: number | null;
  competition: string;
  division?: string;
  kind: "league" | "tournament" | "unknown";
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: number | null;
};

export type MatchLoadResult = {
  matches: CompactMatch[];
  source: "cache" | "live" | "none";
  partial: boolean;
  since: string;
  gotsportTeamId: number | null;
  error?: string;
};

export type SosSummary = {
  played: number;
  listed: number;
  opponentsInSeed: number;
  medianOpponentUsRank: number | null;
  top50Us: number;
  top100Us: number;
  top10State: number;
};

export type CoverageMeta = {
  asOf: string;
  compiledAt?: string;
  uniqueTeams: number;
  caUnique: number;
  caUniverseEstimate: number;
  y2013: number;
  y2014: number;
};

export type NotOnPublicFeed = {
  status: "not_yet_on_gotsport_public_feed" | "found_on_gotsport_public_feed";
  date: string;
  timezone?: string;
  reported: string;
  homeTeamId?: number;
  opponentTeamId?: number;
  note?: string;
  endpointsTried?: string[];
  matchId?: number;
  eventId?: number | null;
  event?: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type RankedDataset = {
  meta: {
    birthYear: BirthYear;
    ageBand: string;
    season: string;
    asOf: string;
    teamCount: number;
  };
  coverage?: CoverageMeta;
  teams: RankedTeam[];
};

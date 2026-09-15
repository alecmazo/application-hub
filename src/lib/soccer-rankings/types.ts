export type BirthYear = 2013 | 2014;

export type LeaguePlatform =
  | "mls-next"
  | "mls-next-hg"
  | "ecnl"
  | "ecnl-rl"
  | "other";

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
  /** ISO date the record was published, if known */
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
  league: LeaguePlatform;
  leagueLabel: string;
  record?: RecordLine;
  gotsport?: {
    rank?: number;
    points?: number;
    asOf: string;
  };
  /** Latest published TopDrawerSoccer TeamRank position (U13 2025–26). */
  tdsRank?: number;
  /**
   * Best public TDS U13 position seen in an earlier 2025–26 monthly table
   * when the team is not in the latest top 25.
   */
  tdsPeakRank?: number;
  tdsAsOf?: string;
  mlsNext?: {
    cup?: MlsNextCupRound;
    upnextRank?: number;
    upnextAsOf?: string;
    qopNote?: string;
    record?: RecordLine;
  };
  /** Public source tags shown on the row */
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

export type DatasetMeta = {
  birthYear: BirthYear;
  ageBand: string;
  season: string;
  asOf: string;
  teamCount: number;
};

export type RankedDataset = {
  meta: DatasetMeta;
  teams: RankedTeam[];
};

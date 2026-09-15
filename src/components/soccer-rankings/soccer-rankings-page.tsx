import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronLeft,
  Filter,
  MapPin,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPILED_AS_OF,
  LEAGUE_FILTERS,
  SEASON_LABEL,
  formatRecord,
  formatScore,
} from "@/lib/soccer-rankings/compute";
import { loadRankedYear } from "@/lib/soccer-rankings/load";
import type {
  BirthYear,
  LeaguePlatform,
  RankedTeam,
} from "@/lib/soccer-rankings/types";
import { cn } from "@/lib/utils";

type SortKey = "usRank" | "name" | "state" | "league" | "stateRank" | "score";
type SortDir = "asc" | "desc";
type Status = "loading" | "ready" | "error";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  IL: "Illinois",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  MI: "Michigan",
  MO: "Missouri",
  NC: "North Carolina",
  NJ: "New Jersey",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  PA: "Pennsylvania",
  TN: "Tennessee",
  TX: "Texas",
  VA: "Virginia",
  WA: "Washington",
};

function hubHomeHref(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function leagueBadgeVariant(
  league: LeaguePlatform,
): "success" | "accent" | "default" | "secondary" | "outline" {
  if (league === "mls-next" || league === "mls-next-hg") return "success";
  if (league === "ecnl") return "accent";
  if (league === "ecnl-rl") return "default";
  return "secondary";
}

function compareRows(a: RankedTeam, b: RankedTeam, key: SortKey, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  switch (key) {
    case "name":
      return mul * a.name.localeCompare(b.name);
    case "state":
      return mul * a.state.localeCompare(b.state) || a.usRank - b.usRank;
    case "league":
      return (
        mul * a.leagueLabel.localeCompare(b.leagueLabel) || a.usRank - b.usRank
      );
    case "score":
      return mul * (a.score - b.score) || a.usRank - b.usRank;
    case "stateRank":
      return mul * (a.stateRank - b.stateRank) || a.usRank - b.usRank;
    default:
      return mul * (a.usRank - b.usRank);
  }
}

export function SoccerRankingsPage() {
  const [year, setYear] = useState<BirthYear>(2013);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState<"all" | LeaguePlatform>(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("usRank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    document.title = "Soccer Rankings";
  }, []);

  useEffect(() => {
    setStatus("loading");
    setError(null);
    try {
      const ranked = loadRankedYear(year);
      setTeams(ranked.teams);
      setStatus("ready");
    } catch (e) {
      setTeams([]);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not load rankings");
    }
  }, [year]);

  const states = useMemo(() => {
    const unique = [...new Set(teams.map((t) => t.state))].sort();
    return unique;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = teams.filter((t) => {
      if (stateFilter !== "all" && t.state !== stateFilter) return false;
      if (leagueFilter !== "all" && t.league !== leagueFilter) return false;
      if (!q) return true;
      const hay = [t.name, t.club, t.city ?? "", t.state, t.leagueLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    rows.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return rows;
  }, [teams, query, stateFilter, leagueFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "score" ? "desc" : "asc");
  }

  const ageLabel = year === 2013 ? "U13" : "U12–U13";

  return (
    <div className="pitch-atmosphere min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <a
              href={hubHomeHref()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronLeft className="size-3.5" />
              Application Hub
            </a>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-success">
                <Trophy className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Boys club · {SEASON_LABEL}
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Soccer Rankings
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Unofficial US composite for {year}-born boys ({ageLabel}). Each
              row shows national rank, state rank, league, and the public
              sources behind the score.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              className="inline-flex rounded-lg border border-border bg-card p-1"
              role="tablist"
              aria-label="Birth year"
            >
              {([2013, 2014] as const).map((y) => (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={year === y}
                  onClick={() => {
                    setYear(y);
                    setStateFilter("all");
                    setQuery("");
                    setSortKey("usRank");
                    setSortDir("asc");
                  }}
                  className={cn(
                    "h-9 rounded-md px-4 text-sm font-medium transition-colors",
                    year === y
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            <p className="text-right font-mono text-[11px] text-muted-foreground">
              Data as of {COMPILED_AS_OF}
            </p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Teams in seed"
            value={status === "ready" ? String(teams.length) : "—"}
            hint={`${year} boys`}
          />
          <Stat
            label="States covered"
            value={status === "ready" ? String(states.length) : "—"}
            hint="National sample"
          />
          <Stat
            label="Showing"
            value={status === "ready" ? String(filtered.length) : "—"}
            hint={stateFilter === "all" ? "US table" : `${stateFilter} table`}
          />
          <Stat
            label="Age band"
            value={ageLabel}
            hint={SEASON_LABEL}
          />
        </section>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search club or city…"
              className="pl-9"
              aria-label="Search teams"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="size-3.5" />
              Filters
            </span>
            <label className="sr-only" htmlFor="state-filter">
              State
            </label>
            <select
              id="state-filter"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                if (e.target.value !== "all") {
                  setSortKey("stateRank");
                  setSortDir("asc");
                }
              }}
              className="h-9 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
            >
              <option value="all">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {STATE_NAMES[s] ? ` · ${STATE_NAMES[s]}` : ""}
                </option>
              ))}
            </select>
            {LEAGUE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setLeagueFilter(f.key)}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  leagueFilter === f.key
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {stateFilter !== "all" && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 text-success" />
            {STATE_NAMES[stateFilter] ?? stateFilter} table — US rank stays
            national; state rank is among {stateFilter} teams in this seed.
          </p>
        )}

        <div className="mt-5 flex-1">
          {status === "loading" && (
            <Card className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          )}

          {status === "error" && (
            <Card className="flex items-start gap-3 p-6">
              <AlertCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-medium">Could not load rankings</p>
                <p className="text-sm text-muted-foreground">
                  {error ?? "Unknown error"}
                </p>
              </div>
            </Card>
          )}

          {status === "ready" && filtered.length === 0 && (
            <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Shield className="size-6 text-muted-foreground" />
              <p className="font-medium">No teams match</p>
              <p className="text-sm text-muted-foreground">
                Clear search or widen the state / league filters.
              </p>
            </Card>
          )}

          {status === "ready" && filtered.length > 0 && (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-bg-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <SortTh
                        label="US"
                        active={sortKey === "usRank"}
                        dir={sortDir}
                        onClick={() => toggleSort("usRank")}
                      />
                      <SortTh
                        label="Team"
                        active={sortKey === "name"}
                        dir={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                      <SortTh
                        label="State"
                        active={sortKey === "state"}
                        dir={sortDir}
                        onClick={() => toggleSort("state")}
                      />
                      <SortTh
                        label="League"
                        active={sortKey === "league"}
                        dir={sortDir}
                        onClick={() => toggleSort("league")}
                      />
                      <SortTh
                        label="State #"
                        active={sortKey === "stateRank"}
                        dir={sortDir}
                        onClick={() => toggleSort("stateRank")}
                      />
                      <th className="px-3 py-3 font-medium">Record</th>
                      <SortTh
                        label="Score"
                        active={sortKey === "score"}
                        dir={sortDir}
                        onClick={() => toggleSort("score")}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border/70 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-3 font-mono-num text-base font-semibold text-primary">
                          {t.usRank}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium leading-snug">{t.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[t.city, t.state].filter(Boolean).join(", ")}
                            {t.club !== t.name ? ` · ${t.club}` : ""}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.sources.map((s) => (
                              <Badge key={s} variant="outline">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono-num">{t.state}</td>
                        <td className="px-3 py-3">
                          <Badge variant={leagueBadgeVariant(t.league)}>
                            {t.leagueLabel}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-mono-num">
                          {t.stateRank}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {t.state}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono-num text-muted-foreground">
                          {formatRecord(t.record ?? t.mlsNext?.record)}
                        </td>
                        <td className="px-3 py-3 font-mono-num font-medium">
                          {formatScore(t.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {filtered.map((t) => (
                  <Card key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold leading-tight">
                          {t.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[t.city, t.state].filter(Boolean).join(", ")} ·{" "}
                          {t.leagueLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-num text-xl font-semibold text-primary">
                          #{t.usRank}
                        </p>
                        <p className="text-[11px] text-muted-foreground">US</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <MetaChip
                        label={`${t.state} rank`}
                        value={`#${t.stateRank}`}
                      />
                      <MetaChip
                        label="Record"
                        value={formatRecord(t.record ?? t.mlsNext?.record)}
                      />
                      <MetaChip label="Score" value={formatScore(t.score)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {t.sources.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        <Card className="mt-8">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="inline-flex items-center gap-2 font-display text-lg">
                <BookOpen className="size-4 text-primary" />
                Methodology & sources
              </CardTitle>
              <CardDescription className="mt-1">
                Honest composite. No official MLS / ECNL / GotSport affiliation.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMethod((v) => !v)}
            >
              {showMethod ? "Hide" : "About"}
            </Button>
          </CardHeader>
          {showMethod && (
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Ranks are derived in-browser from a curated seed of public
                2025–26 pages.{" "}
                <strong className="text-foreground">usRank</strong> sorts
                composite score descending within the birth year.{" "}
                <strong className="text-foreground">stateRank</strong> sorts the
                same score among teams that share that state.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  TopDrawerSoccer TeamRank boys U13 (latest public table, June
                  2026 update) — not published for 2014 / U12.
                </li>
                <li>
                  MLS NEXT Cup 2026 U13 recaps (Atlanta United champion; LA
                  Galaxy finalist; Inter Miami semifinalist) and UpNext February
                  2026 power ranks as a secondary signal.
                </li>
                <li>
                  GotSport national points and W–D–L only when the public table
                  showed them.
                </li>
                <li>
                  ECNL U13 final (XF Academy / Crossfire over SDSC Surf) and
                  public club listings.
                </li>
              </ul>
              <p>
                Composite blend: TDS list position (when present), MLS NEXT Cup
                / UpNext, GotSport points scaled inside the birth year, plus a
                small league-tier prior (MLS NEXT Homegrown / Academy and ECNL
                slightly above ECNL-RL and regional). Missing fields are omitted
                — records are never invented.
              </p>
              <p>
                Refresh later by editing{" "}
                <code className="font-mono text-xs text-foreground">
                  src/data/soccer-rankings/boys-2013.json
                </code>{" "}
                and{" "}
                <code className="font-mono text-xs text-foreground">
                  boys-2014.json
                </code>
                . See{" "}
                <code className="font-mono text-xs text-foreground">
                  src/data/soccer-rankings/METHODOLOGY.md
                </code>
                .
              </p>
            </CardContent>
          )}
        </Card>

        <footer className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          Unofficial composite for personal use. Not an official ranking of MLS,
          MLS NEXT, ECNL, GotSport, or TopDrawerSoccer. Seed compiled{" "}
          {COMPILED_AS_OF}. {year} sample: {teams.length} teams.
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight font-mono-num">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-sm font-medium">{value}</p>
    </div>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}

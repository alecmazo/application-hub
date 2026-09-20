import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Home,
  MapPin,
  Search,
  Star,
  Table2,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardsTeamPanel, TeamMark } from "@/components/soccer-rankings/cards-team-panel";
import { LayoutSwitcher } from "@/components/soccer-rankings/layout-switcher";
import { MethodologyCard } from "@/components/soccer-rankings/methodology-card";
import { PinHomeButton } from "@/components/soccer-rankings/pin-home-button";
import { useRankings } from "@/components/soccer-rankings/rankings-context";
import {
  AgeLegendBadges,
  AgeTabs,
  EmptyMatches,
  LeagueSelect,
  RankingsCoverageFlag,
  RankingsFooter,
  ScopeSelect,
  SearchField,
  StatusBlocks,
} from "@/components/soccer-rankings/rankings-shared";
import { StandingsRefreshButton } from "@/components/soccer-rankings/standings-refresh-button";
import { CaLeagueTables } from "@/components/soccer-rankings/ca-league-table";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
  isHomeTeam,
  isPinnedHomeTeam,
  showHomeContinuity,
} from "@/lib/soccer-rankings/home";
import {
  leagueDisplayLabel,
  leagueTierChip,
  publishedRecord,
} from "@/lib/soccer-rankings/compute";
import { leaguePoints } from "@/lib/soccer-rankings/league-tables";
import { ECNL_SCHOOL_YEAR } from "@/lib/soccer-rankings/age-map";
import { hubHomeHref, leagueBadgeVariant } from "@/lib/soccer-rankings/use-soccer-rankings";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";
import { teamMatchesQuery } from "@/lib/soccer-rankings/use-soccer-rankings";
import { cn } from "@/lib/utils";

export function MatchdayCardsShell({
  shell,
  onChangeShell,
}: {
  shell: UiShell;
  onChangeShell: (next: UiShell) => void;
}) {
  const { pageView, setPageView, closeTeam } = useRankings();

  function choosePage(next: typeof pageView) {
    if (next === "rankings") closeTeam();
    setPageView(next);
  }

  return (
    <div className="shell-matchday flex min-h-dvh flex-col">
      <CardsTopNav
        pageView={pageView}
        onPageView={choosePage}
        shell={shell}
        onChangeShell={onChangeShell}
      />
      <div className="flex min-h-0 flex-1">
        <CardsSidebar pageView={pageView} onPageView={choosePage} />
        <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            {pageView === "ca-tables" ? <CaTablesMain /> : <CardsRankingsMain />}
            <MethodologyCard />
            <RankingsFooter />
          </main>
          <CardsTeamPanel />
        </div>
      </div>
    </div>
  );
}

function CardsTopNav({
  pageView,
  onPageView,
  shell,
  onChangeShell,
}: {
  pageView: "rankings" | "ca-tables";
  onPageView: (next: "rankings" | "ca-tables") => void;
  shell: UiShell;
  onChangeShell: (next: UiShell) => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <a href={hubHomeHref()} className="flex items-center gap-2.5">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Soccer Rankings</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              U.S. Youth & Club Soccer
            </span>
          </span>
        </a>
        <nav className="flex items-center gap-1" aria-label="Primary">
          <TopLink
            active={pageView === "rankings"}
            onClick={() => onPageView("rankings")}
          >
            Rankings
          </TopLink>
          <TopLink
            active={pageView === "ca-tables"}
            onClick={() => onPageView("ca-tables")}
          >
            CA Tables
          </TopLink>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <LayoutSwitcher shell={shell} onChange={onChangeShell} />
        <a
          href={hubHomeHref()}
          className="hidden text-right text-xs leading-tight text-muted-foreground hover:text-foreground sm:block"
        >
          <span className="block font-medium text-foreground">Application Hub</span>
          Alec Mazo
        </a>
      </div>
    </header>
  );
}

function TopLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-14 px-3 text-sm font-medium",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}

function CardsSidebar({
  pageView,
  onPageView,
}: {
  pageView: "rankings" | "ca-tables";
  onPageView: (next: "rankings" | "ca-tables") => void;
}) {
  const { standingsAsOf, setShowMethod, showMethod } = useRankings();
  const nav: Array<
    | { kind: "link"; href: string; label: string; icon: typeof Home }
    | { kind: "page"; key: "rankings" | "ca-tables"; label: string; icon: typeof Home }
  > = [
    { kind: "link", href: hubHomeHref(), label: "Home", icon: Home },
    { kind: "page", key: "rankings", label: "Rankings", icon: BarChart3 },
    { kind: "page", key: "ca-tables", label: "CA Tables", icon: Table2 },
  ];
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Rankings sections">
        {nav.map((item) => {
          const Icon = item.icon;
          if (item.kind === "link") {
            return (
              <a
                key={item.label}
                href={item.href}
                className="inline-flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4" />
                {item.label}
              </a>
            );
          }
          const active = pageView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onPageView(item.key)}
              className={cn(
                "inline-flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowMethod((v) => !v)}
          className={cn(
            "inline-flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm",
            showMethod
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <BookOpen className="size-4" />
          Methodology
        </button>
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Data updated {standingsAsOf ?? "from shipped tables"}
        </p>
      </div>
    </aside>
  );
}

function CardsRankingsMain() {
  const {
    status,
    filtered,
    pageRows,
    openTeam,
    selected,
    pinnedId,
    pinnedTeam,
    pinTeam,
    unpinHome,
    formatRecord,
    year,
    teams,
    caInYear,
  } = useRankings();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Rankings · Matchday Cards
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Matchday Cards
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Unofficial composite among seeded boys {year} sides. Official MLS
            NEXT + ECNL California tables stay on CA Tables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PinEditor />
          <StandingsRefreshButton size="sm" label="Refresh standings" />
        </div>
      </div>

      <PinnedHomeCard
        team={pinnedTeam}
        pinnedId={pinnedId}
        usCount={teams.length}
        caCount={caInYear}
        onOpen={() => pinnedTeam && openTeam(pinnedTeam.id, { scroll: false })}
        formatRecord={formatRecord}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AgeTabs variant="pills" />
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} teams
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <ScopeSelect id="matchday-scope" />
          <LeagueSelect id="matchday-league" />
        </div>
        <SearchField id="matchday-search" className="flex-1" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AgeLegendBadges />
        <RankingsCoverageFlag />
      </div>

      <StatusBlocks />
      {status === "ready" && filtered.length === 0 && <EmptyMatches />}
      {status === "ready" && filtered.length > 0 && (
        <div id="rankings-results" className="space-y-2">
          {pageRows.map((t) => {
            const rec = publishedRecord(t);
            const pts = rec ? leaguePoints(rec.w, rec.d, rec.l) : null;
            return (
              <article
                key={`${t.id}-${t.birthYear}`}
                role="button"
                tabIndex={0}
                aria-label={`Open ${t.name}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
                  isPinnedHomeTeam(t.id, pinnedId) && "border-primary/35 bg-primary/5",
                  selected?.id === t.id && "border-primary/50",
                )}
                onClick={() => openTeam(t.id, { scroll: false })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openTeam(t.id, { scroll: false });
                  }
                }}
              >
                <PinHomeButton
                  teamId={t.id}
                  teamName={t.name}
                  pinned={isPinnedHomeTeam(t.id, pinnedId)}
                  onPin={pinTeam}
                  onUnpin={unpinHome}
                  compact
                />
                <TeamMark name={t.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={t.name}>
                    {t.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant={leagueBadgeVariant(t.league)}>
                      {leagueTierChip(t.league) ??
                        leagueDisplayLabel(t.league, t.leagueLabel)}
                    </Badge>
                    {isPinnedHomeTeam(t.id, pinnedId) && (
                      <Badge variant="success">
                        {isHomeTeam(t.id) ? HOME_LABEL : "Home"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono-num text-xs text-muted-foreground">
                    US #{t.usRank}
                  </p>
                  <p className="font-mono-num text-xs text-muted-foreground">
                    {t.state} #{t.stateRank}
                  </p>
                </div>
                <div className="hidden shrink-0 grid-cols-4 gap-3 text-center md:grid">
                  <Col label="W" value={rec ? String(rec.w) : "—"} />
                  <Col label="D" value={rec ? String(rec.d) : "—"} />
                  <Col label="L" value={rec ? String(rec.l) : "—"} />
                  <Col label="PTS" value={pts != null ? String(pts) : "—"} strong />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CaTablesMain() {
  const { year } = useRankings();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Layout · CA Tables
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            California league tables
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Official MLS NEXT Homegrown/Academy and ECNL/ECNL-RL California
            boys tables. Refresh re-fetches AthleteOne (Referer theecnl.com)
            and the MLS NEXT League Viewer JSON, then updates this table and
            hydrated team records. Nothing is invented.
          </p>
        </div>
      </div>
      <AgeTabs variant="pills" />
      <div className="flex flex-wrap items-center gap-2">
        <AgeLegendBadges />
        <RankingsCoverageFlag />
      </div>
      <p className="text-xs text-muted-foreground">
        Age {year}
        {year !== "U12" ? ` · ECNL ${ECNL_SCHOOL_YEAR[year]}` : ""} · home is{" "}
        {HOME_LABEL}
      </p>
      <CaLeagueTables />
    </div>
  );
}

function PinnedHomeCard({
  team,
  pinnedId,
  usCount,
  caCount,
  onOpen,
  formatRecord,
}: {
  team: ReturnType<typeof useRankings>["pinnedTeam"];
  pinnedId: string | null;
  usCount: number;
  caCount: number;
  onOpen: () => void;
  formatRecord: (record?: { w: number; d: number; l: number }) => string;
}) {
  if (!pinnedId) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-sm text-muted-foreground">
        No pinned home team. Use Edit pinned team to choose a side — default
        is {HOME_LABEL}.
      </section>
    );
  }
  if (!team) {
    return (
      <section className="rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
        Pinned home is not in this age tab. Switch ages or pin a side from the
        list. Continuity copy appears only for {HOME_LABEL}.
      </section>
    );
  }
  const rec = publishedRecord(team);
  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-5 shadow-sm sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        Pinned home team
      </p>
      <button type="button" onClick={onOpen} className="mt-3 w-full text-left">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TeamMark name={team.name} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {team.name}
              </h2>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 text-primary" />
                {[team.city, team.state === "CA" ? "California" : team.state]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {showHomeContinuity(pinnedId) && (
                <p className="mt-1 text-xs font-medium text-foreground">
                  {HOME_CONTINUITY_COPY}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <HeroRank
              label="U.S. rank"
              value={`#${team.usRank}`}
              hint={`${usCount.toLocaleString()} teams`}
            />
            <HeroRank
              label={`${team.state} rank`}
              value={`#${team.stateRank}`}
              hint={
                team.state === "CA"
                  ? `${caCount.toLocaleString()} teams`
                  : "seeded in state"
              }
            />
            <HeroRank
              label="Record"
              value={formatRecord(rec)}
              hint={
                rec
                  ? `${leaguePoints(rec.w, rec.d, rec.l)} pts`
                  : "published only"
              }
            />
          </div>
        </div>
      </button>
    </section>
  );
}

function HeroRank({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-[8rem] rounded-xl border border-border px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono-num text-3xl font-semibold text-primary">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Col({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-[2.25rem]">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono-num text-sm",
          strong ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PinEditor() {
  const { teams, pinTeam, pinnedId, unpinHome } = useRankings();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    return teams.filter((t) => teamMatchesQuery(t, query)).slice(0, 8);
  }, [teams, q]);

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Star className="size-3.5" />
        Edit pinned team
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="text-xs font-medium text-muted-foreground">
            Search this age tab, then pin. Default home is {HOME_LABEL}.
          </p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs or teams…"
              className="h-9 pl-8"
              aria-label="Search team to pin"
            />
          </div>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {hits.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    pinTeam(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                    pinnedId === t.id && "bg-primary/10 text-primary",
                  )}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="font-mono-num text-[11px] text-muted-foreground">
                    US #{t.usRank}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pinnedId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                unpinHome();
                setOpen(false);
              }}
            >
              Unpin home
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

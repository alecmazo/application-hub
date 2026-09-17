import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
  isHomeTeam,
  isPinnedHomeTeam,
  showHomeContinuity,
} from "@/lib/soccer-rankings/home";
import { alignmentLabel } from "@/lib/soccer-rankings/load";
import {
  dualRank,
  leagueBadgeVariant,
  sosMedianLabel,
} from "@/lib/soccer-rankings/use-soccer-rankings";
import { cachedMatchCount } from "@/lib/soccer-rankings/matches";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";
import { cn } from "@/lib/utils";
import { LayoutSwitcher } from "../layout-switcher";
import { MethodologyCard } from "../methodology-card";
import { PinHomeButton } from "../pin-home-button";
import { useRankings } from "../rankings-context";
import {
  AgeAlignmentCopy,
  AgeLegendBadges,
  AgeTabs,
  AsOfStamp,
  EmptyMatches,
  HubBackLink,
  LeagueSelect,
  MetaChip,
  Pager,
  RankingsCoverageFlag,
  RankingsFooter,
  RankingsTitle,
  ResultCount,
  ScopeHint,
  ScopeSelect,
  SearchField,
  StatusBlocks,
} from "../rankings-shared";
import { TeamDetail } from "../team-detail";

export function MatchdayCardsShell({
  shell,
  onChangeShell,
}: {
  shell: UiShell;
  onChangeShell: (next: UiShell) => void;
}) {
  const {
    status,
    filtered,
    selected,
    closeTeam,
    openTeam,
    teams,
    pinnedId,
    pinnedTeam,
    pinTeam,
    unpinHome,
    matchRefreshNonce,
    pageRows,
    sosMap,
    formatRecord,
    formatScore,
  } = useRankings();

  return (
    <div className="shell-matchday min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-20 pt-6 sm:px-6">
        <header className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <HubBackLink />
              <RankingsTitle />
              <AgeAlignmentCopy />
            </div>
            <LayoutSwitcher shell={shell} onChange={onChangeShell} />
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AgeTabs variant="pills" />
            <AsOfStamp />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AgeLegendBadges />
            <RankingsCoverageFlag />
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center">
            <SearchField id="matchday-search" className="flex-1" />
            <div className="flex flex-wrap items-center gap-2">
              <ScopeSelect id="matchday-scope" />
              <LeagueSelect id="matchday-league" />
            </div>
          </div>
          <ScopeHint />
        </header>

        {pinnedId && (
          <HomeHero
            team={pinnedTeam}
            pinnedId={pinnedId}
            onOpen={() => pinnedTeam && openTeam(pinnedTeam.id)}
            onUnpin={unpinHome}
            formatRecord={formatRecord}
            formatScore={formatScore}
            sosLabel={
              pinnedTeam ? sosMedianLabel(sosMap.get(pinnedTeam.id)) : "—"
            }
          />
        )}

        <div className="relative z-10 mt-6 flex-1">
          <StatusBlocks />

          {status === "ready" && filtered.length === 0 && <EmptyMatches />}

          {status === "ready" && filtered.length > 0 && (
            <div id="rankings-results">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <ResultCount />
                <Pager />
              </div>
              <div className="grid gap-4">
                {pageRows.map((t) => (
                  <article
                    key={`${t.id}-${t.birthYear}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${t.name}`}
                    className={cn(
                      "cursor-pointer rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
                      isPinnedHomeTeam(t.id, pinnedId) &&
                        "border-success/40 bg-success/5",
                      selected?.id === t.id && "border-primary/50",
                    )}
                    onClick={() => openTeam(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTeam(t.id);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p
                          className="font-display text-xl font-semibold leading-snug sm:text-2xl"
                          title={t.name}
                        >
                          {t.name}
                        </p>
                        <p className="mt-2 font-mono-num text-sm font-medium">
                          {dualRank(t)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[t.city, t.state].filter(Boolean).join(", ")}
                          {t.club !== t.name ? ` · ${t.club}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start justify-between gap-4 sm:flex-col sm:items-end">
                        <PinHomeButton
                          teamId={t.id}
                          teamName={t.name}
                          pinned={isPinnedHomeTeam(t.id, pinnedId)}
                          onPin={pinTeam}
                          onUnpin={unpinHome}
                        />
                        <div className="text-right">
                          <p className="font-mono-num text-3xl font-semibold text-primary">
                            US #{t.usRank}
                          </p>
                          <p className="mt-1 font-mono-num text-lg font-medium">
                            {t.state} #{t.stateRank}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetaChip
                        label="Record"
                        value={formatRecord(t.record ?? t.mlsNext?.record)}
                      />
                      <MetaChip
                        label="SOS med. US"
                        value={sosMedianLabel(sosMap.get(t.id))}
                      />
                      <MetaChip label="Score" value={formatScore(t.score)} />
                      <MetaChip
                        label="Matches"
                        value={
                          cachedMatchCount(t.id) > 0
                            ? `${cachedMatchCount(t.id)}g`
                            : "—"
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant={leagueBadgeVariant(t.league)}>
                        {t.leagueLabel}
                      </Badge>
                      {isPinnedHomeTeam(t.id, pinnedId) && (
                        <Badge variant="success">
                          {isHomeTeam(t.id) ? HOME_LABEL : "Home"}
                        </Badge>
                      )}
                      {alignmentLabel(t.ageAlignment) && (
                        <Badge variant="secondary">
                          {alignmentLabel(t.ageAlignment)}
                        </Badge>
                      )}
                      {t.sources.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <Pager />
              </div>
            </div>
          )}

          {status === "ready" && selected && (
            <div id="team-page" className="mt-6 scroll-mt-6 space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeTeam}
              >
                <ChevronLeft className="size-3.5" />
                Close team
              </Button>
              <Card className="p-5 sm:p-6">
                <TeamDetail
                  team={selected}
                  yearTeams={teams}
                  onOpenTeam={openTeam}
                  pinnedHomeId={pinnedId}
                  onPinHome={pinTeam}
                  onUnpinHome={unpinHome}
                  refreshNonce={matchRefreshNonce}
                />
              </Card>
            </div>
          )}
        </div>

        <MethodologyCard />
        <RankingsFooter />
      </div>
    </div>
  );
}

function HomeHero({
  team,
  pinnedId,
  onOpen,
  onUnpin,
  formatRecord,
  formatScore,
  sosLabel,
}: {
  team: ReturnType<typeof useRankings>["pinnedTeam"];
  pinnedId: string;
  onOpen: () => void;
  onUnpin: () => void;
  formatRecord: (record?: { w: number; d: number; l: number }) => string;
  formatScore: (score: number) => string;
  sosLabel: string;
}) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-primary/30 bg-[color-mix(in_oklab,var(--color-card)_88%,var(--color-primary)_8%)] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Pinned home
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onUnpin}>
          Unpin
        </Button>
      </div>
      {team ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 w-full text-left"
        >
          <h2 className="font-display text-2xl font-semibold leading-tight sm:text-4xl">
            {team.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isHomeTeam(team.id) ? HOME_LABEL : "Home"}
            {team.club !== team.name ? ` · ${team.club}` : ""} · {team.state}
          </p>
          {showHomeContinuity(pinnedId) && (
            <p className="mt-2 text-sm font-medium text-foreground">
              {HOME_CONTINUITY_COPY}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="US rank" value={`#${team.usRank}`} />
            <HeroStat
              label={`${team.state} rank`}
              value={`#${team.stateRank}`}
            />
            <HeroStat
              label="Record"
              value={formatRecord(team.record ?? team.mlsNext?.record)}
            />
            <HeroStat label="Score" value={formatScore(team.score)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            SOS median opponent {sosLabel} · tap for schedule and match SOS
          </p>
        </button>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Pinned home is not in this age tab. Switch ages or pin a side from the
          cards below. Continuity copy appears only for {HOME_LABEL}.
        </p>
      )}
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elevated/50 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono-num text-2xl font-semibold sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

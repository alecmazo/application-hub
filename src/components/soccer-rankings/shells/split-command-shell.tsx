import { Loader2, RefreshCw, SplitSquareHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";
import { DesignLabSwitcher } from "../design-lab-switcher";
import { MethodologyCard } from "../methodology-card";
import { useRankings } from "../rankings-context";
import {
  AgeAlignmentCopy,
  AgeLegendBadges,
  AgeTabs,
  AsOfStamp,
  CompactTeamList,
  EmptyMatches,
  FilterCluster,
  HubBackLink,
  Pager,
  PinnedHomeChip,
  RankingsCoverageFlag,
  RankingsFooter,
  RankingsTable,
  RankingsTitle,
  ResultCount,
  ScopeHint,
  StatusBlocks,
} from "../rankings-shared";
import { TeamDetail } from "../team-detail";

export function SplitCommandShell({
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
    openTeam,
    teams,
    pinnedId,
    pinTeam,
    unpinHome,
    matchRefreshNonce,
    refreshFromGotsport,
    refreshingMatches,
    refreshNote,
  } = useRankings();

  return (
    <div className="shell-split-command min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[100rem] flex-col px-3 pb-16 pt-4 sm:px-5 lg:px-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <HubBackLink />
            <RankingsTitle kicker="Split Command · compare while browsing" />
            <AgeAlignmentCopy />
          </div>
          <DesignLabSwitcher shell={shell} onChange={onChangeShell} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AgeLegendBadges />
          <RankingsCoverageFlag />
        </div>

        <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)] lg:items-start">
          <section className="min-w-0">
            <div className="sticky top-0 z-20 -mx-1 mb-3 space-y-3 rounded-2xl border border-border bg-[color-mix(in_oklab,var(--color-bg)_90%,transparent)] px-3 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AgeTabs />
                <AsOfStamp />
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <FilterCluster
                  searchId="split-search"
                  scopeId="split-scope"
                  leagueId="split-league"
                />
                <PinnedHomeChip />
              </div>
              <ScopeHint />
            </div>

            <StatusBlocks />
            {status === "ready" && filtered.length === 0 && <EmptyMatches />}
            {status === "ready" && filtered.length > 0 && (
              <div id="rankings-results">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <ResultCount />
                  <Pager />
                </div>
                <RankingsTable
                  density="dense"
                  columns="split"
                  openScroll={false}
                />
                <CompactTeamList openScroll={false} />
                <div className="mt-3 flex justify-end">
                  <Pager />
                </div>
              </div>
            )}
          </section>

          <aside
            id="team-page"
            className="scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto"
          >
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <SplitSquareHorizontal className="size-3.5" />
                  Team inspector
                </p>
                <Button
                  type="button"
                  size="default"
                  onClick={() => void refreshFromGotsport()}
                  disabled={refreshingMatches}
                >
                  {refreshingMatches ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Refresh
                </Button>
              </div>
              {refreshNote && (
                <p
                  className="mb-3 text-xs leading-relaxed text-muted-foreground"
                  aria-live="polite"
                >
                  {refreshNote}
                </p>
              )}
              {selected ? (
                <TeamDetail
                  team={selected}
                  yearTeams={teams}
                  onOpenTeam={(id) => openTeam(id, { scroll: false })}
                  pinnedHomeId={pinnedId}
                  onPinHome={pinTeam}
                  onUnpinHome={unpinHome}
                  refreshNonce={matchRefreshNonce}
                  prominentRefresh
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <p className="font-medium">Select a team</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Left list stays put. Open a row to inspect US / state ranks,
                    record, match SOS, and schedule. Refresh pulls live GotSport
                    matches for the selected or pinned side — seeded ranks stay
                    compiled.
                  </p>
                </div>
              )}
            </Card>
          </aside>
        </div>

        <MethodologyCard />
        <RankingsFooter />
      </div>
    </div>
  );
}

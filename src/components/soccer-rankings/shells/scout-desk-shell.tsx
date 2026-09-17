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
  RankingsStats,
  RankingsTable,
  RankingsTitle,
  ResultCount,
  ScopeHint,
  StatusBlocks,
} from "../rankings-shared";
import { TeamDetail } from "../team-detail";
import { TeamSlideOver } from "../team-slide-over";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";

export function ScoutDeskShell({
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
    pinTeam,
    unpinHome,
    matchRefreshNonce,
  } = useRankings();

  return (
    <div className="shell-scout-desk min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[96rem] flex-col px-3 pb-16 pt-4 sm:px-5 lg:px-6">
        <div className="sticky top-0 z-30 -mx-3 mb-4 border-b border-border/80 bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] px-3 py-3 backdrop-blur-md sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <HubBackLink />
                <RankingsTitle kicker="Scout Desk · dense scan" />
              </div>
              <DesignLabSwitcher
                shell={shell}
                onChange={onChangeShell}
                compact
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AgeTabs />
              <AsOfStamp className="text-right" />
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <FilterCluster
                searchId="scout-search"
                scopeId="scout-scope"
                leagueId="scout-league"
              />
              <PinnedHomeChip />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AgeLegendBadges />
              <RankingsCoverageFlag />
            </div>
          </div>
        </div>

        <AgeAlignmentCopy />
        <div className="mt-4">
          <RankingsStats />
        </div>
        <div className="mt-3">
          <ScopeHint />
        </div>

        <div className="relative z-10 mt-4 flex-1">
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
                columns="full"
                openScroll={false}
              />
              <CompactTeamList openScroll={false} />
              <div className="mt-3 flex justify-end">
                <Pager />
              </div>
            </div>
          )}
        </div>

        <MethodologyCard />
        <RankingsFooter />
      </div>

      <TeamSlideOver
        open={Boolean(selected)}
        title={selected?.name ?? "Team detail"}
        onClose={closeTeam}
      >
        {selected && (
          <TeamDetail
            team={selected}
            yearTeams={teams}
            onOpenTeam={(id) => openTeam(id, { scroll: false })}
            pinnedHomeId={pinnedId}
            onPinHome={pinTeam}
            onUnpinHome={unpinHome}
            refreshNonce={matchRefreshNonce}
          />
        )}
      </TeamSlideOver>
    </div>
  );
}

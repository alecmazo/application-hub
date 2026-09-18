import { useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HOME_LABEL, isHomeTeam } from "@/lib/soccer-rankings/home";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";
import { CaLeagueTables } from "../ca-league-table";
import { LayoutSwitcher } from "../layout-switcher";
import { MethodologyCard } from "../methodology-card";
import { PageViewSwitcher } from "../page-view-switcher";
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
    year,
    status,
    filtered,
    selected,
    openTeam,
    teams,
    pinnedId,
    pinnedTeam,
    pinTeam,
    unpinHome,
    matchRefreshNonce,
    refreshFromGotsport,
    refreshingMatches,
    refreshNote,
    pageView,
    setPageView,
  } = useRankings();

  useEffect(() => {
    if (status !== "ready" || !pinnedTeam) return;
    openTeam(pinnedTeam.id, { scroll: false });
  }, [status, year, pinnedTeam, openTeam]);

  return (
    <div className="shell-split-command min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[100rem] flex-col px-3 pb-16 pt-5 sm:px-5 lg:px-6">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <HubBackLink />
            <RankingsTitle />
            <AgeAlignmentCopy />
          </div>
          <LayoutSwitcher shell={shell} onChange={onChangeShell} />
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <AgeLegendBadges />
          <RankingsCoverageFlag />
        </div>

        <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)] lg:items-start">
          <aside
            id="team-page"
            className="order-1 scroll-mt-4 lg:order-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto"
          >
            <Card className="border-primary/15 p-4 shadow-lg shadow-black/20">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Team
                  </p>
                  <p className="truncate font-display text-lg font-semibold leading-tight">
                    {selected
                      ? selected.name
                      : pinnedTeam
                        ? "Pinned home"
                        : "Select a team"}
                  </p>
                </div>
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
                  showRefresh={false}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <p className="font-medium">Select a team</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The list stays on the left. Open a row for US / state ranks,
                    record, match SOS, and schedule. Refresh pulls live GotSport
                    matches for the selected or pinned side — seeded ranks stay
                    compiled.
                  </p>
                  {pinnedTeam && (
                    <Button
                      type="button"
                      className="mt-4"
                      onClick={() =>
                        openTeam(pinnedTeam.id, { scroll: false })
                      }
                    >
                      Open{" "}
                      {isHomeTeam(pinnedTeam.id) ? HOME_LABEL : pinnedTeam.name}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </aside>

          <section className="order-2 min-w-0 lg:order-1">
            <div className="sticky top-0 z-20 -mx-1 mb-3 space-y-3 rounded-2xl border border-border bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] px-3 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AgeTabs />
                <div className="flex flex-wrap items-center gap-2">
                  <PageViewSwitcher view={pageView} onChange={setPageView} />
                  <AsOfStamp />
                </div>
              </div>
              {pageView === "rankings" && (
                <>
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <FilterCluster
                      searchId="split-search"
                      scopeId="split-scope"
                      leagueId="split-league"
                    />
                    <PinnedHomeChip />
                  </div>
                  <ScopeHint />
                </>
              )}
            </div>

            {pageView === "ca-tables" && <CaLeagueTables />}
            {pageView === "rankings" && <StatusBlocks />}
            {pageView === "rankings" && status === "ready" && filtered.length === 0 && <EmptyMatches />}
            {pageView === "rankings" && status === "ready" && filtered.length > 0 && (
              <div id="rankings-results">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <ResultCount />
                  <Pager />
                </div>
                <RankingsTable
                  density="comfortable"
                  columns="full"
                  openScroll={false}
                />
                <CompactTeamList openScroll={false} />
                <div className="mt-3 flex justify-end">
                  <Pager />
                </div>
              </div>
            )}
          </section>
        </div>

        <MethodologyCard />
        <RankingsFooter />
      </div>
    </div>
  );
}

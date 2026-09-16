import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPILED_AS_OF,
  GOTSPORT_AS_OF,
} from "@/lib/soccer-rankings/compute";
import { COVERAGE } from "@/lib/soccer-rankings/load";
import { MATCH_CACHE_META, NOT_ON_PUBLIC_FEED } from "@/lib/soccer-rankings/matches";

export function CoverageFlag({
  year,
  rankedCount,
  caInYear,
  onRefresh,
  refreshing,
  refreshNote,
}: {
  year: number;
  rankedCount: number;
  caInYear: number;
  onRefresh: () => void;
  refreshing: boolean;
  refreshNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const missing =
    NOT_ON_PUBLIC_FEED?.status === "not_yet_on_gotsport_public_feed";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open coverage details"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-warn/40 bg-warn/15 px-2 text-xs font-medium text-warn hover:bg-warn/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TriangleAlert className="size-3" />
          Coverage
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-sm shadow-lg outline-none"
        >
          <p className="font-medium text-foreground">Coverage</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Incomplete vs the full US — CA GotSport U12/U13 is in the seed;
            vintage universe ≈{COVERAGE.caUniverseEstimate.toLocaleString()}+.
            This view has {rankedCount.toLocaleString()} ranked {year}-born
            sides ({caInYear.toLocaleString()} California). US and state ranks
            are among seeded teams only. Match cache as of {MATCH_CACHE_META.asOf}:{" "}
            {MATCH_CACHE_META.teamsWithMatches.toLocaleString()} teams /{" "}
            {MATCH_CACHE_META.matches.toLocaleString()} games.
          </p>
          {missing && NOT_ON_PUBLIC_FEED && (
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Reported {NOT_ON_PUBLIC_FEED.date} Marin vs El Camino Salinas is
              flagged not yet on the public GotSport feed — no invented 1–0.
            </p>
          )}
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Seeded ranks stay as of {GOTSPORT_AS_OF}
            {COMPILED_AS_OF !== GOTSPORT_AS_OF
              ? ` (compiled ${COMPILED_AS_OF})`
              : ""}
            . Refresh reloads live match lists the same way team pages do.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh from GotSport
            </Button>
            {refreshNote && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {refreshNote}
              </p>
            )}
          </div>
          <Popover.Arrow className="fill-card" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveRefreshPrioritize } from "@/lib/soccer-rankings/live-standings";
import { cn } from "@/lib/utils";
import { useRankings } from "./rankings-context";

export function StandingsRefreshButton({
  prioritize,
  size = "default",
  className,
  label = "Refresh",
}: {
  prioritize?: LiveRefreshPrioritize;
  size?: "default" | "sm";
  className?: string;
  label?: string;
}) {
  const { refreshStandings, refreshingStandings, standingsNote } = useRankings();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        type="button"
        size={size}
        onClick={() => void refreshStandings(prioritize)}
        disabled={refreshingStandings}
        aria-label="Refresh official MLS NEXT and ECNL standings"
      >
        {refreshingStandings ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {refreshingStandings ? "Refreshing…" : label}
      </Button>
      {standingsNote && (
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {standingsNote}
        </p>
      )}
    </div>
  );
}

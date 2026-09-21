import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  tableScopeLabel,
  type LiveRefreshPrioritize,
} from "@/lib/soccer-rankings/live-standings";
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
  const { refreshStandings, refreshingStandings, standingsNote, standingsFailed } =
    useRankings();
  const scope = prioritize ? tableScopeLabel(prioritize) : "this table";
  const status = refreshingStandings
    ? `Refreshing ${scope}…`
    : (standingsNote ?? `Refresh updates ${scope} only.`);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        type="button"
        size={size}
        onClick={() => void refreshStandings(prioritize)}
        disabled={refreshingStandings}
        aria-busy={refreshingStandings}
        aria-label={refreshingStandings ? `Refreshing ${scope}` : `${label} ${scope}`}
        className="h-auto min-h-9 whitespace-normal px-3 py-2 text-left"
      >
        {refreshingStandings ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {refreshingStandings ? `Refreshing ${scope}…` : label}
      </Button>
      <p
        className={cn(
          "max-w-xl text-xs leading-relaxed",
          standingsFailed && !refreshingStandings
            ? "text-destructive"
            : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}

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
  const { refreshStandings, refreshingStandings } = useRankings();
  const scope = prioritize ? tableScopeLabel(prioritize) : "this table";
  return (
    <Button
      type="button"
      size={size}
      onClick={() => void refreshStandings(prioritize)}
      disabled={refreshingStandings}
      aria-busy={refreshingStandings}
      aria-label={refreshingStandings ? `Refreshing ${scope}` : `${label} ${scope}`}
      className={cn("h-9 shrink-0 whitespace-nowrap px-3", className)}
    >
      {refreshingStandings ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      {label}
    </Button>
  );
}

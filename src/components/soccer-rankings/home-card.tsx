import { Home, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  HOME_LABEL,
  HOME_NOTE,
  HOME_RELATED_LABEL,
  isHomeTeam,
} from "@/lib/soccer-rankings/home";
import { formatRecord, formatScore } from "@/lib/soccer-rankings/compute";
import { alignmentLabel } from "@/lib/soccer-rankings/load";
import type { RankedTeam } from "@/lib/soccer-rankings/types";

export function HomeTeamCard({
  team,
  related,
  onOpen,
  onOpenRelated,
}: {
  team: RankedTeam | undefined;
  related?: RankedTeam;
  onOpen: () => void;
  onOpenRelated?: () => void;
}) {
  if (!team) {
    return (
      <Card className="mt-5 border-success/30 bg-success/5 p-4">
        <p className="text-sm font-medium">Home side not in this birth-year view</p>
        <p className="mt-1 text-xs text-muted-foreground">{HOME_NOTE}</p>
      </Card>
    );
  }
  return (
    <Card
      id="home-team-card"
      className="mt-5 border-success/40 bg-success/8 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-success">
            <Home className="size-3.5" />
            Home team
          </p>
          <h2 className="font-display text-xl font-semibold leading-tight">
            {HOME_LABEL}
          </h2>
          <p className="text-sm text-muted-foreground">{team.name}</p>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {HOME_NOTE}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="accent">{team.leagueLabel}</Badge>
            {alignmentLabel(team.ageAlignment) && (
              <Badge variant="secondary">{alignmentLabel(team.ageAlignment)}</Badge>
            )}
            {isHomeTeam(team.id) && <Badge variant="success">Pinned</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-72">
          <div className="rounded-xl border border-border/80 bg-bg-elevated/50 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              US rank
            </p>
            <p className="font-display font-mono-num text-3xl font-semibold text-primary">
              #{team.usRank}
            </p>
            <p className="text-[10px] text-muted-foreground">
              unofficial · seeded teams
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-bg-elevated/50 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {team.state} rank
            </p>
            <p className="font-display font-mono-num text-3xl font-semibold">
              #{team.stateRank}
            </p>
            <p className="text-[10px] text-muted-foreground">
              among seeded {team.state}
            </p>
          </div>
          <RankChip label="Score" value={formatScore(team.score)} />
          <RankChip
            label="GS pts"
            value={team.gotsport?.points?.toLocaleString() ?? "—"}
          />
          <RankChip
            label="Record"
            value={formatRecord(team.record)}
            className="col-span-2"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onOpen();
            document.getElementById("team-detail")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          className="inline-flex h-9 items-center gap-1 rounded-md bg-success px-3 text-sm font-medium text-background"
        >
          Open schedule
          <ChevronRight className="size-3.5" />
        </button>
        {related && onOpenRelated && (
          <button
            type="button"
            onClick={onOpenRelated}
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Last year: {HOME_RELATED_LABEL} · US #{related.usRank} · {related.state} #
            {related.stateRank}
          </button>
        )}
      </div>
    </Card>
  );
}

function RankChip({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/80 bg-bg-elevated/50 px-2.5 py-1.5 ${className ?? ""}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-sm font-semibold">{value}</p>
    </div>
  );
}

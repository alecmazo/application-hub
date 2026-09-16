import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  eventHref,
  opponentCue,
  resultFor,
} from "@/lib/soccer-rankings/matches";
import { formatRecord } from "@/lib/soccer-rankings/compute";
import type { CompactMatch, RankedTeam } from "@/lib/soccer-rankings/types";

export function MatchupDetail({
  match,
  focusId,
  home,
  away,
  onOpenTeam,
}: {
  match: CompactMatch;
  focusId: number;
  home?: RankedTeam;
  away?: RankedTeam;
  onOpenTeam: (teamId: string) => void;
}) {
  const result = resultFor(focusId, match);
  const scored = match.homeScore != null && match.awayScore != null;
  const href = eventHref(match.eventId);
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        {match.date ?? "Date not published"}
        {match.division ? ` · ${match.division}` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side
          name={match.homeName}
          seed={home}
          score={match.homeScore}
          ha="Home"
          onOpen={home ? () => onOpenTeam(home.id) : undefined}
        />
        <Side
          name={match.awayName}
          seed={away}
          score={match.awayScore}
          ha="Away"
          onOpen={away ? () => onOpenTeam(away.id) : undefined}
        />
      </div>
      <p className="font-mono-num text-center text-2xl font-semibold">
        {scored ? `${match.homeScore}–${match.awayScore}` : "Score N/A"}
        {result && (
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            focus {result}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{match.kind}</Badge>
        {match.event && <Badge variant="secondary">{match.event}</Badge>}
        {match.competition && <Badge variant="outline">{match.competition}</Badge>}
      </div>
      <SosLine seed={home} label={match.homeName} />
      <SosLine seed={away} label={match.awayName} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ranks are this app’s unofficial composite among seeded teams as of the
        compiled seed — not an official GotSport live ranking at kickoff.
      </p>
      {href && (
        <Button variant="outline" size="sm" asChild>
          <a href={href} target="_blank" rel="noreferrer">
            Open event on GotSport
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}

function Side({
  name,
  seed,
  score,
  ha,
  onOpen,
}: {
  name: string;
  seed?: RankedTeam;
  score: number | null;
  ha: string;
  onOpen?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {ha}
      </p>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-0.5 text-left font-medium text-primary hover:underline"
        >
          {seed?.name ?? name}
        </button>
      ) : (
        <p className="mt-0.5 font-medium">{name}</p>
      )}
      {seed ? (
        <p className="mt-1 font-mono-num text-xs text-muted-foreground">
          US #{seed.usRank} · {seed.state} #{seed.stateRank} ·{" "}
          {formatRecord(seed.record)}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Not in this birth-year seed — no US/state rank.
        </p>
      )}
      <p className="mt-2 font-mono-num text-lg font-semibold">
        {score == null ? "—" : score}
      </p>
    </div>
  );
}

function SosLine({ seed, label }: { seed?: RankedTeam; label: string }) {
  const cue = opponentCue(seed?.usRank);
  const text =
    cue === "strong"
      ? "strong opponent (top 50 US in seed)"
      : cue === "average"
        ? "average opponent (US 51–200 in seed)"
        : cue === "weaker"
          ? "weaker opponent (US 201+ in seed)"
          : "unranked in this seed";
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-foreground">{seed?.name ?? label}</span> — {text}
      {seed ? ` · US #${seed.usRank} · ${seed.state} #${seed.stateRank}` : ""}.
    </p>
  );
}

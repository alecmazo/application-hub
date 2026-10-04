import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CA_TABLE_POINTS_NOTE,
  caTierLabel,
  defaultCaConference,
  defaultCaTier,
  ecnlTierLabel,
  formatPpg,
  loadCaLeagueTable,
  mlsTierLabel,
  caConferencesFor,
  caTableAsOf,
  resolveRankedTeam,
  type CaTablePathway,
  type CaTableTier,
  type EcnlTableTier,
  type LeagueTableRow,
  type MlsTableDivision,
} from "@/lib/soccer-rankings/league-tables";
import { HOME_LABEL } from "@/lib/soccer-rankings/home";
import { PRE_MLS_EMPTY_NOTE, tableScopeLabel } from "@/lib/soccer-rankings/live-standings";
import { cn } from "@/lib/utils";
import { LeagueMatchList } from "./league-match-list";
import { StandingsRefreshButton } from "./standings-refresh-button";
import { useRankings } from "./rankings-context";

const MLS_TIERS: { key: MlsTableDivision; label: string }[] = [
  { key: "homegrown", label: mlsTierLabel("homegrown") },
  { key: "academy", label: mlsTierLabel("academy") },
];

const ECNL_TIERS: { key: EcnlTableTier; label: string }[] = [
  { key: "ecnl", label: ecnlTierLabel("ecnl") },
  { key: "ecnl-rl", label: ecnlTierLabel("ecnl-rl") },
];

export function CaLeagueTables() {
  const {
    year,
    teams,
    openTeam,
    standingsNonce,
    refreshingStandings,
    standingsNote,
    standingsFailed,
    caTableFocus,
    openTableRow,
    setCaTableFocus,
  } = useRankings();
  const [pathway, setPathway] = useState<CaTablePathway>("ecnl");
  const [tier, setTier] = useState<CaTableTier>("ecnl");
  const [conference, setConference] = useState("Northern Cal");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const conferences = useMemo(
    () => caConferencesFor(pathway, tier, year),
    [pathway, tier, year],
  );

  useEffect(() => {
    if (conferences.includes(conference)) return;
    setConference(conferences[0] ?? defaultCaConference(pathway, tier));
  }, [conferences, conference, pathway, tier]);

  useEffect(() => {
    if (year === "U12") {
      const nextTier = defaultCaTier(pathway, year);
      if (tier !== nextTier) {
        setTier(nextTier);
        setConference(defaultCaConference(pathway, nextTier));
      }
      return;
    }
    if (tier === "pre-mls" || tier === "pre-ecnl") {
      const nextTier = defaultCaTier(pathway, year);
      setTier(nextTier);
      setConference(defaultCaConference(pathway, nextTier));
    }
  }, [year, pathway, tier]);

  useEffect(() => {
    if (refreshingStandings) setDetailsOpen(false);
  }, [refreshingStandings]);

  const rows = useMemo(
    () =>
      loadCaLeagueTable({
        pathway,
        tier,
        conference,
        ageBand: year,
      }),
    [pathway, tier, conference, year, standingsNonce],
  );

  function choosePathway(next: CaTablePathway) {
    const nextTier = defaultCaTier(next, year);
    setPathway(next);
    setTier(nextTier);
    setConference(defaultCaConference(next, nextTier));
  }

  function chooseTier(next: CaTableTier) {
    setTier(next);
    setConference(defaultCaConference(pathway, next));
  }

  function onOpenRow(row: LeagueTableRow) {
    if (caTableFocus?.key === row.key) {
      setCaTableFocus(null);
      return;
    }
    openTableRow(row);
    const hit = resolveRankedTeam(row, teams);
    if (hit) openTeam(hit.id, { scroll: false });
  }

  const asOf = caTableAsOf(pathway, { tier, conference, ageBand: year });
  const scopeLabel = tableScopeLabel({
    pathway,
    tier,
    conference: conference || "this conference",
    ageBand: year,
  });
  const tiers =
    year === "U12"
      ? pathway === "mls-next"
        ? [{ key: "pre-mls" as const, label: "Pre-MLS NEXT" }]
        : [{ key: "pre-ecnl" as const, label: "Pre-ECNL" }]
      : pathway === "mls-next"
        ? MLS_TIERS
        : ECNL_TIERS;

  return (
    <section className="min-w-0 max-w-full space-y-4" aria-label="California league tables">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card/70 p-4">
        <div
          className="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5"
          role="radiogroup"
          aria-label="California pathway"
        >
          <PathButton
            active={pathway === "mls-next"}
            onClick={() => choosePathway("mls-next")}
            label="MLS NEXT"
            hint={year === "U12" ? "Pre-MLS NEXT" : "Homegrown T1 · Academy T2"}
          />
          <PathButton
            active={pathway === "ecnl"}
            onClick={() => choosePathway("ecnl")}
            label="ECNL"
            hint={year === "U12" ? "Pre-ECNL" : "ECNL T1 · ECNL-RL T2"}
          />
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ca-table-tier">
            Division / tier
          </label>
          <select
            id="ca-table-tier"
            value={tier}
            onChange={(e) => chooseTier(e.target.value as CaTableTier)}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
          >
            {tiers.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="ca-table-conference">
            Conference
          </label>
          <select
            id="ca-table-conference"
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            className="h-9 w-full min-w-0 max-w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground sm:w-auto sm:min-w-[12rem]"
          >
            {conferences.length === 0 ? (
              <option value="">No CA table at this age</option>
            ) : (
              conferences.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </select>
          {asOf && (
            <p className="font-mono text-[11px] text-muted-foreground">
              Data updated {asOf}
            </p>
          )}
          <StandingsRefreshButton
            size="default"
            label="Refresh"
            prioritize={{ pathway, tier, conference, ageBand: year }}
          />
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="ca-table-details"
            aria-label={detailsOpen ? "Hide table notes" : "Show table notes"}
            title={detailsOpen ? "Hide table notes" : "Show table notes"}
            onClick={() => setDetailsOpen((open) => !open)}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base font-semibold leading-none",
              standingsFailed && !refreshingStandings
                ? "text-destructive"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            *
          </button>
        </div>
        {refreshingStandings && (
          <p
            className="inline-flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-3.5 animate-spin" />
            Refreshing {scopeLabel}…
          </p>
        )}
        {detailsOpen && (
          <div
            id="ca-table-details"
            className="space-y-2 text-xs leading-relaxed text-muted-foreground"
          >
            {standingsNote && (
              <p className={cn(standingsFailed && "text-destructive")}>{standingsNote}</p>
            )}
            <p>
              Official boys California conference table — not the unofficial
              composite. Age follows the tabs above. Marin FC is highlighted where
              present; home listing is {HOME_LABEL}. {CA_TABLE_POINTS_NOTE}
            </p>
          </div>
        )}
      </div>

      {rows.length === 0 && tier === "pre-mls" && (
        <Card className="p-6 text-sm text-muted-foreground">{PRE_MLS_EMPTY_NOTE}</Card>
      )}

      {rows.length === 0 && tier === "pre-ecnl" && (
        <Card className="p-6 text-sm text-muted-foreground">
          {standingsFailed
            ? `Could not load Pre-ECNL · ${conference || "this conference"}. The table was not changed.`
            : standingsNote?.includes("No published rows")
              ? `AthleteOne checked ${conference}. No published rows yet. Nothing was invented.`
              : `No Pre-ECNL rows loaded for ${conference || "this conference"} yet. Refresh pulls the AthleteOne table. An empty table is not a failed download.`}
        </Card>
      )}

      {rows.length === 0 && year !== "U12" && (
        <Card className="p-6 text-sm text-muted-foreground">
          No published {pathway === "mls-next" ? "MLS NEXT" : "ECNL"} rows for{" "}
          {year} {conference || "this conference"}. Live ingest writes
          completed games only — empty is not an invented 0–0.
        </Card>
      )}

      {rows.length > 0 && (
        <div
          className={cn("min-w-0 max-w-full", refreshingStandings && "opacity-60")}
          aria-busy={refreshingStandings}
        >
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {rows.length} sides · {conference} · {caTierLabel(tier)}
            </p>
            <Badge variant="outline">Pos = Pts then GD</Badge>
          </div>
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-card">
            <table className="w-full table-fixed border-collapse text-left text-[11px] sm:text-sm">
              <colgroup>
                <col className="w-[7.5%]" />
                <col />
                <col className="w-[6.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
                <col className="w-[10.5%]" />
                <col className="w-[10.5%]" />
              </colgroup>
              <thead className="border-b border-border bg-bg-elevated/90 text-[10px] uppercase text-muted-foreground sm:text-xs sm:tracking-wider">
                <tr>
                  <Th align="right">Pos</Th>
                  <Th>Team</Th>
                  <Th align="right">GP</Th>
                  <Th align="right">W</Th>
                  <Th align="right">D</Th>
                  <Th align="right">L</Th>
                  <Th align="right">GF</Th>
                  <Th align="right">GA</Th>
                  <Th align="right">GD</Th>
                  <Th align="right" emphasize>
                    Pts
                  </Th>
                  <Th align="right">PPG</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selected = caTableFocus?.key === row.key;
                  return (
                    <TableRows
                      key={row.key}
                      row={row}
                      selected={selected}
                      onOpen={onOpenRow}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function TableRows({
  row,
  selected,
  onOpen,
}: {
  row: LeagueTableRow;
  selected: boolean;
  onOpen: (row: LeagueTableRow) => void;
}) {
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={selected}
        aria-label={`${row.pos}. ${row.name}`}
        className={cn(
          "cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          row.homeHighlight && "border-l-2 border-l-success bg-success/15",
          row.marinHighlight &&
            !row.homeHighlight &&
            "border-l-2 border-l-success/70 bg-success/5",
          selected && "bg-primary/10",
        )}
        onClick={() => onOpen(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(row);
          }
        }}
      >
        <td className="overflow-hidden px-0.5 py-2 text-right font-mono-num text-xs font-semibold text-primary sm:px-2 sm:py-2.5 sm:text-base">
          {row.pos || "—"}
        </td>
        <td className="min-w-0 overflow-hidden px-1.5 py-2 sm:px-3 sm:py-2.5">
          <p className="truncate font-medium" title={row.name}>
            {row.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
            {row.tierLabel}
            {row.homeHighlight ? ` · ${HOME_LABEL}` : ""}
            {row.marinHighlight && !row.homeHighlight ? " · Marin FC" : ""}
          </p>
        </td>
        <Num>{row.gp}</Num>
        <Num>{row.w}</Num>
        <Num>{row.d}</Num>
        <Num>{row.l}</Num>
        <Num>{row.gf}</Num>
        <Num>{row.ga}</Num>
        <Num>{row.gd > 0 ? `+${row.gd}` : row.gd}</Num>
        <Num strong>{row.pts}</Num>
        <Num>{formatPpg(row.ppg)}</Num>
      </tr>
      {selected && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={11} className="px-2 py-3 sm:px-4 sm:py-4">
            <div className="min-w-0 max-w-full">
              <LeagueMatchList row={row} compact />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PathButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      title={hint}
      onClick={onClick}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Th({
  children,
  align = "left",
  emphasize = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  emphasize?: boolean;
}) {
  return (
    <th
      className={cn(
        "overflow-hidden px-px py-2 font-medium whitespace-nowrap sm:px-2 sm:py-3",
        align === "right" && "text-right",
        emphasize && "text-[11px] font-bold text-foreground sm:text-sm",
      )}
    >
      {children}
    </th>
  );
}

function Num({
  children,
  strong,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "overflow-hidden px-px py-2 text-right font-mono-num whitespace-nowrap sm:px-2 sm:py-2.5",
        strong
          ? "text-sm font-bold leading-none text-foreground sm:text-lg"
          : "text-[11px] font-medium text-muted-foreground sm:text-sm",
      )}
    >
      {children}
    </td>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CA_TABLE_POINTS_NOTE,
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
import { cn } from "@/lib/utils";
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
  const { year, teams, openTeam } = useRankings();
  const [pathway, setPathway] = useState<CaTablePathway>("ecnl");
  const [tier, setTier] = useState<CaTableTier>("ecnl");
  const [conference, setConference] = useState("Northern Cal");

  const conferences = useMemo(
    () => caConferencesFor(pathway, tier, year),
    [pathway, tier, year],
  );

  useEffect(() => {
    if (conferences.includes(conference)) return;
    setConference(conferences[0] ?? defaultCaConference(pathway, tier));
  }, [conferences, conference, pathway, tier]);

  const rows = useMemo(
    () =>
      loadCaLeagueTable({
        pathway,
        tier,
        conference,
        ageBand: year,
      }),
    [pathway, tier, conference, year],
  );

  function choosePathway(next: CaTablePathway) {
    const nextTier = defaultCaTier(next);
    setPathway(next);
    setTier(nextTier);
    setConference(defaultCaConference(next, nextTier));
  }

  function chooseTier(next: CaTableTier) {
    setTier(next);
    setConference(defaultCaConference(pathway, next));
  }

  function onOpenRow(row: LeagueTableRow) {
    const hit = resolveRankedTeam(row, teams);
    if (hit) openTeam(hit.id);
  }

  const asOf = caTableAsOf(pathway);
  const tiers = pathway === "mls-next" ? MLS_TIERS : ECNL_TIERS;

  return (
    <section className="space-y-4" aria-label="California league tables">
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
            hint="Homegrown T1 · Academy T2"
          />
          <PathButton
            active={pathway === "ecnl"}
            onClick={() => choosePathway("ecnl")}
            label="ECNL"
            hint="ECNL T1 · ECNL-RL T2"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            className="h-9 min-w-[12rem] rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
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
              Table as of {asOf}
            </p>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Official boys California conference table — not the unofficial
          composite. Age follows the tabs above. Marin FC is highlighted where
          present; home listing is {HOME_LABEL}. {CA_TABLE_POINTS_NOTE}
        </p>
      </div>

      {year === "U12" && (
        <Card className="p-6 text-sm text-muted-foreground">
          California MLS NEXT / ECNL league tables start at U13. Homegrown has
          no U12. Switch the age tab to see conference standings.
        </Card>
      )}

      {year !== "U12" && rows.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          No published {pathway === "mls-next" ? "MLS NEXT" : "ECNL"} rows for{" "}
          {year} {conference || "this conference"}. Live ingest writes
          completed games only — empty is not an invented 0–0.
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {rows.length} sides · {conference} ·{" "}
              {pathway === "mls-next"
                ? mlsTierLabel(tier as MlsTableDivision)
                : ecnlTierLabel(tier as EcnlTableTier)}
            </p>
            <Badge variant="outline">Pos from source table</Badge>
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-border bg-bg-elevated/90 text-xs uppercase tracking-wider text-muted-foreground">
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
                  <Th align="right">Pts</Th>
                  <Th align="right">PPG</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`${row.pos}. ${row.name}`}
                    className={cn(
                      "cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      row.homeHighlight &&
                        "border-l-2 border-l-success bg-success/15",
                      row.marinHighlight &&
                        !row.homeHighlight &&
                        "border-l-2 border-l-success/70 bg-success/5",
                    )}
                    onClick={() => onOpenRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenRow(row);
                      }
                    }}
                  >
                    <td className="px-2 py-2.5 text-right font-mono-num text-base font-semibold text-primary">
                      {row.pos || "—"}
                    </td>
                    <td className="min-w-0 px-3 py-2.5">
                      <p className="truncate font-medium" title={row.name}>
                        {row.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.tierLabel}
                        {row.homeHighlight ? ` · ${HOME_LABEL}` : ""}
                        {row.marinHighlight && !row.homeHighlight
                          ? " · Marin FC"
                          : ""}
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
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 md:hidden">
            {rows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => onOpenRow(row)}
                className={cn(
                  "rounded-xl border border-border bg-card p-3 text-left shadow-sm",
                  row.homeHighlight && "border-success/40 bg-success/10",
                  row.marinHighlight &&
                    !row.homeHighlight &&
                    "border-success/30 bg-success/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.tierLabel}
                      {row.homeHighlight ? ` · ${HOME_LABEL}` : ""}
                    </p>
                  </div>
                  <p className="font-mono-num text-lg font-semibold text-primary">
                    {row.pos || "—"}
                  </p>
                </div>
                <p className="mt-2 font-mono-num text-xs text-muted-foreground">
                  {row.gp} GP · {row.w}–{row.d}–{row.l} · GF {row.gf} GA {row.ga}{" "}
                  GD {row.gd > 0 ? `+${row.gd}` : row.gd} · {row.pts} pts
                  {row.ppg != null ? ` · ${formatPpg(row.ppg)} PPG` : ""}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
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
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-2 py-3 font-medium",
        align === "right" && "text-right",
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
        "px-2 py-2.5 text-right font-mono-num whitespace-nowrap",
        strong ? "font-semibold" : "text-muted-foreground",
      )}
    >
      {children}
    </td>
  );
}

import { RankingsProvider, useRankings } from "./rankings-context";
import { MatchdayCardsShell } from "./shells/matchday-cards-shell";
import { SplitCommandShell } from "./shells/split-command-shell";
import { useUiShell } from "@/lib/soccer-rankings/use-ui-shell";
import type { UiShell } from "@/lib/soccer-rankings/ui-shell";

function ShellSwitch({
  shell,
  onChange,
}: {
  shell: UiShell;
  onChange: (next: UiShell) => void;
}) {
  const { closeTeam } = useRankings();
  function choose(next: UiShell) {
    if (next === "matchday-cards") closeTeam();
    onChange(next);
  }
  if (shell === "matchday-cards") {
    return (
      <MatchdayCardsShell shell={shell} onChangeShell={choose} />
    );
  }
  return <SplitCommandShell shell={shell} onChangeShell={choose} />;
}

export function SoccerRankingsPage() {
  const { shell, chooseShell } = useUiShell();

  return (
    <RankingsProvider>
      <div data-ui-shell={shell}>
        <span className="sr-only">
          Layout switcher. Default is Split Command. Choice is saved in
          localStorage key soccer-rankings-ui-shell.
        </span>
        <ShellSwitch shell={shell} onChange={chooseShell} />
      </div>
    </RankingsProvider>
  );
}

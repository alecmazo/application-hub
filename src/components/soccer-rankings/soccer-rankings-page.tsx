import { RankingsProvider } from "./rankings-context";
import { MatchdayCardsShell } from "./shells/matchday-cards-shell";
import { ScoutDeskShell } from "./shells/scout-desk-shell";
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
  if (shell === "matchday-cards") {
    return (
      <MatchdayCardsShell shell={shell} onChangeShell={onChange} />
    );
  }
  if (shell === "split-command") {
    return (
      <SplitCommandShell shell={shell} onChangeShell={onChange} />
    );
  }
  return <ScoutDeskShell shell={shell} onChangeShell={onChange} />;
}

export function SoccerRankingsPage() {
  const { shell, chooseShell } = useUiShell();

  return (
    <RankingsProvider>
      <div data-ui-shell={shell} data-design-lab="temporary">
        <span className="sr-only">
          Temporary Design Lab. Switch UI shells with the Design control.
          Choice is saved in localStorage key soccer-rankings-ui-shell.
        </span>
        <ShellSwitch shell={shell} onChange={chooseShell} />
      </div>
    </RankingsProvider>
  );
}

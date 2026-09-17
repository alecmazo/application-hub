import { FlaskConical } from "lucide-react";
import {
  UI_SHELL_BLURBS,
  UI_SHELL_LABELS,
  UI_SHELLS,
  type UiShell,
} from "@/lib/soccer-rankings/ui-shell";
import { cn } from "@/lib/utils";

export function DesignLabSwitcher({
  shell,
  onChange,
  compact = false,
}: {
  shell: UiShell;
  onChange: (next: UiShell) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-warn/35 bg-warn/10",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn">
          <FlaskConical className="size-3.5" />
          Temporary Design Lab
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Same data — pick a shell. Not the final UI.
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div
          className="inline-flex flex-nowrap rounded-lg border border-border bg-card p-1"
          role="radiogroup"
          aria-label="Design Lab UI shell"
        >
          {UI_SHELLS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={shell === key}
              title={UI_SHELL_BLURBS[key]}
              onClick={() => onChange(key)}
              className={cn(
                "h-8 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3",
                shell === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {UI_SHELL_LABELS[key]}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {UI_SHELL_BLURBS[shell]}
        </p>
      </div>
    </div>
  );
}

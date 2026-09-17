import { LayoutTemplate } from "lucide-react";
import {
  UI_SHELL_BLURBS,
  UI_SHELL_LABELS,
  UI_SHELLS,
  type UiShell,
} from "@/lib/soccer-rankings/ui-shell";
import { cn } from "@/lib/utils";

export function LayoutSwitcher({
  shell,
  onChange,
}: {
  shell: UiShell;
  onChange: (next: UiShell) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <LayoutTemplate className="size-3.5" />
        Layout
      </span>
      <div
        className="inline-flex rounded-lg border border-border bg-card p-0.5"
        role="radiogroup"
        aria-label="Rankings layout"
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
              "h-8 rounded-md px-2.5 text-xs font-medium transition-colors",
              shell === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {UI_SHELL_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

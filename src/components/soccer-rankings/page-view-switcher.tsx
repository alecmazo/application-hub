import { Table2, Trophy } from "lucide-react";
import {
  type PageView,
} from "@/lib/soccer-rankings/league-tables";
import { cn } from "@/lib/utils";

const VIEWS: { key: PageView; label: string; blurb: string; icon: typeof Trophy }[] =
  [
    {
      key: "rankings",
      label: "Rankings",
      blurb: "Unofficial composite among seeded teams",
      icon: Trophy,
    },
    {
      key: "ca-tables",
      label: "CA Tables",
      blurb: "Official MLS NEXT + ECNL California conference tables",
      icon: Table2,
    },
  ];

export function PageViewSwitcher({
  view,
  onChange,
}: {
  view: PageView;
  onChange: (next: PageView) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-0.5"
      role="radiogroup"
      aria-label="Rankings or California league tables"
    >
      {VIEWS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={view === item.key}
            title={item.blurb}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              view === item.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

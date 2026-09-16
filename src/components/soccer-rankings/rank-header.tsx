import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortDir = "asc" | "desc";

export function RankHeader({
  label,
  active,
  dir,
  onClick,
  explain,
  align = "right",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  explain: string;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  const tipId = `rank-tip-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <th
      className={cn(
        "group relative px-2 py-3 font-medium",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-describedby={tipId}
        title={explain}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3" />
      </button>
      <div
        id={tipId}
        role="tooltip"
        className="pointer-events-none invisible absolute top-full left-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 text-left text-xs font-normal normal-case tracking-normal text-muted-foreground opacity-0 shadow-lg group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {explain}
      </div>
    </th>
  );
}

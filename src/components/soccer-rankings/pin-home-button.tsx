import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export function PinHomeButton({
  teamId,
  teamName,
  pinned,
  onPin,
  onUnpin,
  compact = false,
}: {
  teamId: string;
  teamName: string;
  pinned: boolean;
  onPin: (id: string) => void;
  onUnpin: () => void;
  compact?: boolean;
}) {
  const label = pinned
    ? `Unpin ${teamName} as home`
    : `Pin ${teamName} as home`;

  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "size-7 justify-center px-0" : "h-8 px-2.5",
        pinned
          ? "border-success/40 bg-success/15 text-success hover:bg-success/25"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pinned) onUnpin();
        else onPin(teamId);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Pin className={cn("size-3.5", pinned && "fill-current")} />
      {!compact && (pinned ? "Unpin home" : "Pin as home")}
    </button>
  );
}

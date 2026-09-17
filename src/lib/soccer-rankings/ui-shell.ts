/**
 * Rankings layout. Split Command is the site default.
 * Matchday Cards stays available as an alternate. Scout Desk was retired.
 */
export const UI_SHELL_STORAGE_KEY = "soccer-rankings-ui-shell";

export const UI_SHELLS = ["split-command", "matchday-cards"] as const;

export type UiShell = (typeof UI_SHELLS)[number];

/** New visitors land on Split Command. */
export const DEFAULT_UI_SHELL: UiShell = "split-command";

export const UI_SHELL_LABELS: Record<UiShell, string> = {
  "split-command": "Split",
  "matchday-cards": "Cards",
};

export const UI_SHELL_BLURBS: Record<UiShell, string> = {
  "split-command": "List + team detail",
  "matchday-cards": "Pinned-home hero and cards",
};

export function isUiShell(value: string | null | undefined): value is UiShell {
  return Boolean(value && (UI_SHELLS as readonly string[]).includes(value));
}

export function readUiShell(): UiShell {
  if (typeof window === "undefined") return DEFAULT_UI_SHELL;
  try {
    const raw = window.localStorage.getItem(UI_SHELL_STORAGE_KEY);
    if (raw === "matchday-cards") return "matchday-cards";
    if (raw === "scout-desk") {
      writeUiShell(DEFAULT_UI_SHELL);
      return DEFAULT_UI_SHELL;
    }
    return isUiShell(raw) ? raw : DEFAULT_UI_SHELL;
  } catch {
    return DEFAULT_UI_SHELL;
  }
}

export function writeUiShell(shell: UiShell): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_SHELL_STORAGE_KEY, shell);
  } catch {
    /* private mode / quota */
  }
}

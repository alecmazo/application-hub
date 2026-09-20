/**
 * Rankings layout. Matchday Cards (view B) is the site default and the
 * design-token source (DM Sans, forest green, light surfaces). Split Command
 * stays available as an alternate and shares those tokens. Scout Desk was retired.
 */
export const UI_SHELL_STORAGE_KEY = "soccer-rankings-ui-shell";

export const UI_SHELLS = ["matchday-cards", "split-command"] as const;

export type UiShell = (typeof UI_SHELLS)[number];

/** New visitors land on Matchday Cards. */
export const DEFAULT_UI_SHELL: UiShell = "matchday-cards";

export const UI_SHELL_LABELS: Record<UiShell, string> = {
  "matchday-cards": "Cards",
  "split-command": "Split",
};

export const UI_SHELL_BLURBS: Record<UiShell, string> = {
  "matchday-cards": "Pinned-home hero and cards",
  "split-command": "List + team detail",
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

/**
 * Temporary Design Lab — three live UI shells over the same rankings data.
 * Do not remove until Alec picks a winner in a later follow-up.
 */
export const UI_SHELL_STORAGE_KEY = "soccer-rankings-ui-shell";

export const UI_SHELLS = [
  "scout-desk",
  "matchday-cards",
  "split-command",
] as const;

export type UiShell = (typeof UI_SHELLS)[number];

/** Closest to the current dense table until Alec chooses. */
export const DEFAULT_UI_SHELL: UiShell = "scout-desk";

export const UI_SHELL_LABELS: Record<UiShell, string> = {
  "scout-desk": "Scout Desk",
  "matchday-cards": "Matchday Cards",
  "split-command": "Split Command",
};

export const UI_SHELL_BLURBS: Record<UiShell, string> = {
  "scout-desk": "Dense analytics table with a sticky filter rail",
  "matchday-cards": "Airy cards plus a pinned-home hero",
  "split-command": "Always-on list + team detail split",
};

export function isUiShell(value: string | null | undefined): value is UiShell {
  return Boolean(value && (UI_SHELLS as readonly string[]).includes(value));
}

export function readUiShell(): UiShell {
  if (typeof window === "undefined") return DEFAULT_UI_SHELL;
  try {
    const raw = window.localStorage.getItem(UI_SHELL_STORAGE_KEY);
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

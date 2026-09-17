import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_UI_SHELL,
  readUiShell,
  writeUiShell,
  type UiShell,
} from "./ui-shell";

export function useUiShell() {
  const [shell, setShell] = useState<UiShell>(DEFAULT_UI_SHELL);

  useEffect(() => {
    setShell(readUiShell());
  }, []);

  const chooseShell = useCallback((next: UiShell) => {
    setShell(next);
    writeUiShell(next);
  }, []);

  return { shell, chooseShell };
}

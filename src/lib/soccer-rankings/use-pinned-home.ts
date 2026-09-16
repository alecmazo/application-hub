import { useCallback, useEffect, useState } from "react";
import {
  HOME_TEAM_ID,
  readPinnedHomeId,
  writePinnedHomeId,
} from "./home";

export function usePinnedHomeTeam() {
  const [pinnedId, setPinnedId] = useState<string | null>(HOME_TEAM_ID);

  useEffect(() => {
    setPinnedId(readPinnedHomeId());
  }, []);

  const pinTeam = useCallback((id: string) => {
    writePinnedHomeId(id);
    setPinnedId(id);
  }, []);

  const unpinHome = useCallback(() => {
    writePinnedHomeId("");
    setPinnedId(null);
  }, []);

  return { pinnedId, pinTeam, unpinHome };
}

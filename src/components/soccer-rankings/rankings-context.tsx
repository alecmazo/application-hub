import { createContext, useContext, type ReactNode } from "react";
import {
  useSoccerRankings,
  type SoccerRankingsModel,
} from "@/lib/soccer-rankings/use-soccer-rankings";

const RankingsContext = createContext<SoccerRankingsModel | null>(null);

export function RankingsProvider({ children }: { children: ReactNode }) {
  const model = useSoccerRankings();
  return (
    <RankingsContext.Provider value={model}>
      {children}
    </RankingsContext.Provider>
  );
}

export function useRankings(): SoccerRankingsModel {
  const ctx = useContext(RankingsContext);
  if (!ctx) {
    throw new Error("useRankings must be used within RankingsProvider");
  }
  return ctx;
}

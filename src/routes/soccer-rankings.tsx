import { createFileRoute } from "@tanstack/react-router";
import { SoccerRankingsPage } from "@/components/soccer-rankings/soccer-rankings-page";

export const Route = createFileRoute("/soccer-rankings")({
  component: SoccerRankingsPage,
  head: () => ({
    meta: [
      { title: "Soccer Rankings" },
      {
        name: "description",
        content:
          "Unofficial US boys club soccer rankings for 2013 and 2014 birth years — national and state tables from public sources.",
      },
    ],
  }),
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppHub } from "@/components/app-hub";
import { SoccerRankingsPage } from "@/components/soccer-rankings/soccer-rankings-page";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

function spaPath(): string {
  const raw = window.location.pathname;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const stripped = base && raw.startsWith(base) ? raw.slice(base.length) : raw;
  return stripped.replace(/\/$/, "") || "/";
}

const page = spaPath() === "/soccer-rankings" ? <SoccerRankingsPage /> : <AppHub />;

createRoot(root).render(<StrictMode>{page}</StrictMode>);

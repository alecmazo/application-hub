import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppHub } from "@/components/app-hub";
import "./styles.css";

function requireRoot(): HTMLElement {
  const el = document.getElementById("root");
  if (!el) {
    throw new Error("Root element #root not found");
  }
  return el;
}

const rootEl = requireRoot();

function spaPath(): string {
  const raw = window.location.pathname;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const stripped = base && raw.startsWith(base) ? raw.slice(base.length) : raw;
  return stripped.replace(/\/$/, "") || "/";
}

async function mount() {
  let page;
  if (spaPath() === "/soccer-rankings") {
    const { SoccerRankingsPage } = await import(
      "@/components/soccer-rankings/soccer-rankings-page"
    );
    page = <SoccerRankingsPage />;
  } else {
    page = <AppHub />;
  }
  createRoot(rootEl).render(<StrictMode>{page}</StrictMode>);
}

void mount();

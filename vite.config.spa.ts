import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Copy index.html so GitHub Pages can serve /soccer-rankings without a rewrite. */
function spaDeepRoutes(): Plugin {
  const routes = ["soccer-rankings"];
  return {
    name: "spa-deep-routes",
    closeBundle() {
      const outDir = path.resolve(rootDir, "dist-spa");
      const index = path.join(outDir, "index.html");
      copyFileSync(index, path.join(outDir, "404.html"));
      for (const route of routes) {
        const dest = path.join(outDir, route);
        mkdirSync(dest, { recursive: true });
        copyFileSync(index, path.join(dest, "index.html"));
      }
    },
  };
}

const gotsportProxy = {
  "/gotsport-api": {
    target: "https://system.gotsport.com",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/gotsport-api/, ""),
  },
  "/mls-next-api": {
    target: "https://mls-assist.theintelligenceplatform.com",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/mls-next-api/, ""),
  },
  "/athleteone-api": {
    target: "https://api.athleteone.com",
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/athleteone-api/, ""),
    headers: {
      Origin: "https://theecnl.com",
      Referer: "https://theecnl.com/",
      Accept: "text/html,application/json,*/*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
  },
};

/** Static SPA build for GitHub Pages (no SSR / Nitro). */
export default defineConfig({
  base: "/application-hub/",
  plugins: [tailwindcss(), viteReact(), spaDeepRoutes()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: { proxy: gotsportProxy },
  preview: { proxy: gotsportProxy },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
  },
});

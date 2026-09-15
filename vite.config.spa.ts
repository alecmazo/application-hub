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

/** Static SPA build for GitHub Pages (no SSR / Nitro). */
export default defineConfig({
  base: "/application-hub/",
  plugins: [tailwindcss(), viteReact(), spaDeepRoutes()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
  },
});

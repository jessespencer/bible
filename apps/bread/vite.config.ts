import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

/** Holds first paint until the app has built its header, so moving between apps doesn't flash. */
const renderBlockingEntry = (): Plugin => ({
  name: "render-blocking-entry",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(`<script type="module"`, `<script type="module" blocking="render"`),
  },
});

export default defineConfig(({ command }) => ({
  base: "/bible/bread/",
  plugins: [renderBlockingEntry()],
  // Pinned beside Atlas (5173), Lineage (5174) and By Heart (5175), so the app switcher can link across.
  server: { port: 5176, strictPort: true },
  // Keys live in one .env.local at the repo root, shared by every app.
  envDir: "../..",
  // Like Lineage: in production Atlas's data sits beside us in ../atlas/; dev serves Atlas's public folder here.
  publicDir: command === "serve" ? "../atlas/public" : "public",
}));

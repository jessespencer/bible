import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Holds first paint until the app's code (and, in dev, its CSS) has run, as Atlas, Lineage and
// Bread Alone do, so arriving from another app never shows an unstyled page.
const renderBlockingEntry = (): Plugin => ({
  name: 'render-blocking-entry',
  transformIndexHtml: {
    order: 'post',
    // Every module script: in dev, React's refresh preamble comes before the entry.
    handler: (html) => html.replaceAll(`<script type="module"`, `<script type="module" blocking="render"`),
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: '/bible/byheart/',
  plugins: [react(), renderBlockingEntry()],
  // Pinned beside Atlas (5173) and Lineage (5174).
  server: { port: 5175, strictPort: true },
  // Keys live in one .env.local at the repo root, shared by every app.
  envDir: '../..',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})

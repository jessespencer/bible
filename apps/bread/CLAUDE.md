# Bread Alone

Shown to readers as **Bread Alone**, served at `/bible/bread/`. Vanilla TypeScript + Vite like Lineage: not a React project.

- **Search runs in the browser** over Atlas's `text-web.json`, read from `../atlas/data/` in production (and Atlas's public folder in dev, as Lineage does). The topics in `src/search/topics.ts` were tuned on the WEB, so keep searching it whatever translation the reader shows.
- **Verses are indices** in the family's numbering (`@jessespencer/bible-ui/bible`), so a result reads in any translation and links to Atlas's `?ref=`. Anchors are written as "Philippians 4:6"; `search.test.ts` fails if one stops resolving.
- **URL is state:** `?q=`, `?topic=` (a need the reader steered to or picked) and `?tr=`.
- `src/search/` has no DOM code; `pnpm test:bread` runs it against the real WEB text. `src/ui/` is the page: the composer, the verse cards and the share image.
- **Motion** respects `prefers-reduced-motion`: cards and chips fade instead of rising, and the composer's examples stop cycling.

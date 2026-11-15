# Bread Alone

Shown to readers as **Bread Alone**, served at `/bible/bread/`. Vanilla TypeScript + Vite like Lineage: not a React project.

- **Search runs in the browser** over Atlas's `text-web.json`, read from `../atlas/data/` in production (and Atlas's public folder in dev, as Lineage does). The topics in `src/search/topics.ts` were tuned on the WEB, so keep searching it whatever translation the reader shows.
- **Verses are indices** in the family's numbering (`@jessespencer/bible-ui/bible`), so a result reads in any translation and links to Atlas's `?ref=`. Anchors are written as "Philippians 4:6"; `search.test.ts` fails if one stops resolving.
- **Cross-references rank the answers.** `src/search/links.json` holds each verse's prominence (how much readers link it) and each topic's verses most linked to its anchors, built from Atlas's `links.bin` by `pnpm --filter bread build:links`. Rerun it when the anchors change; `search.test.ts` fails while it's stale.
- **URL is state:** `?q=`, `?topic=` (a need the reader steered to or picked) and `?tr=`.
- `src/search/` has no DOM code; `pnpm test:bread` runs it against the real WEB text. `src/ui/` is the page: the composer, the verse cards and the share image.
- **Motion** follows 24-hours: `--dur-1/2/3` (120/220/420ms) on `--ease-out`, a 0.96 press on anything tappable, a pop on what's picked, and no hover lift on cards. It respects `prefers-reduced-motion`: the durations go to zero, cards and chips fade instead of rising, and the composer's examples stop cycling.

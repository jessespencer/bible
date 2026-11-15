/**
 * What Bread Alone keeps of Atlas's cross-references, built by `pnpm --filter bread build:links`
 * into `links.json`:
 *
 * - **prominence**: one digit per verse, 0–9, how much readers have linked it (log scale). John 3:16
 *   is a 9; a genealogy line is a 0. It lifts the verses people actually turn to above stray
 *   keyword matches.
 * - **neighbors**: for each topic, the verses most strongly linked to its anchors, with a weight
 *   1–9 (square-root scale, so one towering link doesn't flatten the rest). They widen a topic beyond its curated list without leaving its ground.
 */

const VERSES = 31_102;
const NEIGHBORS = 40;
// A link to a whole passage says little about any one verse in it.
const MAX_RANGE = 3;

export interface LinkData {
  prominence: string;
  neighbors: Record<string, [verse: number, weight: number][]>;
}

/** `rows` is Atlas's links.bin: Int16 rows of [from, toStart, toEnd, votes]. */
export const buildLinkData = (rows: Int16Array, anchors: Record<string, number[]>): LinkData => {
  const linked = new Float64Array(VERSES);
  const anchorTopics = new Map<number, string[]>();
  for (const [topic, verses] of Object.entries(anchors)) {
    for (const verse of verses) anchorTopics.set(verse, [...(anchorTopics.get(verse) ?? []), topic]);
  }
  const near: Record<string, Map<number, number>> = Object.fromEntries(
    Object.keys(anchors).map((topic) => [topic, new Map()]),
  );
  const lean = (topics: string[] | undefined, verse: number, votes: number) => {
    for (const topic of topics ?? []) {
      if (anchors[topic]!.includes(verse)) continue;
      near[topic]!.set(verse, (near[topic]!.get(verse) ?? 0) + votes);
    }
  };

  for (let i = 0; i < rows.length; i += 4) {
    const from = rows[i]!;
    const toStart = rows[i + 1]!;
    const toEnd = rows[i + 2]!;
    const votes = rows[i + 3]!;
    if (votes <= 0) continue;
    const span = toEnd - toStart + 1;
    linked[from]! += votes;
    for (let to = toStart; to <= toEnd; to++) linked[to]! += votes / span;
    if (span > MAX_RANGE) continue;
    for (let to = toStart; to <= toEnd; to++) {
      lean(anchorTopics.get(from), to, votes);
      lean(anchorTopics.get(to), from, votes);
    }
  }

  const prominence = Array.from(linked, (sum) => Math.min(9, Math.round(Math.log10(1 + sum) * 2.5))).join("");
  const neighbors = Object.fromEntries(
    Object.entries(near).map(([topic, weights]) => {
      const top = [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, NEIGHBORS);
      const strongest = top[0]?.[1] ?? 1;
      return [topic, top.map(([verse, w]): [number, number] => [verse, Math.max(1, Math.round(9 * Math.sqrt(w / strongest)))])];
    }),
  );
  return { prominence, neighbors };
};

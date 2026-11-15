/**
 * Three verses for a need. MiniSearch finds verses that share the query's words; topic keywords,
 * boost phrases, the curated anchor verses and Atlas's cross-references then reorder them, and no
 * two results share a chapter. Runs in the browser over one translation, one string per verse in
 * the family's numbering.
 */

import MiniSearch from "minisearch";
import { anchorIndices } from "./anchors.ts";
import type { LinkData } from "./linkData.ts";
import defaultLinks from "./links.json" with { type: "json" };
import { topics } from "./topics.ts";
import type { NeedProfile } from "./types.ts";
import { chapterKey } from "./verses.ts";

const RESULTS = 3;
const SHUFFLE_POOL = 30;

interface Doc {
  id: number;
  text: string;
}

interface Scored {
  index: number;
  score: number;
}

export interface VerseSearch {
  /**
   * Verse indices for a need, best first. `exclude` skips verses already shown, and `shuffle`
   * draws from the top of the ranking instead of taking it in order, for "show me others".
   */
  find: (need: NeedProfile, options?: { exclude?: Iterable<number>; shuffle?: boolean }) => number[];
}

// The best text match scores TEXT. Then how far a verse's prominence (0–9) moves it either side of
// the middle, and how much a link to a topic's anchors counts: enough to outrank a stray keyword
// match, never an anchor.
const TEXT = 30;
const PROMINENCE = 2.5;
const PROMINENCE_MIDDLE = 4;
const NEIGHBOR = 1.5;
// A neighbor this strongly linked belongs to the topic even without its words.
const NEIGHBOR_ON_TOPIC = 4;

export const createVerseSearch = (
  verses: readonly string[],
  random: () => number = Math.random,
  links: LinkData = defaultLinks as unknown as LinkData,
): VerseSearch => {
  const neighborWeights: Record<string, Map<number, number>> = Object.fromEntries(
    Object.entries(links.neighbors).map(([topic, list]) => [topic, new Map(list)]),
  );
  // The general topic's anchors are a fallback, not ground to widen.
  const neighborsOf = (topic: string) => (topic === "general" ? undefined : neighborWeights[topic]);
  const prominence = (verse: number) => Number(links.prominence[verse] ?? PROMINENCE_MIDDLE);

  const index = new MiniSearch<Doc>({
    fields: ["text"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  index.addAll(verses.map((text, id) => ({ id, text })).filter((doc) => doc.text));

  const scoreVerse = (verse: number, base: number, need: NeedProfile, anchors: Set<number>): number => {
    const topic = topics[need.primaryTopic];
    const text = (verses[verse] ?? "").toLowerCase();
    let score = base + (prominence(verse) - PROMINENCE_MIDDLE) * PROMINENCE;
    let onTopic = false;

    const near = neighborsOf(need.primaryTopic)?.get(verse) ?? 0;
    if (near) {
      score += near * NEIGHBOR;
      if (near >= NEIGHBOR_ON_TOPIC) onTopic = true;
    }

    if (topic) {
      for (const keyword of topic.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += 2;
          onTopic = true;
        }
      }
      for (const phrase of topic.boostPhrases) {
        if (text.includes(phrase.toLowerCase())) {
          score += 5;
          onTopic = true;
        }
      }
    }

    // Decisive, so curated verses always surface.
    if (anchors.has(verse)) score += 200;
    // A match with nothing of the topic in it is likely fuzzy noise ("died" finding "lied").
    else if (!onTopic && need.primaryTopic !== "general") score -= 20;

    if (text.length < 40) score -= 5;
    return score;
  };

  const rank = (need: NeedProfile): Scored[] => {
    const hits = index.search(need.searchTerms.join(" "));
    // A need outside every topic is answered by its own words; the general anchors are only for
    // when those find too little.
    const topics = [need.primaryTopic, ...need.secondaryTopics].filter(
      (topic) => topic !== "general" || hits.length < RESULTS,
    );
    const anchors = new Set(topics.flatMap((topic) => anchorIndices[topic] ?? []));
    const scored = new Map<number, number>();
    // MiniSearch's scores grow with the number of terms; on one scale, the topic and the
    // cross-references weigh the same whatever the query's length.
    const best = hits[0]?.score ?? 1;
    for (const hit of hits) {
      const verse = hit.id as number;
      scored.set(verse, scoreVerse(verse, (TEXT * hit.score) / best, need, anchors));
    }
    // Anchors and the topic's strongest neighbors still count where the text search missed them.
    for (const verse of [...anchors, ...(neighborsOf(need.primaryTopic)?.keys() ?? [])]) {
      if (!scored.has(verse)) scored.set(verse, scoreVerse(verse, 0, need, anchors));
    }
    return [...scored].map(([verse, score]) => ({ index: verse, score })).sort((a, b) => b.score - a.score);
  };

  const inOrder = (ranked: Scored[]): number[] => {
    const result: number[] = [];
    const chapters = new Set<string>();
    for (const { index: verse } of ranked) {
      if (result.length >= RESULTS) break;
      const key = chapterKey(verse);
      if (chapters.has(key)) continue;
      chapters.add(key);
      result.push(verse);
    }
    return result;
  };

  // Weighted by how far each stands above the bottom of the pool, so the best of a long, even
  // tail of keyword matches come up far more often than the rest. One verse per chapter.
  const drawn = (ranked: Scored[]): number[] => {
    const pool = ranked.slice(0, SHUFFLE_POOL);
    const floor = pool[pool.length - 1]?.score ?? 0;
    const weight = (s: Scored) => Math.max(s.score - floor, 0.5);
    const total = pool.reduce((sum, s) => sum + weight(s), 0);
    const result: number[] = [];
    const chapters = new Set<string>();
    for (let attempt = 0; attempt < 100 && result.length < RESULTS && pool.length; attempt++) {
      let r = random() * total;
      for (const s of pool) {
        r -= weight(s);
        if (r > 0) continue;
        const key = chapterKey(s.index);
        if (!result.includes(s.index) && !chapters.has(key)) {
          result.push(s.index);
          chapters.add(key);
        }
        break;
      }
    }
    return result;
  };

  const fallbacks = (topic: string, skip: Set<number>, needed: number): number[] => {
    const result: number[] = [];
    const chapters = new Set<string>();
    for (const verse of anchorIndices[topic] ?? anchorIndices["general"] ?? []) {
      if (result.length >= needed) break;
      const key = chapterKey(verse);
      if (skip.has(verse) || chapters.has(key)) continue;
      chapters.add(key);
      result.push(verse);
    }
    return result;
  };

  return {
    find: (need, { exclude = [], shuffle = false } = {}) => {
      const skip = new Set(exclude);
      const ranked = rank(need).filter((s) => !skip.has(s.index));
      const results = shuffle ? drawn(ranked) : inOrder(ranked);
      if (results.length < RESULTS) {
        results.push(...fallbacks(need.primaryTopic, new Set([...skip, ...results]), RESULTS - results.length));
      }
      return results.slice(0, RESULTS);
    },
  };
};

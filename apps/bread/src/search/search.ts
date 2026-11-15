/**
 * Three verses for a need. MiniSearch finds verses that share the query's words; topic keywords,
 * boost phrases and the curated anchor verses then reorder them, and no two results share a chapter.
 * Runs in the browser over one translation, one string per verse in the family's numbering.
 */

import MiniSearch from "minisearch";
import { anchorVerses } from "./anchors.ts";
import { topics } from "./topics.ts";
import type { NeedProfile } from "./types.ts";
import { chapterKey, refToIndex } from "./verses.ts";

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

/** Each topic's anchors as verse indices, read once. */
const anchorIndices: Record<string, number[]> = Object.fromEntries(
  Object.entries(anchorVerses).map(([topic, refs]) => [
    topic,
    refs.map(refToIndex).filter((index): index is number => index !== null),
  ]),
);

export interface VerseSearch {
  /**
   * Verse indices for a need, best first. `exclude` skips verses already shown, and `shuffle`
   * draws from the top of the ranking instead of taking it in order, for "show me others".
   */
  find: (need: NeedProfile, options?: { exclude?: Iterable<number>; shuffle?: boolean }) => number[];
}

export const createVerseSearch = (verses: readonly string[], random: () => number = Math.random): VerseSearch => {
  const index = new MiniSearch<Doc>({
    fields: ["text"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  index.addAll(verses.map((text, id) => ({ id, text })).filter((doc) => doc.text));

  const scoreVerse = (verse: number, base: number, need: NeedProfile, anchors: Set<number>): number => {
    const topic = topics[need.primaryTopic];
    const text = (verses[verse] ?? "").toLowerCase();
    let score = base;
    let onTopic = false;

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
    const anchors = new Set(
      [need.primaryTopic, ...need.secondaryTopics].flatMap((topic) => anchorIndices[topic] ?? []),
    );
    const scored = new Map<number, number>();
    for (const hit of index.search(need.searchTerms.join(" "))) {
      const verse = hit.id as number;
      scored.set(verse, scoreVerse(verse, hit.score, need, anchors));
    }
    // Anchors the text search missed still count.
    for (const verse of anchors) {
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

  // Weighted by score from the top of the ranking, one verse per chapter.
  const drawn = (ranked: Scored[]): number[] => {
    const pool = ranked.slice(0, SHUFFLE_POOL);
    const weight = (s: Scored) => Math.max(s.score, 0.1);
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

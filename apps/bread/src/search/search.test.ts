import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anchorIndices, anchorVerses } from "./anchors.ts";
import { buildLinkData } from "./linkData.ts";
import links from "./links.json" with { type: "json" };
import { hearTopics, parseNeedProfile } from "./needProfile.ts";
import { topics } from "./topics.ts";
import { createVerseSearch } from "./search.ts";
import { chapterKey, indexToLabel, indexToParam, refToIndex } from "./verses.ts";

// Atlas's World English Bible, the translation the topics were tuned on.
const web: string[] = JSON.parse(
  readFileSync(new URL("../../../atlas/public/data/text-web.json", import.meta.url), "utf8"),
);
const search = createVerseSearch(web);
const find = (query: string, options?: Parameters<typeof search.find>[1]) =>
  search.find(parseNeedProfile(query), options).map(indexToLabel);

describe("references", () => {
  it("reads a reference into the family's verse index and back", () => {
    expect(refToIndex("Genesis 1:1")).toBe(0);
    expect(indexToLabel(refToIndex("John 3:16")!)).toBe("John 3:16");
    expect(indexToParam(refToIndex("1 Peter 5:7")!)).toBe("1Pet.5.7");
  });

  it("accepts Psalm for a single psalm", () => {
    expect(refToIndex("Psalm 23:4")).toBe(refToIndex("Psalms 23:4"));
  });

  it("rejects a verse that doesn't exist", () => {
    expect(refToIndex("John 3:99")).toBeNull();
    expect(refToIndex("Hezekiah 1:1")).toBeNull();
  });

  it("finds every anchor verse", () => {
    const missing = Object.values(anchorVerses).flat().filter((ref) => refToIndex(ref) === null);
    expect(missing).toEqual([]);
  });
});

describe("cross-references", () => {
  it("keeps links.json in step with Atlas's links and the anchors (pnpm --filter bread build:links)", () => {
    const bin = readFileSync(new URL("../../../atlas/public/data/links.bin", import.meta.url));
    const rows = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2);
    expect(buildLinkData(rows, anchorIndices)).toEqual(links);
  });

  it("rates the verses readers link most above a passing line", () => {
    const of = (ref: string) => Number(links.prominence[refToIndex(ref)!]);
    expect(of("John 3:16")).toBe(9);
    expect(of("Colossians 3:13")).toBeGreaterThan(of("Isaiah 2:9"));
  });
});

describe("finding verses for a need", () => {
  it("answers anxiety with verses about worry", () => {
    const found = find("I'm anxious about my job interview");
    expect(found).toContain("Philippians 4:6");
    expect(found.every((ref) => anchorVerses["anxiety"]!.includes(ref))).toBe(true);
  });

  it("answers grief with comfort for mourners", () => {
    expect(find("my dad just died")).toContain("Matthew 5:4");
  });

  it("hears a death before the family members named with it", () => {
    expect(parseNeedProfile("My mom passed away and I'm so worried about my dad being alone").primaryTopic).toBe("grief");
  });

  it("lets the reader steer to another topic, keeping the one it heard behind it", () => {
    const need = parseNeedProfile("I'm anxious about my marriage", "marriage");
    expect(need.primaryTopic).toBe("marriage");
    expect(need.secondaryTopics).toContain("anxiety");
  });

  it("finds verses for a topic alone, with nothing written", () => {
    expect(search.find(parseNeedProfile("", "gratitude"))).toHaveLength(3);
  });

  it("returns three verses from three different chapters", () => {
    const results = search.find(parseNeedProfile("I can't forgive my brother"));
    expect(results).toHaveLength(3);
    expect(new Set(results.map(chapterKey)).size).toBe(3);
  });

  it("still returns three verses for a need outside every topic", () => {
    expect(find("tell me about the tabernacle curtains")).toHaveLength(3);
  });

  it("hears each need's opening words as that need", () => {
    const misheard = Object.entries(topics).filter(([key, topic]) => hearTopics(topic.starter)[0] !== key);
    expect(misheard.map(([key]) => key)).toEqual([]);
  });

  it("hears a lost job as work, not a bereavement", () => {
    expect(parseNeedProfile("how do I trust God when I lost my job").primaryTopic).not.toBe("grief");
  });

  it("meets money trouble with provision, not a warning", () => {
    expect(parseNeedProfile("We can't make rent this month").primaryTopic).toBe("money");
    const found = find("We can't make rent this month");
    expect(found).toContain("Philippians 4:19");
    expect(found).not.toContain("1 Timothy 6:10");
  });

  it("keeps showing others on the topic's ground, not stray keyword matches", () => {
    let seed = 7;
    const seeded = createVerseSearch(web, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
    const need = parseNeedProfile("I can't forgive my brother");
    const shown = seeded.find(need);
    for (let round = 0; round < 4; round++) shown.push(...seeded.find(need, { exclude: shown, shuffle: true }));
    expect(shown.map(indexToLabel)).not.toContain("Isaiah 2:9");
    expect(shown.every((verse) => Number(links.prominence[verse]) >= 5)).toBe(true);
  });

  it("shows others without repeating what was shown", () => {
    const need = parseNeedProfile("I feel so lonely");
    const first = search.find(need);
    const others = createVerseSearch(web, () => 0.5).find(need, { exclude: first, shuffle: true });
    expect(others).toHaveLength(3);
    expect(others.some((verse) => first.includes(verse))).toBe(false);
  });
});

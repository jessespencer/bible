import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anchorVerses } from "./anchors.ts";
import { parseNeedProfile } from "./needProfile.ts";
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

describe("finding verses for a need", () => {
  it("answers anxiety with verses about worry", () => {
    expect(find("I'm anxious about my job interview")).toEqual(["Matthew 6:25", "Proverbs 12:25", "Philippians 4:6"]);
  });

  it("answers grief with comfort for mourners", () => {
    expect(find("my dad just died")).toContain("Matthew 5:4");
  });

  it("returns three verses from three different chapters", () => {
    const results = search.find(parseNeedProfile("I can't forgive my brother"));
    expect(results).toHaveLength(3);
    expect(new Set(results.map(chapterKey)).size).toBe(3);
  });

  it("still returns three verses for a need outside every topic", () => {
    expect(find("tell me about the tabernacle curtains")).toHaveLength(3);
  });

  it("shows others without repeating what was shown", () => {
    const need = parseNeedProfile("I feel so lonely");
    const first = search.find(need);
    const others = createVerseSearch(web, () => 0.5).find(need, { exclude: first, shuffle: true });
    expect(others).toHaveLength(3);
    expect(others.some((verse) => first.includes(verse))).toBe(false);
  });
});

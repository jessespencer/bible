/**
 * References in the family's numbering: every verse is its index in Atlas's one-string-per-verse
 * files, so a result found in one translation reads in any other.
 */

import { bookOffsets, books } from "@jessespencer/bible-ui/bible";

const BOOK_BY_NAME = new Map(books.map((book, i) => [book.name.toLowerCase(), i]));
// The anchors name a single psalm the way people say it.
BOOK_BY_NAME.set("psalm", BOOK_BY_NAME.get("psalms")!);

const REF = /^(.+?)\s+(\d+):(\d+)$/;

/** "Philippians 4:6" to its verse index, or null if it names no verse. */
export const refToIndex = (ref: string): number | null => {
  const match = REF.exec(ref.trim());
  if (!match) return null;
  const book = BOOK_BY_NAME.get(match[1]!.toLowerCase());
  if (book === undefined) return null;
  const { verseCounts } = books[book]!;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (chapter < 1 || chapter > verseCounts.length || verse < 1 || verse > verseCounts[chapter - 1]!) return null;
  let index = bookOffsets[book]!;
  for (let c = 0; c < chapter - 1; c++) index += verseCounts[c]!;
  return index + verse - 1;
};

export interface Located {
  book: number;
  chapter: number;
  verse: number;
}

export const locate = (index: number): Located => {
  let book = books.length - 1;
  while (bookOffsets[book]! > index) book--;
  let remaining = index - bookOffsets[book]!;
  let chapter = 1;
  for (const count of books[book]!.verseCounts) {
    if (remaining < count) break;
    remaining -= count;
    chapter++;
  }
  return { book, chapter, verse: remaining + 1 };
};

/** "John 3:16", for reading. One psalm is a Psalm. */
export const indexToLabel = (index: number): string => {
  const { book, chapter, verse } = locate(index);
  const name = books[book]!.name;
  return `${name === "Psalms" ? "Psalm" : name} ${chapter}:${verse}`;
};

/** "John.3.16", Atlas's `?ref=`. */
export const indexToParam = (index: number): string => {
  const { book, chapter, verse } = locate(index);
  return `${books[book]!.osis}.${chapter}.${verse}`;
};

/** Book and chapter, so results can come from different chapters. */
export const chapterKey = (index: number): string => {
  const { book, chapter } = locate(index);
  return `${book}:${chapter}`;
};

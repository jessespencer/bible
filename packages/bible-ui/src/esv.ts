/**
 * The ESV, read live from Crossway's API with the reader's own free key, within Crossway's
 * conditions (https://api.esv.org/#conditions):
 * - No page may show, and no app may store, more than 500 verses or half of any book, whichever
 *   is less. Text is held in memory only, never written to storage, and the hold is capped the
 *   same way, so what a page can show stays inside it too. The least recently read verses go first.
 * - No more than 60 requests a minute or 1,000 an hour, so requests wait their turn.
 * - Each quotation carries the letters "ESV", and each page that shows the text links to
 *   www.esv.org (`appendEsvCredit`). The full notice sits a tap away, on a credits page or dialog,
 *   as Crossway asks for it on a copyright page, not beside the text.
 * Verses are counted in KJV numbering, as in every bundled file, which the ESV follows.
 */

import { bookOffsets, books, bookVerseTotals } from "./bible";

export const ESV_KEY_URL = "https://api.esv.org/account/create-application/";
export const ESV_SITE = "https://www.esv.org/";

/** Crossway's notice, for wherever ESV text is shown. */
export const ESV_NOTICE =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, " +
  "a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

/** The full notice Crossway asks for on a copyright or credits page. */
export const ESV_COPYRIGHT =
  `${ESV_NOTICE} The ESV text may not be quoted in any publication made available to the public by a Creative ` +
  "Commons license. The ESV may not be translated into any other language. Users may not copy or download more " +
  "than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.";

/** The letters Crossway asks for with each quotation. */
export const ESV_MARK = "(ESV)";

/** Opens a dialog with Crossway's full notice, for an app without a credits page of its own. */
export const openEsvCredits = (): void => {
  let dialog = document.querySelector<HTMLDialogElement>("dialog.bui-credits");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "bui-credits";
    dialog.setAttribute("aria-labelledby", "bui-credits-title");
    const form = document.createElement("form");
    form.method = "dialog";
    const close = document.createElement("button");
    close.className = "bui-credits__close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    form.append(close);
    const title = document.createElement("h2");
    title.id = "bui-credits-title";
    title.textContent = "Credits";
    const notice = document.createElement("p");
    notice.append(`${ESV_COPYRIGHT} `, esvLink("www.esv.org"));
    dialog.append(form, title, notice);
    // A tap on the backdrop lands on the dialog itself.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog!.close();
    });
    document.body.append(dialog);
  }
  dialog.showModal();
};

const esvLink = (label: string): HTMLAnchorElement => {
  const link = document.createElement("a");
  link.href = ESV_SITE;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = label;
  return link;
};

/**
 * The quiet line every page showing ESV text carries: Crossway's name, the www.esv.org link it
 * asks for, and a way to the full notice. `onCredits` opens the app's own credits page; without
 * one, `openEsvCredits` shows the notice.
 */
export const appendEsvCredit = (parent: HTMLElement, onCredits: () => void = openEsvCredits): void => {
  const line = document.createElement("span");
  line.className = "bui-esv-credit";
  const credits = document.createElement("button");
  credits.type = "button";
  credits.textContent = "Credits";
  credits.addEventListener("click", onCredits);
  line.append("ESV® Bible © Crossway · ", esvLink("esv.org"), " · ", credits);
  parent.append(line);
};

/** Thrown when there is no key, or Crossway refuses the one given. */
export class EsvKeyError extends Error {}

const STORE_KEY = "bui-esv-key";
// By Heart's own store, so a key pasted there carries over when the apps share an origin.
const BYHEART_KEY = "byheart.esvKey";

const MAX_HELD = 500;
// One request asks for no more than this, well inside Crossway's limit of 500 verses a query.
const MAX_REQUEST = 400;
// Requests allowed in each window, a little under Crossway's 60 a minute and 1,000 an hour.
const RATE_LIMITS: [windowMs: number, most: number][] = [[60_000, 55], [3_600_000, 950]];

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * The reader's key, or in development one from `.env.local` at the repo root. A production
 * build never reads the env, so it can't carry a key to anyone else.
 */
export const esvKey = (): string => read(STORE_KEY) || read(BYHEART_KEY) || devKey();

// Typed here, since the package doesn't load Vite's types; each app's Vite fills these in.
const devKey = (): string => {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; VITE_ESV_KEY?: string } }).env;
  return (env?.DEV && env.VITE_ESV_KEY) || "";
};

export const saveEsvKey = (key: string): void => {
  try {
    localStorage.setItem(STORE_KEY, key.trim());
  } catch {
    // A private window can refuse storage; the key then can't be kept.
  }
};

// Insertion order doubles as recency: a read moves a verse to the end.
const held = new Map<number, string>();

/** A verse's text, `""` where the ESV omits it, or `undefined` until it has been loaded. */
export const heldEsv = (verse: number): string | undefined => {
  const text = held.get(verse);
  if (text === undefined) return undefined;
  held.delete(verse);
  held.set(verse, text);
  return text;
};

const hold = (verse: number, text: string) => {
  held.delete(verse);
  held.set(verse, text);
  while (held.size > MAX_HELD) held.delete(held.keys().next().value!);
  // No more than half of the verse's book, dropping that book's oldest first.
  const book = bookOf(verse);
  const ofBook = [...held.keys()].filter((v) => bookOf(v) === book);
  for (const old of ofBook.slice(0, Math.max(0, ofBook.length - esvBookLimit(verse)))) held.delete(old);
};

const bookOf = (verse: number): number => {
  let book = books.length - 1;
  while (book > 0 && bookOffsets[book]! > verse) book--;
  return book;
};

/** The most verses of this verse's book that may be shown or held at once: half the book, or 500. */
export const esvBookLimit = (verse: number): number => Math.min(MAX_HELD, Math.floor(bookVerseTotals[bookOf(verse)]! / 2));

interface Place {
  book: number;
  chapter: number;
  verse: number;
}

const placeOf = (index: number): Place => {
  const book = bookOf(index);
  let rest = index - bookOffsets[book]!;
  let chapter = 0;
  while (rest >= books[book]!.verseCounts[chapter]!) rest -= books[book]!.verseCounts[chapter++]!;
  return { book, chapter: chapter + 1, verse: rest + 1 };
};

const indexOf = (book: number, chapter: number, verse: number): number => {
  let index = bookOffsets[book]!;
  for (let c = 0; c < chapter - 1; c++) index += books[book]!.verseCounts[c]!;
  return index + verse - 1;
};

/**
 * Verses the ESV numbers past the KJV's end of a chapter, as [book index, chapter, verse]; the KJV
 * holds the same words in the verse before, so each is folded into it, as the bundled BSB folds
 * 3 John 15. Checked against the API for every chapter: 3 John 15 is the only one.
 */
const EXTRA_VERSES: [book: number, chapter: number, verse: number][] = [
  [63, 1, 15], // 3 John 15: "Peace be to you. The friends greet you…"
];

const hasExtraAfter = ({ book, chapter, verse }: Place): boolean =>
  EXTRA_VERSES.some(([b, c, v]) => b === book && c === chapter && v === verse + 1);

/**
 * Sorted verses as runs inside one chapter each, like "John 3:16-18". A run that ends where the
 * ESV has an extra verse asks for it too.
 */
export const esvQuery = (verses: number[]): string =>
  runs([...verses].sort((a, b) => a - b))
    .map(([first, last]) => {
      const a = placeOf(first);
      const b = placeOf(last);
      const name = books[a.book]!.name;
      const end = hasExtraAfter(b) ? b.verse + 1 : b.verse;
      const span = a.verse === end ? `${a.verse}` : `${a.verse}-${end}`;
      // A chapter number on a one-chapter book would read as a verse.
      return books[a.book]!.chapters === 1 ? `${name} ${span}` : `${name} ${a.chapter}:${span}`;
    })
    .join(";");

const runs = (verses: number[]): [number, number][] => {
  const out: [number, number][] = [];
  for (const verse of verses) {
    const run = out[out.length - 1];
    const sameChapter = run && verse === run[1] + 1 && placeOf(verse).verse !== 1;
    if (sameChapter) run[1] = verse;
    else out.push([verse, verse]);
  }
  return out;
};

/**
 * One passage from the API as verses. `start` is its first verse ID from `parsed`, as BBCCCVVV.
 * Markers are `[16]`, or `[4:1]` where a passage runs into the next chapter. An extra ESV verse
 * joins the end of the verse before it.
 */
export const parseEsvPassage = (passage: string, start: number): Map<number, string> => {
  const book = Math.floor(start / 1_000_000) - 1;
  let chapter = Math.floor(start / 1000) % 1000;
  const verses = new Map<number, string>();
  const parts = passage.split(/\[(?:(\d+):)?(\d+)\]/);
  for (let i = 1; i < parts.length; i += 3) {
    if (parts[i]) chapter = Number(parts[i]);
    const verse = Number(parts[i + 1]);
    const text = (parts[i + 2] ?? "").replace(/\(ESV\)\s*$/, "").replace(/\s+/g, " ").trim();
    if (hasExtraAfter({ book, chapter, verse: verse - 1 })) {
      const host = indexOf(book, chapter, verse - 1);
      verses.set(host, [verses.get(host), text].filter(Boolean).join(" "));
    } else verses.set(indexOf(book, chapter, verse), text);
  }
  return verses;
};

const loading = new Map<number, Promise<void>>();

/**
 * Loads the verses not already held, up to one request's worth and half of any book. Verses
 * come first-listed first, so list the ones that matter most first: past a limit, the last are
 * left out. Resolves once they can be read with `heldEsv`; a verse the ESV leaves out comes back
 * as `""`.
 */
export const loadEsv = async (verses: Iterable<number>): Promise<void> => {
  const wanted = withinLimits([...new Set(verses)]);
  const waiting = wanted.map((v) => loading.get(v)).filter((p): p is Promise<void> => !!p);
  const missing = wanted.filter((v) => !held.has(v) && !loading.has(v));
  if (missing.length) {
    const request = fetchEsv(missing);
    for (const verse of missing) loading.set(verse, request);
    request.finally(() => missing.forEach((v) => loading.delete(v))).catch(() => {});
    waiting.push(request);
  }
  await Promise.all(waiting);
};

/** The verses, in order, up to one request and half of each book. */
const withinLimits = (verses: number[]): number[] => {
  const perBook = new Map<number, number>();
  const kept: number[] = [];
  for (const verse of verses) {
    const book = bookOf(verse);
    const count = perBook.get(book) ?? 0;
    if (count >= esvBookLimit(verse) || kept.length >= MAX_REQUEST) continue;
    perBook.set(book, count + 1);
    kept.push(verse);
  }
  return kept;
};

const sent: number[] = [];

/** Waits until a request fits inside Crossway's rate limits, then counts it. */
const takeTurn = async (): Promise<void> => {
  for (;;) {
    const now = Date.now();
    while (sent.length && now - sent[0]! >= RATE_LIMITS[RATE_LIMITS.length - 1]![0]) sent.shift();
    const wait = Math.max(
      0,
      ...RATE_LIMITS.map(([span, most]) => {
        const recent = sent.filter((t) => now - t < span);
        return recent.length < most ? 0 : recent[0]! + span - now;
      }),
    );
    if (wait === 0) {
      sent.push(now);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
};

const fetchEsv = async (verses: number[]): Promise<void> => {
  const key = esvKey();
  if (!key) throw new EsvKeyError("");
  await takeTurn();
  const params = new URLSearchParams({
    q: esvQuery(verses),
    "include-passage-references": "false",
    "include-first-verse-numbers": "true",
    "include-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "line-length": "0",
  });
  const res = await fetch(`https://api.esv.org/v3/passage/text/?${params}`, {
    headers: { Authorization: `Token ${key}` },
  }).catch(() => {
    // Crossway sends rejections without CORS headers, so a bad key arrives as a failed request
    // rather than a 403. Only being offline rules the key out.
    throw navigator.onLine ? new EsvKeyError("Crossway turned that request away. Check your key.") : new Error("Offline");
  });
  if (res.status === 401 || res.status === 403) throw new EsvKeyError("That ESV key was not accepted.");
  if (!res.ok) throw new Error(`The ESV couldn't load (${res.status})`);
  const data = (await res.json()) as { passages: string[]; parsed: [number, number][] };
  const found = new Map<number, string>();
  data.passages.forEach((passage, i) => {
    const start = data.parsed[i]?.[0];
    if (start) for (const [verse, text] of parseEsvPassage(passage, start)) found.set(verse, text);
  });
  // Asked for but not returned: the ESV leaves these verses out, as at Matthew 17:21. Held last
  // to first, so the first-listed are the newest and the last to be let go.
  for (const verse of [...verses].reverse()) hold(verse, found.get(verse) ?? "");
};

/**
 * A short form for the reader's key, for wherever ESV text would be. `message` says why it is
 * asked for again, such as a key Crossway refused.
 */
export const createEsvKeyForm = (message: string, onSaved: () => void): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "bui-key";
  const intro = document.createElement("p");
  intro.className = "bui-key__intro";
  if (message) intro.append(`${message} `);
  intro.append("The ESV needs a free key from Crossway. ");
  const link = document.createElement("a");
  link.href = ESV_KEY_URL;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Get one at api.esv.org";
  intro.append(link, ", then paste it here. It stays in this browser.");

  const row = document.createElement("div");
  row.className = "bui-key__row";
  const input = document.createElement("input");
  input.className = "bui-key__input";
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "ESV API key";
  input.setAttribute("aria-label", "ESV API key");
  input.value = esvKey();
  const save = document.createElement("button");
  save.className = "bui-key__save";
  save.type = "submit";
  save.textContent = "Save";
  row.append(input, save);
  form.append(intro, row);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) return input.focus();
    saveEsvKey(input.value);
    onSaved();
  });
  return form;
};

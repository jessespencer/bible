import { createElement, Copy } from 'lucide';
import { skeletonHtml, WORDS_PER_VERSE } from '@jessespencer/bible-ui/skeleton';
import { LINKED_TRANSLATIONS, readElsewhereHref } from '@jessespencer/bible-ui/translations';
import { BOOKS } from '../data/books';
import { BOOK_GENRE, GENRES } from '../data/genres';
import { linkFrom, linkToEnd, linkToStart, linkVotes, type LinkStore } from './links';
import { formatRange, formatVerse, locate, VERSE_BOOK, type Passage } from './verses';

/** A verse's text: `""` where the translation omits it, `undefined` while it loads. */
export type VerseTexts = ((verse: number) => string | undefined) | null;

export interface CompanionTarget {
  heading: HTMLElement;
  content: HTMLElement;
}

const INITIAL_ROWS = 30;
const MAX_ROW_VERSES = 12;
const READABLE_VERSES = 180;
interface Reading {
  abbr: string;
  language: string;
  /** Letters a licence asks for after each quotation, like "(ESV)". */
  mark?: string;
  /** The most verses of a book that may be shown at once, where a licence limits it. */
  limit?: (verse: number) => number;
}

// The translation being read, for its omission note, the text's language and its licence.
let reading: Reading = { abbr: 'BSB', language: 'en' };

export function setReading(next: Reading) {
  reading = next;
}

const markHtml = () => (reading.mark ? ` <span class="cp-mark">${reading.mark}</span>` : '');
const COPY_ICON = createElement(Copy).outerHTML;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function genreOf(verse: number) {
  return GENRES[BOOK_GENRE[VERSE_BOOK[verse]]];
}

function verseText(texts: VerseTexts, verse: number): string {
  const text = texts?.(verse);
  // Each verse waits in its own shape, so a chapter of them doesn't look like one line repeated.
  if (text === undefined) return skeletonHtml({ words: WORDS_PER_VERSE, from: verse, label: 'Loading text…' });
  if (!text) return `<em>The ${reading.abbr} omits this verse, following the earliest manuscripts.</em>`;
  return reading.language === 'en' ? escapeHtml(text) : `<span lang="${reading.language}">${escapeHtml(text)}</span>`;
}

function passageText(texts: VerseTexts, start: number, end: number): string {
  if (start === end) return verseText(texts, start) + markHtml();
  const shown = Math.min(MAX_ROW_VERSES, reading.limit?.(start) ?? Infinity);
  const last = Math.min(end, start + shown - 1);
  let html = '';
  for (let verse = start; verse <= last; verse++) {
    html += `<sup>${locate(verse).verse}</sup>${verseText(texts, verse)} `;
  }
  html = html.trimEnd() + markHtml();
  const more = end - last;
  return more > 0 ? `${html} <span class="cp-more">and ${more} more verse${more === 1 ? '' : 's'}</span>` : html;
}

// Copyrighted translations can't be bundled, so the passage links out to them instead.
function elsewhere(start: number, end: number): string {
  const reference = formatRange(start, end);
  const links = LINKED_TRANSLATIONS.filter(version => version !== reading.abbr).map(version =>
    `<a href="${readElsewhereHref(reference, version)}" target="_blank" rel="noopener">${version}</a>`).join(' · ');
  return `<p class="cp-elsewhere">Also in ${links}</p>`;
}

function copyButton(start: number, end: number): string {
  return `<button class="cp-copy" data-copy="${start}-${end}" aria-label="Copy ${formatRange(start, end)} with a link" title="Copy with a link">${COPY_ICON}</button>`;
}

function heading(target: HTMLElement, eyebrow: string, color: string, title: string, note: string) {
  target.innerHTML = `
    <div class="cp-eyebrow"><span style="background:${color}"></span>${eyebrow}</div>
    <h2 class="cp-title">${title}</h2>
    <div class="cp-note">${note}</div>
  `;
}

// Saved under Atlas's old name, so readers keep their open sections.
const SECTION_KEY = 'rainbow:panel:';

function sectionIsOpen(id: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(SECTION_KEY + id);
    return stored === null ? fallback : stored === 'open';
  } catch {
    return fallback;
  }
}

export function rememberSection(id: string, open: boolean) {
  try {
    localStorage.setItem(SECTION_KEY + id, open ? 'open' : 'closed');
  } catch {
    // Remembering is a convenience; the panel works without it.
  }
}

interface Band {
  id: string;
  title: string;
  note: string;
  count?: number;
  trailing?: string;
  defaultOpen?: boolean;
  body: string;
}

function band({ id, title, note, count, trailing = '', defaultOpen = true, body }: Band): string {
  return `
    <details class="band" data-section="${id}" ${sectionIsOpen(id, defaultOpen) ? 'open' : ''}>
      <summary>
        <span class="band-name">${title}</span>
        <span class="band-note">${note}</span>
        ${trailing}
        ${count === undefined ? '' : `<span class="band-count">${count.toLocaleString()}</span>`}
      </summary>
      <div class="band-body">${body}</div>
    </details>
  `;
}

function connectionRow(store: LinkStore, id: number, start: number, end: number, texts: VerseTexts): string {
  return `
    <div class="cp-row" style="--genre:${genreOf(start).css}">
      <button class="cp-row-main" data-link="${id}">
        <span class="cp-row-ref">${formatRange(start, end)}<span>${linkVotes(store, id)}</span></span>
        <span class="cp-row-text">${passageText(texts, start, end)}</span>
      </button>
      ${copyButton(start, end)}
    </div>
  `;
}

// Books come in order of their strongest link, so the best connections stay at the top.
function connectionList(
  store: LinkStore,
  ids: number[],
  sectionId: string,
  otherEnd: (id: number) => [number, number],
  texts: VerseTexts,
  showAll: boolean,
): string {
  const rows = showAll ? ids : ids.slice(0, INITIAL_ROWS);
  const byBook = new Map<number, number[]>();
  for (const id of rows) {
    const book = VERSE_BOOK[otherEnd(id)[0]];
    byBook.set(book, [...(byBook.get(book) ?? []), id]);
  }

  let html = '';
  for (const [book, group] of byBook) {
    html += `<div class="cp-book" style="--genre:${GENRES[BOOK_GENRE[book]].css}"><span>${BOOKS[book].name}</span><span>${group.length}</span></div>`;
    html += group.map(id => connectionRow(store, id, ...otherEnd(id), texts)).join('');
  }
  if (rows.length < ids.length) {
    html += `<button class="sp-show-more" data-show-all="${sectionId}">Show all ${ids.length.toLocaleString()}</button>`;
  }
  return html;
}

function genreBand(store: LinkStore, otherEnds: number[]): string {
  const counts = GENRES.map(() => 0);
  for (const verse of otherEnds) counts[BOOK_GENRE[VERSE_BOOK[verse]]]++;
  const present = GENRES.map((genre, i) => ({ genre, count: counts[i] })).filter(g => g.count > 0);
  const strip = present
    .map(({ genre, count }) => `<span style="flex-grow:${count};background:${genre.css}"></span>`)
    .join('');
  const rows = present
    .map(({ genre, count }) => `<div class="cp-genre"><span style="background:${genre.css}"></span>${genre.label}<b>${count.toLocaleString()}</b></div>`)
    .join('');
  return band({
    id: 'connects-to',
    title: 'Connects to',
    note: `${present.length} section${present.length === 1 ? '' : 's'}`,
    trailing: `<span class="cp-strip">${strip}</span>`,
    defaultOpen: false,
    body: `<div class="cp-genres">${rows}</div>`,
  });
}

function pairVerse(texts: VerseTexts, start: number, end: number): string {
  const genre = genreOf(start);
  return `
    <article class="cp-verse">
      <div class="cp-verse-head">
        <button class="cp-verse-ref" data-range="${start}-${end}">${formatRange(start, end)}</button>
        <span>${genre.label}</span>
        ${copyButton(start, end)}
      </div>
      <p class="cp-text">${passageText(texts, start, end)}</p>
      <button class="cp-context" data-context="${start}">Read in context</button>
      ${elsewhere(start, end)}
    </article>
  `;
}

export function renderLinkView(
  { heading: head, content }: CompanionTarget,
  store: LinkStore,
  id: number,
  texts: VerseTexts,
  siblings: Int32Array,
) {
  const from = linkFrom(store, id);
  const toStart = linkToStart(store, id);
  const toEnd = linkToEnd(store, id);
  const votes = linkVotes(store, id);
  const position = siblings.indexOf(id);
  const place = siblings.length > 1
    ? ` · ${(position + 1).toLocaleString()} of ${siblings.length.toLocaleString()} between these books`
    : '';

  heading(head, 'Connection', genreOf(from).css, `${formatVerse(from)} &harr; ${formatRange(toStart, toEnd)}`,
    `${votes} reader vote${votes === 1 ? '' : 's'}${place}`);

  content.innerHTML = `
    <div class="cp-pair" style="--from:${genreOf(from).css};--to:${genreOf(toStart).css}">
      ${pairVerse(texts, from, from)}
      ${pairVerse(texts, toStart, toEnd)}
    </div>
  `;
}

function chapterVerses(texts: VerseTexts, passage: Passage, highlight: number | null): string {
  const limit = reading.limit?.(passage.start) ?? Infinity;
  if (passage.end - passage.start + 1 > limit) {
    return `<p class="cp-limit">The ${reading.abbr}'s publisher allows ${limit} verses of ${BOOKS[VERSE_BOOK[passage.start]].name} on screen at once, half the book. Pick a shorter passage to read it here.</p>`;
  }
  let html = '';
  for (let verse = passage.start; verse <= passage.end; verse++) {
    const marked = verse === highlight ? ' cp-marked' : '';
    html += `<span class="cp-line${marked}"><button class="cp-number" data-range="${verse}-${verse}">${locate(verse).verse}</button>${verseText(texts, verse)}</span> `;
  }
  return `<p class="cp-text cp-reading">${html.trimEnd()}${markHtml()}</p>`;
}

export function renderPassageView(
  { heading: head, content }: CompanionTarget,
  store: LinkStore,
  passage: Passage,
  connections: Int32Array,
  texts: VerseTexts,
  expanded: Set<string>,
  highlight: number | null,
) {
  const { start, end } = passage;
  const verseCount = end - start + 1;
  const genre = genreOf(start);
  const testament = BOOKS[VERSE_BOOK[start]].testament === 'OT' ? 'Old Testament' : 'New Testament';

  heading(head, `${genre.label} · ${testament}`, genre.css, passage.label,
    `${connections.length.toLocaleString()} connection${connections.length === 1 ? '' : 's'}`);

  const inside = (verse: number) => verse >= start && verse <= end;
  const outgoing = Array.from(connections).filter(id => inside(linkFrom(store, id)));
  const incoming = Array.from(connections).filter(id => !inside(linkFrom(store, id)));

  const outgoingEnd = (id: number): [number, number] => [linkToStart(store, id), linkToEnd(store, id)];
  const incomingEnd = (id: number): [number, number] => [linkFrom(store, id), linkFrom(store, id)];
  const otherEnds = [...outgoing.map(id => linkToStart(store, id)), ...incoming.map(id => linkFrom(store, id))];

  let text = '';
  if (verseCount <= MAX_ROW_VERSES) {
    text = `
      <div class="cp-quote">
        <p class="cp-text cp-lead">${passageText(texts, start, end)}</p>
        ${copyButton(start, end)}
      </div>
      <button class="cp-context" data-context="${start}">Read in context</button>
      ${elsewhere(start, end)}
    `;
  } else if (verseCount <= READABLE_VERSES) {
    text = band({ id: 'verses', title: 'Verses', note: 'read the passage', count: verseCount, body: chapterVerses(texts, passage, highlight) + elsewhere(start, end) });
  }

  content.innerHTML = `
    ${text}
    ${genreBand(store, otherEnds)}
    ${band({
      id: 'references',
      title: 'References',
      note: 'where this points',
      count: outgoing.length,
      body: connectionList(store, outgoing, 'references', outgoingEnd, texts, expanded.has('references')),
    })}
    ${band({
      id: 'referenced-by',
      title: 'Referenced by',
      note: 'what points here',
      count: incoming.length,
      body: connectionList(store, incoming, 'referenced-by', incomingEnd, texts, expanded.has('referenced-by')),
    })}
  `;
}

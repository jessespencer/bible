import "@jessespencer/bible-ui/style.css";
import "./style.css";
import { APPS, appHref, createHeader, loadFonts } from "@jessespencer/bible-ui";
import { createTranslationPicker } from "@jessespencer/bible-ui/translation-picker";
import {
  DEFAULT_TRANSLATION,
  saveTranslation,
  savedTranslation,
  translationById,
  type Translation,
} from "@jessespencer/bible-ui/translations";
import { parseNeedProfile } from "./search/needProfile.ts";
import { createVerseSearch, type VerseSearch } from "./search/search.ts";
import { topics } from "./search/topics.ts";
import { indexToLabel, indexToParam } from "./search/verses.ts";

// The topics and their phrases were tuned on the World English Bible, so search always reads it.
const SEARCH_FILE = translationById("web")!.file;

const HINTS = [
  "I'm anxious about…",
  "I'm grieving the loss of…",
  "I need wisdom about…",
  "I can't forgive…",
  "I feel lonely because…",
  "I'm tempted to…",
  "I feel overwhelmed by…",
  "I'm worried about my family…",
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", parent?: HTMLElement) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.append(node);
  return node;
};

// ─── Data: Atlas's files, one string per verse ───────────────────

const bibles = new Map<string, Promise<string[]>>();

const loadBible = (file: string): Promise<string[]> => {
  let bible = bibles.get(file);
  if (!bible) {
    const url = `${import.meta.env.BASE_URL}${import.meta.env.DEV ? "" : "../atlas/"}data/${file}`;
    bible = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${url}`);
      return res.json() as Promise<string[]>;
    });
    bibles.set(file, bible);
    bible.catch(() => bibles.delete(file));
  }
  return bible;
};

let searchReady: Promise<VerseSearch> | null = null;
const getSearch = () => (searchReady ??= loadBible(SEARCH_FILE).then((verses) => createVerseSearch(verses)));

// ─── Shell ───────────────────────────────────────────────────────

loadFonts();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn("Offline copy unavailable", err));
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const header = createHeader({ title: "Bread Alone", subtitle: "Three verses for what you're carrying", appId: "bread", compact: true });
app.append(header.element);

let translation: Translation = translationById(new URLSearchParams(location.search).get("tr")) ?? savedTranslation();
createTranslationPicker({
  parent: header.controls,
  current: translation,
  onChange: (picked) => {
    translation = picked;
    saveTranslation(picked);
    writeUrl();
    void render();
  },
});

const main = el("main", "bread", app);

const intro = el("section", "bread__intro", main);
el("p", "bread__epigraph", intro).textContent =
  "“Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.”";
el("p", "bread__epigraph-ref", intro).textContent = "Matthew 4:4 · KJV";

const form = el("form", "bread__form", main);
form.setAttribute("role", "search");
const label = el("label", "bread__label", form);
label.htmlFor = "need";
label.textContent = "What are you carrying today?";
const row = el("div", "bread__row", form);
const input = el("input", "bread__input", row);
input.id = "need";
input.type = "search";
input.autocomplete = "off";
input.enterKeyHint = "search";
input.maxLength = 500;
input.placeholder = "I'm anxious about my job interview";
const submit = el("button", "bread__submit", row);
submit.type = "submit";
submit.textContent = "Find verses";

const hints = el("div", "bread__hints", form);
for (const hint of HINTS) {
  const chip = el("button", "bread__hint", hints);
  chip.type = "button";
  chip.textContent = hint;
  chip.addEventListener("click", () => {
    input.value = hint.replace("…", " ");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

const results = el("section", "bread__results", main);
results.setAttribute("aria-live", "polite");

// ─── State: the query and what has been shown for it ─────────────

let query = "";
let shown: number[] = [];
let seen: number[] = [];

const writeUrl = () => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (translation.id !== DEFAULT_TRANSLATION.id) params.set("tr", translation.id);
  const search = params.toString();
  history.replaceState(null, "", search ? `?${search}` : location.pathname);
};

const atlasHref = (verse: number) => {
  const atlas = APPS.find((a) => a.id === "atlas")!;
  const tr = translation.id === DEFAULT_TRANSLATION.id ? "" : `&tr=${translation.id}`;
  return `${appHref(atlas)}?ref=${indexToParam(verse)}${tr}`;
};

const render = async () => {
  results.replaceChildren();
  if (!shown.length) return;

  const text = await loadBible(translation.file);
  const need = parseNeedProfile(query);
  const topic = topics[need.primaryTopic];
  if (topic) el("p", "bread__topic", results).textContent = topic.label;

  const list = el("ol", "bread__list", results);
  for (const verse of shown) {
    const card = el("li", "bread__card", list);
    const quote = el("blockquote", "bread__verse", card);
    quote.lang = translation.language;
    quote.textContent = text[verse] ?? "";
    const foot = el("div", "bread__card-foot", card);
    el("cite", "bread__ref", foot).textContent = `${indexToLabel(verse)} · ${translation.abbr}`;
    const link = el("a", "bread__link", foot);
    link.href = atlasHref(verse);
    link.textContent = "Cross-references in Atlas";
  }

  const more = el("button", "bread__more", results);
  more.type = "button";
  more.textContent = "Show me others";
  more.addEventListener("click", () => void run({ shuffle: true }));
};

const run = async ({ shuffle = false } = {}) => {
  if (!query) return;
  submit.disabled = true;
  submit.textContent = "Reading…";
  try {
    const search = await getSearch();
    const need = parseNeedProfile(query);
    if (!shuffle) seen = [];
    shown = search.find(need, { exclude: seen, shuffle });
    // Every verse has been offered: start the round again.
    if (!shown.length) {
      seen = [];
      shown = search.find(need, { shuffle: true });
    }
    seen.push(...shown);
    await render();
  } catch (error) {
    console.error(error);
    results.replaceChildren();
    el("p", "bread__error", results).textContent = "The verses couldn't load. Check your connection and try again.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Find verses";
  }
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  query = input.value.trim().slice(0, 500);
  writeUrl();
  void run();
});

// A shared link opens on its answer; otherwise the index builds while the reader types.
const initial = new URLSearchParams(location.search).get("q")?.trim();
if (initial) {
  input.value = query = initial;
  void run();
} else {
  input.addEventListener("focus", () => void getSearch(), { once: true });
  // Safari has no requestIdleCallback.
  (window.requestIdleCallback ?? setTimeout)(() => void getSearch());
}

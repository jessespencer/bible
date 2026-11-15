import "@jessespencer/bible-ui/style.css";
import "./style.css";
import { APPS, appHref, createHeader, loadFonts } from "@jessespencer/bible-ui";
import { shareView } from "@jessespencer/bible-ui/share";
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
import { indexToParam } from "./search/verses.ts";
import { showCards, skeletonCards } from "./ui/cards.ts";
import { createComposer, topicName } from "./ui/composer.ts";
import { el, iconButton, prefersStillness, toast } from "./ui/dom.ts";

// The topics and their phrases were tuned on the World English Bible, so search always reads it.
const SEARCH_FILE = translationById("web")!.file;

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

const params = new URLSearchParams(location.search);
let translation: Translation = translationById(params.get("tr")) ?? savedTranslation();
createTranslationPicker({
  parent: header.controls,
  current: translation,
  onChange: (picked) => {
    translation = picked;
    saveTranslation(picked);
    writeUrl();
    if (shown.length) void render();
  },
});

const main = el("main", "bread", app);

const hero = el("section", "hero", main);
const epigraph = el("figure", "epigraph", hero);
el("blockquote", "epigraph__text", epigraph).textContent =
  "Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.";
el("figcaption", "epigraph__ref", epigraph).textContent = "Matthew 4:4 · KJV";

const composer = createComposer((text, steer) => {
  query = text;
  steered = steer;
  void run();
});
hero.append(composer.element);

const results = el("section", "results", main);
results.setAttribute("aria-live", "polite");
results.hidden = true;
const resultsHead = el("div", "results__head", results);
const list = el("ol", "cards", results);
const resultsFoot = el("div", "results__foot", results);
const more = iconButton("shuffle", "Three more", "pill-button pill-button--primary");
const shareLink = iconButton("link", "Share this search", "pill-button");
resultsFoot.append(more, shareLink);

// Every need the app knows, for a reader who would rather choose than write.
const browse = el("section", "browse", main);
el("h2", "browse__title", browse).textContent = "Or begin with a need";
const grid = el("div", "browse__grid", browse);
for (const [key, topic] of Object.entries(topics)) {
  const button = el("button", "need", grid);
  button.type = "button";
  el("span", "need__name", button).textContent = topicName(key);
  const rest = topic.label.split(" / ").slice(1).join(" · ");
  if (rest) el("span", "need__more", button).textContent = rest;
  button.addEventListener("click", () => {
    query = "";
    steered = key;
    composer.set("", key);
    void run();
  });
}

// ─── State: the need and what has been shown for it ──────────────

let query = "";
let steered: string | undefined;
let shown: number[] = [];
let seen: number[] = [];

const writeUrl = () => {
  const next = new URLSearchParams();
  if (query) next.set("q", query);
  if (steered) next.set("topic", steered);
  if (translation.id !== DEFAULT_TRANSLATION.id) next.set("tr", translation.id);
  const search = next.toString();
  history.replaceState(null, "", search ? `?${search}` : location.pathname);
};

const atlasHref = (verse: number) => {
  const atlas = APPS.find((a) => a.id === "atlas")!;
  const tr = translation.id === DEFAULT_TRANSLATION.id ? "" : `&tr=${translation.id}`;
  return `${appHref(atlas)}?ref=${indexToParam(verse)}${tr}`;
};

const renderHead = () => {
  resultsHead.replaceChildren();
  const need = parseNeedProfile(query, steered);
  const title = el("h2", "results__title", resultsHead);
  title.append(need.primaryTopic === "general" ? "Three verses for today" : "Three verses for ");
  if (need.primaryTopic !== "general") el("em", "", title).textContent = topicName(need.primaryTopic).toLowerCase();
  if (query) el("p", "results__query", resultsHead).textContent = `“${query}”`;
};

const render = async () => {
  const text = await loadBible(translation.file);
  renderHead();
  await showCards(list, { verses: shown, text, translation, atlasHref });
};

const run = async ({ again = false } = {}) => {
  if (!query && !steered) return;
  writeUrl();
  composer.setBusy(true);
  main.classList.add("bread--answered");
  results.hidden = false;
  let waiting: HTMLElement | null = null;
  try {
    if (!list.childElementCount) {
      list.remove();
      waiting = skeletonCards(results);
      results.insertBefore(waiting, resultsFoot);
    }
    const search = await getSearch();
    const need = parseNeedProfile(query, steered);
    if (!again) seen = [];
    shown = search.find(need, { exclude: seen, shuffle: again });
    // Every verse has been offered: start the round again.
    if (!shown.length) {
      seen = [];
      shown = search.find(need, { shuffle: true });
    }
    seen.push(...shown);
    waiting?.remove();
    if (!list.isConnected) results.insertBefore(list, resultsFoot);
    await render();
    if (!again && results.getBoundingClientRect().top > innerHeight * 0.6) {
      results.scrollIntoView({ behavior: prefersStillness() ? "auto" : "smooth", block: "start" });
    }
  } catch (error) {
    console.error(error);
    waiting?.remove();
    resultsHead.replaceChildren();
    el("p", "results__error", resultsHead).textContent = "The verses couldn't load. Check your connection and try again.";
  } finally {
    composer.setBusy(false);
  }
};

more.addEventListener("click", () => void run({ again: true }));
shareLink.addEventListener("click", async () => {
  const outcome = await shareView("Bread Alone", location.href);
  if (outcome === "copied") toast("Link copied");
  if (outcome === "failed") toast("Couldn't copy the link");
});

// A shared link opens on its answer; otherwise the index builds while the reader writes.
const initialQuery = params.get("q")?.trim() ?? "";
const initialTopic = params.get("topic") ?? undefined;
if (initialQuery || (initialTopic && initialTopic in topics)) {
  query = initialQuery;
  steered = initialTopic && initialTopic in topics ? initialTopic : undefined;
  composer.set(query, steered);
  void run();
} else {
  // Safari has no requestIdleCallback.
  (window.requestIdleCallback ?? setTimeout)(() => void getSearch());
}

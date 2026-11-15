import "@jessespencer/bible-ui/style.css";
import "./style.css";
import { APPS, appHref, createHeader, loadFonts } from "@jessespencer/bible-ui";
import { shareView } from "@jessespencer/bible-ui/share";
import { initTooltips } from "@jessespencer/bible-ui/tooltip";
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
import { el, icon, iconButton, prefersStillness, toast } from "./ui/dom.ts";

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
initTooltips();

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

const composer = createComposer(
  (text, steer) => {
    query = text;
    steered = steer;
    void run();
  },
  // Once there's an answer, a chip works like a filter on it: the verses follow straight away.
  (steer) => {
    if (results.hidden) return;
    if (!composer.value() && !steer) return startOver();
    query = composer.value();
    steered = steer;
    void run();
  },
);
hero.append(composer.element);

const results = el("section", "results", main);
results.setAttribute("aria-live", "polite");
results.hidden = true;
const resultsHead = el("div", "results__head", results);
const resultsHeading = el("div", "results__heading", resultsHead);
const restart = iconButton("rotateCcw", "Start over", "pill-button results__restart");
resultsHead.append(restart);
const list = el("ol", "cards", results);
const resultsFoot = el("div", "results__foot", results);
const more = iconButton("shuffle", "Three more", "pill-button pill-button--primary");
const shareLink = iconButton("link", "Share this search", "pill-button");
resultsFoot.append(more, shareLink);

// Every need the app knows, for a reader who would rather choose than write. A grid at the foot
// of the page to begin with; once there's an answer, a row under the composer, to switch need
// without scrolling past the verses.
const browse = el("section", "browse", main);
browse.setAttribute("aria-label", "Needs");
el("h2", "browse__title", browse).textContent = "Or begin with a need";
const grid = el("div", "browse__grid", browse);
const needButtons = new Map<string, HTMLButtonElement>();
for (const [key, topic] of Object.entries(topics)) {
  const button = el("button", "need", grid);
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  el("span", "need__name", button).textContent = topicName(key);
  const rest = topic.label.split(" / ").slice(1).join(" · ");
  if (rest) el("span", "need__more", button).textContent = rest;
  button.append(icon("x", "icon need__clear"));
  button.addEventListener("click", () => {
    // The need being shown: picked alone, tapping it again lets go of it; heard in the reader's
    // words, it stays theirs.
    if (button.getAttribute("aria-pressed") === "true") {
      if (!query) startOver();
      return;
    }
    query = "";
    steered = key;
    composer.set("", key, true);
    void run();
  });
  needButtons.set(key, button);
}

// The row fades only at an end with more needs past it.
const fadeRow = () => {
  const end = grid.scrollWidth - grid.clientWidth;
  grid.classList.toggle("browse__grid--more-before", grid.scrollLeft > 1);
  grid.classList.toggle("browse__grid--more-after", grid.scrollLeft < end - 1);
};
grid.addEventListener("scroll", fadeRow, { passive: true });
addEventListener("resize", fadeRow);

const showNeed = (topic: string | undefined) => {
  browse.classList.toggle("browse--picked", !query);
  for (const [key, button] of needButtons) {
    const on = key === topic;
    button.setAttribute("aria-pressed", String(on));
    button.title = on && !query ? `Let go of ${topicName(key).toLowerCase()}` : "";
  }
  // Bring it into the row's view without moving the page.
  const lit = needButtons.get(topic ?? "");
  if (lit) {
    const row = grid.getBoundingClientRect();
    const chip = lit.getBoundingClientRect();
    grid.scrollLeft += chip.left - row.left - (row.width - chip.width) / 2;
  }
  fadeRow();
};

// ─── State: the need and what has been shown for it ──────────────

let query = "";
let steered: string | undefined;
let shown: number[] = [];
let seen: number[] = [];

/** `push` adds a history entry, so Back returns from an answer to the start. */
const writeUrl = (push = false) => {
  const next = new URLSearchParams();
  if (query) next.set("q", query);
  if (steered) next.set("topic", steered);
  if (translation.id !== DEFAULT_TRANSLATION.id) next.set("tr", translation.id);
  const search = next.toString();
  const url = search ? `?${search}` : location.pathname;
  if (url === `${location.search || location.pathname}`) return;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
};

/** Answered or not: the needs move to sit under the composer while there are verses. */
const setAnswered = (answered: boolean) => {
  main.classList.toggle("bread--answered", answered);
  results.hidden = !answered;
  if (answered) hero.after(browse);
  else main.append(browse);
};

const atlasHref = (verse: number) => {
  const atlas = APPS.find((a) => a.id === "atlas")!;
  const tr = translation.id === DEFAULT_TRANSLATION.id ? "" : `&tr=${translation.id}`;
  return `${appHref(atlas)}?ref=${indexToParam(verse)}${tr}`;
};

const renderHead = () => {
  resultsHeading.replaceChildren();
  const need = parseNeedProfile(query, steered);
  const title = el("h2", "results__title", resultsHeading);
  title.append(need.primaryTopic === "general" ? "Three verses for today" : "Three verses for ");
  if (need.primaryTopic !== "general") el("em", "", title).textContent = topicName(need.primaryTopic).toLowerCase();
  if (query) el("p", "results__query", resultsHeading).textContent = `“${query}”`;
  showNeed(need.primaryTopic);
};

const render = async () => {
  const text = await loadBible(translation.file);
  renderHead();
  await showCards(list, { verses: shown, text, translation, atlasHref });
};

const run = async ({ again = false, fromHistory = false } = {}) => {
  if (!query && !steered) return;
  if (!fromHistory) writeUrl(results.hidden);
  composer.setBusy(true);
  setAnswered(true);
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
    resultsHeading.replaceChildren();
    el("p", "results__error", resultsHeading).textContent = "The verses couldn't load. Check your connection and try again.";
  } finally {
    composer.setBusy(false);
  }
};

/** Back to the beginning: no verses, no need, an empty field. */
const startOver = ({ fromHistory = false } = {}) => {
  query = "";
  steered = undefined;
  shown = [];
  seen = [];
  composer.set("");
  list.replaceChildren();
  resultsHeading.replaceChildren();
  showNeed(undefined);
  setAnswered(false);
  if (!fromHistory) writeUrl(true);
  scrollTo({ top: 0, behavior: prefersStillness() ? "auto" : "smooth" });
  // Not on touch screens, where focusing would throw up the keyboard over the needs.
  if (matchMedia("(hover: hover)").matches) composer.focus();
};

restart.addEventListener("click", () => startOver());
more.addEventListener("click", () => void run({ again: true }));
shareLink.addEventListener("click", async () => {
  const outcome = await shareView("Bread Alone", location.href);
  if (outcome === "copied") toast("Link copied");
  if (outcome === "failed") toast("Couldn't copy the link");
});

/** The answer the URL asks for, or the start when it asks for none. */
const fromUrl = (fromHistory: boolean): boolean => {
  const url = new URLSearchParams(location.search);
  const q = url.get("q")?.trim() ?? "";
  const topic = url.get("topic") ?? undefined;
  const known = topic && topic in topics ? topic : undefined;
  if (!q && !known) return false;
  query = q;
  steered = known;
  composer.set(query, steered, !q);
  void run({ fromHistory });
  return true;
};

addEventListener("popstate", () => {
  if (!fromUrl(true)) startOver({ fromHistory: true });
});

// A shared link opens on its answer; otherwise the index builds while the reader writes.
// Safari has no requestIdleCallback.
if (!fromUrl(true)) (window.requestIdleCallback ?? setTimeout)(() => void getSearch());

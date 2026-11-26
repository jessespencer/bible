/**
 * The answer: three verse cards that rise in turn. Each opens onto the verses around it, copies,
 * becomes an image to share, or opens in Atlas with its cross-references.
 */

import type { Translation } from "@jessespencer/bible-ui/translations";
import { around, indexToLabel, verseNumber } from "../search/verses.ts";
import { el, icon, iconButton, prefersStillness, toast } from "./dom.ts";
import { shareVerseImage } from "./shareImage.ts";

const NUMERALS = ["I", "II", "III", "IV", "V"];
/** How many verses either side "Read around it" shows. */
export const CONTEXT = 3;

export interface CardsConfig {
  verses: number[];
  text: string[];
  translation: Translation;
  atlasHref: (verse: number) => string;
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const card = ({ text, translation, atlasHref }: CardsConfig, verse: number, position: number) => {
  const reference = indexToLabel(verse);
  const item = el("li", "card");
  item.style.setProperty("--i", String(position));

  const numeral = el("span", "card__numeral", item);
  numeral.textContent = NUMERALS[position] ?? "";
  numeral.setAttribute("aria-hidden", "true");

  const quote = el("blockquote", "card__verse", item);
  quote.lang = translation.language;
  // No quotation marks of ours: the card is the quotation, and many verses carry their own.
  quote.textContent = text[verse] ?? "";

  // The verses around it, in an open-and-close drawer; the found one stays lit.
  const drawer = el("div", "card__drawer", item);
  const passage = el("p", "card__passage", el("div", "card__drawer-inner", drawer));
  passage.lang = translation.language;
  const fillPassage = () => {
    if (passage.childElementCount) return;
    for (const index of around(verse, CONTEXT)) {
      // Missing only where a licence limits how much may be shown at once.
      if (text[index] === undefined) continue;
      const span = el("span", index === verse ? "card__line card__line--found" : "card__line", passage);
      el("sup", "", span).textContent = String(verseNumber(index));
      span.append(`${text[index] ?? ""} `);
    }
  };

  const foot = el("footer", "card__foot", item);
  const cite = el("cite", "card__ref", foot);
  cite.textContent = reference;
  el("span", "card__abbr", cite).textContent = translation.abbr;

  const actions = el("div", "card__actions", foot);
  const context = iconButton("bookOpen", "Read around it", "card__action");
  context.setAttribute("aria-expanded", "false");
  const copyButton = iconButton("copy", "Copy", "card__action", true);
  const imageButton = iconButton("image", "Share as an image", "card__action", true);
  const atlas = el("a", "card__action", actions);
  atlas.href = atlasHref(verse);
  atlas.append(icon("atlas"));
  el("span", "sr-only", atlas).textContent = "Cross-references in Atlas";
  actions.prepend(context, copyButton, imageButton);

  context.addEventListener("click", () => {
    const open = !item.classList.contains("card--open");
    if (open) fillPassage();
    item.classList.toggle("card--open", open);
    context.setAttribute("aria-expanded", String(open));
    context.querySelector("span")!.textContent = open ? "Just this verse" : "Read around it";
  });

  // Copied: the icon turns to a check for a moment, as well as the note at the foot.
  let copied = 0;
  copyButton.addEventListener("click", async () => {
    const done = await copy(`${text[verse] ?? ""}\n— ${reference} (${translation.abbr})`);
    toast(done ? `Copied ${reference}` : "Couldn't reach the clipboard");
    if (!done) return;
    copyButton.firstElementChild!.replaceWith(icon("check", "icon icon--done"));
    clearTimeout(copied);
    copied = window.setTimeout(() => copyButton.firstElementChild!.replaceWith(icon("copy")), 1600);
  });

  imageButton.addEventListener("click", async () => {
    imageButton.disabled = true;
    try {
      const outcome = await shareVerseImage(text[verse] ?? "", `${reference} · ${translation.abbr}`);
      if (outcome === "saved") toast(`Saved ${reference} as an image`);
    } catch {
      toast("Couldn't make the image");
    } finally {
      imageButton.disabled = false;
    }
  });

  return item;
};

/** Placeholder cards while the search reads the Bible for the first time. */
export const skeletonCards = (parent: HTMLElement) => {
  const list = el("ol", "cards cards--waiting", parent);
  list.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) {
    const item = el("li", "card card--skeleton", list);
    item.style.setProperty("--i", String(i));
    for (const width of [92, 78, 54]) el("span", "skeleton-line", item).style.width = `${width}%`;
  }
  return list;
};

/** Replaces `list`'s cards with new ones, the old ones stepping away first. */
export const showCards = async (list: HTMLOListElement, config: CardsConfig) => {
  if (list.childElementCount && !prefersStillness()) {
    list.classList.add("cards--leaving");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  list.classList.remove("cards--leaving", "cards--waiting");
  list.replaceChildren(...config.verses.map((verse, i) => card(config, verse, i)));
};

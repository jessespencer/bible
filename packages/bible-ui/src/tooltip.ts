/**
 * Tooltips in the family's style, in place of the browser's. Call `initTooltips()` once.
 *
 * - A button or link that shows no words of its own (an icon, or a label hidden on a phone) gets
 *   its accessible name: its `aria-label`, or its visually hidden text.
 * - Anything with a `title` gets that title, always, and the browser's own tip is suppressed.
 *
 * With a mouse or pen after a short rest, at once while moving between tips, and on keyboard
 * focus. Never on touch, where a press would leave a tip behind.
 */

const TARGETS = "button, a[href], [role='button'], summary, [title], [data-bui-tip]";
const DELAY = 450;
// Moving from one tip to the next shows the next at once.
const WARM = 350;
const GAP = 8;
const EDGE = 8;

let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let timer = 0;
let hiddenAt = 0;
// A tip follows its element's words while it shows: "Share" turning to "Link copied".
const watcher = new MutationObserver(() => {
  if (!current || !tip) return;
  const text = tipFor(current);
  if (!text) return hide();
  if (tip.textContent !== text) {
    tip.textContent = text;
    place(current);
  }
});

const hasVisibleWords = (el: HTMLElement): boolean => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !/[\p{L}\p{N}]/u.test(node.textContent ?? "")) continue;
    if (parent.closest(".sr-only, .bui-sr-only, svg")) continue;
    if (parent.getClientRects().length) return true;
  }
  return false;
};

/** The tip for an element, or "" for none. A `title` is taken over so the browser shows nothing. */
const tipFor = (el: HTMLElement): string => {
  if (el.hasAttribute("title")) {
    const title = el.getAttribute("title")!.trim();
    el.removeAttribute("title");
    if (title) el.dataset.buiTip = title;
    else delete el.dataset.buiTip;
  }
  if (el.dataset.buiTip) return el.dataset.buiTip;
  if (!el.matches("button, a[href], [role='button'], summary") || hasVisibleWords(el)) return "";
  const hidden = el.querySelector(".sr-only, .bui-sr-only")?.textContent?.trim();
  return el.getAttribute("aria-label")?.trim() || hidden || "";
};

const place = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  const { width, height } = tip!.getBoundingClientRect();
  const below = box.top - GAP - height < EDGE;
  const top = below ? box.bottom + GAP : box.top - GAP - height;
  const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, EDGE), innerWidth - width - EDGE);
  tip!.style.left = `${Math.round(left)}px`;
  tip!.style.top = `${Math.round(top)}px`;
  tip!.classList.toggle("bui-tip--below", below);
};

const show = (el: HTMLElement) => {
  const text = tipFor(el);
  if (!text) return;
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "bui-tip";
    tip.id = "bui-tip";
    tip.setAttribute("role", "tooltip");
    document.body.append(tip);
  }
  current = el;
  tip.textContent = text;
  place(el);
  tip.classList.add("bui-tip--on");
  // A title adds something; a name read again as a description would only repeat it.
  if (el.dataset.buiTip) el.setAttribute("aria-describedby", tip.id);
  watcher.observe(el, { attributes: true, attributeFilter: ["title", "aria-label"] });
};

const hide = () => {
  clearTimeout(timer);
  if (!current) return;
  watcher.disconnect();
  current.removeAttribute("aria-describedby");
  current = null;
  hiddenAt = performance.now();
  tip?.classList.remove("bui-tip--on");
};

const targetOf = (event: Event): HTMLElement | null =>
  (event.target instanceof Element ? event.target.closest<HTMLElement>(TARGETS) : null);

let started = false;

export const initTooltips = () => {
  if (started) return;
  started = true;

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const el = targetOf(event);
    if (!el || el === current) return;
    hide();
    const warm = performance.now() - hiddenAt < WARM;
    timer = window.setTimeout(() => show(el), warm ? 0 : DELAY);
  });

  document.addEventListener("pointerout", (event) => {
    const el = targetOf(event);
    const into = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (el && !(into && el.contains(into))) hide();
  });

  document.addEventListener("focusin", (event) => {
    const el = targetOf(event);
    if (el?.matches(":focus-visible")) show(el);
  });
  document.addEventListener("focusout", hide);
  // A press is the answer to the tip; scrolling leaves it behind.
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("scroll", hide, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
};

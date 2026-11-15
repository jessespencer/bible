/** Small DOM helpers. Text always goes in through textContent; only the icons below are markup. */

import { APPS } from "@jessespencer/bible-ui/apps";

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", parent?: HTMLElement) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.append(node);
  return node;
};

// Lucide icons (ISC), the insides of a 24×24 viewBox, as the other apps use.
const ICONS = {
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  bookOpen:
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  shuffle:
    '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  // Atlas's own mark, the arches of its arc diagram, for the links that open a verse there.
  atlas: APPS.find((app) => app.id === "atlas")!.icon,
} as const;

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName, className = "icon"): SVGElement => {
  const holder = document.createElement("span");
  holder.innerHTML =
    `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return holder.firstElementChild as SVGElement;
};

/** A button with an icon and a label, the label hidden visually where `iconOnly`. */
export const iconButton = (name: IconName, label: string, className: string, iconOnly = false) => {
  const button = el("button", className);
  button.type = "button";
  button.append(icon(name));
  // Its tip, where the label isn't shown, comes from initTooltips.
  const text = el("span", iconOnly ? "sr-only" : "", button);
  text.textContent = label;
  return button;
};

export const prefersStillness = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A short note at the foot of the screen: "Copied", "Saved". */
export const toast = (() => {
  let node: HTMLElement | null = null;
  let timer = 0;
  return (message: string) => {
    if (!node) {
      node = el("div", "toast", document.body);
      node.setAttribute("role", "status");
    }
    node.textContent = message;
    node.classList.add("toast--on");
    clearTimeout(timer);
    timer = window.setTimeout(() => node?.classList.remove("toast--on"), 1800);
  };
})();


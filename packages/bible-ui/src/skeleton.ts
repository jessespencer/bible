/**
 * Text skeletons: faint bars in the shape of words that hold a passage's place while its verses
 * are fetched, so the words arrive into room already made for them instead of flashing in.
 * They take the colour of the text around them, and wait a beat before showing, so text that
 * comes back quickly never shows a skeleton at all.
 */

// Word lengths in em, fixed so a passage waits with the same shape rather than reshuffling on each render.
const WIDTHS = [
  2.2, 4.1, 1.4, 3.3, 5.2, 1.8, 2.9, 4.6, 1.2, 3.8, 2.4, 5.6, 1.6, 3.1, 2.7, 4.4, 1.3, 3.6, 2.1, 4.9, 1.9, 2.6, 3.4,
  1.5, 5.1, 2.3, 3.9, 1.7, 4.2, 2.8, 1.4, 3.5, 4.7, 2.0, 3.2, 1.6, 5.4, 2.5, 3.7, 1.3, 4.3, 2.9, 1.8, 3.0, 4.8, 2.2,
  1.5, 3.6, 5.0, 2.6, 1.9, 4.0, 3.3, 1.4, 2.7, 4.5, 2.1, 3.8, 1.7, 5.3, 2.4, 3.1, 1.6, 4.1, 2.8, 3.5, 1.2, 4.6, 2.3,
  3.9, 1.8, 2.5, 5.5, 3.0, 1.5, 4.2, 2.0, 3.4, 1.9, 4.9, 2.6, 3.7, 1.3, 2.9, 4.4, 2.2, 3.2, 1.7, 5.0, 2.7, 3.6, 1.4,
  4.0, 2.4, 3.3, 1.6, 4.7, 2.1, 3.8, 2.8,
];

/** About how many words a verse holds, for sizing a skeleton to the verses it stands in for. */
export const WORDS_PER_VERSE = 14;

/** `count` word widths in em. `from` starts further into the list, so neighbouring verses differ. */
export const skeletonWidths = (count: number, from = 0): number[] =>
  Array.from({ length: Math.max(1, count) }, (_, i) => WIDTHS[(from + i) % WIDTHS.length] ?? 3);

export interface SkeletonOptions {
  /** How many word bars to draw. */
  words: number;
  /** Where in the fixed run of widths to begin; a verse number makes each verse its own shape. */
  from?: number;
  /** Read to screen readers in place of the bars. */
  label?: string;
}

/** A skeleton as HTML, for views built from strings. */
export const skeletonHtml = ({ words, from = 0, label = "Loading" }: SkeletonOptions): string => {
  const bars = skeletonWidths(words, from)
    .map((width, i) => `<span class="bui-skeleton__word" style="width:${width}em;animation-delay:${(i % 23) * 40}ms"></span>`)
    .join(" ");
  return `<span class="bui-skeleton"><span class="bui-skeleton__label">${label}</span><span aria-hidden="true">${bars}</span></span>`;
};

/** A skeleton as an element, for views built from nodes. */
export const createSkeleton = (options: SkeletonOptions): HTMLElement => {
  const holder = document.createElement("span");
  holder.innerHTML = skeletonHtml(options);
  return holder.firstElementChild as HTMLElement;
};

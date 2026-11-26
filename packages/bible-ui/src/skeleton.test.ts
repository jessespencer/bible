// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createSkeleton, skeletonWidths } from "./skeleton";

describe("skeleton", () => {
  it("draws as many word bars as asked, hidden from screen readers behind a label", () => {
    const skeleton = createSkeleton({ words: 5, label: "Loading the verse" });
    expect(skeleton.querySelectorAll(".bui-skeleton__word")).toHaveLength(5);
    expect(skeleton.querySelector('[aria-hidden="true"]')?.contains(skeleton.querySelector(".bui-skeleton__word"))).toBe(true);
    expect(skeleton.textContent?.trim()).toBe("Loading the verse");
  });

  it("keeps the same shape for the same verse, and a different one for its neighbour", () => {
    expect(skeletonWidths(6, 3)).toEqual(skeletonWidths(6, 3));
    expect(skeletonWidths(6, 3)).not.toEqual(skeletonWidths(6, 4));
  });

  it("wraps around the run of widths for long passages", () => {
    expect(skeletonWidths(250)).toHaveLength(250);
    expect(skeletonWidths(250).every((width) => width > 0)).toBe(true);
  });
});

/**
 * A verse as a typeset image, 1080 × 1350 (a portrait post): the words large in EB Garamond,
 * the reference in the app's accent, Bread Alone small at the foot. Drawn in the reader's theme.
 */

import { cssToken } from "@jessespencer/bible-ui/tokens";

const W = 1080;
const H = 1350;
const MARGIN = 120;

const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

export const drawVerseImage = async (text: string, reference: string): Promise<Blob> => {
  await Promise.all([
    document.fonts.load('400 64px "EB Garamond"'),
    document.fonts.load('italic 400 40px "IM Fell Great Primer"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const base = cssToken("--bg-base") || "#020611";
  const surface = cssToken("--bg-surface") || "#050C1E";
  const ink = cssToken("--text-bright") || "#F6F1E6";
  const muted = cssToken("--text-muted") || "#7A84A3";
  const accent = `rgb(${cssToken("--accent-rgb") || "224, 186, 140"})`;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, surface);
  sky.addColorStop(1, base);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // The family's rainbow along the top, as in every app's header.
  const rainbow = ctx.createLinearGradient(0, 0, W, 0);
  ["#EB827B", "#E18C5F", "#C79E41", "#8CB460", "#5ABB88", "#4AB9B2", "#67AAED", "#B191EA"].forEach((c, i, all) =>
    rainbow.addColorStop(i / (all.length - 1), c),
  );
  ctx.fillStyle = rainbow;
  ctx.fillRect(0, 0, W, 8);

  // The largest size at which the verse fits its space, from 68px down.
  const room = H - MARGIN * 2 - 220;
  let size = 68;
  let lines: string[] = [];
  for (; size >= 34; size -= 2) {
    ctx.font = `400 ${size}px "EB Garamond", Georgia, serif`;
    lines = wrap(ctx, text.trim(), W - MARGIN * 2);
    if (lines.length * size * 1.42 <= room) break;
  }
  const lead = size * 1.42;
  const blockHeight = lines.length * lead;
  let y = MARGIN + 60 + (room - blockHeight) / 2 + size;

  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y);
    y += lead;
  }

  ctx.fillStyle = accent;
  ctx.font = 'italic 400 40px "IM Fell Great Primer", Georgia, serif';
  ctx.fillText(reference, MARGIN, y + 36);

  ctx.fillStyle = muted;
  ctx.font = '400 28px "EB Garamond", Georgia, serif';
  ctx.fillText("Bread Alone · jessespencer.dev/bible/bread", MARGIN, H - MARGIN + 20);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the image"))), "image/png"),
  );
};

/** The system share sheet with the image where it takes files (phones); otherwise it saves. */
export const shareVerseImage = async (text: string, reference: string): Promise<"shared" | "saved"> => {
  const blob = await drawVerseImage(text, reference);
  const name = `${reference.replace(/[^\w]+/g, "-").replace(/-+$/, "")}.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (matchMedia("(hover: none)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: reference });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "saved";
};

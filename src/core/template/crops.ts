import type { TBox } from "./storyboard";

export type Size = { w: number; h: number };

const area = (b: TBox) => Math.max(0, b.w) * Math.max(0, b.h);
function inter(a: TBox, b: TBox) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, r - x) * Math.max(0, btm - y);
}

/** Clamp a model-provided box into the image; returns null if it is degenerate. */
export function cleanBox(b: TBox, img: Size): TBox | null {
  const x = Math.max(0, Math.min(img.w, b.x)), y = Math.max(0, Math.min(img.h, b.y));
  const w = Math.min(img.w - x, b.w), h = Math.min(img.h - y, b.h);
  if (w < img.w * 0.03 || h < img.h * 0.03) return null;
  return { x, y, w, h };
}

/**
 * Best window with the given aspect (w/h): keeps as much of the product as possible
 * and as little baked-in text as possible. Tries a few sizes and positions.
 */
export function bestWindow(img: Size, product: TBox, text: TBox[], aspect: number, opts: { minScale?: number } = {}): TBox {
  let baseH = img.h, baseW = baseH * aspect;
  if (baseW > img.w) { baseW = img.w; baseH = baseW / aspect; }
  const pc = { x: product.x + product.w / 2, y: product.y + product.h / 2 };
  let best: { b: TBox; s: number } | null = null;
  for (const scale of [1, 0.92, 0.84, 0.76, 0.68].filter((s) => s >= (opts.minScale ?? 0.68))) {
    const w = baseW * scale, h = baseH * scale;
    for (let i = 0; i <= 16; i++) {
      for (let j = 0; j <= 8; j++) {
        const x = (img.w - w) * (i / 16), y = (img.h - h) * (j / 8);
        const b = { x, y, w, h };
        const cover = inter(b, product) / Math.max(1, area(product));
        const txt = text.reduce((a, t) => a + inter(b, t), 0) / area(b);
        const off = Math.hypot(x + w / 2 - pc.x, y + h / 2 - pc.y) / Math.hypot(img.w, img.h);
        const s = cover * 3 - txt * 6 - off * 0.6 + scale * 0.4;
        if (!best || s > best.s) best = { b, s };
      }
    }
  }
  return best!.b;
}

/** Square-ish window around a detail box (for circles / cards), padded and clamped. */
export function around(img: Size, b: TBox, aspect: number, pad = 1.15): TBox {
  let w = b.w * pad, h = b.h * pad;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  w = Math.min(w, img.w); h = Math.min(h, img.h);
  if (w / h > aspect) w = h * aspect; else h = w / aspect;
  const x = Math.max(0, Math.min(img.w - w, b.x + b.w / 2 - w / 2));
  const y = Math.max(0, Math.min(img.h - h, b.y + b.h / 2 - h / 2));
  return { x, y, w, h };
}

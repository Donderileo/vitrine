import fs from "node:fs";
import path from "node:path";
import { ffmpeg, probeSize } from "./ffmpeg";
import { bestWindow, cleanBox } from "./template/crops";
import type { ProjectRow } from "./db";

// Static links page (Cloudflare Pages). Deploy with: npm run site:deploy
export const SITE_DIR = path.resolve(process.env.SITE_DIR ?? "./site/public");
const LIST = path.join(SITE_DIR, "products.json");

export type SiteProduct = {
  num: number; title: string; price?: string | null; link?: string | null; img: string; project: string; updatedAt: string;
};

export function readProducts(): SiteProduct[] {
  try { return JSON.parse(fs.readFileSync(LIST, "utf8")); } catch { return []; }
}

export function getProduct(num: number | null | undefined) {
  return num ? readProducts().find((p) => p.num === num) : undefined;
}

/** Adds/updates the project's card on the links page: 3:4 thumbnail of the hero image (avoiding baked-in text) + link. */
export async function publishProduct(row: ProjectRow, opts: { link?: string; price?: string; title?: string }) {
  if (!row.num) throw new Error("Projeto sem número de produto");
  if (opts.link && !/^https:\/\//.test(opts.link)) throw new Error("O link precisa começar com https://");
  fs.mkdirSync(path.join(SITE_DIR, "img"), { recursive: true });

  const sb = row.state.storyboard;
  const heroIdx = sb?.variations[0]?.heroImage ?? 0;
  const photo = row.input.photos[heroIdx] ?? row.input.photos[0];
  const size = await probeSize(photo);
  const info = sb?.images.find((i) => i.index === heroIdx);
  const product = (info && cleanBox(info.product, size)) ?? { x: size.w * 0.15, y: size.h * 0.05, w: size.w * 0.7, h: size.h * 0.9 };
  const text = (info?.textBoxes ?? []).map((t) => cleanBox(t, size)).filter(Boolean) as any[];
  const win = bestWindow(size, product, text, 3 / 4, { minScale: 0.68 });
  const img = `img/${row.num}.jpg`;
  await ffmpeg(["-i", photo, "-vf", `crop=${Math.round(win.w)}:${Math.round(win.h)}:${Math.round(win.x)}:${Math.round(win.y)},scale=600:800`, "-q:v", "4", path.join(SITE_DIR, img)]);

  const list = readProducts().filter((p) => p.num !== row.num);
  const entry: SiteProduct = {
    num: row.num,
    title: opts.title || sb?.title || row.name,
    price: opts.price || sb?.price || row.input.priceText || null,
    link: opts.link || null,
    img: `/${img}`,
    project: row.id,
    updatedAt: new Date().toISOString(),
  };
  list.push(entry);
  list.sort((a, b) => a.num - b.num);
  fs.writeFileSync(LIST, JSON.stringify(list, null, 2));
  return entry;
}

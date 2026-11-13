import fs from "node:fs";
import path from "node:path";
import { customAlphabet } from "nanoid";
import { config } from "../config";
import type { Carousel } from "./types";

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);
export const newCarouselId = () => id();
export const newProductId = () => id();

export const carouselsRoot = () => path.join(config.dataDir, "carousels");
export const carouselDir = (cid: string) => path.join(carouselsRoot(), cid.replace(/[^a-z0-9]/gi, ""));
const file = (cid: string) => path.join(carouselDir(cid), "carousel.json");

export function createCarousel(title = "Minha lista Shopee"): Carousel {
  const now = Date.now();
  const c: Carousel = {
    id: newCarouselId(), title, keyword: "LINK", cta: "bio", format: "9x16", priceFrom: true, publi: true,
    products: [], slides: [], costUsd: 0, createdAt: now, updatedAt: now,
  };
  saveCarousel(c);
  return c;
}

export function getCarousel(cid: string): Carousel | undefined {
  try { return JSON.parse(fs.readFileSync(file(cid), "utf8")) as Carousel; } catch { return undefined; }
}

export function saveCarousel(c: Carousel) {
  fs.mkdirSync(carouselDir(c.id), { recursive: true });
  c.updatedAt = Date.now();
  fs.writeFileSync(file(c.id), JSON.stringify(c, null, 2));
}

export function listCarousels(): Carousel[] {
  const root = carouselsRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .map((d) => getCarousel(d))
    .filter((c): c is Carousel => Boolean(c))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Path of a file inside the carousel folder relative to the data dir (what /api/files/<…> serves). */
export const rel = (abs: string) => path.relative(config.dataDir, abs).split(path.sep).join("/");

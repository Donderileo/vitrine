import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { download, falRun, falUpload } from "../providers/fal";
import { carouselDir } from "./store";
import type { Carousel, Product } from "./types";

/**
 * Removes the background of a product photo with fal (~US$0.005 each). Never throws: on any failure the slide
 * simply uses the original photo on a card, so one bad image doesn't block the carousel.
 * Returns the cost spent (0 when skipped).
 */
export async function cutProduct(c: Carousel, p: Product, log: (m: string) => void): Promise<number> {
  if (!p.photo || !p.useCut || p.cut) return 0;
  if (!config.falKey) { log(`recorte: FAL_KEY não configurada — "${p.short}" usa a foto original`); return 0; }
  const dir = carouselDir(c.id);
  const src = path.join(dir, "photos", p.photo);
  if (!fs.existsSync(src)) return 0;
  try {
    const url = await falUpload(src);
    const out: any = await falRun(config.falRembgModel, { image_url: url }, log);
    const img = out?.image?.url ?? out?.images?.[0]?.url;
    if (!img) throw new Error("resposta sem imagem");
    fs.mkdirSync(path.join(dir, "cut"), { recursive: true });
    const name = `${p.id}.png`;
    await download(img, path.join(dir, "cut", name));
    p.cut = name;
    log(`recorte ok: ${p.short}`);
    return config.falRembgUsd;
  } catch (e) {
    log(`recorte falhou em "${p.short}" (${(e as Error).message.slice(0, 120)}) — usando a foto original`);
    return 0;
  }
}

import fs from "node:fs";
import { NextResponse } from "next/server";
import { config } from "@/src/core/config";
import { buildCaption, buildLinks } from "@/src/core/carousel/copy";
import { carouselDir, getCarousel, saveCarousel } from "@/src/core/carousel/store";
import type { Carousel, Product } from "@/src/core/carousel/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const view = (c: Carousel) => ({
  carousel: c, caption: buildCaption(c), links: buildLinks(c),
  keys: { fal: Boolean(config.falKey), claude: config.llmProvider === "anthropic" && Boolean(config.anthropicKey) },
});

export async function GET(_: Request, { params }: Ctx) {
  const c = getCarousel((await params).id);
  return c ? NextResponse.json(view(c)) : NextResponse.json({ error: "não encontrado" }, { status: 404 });
}

const s = (v: unknown, d = "", max = 400) => (typeof v === "string" ? v.slice(0, max) : d);

/** Saves the user's edits (settings, product fields and order). Photos/cut-outs stay as the server has them. */
export async function PUT(req: Request, { params }: Ctx) {
  const c = getCarousel((await params).id);
  if (!c) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  c.title = s(b.title, c.title, 80).trim() || c.title;
  c.keyword = s(b.keyword, c.keyword, 30).replace(/\s+/g, "").toUpperCase() || "LINK";
  if (["bio", "comentar", "ambos"].includes(b.cta)) c.cta = b.cta;
  if (["9x16", "4x5"].includes(b.format)) c.format = b.format;
  if (typeof b.priceFrom === "boolean") c.priceFrom = b.priceFrom;
  if (typeof b.publi === "boolean") c.publi = b.publi;
  if (b.copy && typeof b.copy === "object") {
    c.copy = {
      coverTitle: s(b.copy.coverTitle, c.copy?.coverTitle ?? "", 80), coverSub: s(b.copy.coverSub, c.copy?.coverSub ?? "", 80),
      intro: s(b.copy.intro, c.copy?.intro ?? "", 600),
      hashtags: Array.isArray(b.copy.hashtags) ? b.copy.hashtags.slice(0, 10).map((h: unknown) => "#" + s(h, "", 40).replace(/^#+/, "").replace(/\s+/g, "")).filter((h: string) => h.length > 1) : c.copy?.hashtags ?? [],
    };
  }
  if (Array.isArray(b.products)) {
    const byId = new Map(c.products.map((p) => [p.id, p]));
    const next: Product[] = [];
    for (const e of b.products) {
      const p = byId.get(e?.id);
      if (!p) continue;
      p.short = s(e.short, p.short, 60).trim(); p.tag = s(e.tag, p.tag, 30).trim();
      p.price = s(e.price, p.price, 20).trim(); p.link = s(e.link, p.link, 500).trim();
      p.useCut = typeof e.useCut === "boolean" ? e.useCut : p.useCut;
      p.place = e.place === "float" ? "float" : "floor";
      next.push(p);
    }
    for (const gone of c.products.filter((p) => !next.includes(p) && !b.products.some((e: any) => e?.id === p.id))) {
      for (const f of [gone.photo && `photos/${gone.photo}`, gone.cut && `cut/${gone.cut}`]) if (f) fs.rmSync(`${carouselDir(c.id)}/${f}`, { force: true });
    }
    c.products = next;
  }
  saveCarousel(c);
  return NextResponse.json(view(c));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = (await params).id;
  if (!getCarousel(id)) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  fs.rmSync(carouselDir(id), { recursive: true, force: true });
  return NextResponse.json({ ok: true });
}

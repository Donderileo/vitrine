import { NextResponse } from "next/server";
import { buildCaption, buildLinks, writeCarouselCopy } from "@/src/core/carousel/copy";
import { getCarousel, saveCarousel } from "@/src/core/carousel/store";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCarousel((await params).id);
  if (!c) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  if (!c.products.length) return NextResponse.json({ error: "Importe os produtos primeiro" }, { status: 400 });
  const logs: string[] = [];
  c.costUsd += await writeCarouselCopy(c, (m) => logs.push(m));
  saveCarousel(c);
  return NextResponse.json({ carousel: c, caption: buildCaption(c), links: buildLinks(c), logs });
}

import { NextResponse } from "next/server";
import { buildCaption, buildLinks } from "@/src/core/carousel/copy";
import { renderCarousel } from "@/src/core/carousel/render";
import { getCarousel } from "@/src/core/carousel/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCarousel((await params).id);
  if (!c) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  if (!c.products.length) return NextResponse.json({ error: "Importe os produtos primeiro" }, { status: 400 });
  const logs: string[] = [];
  try {
    await renderCarousel(c, (m) => logs.push(m));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 300), logs }, { status: 500 });
  }
  return NextResponse.json({ carousel: c, caption: buildCaption(c), links: buildLinks(c), logs });
}

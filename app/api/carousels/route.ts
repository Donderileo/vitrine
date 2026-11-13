import { NextResponse } from "next/server";
import { createCarousel, listCarousels } from "@/src/core/carousel/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listCarousels().map((c) => ({ id: c.id, title: c.title, products: c.products.length, slides: c.slides.length, updatedAt: c.updatedAt, costUsd: c.costUsd })));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const c = createCarousel(typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : undefined);
  return NextResponse.json({ id: c.id });
}

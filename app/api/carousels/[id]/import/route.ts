import { NextResponse } from "next/server";
import { productsFromCsv } from "@/src/core/carousel/csv";
import { getCarousel, saveCarousel } from "@/src/core/carousel/store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCarousel((await params).id);
  if (!c) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const { csv } = await req.json().catch(() => ({ csv: "" }));
  const { products, warnings } = productsFromCsv(String(csv ?? ""));
  if (!products.length) return NextResponse.json({ error: warnings[0] ?? "Nenhum produto encontrado no CSV" }, { status: 400 });
  // same Offer Link already in the list → skip (re-importing the same file shouldn't duplicate)
  const have = new Set(c.products.map((p) => p.link));
  const fresh = products.filter((p) => !have.has(p.link));
  c.products.push(...fresh);
  saveCarousel(c);
  return NextResponse.json({ carousel: c, added: fresh.length, skipped: products.length - fresh.length, warnings });
}

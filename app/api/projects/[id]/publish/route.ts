import { NextResponse } from "next/server";
import { projects } from "@/src/core/db";
import { getProduct, publishProduct } from "@/src/core/site";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({ num: p.num, product: getProduct(p.num) ?? null });
}

/** body: { link?, price?, title? } — writes site/public/products.json + thumbnail. Then run `npm run site:deploy`. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  try {
    const body = await req.json();
    return NextResponse.json({ product: await publishProduct(p, body) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

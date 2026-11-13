import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { carouselDir, getCarousel, saveCarousel } from "@/src/core/carousel/store";

export const runtime = "nodejs";

/** form: productId + file (jpeg/png/webp). Replaces the photo and drops the old cut-out. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCarousel((await params).id);
  if (!c) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const form = await req.formData();
  const p = c.products.find((x) => x.id === String(form.get("productId") ?? ""));
  const f = form.get("file");
  if (!p || !(f instanceof File) || !f.size) return NextResponse.json({ error: "produto ou arquivo inválido" }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return NextResponse.json({ error: "Use JPG, PNG ou WebP" }, { status: 400 });
  const dir = carouselDir(c.id);
  fs.mkdirSync(path.join(dir, "photos"), { recursive: true });
  for (const old of [p.photo && path.join(dir, "photos", p.photo), p.cut && path.join(dir, "cut", p.cut)]) if (old) fs.rmSync(old, { force: true });
  const ext = f.type === "image/png" ? ".png" : f.type === "image/webp" ? ".webp" : ".jpg";
  p.photo = `${p.id}-${Date.now().toString(36)}${ext}`;
  p.cut = undefined;
  fs.writeFileSync(path.join(dir, "photos", p.photo), Buffer.from(await f.arrayBuffer()));
  saveCarousel(c);
  return NextResponse.json({ carousel: c });
}

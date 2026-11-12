import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { newId, projects } from "@/src/core/db";
import { projectDir } from "@/src/core/pipeline";

export const runtime = "nodejs";

// TODO(auth): when login is added, take owner_id from the session instead of "local".
export async function GET() {
  return NextResponse.json(projects.list().map(({ state, ...p }) => p));
}

export async function POST(req: Request) {
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const kind = form.get("kind") === "explainer" ? "explainer" : "ad";
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (kind === "explainer" && !name) return NextResponse.json({ error: "Informe o tema" }, { status: 400 });
  if (kind === "ad" && (!name || !description || !files.length))
    return NextResponse.json({ error: "Nome, descrição e ao menos 1 foto são obrigatórios" }, { status: 400 });

  const id = newId();
  const dir = path.join(projectDir(id), "photos");
  fs.mkdirSync(dir, { recursive: true });
  const photos: string[] = [];
  for (const [i, f] of files.entries()) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type))
      return NextResponse.json({ error: `Formato não suportado: ${f.name}` }, { status: 400 });
    const ext = f.type === "image/png" ? ".png" : f.type === "image/webp" ? ".webp" : ".jpg";
    const dest = path.join(dir, `${i}${ext}`);
    fs.writeFileSync(dest, Buffer.from(await f.arrayBuffer()));
    photos.push(dest);
  }

  projects.create(id, {
    name, description, photos,
    productUrl: String(form.get("productUrl") ?? "") || undefined,
    priceText: String(form.get("priceText") ?? "") || undefined,
    language: String(form.get("language") ?? "pt-BR"),
    variations: kind === "explainer" ? 1 : Math.min(5, Math.max(1, Number(form.get("variations") ?? 2))),
    reviewScript: form.get("reviewScript") === "on",
    mode: form.get("mode") === "ai" ? "ai" : "template",
    kind, series: String(form.get("series") ?? "") || undefined,
  });
  return NextResponse.json({ id });
}

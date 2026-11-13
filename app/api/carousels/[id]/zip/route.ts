import fs from "node:fs";
import path from "node:path";
import { config } from "@/src/core/config";
import { buildCaption, buildLinks } from "@/src/core/carousel/copy";
import { getCarousel } from "@/src/core/carousel/store";
import { zip } from "@/src/core/carousel/zip";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = getCarousel((await params).id);
  if (!c || !c.slides.length) return new Response("sem slides", { status: 404 });
  const files = c.slides.map((s) => ({ name: path.basename(s), data: fs.readFileSync(path.join(config.dataDir, s)) }));
  files.push({ name: "legenda.txt", data: Buffer.from(buildCaption(c)) }, { name: "links.txt", data: Buffer.from(buildLinks(c)) });
  const slug = c.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "carrossel";
  return new Response(new Uint8Array(zip(files)), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${slug}.zip"` } });
}

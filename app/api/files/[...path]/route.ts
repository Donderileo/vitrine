import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "@/src/core/config";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp3": "audio/mpeg",
};

// Serves files from DATA_DIR with Range support (needed for video seeking in Safari).
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const file = path.resolve(config.dataDir, ...parts);
  if (!file.startsWith(config.dataDir + path.sep) || !fs.existsSync(file) || file.endsWith(".db"))
    return new Response("not found", { status: 404 });

  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes" };
  if (download) headers["content-disposition"] = `attachment; filename="${path.basename(file)}"`;

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? parseInt(range[1]) : 0;
    const end = range[2] ? Math.min(parseInt(range[2]), size - 1) : size - 1;
    const stream = fs.createReadStream(file, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
}

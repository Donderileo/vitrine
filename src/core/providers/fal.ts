import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { config } from "../config";

let configured = false;
function client() {
  if (!config.falKey) throw new Error("FAL_KEY não configurada");
  if (!configured) {
    fal.config({ credentials: config.falKey });
    configured = true;
  }
  return fal;
}

export async function falUpload(localPath: string): Promise<string> {
  const buf = fs.readFileSync(localPath);
  const ext = path.extname(localPath).slice(1).toLowerCase() || "jpeg";
  const type = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return client().storage.upload(new Blob([buf], { type }));
}

export async function falRun<T = any>(model: string, input: Record<string, unknown>, onLog?: (m: string) => void) {
  const res = await client().subscribe(model, {
    input,
    logs: true,
    onQueueUpdate: (u: any) => {
      if (u.status === "IN_QUEUE") onLog?.(`fal: na fila (${model})`);
    },
  });
  return res.data as T;
}

export async function download(url: string, dest: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download falhou ${r.status}: ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

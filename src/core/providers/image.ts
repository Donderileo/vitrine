import path from "node:path";
import { config } from "../config";
import { ffmpeg, filterPath } from "../ffmpeg";
import type { Ctx, Scene } from "../types";
import { download, falRun, falUpload } from "./fal";

/** Generates one 9:16 scene image with the REAL product photo(s) as reference. */
export async function generateSceneImage(
  ctx: Ctx, scene: Scene, photoUrls: string[] | undefined, out: string, seedIdx: number,
): Promise<string> {
  if (config.imageProvider === "mock") return mockImage(ctx, scene, out, seedIdx);

  const prompt =
    `${scene.imagePrompt}. Vertical 9:16 photorealistic interior photo. ` +
    `The product from the reference image must appear exactly as it is: identical shape, color, material, proportions and details. ` +
    `Only the surrounding environment, lighting and styling may change. No text, no logos, no watermarks.`;
  const data = await falRun<{ images: { url: string }[] }>(
    config.falImageModel,
    { prompt, image_urls: photoUrls, aspect_ratio: "9:16", output_format: "jpeg" },
    ctx.log,
  );
  ctx.cost({ stage: "images", provider: config.falImageModel, usd: config.falImageUsd });
  return download(data.images[0].url, out);
}

export async function uploadPhotos(ctx: Ctx): Promise<string[] | undefined> {
  if (config.imageProvider !== "fal") return undefined;
  ctx.log("Enviando fotos do produto para o provedor…");
  return Promise.all(ctx.input.photos.map(falUpload));
}

const PALETTES = ["0xE8D9C5", "0xC9D6CF", "0xD8C8DC", "0xF0E2C8", "0xC8D3E0"];

/** Offline placeholder: real product photo over a tinted background with the prompt text. */
async function mockImage(ctx: Ctx, scene: Scene, out: string, seedIdx: number) {
  const photo = ctx.input.photos[seedIdx % ctx.input.photos.length];
  const font = filterPath(path.join(config.fontsDir, "Poppins-Bold.ttf"));
  const label = scene.imagePrompt.replace(/[^\p{L}\p{N} ,.-]/gu, "").slice(0, 60);
  await ffmpeg([
    "-f", "lavfi", "-i", `color=c=${PALETTES[seedIdx % PALETTES.length]}:s=${config.width}x${config.height}`,
    "-i", photo,
    "-filter_complex",
    `[1:v]scale=${config.width - 200}:-1:force_original_aspect_ratio=decrease[p];` +
      `[0:v][p]overlay=(W-w)/2:(H-h)/2,` +
      `drawtext=fontfile='${font}':text='MOCK ${seedIdx + 1}':fontsize=40:fontcolor=0x00000088:x=60:y=80,` +
      `drawtext=fontfile='${font}':text='${label.replace(/'/g, "")}':fontsize=28:fontcolor=0x00000099:x=60:y=140`,
    "-frames:v", "1", "-q:v", "3", out,
  ]);
  return out;
}

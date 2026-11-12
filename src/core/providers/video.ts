import { config } from "../config";
import { ffmpeg } from "../ffmpeg";
import type { Ctx, Scene } from "../types";
import { download, falRun, falUpload } from "./fal";

/** Turns a scene image into a short clip. "kenburns" is free (local ffmpeg); "fal" uses an AI video model. */
export async function generateClip(ctx: Ctx, scene: Scene, image: string, out: string, idx: number): Promise<string> {
  const secs = config.sceneSeconds;
  if (config.videoProvider === "kenburns") return kenBurns(image, out, secs, idx);

  const imageUrl = await falUpload(image);
  const data = await falRun<{ video: { url: string } }>(
    config.falVideoModel,
    {
      image_url: imageUrl,
      prompt:
        `${scene.motionPrompt}. Subtle, cinematic, realistic motion. ` +
        `The product must stay exactly the same: do not morph, resize, recolor or animate the product itself.`,
      duration: String(secs),
      resolution: config.falVideoResolution,
      generate_audio: false,
    },
    ctx.log,
  );
  ctx.cost({ stage: "clips", provider: config.falVideoModel, usd: config.falVideoUsdPerSec * secs });
  return download(data.video.url, out);
}

/** Slow zoom/pan over the still image — cheap fallback that still feels like video. */
async function kenBurns(image: string, out: string, secs: number, idx: number) {
  const frames = secs * config.fps;
  const { width: W, height: H } = config;
  const moves = [
    `z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`, // push in
    `z='1.15':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)'`, // pan right
    `z='max(1.18-0.0012*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`, // pull out
  ];
  await ffmpeg([
    "-loop", "1", "-i", image,
    "-vf",
    `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
      `zoompan=${moves[idx % moves.length]}:d=${frames}:s=${W}x${H}:fps=${config.fps},format=yuv420p`,
    "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out,
  ]);
  return out;
}

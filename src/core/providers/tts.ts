import fs from "node:fs";
import { config } from "../config";
import { elevenCost } from "../pricing";
import { ffmpeg } from "../ffmpeg";
import type { Ctx } from "../types";

export async function generateVoice(ctx: Ctx, text: string, out: string, seconds: number): Promise<string> {
  if (config.ttsProvider === "mock") {
    // Silent track — lets you test timing/captions without paying for TTS.
    await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(seconds), "-c:a", "libmp3lame", out]);
    return out;
  }
  if (!config.elevenKey || !config.elevenVoice) throw new Error("ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID não configuradas");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenVoice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: config.elevenModel }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  // ElevenLabs bills by character; real price depends on your plan. ~US$0.10/1k chars as a rough estimate.
  ctx.cost({ stage: "narração", provider: "elevenlabs", ...elevenCost(text.length) });
  return out;
}

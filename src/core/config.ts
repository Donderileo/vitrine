import path from "node:path";
import fs from "node:fs";

// Minimal .env loader (so the worker/CLI work without extra deps; Next loads .env itself).
function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

const env = (k: string, d = "") => process.env[k] ?? d;

export const config = {
  dataDir: path.resolve(env("DATA_DIR", "./data")),
  fontsDir: path.resolve(env("FONTS_DIR", "./assets/fonts")),
  ffmpeg: env("FFMPEG_PATH", "ffmpeg"),
  ffprobe: env("FFPROBE_PATH", "ffprobe"),

  // Providers: "mock" runs 100% offline and free, for testing the pipeline.
  llmProvider: env("LLM_PROVIDER", "mock") as "anthropic" | "mock",
  imageProvider: env("IMAGE_PROVIDER", "mock") as "fal" | "mock",
  videoProvider: env("VIDEO_PROVIDER", "kenburns") as "fal" | "kenburns",
  ttsProvider: env("TTS_PROVIDER", "mock") as "elevenlabs" | "mock",

  anthropicKey: env("ANTHROPIC_API_KEY"),
  anthropicModel: env("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
  falKey: env("FAL_KEY"),
  falImageModel: env("FAL_IMAGE_MODEL", "fal-ai/nano-banana-2/edit"),
  falImageUsd: Number(env("FAL_IMAGE_USD", "0.08")),
  falVideoModel: env("FAL_VIDEO_MODEL", "bytedance/seedance-2.5/image-to-video"),
  falVideoResolution: env("FAL_VIDEO_RESOLUTION", "480p"),
  falVideoUsdPerSec: Number(env("FAL_VIDEO_USD_PER_SEC", "0.2205")),
  elevenKey: env("ELEVENLABS_API_KEY"),
  elevenVoice: env("ELEVENLABS_VOICE_ID", ""),
  elevenModel: env("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
  // voice feel: higher stability = calmer and more consistent; style 0 = most natural; speed 0.7–1.2
  elevenStability: Number(env("ELEVENLABS_STABILITY", "0.55")),
  elevenSimilarity: Number(env("ELEVENLABS_SIMILARITY", "0.75")),
  elevenStyle: Number(env("ELEVENLABS_STYLE", "0")),
  elevenSpeed: Number(env("ELEVENLABS_SPEED", "1")),
  // brand handle: always shown on screen; spoken only as BRAND_HANDLE_SPOKEN (empty = never spoken)
  brandHandle: env("BRAND_HANDLE", "@vitrine.decasa"),
  brandHandleSpoken: env("BRAND_HANDLE_SPOKEN", "Vitrine ponto de casa"),
  explainerSeconds: Number(env("EXPLAINER_SECONDS", "28")),

  // prices (USD) — keep in sync with your plans; used for the per-video cost shown in the app
  anthropicUsdIn: Number(env("ANTHROPIC_USD_PER_MTOK_IN", "2")),
  anthropicUsdOut: Number(env("ANTHROPIC_USD_PER_MTOK_OUT", "10")),
  elevenUsdPer1k: Number(env("ELEVENLABS_USD_PER_1K_CHARS", "0.17")),
  usdBrl: Number(env("USD_BRL", "0")), // optional: show costs in R$ too

  videoMode: env("VIDEO_MODE", "template") as "template" | "ai",
  sceneSeconds: Number(env("SCENE_SECONDS", "5")),
  endCardSeconds: Number(env("END_CARD_SECONDS", "3")),
  width: 1080,
  height: 1920,
  fps: 30,
};

fs.mkdirSync(config.dataDir, { recursive: true });

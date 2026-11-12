import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

/**
 * Non-secret settings editable on the "Configurações" page. Stored in data/settings.json and applied on top of
 * the .env defaults (the worker re-reads them before every job, so changes apply to the next video).
 * API keys stay in .env only — never here.
 */
export type Settings = {
  brandHandle: string;
  brandHandleSpoken: string;
  brandColors: { bg: string; bg2: string; gold: string; ink: string; muted: string };
  explainerSeconds: number;
  elevenVoice: string;
  elevenSpeed: number;
  elevenStability: number;
  elevenSimilarity: number;
  elevenStyle: number;
  music: "lofi" | "none";
  /** how much motion: intenso = something new every phrase (2–4 s); moderado ≈ half; leve = only numbers/concepts */
  motionLevel: "intenso" | "moderado" | "leve";
  /** word-by-word captions in the caption zone */
  captions: boolean;
  musicVolume: number;
  /** fixed colours for recurring objects: the animator must always draw "sofa" with this colour, etc. */
  objects: { name: string; color: string; note?: string }[];
  /** free text style rules sent to the scriptwriter and the animator ("o sofá é sempre de 3 lugares…") */
  styleNotes: string;
  /** extra tone/topic notes for the scriptwriter */
  scriptNotes: string;
};

const FILE = () => path.join(config.dataDir, "settings.json");

export function defaults(): Settings {
  return {
    brandHandle: process.env.BRAND_HANDLE ?? "@vitrine.decasa",
    brandHandleSpoken: process.env.BRAND_HANDLE_SPOKEN ?? "Vitrine ponto de casa",
    brandColors: { bg: "#120d09", bg2: "#1c140d", gold: "#F2C766", ink: "#F6EEE2", muted: "#B8A890" },
    explainerSeconds: Number(process.env.EXPLAINER_SECONDS || 28),
    elevenVoice: process.env.ELEVENLABS_VOICE_ID || "",
    elevenSpeed: Number(process.env.ELEVENLABS_SPEED || 1),
    elevenStability: Number(process.env.ELEVENLABS_STABILITY || 0.55),
    elevenSimilarity: Number(process.env.ELEVENLABS_SIMILARITY || 0.75),
    elevenStyle: Number(process.env.ELEVENLABS_STYLE || 0),
    music: (process.env.EXPLAINER_MUSIC as "lofi" | "none") || "lofi",
    musicVolume: Number(process.env.EXPLAINER_MUSIC_VOLUME || 1),
    motionLevel: "intenso",
    captions: true,
    objects: [
      { name: "sofá", color: "#7A8450", note: "3 lugares, braços retos" },
      { name: "parede", color: "#E9DFD0" },
      { name: "piso", color: "#C9A97E", note: "madeira clara" },
      { name: "madeira", color: "#9A6B43" },
      { name: "planta", color: "#4F7A4A" },
    ],
    styleNotes: "",
    scriptNotes: "",
  };
}

const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const str = (v: unknown, d: string, max = 2000) => (typeof v === "string" ? v.slice(0, max) : d);

/** Validates anything (UI body, old file) into a complete Settings. */
export function clean(raw: any): Settings {
  const d = defaults();
  const r = raw && typeof raw === "object" ? raw : {};
  const bc = r.brandColors || {};
  return {
    brandHandle: str(r.brandHandle, d.brandHandle, 60).trim(),
    brandHandleSpoken: str(r.brandHandleSpoken, d.brandHandleSpoken, 80).trim(),
    brandColors: { bg: hex(bc.bg, d.brandColors.bg), bg2: hex(bc.bg2, d.brandColors.bg2), gold: hex(bc.gold, d.brandColors.gold), ink: hex(bc.ink, d.brandColors.ink), muted: hex(bc.muted, d.brandColors.muted) },
    explainerSeconds: Math.round(num(r.explainerSeconds, 15, 90, d.explainerSeconds)),
    elevenVoice: str(r.elevenVoice, d.elevenVoice, 64).trim(),
    elevenSpeed: num(r.elevenSpeed, 0.7, 1.2, d.elevenSpeed),
    elevenStability: num(r.elevenStability, 0, 1, d.elevenStability),
    elevenSimilarity: num(r.elevenSimilarity, 0, 1, d.elevenSimilarity),
    elevenStyle: num(r.elevenStyle, 0, 1, d.elevenStyle),
    music: r.music === "none" ? "none" : r.music === "lofi" ? "lofi" : d.music,
    musicVolume: num(r.musicVolume, 0, 2, d.musicVolume),
    motionLevel: ["intenso", "moderado", "leve"].includes(r.motionLevel) ? r.motionLevel : d.motionLevel,
    captions: typeof r.captions === "boolean" ? r.captions : d.captions,
    objects: Array.isArray(r.objects)
      ? r.objects.slice(0, 30).map((o: any) => ({ name: str(o?.name, "", 40).trim(), color: hex(o?.color, "#888888"), note: str(o?.note, "", 120).trim() || undefined })).filter((o: any) => o.name)
      : d.objects,
    styleNotes: str(r.styleNotes, d.styleNotes),
    scriptNotes: str(r.scriptNotes, d.scriptNotes),
  };
}

export function loadSettings(): Settings {
  try { return clean(JSON.parse(fs.readFileSync(FILE(), "utf8"))); } catch { return defaults(); }
}

export function saveSettings(raw: unknown): Settings {
  const s = clean(raw);
  fs.writeFileSync(FILE(), JSON.stringify(s, null, 2));
  applySettings(s);
  return s;
}

/** Puts the settings into config/process.env (song.js reads EXPLAINER_MUSIC* from the env of the render process). */
export function applySettings(s = loadSettings()): Settings {
  Object.assign(config, {
    brandHandle: s.brandHandle,
    brandHandleSpoken: s.brandHandleSpoken,
    explainerSeconds: s.explainerSeconds,
    elevenSpeed: s.elevenSpeed,
    elevenStability: s.elevenStability,
    elevenSimilarity: s.elevenSimilarity,
    elevenStyle: s.elevenStyle,
  });
  if (s.elevenVoice) config.elevenVoice = s.elevenVoice;
  process.env.EXPLAINER_MUSIC = s.music;
  process.env.EXPLAINER_MUSIC_VOLUME = String(s.musicVolume);
  return s;
}

/** Style block shared by the scriptwriter and the animator prompts ("" when nothing is set). */
export function styleBrief(s = loadSettings()): string {
  const lines: string[] = [];
  if (s.objects.length) {
    lines.push("CORES FIXAS DOS OBJETOS (identidade visual do perfil — use SEMPRE estas cores quando o objeto aparecer; disponíveis no código como H.C['nome']):");
    for (const o of s.objects) lines.push(`- ${o.name}: ${o.color}${o.note ? ` (${o.note})` : ""}`);
  }
  if (s.styleNotes.trim()) lines.push(`REGRAS DE ESTILO DO PERFIL:\n${s.styleNotes.trim()}`);
  return lines.join("\n");
}

/** Which secrets are configured (never their values). */
export function keyStatus() {
  return {
    ANTHROPIC_API_KEY: Boolean(config.anthropicKey),
    ELEVENLABS_API_KEY: Boolean(config.elevenKey),
    FAL_KEY: Boolean(config.falKey),
    llmProvider: config.llmProvider,
    ttsProvider: config.ttsProvider,
  };
}

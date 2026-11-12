import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { elevenCost } from "../pricing";
import { ffmpeg, probeDuration } from "../ffmpeg";
import type { Ctx } from "../types";
import type { TExplainerPlan, Word } from "./schema";

const GAP = 0.25; // extra silence between scenes, on top of the natural pause (lets each visual land)
const LEAD = 0.05; // no dead air: the first word starts immediately (viewers decide in ~1 s)

type Local = { w: string; t0: number; t1: number };

/**
 * Narration first, animation follows: scene durations come from the real audio.
 * ElevenLabs reads the WHOLE script in one go (natural flow and intonation across sentences); we then cut it
 * per scene using the character timestamps and add a short pause between scenes.
 */
export type VoiceOpts = { speed?: number; stability?: number };

/** What the voice reads: the handle placeholder becomes its spoken form; no shouting (! and ALL CAPS). */
export function speakable(text: string) {
  const spoken = config.brandHandleSpoken.trim() || "o perfil";
  const h = config.brandHandle.trim();
  let t = text.replace(/\{HANDLE\}/g, spoken);
  if (h) t = t.split(h).join(spoken);
  return t.replace(/!+/g, ".").replace(/\b([A-ZÀ-Ú]{4,})\b/g, (w) => w.toLowerCase()).replace(/\s+/g, " ").trim();
}

/** Caption words: the spoken handle ("Vitrine ponto de casa") is shown as the real @handle. */
function showHandle(words: Word[]): Word[] {
  const spoken = config.brandHandleSpoken.trim();
  if (!spoken || !config.brandHandle) return words;
  const n = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const toks = spoken.split(/\s+/).map(n);
  const out: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    if (toks.every((tk, k) => words[i + k] && n(words[i + k].w) === tk)) {
      const last = words[i + toks.length - 1];
      out.push({ w: config.brandHandle, t0: words[i].t0, t1: last.t1, scene: words[i].scene });
      i += toks.length - 1;
    } else out.push(words[i]);
  }
  return out;
}

export async function narrate(ctx: Ctx, plan: TExplainerPlan, dir: string, opts: VoiceOpts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const segs: { file: string; dur: number; local: Local[] }[] = [];
  if (config.ttsProvider === "mock") {
    for (const [i, s] of plan.scenes.entries()) segs.push({ file: path.join(dir, `scene-${i}.wav`), ...(await mockScene(speakable(s.narration), path.join(dir, `scene-${i}.wav`))) });
  } else {
    ctx.log(`narrando o roteiro inteiro (${plan.scenes.length} cenas) numa chamada… velocidade ${opts.speed ?? config.elevenSpeed}, estabilidade ${opts.stability ?? config.elevenStability}`);
    segs.push(...(await elevenWhole(ctx, plan.scenes.map((s) => speakable(s.narration)), dir, opts)));
  }
  const words: Word[] = [];
  const scenes: { t0: number; t1: number }[] = [];
  const parts: string[] = [];
  let t = 0;
  for (const [i, seg] of segs.entries()) {
    const lead = i === 0 ? LEAD : 0;
    const t0 = t;
    for (const w of seg.local) words.push({ w: w.w, t0: t0 + lead + w.t0, t1: t0 + lead + w.t1, scene: i });
    const t1 = t0 + lead + seg.dur + GAP;
    scenes.push({ t0, t1 });
    const padded = path.join(dir, `slot-${i}.wav`);
    await ffmpeg(["-i", seg.file, "-af", `adelay=${Math.round(lead * 1000)}:all=1,apad=whole_dur=${(t1 - t0).toFixed(3)}`, "-ar", "48000", "-ac", "2", padded]);
    parts.push(padded);
    t = t1;
  }
  const end = t + 1.6; // room for the last visual + fade
  scenes[scenes.length - 1].t1 = end;
  const list = path.join(dir, "list.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const wav = path.join(dir, "voice.wav");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-af", `apad=whole_dur=${end.toFixed(3)}`, "-ar", "48000", "-ac", "2", wav]);
  return { wav, words: showHandle(words), scenes, duration: end };
}

async function tts(ctx: Ctx, text: string, opts: VoiceOpts = {}) {
  if (!config.elevenKey || !config.elevenVoice) throw new Error("ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID não configuradas");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenVoice}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "content-type": "application/json" },
    body: JSON.stringify({
      text, model_id: config.elevenModel,
      voice_settings: {
        stability: opts.stability ?? config.elevenStability, similarity_boost: config.elevenSimilarity, style: config.elevenStyle,
        speed: Math.min(1.2, Math.max(0.7, opts.speed ?? config.elevenSpeed)), use_speaker_boost: true,
      },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  ctx.cost({ stage: "narração", provider: "elevenlabs", ...elevenCost(text.length) });
  return (await r.json()) as any;
}

async function elevenWhole(ctx: Ctx, texts: string[], dir: string, opts: VoiceOpts = {}) {
  const full = texts.join(" ");
  const data = await tts(ctx, full, opts);
  const mp3 = path.join(dir, "full.mp3"), wav = path.join(dir, "full.wav");
  fs.writeFileSync(mp3, Buffer.from(data.audio_base64, "base64"));
  await ffmpeg(["-i", mp3, "-ar", "48000", "-ac", "2", wav]);
  return splitWhole(texts, wav, data.alignment ?? data.normalized_alignment, dir);
}

/** Cut one narration (with character timestamps) into per-scene clips + per-scene word times. */
export async function splitWhole(texts: string[], wav: string, a: any, dir: string) {
  const total = await probeDuration(wav);
  const chars: string[] = a.characters, cs: number[] = a.character_start_times_seconds, ce: number[] = a.character_end_times_seconds;
  // char range of each scene in the joined text (alignment characters mirror the input text)
  const ranges: [number, number][] = [];
  let off = 0;
  for (const tx of texts) { ranges.push([off, off + tx.length - 1]); off += tx.length + 1; }
  const firstSpoken = (r: [number, number]) => cs[Math.min(r[0], cs.length - 1)] ?? 0;
  const lastSpoken = (r: [number, number]) => ce[Math.min(r[1], ce.length - 1)] ?? total;
  // cut halfway through the natural pause between scenes
  const cuts = ranges.map((r, i) => (i < ranges.length - 1 ? (lastSpoken(r) + firstSpoken(ranges[i + 1])) / 2 : total));
  const segs: { file: string; dur: number; local: Local[] }[] = [];
  const all = wordsFromChars(chars, cs, ce);
  let cursor = 0;
  for (const [i, r] of ranges.entries()) {
    const start = i === 0 ? Math.max(0, firstSpoken(r) - 0.05) : cuts[i - 1];
    const stop = cuts[i];
    const file = path.join(dir, `scene-${i}.wav`);
    await ffmpeg(["-i", wav, "-af", `atrim=start=${start.toFixed(3)}:end=${stop.toFixed(3)},asetpts=PTS-STARTPTS`, "-ar", "48000", "-ac", "2", file]);
    const local: Local[] = [];
    while (cursor < all.length && all[cursor].t0 < stop - 1e-3) { const w = all[cursor++]; local.push({ w: w.w, t0: w.t0 - start, t1: w.t1 - start }); }
    segs.push({ file, dur: stop - start, local });
  }
  return segs;
}

function wordsFromChars(chars: string[], s: number[], e: number[]) {
  const out: { w: string; t0: number; t1: number }[] = [];
  let cur = "", t0 = 0, t1 = 0;
  chars.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) out.push({ w: cur, t0, t1 }); cur = ""; return; }
    if (!cur) t0 = s[i];
    cur += c; t1 = e[i];
  });
  if (cur) out.push({ w: cur, t0, t1 });
  return out;
}

/** Offline stand-in: silence with word times estimated from length (~2.6 words/s). */
async function mockScene(text: string, out: string) {
  const ws = text.split(/\s+/).filter(Boolean);
  const local: { w: string; t0: number; t1: number }[] = [];
  let t = 0;
  for (const w of ws) { const d = 0.12 + w.length * 0.045; local.push({ w, t0: t, t1: t + d }); t += d + 0.06; }
  await ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", t.toFixed(3), out]);
  return { dur: t, local };
}

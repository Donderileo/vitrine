import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { ffmpeg, filterPath } from "./ffmpeg";
import type { Variation } from "./types";

const { width: W, height: H, fps } = config;
const FONT = () => path.join(config.fontsDir, "Poppins-Bold.ttf");

/** Final card with the REAL product photo — keeps the video honest about what the buyer gets. */
export async function renderEndCard(photo: string, cta: string, out: string, label: string) {
  const font = filterPath(FONT());
  const clean = (s: string) => s.replace(/['\\:%]/g, "");
  await ffmpeg([
    "-loop", "1", "-i", photo,
    "-filter_complex",
    `[0:v]split[a][b];` +
      `[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:2,eq=brightness=-0.15[bg];` +
      `[b]scale=${W - 160}:${Math.round(H * 0.55)}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2-40,` +
      `drawbox=x=0:y=150:w=iw:h=120:color=black@0.55:t=fill,` +
      `drawtext=fontfile='${font}':text='${clean(label)}':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=180,` +
      `drawbox=x=0:y=ih-420:w=iw:h=150:color=0xFE2C55@0.92:t=fill,` +
      `drawtext=fontfile='${font}':text='${clean(cta)}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=h-385,` +
      `fps=${fps},format=yuv420p`,
    "-t", String(config.endCardSeconds), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out,
  ]);
  return out;
}

function assTime(t: number) {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function wrap(text: string, max = 22) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.join("\\N");
}

/** TikTok-style captions: big bold white text with heavy outline, one per scene. */
export function writeCaptions(v: Variation, sceneSecs: number, out: string) {
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Poppins,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,2,80,80,620,1
Style: Hook,Poppins,92,&H0000F0FF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,8,3,8,80,80,260,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ev: string[] = [];
  // Hook on top during the first 2.5s — the scroll-stopper.
  ev.push(`Dialogue: 0,${assTime(0)},${assTime(Math.min(2.5, sceneSecs))},Hook,,0,0,0,,{\\fad(120,200)}${wrap(v.hook, 20)}`);
  v.scenes.forEach((s, i) => {
    const start = i * sceneSecs + (i === 0 ? 0.3 : 0.1);
    ev.push(`Dialogue: 0,${assTime(start)},${assTime((i + 1) * sceneSecs - 0.1)},Cap,,0,0,0,,{\\fad(100,150)}${wrap(s.caption)}`);
  });
  fs.writeFileSync(out, head + ev.join("\n") + "\n");
  return out;
}

export async function composeVideo(opts: {
  clips: string[]; endCard: string; voice: string; captions: string; out: string; aiLabel: boolean;
}) {
  const { clips, endCard, voice, captions, out } = opts;
  const secs = config.sceneSeconds;
  const total = clips.length * secs + config.endCardSeconds;
  const musicDir = path.join(config.dataDir, "music");
  const music = fs.existsSync(musicDir)
    ? fs.readdirSync(musicDir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)).map((f) => path.join(musicDir, f))
    : [];
  const track = music.length ? music[Math.floor(Math.random() * music.length)] : undefined;

  const inputs = [...clips, endCard].flatMap((c) => ["-i", c]);
  const vIdx = clips.length + 1; // index of voice input
  const norm = [...clips, endCard]
    .map((_, i) => {
      const d = i < clips.length ? secs : config.endCardSeconds;
      return `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},setsar=1,` +
        `tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`;
    })
    .join(";");
  const concatIn = [...clips, endCard].map((_, i) => `[v${i}]`).join("");
  const font = filterPath(FONT());
  const label = opts.aiLabel
    ? `,drawtext=fontfile='${font}':text='Conteúdo gerado com IA':fontsize=30:fontcolor=white@0.85:box=1:boxcolor=black@0.35:boxborderw=12:x=w-text_w-40:y=60:enable='lt(t,${clips.length * secs})'`
    : "";

  let filter =
    `${norm};${concatIn}concat=n=${clips.length + 1}:v=1:a=0[cat];` +
    `[cat]subtitles='${filterPath(captions)}':fontsdir='${filterPath(config.fontsDir)}'${label},format=yuv420p[vout];` +
    `[${vIdx}:a]apad,atrim=0:${total},afade=t=out:st=${total - 0.6}:d=0.6[voice]`;
  if (track) {
    filter += `;[${vIdx + 1}:a]volume=0.13,atrim=0:${total},afade=t=out:st=${total - 1.5}:d=1.5[bgm];` +
      `[voice][bgm]amix=inputs=2:duration=first:normalize=0[aout]`;
  } else filter += `;[voice]anull[aout]`;

  await ffmpeg([
    ...inputs, "-i", voice, ...(track ? ["-stream_loop", "-1", "-i", track] : []),
    "-filter_complex", filter, "-map", "[vout]", "-map", "[aout]",
    "-t", String(total), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", String(fps),
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out,
  ]);
  return out;
}

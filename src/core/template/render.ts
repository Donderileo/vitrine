import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { config } from "../config";
import { ffmpeg, probeSize } from "../ffmpeg";
import { around, bestWindow, cleanBox, type Size } from "./crops";
import type { TBox, TSceneType, TStoryboard, TVariationT } from "./storyboard";

const DUR: Record<TSceneType, number> = { hook: 3, measure: 3.5, items: 4.2, details: 3.2, showcase: 3, final: 3.5 };
const THEMES = {
  festivo: { g1: "#FFF1C9", g2: "#F2C766", g3: "#C8902F", spark: "#FFE6A8", sparkles: true, twinkle: true },
  quente: { g1: "#FFF1C9", g2: "#F2C766", g3: "#C8902F", spark: "#FFE6A8", sparkles: false, twinkle: false },
  clean: { g1: "#FFFFFF", g2: "#F4EEE6", g3: "#D8C9B4", spark: "#FFFFFF", sparkles: false, twinkle: false },
};
const rel = (v: number) => Math.max(0, Math.min(1, v));

/** Turns storyboard + variation into the concrete per-scene data the HTML engine draws. */
export async function buildSpec(sb: TStoryboard, v: TVariationT, photos: string[], num?: number | null) {
  const sizes: Size[] = await Promise.all(photos.map(probeSize));
  const info = sizes.map((size, i) => {
    const im = sb.images.find((x) => x.index === i);
    const product = (im && cleanBox(im.product, size)) ?? { x: size.w * 0.15, y: size.h * 0.05, w: size.w * 0.7, h: size.h * 0.9 };
    const text = (im?.textBoxes ?? []).map((t) => cleanBox(t, size)).filter(Boolean) as TBox[];
    const win = bestWindow(size, product, text, 9 / 16);
    return { size, product, text, win };
  });
  const ok = (i: number | undefined) => i !== undefined && i >= 0 && i < photos.length;
  const hero = ok(v.heroImage) ? v.heroImage : 0;
  const scenes: any[] = [];

  for (const type of v.scenes) {
    const d = DUR[type];
    if (type === "hook") {
      const { win, product } = info[hero];
      scenes.push({ type, dur: d, img: hero, win, fx: 0.5, fy: rel((product.y - win.y) / win.h - 0.03), words: v.hookWords, sub: v.hookSub });
    } else if (type === "measure" && sb.measure && ok(sb.measure.image)) {
      const i = sb.measure.image, { win, product } = info[i];
      scenes.push({ type, dur: d, img: i, win, fx: rel((product.x + product.w / 2 - win.x - win.w / 2) / win.w + 0.5),
        fyTop: rel((product.y - win.y) / win.h - 0.02), value: sb.measure.value, unit: sb.measure.unit, label: sb.measure.label, caption: v.captions.measure });
    } else if (type === "items" && sb.items && ok(sb.items.image)) {
      const i = sb.items.image, size = info[i].size;
      const items = sb.items.boxes.map((b) => ({ b: cleanBox(b, size), label: b.label })).filter((x) => x.b)
        .map((x) => ({ img: i, win: around(size, x.b!, 1, 1.02), label: x.label }));
      if (items.length >= 2) scenes.push({ type, dur: d, bgImg: hero, bgWin: info[hero].win, title: sb.items.title, items });
    } else if (type === "details" && (sb.details || sb.features.length)) {
      const cards = sb.details && ok(sb.details.image)
        ? sb.details.boxes.map((b) => ({ b: cleanBox(b, info[sb.details!.image].size), label: b.label })).filter((x) => x.b)
          .map((x) => ({ img: sb.details!.image, win: around(info[sb.details!.image].size, x.b!, Math.min(1.4, Math.max(0.75, x.b!.w / x.b!.h)), 1.04), label: x.label }))
        : [];
      if (cards.length || sb.features.length)
        scenes.push({ type, dur: d, bgImg: hero, bgWin: info[hero].win, cards, chips: sb.features.slice(0, cards.length ? 3 : 3) });
    } else if (type === "showcase") {
      const i = ok(v.showcaseImage) ? v.showcaseImage! : (hero + 1) % photos.length;
      const { win, product } = info[i];
      scenes.push({ type, dur: d, img: i, win, fx: 0.5, fy: rel((product.y + product.h / 2 - win.y) / win.h), caption: v.captions.showcase });
    } else if (type === "final") {
      const { size, product, text } = info[hero];
      scenes.push({ type, dur: d, img: hero, bgWin: { x: 0, y: 0, w: size.w, h: size.h },
        card: bestWindow(size, product, text, 0.624, { minScale: 0.68 }), title: sb.title, sub: sb.subtitle, price: sb.price, cta: v.cta, num });
    }
  }
  if (scenes[0]?.type !== "hook") throw new Error("A variação precisa começar com a cena hook");
  if (scenes.at(-1)?.type !== "final") {
    const { size, product, text } = info[hero];
    scenes.push({ type: "final", dur: DUR.final, img: hero, bgWin: { x: 0, y: 0, w: size.w, h: size.h },
      card: bestWindow(size, product, text, 0.624, { minScale: 0.68 }), title: sb.title, sub: sb.subtitle, price: sb.price, cta: v.cta, num });
  }

  return {
    theme: THEMES[sb.theme] ?? THEMES.quente,
    aiLabel: false,
    handle: config.brandHandle || "",
    fonts: {
      bold: pathToFileURL(path.join(config.fontsDir, "Poppins-Bold.ttf")).href,
      medium: pathToFileURL(path.join(config.fontsDir, "Poppins-Medium.ttf")).href,
    },
    images: photos.map((p, i) => ({ src: pathToFileURL(p).href, w: sizes[i].w, h: sizes[i].h })),
    scenes,
  };
}

const ENGINE = path.resolve("assets/template/engine.html");

let browser: Browser | null = null;
async function getBrowser() {
  browser ??= await chromium.launch();
  return browser;
}
export async function closeBrowser() { await browser?.close(); browser = null; }

/** Renders every scene to its own mp4 (same settings) and joins them losslessly. Returns the silent video. */
export async function renderSpec(spec: Awaited<ReturnType<typeof buildSpec>>, outDir: string, name: string, log: (m: string) => void) {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(ENGINE).href);
    await page.evaluate((s) => (window as any).load(s), spec);
    const files: string[] = [];
    for (let i = 0; i < spec.scenes.length; i++) {
      const dur: number = await page.evaluate((i) => (window as any).scene(i), i);
      const frames = Math.round(dur * config.fps);
      const file = path.join(outDir, `${name}-s${i}.mp4`), tmp = file.replace(/\.mp4$/, ".tmp.mp4");
      const ff = spawn(config.ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(config.fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(config.fps), tmp], { stdio: ["pipe", "ignore", "pipe"] });
      let err = "";
      ff.stderr.on("data", (d) => (err += d));
      const done = new Promise<number>((r) => ff.on("close", r));
      for (let f = 0; f < frames; f++) {
        await page.evaluate((t) => (window as any).draw(t), f / config.fps);
        const buf = await page.screenshot({ type: "jpeg", quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      if ((await done) !== 0) throw new Error(`ffmpeg falhou na cena ${spec.scenes[i].type}: ${err.slice(-500)}`);
      fs.renameSync(tmp, file);
      files.push(file);
      log(`cena ${i + 1}/${spec.scenes.length} (${spec.scenes[i].type}) ok`);
    }
    const list = path.join(outDir, `${name}-list.txt`);
    fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const silent = path.join(outDir, `${name}-silent.mp4`);
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
    return { silent, duration: spec.scenes.reduce((a: number, s: any) => a + s.dur, 0) };
  } finally {
    await page.close();
  }
}

/** Adds voice (optional) and a random track from data/music (optional); otherwise a silent track. */
export async function addAudio(silent: string, duration: number, voice: string | undefined, out: string) {
  const musicDir = path.join(config.dataDir, "music");
  const music = fs.existsSync(musicDir) ? fs.readdirSync(musicDir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)) : [];
  const track = music.length ? path.join(musicDir, music[Math.floor(Math.random() * music.length)]) : undefined;
  const args = ["-i", silent];
  const parts: string[] = [];
  let n = 1;
  if (voice) { args.push("-i", voice); parts.push(`[${n++}:a]apad,atrim=0:${duration}[a0]`); }
  if (track) { args.push("-stream_loop", "-1", "-i", track); parts.push(`[${n++}:a]volume=${voice ? 0.13 : 0.6},atrim=0:${duration},afade=t=out:st=${duration - 1.5}:d=1.5[a1]`); }
  if (!voice && !track) { args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"); parts.push(`[1:a]atrim=0:${duration}[aout]`); }
  else if (voice && track) parts.push(`[a0][a1]amix=inputs=2:duration=first:normalize=0[aout]`);
  else parts.push(`[${voice ? "a0" : "a1"}]anull[aout]`);
  await ffmpeg([...args, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", String(duration), "-movflags", "+faststart", out]);
  return out;
}

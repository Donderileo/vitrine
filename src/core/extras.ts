import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { z } from "zod";
import { config } from "./config";
import { loadSettings } from "./settings";
import { ffmpeg } from "./ffmpeg";
import { claudeCost } from "./pricing";
import type { Ctx } from "./types";

// Cover image + post description (caption + hashtags) for every finished video.

export const Extras = z.object({
  coverTitle: z.string(), // 2–5 punchy words for the cover
  caption: z.string(), // post text (no hashtags)
  hashtags: z.array(z.string()).min(3).max(8),
});
export type TExtras = z.infer<typeof Extras>;
export type ExtrasState = TExtras & { cover: string; description: string };

/** Claude writes the post text (one small call, ~US$0.005). Offline fallback builds it from the script. */
export async function writeExtras(ctx: Ctx, brief: { kind: "ad" | "explainer"; title: string; series?: string; script: string; cta?: string }): Promise<TExtras> {
  const fallback: TExtras = {
    coverTitle: brief.title.split(/\s+/).slice(0, 5).join(" "),
    caption: `${brief.title}. Salva pra usar depois e segue ${config.brandHandle} pra mais.`,
    hashtags: brief.kind === "ad" ? ["#achadinhos", "#tiktokshop", "#decoracao", "#casa"] : ["#decoracao", "#dicasdedecoracao", "#arquitetura", "#designdeinteriores", "#casa"],
  };
  if (config.llmProvider === "mock") return fallback;
  const { ask, textOf } = await import("./explainer/plan");
  const prompt = `Você escreve posts de TikTok do perfil ${config.brandHandle} (decoração e casa, Brasil).
VÍDEO (${brief.kind === "ad" ? "anúncio de produto, afiliado TikTok Shop" : "explicativo de decoração/arquitetura"}): "${brief.title}"${brief.series ? ` · série "${brief.series}"` : ""}
ROTEIRO/NARRAÇÃO: ${brief.script}

Escreva:
- coverTitle: título da CAPA, 2–5 palavras fortes que geram curiosidade (pode ser pergunta). Sem emoji.
- caption: legenda do post, 1–3 frases curtas, tom de criador de conteúdo, com 1 pergunta que puxe comentário, terminando com ${brief.cta ? `a MESMA chamada do vídeo (${brief.cta})` : "convite pra salvar/seguir"}. Pode ter 1–2 emojis. NÃO inclua hashtags aqui. ${brief.kind === "ad" ? "Mencione que o link está no carrinho/na bio." : ""}
- hashtags: 5–7 hashtags em português, misturando 2 amplas do nicho (ex.: #decoracao #casa) com 3–5 específicas do tema${brief.series ? " e 1 da série" : ""}. Sem #fyp/#foryou/#viral (não ajudam e poluem).

Responda só JSON: {"coverTitle":"","caption":"","hashtags":["#..."]}`;
  try {
    const res = await ask({ model: config.anthropicModel, max_tokens: 1500, messages: [{ role: "user", content: prompt }] });
    ctx.cost({ stage: "capa e descrição", provider: config.anthropicModel, ...claudeCost(res.usage) });
    const t = textOf(res);
    const e = Extras.parse(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)));
    e.hashtags = e.hashtags.map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, ""));
    return e;
  } catch (err) {
    ctx.log(`descrição: usando versão automática (${(err as Error).message.slice(0, 120)})`);
    return fallback;
  }
}

/**
 * Cover 1080x1920: a frame of the video + big title on a dark band at the top of the CENTER 3:4 area
 * (the TikTok profile grid crops covers to y≈240–1680), the illustration stays visible below it.
 */
export async function renderCover(opts: { video: string; at: number; title: string; tag?: string; out: string }) {
  const dir = path.dirname(opts.out);
  fs.mkdirSync(dir, { recursive: true });
  const frame = path.join(dir, "cover-frame.jpg");
  await ffmpeg(["-ss", opts.at.toFixed(2), "-i", opts.video, "-frames:v", "1", "-q:v", "2", frame]);
  const font = (f: string) => pathToFileURL(path.join(config.fontsDir, f)).href;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const words = opts.title.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.max(84, Math.min(150, Math.floor(1500 / Math.max(longest, 6)), words.length > 4 ? 118 : 150));
  const C = loadSettings().brandColors;
  const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };
  const bgc = rgb(C.bg), light = (0.299 * parseInt(C.bg.slice(1, 3), 16) + 0.587 * parseInt(C.bg.slice(3, 5), 16) + 0.114 * parseInt(C.bg.slice(5, 7), 16)) / 255 > 0.6;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:P;src:url('${font("Poppins-Bold.ttf")}')}@font-face{font-family:PM;src:url('${font("Poppins-Medium.ttf")}')}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${C.bg}}
.bg{position:absolute;inset:0;background:url('${pathToFileURL(frame).href}') center/cover;filter:brightness(.92) saturate(1.08)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,${C.bg} 0%,${C.bg} 34%,rgba(${bgc},.85) 38%,rgba(${bgc},0) 46%,rgba(${bgc},0) 70%,rgba(${bgc},.9) 86%,${C.bg} 100%)}
.box{position:absolute;left:80px;right:80px;top:250px;height:430px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:22px}
.tag{font-family:PM;font-size:38px;color:${C.gold};letter-spacing:.06em;text-transform:uppercase}
.t{font-family:P;font-size:${size}px;line-height:1.02;letter-spacing:-.02em;color:${light ? C.ink : "#fff"};text-shadow:${light ? "none" : "0 8px 30px rgba(0,0,0,.6)"}}
.t b{background:linear-gradient(180deg,${C.gold},${C.gold} 55%,${C.gold});-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:inherit}
.h{position:absolute;left:0;right:0;top:1560px;text-align:center;font-family:PM;font-size:36px;color:${light ? C.ink : "rgba(255,255,255,.85)"}}
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="box">${opts.tag ? `<div class="tag">${esc(opts.tag)}</div>` : ""}<div class="t">${words.map((w, i) => (i === words.length - 1 || /\?$/.test(w) ? `<b>${esc(w)}</b>` : esc(w))).join(" ")}</div></div>
${config.brandHandle ? `<div class="h">${esc(config.brandHandle)}</div>` : ""}</body></html>`;
  const htmlFile = path.join(dir, "cover.html");
  fs.writeFileSync(htmlFile, html);
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await p.goto(pathToFileURL(htmlFile).href);
    await p.evaluate(async () => { await (document as any).fonts.load("80px P"); await (document as any).fonts.load("30px PM"); });
    await p.waitForTimeout(150);
    await p.screenshot({ path: opts.out, type: "png" });
  } finally { await b.close(); }
  fs.rmSync(htmlFile, { force: true });
  return opts.out;
}

export function descriptionText(e: TExtras) {
  return `${e.caption}\n\n${e.hashtags.join(" ")}`;
}

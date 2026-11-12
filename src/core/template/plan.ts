import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { claudeCost } from "../pricing";
import { ask } from "../explainer/plan";
import { ffmpeg, probeSize } from "../ffmpeg";
import type { Ctx } from "../types";
import { Storyboard, type TStoryboard } from "./storyboard";

const MAX_SIDE = 1400;

/** Claude looks at the listing images and plans the video (texts + where things are in each image). */
export async function planStoryboard(ctx: Ctx): Promise<TStoryboard> {
  const sizes = await Promise.all(ctx.input.photos.map(probeSize));
  if (config.llmProvider === "mock") return mockStoryboard(ctx, sizes);
  if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  // Downscale for the model; remember the factor to map boxes back to original pixels.
  const prepared = await Promise.all(ctx.input.photos.map(async (p, i) => {
    const { w, h } = sizes[i];
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    const out = path.join(ctx.dir, `vision-${i}.jpg`);
    await ffmpeg(["-i", p, "-vf", `scale=${Math.round(w * k)}:${Math.round(h * k)}`, "-q:v", "3", out]);
    return { k, w: Math.round(w * k), h: Math.round(h * k), data: fs.readFileSync(out).toString("base64") };
  }));

  const content: Anthropic.ContentBlockParam[] = [];
  prepared.forEach((im, i) => {
    content.push({ type: "text", text: `Imagem ${i} (${im.w}x${im.h} px):` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: im.data } });
  });
  content.push({ type: "text", text: prompt(ctx) });

  const client = new Anthropic({ apiKey: config.anthropicKey });
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await ask({ model: config.anthropicModel, max_tokens: 6000, messages: [{ role: "user", content }] });
    ctx.cost({ stage: "roteiro", provider: config.anthropicModel, ...claudeCost(res.usage) });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      const sb = Storyboard.parse(raw);
      return scaleBoxes(sb, prepared.map((p) => p.k));
    } catch (e) {
      ctx.log(`Storyboard inválido (tentativa ${attempt}): ${(e as Error).message.slice(0, 300)}`);
    }
  }
  throw new Error("Claude não retornou um storyboard válido");
}

function scaleBoxes(sb: TStoryboard, ks: number[]): TStoryboard {
  const s = <T extends { x: number; y: number; w: number; h: number }>(b: T, k: number): T =>
    ({ ...b, x: b.x / k, y: b.y / k, w: b.w / k, h: b.h / k });
  return {
    ...sb,
    images: sb.images.map((im) => ({ ...im, product: s(im.product, ks[im.index]), textBoxes: im.textBoxes.map((t) => s(t, ks[im.index])) })),
    items: sb.items && { ...sb.items, boxes: sb.items.boxes.map((b) => s(b, ks[sb.items!.image])) },
    details: sb.details && { ...sb.details, boxes: sb.details.boxes.map((b) => s(b, ks[sb.details!.image])) },
  };
}

function prompt(ctx: Ctx) {
  const i = ctx.input;
  return `Você monta vídeos curtos (9:16, ~15s) de TikTok Shop para afiliados no nicho de casa e decoração.
Os vídeos são montados por CÓDIGO a partir dessas imagens do anúncio: recortes, zoom, textos animados. Nada é gerado por IA.

PRODUTO: ${i.name}
DESCRIÇÃO: ${i.description}
${i.priceText ? `PREÇO: ${i.priceText}\n` : ""}IDIOMA DOS TEXTOS: ${i.language}
VARIAÇÕES: ${i.variations}

1) Para CADA imagem, informe em pixels da imagem (x,y = canto superior esquerdo):
   - product: caixa do produto principal inteiro (com folga pequena);
   - textBoxes: caixas de TODO texto/selo/ícone/logo embutido na imagem (para evitar nos recortes);
   - kind: lifestyle | studio | infographic | detail.
2) measure: se houver uma medida marcante (altura, largura, capacidade), {value, unit, label, image} — usando a imagem onde o produto aparece inteiro. Senão null.
3) items: se uma imagem mostra itens inclusos/variações em quadros separados (círculos, grid), dê 2–6 caixas {x,y,w,h,label} cobrindo CADA item SEM o texto de legenda; title curto (ex.: "JÁ VEM COM ENFEITES"). Senão null.
4) details: até 2 caixas de detalhes/closes do produto (inserts, zoom de acabamento), com label curto, SEM texto embutido. Senão null.
5) features: até 3 benefícios curtos (máx. 3 palavras cada) que estejam na descrição ou nas imagens.
6) variations: ${i.variations} variações com ângulos diferentes. Cada uma:
   - hookWords: 2–4 palavras curtas, uma por linha, que param o scroll (ex.: ["ELA","BRILHA","ASSIM"]);
   - hookSub: frase curta abaixo do gancho; heroImage: imagem lifestyle mais bonita para abrir;
   - scenes: ordem das cenas entre hook, measure, items, details, showcase, final. Começa com hook, termina com final; use só cenas que têm dados; total ~14–18s (hook 3s, measure 3.5s, items 4.2s, details 3s, showcase 3s, final 3.5s);
   - showcaseImage: se usar showcase; captions: {"measure":"...","showcase":"..."} (máx. 5 palavras);
   - voiceover: narração natural de 30–40 palavras; cta: curta para o carrinho (ex.: "Tá no carrinho laranja").
title: nome curto do produto para o card final (máx. 22 caracteres); subtitle: complemento curto.
theme: "festivo" (natal, luzes, festa), "quente" (decoração aconchegante, madeira, tons quentes) ou "clean" (produto claro, minimalista, organização).

REGRAS: não invente características, medidas ou preços que não estejam na descrição/imagens. Textos curtos, tom de criador de conteúdo.
Responda APENAS com JSON válido:
{"theme":"quente","title":"","subtitle":"","price":null,"images":[{"index":0,"product":{"x":0,"y":0,"w":0,"h":0},"textBoxes":[],"kind":"lifestyle"}],"measure":null,"items":null,"details":null,"features":[],"variations":[{"angle":"","hookWords":[],"hookSub":"","heroImage":0,"scenes":["hook","final"],"captions":{},"voiceover":"","cta":""}]}`;
}

/** Offline plan: whole images, no boxes beyond a centered guess. Good enough to test the renderer. */
function mockStoryboard(ctx: Ctx, sizes: { w: number; h: number }[]): TStoryboard {
  const imgs = sizes.map((s, index) => ({
    index, kind: "lifestyle" as const, textBoxes: [],
    product: { x: s.w * 0.2, y: s.h * 0.05, w: s.w * 0.6, h: s.h * 0.9 },
  }));
  const hooks = [["OLHA", "ISSO"], ["ACHADINHO", "DE CASA"], ["VOCÊ", "PRECISA", "DISSO"]];
  return {
    theme: "quente",
    title: ctx.input.name.slice(0, 22), subtitle: "", price: ctx.input.priceText,
    images: imgs, measure: null, items: null, details: null, features: [],
    variations: Array.from({ length: ctx.input.variations }, (_, v) => ({
      angle: `variação ${v + 1}`, hookWords: hooks[v % hooks.length], hookSub: ctx.input.name,
      heroImage: v % imgs.length,
      scenes: ["hook", ...(imgs.length > 1 ? (["showcase"] as const) : []), "final"],
      showcaseImage: (v + 1) % imgs.length, captions: { showcase: "Olha esse detalhe" },
      voiceover: "", cta: "Tá no carrinho laranja",
    })),
  };
}

import { z } from "zod";
import { config } from "../config";
import { claudeCost } from "../pricing";
import { shorten } from "./csv";
import type { Carousel, Copy } from "./types";

const Out = z.object({
  coverTitle: z.string(),
  coverSub: z.string(),
  intro: z.string(),
  hashtags: z.array(z.string()).min(3).max(8),
  items: z.array(z.object({ id: z.string(), short: z.string(), tag: z.string() })),
});

/** Claude shortens the product names and writes the cover + post text (one small call, ~US$0.01). Returns the cost. */
export async function writeCarouselCopy(c: Carousel, log: (m: string) => void): Promise<number> {
  const n = c.products.length;
  const fallback: Copy = {
    coverTitle: c.title,
    coverSub: `${n} achados pra sua casa`,
    intro: `${c.title}! Separei ${n} achados que eu colocaria em casa. Qual você levaria primeiro?`,
    hashtags: ["#achadinhosshopee", "#decoracao", "#casa", "#achadinhos", "#decoracaodecasa"],
  };
  const useFallback = (why: string) => {
    log(`textos: usando versão automática (${why})`);
    c.copy = c.copy ?? fallback;
    for (const p of c.products) if (!p.short) p.short = shorten(p.name);
    return 0;
  };
  if (config.llmProvider === "mock" || !config.anthropicKey) return useFallback("Claude não configurado");
  const { ask, textOf } = await import("../explainer/plan");
  const list = c.products.map((p) => `- id ${p.id}: ${p.name} (R$ ${p.price})`).join("\n");
  const cta = c.cta === "bio" ? "links na bio" : c.cta === "comentar" ? `comentar a palavra ${c.keyword.toUpperCase()} para receber o link` : `comentar ${c.keyword.toUpperCase()} ou pegar na bio`;
  const prompt = `Você monta carrosséis de achadinhos de casa e decoração (Shopee) para o perfil ${config.brandHandle} (Brasil), no TikTok/Instagram.

TEMA DO CARROSSEL: ${c.title}
PRODUTOS (títulos longos do anúncio):
${list}

Escreva:
- items: para CADA produto (mesmo id), "short" = nome curto e bonito, 2–4 palavras, sem marca, sem adjetivo de anúncio ("ideal para", "grande", "kit", "promoção"), em português, só a primeira letra maiúscula (ex.: "Mesa de jantar redonda"); "tag" = categoria em 1–2 palavras minúsculas (ex.: "sala de jantar", "cozinha", "quarto").
- coverTitle: título da CAPA, 2–5 palavras fortes, que gerem curiosidade (pode ser pergunta). Sem emoji.
- coverSub: linha curta sob o título (ex.: "${n} achados pra sala de jantar"). Sem emoji.
- intro: 1–2 frases curtas de legenda, tom de criador de conteúdo, com 1 pergunta que puxe comentário. Não liste os produtos e não fale do link (isso é acrescentado depois). Pode ter 1 emoji.
- hashtags: 5–7 em português, 2 amplas do nicho + 3–5 específicas. Sem #fyp/#foryou/#viral.
(A chamada do post será: ${cta}.)

Responda só JSON: {"coverTitle":"","coverSub":"","intro":"","hashtags":["#..."],"items":[{"id":"","short":"","tag":""}]}`;
  try {
    const res = await ask({ model: config.anthropicModel, max_tokens: 2500, messages: [{ role: "user", content: prompt }] });
    const t = textOf(res);
    const o = Out.parse(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)));
    c.copy = { coverTitle: o.coverTitle, coverSub: o.coverSub, intro: o.intro, hashtags: o.hashtags.map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, "")) };
    for (const it of o.items) {
      const p = c.products.find((x) => x.id === it.id);
      if (!p) continue;
      if (!p.short || p.short === shorten(p.name)) p.short = it.short.trim() || p.short; // keep names the user edited
      if (!p.tag) p.tag = it.tag.trim();
    }
    for (const p of c.products) if (!p.short) p.short = shorten(p.name);
    const cost = claudeCost(res.usage).usd;
    log(`textos prontos (US$ ${cost.toFixed(3)})`);
    return cost;
  } catch (e) {
    return useFallback((e as Error).message.slice(0, 100));
  }
}

/** Post text: Claude's intro + numbered list + the call + hashtags. */
export function buildCaption(c: Carousel): string {
  const cp = c.copy;
  const list = c.products.map((p, i) => `${i + 1}. ${p.short || p.name}`).join("\n");
  const kw = c.keyword.trim().toUpperCase() || "LINK";
  const call = c.cta === "bio" ? "Links na bio 👆 (é só pegar pelo número)"
    : c.cta === "comentar" ? `Comenta ${kw} que eu te mando todos os links 💬`
    : `Comenta ${kw} que eu te mando os links 💬 (ou pega na bio)`;
  const tags = [...(c.publi ? ["#publi"] : []), ...(cp?.hashtags ?? [])].join(" ");
  return [cp?.intro ?? c.title, list, call, tags].filter(Boolean).join("\n\n");
}

/** Links file: numbered, ready to paste in the link-in-bio page or in the DM reply. */
export function buildLinks(c: Carousel): string {
  return c.products.map((p, i) => `${i + 1}. ${p.short || p.name}${p.price ? ` — R$ ${p.price}` : ""}\n${p.link}`).join("\n\n");
}

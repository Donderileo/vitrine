import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { loadSettings, styleBrief } from "../settings";
import { claudeCost } from "../pricing";
import type { Ctx } from "../types";
import { ExplainerPlan, type TExplainerPlan } from "./schema";

export function claude() {
  if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");
  return new Anthropic({ apiKey: config.anthropicKey });
}
/**
 * Sonnet 5.5 thinks by default (adaptive, effort "high") and thinking tokens count against max_tokens and are
 * billed as output. Our calls are single-shot writing tasks: keep thinking at its minimum and effort moderate.
 */
export const FAST: any = { thinking: { type: "between_tools" }, output_config: { effort: process.env.CLAUDE_EFFORT || "medium" } };
/** One Claude call with minimal thinking; if this API/model rejects those params, retries with effort "low" only. */
export async function ask(params: Record<string, unknown>): Promise<Anthropic.Message> {
  const client = claude();
  try { return await client.messages.stream({ ...params, ...FAST } as any).finalMessage(); }
  catch (e: any) {
    if (e?.status === 400 && /thinking|effort|output_config|between_tools/i.test(String(e?.message))) {
      return await client.messages.stream({ ...params, output_config: { effort: "low" } } as any).finalMessage();
    }
    throw e;
  }
}
export const textOf = (res: Anthropic.Message) => res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

/** Topic → narrated storyboard (scenes with narration, on-screen title and what to draw). */
export async function planExplainer(ctx: Ctx, topic: string, notes: string, series: string): Promise<TExplainerPlan> {
  if (config.llmProvider === "mock") return mockPlan(topic, series);
  const st = loadSettings();
  const style = [styleBrief(st), st.scriptNotes.trim() ? `NOTAS DO PERFIL PARA O ROTEIRO:\n${st.scriptNotes.trim()}` : ""].filter(Boolean).join("\n");
  const prompt = `Você roteiriza vídeos curtos (TikTok, 9:16, 25–40s) do perfil "Vitrine" — dicas de decoração e arquitetura, tom de criador de conteúdo: leve, direto, um pouco divertido. Os vídeos são ANIMAÇÕES FLAT desenhadas por código (formas simples: cômodos, móveis, setas, números, réguas), com narração.

TEMA: ${topic}
${notes ? `OBSERVAÇÕES: ${notes}\n` : ""}SÉRIE: ${series || "(nenhuma)"}
IDIOMA: ${ctx.input.language}

Escreva ${Math.max(7, Math.round(config.explainerSeconds / 4.5))}–${Math.max(9, Math.round(config.explainerSeconds / 3.5))} cenas CURTAS (3–5 s cada: cortes rápidos prendem mais). Regras:
- Cena 1 é o GANCHO e decide tudo (a maioria sai no 1º segundo): primeira frase com no máximo 7 palavras, começando direto no problema ou numa afirmação que provoca ("Seu tapete está deixando a sala menor."). Nada de "Você sabia", "Hoje vou", "Sabe por que". O título da tela da cena 1 é o próprio gancho.
- Uma ideia por cena. Narração de 1–2 frases curtas, natural para falar (sem siglas difíceis, números por extenso quando soar melhor). DURAÇÃO ALVO: ~${config.explainerSeconds}s no total → a narração inteira deve ter NO MÁXIMO ${Math.round(config.explainerSeconds * 2.3)} palavras. Corte o que não for essencial.
- Escrita para voz: frases diretas, sem ponto de exclamação, sem palavras em MAIÚSCULAS, sem emojis, sem reticências dramáticas.
- O @ do perfil NUNCA vai escrito na narração; se quiser citar o perfil, escreva exatamente {HANDLE} (ex.: "segue o {HANDLE} pra mais regras").
- onScreen: título grande da cena, máx. 6 palavras (pode ser um número, ex.: "60%").
- visual: descreva o desenho e o movimento de forma concreta e desenhável com formas simples (ex.: "sala em vista frontal; o tapete cresce até os pés do sofá ficarem em cima; seta mostra 'pés da frente'"). Prefira mostrar a regra acontecendo (antes → depois) a escrever texto.
- Última cena: recapitulação visual + CTA "salva pra usar depois" (ou similar) e o nome da série.
- FATOS: só afirme medidas/regras amplamente aceitas por arquitetos e designers; se houver variação, use faixas ("entre 75 e 85 cm"). Não invente estatísticas.
${style ? style + "\n(Ao descrever o visual, respeite essas cores e regras.)\n" : ""}- palette: até 4 cores hex que combinem com o tema (além do fundo escuro e dourado da marca).

Responda APENAS com JSON:
{"title":"","series":"${series}","palette":["#..."],"scenes":[{"narration":"","onScreen":"","visual":""}]}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await ask({ model: config.anthropicModel, max_tokens: 8000, messages: [{ role: "user", content: prompt }] });
    ctx.cost({ stage: "roteiro", provider: config.anthropicModel, ...claudeCost(res.usage) });
    const t = textOf(res);
    try { return ExplainerPlan.parse(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1))); }
    catch (e) { ctx.log(`Roteiro inválido (tentativa ${attempt}): ${(e as Error).message.slice(0, 200)}`); }
  }
  throw new Error("Claude não retornou um roteiro válido");
}

function mockPlan(topic: string, series: string): TExplainerPlan {
  return {
    title: topic, series, palette: ["#E9DFD0", "#7A8450", "#C4673F"],
    scenes: [
      { narration: `Você já ouviu falar de ${topic}?`, onScreen: "VOCÊ SABIA?", visual: "pergunta" },
      { narration: "Essa é uma regra simples que muda a cara da sua casa.", onScreen: "REGRA SIMPLES", visual: "casa" },
      { narration: "Presta atenção nesse detalhe aqui, que quase todo mundo erra.", onScreen: "O DETALHE", visual: "lupa" },
      { narration: "Salva esse vídeo pra usar na próxima vez.", onScreen: "SALVA PRA DEPOIS", visual: "recap" },
    ],
  };
}

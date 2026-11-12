import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { claudeCost } from "../pricing";
import { ask } from "../explainer/plan";
import { scriptPrompt } from "../prompts";
import { ScriptSchema, type Ctx, type Script } from "../types";

export const SCENES_PER_VIDEO = 3;

export async function generateScript(ctx: Ctx): Promise<Script> {
  const prompt = scriptPrompt(ctx.input, SCENES_PER_VIDEO, config.sceneSeconds);
  if (config.llmProvider === "mock") return mockScript(ctx);

  if (!config.anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");
  const client = new Anthropic({ apiKey: config.anthropicKey });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await ask({ model: config.anthropicModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    // Rough cost: tokens * price. Adjust ANTHROPIC prices if you switch models.
    ctx.cost({ stage: "roteiro", provider: config.anthropicModel, ...claudeCost(res.usage) });
    try {
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return ScriptSchema.parse(JSON.parse(json));
    } catch (e) {
      ctx.log(`Roteiro inválido (tentativa ${attempt}): ${(e as Error).message.slice(0, 200)}`);
    }
  }
  throw new Error("LLM não retornou um roteiro válido");
}

function mockScript(ctx: Ctx): Script {
  const angles = ["antes e depois", "achadinho que transforma", "POV chegando em casa", "erro de decoração"];
  const n = ctx.input.name;
  return {
    variations: Array.from({ length: ctx.input.variations }, (_, i) => ({
      angle: angles[i % angles.length],
      hook: `Ninguém acredita que isso custa tão pouco`,
      scenes: [
        { imagePrompt: `cozy living room at golden hour featuring ${n}`, motionPrompt: "slow push-in", caption: "Olha o que mudou aqui" },
        { imagePrompt: `close-up detail of ${n} in a minimalist bedroom`, motionPrompt: "gentle pan", caption: `${n}`.slice(0, 30) },
        { imagePrompt: `wide shot of a styled room with ${n}, evening lights`, motionPrompt: "slow pull-out", caption: "Tá no carrinho laranja" },
      ],
      voiceover: `Gente, esse ${n} mudou completamente o meu ambiente. Fica lindo de dia e de noite, e o preço é surreal. O link tá aqui no carrinho.`,
      cta: "Tá no carrinho laranja",
    })),
  };
}

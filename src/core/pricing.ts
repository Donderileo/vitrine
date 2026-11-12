import { config } from "./config";

// One place for prices, so every project shows what it actually cost.
// Anthropic bills per token (exact from the API's usage numbers); ElevenLabs bills per character
// of text on your plan, so its USD value depends on the plan price set in .env.
export function claudeCost(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  const inTok = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  const usd = (inTok * config.anthropicUsdIn + u.output_tokens * config.anthropicUsdOut) / 1e6;
  return { usd, note: `${u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)} tokens entrada · ${u.output_tokens} saída` };
}

export function elevenCost(chars: number) {
  return { usd: (chars / 1000) * config.elevenUsdPer1k, note: `${chars} caracteres` };
}

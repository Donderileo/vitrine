import type { ProjectInput } from "./types";

export function scriptPrompt(input: ProjectInput, scenesPerVideo: number, sceneSeconds: number) {
  const totalSec = scenesPerVideo * sceneSeconds;
  const maxWords = Math.round(totalSec * 2.4);
  return `Você é roteirista de vídeos virais de TikTok Shop no nicho de decoração e casa.

PRODUTO
- Nome: ${input.name}
- Descrição: ${input.description}
${input.priceText ? `- Preço: ${input.priceText}\n` : ""}${input.productUrl ? `- Link: ${input.productUrl}\n` : ""}
IDIOMA DO VÍDEO: ${input.language} (todo texto falado e legendas neste idioma; prompts de imagem/movimento em inglês).

TAREFA
Crie ${input.variations} variações de vídeo vertical (9:16), cada uma com um ÂNGULO diferente
(ex.: "antes e depois", "achadinho que transforma o ambiente", "POV chegando em casa", "erro de decoração que todo mundo comete").
Cada variação tem exatamente ${scenesPerVideo} cenas de ${sceneSeconds}s (~${totalSec}s no total, sem contar o card final com a foto real).

REGRA MAIS IMPORTANTE — FIDELIDADE DO PRODUTO
As imagens serão geradas a partir da FOTO REAL do produto. Você pode idealizar o AMBIENTE
(iluminação, cômodo, estilo, hora do dia, decoração ao redor), mas NUNCA o produto:
não mude cor, material, tamanho, formato, acabamento nem adicione funções que ele não tem.
Todo imagePrompt deve conter: "keep the product exactly as in the reference photo (same shape, color, material, size)".
Não prometa nada que a descrição não sustente.

FORMATO DE CADA CENA
- imagePrompt (inglês): a cena fotorrealista em 9:16 com o produto em uso no ambiente, estilo de foto de revista de decoração, luz natural.
- motionPrompt (inglês): movimento de câmera sutil (slow push-in, gentle pan, light flickering...). Sem transformar o produto.
- caption: texto curto na tela (máx. 6 palavras).
A cena 1 é o GANCHO: precisa prender nos primeiros 2 segundos.

VOICEOVER: narração natural, tom de criador de conteúdo (não de comercial), no máximo ${maxWords} palavras.
CTA: curta, apontando para o carrinho/link (ex.: "tá no carrinho laranja").

Responda APENAS com JSON válido neste formato, sem markdown:
{"variations":[{"angle":"...","hook":"...","scenes":[{"imagePrompt":"...","motionPrompt":"...","caption":"..."}],"voiceover":"...","cta":"..."}]}`;
}

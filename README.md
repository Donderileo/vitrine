# Vitrine

Motor que transforma **imagens de um produto** em **vídeos verticais prontos para o TikTok**. Tem dois modos:

- **Template (padrão, ~grátis):** o Claude olha as imagens do anúncio e planeja o vídeo: gancho, medida, itens inclusos, detalhes e CTA, além de onde cada coisa está na imagem. O vídeo é desenhado por código (HTML + Playwright + ffmpeg) com recortes, zoom, contadores e textos animados. Custo: ~US$0,02–0,05 por produto, só do roteiro.
- **IA (pago):** cenas novas geradas no fal.ai (Nano Banana) e clipes de vídeo de IA (Seedance). Fica para os produtos que já provaram que vendem.

Cenas do template: `hook` (gancho palavra por palavra) · `measure` (contador de medida com zoom revelando o produto) · `items` (itens inclusos em círculos) · `details` (cards de close + benefícios) · `showcase` (imagem extra com legenda) · `final` (produto + título + botão do carrinho).

## Rodando

### Opção A — Docker (recomendado, já vem com ffmpeg e fontes)
```bash
cp .env.example .env
docker compose up --build
# abre http://localhost:3000
```

### Opção B — Node direto
Requisitos: Node 22+, `ffmpeg` e `ffprobe` no PATH (`brew install ffmpeg`).
```bash
npm run setup                  # npm install + navegador do Playwright (usado para desenhar os vídeos)
cp .env.example .env           # e coloque ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic
npm run build && npm start     # terminal 1 → http://localhost:3000
npm run worker                 # terminal 2 → processa a fila
```
Para desenvolver: `npm run dev` no lugar de build/start.

### Só o motor, pela linha de comando
```bash
npm run cli -- --name "Luminária de mesa" --desc "Cúpula bege, base de madeira, 35cm" --photo foto1.jpg --photo foto2.jpg --n 2
# --storyboard plano.json usa um roteiro pronto (pula o Claude). Exemplo em exemplos/storyboard-arvore.json
```

## Dicas para o modo template
- Suba **todas** as imagens do anúncio: infográficos com medidas, itens inclusos e closes viram cenas próprias.
- Sem `ANTHROPIC_API_KEY`, o roteiro é um modelo genérico (só gancho, imagem extra e final). Com a chave, o Claude encontra medidas, itens e detalhes nas imagens.
- Os recortes evitam o texto que já vem impresso nas imagens do anúncio. Se algo ficar ruim, edite os textos na revisão ou mude a ordem das cenas. Re-renderizar é grátis.
- Imagens de anúncio costumam ser renders idealizados. Os vídeos que mais convertem misturam isso com 1 ou 2 segundos de produto real.

## Vídeo explicativo (tema → animação narrada)

Na tela inicial, escolha **Vídeo explicativo** e digite um tema (ex.: "A altura certa do quadro na parede").

1. **Roteiro (Claude):** 5 a 8 cenas, cada uma com narração, título na tela e o que desenhar. Com "revisar" marcado, você edita a narração antes de qualquer gasto com voz.
2. **Narração (ElevenLabs):** gerada cena a cena, com o tempo de cada palavra. A animação é cronometrada pela voz.
3. **Animação (Claude escreve o código):** usa o motor `vendor/animation-studio` (licença MIT, do plugin animation-studio). Os movimentos caem na palavra falada. Uma checagem automática e gratuita (quadros + QA de layout) devolve os problemas para o Claude corrigir, em até 3 rodadas.
4. **Render + trilha:** lofi gerada em código, com volume reduzido sob a voz, e efeitos sonoros nos acontecimentos.
5. **Legendas:** 1 a 3 palavras por vez, com a palavra falada em dourado.

Custo típico: US$0,15 a 0,30 de Claude mais ~500 caracteres de ElevenLabs por vídeo. O app mostra o custo exato de cada etapa (tokens e caracteres) em cada projeto e o total gasto na tela inicial. Os preços ficam no `.env`.

Precisa do Chrome instalado ou do Chromium do Playwright (`npm run setup`). O render leva alguns minutos por vídeo.
Para testar sem gastar: `LLM_PROVIDER=mock` e `TTS_PROVIDER=mock` geram cartões de título com áudio mudo.
Exemplo de filme escrito à mão: `assets/explainer/example-film.js` (a regra 60-30-10). O Claude usa esse arquivo como referência de estilo.

## Configurações (aba ⚙ no app)

Em **/settings** dá pra mudar, sem mexer no `.env`:

- **Marca:** @ do perfil, como a voz fala o @, e as cores (fundo, destaque, texto).
- **Voz:** voice ID, velocidade, estabilidade, similaridade e estilo.
- **Vídeo explicativo:** duração alvo, música (lofi ou nenhuma) e volume.
- **Objetos com cor fixa** (ex.: sofá `#7A8450`, "3 lugares"): entram no prompt do roteiro e da animação e ficam no código como `H.C['sofá']`, então todo vídeo desenha o mesmo sofá.
- **Regras de estilo** e **notas para o roteiro**: texto livre enviado ao Claude.

Fica salvo em `data/settings.json` (fora do git) e vale a partir do próximo projeto. As chaves de API continuam só no `.env`; a página só mostra se estão configuradas.

## Motion graphics (biblioteca H.M)

Os vídeos explicativos seguem o método do manual de edição da Zibbo, adaptado para animação sem rosto:

- **Roteiro de motion:** o roteiro sai com "beats" por cena (palavra falada → componente → texto). Dá para editar na tela de revisão antes de pagar a animação.
- **Biblioteca de componentes** em `assets/explainer/motion.js` (documentada em `motion-api.md`): título, palavra-chave, contador, barra %, régua de medida, checklist, antes × depois, riscado, "?", seta, círculo, estrelas, anel, preço, card, troca de assunto e cartela final. O timing já vem embutido (entrada 0,4 s, saída 0,25 s, escalonamento 0,09 s). O Claude só desenha à mão a ilustração do tema.
- **Som automático:** cada beat ganha um efeito sonoro (pop, tick, ding, whoosh…).
- **Checagem:** além de erro de código e layout, reprova cena com o meio da tela vazio no começo.
- **Configurações:** nível de motion (intenso / moderado / leve) e legenda on/off.

## Subir pro GitHub

`npm run git:sync` adiciona tudo, faz o commit e o push. Se o `.env` aparecer no commit, ele aborta.

## Página de links (link da bio)

Página estática em `site/` (Cloudflare Pages, grátis e permite uso comercial). Cada projeto ganha um **número de produto**. O vídeo termina com "ou no link da bio · produto #12", e a página tem busca por número.

1. Com o vídeo pronto, cole o link de afiliado (Linkshare) no card **Página de links** do projeto e clique em "Adicionar à página". Isso gera `site/public/products.json` e a miniatura.
2. Para publicar, rode `npm run site:deploy`. Na primeira vez, o wrangler pede login no Cloudflare e cria o projeto `vitrine-links`. O endereço fica `vitrine-links.pages.dev`.
3. Para testar local: `npm run site:dev` → http://localhost:8788
4. `/p/12` redireciona para o link do produto 12. Para contar cliques, ligue o KV (instruções em `site/wrangler.toml`).
5. Domínio próprio: compre o domínio, depois vá em Cloudflare → Pages → vitrine-links → Custom domains.

## Modo IA: teste vs. real

Por padrão tudo roda em **mock**, de graça e offline: roteiro de exemplo, imagens placeholder, zoom/pan local e áudio mudo.
Serve para testar o fluxo inteiro antes de gastar com API. Para ligar a IA de verdade, edite o `.env`:

| Etapa | Provedor | Variável | Custo aproximado |
|---|---|---|---|
| Roteiro | Claude (Anthropic) | `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` | < US$0,05 por projeto |
| Imagens | fal.ai Nano Banana 2 (edit) | `IMAGE_PROVIDER=fal` + `FAL_KEY` | ~US$0,08 por cena |
| Clipes | fal.ai Seedance 2.5 | `VIDEO_PROVIDER=fal` | ~US$1,10 por cena de 5s em 480p |
| Clipes (barato) | zoom/pan local | `VIDEO_PROVIDER=kenburns` | grátis |
| Narração | ElevenLabs | `TTS_PROVIDER=elevenlabs` + chave + voice id | depende do plano |

Um vídeo com 3 cenas sai por **~US$0,30** com imagens de IA + kenburns, ou **~US$3,60** com vídeo de IA em 480p.
Os preços mudam, então confira no site de cada provedor. Os valores do `.env` só alimentam a estimativa que aparece em cada projeto.

Começo sugerido: `LLM=anthropic`, `IMAGE=fal`, `VIDEO=kenburns`. Só passe a usar vídeo de IA nos produtos que já mostraram tração.

## Como funciona

```
src/core/
  pipeline.ts        orquestra as etapas; salva o progresso de cada uma (retomar não cobra de novo)
  prompts.ts         prompt do roteiro (regras de fidelidade do produto ficam aqui)
  compose.ts         montagem com ffmpeg: concat, legendas ASS, card final, mix de áudio
  providers/         llm · image · video · tts  (cada um com versão real + mock)
  db.ts              SQLite: projetos, logs, custos (já tem owner_id para login futuro)
src/worker.ts        fila: pega projetos "queued" e roda o pipeline
src/cli.ts           roda o motor sem a interface web
app/                 interface Next.js + API
data/                banco, uploads e vídeos gerados (fora do git)
```

- **Revisar roteiro**: com a opção marcada, o pipeline pausa depois do roteiro para você editar gancho, legendas, narração e prompts antes de pagar imagem e vídeo.
- **Retomar**: se uma etapa falhar, "Retomar de onde parou" reaproveita tudo o que já ficou pronto.
- **Remontar (grátis)**: refaz só a edição final. Útil depois de colocar músicas em `data/music/` (mp3/m4a/wav, uma é sorteada por vídeo; use só faixas com licença).
- **Fidelidade**: o prompt e as chamadas de imagem e vídeo pedem que o produto fique idêntico à foto. O ambiente pode ser idealizado. Todo vídeo termina com "Foto real do produto".
- **Selo "Conteúdo gerado com IA"**: entra automaticamente quando há imagem ou vídeo de IA. No TikTok, marque também a opção de conteúdo de IA ao postar.

## Caminho para virar produto (SaaS)

1. **Login**: Supabase Auth ou Auth.js, preenchendo `owner_id` a partir da sessão (os pontos estão marcados com `TODO(auth)`).
2. **Storage**: trocar `data/` por S3/R2/Supabase Storage.
3. **Banco**: trocar SQLite por Postgres (as queries são simples).
4. **Fila**: o worker já trava o projeto de forma atômica; dá para rodar vários workers. Em escala, usar BullMQ/Redis.
5. **Cobrança**: créditos por vídeo com Stripe ou Mercado Pago, usando a tabela `costs` para definir a margem.

## Carrossel (lista de produtos da Shopee)

Aba **▦ Carrossel**: capa + 1 slide por produto (nome, preço, número) + slide final (links na bio e/ou "comente a palavra"), em 9:16 (TikTok) ou 4:5 (Instagram).

1. **Produtos**: importe o CSV do afiliado Shopee ("Batch Product Links"). Traz nome, preço e o *Offer Link* (o seu link de afiliado, `s.shopee.com.br/…`).
2. **Fotos**: suba uma foto por produto (ou várias de uma vez, atribuídas na ordem dos nomes dos arquivos). Com `FAL_KEY` no `.env`, o fundo é removido (~US$ 0,005 por foto) e o produto aparece na "casa padrão" da Vitrine (as cores de parede/piso/planta vêm de Configurações → Objetos). Sem a chave, a foto original vai num cartão.
3. **Gerar**: "Escrever textos" (Claude: nomes curtos, capa, legenda) e "Gerar slides". Baixe o `.zip` com as imagens, a `legenda.txt` e os `links.txt`.

Os preços aparecem como "a partir de" (promoções e cupons mudam o valor). A legenda leva `#publi` por padrão.

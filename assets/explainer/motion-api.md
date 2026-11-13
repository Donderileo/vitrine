# Biblioteca de motion (H.M)

Componentes prontos com o timing da casa já embutido (entrada 0,4 s com ease-out deslizando 130 px ou "pop" com overshoot; saída 0,25 s; itens de um grupo com 0,09 s de diferença; algo sempre respirando). Todos são função pura de t: chame em TODO quadro, `H.M.nome(ctx, t, {…})`. `at` = quando entra (use `H.cue(i, 'palavra')`), `out` = quando começa a sair (opcional; sem `out` fica até o fim da cena).

| Componente | Gatilho na fala | Chamada |
|---|---|---|
| tag | rótulo pequeno acima de título/card | `tag(ctx,t,{text, at, x, y, align:'left'\|'center'})` |
| title | título da cena com palavras entrando uma a uma | `title(ctx,t,{text, at, y, size:92, hl:'palavra destacada'})` |
| keyword | frase de impacto, regra, "nunca", "sempre" | `keyword(ctx,t,{text, at, out, y, size:130, label, box:true})` |
| counter | qualquer número falado (medida, %, quantidade) | `counter(ctx,t,{to, from:0, at, dur:0.9, prefix, suffix:' cm', label, y, size:200})` |
| meter | porcentagem, proporção, "ocupar 2/3" | `meter(ctx,t,{value:0.66, at, label, y, w:820})` |
| ruler | distância, altura, largura entre dois pontos | `ruler(ctx,t,{x1,y1,x2,y2, at, label:'80 cm', side:-1})` |
| badges | valores do recap, várias etiquetas lado a lado (já centraliza e quebra linha) | `badges(ctx,t,{items:[{text:'140–160 cm', at}], y})` |
| checklist | lista de dicas/etapas, uma por palavra | `checklist(ctx,t,{items:[{text, at}], x, y, gap:120, bad:false})` |
| compare | "antes e depois", "certo e errado", "em vez de" (SUBSTITUI a ilustração; os painéis são opacos) | `compare(ctx,t,{at, left:{label:'ERRADO', ok:false, draw(ctx,box,t){…}}, right:{label:'CERTO', ok:true, draw}, y, h:760})` |
| strike | "sem", "pare de", "não use", mito | `strike(ctx,t,{text, at, strikeAt})` |
| question | pergunta | `question(ctx,t,{at, out, x, y, size:420})` |
| arrow | "aqui", direção, "puxa pra", relação | `arrow(ctx,t,{x1,y1,x2,y2, at, bend:0.2})` |
| circle | "olha isso", destacar um detalhe do desenho | `circle(ctx,t,{x,y,rx,ry, at})` |
| underline | sublinhar palavra/objeto | `underline(ctx,t,{x1,x2,y, at})` |
| stars | "ótimo", "qualidade", "elegante" | `stars(ctx,t,{at, n:5, y})` |
| ring | tempo, porcentagem em círculo | `ring(ctx,t,{value, at, text, x, y, r:220})` |
| price | preço, "barato", "de graça" | `price(ctx,t,{to, at, prefix:'R$ ', stamp:'BARATO'})` |
| focus | close num detalhe da ilustração (trocar o enquadramento) | `focus(ctx,t,{x, y, k:1.9 (mín. 1,7), at:s.t0, out}, (c) => K.room(c, …))` — desenhe a ilustração DENTRO do callback |
| card | caixa escura com borda da marca para agrupar | `card(ctx,t,{at, x,y,w,h, label}, (ctx, box, L) => {…})` |
| wipe | mudança de assunto ("agora", "o segundo erro") | `wipe(ctx,t,{at})` (dura 0,6 s, cobre a tela) |
| cta | cena final, com a CHAMADA do roteiro | `cta(ctx,t,{at, kind:'salvar'\|'comentar'\|'compartilhar'\|'seguir', text, sub})` (cobre a tela inteira: ícone animado + texto + o @) |

Utilitários: `H.M.life(t, at, out)` → `{i, back, o, a, age}` ou null · `H.M.enter(ctx, L, 'pop'|'left'|'right'|'up'|'down'|'fade', cx, cy, () => {…})` aplica entrada/saída a qualquer desenho seu · `H.M.stagger(at, k)` · `H.M.breathe(t)` escala ~1 ± 1,5% · `H.M.draw(t, at, dur)` 0..1 para traços se desenhando · `H.M.check(ctx,x,y,s,p)` / `H.M.cross(ctx,x,y,s,p)` · `H.M.fit(ctx, texto, size, maxW)` · cores `H.M.OK` / `H.M.BAD`.

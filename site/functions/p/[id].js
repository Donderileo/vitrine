// /p/12 → redireciona para o link de afiliado do produto #12 (e conta o clique, se o KV estiver ligado).
export async function onRequest({ params, env, request }) {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new URL("/products.json", url));
  const list = res.ok ? await res.json() : [];
  const p = list.find((x) => String(x.num) === String(params.id));
  if (!p || !p.link) return Response.redirect(new URL(`/?p=${encodeURIComponent(params.id)}`, url), 302);
  if (env.CLICKS) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `c:${p.num}:${day}`;
    const n = parseInt((await env.CLICKS.get(key)) || "0", 10) + 1;
    await env.CLICKS.put(key, String(n));
  }
  return Response.redirect(p.link, 302);
}

"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Carousel, Product } from "@/src/core/carousel/types";

type View = { carousel: Carousel; caption: string; links: string; keys: { fal: boolean; claude: boolean } };

const j = (method: string, body?: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const money = (usd: number) => `US$ ${usd.toFixed(3)}`;

export default function CarouselEditor({ id }: { id: string }) {
  const [c, setC] = useState<Carousel | null>(null);
  const [caption, setCaption] = useState("");
  const [links, setLinks] = useState("");
  const [keys, setKeys] = useState({ fal: false, claude: false });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState("");
  const ref = useRef<Carousel | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  ref.current = c;

  const apply = (v: View) => { setC(v.carousel); setCaption(v.caption); setLinks(v.links); setKeys(v.keys); };
  useEffect(() => { fetch(`/api/carousels/${id}`).then((r) => r.json()).then(apply); }, [id]);

  const save = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const cur = ref.current; if (!cur) return;
    setSaved("salvando…");
    const r = await fetch(`/api/carousels/${id}`, j("PUT", cur));
    if (!r.ok) return setSaved("erro ao salvar");
    const v: View = await r.json();
    setCaption(v.caption); setLinks(v.links); setSaved("salvo ✓");
  }, [id]);

  const edit = (fn: (c: Carousel) => Carousel) => {
    setC((prev) => (prev ? fn(prev) : prev));
    setSaved("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  };
  const setP = (pid: string, patch: Partial<Product>) => edit((x) => ({ ...x, products: x.products.map((p) => (p.id === pid ? { ...p, ...patch } : p)) }));
  const move = (i: number, d: number) => edit((x) => { const a = [...x.products]; const k = i + d; if (k < 0 || k >= a.length) return x; [a[i], a[k]] = [a[k], a[i]]; return { ...x, products: a }; });

  async function importCsv(text: string) {
    if (!text.trim()) return;
    setBusy("import"); setMsg(""); await save();
    const r = await fetch(`/api/carousels/${id}/import`, j("POST", { csv: text }));
    const d = await r.json();
    setBusy("");
    if (!r.ok) return setMsg(d.error || "erro ao importar");
    setC(d.carousel); setCsv("");
    setMsg(`${d.added} produto(s) importado(s)${d.skipped ? ` · ${d.skipped} já estavam na lista` : ""}${d.warnings?.length ? ` · ${d.warnings.join(" ")}` : ""}`);
  }

  async function upload(pid: string, file: File) {
    const fd = new FormData(); fd.set("productId", pid); fd.set("file", file);
    const r = await fetch(`/api/carousels/${id}/photo`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || "erro ao subir a foto");
    const sv: Carousel = d.carousel; // take only photo/cut from the server: don't clobber text typed meanwhile
    setC((prev) => prev && { ...prev, products: prev.products.map((p) => { const s = sv.products.find((x) => x.id === p.id); return s && p.id === pid ? { ...p, photo: s.photo, cut: s.cut } : p; }) });
  }

  async function bulk(files: FileList | null) {
    if (!files || !c) return;
    await save();
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const targets = c.products.filter((p) => !p.photo);
    setBusy("photos");
    for (let i = 0; i < Math.min(list.length, targets.length); i++) await upload(targets[i].id, list[i]);
    setBusy("");
    setMsg(list.length > targets.length ? `${list.length - targets.length} foto(s) sobraram: só os produtos sem foto recebem.` : `${Math.min(list.length, targets.length)} foto(s) atribuída(s) na ordem dos nomes dos arquivos.`);
  }

  async function run(kind: "copy" | "render") {
    setBusy(kind); setMsg(""); await save();
    const r = await fetch(`/api/carousels/${id}/${kind}`, j("POST"));
    const d = await r.json().catch(() => ({ error: "resposta inválida" }));
    setBusy("");
    if (!r.ok) return setMsg(d.error || "erro");
    setC(d.carousel); setCaption(d.caption); setLinks(d.links);
    const warn = (d.logs as string[] | undefined)?.filter((l) => /falhou|não configurada|automática/.test(l)) ?? [];
    setMsg(warn.length ? warn.join(" · ") : kind === "copy" ? "Textos prontos — confira nomes, capa e legenda." : "Slides prontos.");
  }

  if (!c) return <div className="card muted">Carregando…</div>;
  const photos = c.products.filter((p) => p.photo).length;
  const cutsNeeded = c.products.filter((p) => p.photo && p.useCut && !p.cut).length;
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => setMsg("copiado ✓"));
  const file = (rel: string) => `/api/files/${rel.split("/").map(encodeURIComponent).join("/")}`;

  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <Link href="/carousel" className="muted" style={{ textDecoration: "none" }}>← carrosséis</Link>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>{saved}{c.costUsd ? ` · gasto: ${money(c.costUsd)}` : ""}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "380px 1fr" }}>
        <div className="stack">
          <div className="card">
            <h2>Lista</h2>
            <label>Tema (título da capa)</label>
            <input type="text" value={c.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
            <label>Chamada final</label>
            <select value={c.cta} onChange={(e) => edit((x) => ({ ...x, cta: e.target.value as Carousel["cta"] }))}>
              <option value="bio">Links na bio</option>
              <option value="comentar">Comentar a palavra (Instagram/ManyChat)</option>
              <option value="ambos">Os dois</option>
            </select>
            {c.cta !== "bio" && (<><label>Palavra para comentar</label>
              <input type="text" value={c.keyword} onChange={(e) => edit((x) => ({ ...x, keyword: e.target.value }))} /></>)}
            <label>Formato</label>
            <select value={c.format} onChange={(e) => edit((x) => ({ ...x, format: e.target.value as Carousel["format"] }))}>
              <option value="9x16">9:16 — TikTok (1080×1920)</option>
              <option value="4x5">4:5 — Instagram feed (1080×1350)</option>
            </select>
            <label className="check"><input type="checkbox" checked={c.priceFrom} onChange={(e) => edit((x) => ({ ...x, priceFrom: e.target.checked }))} /> Preço como “a partir de” (promoção e cupom mudam o valor)</label>
            <label className="check"><input type="checkbox" checked={c.publi} onChange={(e) => edit((x) => ({ ...x, publi: e.target.checked }))} /> Marcar #publi na legenda (recomendado: você ganha comissão)</label>
          </div>

          <div className="card">
            <h2>1. Produtos</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Cole o CSV do afiliado Shopee (“Batch Product Links”) ou escolha o arquivo. Vem nome, preço e o <b>Offer Link</b> (seu link de afiliado).
            </p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Item Id,Item Name,Price,…" style={{ minHeight: 70 }} />
            <div className="actions" style={{ marginTop: 8 }}>
              <button disabled={busy === "import" || !csv.trim()} onClick={() => importCsv(csv)}>Importar texto</button>
              <label className="btn" style={{ margin: 0, color: "var(--ink)" }}>
                Escolher arquivo .csv
                <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importCsv(await f.text()); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          <div className="card">
            <h2>3. Gerar</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Primeiro os textos (Claude escreve nomes curtos, capa e legenda: ~US$ 0,01), depois os slides
              {cutsNeeded ? ` (recorta o fundo de ${cutsNeeded} foto(s): ~US$ ${(cutsNeeded * 0.005).toFixed(3)})` : ""}.
            </p>
            {!keys.fal && <p className="muted" style={{ fontSize: 13, color: "var(--warn)" }}>Sem FAL_KEY no .env: o recorte de fundo é pulado e a foto original vai num cartão.</p>}
            {!keys.claude && <p className="muted" style={{ fontSize: 13, color: "var(--warn)" }}>Claude não configurado: nomes e textos saem no modo automático simples.</p>}
            <div className="actions">
              <button disabled={!!busy || !c.products.length} onClick={() => run("copy")}>{busy === "copy" ? "escrevendo…" : "Escrever textos"}</button>
              <button className="primary" style={{ width: "auto", marginTop: 0 }} disabled={!!busy || !c.products.length} onClick={() => run("render")}>{busy === "render" ? "gerando slides…" : "Gerar slides"}</button>
            </div>
            {msg && <p style={{ fontSize: 13, marginBottom: 0 }}>{msg}</p>}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              2. Fotos e dados <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>{photos}/{c.products.length} com foto</span>
            </h2>
            {c.products.length === 0 && <p className="muted">Importe o CSV para ver os produtos aqui.</p>}
            {c.products.length > 0 && (
              <label className="btn" style={{ margin: "0 0 10px", color: "var(--ink)" }}>
                {busy === "photos" ? "subindo…" : "Subir várias fotos de uma vez"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { bulk(e.target.files); e.target.value = ""; }} />
              </label>
            )}
            {c.products.length > 0 && <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>As fotos vão para os produtos sem foto, na ordem dos nomes dos arquivos (1.jpg, 2.jpg…).</p>}
            {c.products.map((p, i) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <div>
                  <label className="btn" style={{ width: 96, height: 96, margin: 0, padding: 0, overflow: "hidden", color: "var(--muted)", fontSize: 12, textAlign: "center", position: "relative" }}>
                    {p.photo ? <img src={file(`carousels/${c.id}/photos/${p.photo}`)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "+ foto"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setBusy("photos"); await upload(p.id, f); setBusy(""); } e.target.value = ""; }} />
                  </label>
                  <div style={{ fontSize: 11, marginTop: 4, color: "var(--muted)", textAlign: "center" }}>{p.cut && p.useCut ? "recortada ✓" : ""}</div>
                </div>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b style={{ minWidth: 22 }}>{i + 1}</b>
                    <input type="text" value={p.short} placeholder="nome curto" onChange={(e) => setP(p.id, { short: e.target.value })} style={{ flex: 2 }} />
                    <input type="text" value={p.tag} placeholder="categoria" onChange={(e) => setP(p.id, { tag: e.target.value })} style={{ flex: 1 }} />
                    <input type="text" value={p.price} placeholder="preço" onChange={(e) => setP(p.id, { price: e.target.value })} style={{ width: 90, flex: "none" }} />
                    <button type="button" className="link" title="subir" onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="link" title="descer" onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="link" title="remover" onClick={() => edit((x) => ({ ...x, products: x.products.filter((q) => q.id !== p.id) }))}>✕</button>
                  </div>
                  <input type="text" value={p.link} placeholder="link de afiliado" onChange={(e) => setP(p.id, { link: e.target.value })} style={{ marginTop: 6, fontSize: 13 }} />
                  {p.link && !/s\.shopee\./.test(p.link) && <div style={{ fontSize: 12, color: "var(--warn)" }}>Esse não parece o link curto de afiliado (s.shopee.com.br/…): confira o Offer Link.</div>}
                  <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                    <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={p.useCut} onChange={(e) => setP(p.id, { useCut: e.target.checked })} /> recortar fundo</label>
                    <select value={p.place} onChange={(e) => setP(p.id, { place: e.target.value as Product["place"] })} style={{ width: "auto", padding: "3px 8px" }}>
                      <option value="floor">apoiado no chão</option>
                      <option value="float">flutuando (cortina, tapete, luminária…)</option>
                    </select>
                    <span>{[p.store, p.commission && `comissão ${p.commission}`, p.sales && `${p.sales} vendas`].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</div>
                </div>
              </div>
            ))}
          </div>

          {c.copy && (
            <div className="card">
              <h2>Capa e legenda</h2>
              <div className="row">
                <div><label>Título da capa</label><input type="text" value={c.copy.coverTitle} onChange={(e) => edit((x) => ({ ...x, copy: { ...x.copy!, coverTitle: e.target.value } }))} /></div>
                <div><label>Linha sob o título</label><input type="text" value={c.copy.coverSub} onChange={(e) => edit((x) => ({ ...x, copy: { ...x.copy!, coverSub: e.target.value } }))} /></div>
              </div>
              <label>Introdução da legenda</label>
              <textarea value={c.copy.intro} onChange={(e) => edit((x) => ({ ...x, copy: { ...x.copy!, intro: e.target.value } }))} style={{ minHeight: 60 }} />
              <label>Hashtags</label>
              <input type="text" value={c.copy.hashtags.join(" ")} onChange={(e) => edit((x) => ({ ...x, copy: { ...x.copy!, hashtags: e.target.value.split(/\s+/).filter(Boolean) } }))} />
            </div>
          )}

          {c.slides.length > 0 && (
            <div className="card">
              <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Slides prontos
                <a className="btn" href={`/api/carousels/${c.id}/zip`}>Baixar tudo (.zip)</a>
              </h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                Se mudou algo (nome, preço, ordem, foto), clique em “Gerar slides” de novo. O zip leva as imagens, a legenda e os links.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                {c.slides.map((s) => (
                  <a key={s} href={`${file(s)}?download=1`} title="baixar">
                    <img src={`${file(s)}?t=${c.renderedAt}`} alt="" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", display: "block" }} />
                  </a>
                ))}
              </div>
              <label>Legenda do post <button type="button" style={{ marginLeft: 8, padding: "2px 10px" }} onClick={() => copy(caption)}>copiar</button></label>
              <textarea readOnly value={caption} style={{ minHeight: 190 }} />
              <label>Links numerados (pra bio ou pra resposta do DM) <button type="button" style={{ marginLeft: 8, padding: "2px 10px" }} onClick={() => copy(links)}>copiar</button></label>
              <textarea readOnly value={links} style={{ minHeight: 120 }} />
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>No TikTok, marque a opção de conteúdo promocional ao publicar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

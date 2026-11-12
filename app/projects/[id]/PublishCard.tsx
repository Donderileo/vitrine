"use client";
import { useEffect, useState } from "react";

type Product = { num: number; title: string; price?: string | null; link?: string | null; img: string };

/** Card on the project page: product number + affiliate link → links page (site/public/products.json). */
export default function PublishCard({ id }: { id: string }) {
  const [num, setNum] = useState<number | null>(null);
  const [prod, setProd] = useState<Product | null>(null);
  const [link, setLink] = useState("");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}/publish`).then((r) => r.json()).then((d) => {
      setNum(d.num); setProd(d.product);
      if (d.product) { setLink(d.product.link ?? ""); setPrice(d.product.price ?? ""); }
    });
  }, [id]);

  async function publish() {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/projects/${id}/publish`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link: link.trim(), price: price.trim() }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error); return; }
    setProd(d.product);
    setMsg("Salvo na página. Rode npm run site:deploy para publicar.");
  }

  return (
    <div className="card">
      <h2>Página de links {num && <span className="pill review" style={{ marginLeft: 8 }}>produto #{num}</span>}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        O vídeo termina com &quot;produto #{num ?? "?"}&quot;. Cole o link de afiliado (Linkshare do TikTok Shop) para aparecer na página.
      </p>
      <div className="row">
        <div style={{ flex: 3 }}><label>Link de afiliado</label>
          <input type="url" value={link} placeholder="https://..." onChange={(e) => setLink(e.target.value)} /></div>
        <div><label>Preço (opcional)</label>
          <input type="text" value={price} placeholder="R$ 89,90" onChange={(e) => setPrice(e.target.value)} /></div>
      </div>
      <div className="actions" style={{ marginTop: 12, alignItems: "center" }}>
        <button onClick={publish} disabled={busy}>{prod ? "Atualizar na página" : "Adicionar à página"}</button>
        {prod && <span className="muted" style={{ fontSize: 13 }}>{prod.link ? "✓ publicado com link" : "na página, sem link ainda"}</span>}
      </div>
      {msg && <p className="muted" style={{ fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

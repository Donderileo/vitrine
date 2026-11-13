"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewCarousel() {
  const r = useRouter();
  const [title, setTitle] = useState("Minha lista Shopee");
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const res = await fetch("/api/carousels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    const d = await res.json();
    r.push(`/carousel/${d.id}`);
  }
  return (
    <>
      <label>Tema da lista (vira o título da capa)</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Achados Shopee pra sala de jantar" />
      <button className="primary" disabled={busy || !title.trim()} onClick={create}>{busy ? "criando…" : "Criar carrossel"}</button>
    </>
  );
}

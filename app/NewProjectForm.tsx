"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [kind, setKind] = useState<"ad" | "explainer" | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/projects", { method: "POST", body: new FormData(e.currentTarget) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setBusy(false); return; }
    router.push(`/projects/${data.id}`);
  }

  if (!kind) return (
    <div className="stack" style={{ gap: 10 }}>
      <button className="choice" onClick={() => setKind("ad")}>
        <b>🛍️ Vídeo de anúncio</b><span>Sobe as imagens do produto e sai o vídeo com link pro carrinho.</span>
      </button>
      <button className="choice" onClick={() => setKind("explainer")}>
        <b>💡 Vídeo explicativo</b><span>Dá um tema de decoração/arquitetura e sai uma animação narrada.</span>
      </button>
    </div>
  );

  const back = <button type="button" className="link" onClick={() => setKind(null)}>← trocar tipo</button>;

  if (kind === "explainer") return (
    <form onSubmit={submit}>
      {back}
      <input type="hidden" name="kind" value="explainer" />
      <label>Tema</label>
      <input type="text" name="name" required placeholder="A regra 60-30-10 das cores" />
      <label>Observações (opcional: ângulo, exemplo, o que não pode faltar)</label>
      <textarea name="description" placeholder="Mostrar numa sala de estar; terminar com antes × depois" />
      <div className="row">
        <div><label>Série</label><input type="text" name="series" placeholder="Regra de arquiteto #2" /></div>
        <div><label>Idioma</label>
          <select name="language" defaultValue="pt-BR"><option value="pt-BR">Português (Brasil)</option><option value="es-ES">Español</option><option value="en-GB">English</option></select>
        </div>
      </div>
      <label className="check"><input type="checkbox" name="reviewScript" defaultChecked /> Revisar narração antes de gerar</label>
      {error && <p className="err">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Enviando…" : "Criar vídeo explicativo"}</button>
    </form>
  );

  return (
    <form onSubmit={submit}>
      {back}
      <input type="hidden" name="kind" value="ad" />
      <label>Nome do produto</label>
      <input type="text" name="name" required placeholder="Luminária de mesa em madeira" />
      <label>Descrição real (material, cor, tamanho, o que faz)</label>
      <textarea name="description" required placeholder="Cúpula de tecido bege, base de madeira, 35 cm, luz quente, bivolt" />
      <div className="row">
        <div><label>Preço</label><input type="text" name="priceText" placeholder="R$ 59,90" /></div>
        <div><label>Variações</label>
          <select name="variations" defaultValue="2">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
        </div>
      </div>
      <label>Modo</label>
      <select name="mode" defaultValue="template">
        <option value="template">Template animado — usa as imagens do anúncio (grátis)</option>
        <option value="ai">IA generativa — cenas e vídeo com fal.ai (pago)</option>
      </select>
      <label>Link do produto (opcional)</label>
      <input type="url" name="productUrl" placeholder="https://..." />
      <label>Idioma do vídeo</label>
      <select name="language" defaultValue="pt-BR">
        <option value="pt-BR">Português (Brasil)</option>
        <option value="es-ES">Español</option>
        <option value="de-DE">Deutsch</option>
        <option value="it-IT">Italiano</option>
        <option value="fr-FR">Français</option>
        <option value="en-GB">English (UK)</option>
      </select>
      <label>Imagens do produto/anúncio (todas as do anúncio ajudam)</label>
      <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required
        onChange={(e) => setPreviews(Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)))} />
      {previews.length > 0 && (
        <div className="thumbs" style={{ marginTop: 8 }}>
          {previews.map((p) => <img key={p} src={p} alt="" style={{ aspectRatio: "1" }} />)}
        </div>
      )}
      <label className="check"><input type="checkbox" name="reviewScript" defaultChecked /> Revisar roteiro antes de gerar (economiza API)</label>
      {error && <p className="err">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Enviando…" : "Gerar vídeos"}</button>
    </form>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import type { Script } from "@/src/core/types";
import type { TStoryboard } from "@/src/core/template/storyboard";
import StoryboardReview from "./StoryboardReview";
import ExplainerReview from "./ExplainerReview";
import type { TExplainerPlan } from "@/src/core/explainer/schema";
import PublishCard from "./PublishCard";

type Data = {
  id: string; name: string; status: string; stage: string | null; error: string | null;
  input: { description: string; language: string; variations: number; photos: string[] };
  script?: Script;
  storyboard?: TStoryboard;
  mode: string;
  scenes: Record<string, { image?: string; clip?: string }>;
  outputs: Record<string, string>;
  costs: { total: number; byStage: { stage: string; usd: number }[]; items: { stage: string; provider: string; usd: number; note: string | null }[]; usdBrl: number };
  kind: "ad" | "explainer";
  explainer: { plan?: TExplainerPlan; qa: string[]; voice: { speed: number; stability: number }; duration: number | null } | null;
  targetSeconds: number;
  extras: { cover?: string; description: string; coverTitle: string } | null;
  logs: { ts: number; msg: string }[];
};

const STATUS: Record<string, string> = {
  queued: "na fila", running: "gerando", done: "pronto", error: "erro", review: "revisar roteiro",
};

export default function ProjectView({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Script | null>(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (d?.status === "review" && d.script && !d.storyboard && !d.explainer && !draft) setDraft(structuredClone(d.script));
  }, [d, draft]);

  if (!d) return <p className="muted">Carregando…</p>;

  async function post(path: string, body: unknown) {
    setMsg("");
    const r = await fetch(`/api/projects/${id}/${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    if (!r.ok) setMsg((await r.json()).error ?? "erro");
    setDraft(null);
    load();
  }

  const edit = (vi: number, fn: (v: Script["variations"][number]) => void) => {
    if (!draft) return;
    const next = structuredClone(draft);
    fn(next.variations[vi]);
    setDraft(next);
  };

  const images = Object.entries(d.scenes).filter(([, s]) => s.image).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{d.name}</h2>
          <span className={`pill ${d.status}`}>{STATUS[d.status] ?? d.status}{d.status === "running" && d.stage ? ` · ${d.stage}` : ""}</span>
        </div>
        <p className="muted" style={{ margin: "8px 0 0" }}>{d.input.description}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          Custo deste vídeo: <b>US$ {d.costs.total.toFixed(3)}</b>
          {d.costs.usdBrl > 0 && <b> · R$ {(d.costs.total * d.costs.usdBrl).toFixed(2)}</b>}
          <span className="muted"> · {d.kind === "explainer" ? "explicativo" : d.mode === "ai" ? "anúncio · IA generativa" : "anúncio · template animado"}</span>
        </p>
        {d.costs.items.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary className="muted" style={{ fontSize: 13, cursor: "pointer" }}>ver custo por etapa</summary>
            <table className="costs"><tbody>
              {d.costs.items.map((c, i) => (
                <tr key={i}><td>{c.stage}</td><td className="muted">{c.provider}{c.note ? ` · ${c.note}` : ""}</td><td>US$ {c.usd.toFixed(4)}</td></tr>
              ))}
            </tbody></table>
          </details>
        )}
        {(d.status === "running" || d.status === "queued") && (() => {
          const last = d.logs[0]?.ts ?? 0, ago = last ? Math.max(0, Math.round((now - last) / 1000)) : null;
          return (
            <div className="activity">
              <span className="spinner" />
              <span>
                {d.status === "queued" ? "Na fila — esperando o worker" : (d.logs[0]?.msg ?? d.stage ?? "trabalhando…")}
                {ago !== null && <span className="muted"> · há {ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)}min ${ago % 60}s`}</span>}
              </span>
              {d.status === "queued" && ago !== null && ago > 15 && <span className="muted"> (o <code>npm run worker</code> está rodando?)</span>}
              {d.status === "running" && ago !== null && ago > 120 && <span className="err"> sem novidades há um tempo — confira o terminal do worker</span>}
            </div>
          );
        })()}
        {d.error && <p className="err">Erro: {d.error}</p>}
        <div className="actions" style={{ marginTop: 12 }}>
          {d.status === "error" && <button onClick={() => post("retry", {})}>Retomar de onde parou</button>}
          {d.status === "done" && <button onClick={() => post("retry", { redo: "outputs" })}>{d.kind === "explainer" ? "Renderizar de novo (grátis)" : "Remontar vídeos (grátis)"}</button>}
          {(d.status === "done" || d.status === "error") && d.kind === "explainer" && (
            <button title="Mesmo roteiro e mesma voz; o Claude escreve a animação de novo com as regras atuais"
              onClick={() => confirm("Refazer só a animação? Mantém roteiro e voz (custa ~US$0,10–0,20 de Claude).") && post("retry", { redo: "film" })}>Refazer animação (~US$0,15)</button>
          )}

          {d.status === "done" && (d.storyboard || d.explainer?.plan) && <button onClick={() => post("edit", {})}>{d.kind === "explainer" ? "Editar narração" : "Editar textos"}</button>}
          {(d.status === "done" || d.status === "error") && (
            <button onClick={() => confirm("Gerar tudo de novo? Isso cobra as APIs novamente.") && post("retry", { reset: true })}>Gerar do zero</button>
          )}
        </div>
        {msg && <p className="err">{msg}</p>}
        {(d.status === "done" || d.status === "error") && d.kind === "explainer" && d.explainer?.plan && (
          <VoiceRedo key={d.id + (d.explainer.duration ?? "")} voice={d.explainer.voice} duration={d.explainer.duration}
            onRedo={(v) => post("retry", { redo: "narration", ...v })} />
        )}
      </div>

      {Object.keys(d.outputs).length > 0 && (
        <div className="card">
          <h2>Vídeos</h2>
          <div className="videos">
            {Object.entries(d.outputs).map(([k, url]) => (
              <div key={k}>
                <video src={url} controls playsInline preload="metadata" />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
                  <span>{d.kind === "explainer" ? d.explainer?.plan?.title : `V${Number(k) + 1} · ${(d.storyboard ?? d.script)?.variations[Number(k)]?.angle ?? ""}`}</span>
                  <a href={`${url}?download`}>baixar</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.status === "done" && (d.extras ? (
        <div className="card">
          <h2>Capa e descrição do post</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {d.extras.cover && (
              <div style={{ width: 200 }}>
                <img src={d.extras.cover} alt="capa" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)" }} />
                <a href={`${d.extras.cover}?download`} style={{ fontSize: 13 }}>baixar capa</a>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 260 }}>
              <textarea readOnly value={d.extras.description} style={{ minHeight: 170 }} />
              <div className="actions" style={{ marginTop: 8 }}>
                <button onClick={() => { navigator.clipboard.writeText(d.extras!.description); setMsg("Descrição copiada ✔"); }}>Copiar descrição</button>
                <button onClick={() => post("retry", { redo: "extras" })}>Gerar outra versão (~US$0,005)</button>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>No TikTok: ao postar, toque em "Editar capa" → "Carregar" e escolha a capa.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card"><h2>Capa e descrição do post</h2>
          <button onClick={() => post("retry", { redo: "extras" })}>Gerar capa e descrição (~US$0,005)</button></div>
      ))}

      {d.status === "done" && d.kind !== "explainer" && <PublishCard id={d.id} />}

      {d.status === "review" && d.explainer?.plan && (
        <ExplainerReview initial={d.explainer.plan} target={d.targetSeconds} onApprove={(plan) => post("approve", { explainer: plan })} />
      )}

      {d.status === "review" && d.storyboard && !d.explainer && (
        <StoryboardReview initial={d.storyboard} onApprove={(sb) => post("approve", { storyboard: sb })} />
      )}

      {d.status === "review" && draft && !d.storyboard && !d.explainer && (
        <div className="card">
          <h2>Revise o roteiro</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Ajuste o que quiser. Confira se nada promete algo que o produto não tem. Ao aprovar, as imagens e vídeos começam a ser gerados (e cobrados).
          </p>
          {draft.variations.map((v, vi) => (
            <div key={vi} className="variation">
              <b>V{vi + 1} · {v.angle}</b>
              <label>Gancho (texto no topo, 2s iniciais)</label>
              <input type="text" value={v.hook} onChange={(e) => edit(vi, (x) => (x.hook = e.target.value))} />
              {v.scenes.map((s, si) => (
                <div key={si} className="row">
                  <div><label>Cena {si + 1} · legenda</label>
                    <input type="text" value={s.caption} onChange={(e) => edit(vi, (x) => (x.scenes[si].caption = e.target.value))} /></div>
                  <div style={{ flex: 2 }}><label>Cena {si + 1} · ambiente (prompt)</label>
                    <input type="text" value={s.imagePrompt} onChange={(e) => edit(vi, (x) => (x.scenes[si].imagePrompt = e.target.value))} /></div>
                </div>
              ))}
              <label>Narração</label>
              <textarea value={v.voiceover} onChange={(e) => edit(vi, (x) => (x.voiceover = e.target.value))} />
              <label>CTA</label>
              <input type="text" value={v.cta} onChange={(e) => edit(vi, (x) => (x.cta = e.target.value))} />
            </div>
          ))}
          <button className="primary" onClick={() => post("approve", { script: draft })}>Aprovar e gerar vídeos</button>
        </div>
      )}

      {images.length > 0 && (
        <div className="card">
          <h2>Cenas geradas</h2>
          <div className="thumbs">{images.map(([k, s]) => <img key={k} src={s.image} alt={k} title={k} />)}</div>
        </div>
      )}

      <div className="card">
        <h2>Log</h2>
        <div className="log">
          {d.logs.map((l, i) => <div key={i}><span className="muted">{new Date(l.ts).toLocaleTimeString("pt-BR")}</span> {l.msg}</div>)}
          {d.logs.length === 0 && <span className="muted">Aguardando o worker… (rode <code>npm run worker</code>)</span>}
        </div>
      </div>
    </div>
  );
}

/** Redo only the voice (ElevenLabs) with a different speed/intonation; the animation re-times itself. */
function VoiceRedo({ voice, duration, onRedo }: { voice: { speed: number; stability: number }; duration: number | null; onRedo: (v: { speed: number; stability: number }) => void }) {
  const [speed, setSpeed] = useState(voice.speed);
  const [stability, setStability] = useState(voice.stability);
  const est = duration ? Math.round((duration * voice.speed) / speed) : null;
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Ajustar a voz e refazer a narração</summary>
      <div className="row" style={{ marginTop: 8 }}>
        <div>
          <label>Velocidade: <b>{speed.toFixed(2)}×</b> {est && <span className="muted">(vídeo ≈ {est}s)</span>}</label>
          <input type="range" min={0.7} max={1.2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: "100%" }} />
          <small className="muted">0,7 lento · 1,0 normal · 1,2 rápido</small>
        </div>
        <div>
          <label>Entonação: <b>{stability < 0.45 ? "expressiva" : stability < 0.7 ? "natural" : "contida"}</b> ({stability.toFixed(2)})</label>
          <input type="range" min={0.3} max={0.9} step={0.05} value={stability} onChange={(e) => setStability(Number(e.target.value))} style={{ width: "100%" }} />
          <small className="muted">mais à direita = menos exagero nas palavras</small>
        </div>
      </div>
      <button style={{ marginTop: 10 }} onClick={() => onRedo({ speed, stability })}>Refazer só a narração (~US$0,08, animação reaproveitada)</button>
    </details>
  );
}

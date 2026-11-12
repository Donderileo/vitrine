"use client";
import { useState } from "react";
import type { TExplainerPlan } from "@/src/core/explainer/schema";

const COMPONENTS: [string, string][] = [
  ["keyword", "palavra-chave"], ["counter", "número contando"], ["meter", "barra %"], ["ruler", "régua/medida"], ["checklist", "item de lista ✓"],
  ["compare", "antes × depois"], ["strike", "riscado"], ["question", "? gigante"], ["arrow", "seta"], ["circle", "círculo"], ["stars", "estrelas"],
  ["price", "preço"], ["ring", "anel %"], ["wipe", "troca de assunto"], ["cta", "cartela final"], ["desenho", "movimento do desenho"],
];

/** Review the narration before paying for voice + animation. What's written here is exactly what will be spoken. */
export default function ExplainerReview({ initial, onApprove, target = 40 }: { initial: TExplainerPlan; onApprove: (p: TExplainerPlan) => void; target?: number }) {
  const [p, setP] = useState<TExplainerPlan>(() => structuredClone(initial));
  const set = (fn: (x: TExplainerPlan) => void) => setP((prev) => { const n = structuredClone(prev); fn(n); return n; });
  const words = p.scenes.reduce((a, s) => a + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const chars = p.scenes.reduce((a, s) => a + s.narration.length, 0);
  return (
    <div className="card">
      <h2>Revise a narração</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        O texto de cada cena é exatamente o que a voz vai falar: <b style={{ color: words / 2.6 > target + 6 ? "var(--err)" : undefined }}>~{Math.round(words / 2.6 + p.scenes.length * 0.3)}s</b> (alvo {target}s) · {p.scenes.length} cenas · {chars} caracteres no ElevenLabs.
        Para citar o perfil use <code>{"{HANDLE}"}</code>: aparece escrito na tela e a voz fala a pronúncia.
        Confira os fatos: vídeo explicativo errado custa credibilidade.
      </p>
      <div className="row">
        <div><label>Título</label><input type="text" value={p.title} onChange={(e) => set((x) => { x.title = e.target.value; })} /></div>
        <div><label>Série</label><input type="text" value={p.series} onChange={(e) => set((x) => { x.series = e.target.value; })} /></div>
      </div>
      {p.scenes.map((s, i) => (
        <div key={i} className="variation" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>Cena {i + 1}{i === 0 ? " · gancho" : i === p.scenes.length - 1 ? " · final" : ""}</b>
            {p.scenes.length > 3 && <button type="button" className="link" onClick={() => set((x) => { x.scenes.splice(i, 1); })}>remover</button>}
          </div>
          <label>Narração</label>
          <textarea style={{ minHeight: 60 }} value={s.narration} onChange={(e) => set((x) => { x.scenes[i].narration = e.target.value; })} />
          <div className="row">
            <div><label>Título na tela</label><input type="text" value={s.onScreen} onChange={(e) => set((x) => { x.scenes[i].onScreen = e.target.value; })} /></div>
            <div style={{ flex: 2 }}><label>O que desenhar</label><input type="text" value={s.visual} onChange={(e) => set((x) => { x.scenes[i].visual = e.target.value; })} /></div>
          </div>
          <label>Motion (quando a voz fala a palavra → o que entra na tela)</label>
          {(s.beats ?? []).map((b, k) => {
            const ok = !b.word || s.narration.toLowerCase().includes(b.word.toLowerCase());
            return (
              <div key={k} className="row" style={{ alignItems: "center", marginTop: 6 }}>
                <input type="text" value={b.word} placeholder="palavra" title={ok ? "" : "essa palavra não está na narração"} style={{ flex: 1, borderColor: ok ? undefined : "var(--err)" }}
                  onChange={(e) => set((x) => { x.scenes[i].beats![k].word = e.target.value; })} />
                <select value={b.component} style={{ flex: 1 }} onChange={(e) => set((x) => { x.scenes[i].beats![k].component = e.target.value; })}>
                  {!COMPONENTS.some(([c]) => c === b.component) && <option value={b.component}>{b.component}</option>}
                  {COMPONENTS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
                <input type="text" value={b.text} placeholder="texto na tela" style={{ flex: 1.4 }} onChange={(e) => set((x) => { x.scenes[i].beats![k].text = e.target.value; })} />
                <button type="button" className="link" style={{ flex: "none" }} onClick={() => set((x) => { x.scenes[i].beats!.splice(k, 1); })}>✕</button>
              </div>
            );
          })}
          {(s.beats?.length ?? 0) < 4 && <button type="button" className="link" style={{ marginTop: 6 }} onClick={() => set((x) => { (x.scenes[i].beats ??= []).push({ word: "", component: "keyword", text: "" }); })}>+ motion</button>}
        </div>
      ))}
      <div className="variation" style={{ marginTop: 14 }}>
        <b>Chamada final</b>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>O roteiro escolhe pelo tema. Se trocar aqui, ajuste também a narração da última cena.</p>
        <div className="row">
          <div>
            <label>Tipo</label>
            <select value={p.cta?.type ?? "salvar"} onChange={(e) => set((x) => { x.cta = { text: x.cta?.text ?? "", type: e.target.value as NonNullable<TExplainerPlan["cta"]>["type"] }; })}>
              <option value="salvar">Salvar (dica de referência)</option>
              <option value="comentar">Comentar (pergunta, escolha)</option>
              <option value="compartilhar">Compartilhar (manda pra alguém)</option>
              <option value="seguir">Seguir (série com continuação)</option>
            </select>
          </div>
          <div style={{ flex: 2 }}><label>Texto da cartela</label><input type="text" value={p.cta?.text ?? ""} placeholder="ex.: COMENTA: A OU B?" onChange={(e) => set((x) => { x.cta = { type: x.cta?.type ?? "salvar", text: e.target.value }; })} /></div>
        </div>
      </div>
      <button className="primary" onClick={() => onApprove(p)}>Aprovar e gerar vídeo</button>
    </div>
  );
}

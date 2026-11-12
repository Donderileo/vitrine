"use client";
import { useState } from "react";
import type { TExplainerPlan } from "@/src/core/explainer/schema";

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
        </div>
      ))}
      <button className="primary" onClick={() => onApprove(p)}>Aprovar e gerar vídeo</button>
    </div>
  );
}

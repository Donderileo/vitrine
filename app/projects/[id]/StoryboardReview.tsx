"use client";
import { useState } from "react";
import type { TStoryboard, TSceneType } from "@/src/core/template/storyboard";

const SCENE_LABEL: Record<TSceneType, string> = {
  hook: "Gancho", measure: "Medida", items: "Itens inclusos", details: "Detalhes", showcase: "Imagem extra", final: "Final (CTA)",
};

/** Edit the texts Claude planned before rendering. Rendering is free, but a bad hook wastes a post. */
export default function StoryboardReview({ initial, onApprove }: { initial: TStoryboard; onApprove: (sb: TStoryboard) => void }) {
  const [sb, setSb] = useState<TStoryboard>(() => structuredClone(initial));
  const set = (fn: (x: TStoryboard) => void) => setSb((prev) => { const n = structuredClone(prev); fn(n); return n; });
  const available = (s: TSceneType) =>
    s === "hook" || s === "final" || s === "showcase" ||
    (s === "measure" && !!sb.measure) || (s === "items" && !!sb.items) || (s === "details" && (!!sb.details || sb.features.length > 0));

  return (
    <div className="card">
      <h2>Revise o roteiro</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Confira se nenhum texto promete algo que o produto não tem. Renderizar é grátis: dá pra aprovar, ver e ajustar de novo.
      </p>
      <div className="row">
        <div><label>Título (card final)</label><input type="text" value={sb.title} onChange={(e) => set((x) => { x.title = e.target.value; })} /></div>
        <div><label>Subtítulo</label><input type="text" value={sb.subtitle} onChange={(e) => set((x) => { x.subtitle = e.target.value; })} /></div>
      </div>
      <div className="row">
        <div><label>Preço (opcional)</label><input type="text" value={sb.price ?? ""} onChange={(e) => set((x) => { x.price = e.target.value || null; })} /></div>
        <div><label>Estilo</label>
          <select value={sb.theme} onChange={(e) => set((x) => { x.theme = e.target.value as TStoryboard["theme"]; })}>
            <option value="festivo">Festivo (dourado + brilhos)</option>
            <option value="quente">Quente (dourado)</option>
            <option value="clean">Clean (claro)</option>
          </select>
        </div>
      </div>
      <label>Benefícios (um por linha, máx. 3)</label>
      <textarea style={{ minHeight: 70 }} value={sb.features.join("\n")}
        onChange={(e) => set((x) => { x.features = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3); })} />
      {sb.measure && (
        <div className="row">
          <div><label>Medida</label><input type="text" value={sb.measure.value} onChange={(e) => set((x) => { x.measure!.value = Number(e.target.value) || 0; })} /></div>
          <div><label>Unidade</label><input type="text" value={sb.measure.unit} onChange={(e) => set((x) => { x.measure!.unit = e.target.value; })} /></div>
          <div><label>Rótulo</label><input type="text" value={sb.measure.label} onChange={(e) => set((x) => { x.measure!.label = e.target.value; })} /></div>
        </div>
      )}
      {sb.items && (
        <>
          <label>Itens inclusos · título</label>
          <input type="text" value={sb.items.title} onChange={(e) => set((x) => { x.items!.title = e.target.value; })} />
        </>
      )}

      {sb.variations.map((v, vi) => (
        <div key={vi} className="variation" style={{ marginTop: 16 }}>
          <b>V{vi + 1} · {v.angle}</b>
          <div className="row">
            <div><label>Gancho (palavras separadas por |)</label>
              <input type="text" value={v.hookWords.join(" | ")}
                onChange={(e) => set((x) => { x.variations[vi].hookWords = e.target.value.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4); })} /></div>
            <div><label>Frase abaixo do gancho</label>
              <input type="text" value={v.hookSub} onChange={(e) => set((x) => { x.variations[vi].hookSub = e.target.value; })} /></div>
          </div>
          <label>Cenas (ordem)</label>
          <div className="actions">
            {(Object.keys(SCENE_LABEL) as TSceneType[]).filter(available).map((s) => {
              const on = v.scenes.includes(s); const fixed = s === "hook" || s === "final";
              return (
                <label key={s} className="check" style={{ marginTop: 0, opacity: fixed ? 0.6 : 1 }}>
                  <input type="checkbox" checked={on} disabled={fixed}
                    onChange={() => set((x) => {
                      const sc = x.variations[vi].scenes.filter((y) => y !== "final");
                      x.variations[vi].scenes = on ? [...sc.filter((y) => y !== s), "final"] : [...sc, s, "final"];
                    })} />
                  {SCENE_LABEL[s]}
                </label>
              );
            })}
          </div>
          {v.scenes.includes("measure") && (<><label>Legenda da medida</label>
            <input type="text" value={v.captions.measure ?? ""} onChange={(e) => set((x) => { x.variations[vi].captions.measure = e.target.value; })} /></>)}
          {v.scenes.includes("showcase") && (<><label>Legenda da imagem extra</label>
            <input type="text" value={v.captions.showcase ?? ""} onChange={(e) => set((x) => { x.variations[vi].captions.showcase = e.target.value; })} /></>)}
          <label>CTA</label>
          <input type="text" value={v.cta} onChange={(e) => set((x) => { x.variations[vi].cta = e.target.value; })} />
        </div>
      ))}
      <button className="primary" onClick={() => onApprove(sb)}>Aprovar e gerar vídeos</button>
    </div>
  );
}

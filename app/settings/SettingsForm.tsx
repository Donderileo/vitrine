"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/src/core/settings";

type Keys = Record<string, boolean | string>;

export default function SettingsForm() {
  const [s, setS] = useState<Settings | null>(null);
  const [keys, setKeys] = useState<Keys>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => { setS(d.settings); setKeys(d.keys); });
  }, []);
  if (!s) return <div className="card muted">Carregando…</div>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setStatus(""); };
  const setObj = (i: number, patch: Partial<Settings["objects"][number]>) =>
    set("objects", s.objects.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function save(reset = false) {
    if (reset && !confirm("Voltar todas as configurações para o padrão?")) return;
    setStatus("salvando…");
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(reset ? { reset: true } : s) });
    const d = await r.json();
    if (!r.ok) return setStatus("erro ao salvar");
    setS(d.settings); setStatus("salvo ✓");
  }

  const slider = (k: keyof Settings, label: string, min: number, max: number, step: number, hint: string) => (
    <div>
      <label>{label}: <b style={{ color: "var(--ink)" }}>{Number(s[k]).toFixed(2)}</b> <span className="muted">— {hint}</span></label>
      <input type="range" min={min} max={max} step={step} value={Number(s[k])} onChange={(e) => set(k, Number(e.target.value) as never)} style={{ width: "100%" }} />
    </div>
  );
  const color = (k: keyof Settings["brandColors"], label: string) => (
    <div>
      <label>{label}</label>
      <div className="row" style={{ alignItems: "center" }}>
        <input type="color" value={s.brandColors[k]} onChange={(e) => set("brandColors", { ...s.brandColors, [k]: e.target.value })} style={{ flex: "none", width: 44, height: 36, padding: 0, border: 0, background: "none" }} />
        <input type="text" value={s.brandColors[k]} onChange={(e) => set("brandColors", { ...s.brandColors, [k]: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="grid">
      <div className="stack">
        <div className="card">
          <h2>Marca</h2>
          <label>@ do perfil (aparece sempre na tela)</label>
          <input type="text" value={s.brandHandle} onChange={(e) => set("brandHandle", e.target.value)} />
          <label>Como a voz fala o @ (vazio = nunca fala)</label>
          <input type="text" value={s.brandHandleSpoken} onChange={(e) => set("brandHandleSpoken", e.target.value)} />
          <div className="row">{color("bg", "Fundo")}{color("gold", "Destaque")}</div>
          <div className="row">{color("ink", "Texto")}{color("muted", "Texto suave")}</div>
        </div>

        <div className="card">
          <h2>Voz (ElevenLabs)</h2>
          <label>Voice ID (vazio = usa o do .env)</label>
          <input type="text" value={s.elevenVoice} onChange={(e) => set("elevenVoice", e.target.value)} placeholder="ex.: pNInz6obpgDQGcFmaJgB" />
          {slider("elevenSpeed", "Velocidade", 0.7, 1.2, 0.01, "1 = normal")}
          {slider("elevenStability", "Estabilidade", 0, 1, 0.01, "maior = mais calma e constante")}
          {slider("elevenSimilarity", "Similaridade", 0, 1, 0.01, "fidelidade à voz original")}
          {slider("elevenStyle", "Estilo", 0, 1, 0.01, "0 = mais natural; alto exagera a entonação")}
        </div>

        <div className="card">
          <h2>Vídeo explicativo</h2>
          <label>Duração alvo: <b style={{ color: "var(--ink)" }}>{s.explainerSeconds}s</b></label>
          <input type="range" min={15} max={90} step={1} value={s.explainerSeconds} onChange={(e) => set("explainerSeconds", Number(e.target.value))} style={{ width: "100%" }} />
          <label>Música de fundo</label>
          <select value={s.music} onChange={(e) => set("music", e.target.value as Settings["music"])}>
            <option value="lofi">Lofi (padrão)</option>
            <option value="none">Sem música</option>
          </select>
          {s.music !== "none" && slider("musicVolume", "Volume da música", 0, 2, 0.05, "1 = padrão")}
          <label>Nível de motion</label>
          <select value={s.motionLevel} onChange={(e) => set("motionLevel", e.target.value as Settings["motionLevel"])}>
            <option value="intenso">Intenso: algo novo a cada frase (2–4 s)</option>
            <option value="moderado">Moderado: em ~metade das frases</option>
            <option value="leve">Leve: só números e conceitos</option>
          </select>
          <label className="check"><input type="checkbox" checked={s.captions} onChange={(e) => set("captions", e.target.checked)} /> Legenda palavra a palavra embaixo</label>
        </div>

        <div className="card">
          <h2>Chaves de API</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Ficam só no <code>.env</code> (fora do git). Aqui só mostra se estão configuradas.</p>
          {(["ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "FAL_KEY"] as const).map((k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <code>{k}</code><span style={{ color: keys[k] ? "var(--ok)" : "var(--muted)" }}>{keys[k] ? "configurada" : "não configurada"}</span>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Roteiro: <b>{String(keys.llmProvider)}</b> · Voz: <b>{String(keys.ttsProvider)}</b></div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <h2>Objetos com cor fixa</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Identidade visual dos vídeos: sempre que o objeto aparecer, a animação usa esta cor (e a observação). Ex.: sofá verde-oliva de 3 lugares.
          </p>
          {s.objects.map((o, i) => (
            <div key={i} className="row" style={{ alignItems: "center", marginTop: 8 }}>
              <input type="color" value={o.color} onChange={(e) => setObj(i, { color: e.target.value })} style={{ flex: "none", width: 44, height: 36, padding: 0, border: 0, background: "none" }} />
              <input type="text" value={o.name} placeholder="objeto" onChange={(e) => setObj(i, { name: e.target.value })} style={{ flex: 1 }} />
              <input type="text" value={o.note || ""} placeholder="observação (opcional)" onChange={(e) => setObj(i, { note: e.target.value })} style={{ flex: 2 }} />
              <button type="button" className="link" style={{ flex: "none" }} onClick={() => set("objects", s.objects.filter((_, j) => j !== i))} title="remover">✕</button>
            </div>
          ))}
          <button type="button" style={{ marginTop: 10 }} onClick={() => set("objects", [...s.objects, { name: "", color: "#888888" }])}>+ objeto</button>
        </div>

        <div className="card">
          <h2>Regras de estilo da animação</h2>
          <textarea value={s.styleNotes} onChange={(e) => set("styleNotes", e.target.value)} style={{ minHeight: 120 }}
            placeholder={"Uma regra por linha. Ex.:\n- cômodos sempre em vista frontal\n- sofá sempre com 2 almofadas terracota\n- traço arredondado, sem contorno preto"} />
          <label>Notas para o roteiro (tom, temas, bordões)</label>
          <textarea value={s.scriptNotes} onChange={(e) => set("scriptNotes", e.target.value)}
            placeholder={"Ex.: falar com quem mora de aluguel; sempre dar uma dica barata; terminar com pergunta"} />
        </div>

        <div className="actions" style={{ alignItems: "center" }}>
          <button className="primary" style={{ width: "auto", marginTop: 0 }} onClick={() => save()}>Salvar</button>
          <button onClick={() => save(true)}>Restaurar padrão</button>
          <span className="muted">{status}</span>
        </div>
      </div>
    </div>
  );
}

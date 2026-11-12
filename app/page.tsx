import Link from "next/link";
import { costs, projects } from "@/src/core/db";
import { config } from "@/src/core/config";
import NewProjectForm from "./NewProjectForm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  queued: "na fila", running: "gerando", done: "pronto", error: "erro", review: "revisar roteiro",
};

export default function Home() {
  const list = projects.list();
  const spent = costs.totals();
  const total = Object.values(spent).reduce((a, b) => a + b, 0);
  const money = (usd: number) => `US$ ${usd.toFixed(usd < 1 ? 3 : 2)}${config.usdBrl > 0 ? ` · R$ ${(usd * config.usdBrl).toFixed(2)}` : ""}`;
  const mock = config.llmProvider === "mock" || config.imageProvider === "mock";
  return (
    <div className="grid">
      <div className="card">
        <h2>Novo vídeo</h2>
        {mock && (
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Modo teste: alguns provedores estão em <b>mock</b> (grátis, sem IA). Configure as chaves no <code>.env</code>.
          </p>
        )}
        <NewProjectForm />
      </div>
      <div className="card">
        <h2 style={{ display: "flex", justifyContent: "space-between" }}>Projetos <span className="muted" style={{ fontWeight: 500 }}>gasto total: {money(total)}</span></h2>
        {list.length === 0 && <p className="muted">Nenhum projeto ainda.</p>}
        <div className="list">
          {list.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="item">
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <small>
                  {p.input.kind === "explainer" ? "explicativo" : "anúncio"} · {new Date(p.created_at).toLocaleString("pt-BR")} · {money(spent[p.id] ?? 0)}
                  {p.status === "running" && p.stage ? ` · ${p.stage}` : ""}
                </small>
              </div>
              <span className={`pill ${p.status}`}>{STATUS[p.status] ?? p.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

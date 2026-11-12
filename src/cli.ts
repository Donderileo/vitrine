// Usage: npm run cli -- --name "Luminária de lua" --desc "..." --photo ./foto.jpg [--photo ./foto2.jpg] [--n 2] [--lang pt-BR]
//   [--mode template|ai] [--storyboard plano.json]  (storyboard pronto pula a chamada ao Claude)
import fs from "node:fs";
import path from "node:path";
import { newId, projects, costs } from "./core/db";
import { projectDir, runProject } from "./core/pipeline";
import { Storyboard } from "./core/template/storyboard";
import { ExplainerPlan } from "./core/explainer/schema";

const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (k: string) => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));

const kind = get("kind") === "explainer" ? "explainer" : "ad";
const name = get("name") ?? get("topic"), desc = get("desc") ?? "", photos = all("photo");
if (!name || (kind === "ad" && (!desc || !photos.length))) {
  console.log('Explicativo: npm run cli -- --kind explainer --topic "A regra 60-30-10" [--series "Regra de arquiteto #1"] [--plan plano.json]');
  console.log('Uso: npm run cli -- --name "Produto" --desc "descrição" --photo foto.jpg [--n 2] [--lang pt-BR] [--price "R$ 49,90"] [--mode template|ai] [--storyboard plano.json]');
  process.exit(1);
}

const id = newId();
const dir = projectDir(id);
fs.mkdirSync(path.join(dir, "photos"), { recursive: true });
const local = photos.map((p, i) => {
  const dest = path.join(dir, "photos", `${i}${path.extname(p) || ".jpg"}`);
  fs.copyFileSync(p, dest);
  return dest;
});

projects.create(id, {
  name, description: desc, language: get("lang") ?? "pt-BR", variations: Number(get("n") ?? 2),
  priceText: get("price"), productUrl: get("url"), photos: local,
  mode: (get("mode") as "template" | "ai" | undefined) ?? undefined,
  kind, series: get("series"),
});
const planFile = get("plan");
if (planFile) {
  const plan = ExplainerPlan.parse(JSON.parse(fs.readFileSync(planFile, "utf8")));
  projects.saveState(id, { scenes: {}, voice: {}, outputs: {}, explainer: { plan, approved: true } });
}
const sbFile = get("storyboard");
if (sbFile) {
  const sb = Storyboard.parse(JSON.parse(fs.readFileSync(sbFile, "utf8")));
  projects.saveState(id, { scenes: {}, voice: {}, outputs: {}, storyboard: sb });
}

runProject(id)
  .then((s) => {
    projects.setStatus(id, "done", { stage: "concluído" });
    console.log("\nVídeos:\n" + Object.values(s.outputs).join("\n"));
    console.log(`Custo estimado: US$ ${costs.summary(id).total.toFixed(2)}`);
  })
  .catch((e) => { projects.setStatus(id, "error", { error: e.message }); console.error(e); process.exit(1); });

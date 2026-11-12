import { projects } from "./core/db";
import { PauseForReview, runProject } from "./core/pipeline";
import { config } from "./core/config";
import { applySettings } from "./core/settings";

const POLL_MS = 2000;

async function main() {
  applySettings();
  const recovered = projects.recoverStale();
  console.log(
    `Worker iniciado. Provedores: llm=${config.llmProvider} imagem=${config.imageProvider} ` +
      `vídeo=${config.videoProvider} voz=${config.ttsProvider}` + (recovered ? ` (${recovered} projeto(s) retomado(s))` : ""),
  );
  for (;;) {
    const p = projects.claimNext();
    if (!p) { await new Promise((r) => setTimeout(r, POLL_MS)); continue; }
    applySettings(); // settings saved in the app apply to the next job
    try {
      await runProject(p.id);
      projects.setStatus(p.id, "done", { stage: "concluído" });
    } catch (e) {
      if (e instanceof PauseForReview) { projects.setStatus(p.id, "review", { stage: "revisar roteiro" }); continue; }
      const msg = (e as Error).message;
      console.error(`[${p.id}] erro:`, msg);
      projects.setStatus(p.id, "error", { error: msg });
    }
  }
}

main();

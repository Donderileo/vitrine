import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { costs, logs, projects } from "./db";
import { composeVideo, renderEndCard, writeCaptions } from "./compose";
import { generateScript } from "./providers/llm";
import { generateSceneImage, uploadPhotos } from "./providers/image";
import { generateClip } from "./providers/video";
import { generateVoice } from "./providers/tts";
import type { Ctx, ProjectState } from "./types";
import { descriptionText, renderCover, writeExtras } from "./extras";

import { PauseForReview, runTemplate } from "./template/pipeline";
import { runExplainer } from "./explainer/pipeline";
export { PauseForReview };

export const projectDir =(id: string) => path.join(config.dataDir, "projects", id);

/** Runs (or resumes) the full pipeline for one project. Each finished step is saved,
 *  so re-running after a failure never pays twice for the same image/clip. */
export async function runProject(id: string) {
  const row = projects.get(id);
  if (!row) throw new Error(`projeto ${id} não encontrado`);
  const dir = projectDir(id);
  for (const sub of ["scenes", "clips", "voice", "out"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });

  const state: ProjectState = { ...row.state };
  state.scenes ??= {}; state.voice ??= {}; state.outputs ??= {};
  const save = () => projects.saveState(id, state);
  const ctx: Ctx = {
    projectId: id, dir, input: row.input, num: row.num,
    log: (m) => { logs.add(id, m); console.log(`${new Date().toLocaleTimeString("pt-BR")} [${row.name.slice(0, 24)}] ${m}`); },
    cost: (c) => costs.add(id, c),
  };
  const stage = (s: string) => { projects.setStage(id, s); ctx.log(`▶ ${s}`); };

  if (row.input.kind === "explainer") { await runExplainer(ctx, state, save, stage); await ensureExtras(ctx, state, save, stage); return state; }
  if ((row.input.mode ?? config.videoMode) === "template") { await runTemplate(ctx, state, save, stage); await ensureExtras(ctx, state, save, stage); return state; }

  // 1. Script
  if (!state.script) {
    stage("roteiro");
    state.script = await generateScript(ctx);
    save();
  }
  if (row.input.reviewScript && !state.scriptApproved) {
    ctx.log("Roteiro pronto — aguardando sua revisão antes de gerar imagens.");
    throw new PauseForReview();
  }
  const variations = state.script.variations.slice(0, row.input.variations);

  // 2. Scene images (real product photo as reference)
  stage("imagens");
  if (!state.photoUrls) { state.photoUrls = await uploadPhotos(ctx); save(); }
  let k = 0;
  for (const [vi, v] of variations.entries()) {
    for (const [si, s] of v.scenes.entries()) {
      const key = `${vi}-${si}`;
      state.scenes[key] ??= {};
      if (!state.scenes[key].image) {
        ctx.log(`imagem v${vi + 1} cena ${si + 1}`);
        state.scenes[key].image = await generateSceneImage(ctx, s, state.photoUrls, path.join(dir, "scenes", `${key}.jpg`), k);
        save();
      }
      k++;
    }
  }

  // 3. Clips
  stage("clipes");
  k = 0;
  for (const [vi, v] of variations.entries()) {
    for (const [si, s] of v.scenes.entries()) {
      const key = `${vi}-${si}`;
      if (!state.scenes[key].clip) {
        ctx.log(`clipe v${vi + 1} cena ${si + 1}`);
        state.scenes[key].clip = await generateClip(ctx, s, state.scenes[key].image!, path.join(dir, "clips", `${key}.mp4`), k);
        save();
      }
      k++;
    }
  }

  // 4. Voice + 5. Compose
  for (const [vi, v] of variations.entries()) {
    const total = v.scenes.length * config.sceneSeconds + config.endCardSeconds;
    if (!state.voice[vi]) {
      stage(`narração v${vi + 1}`);
      state.voice[vi] = await generateVoice(ctx, `${v.voiceover} ${v.cta}`, path.join(dir, "voice", `${vi}.mp3`), total);
      save();
    }
    if (!state.outputs[vi]) {
      stage(`montagem v${vi + 1}`);
      const photo = row.input.photos[0];
      const endCard = await renderEndCard(photo, v.cta, path.join(dir, "out", `endcard-${vi}.mp4`), labelFor(row.input.language));
      const captions = writeCaptions(v, config.sceneSeconds, path.join(dir, "out", `captions-${vi}.ass`));
      const clips = v.scenes.map((_, si) => state.scenes[`${vi}-${si}`].clip!);
      const slug = row.input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      state.outputs[vi] = await composeVideo({
        clips, endCard, voice: state.voice[vi], captions,
        out: path.join(dir, "out", `${slug}-v${vi + 1}.mp4`),
        aiLabel: config.imageProvider !== "mock" || config.videoProvider === "fal",
      });
      save();
      ctx.log(`✔ vídeo ${vi + 1} pronto`);
    }
  }

  await ensureExtras(ctx, state, save, stage);
  const c = costs.summary(id);
  ctx.log(`Concluído. Custo estimado: US$ ${c.total.toFixed(2)}`);
  return state;
}

function labelFor(lang: string) {
  const l = lang.toLowerCase();
  if (l.startsWith("de")) return "Echtes Produktfoto";
  if (l.startsWith("es")) return "Foto real del producto";
  if (l.startsWith("en")) return "Real product photo";
  if (l.startsWith("it")) return "Foto reale del prodotto";
  if (l.startsWith("fr")) return "Photo réelle du produit";
  return "Foto real do produto";
}

/** Cover image + post description for the finished video (skipped if already made). */
async function ensureExtras(ctx: Ctx, state: ProjectState, save: () => void, stage: (s: string) => void) {
  if (state.extras) return;
  const video = state.outputs?.[0];
  if (!video || !fs.existsSync(video)) return;
  stage("capa e descrição");
  const ex = state.explainer;
  let brief, at = 1.5;
  if (ex?.plan && ex.narration) {
    brief = { kind: "explainer" as const, title: ex.plan.title, series: ex.plan.series, script: ex.plan.scenes.map((s) => s.narration).join(" "), cta: ex.plan.cta ? `${ex.plan.cta.type}: "${ex.plan.cta.text}"` : undefined };
    // a moment between two scenes with no caption on screen, around the first third of the video
    const { words, scenes } = ex.narration;
    const cands: number[] = [];
    for (let i = 1; i < scenes.length - 1; i++) {
      const last = words.filter((w) => w.scene === i).pop(), next = words.find((w) => w.scene === i + 1);
      if (last && next && next.t0 - last.t1 > 0.4) cands.push(last.t1 + 0.3);
    }
    at = cands[Math.floor(cands.length * 0.45)] ?? ex.narration.duration * 0.4;
  } else if (state.storyboard) {
    const v = state.storyboard.variations[0];
    brief = { kind: "ad" as const, title: state.storyboard.title, script: `${v.hookWords.join(" ")}. ${v.hookSub}. ${v.voiceover} ${v.cta}` };
  } else if (state.script) {
    const v = state.script.variations[0];
    brief = { kind: "ad" as const, title: ctx.input.name, script: `${v.hook}. ${v.voiceover} ${v.cta}` };
  } else return;
  const e = await writeExtras(ctx, brief);
  const tag = brief.kind === "explainer" ? ex?.plan?.series || "" : "";
  const cover = await renderCover({ video, at, title: e.coverTitle, tag, out: path.join(ctx.dir, "out", "capa.png") });
  fs.rmSync(path.join(ctx.dir, "out", "cover-frame.jpg"), { force: true });
  const description = descriptionText(e);
  fs.writeFileSync(path.join(ctx.dir, "out", "descricao.txt"), description + "\n");
  state.extras = { ...e, cover, description };
  save();
  ctx.log("✔ capa e descrição prontas");
}

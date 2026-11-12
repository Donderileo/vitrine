import fs from "node:fs";
import path from "node:path";
import { costs } from "../db";
import { PauseForReview } from "../template/pipeline";
import type { Ctx, ProjectState } from "../types";
import { installCaptions, renderFilm, retime, scaffold } from "./film";
import { authorFilm, writeSfx } from "./animator";
import { narrate } from "./narrate";
import { planExplainer } from "./plan";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Explainer: topic → narrated storyboard → ElevenLabs voice (timed) → Claude animates → QA → render → captions. */
export async function runExplainer(ctx: Ctx, state: ProjectState, save: () => void, stage: (s: string) => void) {
  const ex = (state.explainer ??= {});
  if (!ex.plan) {
    stage("roteiro");
    ex.plan = await planExplainer(ctx, ctx.input.name, ctx.input.description, ctx.input.series ?? "");
    save();
  }
  if (ctx.input.reviewScript && !ex.approved) {
    ctx.log("Roteiro pronto — aguardando sua revisão (narração e cenas).");
    throw new PauseForReview();
  }
  const base = path.join(ctx.dir, "explainer");
  if (!ex.narration) {
    stage("narração");
    ex.narration = await narrate(ctx, ex.plan, path.join(base, "voice"), ex.voice ?? {});
    // animation already written? keep it (no Claude cost): just re-time it to the new voice and re-render
    if (ex.filmReady && ex.filmDir && fs.existsSync(path.join(ex.filmDir, "film.js"))) {
      retime(ex.filmDir, ex.plan, ex.narration, ex.narration.wav);
      const src = path.join(ex.filmDir, "sfx-src.json");
      if (fs.existsSync(src)) writeSfx(ex.filmDir, JSON.parse(fs.readFileSync(src, "utf8")), ex.narration);
      ex.video = undefined; ex.output = undefined;
      ctx.log("narração nova aplicada à animação existente (sem custo de Claude)");
    }
    save();
  }
  const filmDir = path.join(base, slugify(ex.plan.title) || "film");
  if (!ex.filmReady) {
    stage("animação");
    scaffold(filmDir, ex.plan, ex.narration, ex.narration.wav);
    const issues = await authorFilm(ctx, filmDir, ex.plan, ex.narration);
    if (issues.some((i) => /EXCEPTION|Error/.test(i))) throw new Error("A animação gerada tem erro de código: " + issues.join(" | ").slice(0, 400));
    if (issues.length) ctx.log(`Seguindo com ${issues.length} aviso(s) de layout: ${issues.join(" | ").slice(0, 300)}`);
    ex.filmDir = filmDir; ex.filmReady = true; ex.qaLog = issues; ex.video = undefined; ex.output = undefined;
    save();
  }
  if (ex.captions !== "film") { // projects rendered before in-frame captions: add them and re-render (no API cost)
    installCaptions(ex.filmDir ?? filmDir);
    ex.captions = "film"; ex.video = undefined; ex.output = undefined;
    save();
  }
  if (!ex.video) {
    stage("renderizando");
    ex.video = await renderFilm(ctx, filmDir);
    save();
  }
  if (!ex.output) {
    fs.mkdirSync(path.join(ctx.dir, "out"), { recursive: true });
    ex.output = path.join(ctx.dir, "out", `${slugify(ex.plan.title)}.mp4`);
    fs.copyFileSync(ex.video, ex.output);
    save();
  }
  state.outputs = { 0: ex.output };
  save();
  ctx.log(`✔ vídeo pronto. Custo: US$ ${costs.summary(ctx.projectId).total.toFixed(3)}`);
  return state;
}

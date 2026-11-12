import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { costs } from "../db";
import { generateVoice } from "../providers/tts";
import type { Ctx, ProjectState } from "../types";
import { planStoryboard } from "./plan";
import { addAudio, buildSpec, closeBrowser, renderSpec } from "./render";

export class PauseForReview extends Error {
  constructor() { super("review"); }
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Template mode: Claude plans from the listing images, the video is drawn by code. No image/video AI cost. */
export async function runTemplate(ctx: Ctx, state: ProjectState, save: () => void, stage: (s: string) => void) {
  if (!state.storyboard) {
    stage("roteiro");
    state.storyboard = await planStoryboard(ctx);
    save();
  }
  if (ctx.input.reviewScript && !state.scriptApproved) {
    ctx.log("Roteiro pronto — aguardando sua revisão.");
    throw new PauseForReview();
  }
  const sb = state.storyboard;
  const variations = sb.variations.slice(0, ctx.input.variations);
  state.rendered ??= {};
  const outDir = path.join(ctx.dir, "out");
  fs.mkdirSync(outDir, { recursive: true });

  try {
    for (const [vi, v] of variations.entries()) {
      const name = `${slugify(ctx.input.name)}-v${vi + 1}`;
      const spec = await buildSpec(sb, v, ctx.input.photos, ctx.num);
      const duration = spec.scenes.reduce((a: number, s: any) => a + s.dur, 0);
      if (!state.rendered[vi]) {
        stage(`animando v${vi + 1}`);
        state.rendered[vi] = (await renderSpec(spec, path.join(ctx.dir, "scenes"), name, ctx.log)).silent;
        save();
      }
      if (v.voiceover && config.ttsProvider !== "mock" && !state.voice[vi]) {
        stage(`narração v${vi + 1}`);
        fs.mkdirSync(path.join(ctx.dir, "voice"), { recursive: true });
        state.voice[vi] = await generateVoice(ctx, `${v.voiceover} ${v.cta}`, path.join(ctx.dir, "voice", `${vi}.mp3`), duration);
        save();
      }
      if (!state.outputs[vi]) {
        stage(`finalizando v${vi + 1}`);
        state.outputs[vi] = await addAudio(state.rendered[vi], duration, state.voice[vi], path.join(outDir, `${name}.mp4`));
        save();
        ctx.log(`✔ vídeo ${vi + 1} pronto (${duration.toFixed(1)}s)`);
      }
    }
  } finally {
    await closeBrowser();
  }
  ctx.log(`Concluído. Custo estimado: US$ ${costs.summary(ctx.projectId).total.toFixed(3)}`);
  return state;
}

import { NextResponse } from "next/server";
import { projects } from "@/src/core/db";
import { ScriptSchema } from "@/src/core/types";
import { Storyboard } from "@/src/core/template/storyboard";
import { ExplainerPlan } from "@/src/core/explainer/schema";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const body = await req.json();
  if (body.explainer) { // explainer: edited narration/scenes → redo voice + animation (roteiro is kept)
    const plan = ExplainerPlan.safeParse(body.explainer);
    if (!plan.success) return NextResponse.json({ error: "Roteiro inválido: " + plan.error.message }, { status: 400 });
    const prev = p.state.explainer ?? {};
    const same = JSON.stringify(prev.plan) === JSON.stringify(plan.data);
    // Same number of scenes and same title = a wording tweak: keep the animation already written and only redo the
    // voice (the pipeline re-times the old film to the new narration: no Claude cost). Otherwise rewrite everything.
    const keepFilm = !same && prev.filmReady && prev.filmDir && prev.plan
      && prev.plan.scenes.length === plan.data.scenes.length && prev.plan.title === plan.data.title;
    projects.approveScript(id, { ...p.state, outputs: same ? p.state.outputs : {},
      explainer: same ? { ...prev, approved: true }
        : keepFilm ? { ...prev, plan: plan.data, approved: true, narration: undefined, video: undefined, output: undefined }
        : { plan: plan.data, approved: true } });
    return NextResponse.json({ ok: true });
  }
  if (body.storyboard) {
    const sb = Storyboard.safeParse(body.storyboard);
    if (!sb.success) return NextResponse.json({ error: "Roteiro inválido: " + sb.error.message }, { status: 400 });
    projects.approveScript(id, { ...p.state, storyboard: sb.data, rendered: {}, outputs: {} });
    return NextResponse.json({ ok: true });
  }
  const parsed = ScriptSchema.safeParse(body.script);
  if (!parsed.success) return NextResponse.json({ error: "Roteiro inválido: " + parsed.error.message }, { status: 400 });
  projects.approveScript(id, { ...p.state, script: parsed.data });
  return NextResponse.json({ ok: true });
}

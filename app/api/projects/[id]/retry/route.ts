import { NextResponse } from "next/server";
import { projects } from "@/src/core/db";

export const runtime = "nodejs";

/** body: { reset?: boolean, redo?: "outputs" } — default resumes from where it stopped (no double cost). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.redo === "extras") {
    projects.saveState(id, { ...p.state, extras: undefined });
  } else if (body.redo === "narration" && p.state.explainer) { // new voice, same animation (only ElevenLabs is charged)
    const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
    const voice = { ...p.state.explainer.voice, ...(num(body.speed, 0.7, 1.2) !== undefined ? { speed: num(body.speed, 0.7, 1.2) } : {}), ...(num(body.stability, 0, 1) !== undefined ? { stability: num(body.stability, 0, 1) } : {}) };
    projects.saveState(id, { ...p.state, outputs: {}, explainer: { ...p.state.explainer, voice, narration: undefined, video: undefined, output: undefined }, extras: undefined });
  } else if (body.redo === "film" && p.state.explainer) { // same script + voice, Claude rewrites the animation
    projects.saveState(id, { ...p.state, outputs: {}, explainer: { ...p.state.explainer, filmReady: false, freshFilm: true, video: undefined, output: undefined }, extras: undefined });
  } else if (body.redo === "outputs") {
    // Re-render only the final edits (free): useful after adding music or tweaking captions.
    const ex = p.state.explainer ? { ...p.state.explainer, video: undefined, output: undefined } : undefined;
    projects.saveState(id, { ...p.state, outputs: {}, rendered: {}, explainer: ex, extras: undefined });
  }
  projects.requeue(id, Boolean(body.reset));
  return NextResponse.json({ ok: true });
}

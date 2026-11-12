import { NextResponse } from "next/server";
import { projects } from "@/src/core/db";

export const runtime = "nodejs";

/** Reopen the storyboard review on a finished template project (re-rendering is free). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p || (!p.state.storyboard && !p.state.explainer?.plan)) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  if (p.state.explainer) projects.saveState(id, { ...p.state, explainer: { ...p.state.explainer, approved: false } });
  else projects.saveState(id, { ...p.state, scriptApproved: false });
  projects.setStatus(id, "review", { stage: "revisar roteiro" });
  return NextResponse.json({ ok: true });
}

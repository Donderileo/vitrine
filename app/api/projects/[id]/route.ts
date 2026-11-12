import { loadSettings } from "@/src/core/settings";
import path from "node:path";
import { NextResponse } from "next/server";
import { config } from "@/src/core/config";
import { costs, logs, projects } from "@/src/core/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rel = (p?: string) => (p ? "/api/files/" + path.relative(config.dataDir, p).split(path.sep).join("/") : undefined);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.get(id);
  if (!p) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({
    id: p.id, name: p.name, status: p.status, stage: p.stage, error: p.error, input: { ...p.input, photos: p.input.photos.map(rel) },
    mode: p.input.mode ?? "template",
    script: p.state.script,
    storyboard: p.state.storyboard,
    scenes: Object.fromEntries(Object.entries(p.state.scenes).map(([k, v]) => [k, { image: rel(v.image), clip: rel(v.clip) }])),
    outputs: Object.fromEntries(Object.entries(p.state.outputs).map(([k, v]) => [k, rel(v)])),
    costs: { ...costs.summary(id), items: costs.list(id), usdBrl: config.usdBrl },
    kind: p.input.kind ?? "ad",
    explainer: p.state.explainer ? {
      plan: p.state.explainer.plan, qa: p.state.explainer.qaLog ?? [],
      voice: { speed: p.state.explainer.voice?.speed ?? config.elevenSpeed, stability: p.state.explainer.voice?.stability ?? config.elevenStability },
      duration: p.state.explainer.narration?.duration ?? null,
    } : null,
    targetSeconds: loadSettings().explainerSeconds,
    extras: p.state.extras ? { cover: rel(p.state.extras.cover), description: p.state.extras.description, coverTitle: p.state.extras.coverTitle } : null,
    logs: logs.list(id, 60),
  });
}

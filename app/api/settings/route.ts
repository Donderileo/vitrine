import { NextResponse } from "next/server";
import { defaults, keyStatus, loadSettings, saveSettings } from "@/src/core/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: loadSettings(), defaults: defaults(), keys: keyStatus() });
}

/** body: Settings (partial is fine — missing fields fall back to defaults). Body {reset:true} restores defaults. */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const s = saveSettings(body?.reset ? defaults() : body);
  return NextResponse.json({ settings: s });
}

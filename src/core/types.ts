import { z } from "zod";

export const SceneSchema = z.object({
  imagePrompt: z.string(), // the environment/scene around the REAL product
  motionPrompt: z.string(), // camera/motion for image-to-video
  caption: z.string(), // on-screen text (short)
});

export const VariationSchema = z.object({
  angle: z.string(), // e.g. "antes e depois", "achadinho barato"
  hook: z.string(),
  scenes: z.array(SceneSchema).min(2).max(5),
  voiceover: z.string(),
  cta: z.string(),
});

export const ScriptSchema = z.object({ variations: z.array(VariationSchema).min(1) });

export type Scene = z.infer<typeof SceneSchema>;
export type Variation = z.infer<typeof VariationSchema>;
export type Script = z.infer<typeof ScriptSchema>;

export type ProjectInput = {
  name: string;
  description: string;
  productUrl?: string;
  priceText?: string;
  language: string; // "pt-BR", "de-DE", ...
  variations: number;
  photos: string[]; // absolute local paths
  kind?: "ad" | "explainer"; // ad = vídeo de anúncio (imagens do produto) · explainer = vídeo explicativo (tema)
  series?: string; // explainer: "Regra de arquiteto #1"
  mode?: "template" | "ai"; // template = motion graphics por código (grátis) · ai = imagens/vídeo de IA (fal)
  reviewScript?: boolean; // pause after the script so you can edit it before paying for images/video
};

// Persisted progress, so a failed run resumes without paying for finished steps again.
export type ProjectState = {
  script?: Script;
  scriptApproved?: boolean;
  storyboard?: import("./template/storyboard").TStoryboard; // template mode
  rendered?: Record<number, string>;
  explainer?: import("./explainer/schema").ExplainerState;
  extras?: import("./extras").ExtrasState; // cover image + post description // template mode: silent video per variation
  photoUrls?: string[]; // uploaded to provider (fal) when needed
  scenes: Record<string, { image?: string; clip?: string }>; // key: `${v}-${s}`
  voice: Record<number, string>;
  outputs: Record<number, string>;
};

export type CostEntry = { stage: string; provider: string; usd: number; note?: string };

export type Ctx = {
  projectId: string;
  dir: string; // project working dir
  input: ProjectInput;
  num?: number | null; // product number for "Produto #N" and the links page
  log: (msg: string) => void;
  cost: (c: CostEntry) => void;
};

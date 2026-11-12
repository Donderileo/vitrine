import { z } from "zod";

export const ExplainerScene = z.object({
  narration: z.string(), // spoken text (pt-BR), 1–2 short sentences
  onScreen: z.string(), // big on-screen title for this scene (≤ 6 words)
  visual: z.string(), // what is drawn and how it moves (for the animator)
});

export const ExplainerPlan = z.object({
  title: z.string(),
  series: z.string().default(""), // "Regra de arquiteto #1"
  palette: z.array(z.string()).max(5).default([]), // extra topic colours (hex)
  scenes: z.array(ExplainerScene).min(3).max(14),
});

export type TExplainerPlan = z.infer<typeof ExplainerPlan>;

export type Word = { w: string; t0: number; t1: number; scene: number };

export type ExplainerState = {
  plan?: TExplainerPlan;
  approved?: boolean;
  narration?: { wav: string; words: Word[]; scenes: { t0: number; t1: number }[]; duration: number };
  filmDir?: string;
  filmReady?: boolean; // film.js passed QA
  qaLog?: string[];
  video?: string; // rendered + muxed, before captions
  output?: string; // final mp4
  captions?: "film";
  voice?: { speed?: number; stability?: number }; // per-project voice tweaks (redo narration) // captions drawn in-frame (older projects get re-rendered once)
};

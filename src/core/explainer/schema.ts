import { z } from "zod";

/** One motion moment: when the narrator says `word`, `component` (from the H.M catalog) shows `text`. */
export const Beat = z.object({
  word: z.string(), // exact word of this scene's narration that triggers it
  component: z.string(), // keyword | counter | meter | ruler | checklist | compare | strike | question | arrow | circle | stars | price | ring | wipe | cta | desenho
  text: z.string().default(""), // what it shows ("80 cm", "NUNCA", "pés da frente")
});
export type TBeat = z.infer<typeof Beat>;

export const ExplainerScene = z.object({
  narration: z.string(), // spoken text (pt-BR), 1–2 short sentences
  onScreen: z.string(), // big on-screen title for this scene (≤ 6 words)
  visual: z.string(), // what is drawn and how it moves (for the animator)
  beats: z.array(Beat).optional(), // the motion table for this scene (old projects: none)
});

/** How the video ends — the script picks what fits the topic. */
export const CTA_TYPES = ["salvar", "comentar", "compartilhar", "seguir"] as const;
export const Cta = z.object({
  type: z.enum(CTA_TYPES).catch("salvar"),
  text: z.string(), // the end card text, e.g. "QUAL VOCÊ ESCOLHERIA?" / "MANDA PRA QUEM PRECISA VER"
});
export type TCta = z.infer<typeof Cta>;

export const ExplainerPlan = z.object({
  title: z.string(),
  series: z.string().default(""), // "Regra de arquiteto #1"
  palette: z.array(z.string()).max(5).default([]), // extra topic colours (hex)
  scenes: z.array(ExplainerScene).min(3).max(14),
  cta: Cta.optional(), // old projects: none (= salvar)
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

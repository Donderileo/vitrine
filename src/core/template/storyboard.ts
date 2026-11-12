import { z } from "zod";

// Boxes are in pixels of the ORIGINAL image.
export const Box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export const LabeledBox = Box.extend({ label: z.string() });

export const ImageInfo = z.object({
  index: z.number().int(),
  product: Box, // the main product as it appears in this image
  textBoxes: z.array(Box).default([]), // baked-in text/logos/badges to keep out of crops
  kind: z.enum(["lifestyle", "studio", "infographic", "detail"]).default("lifestyle"),
});

export const SCENE_TYPES = ["hook", "measure", "items", "details", "showcase", "final"] as const;
export const SceneType = z.enum(SCENE_TYPES);

export const TVariation = z.object({
  angle: z.string(),
  hookWords: z.array(z.string()).min(1).max(4), // 1 word per line, big
  hookSub: z.string().default(""),
  heroImage: z.number().int(),
  scenes: z.array(SceneType).min(2), // order; must start with hook and end with final
  showcaseImage: z.number().int().optional(),
  captions: z.record(z.string(), z.string()).default({}), // per scene type, short on-screen text
  voiceover: z.string().default(""),
  cta: z.string(),
});

export const Storyboard = z.object({
  // festivo = gold + sparkles + twinkle (natal, luzes) · quente = gold, sóbrio · clean = claro/neutro
  theme: z.enum(["festivo", "quente", "clean"]).default("quente"),
  title: z.string(), // short product name for the end card
  subtitle: z.string().default(""),
  price: z.string().nullish(),
  images: z.array(ImageInfo).min(1),
  measure: z.object({ value: z.number(), unit: z.string(), label: z.string(), image: z.number().int() }).nullable().default(null),
  items: z.object({ title: z.string(), image: z.number().int(), boxes: z.array(LabeledBox).min(2).max(6) }).nullable().default(null),
  details: z.object({ image: z.number().int(), boxes: z.array(LabeledBox).min(1).max(2) }).nullable().default(null),
  features: z.array(z.string()).max(3).default([]),
  variations: z.array(TVariation).min(1),
});

export type TBox = z.infer<typeof Box>;
export type TStoryboard = z.infer<typeof Storyboard>;
export type TVariationT = z.infer<typeof TVariation>;
export type TSceneType = z.infer<typeof SceneType>;

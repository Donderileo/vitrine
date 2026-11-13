export type Place = "floor" | "float";

export type Product = {
  id: string;
  name: string; // full listing title (from the CSV)
  short: string; // short name shown on the slide
  tag: string; // small label above the name ("mesa de jantar")
  price: string; // "179,99"
  link: string; // affiliate link (Offer Link)
  productLink?: string; // plain product URL (no tracking)
  store?: string;
  commission?: string; // "13%"
  sales?: string; // "2mil+"
  photo?: string; // file name inside <carousel>/photos
  cut?: string; // file name inside <carousel>/cut (background removed)
  useCut: boolean; // try to remove the background
  place: Place; // floor = stands on the floor · float = floats with a soft shadow (lamp, rug, curtain…)
};

export type Copy = { coverTitle: string; coverSub: string; intro: string; hashtags: string[] };

export type Carousel = {
  id: string;
  title: string;
  keyword: string; // "NOVEMBRO": the word people comment to get the link
  cta: "bio" | "comentar" | "ambos";
  format: "9x16" | "4x5";
  priceFrom: boolean; // "a partir de R$ X" (prices change with coupons)
  publi: boolean; // add #publi
  products: Product[];
  copy?: Copy;
  slides: string[]; // paths relative to the data dir, in order (cover, products…, final)
  costUsd: number;
  createdAt: number;
  updatedAt: number;
  renderedAt?: number;
};

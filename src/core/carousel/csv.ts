import { newProductId } from "./store";
import type { Product } from "./types";

/** Minimal RFC-4180 parser (quotes, escaped quotes, CRLF). `sep` is detected from the header line. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const head = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((s) => [s, head.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const FIELDS: Record<string, string[]> = {
  name: ["item name", "nome", "nome do produto", "produto", "title", "titulo"],
  price: ["price", "preco", "valor"],
  offer: ["offer link", "link de afiliado", "link afiliado", "affiliate link"],
  product: ["product link", "link do produto", "url", "link"],
  store: ["nome da loja", "loja", "shop name", "store"],
  commission: ["commission rate", "taxa de comissao", "comissao"],
  sales: ["sales", "vendas"],
};

/** "49.98" / "R$ 49,98" / "1.299,9" → "1.299,90" */
export function fmtPrice(raw: string): string {
  let s = raw.replace(/R\$\s*/i, "").trim();
  if (!s) return "";
  if (/^\d+\.\d{1,2}$/.test(s)) s = s.replace(".", ",");        // 49.98 → 49,98
  if (/^\d+$/.test(s)) s += ",00";
  if (/^[\d.]+,\d$/.test(s)) s += "0";
  return s;
}

/** Shopee "Batch Product Links" CSV (or any CSV with similar headers) → products without photos. */
export function productsFromCsv(text: string): { products: Product[]; warnings: string[] } {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length < 2) return { products: [], warnings: ["CSV vazio"] };
  const head = rows[0].map(norm);
  const col = (k: string) => head.findIndex((h) => FIELDS[k].includes(h));
  const idx = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, col(k)]));
  if (idx.name < 0) return { products: [], warnings: ["Não achei a coluna do nome do produto (ex.: 'Item Name')."] };
  const products: Product[] = [];
  for (const r of rows.slice(1)) {
    const g = (k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    const name = g("name");
    if (!name) continue;
    const offer = g("offer"), plain = g("product");
    const link = offer || plain;
    if (!offer) warnings.push(`"${name.slice(0, 40)}…": sem Offer Link (usando o link puro, sem rastreio de afiliado).`);
    products.push({
      id: newProductId(), name, short: shorten(name), tag: "", price: fmtPrice(g("price")), link, productLink: plain || undefined,
      store: g("store") || undefined, commission: g("commission") || undefined, sales: g("sales") || undefined,
      useCut: true, place: "floor",
    });
  }
  return { products, warnings };
}

const STOP = new Set(["para", "de", "da", "do", "das", "dos", "com", "e", "ideal", "grande", "kit", "em", "a", "o", "no", "na", "por", "sem", "ou"]);
/** Offline fallback for the short name: first 4 meaningful words, Title Case. */
export function shorten(name: string): string {
  const words = name.replace(/[|,;/()\-–]+/g, " ").split(/\s+/).filter(Boolean);
  const keep: string[] = [];
  for (const w of words) { if (!STOP.has(w.toLowerCase()) || keep.length === 0) keep.push(w); if (keep.length >= 4) break; }
  return keep.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { config } from "../config";
import { loadSettings } from "../settings";
import { buildCaption, buildLinks } from "./copy";
import { cutProduct } from "./cutout";
import { carouselDir, rel, saveCarousel } from "./store";
import type { Carousel, Product } from "./types";

// ---------- colour helpers ----------
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h: string) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ---------- layout per format (TikTok photo mode is 9:16; Instagram feed is 4:5) ----------
type Lay = { W: number; H: number; floorY: number; feet: number; prodH: number; headTop: number; nameMax: number; pillTop: number; hint: number; title: number };
const LAYOUT: Record<"9x16" | "4x5", Lay> = {
  "9x16": { W: 1080, H: 1920, floorY: 1240, feet: 1330, prodH: 800, headTop: 190, nameMax: 230, pillTop: 1400, hint: 1580, title: 400 },
  "4x5": { W: 1080, H: 1350, floorY: 860, feet: 930, prodH: 500, headTop: 110, nameMax: 190, pillTop: 1010, hint: 1195, title: 300 },
};

type Pal = { wall: string; floor: string; plant: string; ink: string; soft: string; accent: string; onAccent: string; paper: string };
function palette(): Pal {
  const st = loadSettings();
  const obj = (n: string, d: string) => st.objects.find((o) => o.name.toLowerCase() === n)?.color ?? d;
  const wall = obj("parede", "#E9DFD0"), floor = obj("piso", "#C9A97E");
  const dark = lum(wall) < 0.5;
  return {
    wall, floor, plant: obj("planta", "#4F7A4A"),
    ink: dark ? "#F6EEE2" : "#2B1E16", soft: dark ? "rgba(246,238,226,.72)" : "rgba(43,30,22,.62)",
    accent: st.brandColors.gold, onAccent: st.brandColors.onAccent, paper: dark ? "#2A211A" : "#FFFFFF",
  };
}

const dataUri = (file: string) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = ext === "jpg" ? "jpeg" : ext;
  return `data:image/${type};base64,${fs.readFileSync(file).toString("base64")}`;
};
const font = (f: string) => pathToFileURL(path.join(config.fontsDir, f)).href;

/** The picture of a product: the cut-out (trimmed to its pixels) or, without one, the photo on a card. */
function productImg(c: Carousel, p: Product): { src: string; cut: boolean } | null {
  const dir = carouselDir(c.id);
  if (p.useCut && p.cut && fs.existsSync(path.join(dir, "cut", p.cut))) return { src: dataUri(path.join(dir, "cut", p.cut)), cut: true };
  if (p.photo && fs.existsSync(path.join(dir, "photos", p.photo))) return { src: dataUri(path.join(dir, "photos", p.photo)), cut: false };
  return null;
}

// ---------- the room (same for every slide: it is the profile's "known background") ----------
function roomCss(L: Lay, P: Pal) {
  const wallTop = mix(P.wall, "#ffffff", 0.18), wallLow = mix(P.wall, "#000000", 0.05);
  const floorTop = mix(P.floor, "#000000", 0.1), floorLow = mix(P.floor, "#000000", 0.02);
  return `
@font-face{font-family:P;src:url('${font("Poppins-Bold.ttf")}')}@font-face{font-family:PM;src:url('${font("Poppins-Medium.ttf")}')}
*{box-sizing:border-box}html,body{margin:0;width:${L.W}px;height:${L.H}px;overflow:hidden;background:${P.wall};font-family:PM;color:${P.ink}}
.wall{position:absolute;left:0;top:0;width:${L.W}px;height:${L.floorY}px;background:linear-gradient(180deg,${wallTop},${wallLow})}
.beam{position:absolute;left:-120px;top:-60px;width:520px;height:${L.floorY + 80}px;background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,0));transform:skewX(-14deg);filter:blur(26px)}
.beam.b2{left:340px;width:230px;opacity:.7}
.base{position:absolute;left:0;top:${L.floorY - 30}px;width:${L.W}px;height:30px;background:${mix(P.wall, "#ffffff", 0.35)};box-shadow:0 -2px 0 rgba(0,0,0,.05)}
.floor{position:absolute;left:0;top:${L.floorY}px;width:${L.W}px;height:${L.H - L.floorY}px;background:
 repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 3px,transparent 3px 216px),linear-gradient(180deg,${floorTop},${floorLow})}
.floor:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.14),rgba(0,0,0,0) 22%)}
.plant{position:absolute;left:-70px;top:${L.floorY - 430}px;width:300px;height:470px}
`;
}
const plantSvg = (P: Pal) => `<svg class="plant" viewBox="0 0 300 470"><g>
<path d="M150 330 C90 280 70 200 110 120 C150 170 170 250 150 330Z" fill="${P.plant}"/>
<path d="M150 330 C200 260 250 220 270 140 C220 150 160 220 150 330Z" fill="${mix(P.plant, "#000000", 0.15)}"/>
<path d="M150 330 C120 250 40 240 10 180 C70 170 130 230 150 330Z" fill="${mix(P.plant, "#ffffff", 0.12)}"/>
<path d="M150 330 C160 240 150 170 190 90 C210 170 190 250 150 330Z" fill="${mix(P.plant, "#000000", 0.28)}"/>
<path d="M95 330h110l-14 130h-82z" fill="${mix(P.floor, "#6b4a2f", 0.55)}"/><rect x="88" y="322" width="124" height="22" rx="8" fill="${mix(P.floor, "#6b4a2f", 0.4)}"/></g></svg>`;

// ---------- in-page script: trim cut-outs, fit text, place shadows ----------
const SCRIPT = `
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function trim(src) {
  const img = await load(src);
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (d[(y * w + xx) * 4 + 3] > 10) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return src;
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}
function fit(el, maxH, min) { let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollHeight > maxH && s > min) { s -= 4; el.style.fontSize = s + 'px'; } }
window.ready = (async () => {
  await document.fonts.load('80px P'); await document.fonts.load('30px PM');
  for (const img of document.querySelectorAll('img[data-trim]')) { img.src = await trim(img.src); }
  for (const img of document.querySelectorAll('img')) { if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; }); }
  document.querySelectorAll('[data-fit]').forEach((el) => fit(el, parseFloat(el.dataset.fit), 40));
  document.querySelectorAll('.shadow').forEach((s) => {
    const img = s.parentElement.querySelector('img'); if (!img) return;
    const r = img.getBoundingClientRect(); s.style.width = Math.round(r.width * 0.86) + 'px';
  });
})();
`;

function page(L: Lay, P: Pal, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${roomCss(L, P)}
.abs{position:absolute}
.badge{position:absolute;left:90px;width:92px;height:92px;border-radius:50%;background:${P.accent};color:${P.onAccent};font-family:P;font-size:52px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,.18)}
.tag{position:absolute;left:206px;height:92px;display:flex;align-items:center;font-size:36px;letter-spacing:.08em;text-transform:uppercase;color:${P.soft}}
.name{position:absolute;left:90px;width:${L.W - 180}px;font-family:P;font-size:86px;line-height:1.04;letter-spacing:-.02em;color:${P.ink};overflow:hidden}
.prod{position:absolute;left:90px;width:${L.W - 180}px;display:flex;align-items:flex-end;justify-content:center}
.prod .one{position:relative;display:flex;align-items:flex-end;justify-content:center;width:100%;height:100%}
.prod img{max-width:100%;max-height:100%;object-fit:contain;display:block;position:relative;z-index:2;filter:drop-shadow(0 14px 18px rgba(0,0,0,.16))}
.prod img.card{background:${P.paper};padding:16px;border-radius:40px;box-shadow:0 26px 60px rgba(0,0,0,.22);transform:rotate(-1.6deg);filter:none}
.shadow{position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);height:54px;border-radius:50%;background:radial-gradient(closest-side,rgba(40,24,12,.42),rgba(40,24,12,0));z-index:1}
.pill{position:absolute;left:50%;transform:translateX(-50%);background:${P.accent};color:${P.onAccent};border-radius:70px;padding:16px 64px 20px;text-align:center;box-shadow:0 14px 30px rgba(0,0,0,.2);white-space:nowrap}
.pill small{display:block;font-size:30px;opacity:.9;letter-spacing:.04em;margin-bottom:-4px}
.pill b{font-family:P;font-size:84px;letter-spacing:-.02em}
.pill i{font-style:normal;font-size:44px;margin-right:10px;opacity:.9}
.center{position:absolute;left:90px;width:${L.W - 180}px;text-align:center}
.h1{font-family:P;letter-spacing:-.025em;line-height:1.02;color:${P.ink};overflow:hidden}
.h1 em{font-style:normal;color:${P.accent}}
.hint{position:absolute;left:0;width:${L.W}px;text-align:center;font-size:36px;color:${P.soft}}
.handle{position:absolute;left:0;width:${L.W}px;text-align:center;font-size:38px;color:${P.soft};letter-spacing:.02em}
</style></head><body>
<div class="wall"><div class="beam"></div><div class="beam b2"></div></div>${plantSvg(P)}<div class="base"></div><div class="floor"></div>
${body}<script>${SCRIPT}</script></body></html>`;
}

const price = (c: Carousel, p: Product) => (p.price ? `<div class="pill" style="top:${LAYOUT[c.format].pillTop}px">${c.priceFrom ? "<small>a partir de</small>" : ""}<i>R$</i><b>${esc(p.price)}</b></div>` : "");

function productSlide(c: Carousel, p: Product, n: number, P: Pal): string {
  const L = LAYOUT[c.format];
  const im = productImg(c, p);
  const lift = p.place === "float" && im?.cut ? 70 : 0;
  const h = L.prodH - lift;
  const top = L.feet - L.prodH;
  const photo = im
    ? `<div class="one"><img ${im.cut ? "data-trim" : 'class="card"'} src="${im.src}">${im.cut && !lift ? '<div class="shadow"></div>' : im.cut ? '<div class="shadow" style="bottom:-' + (26 + lift) + 'px;opacity:.7"></div>' : ""}</div>`
    : `<div class="one"><div style="width:560px;height:420px;border-radius:40px;background:${P.paper};opacity:.5"></div></div>`;
  return page(L, P, `
<div class="badge" style="top:${L.headTop}px">${n}</div>${p.tag ? `<div class="tag" style="top:${L.headTop}px">${esc(p.tag)}</div>` : ""}
<div class="name" data-fit="${L.nameMax}" style="top:${L.headTop + 112}px;max-height:${L.nameMax}px">${esc(p.short || p.name)}</div>
<div class="prod" style="top:${top}px;height:${h}px;${lift ? `margin-top:0;` : ""}">${photo}</div>
${price(c, p)}`);
}

function coverSlide(c: Carousel, P: Pal): string {
  const L = LAYOUT[c.format];
  const t = (c.copy?.coverTitle || c.title).trim();
  const words = t.split(/\s+/);
  const last = words.pop() ?? "";
  const title = `${esc(words.join(" "))}${words.length ? " " : ""}<em>${esc(last)}</em>`;
  const sub = c.copy?.coverSub ?? `${c.products.length} achados pra sua casa`;
  // up to 3 products standing on the floor: the first one in the middle and tallest
  const pick = c.products.filter((p) => productImg(c, p));
  const order = pick.length >= 3 ? [pick[1], pick[0], pick[2]] : pick.length === 2 ? [pick[1], pick[0]] : pick;
  const hs = order.length >= 3 ? [0.74, 0.96, 0.66] : order.length === 2 ? [0.8, 0.96] : [0.96];
  const items = order.map((p, i) => {
    const im = productImg(c, p)!, h = Math.round(L.prodH * hs[i]);
    return `<div style="position:relative;display:flex;align-items:flex-end;justify-content:center;height:${h}px;max-width:${order.length > 1 ? 380 : 720}px;flex:0 1 auto;margin:0 ${order.length > 1 ? -14 : 0}px">
      <img ${im.cut ? "data-trim" : 'class="card"'} src="${im.src}" style="max-height:${im.cut ? h : Math.round(h * 0.7)}px;max-width:100%">${im.cut ? '<div class="shadow"></div>' : ""}</div>`;
  }).join("");
  return page(L, P, `
<div class="center h1" data-fit="${L.title}" style="top:${L.headTop + 20}px;max-height:${L.title}px;font-size:${c.format === "9x16" ? 138 : 112}px">${title}</div>
<div class="prod" style="top:${L.feet - L.prodH}px;height:${L.prodH}px;gap:0">${items}</div>
<div class="pill" style="top:${L.pillTop}px;padding:18px 56px"><b style="font-size:${c.format === "9x16" ? 50 : 44}px;font-family:P">${esc(sub)}</b></div>
<div class="hint" style="top:${L.hint}px">arrasta pro lado →</div>`);
}

function finalSlide(c: Carousel, P: Pal): string {
  const L = LAYOUT[c.format];
  const kw = esc((c.keyword.trim() || "LINK").toUpperCase());
  const small = c.format === "4x5";
  const bio = `<div class="h1" style="font-size:${small ? 84 : 104}px">Os links estão<br>na <em>bio</em> ↑</div>
<div style="margin-top:26px;font-size:${small ? 34 : 40}px;color:${P.soft}">é só pegar pelo número do produto</div>`;
  const comment = `<div style="font-size:${small ? 42 : 52}px;color:${P.soft}">Comenta</div>
<div class="pill" style="position:relative;left:auto;transform:none;display:inline-block;margin:20px 0 22px;padding:20px 70px 24px"><b style="font-size:${small ? 80 : 104}px">${kw}</b></div>
<div style="font-size:${small ? 42 : 52}px;line-height:1.2">que eu te mando <b style="font-family:P">todos os links</b></div>`;
  const body = c.cta === "bio" ? bio : c.cta === "comentar" ? comment : `${comment}<div style="margin-top:40px;font-size:${small ? 34 : 40}px;color:${P.soft}">ou pega na bio ↑</div>`;
  const list = c.products.slice(0, 8).map((p, i) => `${i + 1}. ${esc(p.short || p.name)}`).join("<br>");
  return page(L, P, `
<div class="center" style="top:${small ? L.headTop + 40 : 340}px">${body}</div>
${c.cta === "bio" || c.cta === "ambos" ? `<div class="center" style="top:${c.cta === "bio" ? (small ? 560 : 820) : small ? 720 : 1000}px;font-size:${small ? 32 : 38}px;line-height:1.5;color:${P.ink};text-align:left;padding:0 ${small ? 150 : 140}px;opacity:.92">${list}</div>` : ""}
<div class="handle" style="top:${L.hint - (small ? 30 : 60)}px">${esc(config.brandHandle)}</div>`);
}

/** Renders cover + one slide per product + final slide as PNGs (and writes legenda.txt / links.txt). */
export async function renderCarousel(c: Carousel, log: (m: string) => void = () => {}): Promise<Carousel> {
  const dir = carouselDir(c.id);
  const out = path.join(dir, "slides");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 1) cut-outs (parallel, 3 at a time)
  const todo = c.products.filter((p) => p.photo && p.useCut && !p.cut);
  let cost = 0;
  const q = [...todo];
  await Promise.all(Array.from({ length: Math.min(3, q.length) }, async () => { while (q.length) cost += await cutProduct(c, q.shift()!, log); }));
  c.costUsd += cost;

  // 2) slides
  const P = palette(), L = LAYOUT[c.format];
  const htmls: { name: string; html: string }[] = [{ name: "01-capa", html: coverSlide(c, P) }];
  c.products.forEach((p, i) => htmls.push({ name: `${String(i + 2).padStart(2, "0")}-produto-${i + 1}`, html: productSlide(c, p, i + 1, P) }));
  htmls.push({ name: `${String(c.products.length + 2).padStart(2, "0")}-final`, html: finalSlide(c, P) });

  const b = await chromium.launch();
  const files: string[] = [];
  try {
    const pg = await b.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
    for (const s of htmls) {
      const f = path.join(dir, `_${s.name}.html`);
      fs.writeFileSync(f, s.html);
      await pg.goto(pathToFileURL(f).href);
      await pg.evaluate(() => (window as any).ready);
      await pg.waitForTimeout(120);
      const png = path.join(out, `${s.name}.png`);
      await pg.screenshot({ path: png, type: "png" });
      fs.rmSync(f, { force: true });
      files.push(rel(png));
      log(`slide ${s.name}`);
    }
  } finally { await b.close(); }

  fs.writeFileSync(path.join(dir, "legenda.txt"), buildCaption(c));
  fs.writeFileSync(path.join(dir, "links.txt"), buildLinks(c));
  c.slides = files;
  c.renderedAt = Date.now();
  saveCarousel(c);
  return c;
}

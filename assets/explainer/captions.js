// Vitrine captions, drawn inside the frame (no ffmpeg/libass needed).
// Loaded BEFORE film.js: wraps Studio.film so every film gets TikTok-style captions from SCORE.WORDS
// (1–3 words at a time, the spoken word in gold, a small pop when a new group appears).
(function () {
  const S = globalThis.SCORE, Studio = globalThis.Studio;
  if (!S || !Studio || !S.WORDS || !S.WORDS.length) return;

  // group words exactly like a creator would caption: ≤ 3 words, ≤ 18 chars, break on pauses, scenes and sentence ends
  const groups = [];
  let cur = [];
  for (const w of S.WORDS) {
    const len = cur.map((x) => x.w).join(' ').length + w.w.length;
    if (cur.length && (cur.length >= 3 || len > 18 || w.scene !== cur[0].scene || w.t0 - cur[cur.length - 1].t1 > 0.35)) { groups.push(cur); cur = []; }
    cur.push(w);
    if (/[.!?]$/.test(w.w)) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  const spans = groups.map((g, k) => ({ g, t0: g[0].t0, t1: k < groups.length - 1 ? Math.min(g[g.length - 1].t1 + 0.25, groups[k + 1][0].t0) : g[g.length - 1].t1 + 0.4 }));

  const SIZE = 76, FONT = `700 ${SIZE}px Poppins, sans-serif`;
  const Y = (S.ZONES && S.ZONES.caption ? S.ZONES.caption.y : 1270) + 95;
  const CX = S.ZONES ? S.ZONES.cx : 500;
  const GOLD = (S.BRAND && S.BRAND.gold) || '#F2C766';

  function drawCaptions(ctx, t) {
    const sp = spans.find((s) => t >= s.t0 && t < s.t1);
    if (!sp) return;
    const a = Math.min(1, (t - sp.t0) / 0.09), k = 0.9 + 0.1 * a;
    ctx.save();
    ctx.font = FONT; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const words = sp.g.map((w) => w.w);
    const space = ctx.measureText(' ').width;
    const widths = words.map((w) => ctx.measureText(w).width);
    const total = widths.reduce((x, y) => x + y, 0) + space * (words.length - 1);
    ctx.translate(CX, Y); ctx.scale(k, k);
    let x = -total / 2;
    sp.g.forEach((w, i) => {
      const active = t >= w.t0 && (i === sp.g.length - 1 || t < sp.g[i + 1].t0);
      ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.strokeText(w.w, x, 0);
      ctx.fillStyle = active ? GOLD : '#FFFFFF'; ctx.fillText(w.w, x, 0);
      x += widths[i] + space;
    });
    ctx.restore();
  }

  const film = Studio.film;
  Studio.film = (opts) => film({ ...opts, draw(ctx, t) { opts.draw(ctx, t); drawCaptions(ctx, t); } });
})();

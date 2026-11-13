// Vitrine motion library (M): ready-made motion-graphics components with the house timing built in.
// Loaded BEFORE film.js. Every component is a pure function of t: (ctx, t, opts) — call it every frame.
// Timing (from the editing manual): enter 0.4 s ease-out (slide 130 px or pop with overshoot), exit 0.25 s,
// stagger 0.09 s between items of a group, something always moving while on screen.
(function () {
  const U = globalThis.U, G = globalThis.G, S = globalThis.SCORE;
  if (!U || !G || !S) return;
  const { clamp, lerp, ease } = U;
  const Z = S.ZONES, B = S.BRAND, F = 'Poppins';
  const OK = '#6E9F6B', BAD = '#D2553F';
  // theme-aware colours (dark or light themes): text on the accent, translucent surfaces, cards
  const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const ON = B.onAccent || '#120d09', DARK = ON, SOFT = (a) => rgba(B.ink, a), CARD = rgba(B.bg2 || B.bg, 0.92);
  const ENTER = 0.4, EXIT = 0.25, SLIDE = 130, STAGGER = 0.09;
  const MAXW = Math.min(900, ((G.SAFE && G.SAFE.w) || 900) - 40); // widest a text block may be (inside the TikTok safe area)

  // ---------- timing ----------
  /** null before `at` / after it left; else {i: entrance 0..1 eased, o: exit 0..1, a: alpha, age} */
  function life(t, at, out) {
    if (at == null || t < at) return null;
    const o = out != null ? clamp((t - out) / EXIT) : 0;
    if (o >= 1) return null;
    const raw = at <= 0.001 ? 1 : clamp((t - at) / ENTER); // at = 0 → already in place on frame 0 (the hook frame must be full)
    return { raw, i: ease.outCubic(raw), back: ease.outBack(raw, 1.7), o, a: Math.min(at <= 0.001 ? 1 : clamp((t - at) / 0.12), 1 - o), age: t - at };
  }
  /** runs fn inside the entrance/exit transform around (cx, cy). from: pop | left | right | up | down | fade */
  function enter(ctx, L, from, cx, cy, fn) {
    if (!L) return;
    ctx.save();
    ctx.globalAlpha *= L.a;
    let dx = 0, dy = 0, k = 1;
    const r = 1 - L.i;
    if (from === 'left') dx = -SLIDE * r; else if (from === 'right') dx = SLIDE * r;
    else if (from === 'up') dy = -SLIDE * r; else if (from === 'down') dy = SLIDE * r;
    else if (from === 'pop') k = lerp(0.55, 1, L.back);
    k *= 1 - 0.06 * L.o; dy += 24 * L.o;
    ctx.translate(cx + dx, cy + dy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  }
  const breathe = (t, amt = 0.015, f = 2.2) => 1 + amt * Math.sin(t * f * Math.PI);
  const draw = (t, at, dur) => ease.inOutCubic(clamp((t - at) / dur)); // a line drawing itself 0..1

  // ---------- text ----------
  const txt = (ctx, s, x, y, o = {}) => G.text(ctx, s, x, y, { fam: F, weight: 700, color: B.ink, ...o });
  const width = (ctx, s, size, weight = 700) => G.measure(ctx, s, size, F, weight);
  /** biggest size ≤ size that fits maxW */
  const fit = (ctx, s, size, maxW, weight = 700) => { const w = width(ctx, s, size, weight); return w > maxW ? Math.max(30, Math.floor(size * maxW / w)) : size; };
  /** split into ≤ 2 lines that fit maxW (keeps the size if possible) */
  function lines(ctx, s, size, maxW) {
    if (width(ctx, s, size) <= maxW) return { rows: [s], size };
    const ws = s.split(/\s+/);
    let best = null;
    for (let k = 1; k < ws.length; k++) {
      const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' ');
      const m = Math.max(width(ctx, a, size), width(ctx, b, size));
      if (!best || m < best.m) best = { m, rows: [a, b] };
    }
    if (!best) return { rows: [s], size: fit(ctx, s, size, maxW) };
    return { rows: best.rows, size: best.m > maxW ? Math.floor(size * maxW / best.m) : size };
  }
  function rr(ctx, x, y, w, h, r, fill, stroke, lw = 4) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function stroke(ctx, pts, color, lw, p = 1) { // polyline drawn up to p
    if (p <= 0 || pts.length < 2) return;
    let len = 0; const seg = [];
    for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); len += d; }
    let left = len * p;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length && left > 0; k++) {
      const f = Math.min(1, left / seg[k - 1]);
      ctx.lineTo(lerp(pts[k - 1][0], pts[k][0], f), lerp(pts[k - 1][1], pts[k][1], f)); left -= seg[k - 1];
    }
    ctx.stroke(); ctx.restore();
  }
  const check = (ctx, x, y, s, p, color = OK) => stroke(ctx, [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.35], [x + s * 0.55, y - s * 0.45]], color, s * 0.2, p);
  const cross = (ctx, x, y, s, p, color = BAD) => { stroke(ctx, [[x - s * 0.45, y - s * 0.45], [x + s * 0.45, y + s * 0.45]], color, s * 0.2, clamp(p * 2)); stroke(ctx, [[x + s * 0.45, y - s * 0.45], [x - s * 0.45, y + s * 0.45]], color, s * 0.2, clamp(p * 2 - 1)); };

  const M = {
    life, enter, breathe, draw, fit, lines, check, cross, OK, BAD,
    /** time helper: item k of a group enters at at + k*STAGGER */
    stagger: (at, k, gap = STAGGER) => at + k * gap,

    /** small uppercase label with a square (above titles/cards) */
    tag(ctx, t, { text, at, out, x = Z.top.x, y = Z.top.y + 80, color = B.gold, size = 30, align = 'left', from = 'left' }) {
      const L = life(t, at, out); if (!L) return;
      const s = String(text).toUpperCase(), w = width(ctx, s, size, 500);
      const x0 = align === 'center' ? x - (w + size) / 2 : x;
      enter(ctx, L, from, x0, y, () => {
        ctx.fillStyle = color; ctx.fillRect(x0, y - size * 0.62, size * 0.5, size * 0.5);
        txt(ctx, s, x0 + size * 0.85, y, { size, weight: 500, color, align: 'left' });
      });
    },

    /** headline whose words enter one by one; `hl` = word(s) to highlight in a coloured box */
    title(ctx, t, { text, at, out, x = Z.cx, y = Z.top.y + 200, size = 92, maxW = MAXW, hl = '', color = B.ink, accent = B.gold, align = 'center' }) {
      if (t < at) return;
      const { rows, size: sz } = lines(ctx, String(text), size, maxW);
      const clean = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, '');
      const hls = String(hl).split(/\s+/).map(clean).filter(Boolean);
      let k = 0;
      rows.forEach((row, r) => {
        const ws = row.split(/\s+/), sp = width(ctx, ' ', sz);
        const ww = ws.map((w) => width(ctx, w, sz)), tot = ww.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
        let cx = align === 'center' ? x - tot / 2 : x;
        const yy = y + r * sz * 1.12;
        ws.forEach((w, j) => {
          const L = life(t, at <= 0.001 ? 0 : at + (k++) * 0.07, out);
          const isHl = hls.includes(clean(w));
          enter(ctx, L, 'up', cx + ww[j] / 2, yy, () => {
            if (isHl) {
              const p = ease.outCubic(clamp((t - at - 0.25) / 0.3));
              rr(ctx, cx - 14, yy - sz * 0.86, (ww[j] + 28) * p, sz * 1.08, 12, accent);
              txt(ctx, w, cx, yy, { size: sz, color: p > 0.5 ? DARK : color, align: 'left' });
            } else txt(ctx, w, cx, yy, { size: sz, color, align: 'left' });
          });
          cx += ww[j] + sp;
        });
      });
    },

    /** one big word in a coloured box with a pop (impact phrases) */
    keyword(ctx, t, { text, at, out, x = Z.cx, y = Z.top.y + 250, size = 130, color = B.gold, ink = DARK, box = true, from = 'pop', label, maxW = MAXW, tilt = -0.03 }) {
      const L = life(t, at, out); if (!L) return;
      const s = String(text).toUpperCase(), sz = fit(ctx, s, size, maxW - 60), w = width(ctx, s, sz);
      enter(ctx, L, from, x, y - sz * 0.3, () => {
        ctx.save(); ctx.translate(x, y - sz * 0.3); ctx.rotate(tilt); const b = breathe(t, 0.02); ctx.scale(b, b); ctx.translate(-x, -(y - sz * 0.3));
        if (box) rr(ctx, x - w / 2 - 30, y - sz * 0.92, w + 60, sz * 1.22, 18, color);
        txt(ctx, s, x, y, { size: sz, color: box ? ink : color, align: 'center' });
        ctx.restore();
        if (label) M.tag(ctx, t, { text: label, at, out, x, y: y - sz * 0.92 - 22, align: 'center', size: 28, from: 'fade' });
      });
    },

    /** number counting up from `from` to `to` (then a small pop) — any number that is spoken */
    counter(ctx, t, { to, from = 0, at, out, dur = 0.9, x = Z.cx, y = Z.top.y + 250, size = 200, color = B.gold, prefix = '', suffix = '', decimals = 0, label, align = 'center' }) {
      const L = life(t, at, out); if (!L) return;
      const v = lerp(from, to, ease.outCubic(clamp((t - at) / dur)));
      const land = t - at - dur, k = land > 0 ? 1 + 0.12 * Math.exp(-land * 9) * Math.sin(land * 30) : 1;
      const s = prefix + v.toFixed(decimals).replace('.', ',') + suffix;
      enter(ctx, L, 'up', x, y, () => {
        ctx.save(); ctx.translate(x, y - size * 0.35); ctx.scale(k, k); ctx.translate(-x, -(y - size * 0.35));
        txt(ctx, s, x, y, { size: fit(ctx, s, size, MAXW), color, align });
        ctx.restore();
        if (label) txt(ctx, String(label).toUpperCase(), x, y + size * 0.42, { size: 44, weight: 500, color: B.ink, align });
      });
    },

    /** horizontal bar filling to value (0..1) with the % next to it */
    meter(ctx, t, { value, at, out, dur = 1, x = Z.cx - 410, y = Z.top.y + 250, w = 820, h = 56, color = B.gold, label, showPct = true }) {
      const L = life(t, at, out); if (!L) return;
      const p = value * ease.outCubic(clamp((t - at - 0.15) / dur));
      enter(ctx, L, 'left', x, y, () => {
        if (label) txt(ctx, String(label).toUpperCase(), x, y - 22, { size: 40, weight: 500, align: 'left' });
        rr(ctx, x, y, w, h, h / 2, SOFT(0.14));
        if (p > 0.005) rr(ctx, x, y, Math.max(h, w * p), h, h / 2, color);
        if (showPct) txt(ctx, Math.round(p * 100) + '%', x + w, y - 22, { size: 56, color, align: 'right' });
      });
    },

    /** measuring line between two points with end ticks and a label ("80 cm") — distances, heights, sizes */
    ruler(ctx, t, { x1, y1, x2, y2, at, out, dur = 0.6, label = '', color = B.gold, lw = 6, size = 52, side = -1 }) {
      const L = life(t, at, out); if (!L) return;
      const p = draw(t, at, dur), a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * 22, ny = Math.cos(a) * 22;
      ctx.save(); ctx.globalAlpha *= L.a;
      stroke(ctx, [[x1 + nx, y1 + ny], [x1 - nx, y1 - ny]], color, lw, clamp(p * 4));
      stroke(ctx, [[x1, y1], [x2, y2]], color, lw, p);
      stroke(ctx, [[x2 + nx, y2 + ny], [x2 - nx, y2 - ny]], color, lw, clamp(p * 4 - 3));
      ctx.restore();
      if (label) {
        let mx = (x1 + x2) / 2 - Math.sin(a) * 60 * side, my = (y1 + y2) / 2 + Math.cos(a) * 60 * side + size * 0.35;
        const LL = life(t, at + dur * 0.7, out), w = width(ctx, label, size);
        const SA = G.SAFE || { x: 40, w: G.W - 180 };
        const cmx = clamp(mx, SA.x + w / 2 + 30, SA.x + SA.w - w / 2 - 30); // never off-screen
        if (cmx !== mx) { mx = cmx; }
        enter(ctx, LL, 'pop', mx, my - size * 0.35, () => {
          rr(ctx, mx - w / 2 - 20, my - size * 0.95, w + 40, size * 1.3, 14, CARD, color, 4);
          txt(ctx, label, mx, my, { size, color, align: 'center' });
        });
      }
    },

    /** a row of pills, centred on x (values, recap, tags); items: [{text, at}] — wraps to 2 rows if needed */
    badges(ctx, t, { items, out, x = Z.cx, y = Z.top.y + 300, size = 40, gap = 18, color = B.gold, ink = ON }) {
      const ws = items.map((it) => width(ctx, it.text, size) + size * 1.2), maxW = Math.min(Z.mid.w, MAXW);
      const rows = [[]]; let w = 0;
      items.forEach((it, k) => { if (w + ws[k] > maxW && rows[rows.length - 1].length) { rows.push([]); w = 0; } rows[rows.length - 1].push(k); w += ws[k] + gap; });
      rows.forEach((row, r) => {
        const tot = row.reduce((a, k) => a + ws[k], 0) + gap * (row.length - 1);
        let cx = clamp(x - tot / 2, Z.mid.x, Z.mid.x + Z.mid.w - tot);
        row.forEach((k) => {
          const L = life(t, items[k].at, out), bx = cx, yy = y + r * size * 1.9;
          enter(ctx, L, 'pop', bx + ws[k] / 2, yy, () => {
            rr(ctx, bx, yy - size * 0.95, ws[k], size * 1.4, size * 0.7, color);
            txt(ctx, items[k].text, bx + ws[k] / 2, yy, { size, color: ink, align: 'center' });
          });
          cx += ws[k] + gap;
        });
      });
    },

    /** list where each item slides in at its own time and gets a ✓ drawn (items: [{text, at}]) */
    checklist(ctx, t, { items, out, x = Z.cx - 400, y = Z.mid.y + 80, gap = 120, size = 58, color = OK, bad = false }) {
      items.forEach((it, k) => {
        const L = life(t, it.at, out); if (!L) return;
        const yy = y + k * gap;
        enter(ctx, L, 'left', x, yy, () => {
          rr(ctx, x, yy - 52, 72, 72, 16, SOFT(0.08), bad ? BAD : color, 4);
          (bad ? cross : check)(ctx, x + 36, yy - 16, 44, draw(t, it.at + 0.2, 0.3), bad ? BAD : color);
          txt(ctx, it.text, x + 100, yy, { size: fit(ctx, it.text, size, 700), align: 'left' });
        });
      });
    },

    /** two panels side by side with ✗ / ✓ — "antes e depois", "certo e errado".
     *  left/right: {label, ok, draw(ctx, box, t)} — draw() paints the illustration inside its panel (clipped). */
    compare(ctx, t, { at, out, left, right, y = Z.mid.y + 20, h = 760, markAt, gap = 30 }) {
      const w = (Z.mid.w - gap) / 2 - 10, xs = [Z.cx - gap / 2 - w, Z.cx + gap / 2];
      [left, right].forEach((side, k) => {
        if (!side) return;
        const L = life(t, at + k * 0.25, out); if (!L) return;
        const x = xs[k], ok = side.ok ?? k === 1;
        enter(ctx, L, k ? 'right' : 'left', x + w / 2, y + h / 2, () => {
          rr(ctx, x, y, w, h, 28, B.bg2 || B.bg, ok ? OK : BAD, 5);
          if (side.draw) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 110, 24); ctx.clip(); side.draw(ctx, { x: x + 6, y: y + 6, w: w - 12, h: h - 110 }, t); ctx.restore(); }
          if (side.label) txt(ctx, String(side.label).toUpperCase(), x + w / 2, y + h - 34, { size: fit(ctx, String(side.label).toUpperCase(), 50, w - 40), color: ok ? OK : BAD, align: 'center' });
          const m0 = (markAt ?? at + 0.5) + k * 0.35;
          if (t >= m0) {
            const cx = x + w - 56, cy = y + 56, pk = ease.outBack(clamp((t - m0) / 0.3), 2);
            ctx.save(); ctx.translate(cx, cy); ctx.scale(pk, pk); ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fillStyle = ok ? OK : BAD; ctx.fill(); ctx.restore();
            (ok ? check : cross)(ctx, cx, cy, 44, draw(t, m0 + 0.1, 0.25), '#fff');
          }
        });
      });
    },

    /** term in a pill that gets crossed out ("sem", "pare de", "não use") */
    strike(ctx, t, { text, at, out, strikeAt, x = Z.cx, y = Z.top.y + 230, size = 80, color = BAD }) {
      const L = life(t, at, out); if (!L) return;
      const s = String(text), sz = fit(ctx, s, size, 800), w = width(ctx, s, sz);
      enter(ctx, L, 'pop', x, y - sz * 0.3, () => {
        rr(ctx, x - w / 2 - 40, y - sz * 0.95, w + 80, sz * 1.3, sz * 0.65, SOFT(0.1), B.ink, 4);
        txt(ctx, s, x, y, { size: sz, align: 'center' });
        stroke(ctx, [[x - w / 2 - 50, y - sz * 0.15], [x + w / 2 + 50, y - sz * 0.45]], color, 14, draw(t, strikeAt ?? at + 0.45, 0.25));
      });
    },

    /** giant swinging "?" — questions */
    question(ctx, t, { at, out, x = Z.cx, y = Z.mid.y + Z.mid.h * 0.55, size = 420, color = B.gold }) {
      const L = life(t, at, out); if (!L) return;
      enter(ctx, L, 'pop', x, y, () => {
        ctx.save(); ctx.translate(x, y - size * 0.6); ctx.rotate(0.12 * Math.sin(L.age * 4)); ctx.translate(-x, -(y - size * 0.6));
        txt(ctx, '?', x, y, { size, color, align: 'center' });
        ctx.restore();
      });
    },

    /** arrow that draws itself (bend > 0 curves it) */
    arrow(ctx, t, { x1, y1, x2, y2, at, out, dur = 0.45, color = B.gold, lw = 10, head = 34, bend = 0 }) {
      const L = life(t, at, out); if (!L) return;
      const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend, pts = [];
      for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([(1 - u) ** 2 * x1 + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * my + u * u * y2]); }
      const p = draw(t, at, dur), wig = Math.sin(L.age * 6) * 4 * (p >= 1 ? 1 : 0);
      ctx.save(); ctx.globalAlpha *= L.a; ctx.translate(wig * Math.cos(Math.atan2(y2 - y1, x2 - x1)), wig * Math.sin(Math.atan2(y2 - y1, x2 - x1)));
      stroke(ctx, pts, color, lw, p);
      if (p > 0.9) {
        const n = pts.length - 1, a = Math.atan2(pts[n][1] - pts[n - 2][1], pts[n][0] - pts[n - 2][0]), hk = clamp((p - 0.9) * 10);
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * hk * Math.cos(a - 0.5), y2 - head * hk * Math.sin(a - 0.5)); ctx.lineTo(x2 - head * hk * Math.cos(a + 0.5), y2 - head * hk * Math.sin(a + 0.5)); ctx.fill();
      }
      ctx.restore();
    },

    /** hand-drawn ellipse around something ("olha isso", "aqui") */
    circle(ctx, t, { x, y, rx = 160, ry = 110, at, out, dur = 0.5, color = B.gold, lw = 9 }) {
      const L = life(t, at, out); if (!L) return;
      const pts = []; for (let k = 0; k <= 48; k++) { const a = -2.2 + (k / 48) * Math.PI * 2.15; pts.push([x + rx * Math.cos(a) * (1 + 0.04 * Math.sin(a * 3)), y + ry * Math.sin(a)]); }
      ctx.save(); ctx.globalAlpha *= L.a; stroke(ctx, pts, color, lw, draw(t, at, dur)); ctx.restore();
    },

    /** underline that draws itself */
    underline(ctx, t, { x1, x2, y, at, out, dur = 0.35, color = B.gold, lw = 10 }) {
      const L = life(t, at, out); if (!L) return;
      ctx.save(); ctx.globalAlpha *= L.a; stroke(ctx, [[x1, y], [(x1 + x2) / 2, y + 6], [x2, y - 2]], color, lw, draw(t, at, dur)); ctx.restore();
    },

    /** n stars lighting up in sequence ("ótimo", "qualidade") */
    stars(ctx, t, { at, out, n = 5, step = 0.12, x = Z.cx, y = Z.top.y + 230, r = 52, color = B.gold }) {
      for (let k = 0; k < n; k++) {
        const L = life(t, at + k * step, out); if (!L) continue;
        const cx = x + (k - (n - 1) / 2) * r * 2.4;
        enter(ctx, L, 'pop', cx, y, () => G.star(ctx, cx, y, r * breathe(t + k, 0.05), { fill: color, rot: 0 }));
      }
    },

    /** ring filling to value (0..1) with a centre text — time, percentage, "1 minuto" */
    ring(ctx, t, { value = 1, at, out, dur = 1, x = Z.cx, y = Z.mid.y + Z.mid.h / 2, r = 220, lw = 34, color = B.gold, text = '', size = 110 }) {
      const L = life(t, at, out); if (!L) return;
      const p = value * ease.outCubic(clamp((t - at - 0.1) / dur));
      enter(ctx, L, 'pop', x, y, () => {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = lw;
        ctx.strokeStyle = SOFT(0.14); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        if (p > 0.002) { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke(); }
        ctx.restore();
        if (text) txt(ctx, text, x, y + size * 0.35, { size: fit(ctx, text, size, r * 1.6), align: 'center' });
      });
    },

    /** price whose digits spin like a slot machine and stop at `to`, then an optional stamp */
    price(ctx, t, { to, at, out, dur = 1.1, prefix = 'R$ ', x = Z.cx, y = Z.top.y + 260, size = 170, color = B.gold, stamp }) {
      const L = life(t, at, out); if (!L) return;
      const fin = Math.round(to).toString(), n = fin.length;
      let s = '';
      for (let k = 0; k < n; k++) {
        const stop = at + dur * (0.5 + 0.5 * (k + 1) / n);
        s += t >= stop ? fin[k] : String(Math.floor(U.hash(k, Math.floor(t * 24)) * 10));
      }
      s = prefix + s;
      enter(ctx, L, 'up', x, y, () => txt(ctx, s, x, y, { size: fit(ctx, s, size, MAXW), color, align: 'center' }));
      if (stamp) M.keyword(ctx, t, { text: stamp, at: at + dur + 0.05, out, x: x + 200, y: y + 120, size: 70, color: BAD, ink: '#fff', tilt: -0.12 });
    },

    /** close-up: draws `draw(ctx)` zoomed k× around (x, y), easing in at `at` (and back out at `out`), clipped to the
     *  middle zone. Use it so consecutive scenes never show the same framing ("close no quadro", "close no pé do sofá"). */
    focus(ctx, t, { x, y, k = 1.9, at, dur = 0.6, out, clip = true }, draw) {
      k = Math.max(1.7, k); // a close-up has to read as a different shot, not a slightly bigger copy
      const pin = at == null ? 1 : ease.inOutCubic(clamp((t - at) / dur)), pout = out != null ? ease.inOutCubic(clamp((t - out) / dur)) : 0;
      const z = 1 + (k - 1) * pin * (1 - pout);
      const cx = lerp(x, Z.cx, pin * (1 - pout)), cy = lerp(y, Z.mid.y + Z.mid.h / 2, pin * (1 - pout));
      ctx.save();
      if (clip) { ctx.beginPath(); ctx.roundRect(Z.mid.x, Z.mid.y - 20, Z.mid.w, Z.mid.h + 20, 28); ctx.clip(); }
      ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-x, -y);
      draw(ctx);
      ctx.restore();
    },

    /** dark card (90% opaque) with a thin brand border; content(ctx, box, L) draws inside */
    card(ctx, t, { at, out, x = Z.cx - 450, y = Z.mid.y + 40, w = 900, h = 600, from = 'up', label, border = B.gold }, content) {
      const L = life(t, at, out); if (!L) return;
      enter(ctx, L, from, x + w / 2, y + h / 2, () => {
        rr(ctx, x, y, w, h, 26, CARD, border, 3);
        if (label) { ctx.fillStyle = border; ctx.fillRect(x + 32, y + 36, 16, 16); txt(ctx, String(label).toUpperCase(), x + 62, y + 53, { size: 28, weight: 500, color: border, align: 'left' }); }
        if (content) content(ctx, { x, y, w, h }, L);
      });
    },

    /** brand stripes crossing the screen (topic change, "enfim", covering a cut) — lasts ~0.6 s */
    wipe(ctx, t, { at, colors }) {
      const p = (t - at) / 0.6; if (p < 0 || p > 1) return;
      const cs = colors || [B.gold, G.tint(B.gold, -0.25), B.ink];
      cs.forEach((c, k) => {
        const q = clamp(p * 1.6 - k * 0.15), x = lerp(-G.W * 1.2, G.W * 1.2, ease.inOutCubic(q));
        ctx.save(); ctx.translate(x, 0); ctx.rotate(-0.25); ctx.fillStyle = c; ctx.fillRect(-200, -400 + k * 60, G.W * 1.1, G.H + 800); ctx.restore();
      });
    },

    /** small animated icon for each kind of call to action (≈ size px) */
    ctaIcon(ctx, t, { kind = 'salvar', x = Z.cx, y, size = 130, at, color = B.gold }) {
      const L = life(t, at); if (!L) return;
      enter(ctx, L, 'pop', x, y, () => {
        const s = size / 2, wob = Math.sin(L.age * 5) * 0.06;
        ctx.save(); ctx.translate(x, y); ctx.rotate(wob); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = size * 0.09; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (kind === 'comentar') { // speech bubble with typing dots
          ctx.beginPath(); ctx.roundRect(-s, -s * 0.8, s * 2, s * 1.4, s * 0.45); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.5); ctx.lineTo(-s * 0.7, s * 1.0); ctx.lineTo(-s * 0.05, s * 0.55); ctx.fill();
          for (let k = 0; k < 3; k++) { const j = Math.max(0, Math.sin(L.age * 7 - k * 0.9)) * s * 0.18; ctx.fillStyle = DARK; ctx.beginPath(); ctx.arc((k - 1) * s * 0.5, -s * 0.1 - j, s * 0.14, 0, Math.PI * 2); ctx.fill(); }
        } else if (kind === 'compartilhar') { // share arrow: curved tail rising into a solid head (drawn in)
          const p = draw(t, at + 0.05, 0.35), pts = [];
          for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push([lerp(-s * 0.95, s * 0.25, u), lerp(s * 0.75, -s * 0.15, u) - Math.sin(u * Math.PI) * s * 0.35 * (1 - u)]); }
          stroke(ctx, pts, color, size * 0.17, p);
          const hk = clamp((p - 0.7) / 0.3);
          if (hk > 0) {
            const [ex, ey] = pts[20], [px, py] = pts[17], a = Math.atan2(ey - py, ex - px), h = s * 0.75 * ease.outBack(hk, 2);
            ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * h, ey + Math.sin(a) * h);
            ctx.lineTo(ex + Math.cos(a + 2.1) * h * 0.8, ey + Math.sin(a + 2.1) * h * 0.8); ctx.lineTo(ex + Math.cos(a - 2.1) * h * 0.8, ey + Math.sin(a - 2.1) * h * 0.8); ctx.closePath(); ctx.fill();
          }
        } else if (kind === 'seguir') { // circle with a pulsing +
          const k = breathe(t, 0.06, 2.4); ctx.scale(k, k);
          ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = DARK; ctx.lineWidth = size * 0.12; ctx.beginPath(); ctx.moveTo(-s * 0.45, 0); ctx.lineTo(s * 0.45, 0); ctx.moveTo(0, -s * 0.45); ctx.lineTo(0, s * 0.45); ctx.stroke();
        } else { // salvar: bookmark that fills
          const f = ease.outCubic(clamp((L.age - 0.2) / 0.4));
          const path = () => { ctx.beginPath(); ctx.moveTo(-s * 0.65, -s); ctx.lineTo(s * 0.65, -s); ctx.lineTo(s * 0.65, s); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.65, s); ctx.closePath(); };
          path(); ctx.stroke();
          ctx.save(); path(); ctx.clip(); ctx.fillRect(-s, s - 2 * s * f, s * 2, 2 * s * f); ctx.restore();
        }
        ctx.restore();
      });
    },

    /** end card: icon of the call + text + the @handle pill (2–3 s).
     *  kind: salvar | comentar | compartilhar | seguir (the script picks it) */
    cta(ctx, t, { at, kind = 'salvar', text, sub = '', handle = S.HANDLE || '' }) {
      if (t < at) return;
      const DEF = { salvar: 'SALVA PRA USAR DEPOIS', comentar: 'COMENTA AQUI EMBAIXO', compartilhar: 'MANDA PRA QUEM PRECISA VER', seguir: 'SEGUE PRA PARTE 2' };
      text = text || DEF[kind] || DEF.salvar;
      const p = ease.outCubic(clamp((t - at) / 0.5)), Y = (f) => Z.mid.y + Z.mid.h * f;
      ctx.save(); ctx.globalAlpha = clamp((t - at) / 0.25); ctx.fillStyle = B.bg; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); // its own clean screen
      ctx.save(); ctx.fillStyle = B.gold; ctx.globalAlpha = 0.9;
      ctx.fillRect(0, Y(0.04), G.W * p, 16); ctx.fillRect(G.W * (1 - p), Y(0.92), G.W, 16); ctx.restore();
      M.ctaIcon(ctx, t, { kind, y: Y(0.2), at: at + 0.05 });
      M.title(ctx, t, { text, at: at + 0.2, y: Y(0.42), size: 96, hl: text.split(/\s+/).slice(-1)[0] });
      if (sub) txt(ctx, sub, Z.cx, Y(0.68), { size: 48, weight: 500, align: 'center', alpha: clamp((t - at - 0.6) / 0.3) });
      if (handle) {
        const L = life(t, at + 0.7), sz = 56, w = width(ctx, handle, sz), y = Y(0.8);
        enter(ctx, L, 'pop', Z.cx, y, () => {
          const b = breathe(t, 0.03, 1.6); ctx.save(); ctx.translate(Z.cx, y); ctx.scale(b, b); ctx.translate(-Z.cx, -y);
          rr(ctx, Z.cx - w / 2 - 40, y - sz * 0.95, w + 80, sz * 1.4, sz * 0.7, B.gold);
          txt(ctx, handle, Z.cx, y, { size: sz, color: DARK, align: 'center' }); ctx.restore();
        });
      }
    },
  };
  globalThis.M = M;
})();

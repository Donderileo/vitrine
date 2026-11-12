// EXAMPLE film.js — "A fórmula 60-30-10". Shows the conventions every Vitrine explainer follows:
// - scene timing comes from S.SCENES (timed to the narration); visual hits use S.cue(scene, 'word')
// - layout zones: titles in the TOP zone, illustration in the MIDDLE zone, nothing in the CAPTION zone
// - everything is a pure function of t; flat shapes with G.rrect / G.ellipse / G.poly / G.text
(function () {
  const U = globalThis.U, G = globalThis.G, S = globalThis.SCORE, Studio = globalThis.Studio, Data = globalThis.Data;
  const { clamp, lerp, ease } = U;
  const W = G.W, H = G.H, Z = S.ZONES, B = S.BRAND, SC = S.SCENES;
  const F = 'Poppins';
  const CX = Z.cx;

  // ---------- helpers every film can copy ----------
  const R = (ctx, x, y, w, h, r, fill) => G.rrect(ctx, x, y, w, h, r, { fill, lw: 0 });
  const E = (ctx, cx, cy, rx, ry, fill) => G.ellipse(ctx, cx, cy, rx, ry, { fill, lw: 0 });
  const txt = (ctx, s, x, y, o) => G.text(ctx, s, x, y, { fam: F, weight: 700, color: B.ink, ...o });
  function stamp(ctx, s, x, y, t, t0, o = {}) { // text that slams in at t0
    const a = clamp((t - t0) / 0.22); if (a <= 0) return;
    const k = lerp(1.6, 1, ease.outBack(a, 2));
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); txt(ctx, s, 0, 0, { alpha: clamp(a * 2), ...o }); ctx.restore();
  }
  const sceneAt = (t) => SC.findIndex((s) => t >= s.t0 && t < s.t1);

  // ---------- the room (local 900 x 820), each object has a "chaos" and a "final" colour ----------
  const RW = 900, RH = 820;
  const OBJ = {
    wall: ['#2EC4B6', '#E9DFD0'], floor: ['#8E5BD9', '#D9CCB7'], sofa: ['#E63946', '#F2EADF'],
    curtain: ['#FFD60A', '#7A8450'], rug: ['#9EF01A', '#8E9763'], armchair: ['#FB8500', '#646D3E'],
    cushions: ['#FF4D9D', '#C4673F'], vase: ['#3A86FF', '#C4673F'], frame: ['#C2185B', '#D9845C'],
  };
  const BOX = { wall: [0, 0, 900, 600], floor: [0, 600, 900, 220], curtain: [60, 50, 320, 430], frame: [460, 140, 240, 160],
    sofa: [335, 380, 490, 230], cushions: [395, 400, 370, 95], vase: [828, 430, 64, 180], rug: [140, 680, 680, 120], armchair: [40, 515, 270, 210] };
  // repaint moments = when the narrator SAYS the word
  const PAINT = 0.4;
  const repaint = {
    wall: S.cue(2, 'paredes'), floor: S.cue(2, 'piso'), sofa: S.cue(2, 'sofá'),
    curtain: S.cue(3, 'cortina'), rug: S.cue(3, 'tapete'), armchair: S.cue(3, 'poltrona'),
    cushions: S.cue(4, 'almofada'), vase: S.cue(4, 'vaso'), frame: S.cue(4, 'quadro'),
  };
  const ORDER = ['wall', 'window', 'curtain', 'frame', 'floor', 'rug', 'sofa', 'cushions', 'vase', 'armchair'];
  const pops = ORDER.filter((k) => k !== 'window').map((k, i, a) => ({ k, t: SC[0].t0 + 0.3 + (i / a.length) * (SC[0].t1 - SC[0].t0 - 1) }));

  const DRAW = {
    wall(ctx, c) { R(ctx, 0, 0, 900, 600, 0, c); R(ctx, 0, 588, 900, 14, 0, G.tint(c, -0.18)); },
    floor(ctx, c) { R(ctx, 0, 600, 900, 220, 0, c); for (let i = 1; i < 6; i++) R(ctx, 0, 600 + i * 38, 900, 2, 0, G.tint(c, -0.08)); },
    curtain(ctx, c) { R(ctx, 50, 48, 340, 8, 4, '#3B2A1E'); for (const x of [62, 300]) { R(ctx, x, 56, 78, 420, 10, c); for (let i = 1; i < 4; i++) R(ctx, x + i * 19, 60, 3, 410, 2, G.tint(c, -0.15)); } },
    frame(ctx, c) { R(ctx, 460, 140, 240, 160, 6, '#3B2A1E'); R(ctx, 472, 152, 216, 136, 4, '#F4EEE4'); E(ctx, 545, 240, 55, 55, c); R(ctx, 590, 175, 70, 95, 35, G.tint(c, 0.25)); },
    sofa(ctx, c) { const d = G.tint(c, -0.12); R(ctx, 360, 380, 440, 140, 26, d); R(ctx, 345, 500, 470, 95, 18, c); R(ctx, 335, 450, 55, 150, 22, d); R(ctx, 770, 450, 55, 150, 22, d); R(ctx, 360, 595, 14, 18, 3, '#3B2A1E'); R(ctx, 786, 595, 14, 18, 3, '#3B2A1E'); },
    cushions(ctx, c) { R(ctx, 395, 405, 92, 90, 22, c); R(ctx, 673, 405, 92, 90, 22, G.tint(c, 0.12)); },
    vase(ctx, c) { for (const [a, l] of [[-0.5, 110], [-0.15, 140], [0.25, 120], [0.6, 95]]) { ctx.save(); ctx.translate(860, 520); ctx.rotate(a); E(ctx, 0, -l / 2, 14, l / 2, '#5E7A3A'); ctx.restore(); } R(ctx, 832, 515, 56, 92, 20, c); },
    rug(ctx, c) { E(ctx, 480, 740, 340, 58, c); E(ctx, 480, 740, 300, 44, G.tint(c, 0.1)); },
    armchair(ctx, c) { const d = G.tint(c, -0.14); R(ctx, 60, 515, 230, 130, 30, d); R(ctx, 45, 625, 260, 80, 18, c); R(ctx, 40, 575, 50, 135, 20, d); R(ctx, 260, 575, 50, 135, 20, d); },
  };

  function drawObj(ctx, k, t, mode) {
    const [chaos, fin] = OBJ[k];
    if (mode !== 'live') return DRAW[k](ctx, mode === 'chaos' ? chaos : fin);
    const p = clamp((t - repaint[k]) / PAINT);
    DRAW[k](ctx, p >= 1 ? fin : chaos);
    if (p > 0 && p < 1) { // paint-roller wipe left → right
      const [x, y, w, h] = BOX[k], e = ease.inOutQuad(p);
      ctx.save(); ctx.beginPath(); ctx.rect(x - 20, y - 20, (w + 40) * e, h + 40); ctx.clip(); DRAW[k](ctx, fin); ctx.restore();
      R(ctx, x - 24 + (w + 40) * e, y - 14, 8, h + 28, 4, 'rgba(255,255,255,0.85)');
    }
  }

  function room(ctx, t, x, y, s, mode = 'live', hook = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, RW, RH, 28); ctx.clip();
    R(ctx, 0, 0, RW, RH, 0, '#1c140d');
    for (const k of ORDER) {
      if (k === 'window') { R(ctx, 100, 85, 240, 300, 8, '#F4EEE4'); R(ctx, 114, 99, 212, 272, 4, '#BFD7DF'); R(ctx, 217, 99, 6, 272, 2, '#F4EEE4'); R(ctx, 114, 232, 212, 6, 2, '#F4EEE4'); continue; }
      if (hook) { // objects pop in one by one, slightly jiggling (the room "clashes")
        const p = pops.find((q) => q.k === k); if (t < p.t) continue;
        const sc = ease.outBack(clamp((t - p.t) / 0.28), 2.2), [bx, by, bw, bh] = BOX[k], cx = bx + bw / 2, cy = by + bh / 2;
        const jig = k === 'wall' || k === 'floor' ? 0 : Math.sin(t * 9 + bx) * 0.025;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(jig); ctx.scale(sc, sc); ctx.translate(-cx, -cy); drawObj(ctx, k, t, mode); ctx.restore();
      } else drawObj(ctx, k, t, mode);
    }
    ctx.restore(); ctx.restore();
  }

  // middle zone placement for one big illustration
  const RS = Math.min(Z.mid.w / RW, Z.mid.h / RH), RX = CX - (RW * RS) / 2, RY = Z.mid.y + (Z.mid.h - RH * RS) / 2;

  Studio.film({
    async init() { await Studio.loadFont(F, 'assets/Poppins-Bold.ttf', 700); await Studio.loadFont(F, 'assets/Poppins-Medium.ttf', 500); },
    draw(ctx, t) {
      ctx.fillStyle = B.bg; ctx.fillRect(0, 0, W, H);
      const i = sceneAt(t), s = SC[Math.max(0, i)];
      if (S.series) txt(ctx, S.series.toUpperCase(), Z.top.x, Z.top.y + 30, { size: 30, color: B.gold, weight: 500 });

      if (i <= 0) { // GANCHO
        room(ctx, t, RX, RY, RS, 'live', true);
        stamp(ctx, 'SUA SALA PARECE', Z.top.x, Z.top.y + 160, t, s.t0 + 0.2, { size: 72 });
        stamp(ctx, 'BAGUNÇADA?', Z.top.x, Z.top.y + 280, t, S.cue(0, 'bagunçada'), { size: 112, color: B.gold });
      } else if (i === 1) { // A FÓRMULA
        room(ctx, t, RX, RY, RS, 'chaos');
        ctx.fillStyle = 'rgba(18,13,9,0.72)'; ctx.fillRect(0, 0, W, H);
        const cols = ['#E9DFD0', '#8E9763', '#D9845C'];
        [['60%', 'sessenta'], ['30%', 'trinta'], ['10%', 'dez']].forEach(([n, w], k) =>
          stamp(ctx, n, CX + (k - 1) * 300, Z.top.y + 300, t, S.cue(1, w, 0.4 + k * 0.2), { size: 128, align: 'center', color: cols[k] }));
      } else if (i <= 4) { // 60 / 30 / 10
        room(ctx, t, RX, RY, RS, 'live');
        const pct = [60, 30, 10][i - 2], sw = ['#E9DFD0', '#8E9763', '#D9845C'][i - 2];
        const title = ['COR BASE', 'COR SECUNDÁRIA', 'DESTAQUE'][i - 2];
        Data.counter(ctx, { x: Z.top.x, y: Z.top.y + 260, from: 0, to: pct, t, t0: s.t0, t1: s.t0 + 0.6, size: 180, color: sw, align: 'left', fam: F, weight: 700, suffix: '%' });
        txt(ctx, title, Z.top.x, Z.top.y + 330, { size: 52, color: B.gold, alpha: clamp((t - s.t0 - 0.2) / 0.3) });
      } else if (i === 5) { // ANTES × DEPOIS
        const k = ease.inOutCubic(clamp((t - s.t0) / 0.55)), s2 = (Z.mid.w / 2 - 12) / RW, y2 = Z.mid.y + 60;
        room(ctx, t, lerp(-W, CX - 12 - RW * s2, k), y2, s2, 'chaos');
        room(ctx, t, lerp(RX, CX + 12, k), lerp(RY, y2, k), lerp(RS, s2, k), 'fin');
        const a = clamp((t - s.t0 - 0.4) / 0.3);
        txt(ctx, 'ANTES', CX - 12 - (RW * s2) / 2, y2 - 20, { size: 40, align: 'center', alpha: a, color: '#F4A3A3' });
        txt(ctx, 'DEPOIS', CX + 12 + (RW * s2) / 2, y2 - 20, { size: 40, align: 'center', alpha: a, color: B.gold });
        stamp(ctx, 'MESMA SALA,', CX, Z.top.y + 170, t, s.t0 + 0.15, { size: 78, align: 'center' });
        stamp(ctx, 'OUTRA CARA.', CX, Z.top.y + 265, t, S.cue(5, 'outra'), { size: 78, align: 'center', color: B.gold });
      } else { // RECAP + CTA
        const rs = RS * 0.7;
        room(ctx, t, CX - (RW * rs) / 2, Z.mid.y + 160, rs, 'fin');
        const bx = Z.top.x, bw = Z.top.w, by = Z.mid.y + 20;
        let x = bx;
        [[0.6, '#E9DFD0'], [0.3, '#7A8450'], [0.1, '#C4673F']].forEach(([f, c], k) => {
          const p = ease.outCubic(clamp((t - s.t0 - k * 0.3) / 0.45)); if (p > 0) R(ctx, x, by, bw * f * p, 70, k === 1 ? 0 : 16, c); x += bw * f;
        });
        stamp(ctx, 'SALVA PRA USAR', CX, Z.top.y + 170, t, S.cue(6, 'salva'), { size: 80, align: 'center' });
        stamp(ctx, 'NA PRÓXIMA COMPRA', CX, Z.top.y + 270, t, S.cue(6, 'próxima'), { size: 70, align: 'center', color: B.gold });
      }
      // a soft white flash on each scene change
      const fl = i > 0 ? 0.45 * Math.exp(-(t - s.t0) * 12) : 0;
      if (fl > 0.01) { ctx.fillStyle = `rgba(255,248,232,${fl})`; ctx.fillRect(0, 0, W, H); }
    },
    post: { paper: 0.12, vignette: 0.3, grain: 0.04 },
  });
})();

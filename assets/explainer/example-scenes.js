// EXAMPLE of the format the animator writes: ONE kit function + ONE function per scene.
// (Topic: "a fórmula 60-30-10". Only some scenes are shown.)
// H = helpers (always available):
//   H.U H.G H.Data H.W H.H  ·  H.clamp H.lerp H.ease  ·  H.Z (zones: H.Z.top/mid/caption, H.Z.cx)  ·  H.B (brand colours)
//   H.PAL (topic palette) · H.C (fixed object colours from Configurações, e.g. H.C['sofá']) · H.F ('Poppins') · H.cue(i, 'palavra', frac) → time the narrator says it
//   H.R(ctx,x,y,w,h,r,fill) rounded rect · H.E(ctx,cx,cy,rx,ry,fill) ellipse · H.txt(ctx,str,x,y,{size,color,align,weight,alpha})
//   H.stamp(ctx,str,x,y,t,t0,opts) text that slams in at t0 · H.arrow(ctx,x1,y1,x2,y2,{color,lw,head,p}) arrow drawn up to p∈[0,1]
//   H.prog(t,a,b) → 0..1 between times a and b (clamped)
// The shell already paints the background, the series tag and a flash on every scene change.

// ---------- KIT: drawings reused by several scenes ----------
function kit(H) {
  const { R, E, G, clamp, ease } = H;
  const RW = 900, RH = 820;
  const OBJ = { wall: ['#2EC4B6', '#E9DFD0'], floor: ['#8E5BD9', '#D9CCB7'], sofa: ['#E63946', '#F2EADF'], cushions: ['#FF4D9D', '#C4673F'] };
  const DRAW = {
    wall: (ctx, c) => R(ctx, 0, 0, 900, 600, 0, c),
    floor: (ctx, c) => R(ctx, 0, 600, 900, 220, 0, c),
    sofa: (ctx, c) => { R(ctx, 360, 380, 440, 140, 26, G.tint(c, -0.12)); R(ctx, 345, 500, 470, 95, 18, c); },
    cushions: (ctx, c) => { R(ctx, 395, 405, 92, 90, 22, c); R(ctx, 673, 405, 92, 90, 22, c); },
  };
  // room(ctx, x, y, scale, colourOf(key) → hex)
  function room(ctx, x, y, s, colourOf) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, RW, RH, 28); ctx.clip();
    for (const k of ['wall', 'floor', 'sofa', 'cushions']) DRAW[k](ctx, colourOf(k));
    ctx.restore(); ctx.restore();
  }
  const chaos = (k) => OBJ[k][0], fin = (k) => OBJ[k][1];
  // place the room centred in the middle zone
  const fit = (Z, k = 1) => { const s = Math.min(Z.mid.w / RW, Z.mid.h / RH) * k; return { s, x: Z.cx - (RW * s) / 2, y: Z.mid.y + (Z.mid.h - RH * s) / 2 }; };
  return { room, chaos, fin, fit, RW, RH };
}

// ---------- CENA 0 (gancho): full frame from t = 0 — clashing room + hook text ----------
function scene(ctx, t, s, H, K) {
  const { Z, B } = H;
  const f = K.fit(Z);
  const jig = Math.sin(t * 9) * 0.01;
  ctx.save(); ctx.translate(Z.cx, Z.mid.y + Z.mid.h / 2); ctx.rotate(jig); ctx.translate(-Z.cx, -(Z.mid.y + Z.mid.h / 2));
  K.room(ctx, f.x, f.y, f.s, K.chaos);
  ctx.restore();
  // frame 0 is already complete: hook text drawn directly (no entrance), only a small pulse for life
  const pulse = 1 + 0.03 * Math.sin(t * 6);
  H.txt(ctx, 'SUA SALA PARECE', Z.top.x, Z.top.y + 160, { size: 72 });
  ctx.save(); ctx.translate(Z.top.x, Z.top.y + 280); ctx.scale(pulse, pulse);
  H.txt(ctx, 'BAGUNÇADA?', 0, 0, { size: 112, color: B.gold }); ctx.restore();
}

// ---------- CENA 2: 60% — base colour painted when the narrator says each word ----------
function scene(ctx, t, s, H, K) {
  const { Z, B, Data, F } = H;
  const f = K.fit(Z);
  const at = { wall: H.cue(2, 'paredes'), floor: H.cue(2, 'piso'), sofa: H.cue(2, 'sofá') };
  K.room(ctx, f.x, f.y, f.s, (k) => (at[k] !== undefined && t >= at[k] ? K.fin(k) : K.chaos(k)));
  Data.counter(ctx, { x: Z.top.x, y: Z.top.y + 260, from: 0, to: 60, t, t0: s.t0, t1: s.t0 + 0.6, size: 180, color: '#E9DFD0', align: 'left', fam: F, weight: 700, suffix: '%' });
  H.txt(ctx, 'COR BASE', Z.top.x, Z.top.y + 330, { size: 52, color: B.gold, alpha: H.prog(t, s.t0 + 0.2, s.t0 + 0.5) });
}

// ---------- CENA 6 (final): recap bar + CTA ----------
function scene(ctx, t, s, H, K) {
  const { Z, B, R, ease } = H;
  let x = Z.top.x;
  [[0.6, '#E9DFD0'], [0.3, '#7A8450'], [0.1, '#C4673F']].forEach(([w, c], k) => {
    const p = ease.outCubic(H.prog(t, s.t0 + k * 0.3, s.t0 + k * 0.3 + 0.45));
    if (p > 0) R(ctx, x, Z.mid.y + 20, Z.top.w * w * p, 70, 16, c);
    x += Z.top.w * w;
  });
  const f = K.fit(Z, 0.7);
  K.room(ctx, f.x, f.y + 120, f.s, K.fin);
  H.stamp(ctx, 'SALVA PRA USAR', Z.cx, Z.top.y + 170, t, H.cue(6, 'salva'), { size: 80, align: 'center' });
  H.stamp(ctx, 'NA PRÓXIMA COMPRA', Z.cx, Z.top.y + 270, t, H.cue(6, 'próxima'), { size: 70, align: 'center', color: B.gold });
}

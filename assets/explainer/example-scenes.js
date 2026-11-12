// EXAMPLE of the format the animator writes: ONE kit function + ONE function per scene.
// (Topic: "o tamanho certo do tapete". Some scenes shown.) Text and animated graphics come from H.M;
// only the illustration (room, sofa, rug) is drawn by hand, in the kit.
// H = helpers: H.U H.G H.Data H.W H.H · H.clamp H.lerp H.ease · H.Z (zones: top/mid/caption, cx) · H.B (brand)
//   H.PAL (topic palette) · H.C (fixed object colours from Configurações, e.g. H.C['sofá']) · H.F ('Poppins')
//   H.cue(i, 'palavra', frac) → time the narrator says it · H.M motion library (see the table)
//   H.R(ctx,x,y,w,h,r,fill) rounded rect · H.E(ctx,cx,cy,rx,ry,fill) ellipse · H.txt(ctx,str,x,y,{size,color,align,weight,alpha})
//   H.prog(t,a,b) → 0..1 between times a and b

// ---------- KIT: the illustration reused by several scenes ----------
function kit(H) {
  const { R, G } = H;
  // room(ctx, x, y, scale, {rug: width, under: how far the rug goes under the sofa})
  function room(ctx, x, y, s, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    R(ctx, 0, 0, 900, 560, 24, H.C['parede'] || '#E9DFD0');
    R(ctx, 0, 560, 900, 260, 0, H.C['piso'] || '#C9A97E');
    const sofa = H.C['sofá'] || '#7A8450';
    R(ctx, 220, 400, 460, 130, 26, G.tint(sofa, -0.15)); R(ctx, 200, 500, 500, 100, 20, sofa);
    R(ctx, 215, 598, 20, 30, 4, '#5a3d26'); R(ctx, 665, 598, 20, 30, 4, '#5a3d26');
    R(ctx, 450 - o.rug / 2, 640 - o.under, o.rug, 90 + o.under, 12, H.PAL[0] || '#C4673F');
    ctx.restore();
  }
  // fit the room in the middle zone; also returns where the sofa's front feet are
  const fit = (Z, k = 0.95) => {
    const s = Math.min(Z.mid.w / 900, Z.mid.h / 820) * k, x = Z.cx - 450 * s, y = Z.mid.y + (Z.mid.h - 820 * s) / 2;
    return { s, x, y, feet: { x: x + 225 * s, y: y + 628 * s } };
  };
  return { room, fit };
}

// ---------- CENA 0 (gancho): frame 0 already full — title + room + a wiggle; circle on "sala" ----------
// beats: "sala" → circle
function scene(ctx, t, s, H, K) {
  const { Z, M } = H, f = K.fit(Z);
  ctx.save(); ctx.translate(Z.cx, f.y + 400 * f.s); ctx.rotate(Math.sin(t * 8) * 0.008); ctx.translate(-Z.cx, -(f.y + 400 * f.s));
  K.room(ctx, f.x, f.y, f.s, { rug: 260 + 20 * Math.sin(t * 3), under: 0 });
  ctx.restore();
  M.title(ctx, t, { text: 'Seu tapete deixa a sala MENOR', at: 0, y: Z.top.y + 170, hl: 'menor' });
  M.circle(ctx, t, { x: Z.cx, y: f.y + 685 * f.s, rx: 200, ry: 90, at: H.cue(0, 'sala') });
}

// ---------- CENA 1: the mistake as a comparison ----------
// beats: "erro" → keyword "O ERRO" · "tapete" → compare (the panels are already entering at s.t0; the word fires the ✗/✓)
function scene(ctx, t, s, H, K) {
  const { Z, M } = H;
  M.keyword(ctx, t, { text: 'O erro', at: H.cue(1, 'erro'), y: Z.top.y + 230, label: 'erro #1' });
  const mini = (rug, under) => (c, b) => K.room(c, b.x, b.y + 60, b.w / 900, { rug, under });
  M.compare(ctx, t, { at: s.t0 + 0.05, markAt: H.cue(1, 'tapete'), y: Z.mid.y + 40, h: 640,
    left: { label: 'pequeno', ok: false, draw: mini(220, 0) },
    right: { label: 'no sofá', ok: true, draw: mini(640, 60) } });
}

// ---------- CENA 2: the rule — rug grows under the feet (desenho), number + ruler ----------
// beats: "pés" → desenho · "vinte" → counter "20 cm" · "frente" → arrow
function scene(ctx, t, s, H, K) {
  const { Z, M, ease, prog } = H, f = K.fit(Z);
  const g = ease.outBack(prog(t, H.cue(2, 'pés'), H.cue(2, 'pés') + 0.6), 1.4);
  K.room(ctx, f.x, f.y, f.s, { rug: 260 + 440 * g, under: 70 * g });
  M.counter(ctx, t, { to: 20, at: H.cue(2, 'vinte'), suffix: ' cm', label: 'pés em cima', y: Z.top.y + 220, size: 170 });
  M.ruler(ctx, t, { x1: f.feet.x, y1: f.feet.y - 60 * f.s, x2: f.feet.x, y2: f.feet.y + 40, at: H.cue(2, 'vinte') + 0.2, label: '20 cm' });
  M.arrow(ctx, t, { x1: Z.cx + 300, y1: Z.mid.y + 90, x2: f.x + 690 * f.s, y2: f.y + 610 * f.s, at: H.cue(2, 'frente'), bend: 0.25 });
}

// ---------- CENA 3: recap as a checklist, one item per spoken word ----------
// beats: "frente" → checklist · "quarenta" → checklist · "maior" → checklist
function scene(ctx, t, s, H, K) {
  const { Z, M } = H;
  M.tag(ctx, t, { text: 'regra do tapete', at: s.t0, y: Z.top.y + 120 });
  M.checklist(ctx, t, { y: Z.top.y + 260, items: [
    { text: 'Pés da frente em cima', at: H.cue(3, 'frente') },
    { text: '40 cm de cada lado', at: H.cue(3, 'quarenta') },
    { text: 'Maior que o sofá', at: H.cue(3, 'maior') }] });
  const f = K.fit(Z, 0.55), y = Z.mid.y + Z.mid.h - 820 * f.s; // small room at the bottom of the middle zone
  M.enter(ctx, M.life(t, s.t0 + 0.2), 'up', Z.cx, y + 400 * f.s, () => K.room(ctx, f.x, y, f.s, { rug: 700, under: 70 }));
}

// ---------- CENA 5 (final): the script's call (here: compartilhar "MANDA PRA QUEM VAI COMPRAR TAPETE") ----------
// beats: "manda" → cta
function scene(ctx, t, s, H, K) {
  const { M } = H;
  M.cta(ctx, t, { at: s.t0 + 0.05, kind: 'compartilhar', text: 'MANDA PRA QUEM VAI COMPRAR TAPETE' });
}

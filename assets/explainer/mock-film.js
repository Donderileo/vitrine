// Offline stand-in used when LLM_PROVIDER=mock: one title card per scene, so the whole pipeline can be tested for free.
(function () {
  const U = globalThis.U, G = globalThis.G, S = globalThis.SCORE, Studio = globalThis.Studio;
  const { clamp, ease, lerp } = U;
  const Z = S.ZONES, B = S.BRAND, F = 'Poppins';
  Studio.film({
    async init() { await Studio.loadFont(F, 'assets/Poppins-Bold.ttf', 700); await Studio.loadFont(F, 'assets/Poppins-Medium.ttf', 500); },
    draw(ctx, t) {
      ctx.fillStyle = B.bg; ctx.fillRect(0, 0, G.W, G.H);
      const i = Math.max(0, S.SCENES.findIndex((s) => t >= s.t0 && t < s.t1)), s = S.SCENES[i];
      const a = clamp((t - s.t0) / 0.3), k = lerp(1.4, 1, ease.outBack(a, 2));
      if (S.series) G.text(ctx, S.series.toUpperCase(), Z.top.x, Z.top.y + 30, { fam: F, weight: 500, size: 30, color: B.gold });
      ctx.save(); ctx.translate(Z.cx, Z.top.y + 220); ctx.scale(k, k);
      G.text(ctx, s.onScreen, 0, 0, { fam: F, weight: 700, size: 76, color: B.ink, align: 'center', alpha: a });
      ctx.restore();
      const r = 180 + 20 * Math.sin(t * 3), c = (S.PALETTE[i % Math.max(1, S.PALETTE.length)]) || B.gold;
      G.ellipse(ctx, Z.cx, Z.mid.y + Z.mid.h / 2, r, r, { fill: c, lw: 0 });
      G.text(ctx, String(i + 1), Z.cx, Z.mid.y + Z.mid.h / 2 + 50, { fam: F, weight: 700, size: 150, color: B.bg, align: 'center' });
    },
    post: { paper: 0.1, vignette: 0.3, grain: 0.03 },
  });
})();

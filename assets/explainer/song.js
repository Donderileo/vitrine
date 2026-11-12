// Vitrine explainer soundtrack: narration on top, a lofi bed ducked under it, and the film's SFX cues.
// Generated projects copy this file as-is; everything it needs comes from score.js and sfx.json.
const fs = require('fs');
const path = require('path');
const { SR, Bus, reverb } = require('./engine/audio/dsp');
const I = require('./engine/audio/instruments');
const MIX = require('./engine/audio/mix');
const Genre = require('./engine/audio/genres');
const sc = require('./score');
const { DURATION, clock } = sc;

const N = Math.ceil(DURATION * SR);
const bus = () => new Bus(N);
const drums = bus(), bass = bus(), pad = bus(), keys = bus(), fx = bus(), verb = bus();
const bars = Math.ceil(DURATION / clock.BAR) + 1;
// EXPLAINER_MUSIC=lofi (default) | none · EXPLAINER_MUSIC_VOLUME=1 (0.5 = half)
const MUSIC = process.env.EXPLAINER_MUSIC || 'lofi';
const VOL = Number(process.env.EXPLAINER_MUSIC_VOLUME || '1');
if (MUSIC !== 'none') Genre.play('lofi', { clock, from: 0, to: bars, chordAt: sc.chordAt, buses: { drums, bass, pad, keys }, gain: 0.8 });

// SFX (sfx.json: [{t, kind}]) — one per motion beat + scene changes. kind: pop whoosh swoosh thud chime tick ding
let sfx = [];
try { sfx = JSON.parse(fs.readFileSync(path.join(__dirname, 'sfx.json'), 'utf8')); } catch { /* none */ }
const NOTES = [72, 76, 79, 84, 88, 91];
sfx.forEach((s, i) => {
  if (!(s.t >= 0 && s.t < DURATION)) return;
  if (s.kind === 'pop') fx.addMono(I.pop(1 + (i % 4) * 0.1), s.t, 0.3);
  else if (s.kind === 'whoosh') fx.addMono(I.noiseSweep(0.45, 400, 5000, { q: 0.9, pink: true }), Math.max(0, s.t - 0.4), 0.22);
  else if (s.kind === 'thud') fx.addMono(I.thud(80, 0.09), s.t, 0.5);
  else if (s.kind === 'swoosh') fx.addMono(I.noiseSweep(0.7, 250, 3200, { q: 0.8, pink: true }), Math.max(0, s.t - 0.5), 0.26);
  else if (s.kind === 'tick') fx.addMono(I.rim(1.4, i + 1), s.t, 0.16);
  else if (s.kind === 'ding') { const x = I.bell(1568, 0.5); fx.addMono(x, s.t, 0.1); verb.addMono(x, s.t, 0.06); }
  else { const x = I.marimba(NOTES[i % NOTES.length], { thock: 0.1 }); keys.addMono(x, s.t, 0.35); verb.addMono(x, s.t, 0.2); } // chime
});

const voice = fs.existsSync(path.join(__dirname, 'voice.wav'))
  ? MIX.loadAudio(path.join(__dirname, 'voice.wav'), { length: DURATION }) : bus();
const music = [drums, bass, pad, keys];
MIX.duck(music, voice, { depth: 0.65, release: 0.35 });

// music under a clean voice
const mix = MIX.mixdown({ drums, bass, pad, keys, fx, verb: reverb(verb, { room: 0.8, damp: 0.35 }) },
  { drums: 0.35 * VOL, bass: 0.55 * VOL, pad: 1.4 * VOL, keys: 0.6 * VOL, fx: 0.8, verb: VOL });
// NOTE: no Genre.fx('lofi') — it adds a vinyl-crackle bed (heard as hiss under the voice) and tape wobble.
// Keep only its warm low-pass (tames hi-hat sizzle), without crackle or wobble.
MIX.lofi(mix, { wow: 0, flutter: 0, lowpass: 4500 });
for (let i = 0; i < Math.min(mix.n, voice.n); i++) { mix.L[i] += voice.L[i] * 1.6; mix.R[i] += voice.R[i] * 1.6; }
MIX.highpass(mix, 30);
MIX.fadeOut(mix, DURATION - 1.2, DURATION);
const M = MIX.master(mix, 0.8, undefined, { lufs: -14 });
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
MIX.writeWav(path.join(__dirname, 'out', 'music.wav'), mix);
console.log(`wrote out/music.wav (${DURATION.toFixed(2)}s, ${M.lufs.toFixed(1)} LUFS)`);

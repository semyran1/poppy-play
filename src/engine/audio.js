// Звук целиком из кода: синтез эффектов в AudioBuffer (по мотивам ZzFX); музыка — в music.js.
import { musicInit } from './music.js';
let ac = null, master = null, sfxBus = null, musicBus = null;
const cache = new Map();
export const audioState = { sfx: 0.8, music: 0.45, muted: false };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  comp.connect(master);
  sfxBus = ac.createGain(); sfxBus.connect(comp);
  musicBus = ac.createGain(); musicBus.connect(comp);
  applyVolumes();
  musicInit(ac, musicBus, () => (audioState.muted ? 0 : audioState.music));
}
export function applyVolumes() {
  if (!ac) return;
  master.gain.value = audioState.muted ? 0 : 1;
  sfxBus.gain.value = audioState.sfx;
  musicBus.gain.value = audioState.music;
}
export function suspendAudio(on) { if (!ac) return; on ? ac.suspend() : ac.resume(); }

// p: { f: частота, f2: конечная частота, d: длительность, w: 'sin'|'sqr'|'saw'|'tri'|'noise',
//      a: атака, v: громкость, vib: [частота, глубина], crush: шаг квантования, lp: 0..1 сглаживание }
function synth(p) {
  const sr = ac.sampleRate, n = Math.max(1, Math.floor(sr * p.d));
  const buf = ac.createBuffer(1, n, sr), out = buf.getChannelData(0);
  let phase = 0, prev = 0, noiseVal = 0, noiseT = 0;
  const a = p.a ?? 0.005, w = p.w || 'sqr', v = p.v ?? 0.5, f2 = p.f2 ?? p.f;
  for (let i = 0; i < n; i++) {
    const t = i / sr, k = i / n;
    let f = p.f * Math.pow(f2 / p.f, k);
    if (p.vib) f *= 1 + Math.sin(t * p.vib[0] * 6.283) * p.vib[1];
    phase += f / sr;
    const ph = phase % 1;
    let s;
    if (w === 'sin') s = Math.sin(ph * 6.283);
    else if (w === 'tri') s = 1 - 4 * Math.abs(ph - 0.5);
    else if (w === 'saw') s = 2 * ph - 1;
    else if (w === 'noise') { noiseT += f / sr; if (noiseT >= 1) { noiseT -= 1; noiseVal = Math.random() * 2 - 1; } s = noiseVal; }
    else s = ph < (p.duty ?? 0.5) ? 1 : -1;
    if (p.crush) s = Math.round(s / p.crush) * p.crush;
    if (p.lp) { s = prev + (s - prev) * (1 - p.lp); prev = s; }
    const env = t < a ? t / a : Math.pow(1 - (t - a) / (p.d - a + 1e-6), p.curve ?? 1.6);
    out[i] = s * env * v;
  }
  return buf;
}

export const SFX = {
  shoot:   { f: 880, f2: 440, d: 0.06, w: 'sqr', v: 0.12, duty: 0.25 },
  shoot2:  { f: 600, f2: 900, d: 0.08, w: 'tri', v: 0.18 },
  pop:     { f: 520, f2: 1400, d: 0.09, w: 'sin', v: 0.45 },
  popBig:  { f: 240, f2: 900, d: 0.16, w: 'tri', v: 0.5 },
  splat:   { f: 1800, f2: 200, d: 0.18, w: 'noise', v: 0.35, lp: 0.6 },
  hurt:    { f: 300, f2: 90, d: 0.3, w: 'saw', v: 0.4, vib: [30, 0.1] },
  pickup:  { f: 900, f2: 1700, d: 0.07, w: 'sin', v: 0.25 },
  coin:    { f: 1300, f2: 2100, d: 0.09, w: 'sqr', v: 0.12, duty: 0.5 },
  levelup: { f: 400, f2: 1600, d: 0.45, w: 'tri', v: 0.4, vib: [12, 0.04], curve: 0.8 },
  select:  { f: 700, f2: 1000, d: 0.08, w: 'sqr', v: 0.15 },
  boom:    { f: 900, f2: 40, d: 0.5, w: 'noise', v: 0.6, lp: 0.75 },
  fart:    { f: 90, f2: 60, d: 0.45, w: 'saw', v: 0.35, vib: [24, 0.35], lp: 0.5 },
  zap:     { f: 2400, f2: 300, d: 0.12, w: 'saw', v: 0.18 },
  whoosh:  { f: 400, f2: 2000, d: 0.2, w: 'noise', v: 0.2, lp: 0.85 },
  thud:    { f: 160, f2: 50, d: 0.2, w: 'sin', v: 0.6 },
  bossHit: { f: 200, f2: 120, d: 0.12, w: 'sqr', v: 0.25, crush: 0.5 },
  ach:     { f: 660, f2: 1320, d: 0.6, w: 'tri', v: 0.35, vib: [8, 0.03], curve: 0.6 },
  heal:    { f: 500, f2: 1000, d: 0.35, w: 'sin', v: 0.35, vib: [10, 0.05] },
  splash:  { f: 3000, f2: 600, d: 0.3, w: 'noise', v: 0.25, lp: 0.4 },
};

const lastPlay = new Map();
export function sfx(name, opts = {}) {
  if (!ac || audioState.muted) return;
  const p = SFX[name]; if (!p) return;
  const now = ac.currentTime;
  if ((lastPlay.get(name) || 0) > now - (opts.gap ?? 0.03)) return; // не наслаивать один звук в одном кадре
  lastPlay.set(name, now);
  let buf = cache.get(name); if (!buf) { buf = synth(p); cache.set(name, buf); }
  const src = ac.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = (opts.pitch ?? 1) * (1 + (Math.random() - 0.5) * (opts.jitter ?? 0.08));
  const g = ac.createGain(); g.gain.value = opts.vol ?? 1;
  src.connect(g); g.connect(sfxBus); src.start();
}

// ---- Музыка: в music.js (форма песни, гармония, слои, реверб). Здесь только подключение к musicBus.
export { playMusic, stopMusic, setMusicIntensity, musicInfo, SONGS } from './music.js';

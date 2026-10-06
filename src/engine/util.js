// Математика, случайность, твины, частицы, всплывающие цифры, сохранение.
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const TAU = Math.PI * 2;
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function weighted(items, wKey = 'w') {
  const tot = items.reduce((s, i) => s + (i[wKey] ?? 1), 0); let r = Math.random() * tot;
  for (const i of items) { r -= i[wKey] ?? 1; if (r <= 0) return i; }
  return items[items.length - 1];
}

export const ease = {
  outCubic: t => 1 - (1 - t) ** 3,
  inCubic: t => t ** 3,
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  outElastic: t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

// Твины по объекту: tween(obj, {x: 10}, 0.3, ease.outBack)
export class Tweens {
  constructor() { this.list = []; }
  add(obj, to, dur, fn = ease.outCubic, delay = 0, done) {
    const from = {}; for (const k in to) from[k] = obj[k];
    this.list.push({ obj, from, to, dur, fn, t: -delay, done }); return this;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i]; tw.t += dt; if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur), e = tw.fn(k);
      for (const p in tw.to) tw.obj[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * e;
      if (k >= 1) { this.list.splice(i, 1); tw.done?.(); }
    }
  }
}

// Частицы: пул фиксированного размера, без аллокаций в бою
export class Particles {
  constructor(n = 900) { this.p = Array.from({ length: n }, () => ({ alive: false })); this.i = 0; }
  spawn(o) {
    for (let k = 0; k < this.p.length; k++) {
      const q = this.p[this.i = (this.i + 1) % this.p.length];
      if (!q.alive) { Object.assign(q, { alive: true, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 0.5, t: 0, size: 4, size2: 0, color: '#fff', shape: 'circle', rot: 0, vr: 0, alpha: 1, glow: false, ground: 0 }, o); return q; }
    }
    return null;
  }
  burst(x, y, n, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = o.angle !== undefined ? o.angle + rand(-o.spread, o.spread) : rand(TAU), sp = rand(o.speed?.[0] ?? 60, o.speed?.[1] ?? 220);
      this.spawn({ ...o, x: x + rand(-(o.jitter || 0), o.jitter || 0), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(o.life?.[0] ?? 0.3, o.life?.[1] ?? 0.7), size: rand(o.size?.[0] ?? 2, o.size?.[1] ?? 6), color: Array.isArray(o.color) ? o.color[k % o.color.length] : o.color, rot: rand(TAU), vr: rand(-8, 8) });
    }
  }
  update(dt, groundY) {
    for (const q of this.p) {
      if (!q.alive) continue;
      q.t += dt; if (q.t >= q.life) { q.alive = false; continue; }
      q.vy += q.g * dt; q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      if (q.ground && q.y > groundY) { q.y = groundY; q.vy *= -0.3; q.vx *= 0.6; }
    }
  }
  draw(ctx) {
    for (const q of this.p) {
      if (!q.alive) continue;
      const k = q.t / q.life, s = q.size + (q.size2 - q.size) * k;
      ctx.globalAlpha = q.alpha * (1 - k * k);
      ctx.fillStyle = q.color;
      if (q.glow) ctx.globalCompositeOperation = 'lighter';
      if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, s), 0, TAU); ctx.fill(); }
      else if (q.shape === 'rect') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-s, -s / 2, s * 2, s); ctx.restore(); }
      else if (q.shape === 'ring') { ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, 3 * (1 - k)); ctx.beginPath(); ctx.arc(q.x, q.y, s, 0, TAU); ctx.stroke(); }
      else if (q.shape === 'star') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); star(ctx, s); ctx.fill(); ctx.restore(); }
      else if (q.shape === 'drop') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx) + Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.quadraticCurveTo(s, 0, 0, s); ctx.quadraticCurveTo(-s, 0, 0, -s * 1.8); ctx.fill(); ctx.restore(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}
export function star(ctx, r, n = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rr = i % 2 ? r * inner : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
}

// Всплывающие тексты (урон, «+1», реплики)
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, o = {}) { this.list.push({ x, y, text, t: 0, life: o.life ?? 0.8, color: o.color ?? '#fff', size: o.size ?? 18, vy: o.vy ?? -60, outline: o.outline ?? '#2a0a14' }); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const f = this.list[i]; f.t += dt; f.y += f.vy * dt; f.vy *= 0.94; if (f.t > f.life) this.list.splice(i, 1); } }
  draw(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.list) {
      const k = f.t / f.life, pop = f.t < 0.08 ? 0.6 + f.t / 0.08 * 0.6 : 1.2 - Math.min(0.2, (f.t - 0.08) * 2);
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.font = `900 ${Math.round(f.size * pop)}px "Nunito", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = f.outline; ctx.lineJoin = 'round'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}

// Сохранение: localStorage с try/catch (в приватном режиме может падать)
const KEY = 'poppy2.save.v1';
export function loadSave(def) {
  let raw = null;
  try { raw = localStorage.getItem(KEY); const s = JSON.parse(raw); return isPlain(s) ? deepMerge(structuredClone(def), s) : structuredClone(def); }
  catch { try { if (raw) localStorage.setItem(KEY + '.corrupt', raw.slice(0, 500000)); } catch { } return structuredClone(def); }   // испорченную строку не теряем: копия в poppy2.save.v1.corrupt (первая запись игры перезапишет основной ключ)
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { } }
// Слияние загруженного поверх умолчаний. Несовместимые по типу значения (null, число вместо объекта, массив вместо объекта, строка вместо числа, NaN)
// игнорируются — остаётся умолчание; ключи __proto__ / constructor / prototype пропускаются (иначе сейв мог бы загрязнить Object.prototype).
// Ключи без умолчания (acc, offers, hints…) переносятся как есть — их разбирает normalizeSave (game/savefix.js).
const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(a, b) {
  for (const k of Object.keys(b)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const bv = b[k], av = a[k];
    if (isPlain(av)) { if (isPlain(bv)) deepMerge(av, bv); }
    else if (Array.isArray(av)) { if (Array.isArray(bv)) a[k] = bv; }
    else if (av !== undefined && av !== null) { if (typeof bv === typeof av && (typeof bv !== 'number' || Number.isFinite(bv))) a[k] = bv; }
    else a[k] = bv;
  }
  return a;
}

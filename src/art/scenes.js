// Реестр векторных ассетов, перенесённых с оригинала (tools/vectorize.py). Модули тяжёлые (0,4–1 МБ),
// поэтому грузятся лениво: preload(['hall', ...]) перед сценой; пока не загружено — рисуется запасной фон.
import { drawVec } from './vec.js';
import { FACES } from './faces.js';

// Фоны v2 — новый стиль (Nano Banana по кадру героини → вектор, tools/revec_bg2.sh); старые файлы оставлены в vec/
const LOADERS = {
  facade: () => import('./vec/facade2.js'), hall: () => import('./vec/hall2.js'), corridor: () => import('./vec/corridor2.js'),
  queue: () => import('./vec/queue2.js'), title: () => import('./vec/title.js'), street: () => import('./vec/street2.js'),
  castle: () => import('./vec/castle2.js'), gothic: () => import('./vec/gothic2.js'), restroom: () => import('./vec/gothic2.js'),
  sunset: () => import('./vec/sunset.js'), finale: () => import('./vec/finale2.js'), dead: () => import('./vec/dead2.js'),
  victory: () => import('./vec/victory2.js'), facade2: () => import('./vec/facade2.js'), lair: () => import('./vec/lair2.js'),
  crush: () => import('./vec/crush2.js'), crushFace: () => import('./vec/crushFace.js'),   // Краш v2: вампир в стиле героини
  crushRun: () => import('./vec/crushRun.js'), ruda: () => import('./vec/ruda.js'),   // (раньше склеены в одну строку-комментарий: Руда и бегущий Краш не грузились)
};
const DATA = {}, PENDING = {};
export function preload(names) {
  return Promise.all(names.map(n => {
    if (DATA[n] || !LOADERS[n]) return null;
    return PENDING[n] ??= LOADERS[n]().then(m => { DATA[n] = m.default; }).catch(e => console.error('vec', n, e));
  }));
}
export const loaded = n => !!DATA[n];

// Фон на весь экран (живописный — с лёгким размытием, как у оригинала)
export function drawSceneBg(ctx, name, x = 0, y = 0, w = 960, h = 540) {
  const d = DATA[name]; if (!d) { preload([name]); return false; }
  drawVec(ctx, d, x, y, w, h, name, 0.5);
  return true;
}
// Персонаж: ноги в (x, y), высота h; flip — зеркально
export function drawActor(ctx, name, x, y, h, o = {}) {
  const d = DATA[name]; if (!d) { preload([name]); return false; }
  const w = d.w * h / d.h;
  ctx.save(); ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  drawVec(ctx, d, -w / 2, -h, w, h, name, 0, name === 'crush' ? null : FACES[name] || null);   // у нового Краша своё лицо
  ctx.restore();
  return true;
}
// Портрет: кроп по прямоугольнику в координатах вектора, вписанный в квадрат size
export function drawPortrait(ctx, name, x, y, size, crop) {
  if (name === 'crush') {   // Краш v2: крупный план с листа, целиком в рамке
    const f = DATA.crushFace; if (!f) { preload(['crushFace']); return false; }
    const k = size * 0.98 / f.w;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 12); ctx.clip();
    drawVec(ctx, f, x + size * 0.01, y + size * 0.03, f.w * k, f.h * k, 'crushFace@p' + size);
    ctx.restore(); return true;
  }
  const d = DATA[name]; if (!d) { preload([name]); return false; }
  const [cx, cy, cw] = crop, k = size / cw;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 12); ctx.clip();
  drawVec(ctx, d, x - cx * k, y - cy * k, d.w * k, d.h * k, name + '@p', 0, FACES[name] || null);
  ctx.restore();
  return true;
}

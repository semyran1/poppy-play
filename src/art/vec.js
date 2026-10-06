// Рендер векторных ассетов (снятых с оригинала tools/vectorize.py): слои цвета -> Path2D.
// Слой заливается и обводится своим же цветом на 0,9 px — так между соседними областями нет щелей.
// Готовая картинка кэшируется в offscreen-холст под нужный размер (векторы остаются источником).
const paths = new WeakMap();
const bitmaps = new Map();
let DPR = Math.min(window.devicePixelRatio || 1, 2);

function layerPaths(data) {
  let p = paths.get(data);
  if (!p) { p = data.layers.map(([c, d, st]) => [c, new Path2D(d), st !== 0]); paths.set(data, p); }
  return p;
}
// Заливка слоя: цвет '#rrggbb' или линейный градиент [x0,y0,x1,y1,c0,c1], подобранный по пикселям оригинала
function fillOf(ctx, c) {
  if (typeof c === 'string') return c;
  const g = ctx.createLinearGradient(c[0], c[1], c[2], c[3]); g.addColorStop(0, c[4]); g.addColorStop(1, c[5]); return g;
}

// Нарисовать вектор напрямую (дорого, для превью и единичных кадров)
export function drawVecRaw(ctx, data, x, y, w, h, blur = 0, overlay = null) {
  ctx.save(); if (blur) ctx.filter = `blur(${blur}px)`; ctx.translate(x, y); ctx.scale(w / data.w, h / data.h);
  ctx.lineJoin = 'round'; ctx.lineWidth = 0.9 * data.w / w;
  // тонкие области (блики-линии) без обводки — иначе они толще и ярче оригинала
  for (const [c, p, st] of layerPaths(data)) { const f = fillOf(ctx, c); ctx.fillStyle = f; ctx.fill(p, 'evenodd'); if (st) { ctx.strokeStyle = f; ctx.stroke(p); } }
  ctx.filter = 'none';
  if (overlay) overlay(ctx);   // лицо и прочие замеренные детали — в тех же координатах вектора
  ctx.restore();
}

// Нарисовать через кэш-битмап (для игры: фоны, персонажи сцен)
// blur > 0 — мягкость живописного фона (как у оригинальных артов), 0 — чёткие персонажи
const MAX_BITMAPS = 8;   // на один рисунок: переменный размер (анимация, масштаб, раздувание) не должен копить сотни холстов — самый старый вытесняется и освобождается
export function drawVec(ctx, data, x, y, w, h, key, blur = 0, overlay = null) {
  const k = (key || '') + '|' + w + 'x' + h + '@' + DPR + '|' + blur;
  let m = bitmaps.get(data); if (!m) bitmaps.set(data, m = new Map());
  let bm = m.get(k);
  if (bm) { if (m.size > 1) { m.delete(k); m.set(k, bm); } }   // свежесть: недавно использованный — в конец
  else {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const cx = c.getContext('2d'); cx.scale(DPR, DPR); drawVecRaw(cx, data, 0, 0, w, h, blur * DPR, overlay);
    m.set(k, c); bm = c;
    while (m.size > MAX_BITMAPS) { const old = m.keys().next().value, oc = m.get(old); m.delete(old); oc.width = oc.height = 0; }
  }
  ctx.drawImage(bm, x, y, w, h);
}

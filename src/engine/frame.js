// «Дизайн-рамка» 960×540 внутри динамического вида (см. шапку core.js) и эмбиент вокруг неё.
// Сцены, нарисованные строго в 960×540 (меню, сюжет, мета-магазин, гардероб, экраны смерти / итогов / паузы / карт боя),
// рисуются через withFrame(): трансформация translate+scale, указатель переводится в координаты рамки.
// Поля вокруг рамки заполняет paintAmbient(): размытая увеличенная копия уже нарисованного кадра + затемнение (без швов).
import { view, DESIGN_W, DESIGN_H } from './core.js';

const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');

// Прямоугольник рамки в координатах вида
export const frameRect = () => { const f = view.frame; return { x: f.ox, y: f.oy, w: DESIGN_W * f.s, h: DESIGN_H * f.s }; };
// Весь вид в координатах рамки (для затемнений «на весь экран» внутри withFrame)
export const fullRect = () => { const f = view.frame; return { x: -f.ox / f.s, y: -f.oy / f.s, w: view.W / f.s, h: view.H / f.s }; };
export function fillFull(ctx, style) { const r = fullRect(); ctx.fillStyle = style; ctx.fillRect(r.x, r.y, r.w, r.h); }

// Нарисовать fn(ctx) в дизайн-рамке. opts.ambient — залить поля эмбиентом (для «непрозрачной» картинки);
// opts.clip — обрезать содержимое рамкой (полноэкранные сцены меню и сюжета).
export function withFrame(game, ctx, fn, opts = {}) {
  const f = view.frame, inp = game.inp;
  ctx.save();
  if (opts.clip) { ctx.beginPath(); ctx.rect(f.ox, f.oy, DESIGN_W * f.s, DESIGN_H * f.s); ctx.clip(); }
  ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
  const was = inp?.space; inp?.setSpace(f);
  try { fn(ctx); } finally { ctx.restore(); inp?.setSpace(was || null); }
  if (opts.ambient) paintAmbient(ctx, game);
}

// Заполнить поля вокруг рамки: уже нарисованный кадр рамки сильно уменьшается (размытие), растягивается на весь вид
// («cover»), затемняется и виден только вне рамки — как «размытый фон» видеоплееров; повторов и швов нет.
// Вызывать ПОСЛЕ отрисовки содержимого рамки (берёт пиксели из самого холста) и ДО плёнки/HUD.
export function paintAmbient(ctx, game) {
  const f = view.frame, cvs = game.canvas, k = view.scale * view.dpr, ox = view.dx * view.dpr, oy = view.dy * view.dpr;
  const fw = DESIGN_W * f.s, fh = DESIGN_H * f.s;
  if (f.ox < 0.5 && f.oy < 0.5) return;
  const S = { x: ox + f.ox * k, y: oy + f.oy * k, w: fw * k, h: fh * k };
  const tw = 40, th = Math.max(2, Math.round(tw * DESIGN_H / DESIGN_W));
  if (tmp.width !== tw || tmp.height !== th) { tmp.width = tw; tmp.height = th; }
  tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
  tctx.clearRect(0, 0, tw, th); tctx.drawImage(cvs, S.x, S.y, S.w, S.h, 0, 0, tw, th);
  const V = { x: ox, y: oy, w: view.W * k, h: view.H * k };
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip('evenodd');   // только поля вокруг рамки
  const c = Math.max(V.w / tw, V.h / th), dw = tw * c, dh = th * c;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, V.x + (V.w - dw) / 2, V.y + (V.h - dh) / 2, dw, dh);
  ctx.fillStyle = 'rgba(10,4,14,0.5)'; ctx.fillRect(V.x, V.y, V.w, V.h);
  // у края экрана темнее; у шва с рамкой светлее
  const horiz = f.ox >= 0.5, g = horiz ? ctx.createLinearGradient(V.x, 0, V.x + V.w, 0) : ctx.createLinearGradient(0, V.y, 0, V.y + V.h);
  const a0 = horiz ? f.ox / view.W : f.oy / view.H;   // доля поля у каждого края
  g.addColorStop(0, 'rgba(10,4,14,0.45)'); g.addColorStop(Math.max(0.01, a0), 'rgba(10,4,14,0)'); g.addColorStop(Math.min(0.99, 1 - a0), 'rgba(10,4,14,0)'); g.addColorStop(1, 'rgba(10,4,14,0.45)');
  ctx.fillStyle = g; ctx.fillRect(V.x, V.y, V.w, V.h);
  ctx.restore();
}

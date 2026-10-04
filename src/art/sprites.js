// Все спрайты игры — векторы в коде (Canvas Path2D/Безье). Стиль снят с ассетов оригинала:
// глянцевая плоская заливка, тёмный кант того же тона, белые блики, крупные тёмно-синие глаза.
import { TAU, star } from '../engine/util.js';

export const PAL = {
  blood: '#e8202a', bloodHi: '#ff5a4a', bloodDark: '#8e0d1a', bloodRim: '#5a0712',
  clot: '#9c1030', clotHi: '#d23a52', clotRim: '#3e0410',
  eye: '#1b2147', eyeHi: '#ffffff', bone: '#fff1e6',
  cloud: '#d6ea8c', cloudShade: '#a4c155', cloudRim: '#3d5418',
  white: '#ffffff', ink: '#2a0a14', gold: '#ffc53d', mint: '#5ee6c8', pink: '#ff7aa8', violet: '#8b5cf6',
  night: '#0f0a1a',
};

function rimFill(ctx, fill, rim, lw) { ctx.fillStyle = fill; ctx.fill(); if (rim) { ctx.lineWidth = lw; ctx.strokeStyle = rim; ctx.lineJoin = 'round'; ctx.stroke(); } }
function gloss(ctx, x, y, rx, ry, rot = -0.5, a = 0.85) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.restore();
}

// Путь капли: остриё вверх (капля летит вниз). r — радиус круглой части. stretch — вытяжка хвоста.
function dropPath(ctx, r, stretch = 1, wob = 0) {
  const tip = -r * (1.9 + 0.35 * stretch);
  ctx.beginPath();
  ctx.moveTo(0, tip);
  ctx.bezierCurveTo(r * (0.35 + wob), tip * 0.55, r * 1.05, -r * 0.35, r * 1.0, r * 0.15);
  ctx.bezierCurveTo(r * 0.98, r * 0.78, r * 0.5, r * 1.02, 0, r * 1.02);
  ctx.bezierCurveTo(-r * 0.5, r * 1.02, -r * 0.98, r * 0.78, -r * 1.0, r * 0.15);
  ctx.bezierCurveTo(-r * 1.05, -r * 0.35, -r * (0.35 - wob), tip * 0.55, 0, tip);
  ctx.closePath();
}

// Лицо-черепок как у капель оригинала: два больших глаза, «зубастый» рот
function skullFace(ctx, r, look = 0, mood = 0, blink = 0) {
  const ex = r * 0.42, ey = r * 0.05, er = r * 0.3;
  for (const s of [-1, 1]) {
    ctx.fillStyle = PAL.eye; ctx.beginPath();
    ctx.ellipse(s * ex + look * r * 0.08, ey, er, er * (1 - blink * 0.9), 0, 0, TAU); ctx.fill();
    if (blink < 0.5) { gloss(ctx, s * ex + look * r * 0.08 + er * 0.35, ey - er * 0.4, er * 0.28, er * 0.28, 0, 1); gloss(ctx, s * ex + look * r * 0.08 - er * 0.3, ey + er * 0.35, er * 0.12, er * 0.12, 0, 0.8); }
    if (mood > 0) { // злые брови
      ctx.strokeStyle = PAL.bloodRim; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s * (ex + er), ey - er * 1.25); ctx.lineTo(s * (ex - er * 0.6), ey - er * (1.25 - mood * 0.7)); ctx.stroke();
    }
  }
  // рот с зубками
  const mw = r * 0.42, my = r * 0.55, mh = r * 0.22;
  ctx.fillStyle = PAL.eye; ctx.beginPath(); ctx.roundRect(-mw / 2, my - mh / 2, mw, mh, mh * 0.45); ctx.fill();
  ctx.fillStyle = PAL.bone;
  for (let i = 0; i < 3; i++) { const tx = -mw / 2 + mw * (0.2 + i * 0.3); ctx.fillRect(tx - mw * 0.08, my - mh / 2 + 1, mw * 0.16, mh * 0.45); }
}

// Обычная капля крови. t — время для покачивания, hit — вспышка попадания 0..1
export function drawDrop(ctx, x, y, r, o = {}) {
  const t = o.t || 0, sq = Math.sin(t * 9 + (o.seed || 0)) * 0.05;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(1 - sq, 1 + sq);
  const fill = o.fill || PAL.blood, rim = o.rim || PAL.bloodDark;
  // тень-подложка (более тёмный край, как у оригинала)
  dropPath(ctx, r, o.stretch ?? 1, sq);
  rimFill(ctx, rim, null);
  ctx.save(); ctx.translate(-r * 0.06, -r * 0.08); ctx.scale(0.9, 0.92); dropPath(ctx, r, o.stretch ?? 1, sq); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  // глянец
  gloss(ctx, r * 0.45, -r * 0.55, r * 0.22, r * 0.38, 0.5, 0.75);
  gloss(ctx, r * 0.2, -r * 1.35, r * 0.07, r * 0.16, 0.3, 0.6);
  if (r > 7) skullFace(ctx, r, o.look || 0, o.mood || 0, o.blink || 0);
  if (o.hit > 0) { ctx.globalAlpha = o.hit; ctx.globalCompositeOperation = 'source-atop'; dropPath(ctx, r * 1.2, 1); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.restore();
}

// Сгусток: круглое злое тело с брызгами по краю (по мотивам «Boss» оригинала)
export function drawClot(ctx, x, y, r, o = {}) {
  const t = o.t || 0;
  ctx.save(); ctx.translate(x, y);
  const n = 9; ctx.fillStyle = o.rim || PAL.clotRim;
  ctx.beginPath();
  for (let i = 0; i <= n * 4; i++) {
    const a = i / (n * 4) * TAU, bump = Math.sin(a * n + t * 3) * 0.08 + Math.sin(a * 3 - t * 2) * 0.04;
    const rr = r * (1.04 + bump); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.fill();
  for (let i = 0; i < 6; i++) { // капли-отростки
    const a = i * TAU / 6 + 0.4 + Math.sin(t * 1.5 + i) * 0.1, d = r * (1.12 + 0.05 * Math.sin(t * 4 + i * 2));
    ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.17, 0, TAU); ctx.fillStyle = o.fill || PAL.clot; ctx.fill();
    gloss(ctx, Math.cos(a) * d - r * 0.05, Math.sin(a) * d - r * 0.06, r * 0.05, r * 0.04, 0, 0.6);
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fillStyle = o.fill || PAL.clot; ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,120,140,0.55)'); g.addColorStop(1, 'rgba(255,120,140,0)');
  ctx.fillStyle = g; ctx.fill();
  gloss(ctx, -r * 0.4, -r * 0.55, r * 0.18, r * 0.1, -0.6, 0.8);
  gloss(ctx, -r * 0.18, -r * 0.7, r * 0.06, r * 0.05, 0, 0.7);
  // злое лицо: белые глаза, брови, кричащий рот
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * r * 0.32, -r * 0.05, r * 0.2, r * 0.17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(s * r * 0.28 + (o.look || 0) * r * 0.05, -r * 0.02, r * 0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.clotRim; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * r * 0.55, -r * 0.32); ctx.lineTo(s * r * 0.12, -r * 0.18); ctx.stroke();
  }
  ctx.fillStyle = '#3a0612'; ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.2, r * (0.12 + 0.05 * Math.sin(t * 8)), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.12, r * 0.31, r * 0.24, r * 0.06);
  if (o.hit > 0) { ctx.globalAlpha = o.hit * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

// Облако-пук с черепом (оригинал: розовато-кремовое облако, глазницы и нос черепа)
export function drawFart(ctx, x, y, r, o = {}) {
  const t = o.t || 0;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = o.alpha ?? 1;
  const puffs = [[0, -0.55, 0.5], [-0.55, -0.25, 0.42], [0.55, -0.25, 0.42], [-0.6, 0.3, 0.4], [0.6, 0.3, 0.4], [0, 0.5, 0.48], [-0.25, 0.05, 0.5], [0.25, 0.05, 0.5]];
  const pass = (scale, fill, dy) => {
    ctx.fillStyle = fill; ctx.beginPath();
    for (const [px, py, pr] of puffs) { const w = 1 + Math.sin(t * 3 + px * 5 + py * 3) * 0.06; ctx.moveTo(px * r + pr * r * scale * w, py * r + dy); ctx.arc(px * r, py * r + dy, pr * r * scale * w, 0, TAU); }
    ctx.fill();
  };
  pass(1.08, PAL.cloudRim, r * 0.06);
  pass(1.0, PAL.cloudShade, r * 0.04);
  pass(0.9, PAL.cloud, 0);
  gloss(ctx, -r * 0.25, -r * 0.75, r * 0.14, r * 0.09, -0.3, 0.9);
  // череп
  // вонючие волны над облаком
  ctx.strokeStyle = 'rgba(160,200,70,0.8)'; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = 'round';
  for (const s of [-1, 0, 1]) { const ph = (t * 0.9 + s * 0.33) % 1; ctx.globalAlpha = (o.alpha ?? 1) * Math.sin(ph * Math.PI);
    ctx.beginPath(); for (let i = 0; i <= 8; i++) { const yy = -r * 1.0 - ph * r * 0.7 - i * r * 0.06, xx = s * r * 0.45 + Math.sin(i * 1.3 + t * 5) * r * 0.08; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
  ctx.globalAlpha = o.alpha ?? 1;
  // муха
  { const a = t * 4, fx = Math.cos(a) * r * 1.15, fy = -r * 0.2 + Math.sin(a * 1.7) * r * 0.5; ctx.fillStyle = '#1d1a12'; ctx.beginPath(); ctx.arc(fx, fy, Math.max(1.6, r * 0.07), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(230,240,255,0.7)'; const fl = Math.sin(t * 60) * 0.5 + 0.5; ctx.beginPath(); ctx.ellipse(fx - 1, fy - r * 0.07, r * 0.06, r * 0.03 + fl * r * 0.03, -0.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3b4a16';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.24, -r * 0.08, r * 0.17, r * 0.19, s * 0.2, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, r * 0.08); ctx.lineTo(-r * 0.07, r * 0.2); ctx.lineTo(r * 0.07, r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.cloudShade; ctx.fillRect(-r * 0.2, r * 0.3, r * 0.4, r * 0.1);
  ctx.fillStyle = '#3b4a16'; for (let i = 0; i < 3; i++) ctx.fillRect(-r * 0.13 + i * r * 0.11, r * 0.3, r * 0.03, r * 0.1);
  if (o.hit > 0) { ctx.globalAlpha = o.hit * 0.6; pass(1.0, '#fff', 0); }
  ctx.restore();
}

// Пуля-тампон: белая вата сверху, жёлто-оранжевый корпус, тёмный кант (оригинальный bullet)
export function drawTampon(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-4, -2, 8, 12, 2); ctx.fillStyle = o.body || '#ffb43a'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, -6); ctx.quadraticCurveTo(-4, -13, 0, -13); ctx.quadraticCurveTo(4, -13, 4, -6); ctx.lineTo(4, 0); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(42,10,20,0.35)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1.3, -11); ctx.lineTo(-1.3, -1); ctx.moveTo(1.3, -11); ctx.lineTo(1.3, -1); ctx.stroke();
  if (o.string) { ctx.strokeStyle = '#d8d8e8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(2, 14, 0, 18); ctx.stroke(); }
  ctx.restore();
}

// Прокладка (оригинальный pad): белый «щит» с крылышками и стёжкой
export function drawPad(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 2; ctx.strokeStyle = '#6a7690'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -20); ctx.bezierCurveTo(9, -20, 10, -12, 9, -6); ctx.lineTo(17, -3); ctx.quadraticCurveTo(19, 2, 13, 5); ctx.lineTo(9, 6);
  ctx.bezierCurveTo(10, 14, 7, 21, 0, 21); ctx.bezierCurveTo(-7, 21, -10, 14, -9, 6); ctx.lineTo(-13, 5); ctx.quadraticCurveTo(-19, 2, -17, -3); ctx.lineTo(-9, -6);
  ctx.bezierCurveTo(-10, -12, -9, -20, 0, -20); ctx.closePath();
  ctx.fillStyle = o.color || '#f4f6fb'; ctx.fill(); ctx.stroke();
  ctx.setLineDash([2.5, 2.5]); ctx.strokeStyle = '#b6bfd3'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 1, 5, 14, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  gloss(ctx, -3, -10, 2, 5, 0.2, 0.9);
  ctx.restore();
}

// Трусики (оригинальный pantys / иконки здоровья)
export function drawPanties(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-20, -9); ctx.quadraticCurveTo(0, -4, 20, -9); ctx.lineTo(18, -3);
  ctx.bezierCurveTo(10, 0, 5, 6, 4, 12); ctx.lineTo(-4, 12); ctx.bezierCurveTo(-5, 6, -10, 0, -18, -3); ctx.closePath();
  if (o.outline) { ctx.lineWidth = 3.2; ctx.strokeStyle = o.outline; ctx.lineJoin = 'round'; ctx.stroke(); }
  else { ctx.fillStyle = o.color || '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = o.rim || '#7aa0c8'; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-19, -8); ctx.quadraticCurveTo(0, -3, 19, -8); ctx.lineWidth = 2.2; ctx.stroke(); }
  ctx.restore();
}

// Иконка здоровья: контурные трусики, цвет по состоянию (как в оригинале), заполнение
export function drawHeartPanty(ctx, x, y, s, full) {
  drawPanties(ctx, x, y, s, { outline: full ? '#ff3150' : 'rgba(255,255,255,0.25)' });
  if (full) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-20, -9); ctx.quadraticCurveTo(0, -4, 20, -9); ctx.lineTo(18, -3); ctx.bezierCurveTo(10, 0, 5, 6, 4, 12); ctx.lineTo(-4, 12); ctx.bezierCurveTo(-5, 6, -10, 0, -18, -3); ctx.closePath(); ctx.fillStyle = 'rgba(255,49,80,0.35)'; ctx.fill(); ctx.restore(); }
}

// Лунная чаша (cupBullet/cup3 оригинала): розовая чаша с голубым колпачком
export function drawCup(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#6b2440'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-9, 6, -2, 9); ctx.lineTo(-2, 14); ctx.lineTo(2, 14); ctx.lineTo(2, 9); ctx.quadraticCurveTo(9, 6, 9, -6); ctx.closePath();
  ctx.fillStyle = o.color || '#ff9ab8'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -6, 9, 3, 0, 0, TAU); ctx.fillStyle = '#ffd0de'; ctx.fill(); ctx.stroke();
  if (o.filled) { ctx.beginPath(); ctx.ellipse(0, -5.5, 7, 2, 0, 0, TAU); ctx.fillStyle = PAL.blood; ctx.fill(); }
  gloss(ctx, -5, 0, 1.5, 3.5, 0.3, 0.8);
  ctx.restore();
}

// Таблетка-обезболивающее (капсула)
export function drawPill(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink;
  ctx.beginPath(); ctx.roundRect(-8, -4, 16, 8, 4); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = o.color || '#5ec2ff'; ctx.fillRect(0, -5, 9, 10); ctx.restore();
  ctx.stroke(); gloss(ctx, -3, -1.5, 3, 1, 0, 0.9);
  ctx.restore();
}

// Шоколадная плитка
export function drawChoco(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#2a1206';
  ctx.beginPath(); ctx.roundRect(-9, -6, 18, 12, 2); ctx.fillStyle = '#6b3a1e'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#4a250f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-3, 6); ctx.moveTo(3, -6); ctx.lineTo(3, 6); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillRect(-9, 2, 18, 4); ctx.strokeStyle = '#2a1206'; ctx.lineWidth = 1.2; ctx.strokeRect(-9, 2, 18, 4);
  gloss(ctx, -6, -3, 1.5, 1, 0, 0.6);
  ctx.restore();
}

// Грелка (резиновая, с пробкой)
export function drawBottle(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  ctx.lineWidth = 1.8; ctx.strokeStyle = '#4a0f1e'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-10, -9, 20, 22, 6); ctx.fillStyle = o.color || '#ff5d7a'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-4, -15, 8, 7, 2); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(74,15,30,0.4)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6, -3 + i * 5); ctx.lineTo(6, -3 + i * 5); ctx.stroke(); }
  gloss(ctx, -5, -3, 1.6, 4, 0.2, 0.7);
  ctx.restore();
}

// Конфета-фантик (опыт): цвет зависит от ценности
export function drawCandy(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  const c = o.color || '#ffc53d';
  ctx.fillStyle = c; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 5, 0); ctx.lineTo(sd * 11, -5); ctx.lineTo(sd * 10, 0); ctx.lineTo(sd * 11, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(1, 3); ctx.moveTo(1, -4); ctx.lineTo(4, 1); ctx.stroke();
  ctx.restore();
}

// Тыква-кнопка/монета: оранжевая, с вырезанным лицом и огнём внутри (кнопки меню оригинала)
export function drawPumpkin(ctx, x, y, r, o = {}) {
  const t = o.t || 0;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#3d6b1f'; ctx.beginPath(); ctx.moveTo(-r * 0.08, -r * 0.8); ctx.quadraticCurveTo(r * 0.05, -r * 1.15, r * 0.25, -r * 1.12); ctx.lineTo(r * 0.12, -r * 0.78); ctx.closePath(); ctx.fill();
  const lobes = [[-0.55, 0.62], [0.55, 0.62], [-0.25, 0.8], [0.25, 0.8], [0, 0.85]];
  ctx.strokeStyle = '#5a2306'; ctx.lineWidth = r * 0.06;
  for (const [lx, lw] of lobes) { ctx.beginPath(); ctx.ellipse(lx * r, 0, lw * r, r * 0.82, 0, 0, TAU); ctx.fillStyle = Math.abs(lx) > 0.4 ? '#d9620f' : '#f2801d'; ctx.fill(); ctx.stroke(); }
  gloss(ctx, -r * 0.3, -r * 0.45, r * 0.12, r * 0.22, 0.3, 0.45);
  const glow = 0.75 + Math.sin(t * 9) * 0.15;
  ctx.fillStyle = `rgba(255,${Math.round(200 * glow)},60,1)`;
  ctx.shadowColor = '#ffb000'; ctx.shadowBlur = r * 0.4 * glow;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.15, -r * 0.05); ctx.lineTo(s * r * 0.48, -r * 0.3); ctx.lineTo(s * r * 0.42, r * 0.02); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.55 + i * r * 0.183, r * (0.2 + (i % 2 ? 0.14 : 0)));
  ctx.quadraticCurveTo(0, r * 0.72, -r * 0.55, r * 0.2); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();
}

// Брызги-клякса для взрыва капли (explosion оригинала)
export function drawSplat(ctx, x, y, r, k, color = PAL.blood) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 1 - k;
  ctx.fillStyle = color; ctx.beginPath();
  const n = 8, rr = r * (0.6 + k * 0.8);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.moveTo(Math.cos(a) * rr * 1.2 + rr * 0.25, Math.sin(a) * rr * 1.2); ctx.arc(Math.cos(a) * rr * 1.2, Math.sin(a) * rr * 1.2, rr * 0.25 * (1 - k), 0, TAU); }
  ctx.moveTo(rr * 0.8, 0); ctx.arc(0, 0, rr * 0.8 * (1 - k * 0.6), 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawStar(ctx, x, y, r, color = PAL.gold) { ctx.save(); ctx.translate(x, y); star(ctx, r); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink; ctx.stroke(); ctx.restore(); }

// Интерфейс: текст с обводкой, кнопки, HUD, карты прокачки. Всё рисуется на холсте.
import { TAU, clamp } from '../engine/util.js';
import { drawHeartPanty, drawDrop, drawCandy } from '../art/sprites.js';
import { drawIcon } from '../art/icons.js';
import { WEAPONS, PASSIVES } from './data.js';

export const FONT = '"Nunito", "Trebuchet MS", "Segoe UI", sans-serif';

export function text(ctx, s, x, y, o = {}) {
  ctx.font = `${o.weight ?? 900} ${o.size ?? 20}px ${FONT}`;
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
  if (o.outline !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = o.lw ?? Math.max(3, (o.size ?? 20) / 5); ctx.strokeStyle = o.outline ?? '#2a0a14'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color ?? '#fff'; ctx.fillText(s, x, y);
}
export function wrap(ctx, s, maxW, size, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// Кнопка: возвращает true, если нажата в этом шаге. hover по мыши.
export function button(ctx, inp, x, y, w, h, label, o = {}) {
  const p = inp.pointer, over = p.x > x && p.x < x + w && p.y > y && p.y < y + h;
  const press = over && p.down;
  const col = o.color ?? '#ff5d8f';
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + (press ? 2 : 0)); const sc = over && !o.disabled ? 1.04 : 1; ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + 5, w, h, 16); ctx.fill();
  ctx.fillStyle = o.disabled ? '#5a4a58' : col; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.42, 12); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#2a0a14'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.stroke();
  text(ctx, label, 0, 1, { size: o.size ?? 22, color: o.textColor ?? '#fff' });
  ctx.restore();
  if (!o.disabled && over && p.clicked) { p.clicked = false; return true; }   // клик потребляется одной кнопкой
  return false;
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.fillStyle = o.fill ?? 'rgba(30,8,24,0.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r ?? 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = o.stroke ?? '#ff7aa8'; ctx.stroke();
}

// ---------- HUD ----------
export function drawHUD(ctx, G) {
  const R = G.run, S = G.stats, t = G.t;
  // сердца-трусики
  for (let i = 0; i < S.maxHp; i++) drawHeartPanty(ctx, 34 + i * 40, 30, 0.75, i < G.p.hp);
  // счётчик капель (только в волнах)
  if (G.phase === 'boss' || G.phase === 'bossIntro' || G.phase === 'bossDead' || (G.phase === 'cards' && G.prevPhase === 'boss')) { G._noCounter = true; } else G._noCounter = false;
  const cnt = Math.max(0, Math.ceil(R.counter));
  const pulse = R.counterPop > 0 ? 1 + R.counterPop * 1.8 : 1;
  const shakeX = R.counterBad > 0 ? Math.sin(t * 80) * 3 : 0;
  if (!G._noCounter) {
  ctx.save(); ctx.translate(40 + shakeX, 80);
  drawDrop(ctx, 0, 6, 14, { t });
  ctx.scale(pulse, pulse);
  const low = cnt <= 5 && G.phase === 'wave';
  text(ctx, String(cnt), 26, 4, { size: 34, align: 'left', color: R.counterBad > 0 ? '#ff4a5a' : low ? (Math.sin(t * 12) > 0 ? '#ffeb7a' : '#fff') : '#fff' });
  ctx.restore(); }
  if (G.phase === 'wave') text(ctx, 'капель осталось', 40, 108, { size: 12, align: 'left', color: '#ffd0dc', lw: 3 });
  // опыт
  const xw = 360, xx = 300, xy = 14;
  ctx.fillStyle = 'rgba(20,0,20,0.6)'; ctx.beginPath(); ctx.roundRect(xx, xy, xw, 12, 6); ctx.fill();
  const k = clamp(R.xp / R.xpNext, 0, 1);
  const g = ctx.createLinearGradient(xx, 0, xx + xw, 0); g.addColorStop(0, '#5ee6c8'); g.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(xx, xy, Math.max(12, xw * k), 12, 6); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#2a0a14'; ctx.beginPath(); ctx.roundRect(xx, xy, xw, 12, 6); ctx.stroke();
  text(ctx, 'ур. ' + R.level, xx + xw + 30, xy + 7, { size: 16 });
  // конфеты и волна
  drawCandy(ctx, 850, 22, 1.2);
  text(ctx, String(R.candies), 872, 23, { size: 20, align: 'left', color: '#ffd166' });
  if (G.waveLabel && !G.boss) text(ctx, G.waveLabel, 480, 40, { size: 14, color: '#ffd0dc', lw: 3 });
  // комбо
  if (R.combo >= 5) {
    const m = R.comboMul.toFixed(1);
    const a = clamp(R.comboT / 1.5, 0, 1);
    ctx.globalAlpha = 0.4 + a * 0.6;
    text(ctx, `серия ${R.combo}`, 900, 70, { size: 18, align: 'right', color: '#ffeb7a' });
    text(ctx, `×${m}`, 900, 94, { size: 26, align: 'right', color: R.comboMul >= 2 ? '#ff7aa8' : '#fff' });
    ctx.fillStyle = '#ffeb7a'; ctx.fillRect(900 - 80 * a, 108, 80 * a, 3);
    ctx.globalAlpha = 1;
  }
  // слоты оружия и пассивок: кадры киноплёнки (оружие) и значки-пины (пассивки)
  const nW = R.weapons.length, nP = R.passives.length;
  if (nW + nP) {
    const stripW = 16 + nW * 46 + (nP ? 12 + nP * 36 : 0);
    ctx.fillStyle = 'rgba(14,6,18,0.78)'; ctx.beginPath(); ctx.roundRect(10, 486, stripW, 48, 8); ctx.fill();
    ctx.fillStyle = 'rgba(243,226,192,0.22)';
    for (let x = 18; x < 10 + stripW - 6; x += 12) { ctx.fillRect(x, 489, 6, 3); }
  }
  let sx = 18;
  for (const w of R.weapons) { const d = WEAPONS[w.id]; frameSlot(ctx, sx, 510, d.icon, d.evolved ? 0 : w.lv, d.evolved ? 0 : d.lv.length, d.evolved, t); sx += 46; }
  sx += 10;
  for (const p of R.passives) { pinSlot(ctx, sx + 16, 510, PASSIVES[p.id].icon, p.lv, PASSIVES[p.id].max); sx += 36; }
  // бусты
  let by = G.pu && (G.pu.freeze > 0 || G.pu.slow > 0 || G.pu.umbrella > 0) ? 160 : 140;
  if (R.frenzy > 0) { text(ctx, `Пачка тампонов! ${R.frenzy.toFixed(0)}`, 24, by, { size: 14, align: 'left', color: '#ffd166' }); by += 20; }
  if (R.pierceAll > 0) { text(ctx, `Чаша: пробивает всё ${R.pierceAll.toFixed(0)}`, 24, by, { size: 14, align: 'left', color: '#ff9ab8' }); by += 20; }
  if (R.shield) { text(ctx, 'Щит-прокладка', 24, by, { size: 14, align: 'left', color: '#bfe8ff' }); }
}
function pips(ctx, cx, y, lv, max, on, off) {
  const step = 6, x0 = cx - (max - 1) * step / 2;
  for (let i = 0; i < max; i++) { ctx.fillStyle = i < lv ? on : off; ctx.beginPath(); ctx.arc(x0 + i * step, y, 2, 0, TAU); ctx.fill(); }
}
// кадр плёнки 40×32: тёмное стекло, тёплый блик проектора, пипсы уровня; эволюция — золото и сияние
function frameSlot(ctx, x, y, icon, lv, max, gold, t) {
  const w = 40, h = 32, y0 = y - h / 2 - 2;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, gold ? '#5a3a10' : '#2a1038'); g.addColorStop(1, gold ? '#2a1a06' : '#160a1e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y0, w, h, 5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = gold ? '#ffd166' : 'rgba(243,226,192,0.55)'; ctx.stroke();
  if (gold) { ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x - 2, y0 - 2, w + 4, h + 4, 7); ctx.stroke(); ctx.restore(); }
  ctx.fillStyle = 'rgba(255,241,201,0.10)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y0 + 6, w * 0.4, 4, 0, 0, TAU); ctx.fill();
  drawIcon(ctx, icon, x + w / 2, y0 + h / 2, 0.9);
  if (gold) text(ctx, '★', x + w - 6, y0 + 6, { size: 11, color: '#ffd166', lw: 3 });
  else pips(ctx, x + w / 2, y0 + h + 5, lv, max, '#ffd166', 'rgba(243,226,192,0.25)');
}
// значок-пин Ø28: бархат и латунный ободок
function pinSlot(ctx, cx, y, icon, lv, max) {
  const r = 14, cy = y - 2;
  const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, r);
  g.addColorStop(0, '#a01828'); g.addColorStop(1, '#4a0610');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#c9a878'; ctx.stroke();
  drawIcon(ctx, icon, cx, cy, 0.7);
  pips(ctx, cx, cy + r + 5, lv, Math.min(max, 5), '#ff9ab8', 'rgba(243,226,192,0.25)');
}

// ---------- Карты прокачки ----------
export function drawCards(ctx, G, cards, sel, appear) {
  ctx.fillStyle = 'rgba(15,4,14,0.72)'; ctx.fillRect(0, 0, 960, 540);
  text(ctx, cards.title || 'Новый уровень!', 480, 70, { size: 40, color: '#ffeb7a' });
  text(ctx, cards.subtitle || 'Выбери одно', 480, 108, { size: 18, color: '#ffd0dc' });
  const n = cards.list.length, cw = n === 4 ? 200 : 230, gap = 20, total = n * cw + (n - 1) * gap, x0 = 480 - total / 2;
  const rects = [];
  cards.list.forEach((c, i) => {
    const k = clamp((appear - i * 0.07) / 0.25, 0, 1), e = 1 - (1 - k) ** 3;
    const x = x0 + i * (cw + gap), y = 150 + (1 - e) * 60, h = 290;
    rects.push({ x, y, w: cw, h });
    ctx.globalAlpha = e;
    const on = i === sel;
    ctx.save(); if (on) { ctx.translate(x + cw / 2, y + h / 2); ctx.scale(1.04, 1.04); ctx.translate(-(x + cw / 2), -(y + h / 2)); }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x, y + 6, cw, h, 18); ctx.fill();
    const col = c.evolve || c.rare ? '#ffd166' : c.isNew ? '#5ee6c8' : '#ff7aa8';
    ctx.fillStyle = '#2e0f2a'; ctx.beginPath(); ctx.roundRect(x, y, cw, h, 18); ctx.fill();
    if (c.rare) { ctx.save(); ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 18 + 8 * Math.sin(Date.now() / 200); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd166'; ctx.stroke(); ctx.restore(); }
    ctx.lineWidth = on ? 5 : 3; ctx.strokeStyle = on ? '#fff' : col; ctx.stroke();
    ctx.fillStyle = col; ctx.globalAlpha = e * 0.18; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, cw - 12, 110, 14); ctx.fill(); ctx.globalAlpha = e;
    drawIcon(ctx, c.icon, x + cw / 2, y + 62, 2.4);
    text(ctx, c.tag, x + cw / 2, y + 134, { size: 14, color: col, lw: 3 });
    const lines = wrap(ctx, c.name, cw - 24, 20, 900);
    lines.forEach((l, j) => text(ctx, l, x + cw / 2, y + 160 + j * 22, { size: 20 }));
    const dl = wrap(ctx, c.desc, cw - 28, 14, 700);
    dl.slice(0, 5).forEach((l, j) => text(ctx, l, x + cw / 2, y + 166 + lines.length * 22 + j * 18, { size: 14, weight: 700, color: '#ffe6ef', outline: false }));
    if (c.pairHint) text(ctx, '♥ ' + c.pairHint, x + cw / 2, y + h - 18, { size: 13, color: '#ffd166', lw: 3 });
    text(ctx, String(i + 1), x + 18, y + 18, { size: 14, color: 'rgba(255,255,255,0.6)', outline: false });
    ctx.restore(); ctx.globalAlpha = 1;
  });
  return rects;
}

// Баннер посреди экрана (волна, «ЧИСТО!»)
export function banner(ctx, s, sub, k, color = '#ffeb7a') {
  const sc = k < 0.15 ? 0.3 + (k / 0.15) * 0.9 : k < 0.25 ? 1.2 - (k - 0.15) : 1;
  const a = k > 0.85 ? (1 - k) / 0.15 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(480, 230); ctx.scale(sc, sc);
  text(ctx, s, 0, 0, { size: 54, color, lw: 9 });
  if (sub) text(ctx, sub, 0, 46, { size: 20, color: '#fff', lw: 5 });
  ctx.restore();
}

// Кнопка прыжка для тача
export function drawTouchControls(ctx, inp) {
  if (!inp.isTouch) return;
  const b = inp.jumpButton;
  ctx.globalAlpha = inp.jump ? 0.7 : 0.4;
  ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 18); ctx.lineTo(b.x + 16, b.y + 8); ctx.lineTo(b.x - 16, b.y + 8); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

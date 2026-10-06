// Интерфейс: текст с обводкой, кнопки, HUD, карты прокачки. Всё рисуется на холсте.
import { TAU, clamp } from '../engine/util.js';
import { drawHeartPanty, drawDrop, drawCandy } from '../art/sprites.js';
import { drawIcon } from '../art/icons.js';
import { WEAPONS, PASSIVES } from './data.js';
import { view } from '../engine/core.js';
import { fillFull } from '../engine/frame.js';
import { STICK } from '../engine/input.js';

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

export const BTNLOG = { on: false, list: [] };   // автотесты (tools/portover.mjs) включают и читают через window.__btns
// Кнопка: возвращает true, если нажата в этом шаге. hover по мыши.
export function button(ctx, inp, x, y, w, h, label, o = {}) {
  // «запас касания»: кнопка меньше 44 CSS px (сжатый ландшафт 532×360 / 696×304, где рамка 960×540 уменьшена) нажимается и за видимым краем, не больше 6 CSS px с каждой стороны
  const tm = ctx.getTransform(), kc = Math.max(0.01, tm.a / (view.dpr || 1)), sx = Math.min(6 / kc, Math.max(0, (44 / kc - w) / 2)), sy = Math.min(6 / kc, Math.max(0, (44 / kc - h) / 2));
  if (BTNLOG.on) { const m = tm, d = view.dpr || 1; BTNLOG.list.push({ label, x: (m.a * x + m.e) / d, y: (m.d * y + m.f) / d, w: m.a * w / d, h: m.d * h / d, hw: m.a * (w + 2 * sx) / d, hh: m.d * (h + 2 * sy) / d, disabled: !!o.disabled }); }   // для автотестов: прямоугольник кнопки (CSS px) и с запасом касания (hw/hh)
  const p = inp.pointer, over = p.x > x - sx && p.x < x + w + sx && p.y > y - sy && p.y < y + h + sy;
  const press = over && p.down;
  const col = o.color ?? '#ff5d8f';
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + (press ? 2 : 0)); const sc = over && !o.disabled ? 1.04 : 1; ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + 5, w, h, 16); ctx.fill();
  ctx.fillStyle = o.disabled ? '#5a4a58' : col; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.42, 12); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#2a0a14'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.stroke();
  text(ctx, label, 0, 1 + (o.dy ?? 0), { size: o.size ?? 22, color: o.textColor ?? '#fff' });
  if (o.after) o.after(ctx, w, h);   // доп. содержимое кнопки (портретная витрина: цена под подписью), координаты от центра кнопки
  ctx.restore();
  if (!o.disabled && over && p.clicked) { p.clicked = false; return true; }   // клик потребляется одной кнопкой
  return false;
}

export function panel(ctx, x, y, w, h, o = {}) {
  ctx.fillStyle = o.fill ?? 'rgba(30,8,24,0.88)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r ?? 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = o.stroke ?? '#ff7aa8'; ctx.stroke();
}

// ---------- HUD ----------
// HUD якорится по реальным краям экрана (внутри безопасных зон) и масштабируется view.uiScale (на десктопе 1).
// Блоки рисуются в локальных координатах якоря: tl — левый верх, tc — центр верха, tr — правый верх, bl — левый низ.
// На 960×540 (uiScale 1, safe 0) координаты совпадают с прежними абсолютными. В портрете — свой компактный набор рядов.
// HUDBOX — раскладка текущего кадра для остальных (полоса босса, значки бонусов, подсказки).
export const HUDBOX = { ui: 1, bossY: 60, bossW: 500, bossCx: 480, puX: 40, puY: 132, boostY: 140, pause: { x: 0, y: 0, r: 18 } };
export function withHud(ctx, anchor, fn) {
  const ui = view.uiScale, s = view.safe;
  const x = anchor === 'tr' ? view.W - s.r : anchor === 'tc' ? view.W / 2 : s.l;
  const y = anchor === 'bl' || anchor === 'br' ? view.H - s.b : s.t;
  ctx.save(); ctx.translate(x, y); ctx.scale(ui, ui); fn(); ctx.restore();
}
export function drawHUD(ctx, G) {
  const R = G.run, S = G.stats, t = G.t, P = view.portrait, ui = view.uiScale, sf = view.safe;
  const Wd = (view.W - sf.l - sf.r) / ui;   // ширина интерфейса в его единицах
  const compact = P || Wd < 800;   // узкий интерфейс (портрет или маленький ландшафт 532×360 / 696×304) — компактные ряды вместо углов
  if (G.phase === 'boss' || G.phase === 'bossIntro' || G.phase === 'bossDead' || (G.phase === 'cards' && G.prevPhase === 'boss')) { G._noCounter = true; } else G._noCounter = false;
  const cnt = Math.max(0, Math.ceil(R.counter));
  const pulse = R.counterPop > 0 ? 1 + R.counterPop * 1.8 : 1;
  const shakeX = R.counterBad > 0 ? Math.sin(t * 80) * 3 : 0;
  const low = cnt <= 5 && G.phase === 'wave';
  const counter = (cx, cy) => {   // капля + число; подпись «капель осталось» под ним
    ctx.save(); ctx.translate(cx + shakeX, cy);
    drawDrop(ctx, 0, 6, 14, { t });
    ctx.scale(pulse, pulse);
    text(ctx, String(cnt), 26, 4, { size: 34, align: 'left', color: R.counterBad > 0 ? '#ff4a5a' : low ? (Math.sin(t * 12) > 0 ? '#ffeb7a' : '#fff') : '#fff' });
    ctx.restore();
    if (G.phase === 'wave') text(ctx, 'капель осталось', cx, cy + 28, { size: 12, align: 'left', color: '#ffd0dc', lw: 3 });
  };
  const xpBar = (xx, xy, xw) => {
    ctx.fillStyle = 'rgba(20,0,20,0.6)'; ctx.beginPath(); ctx.roundRect(xx, xy, xw, 12, 6); ctx.fill();
    const k = clamp(R.xp / R.xpNext, 0, 1);
    const g = ctx.createLinearGradient(xx, 0, xx + xw, 0); g.addColorStop(0, '#5ee6c8'); g.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(xx, xy, Math.max(12, xw * k), 12, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2a0a14'; ctx.beginPath(); ctx.roundRect(xx, xy, xw, 12, 6); ctx.stroke();
  };
  const combo = (rx, ry) => {
    if (R.combo < 5) return;
    const m = R.comboMul.toFixed(1), a = clamp(R.comboT / 1.5, 0, 1);
    ctx.globalAlpha = 0.4 + a * 0.6;
    text(ctx, `серия ${R.combo}`, rx, ry, { size: 18, align: 'right', color: '#ffeb7a' });
    text(ctx, `×${m}`, rx, ry + 24, { size: 26, align: 'right', color: R.comboMul >= 2 ? '#ff7aa8' : '#fff' });
    ctx.fillStyle = '#ffeb7a'; ctx.fillRect(rx - 80 * a, ry + 38, 80 * a, 3);
    ctx.globalAlpha = 1;
  };
  const boosts = (bx, by0) => {
    let by = G.pu && (G.pu.freeze > 0 || G.pu.slow > 0 || G.pu.umbrella > 0) ? by0 + 20 : by0;
    if (R.frenzy > 0) { text(ctx, `Пачка тампонов! ${R.frenzy.toFixed(0)}`, bx, by, { size: 14, align: 'left', color: '#ffd166' }); by += 20; }
    if (R.pierceAll > 0) { text(ctx, `Чаша: пробивает всё ${R.pierceAll.toFixed(0)}`, bx, by, { size: 14, align: 'left', color: '#ff9ab8' }); by += 20; }
    if (R.shield) { text(ctx, 'Щит-прокладка', bx, by, { size: 14, align: 'left', color: '#bfe8ff' }); }
  };
  HUDBOX.ui = ui;
  if (!compact) {
    // сердца-трусики, счётчик капель, бусты
    withHud(ctx, 'tl', () => {
      for (let i = 0; i < S.maxHp; i++) drawHeartPanty(ctx, 34 + i * 40, 30, 0.75, i < G.p.hp);
      if (!G._noCounter) counter(40, 80);
      boosts(24, 140);
    });
    // опыт и волна — по центру верха
    withHud(ctx, 'tc', () => {
      xpBar(-180, 14, 360); text(ctx, 'ур. ' + R.level, 210, 21, { size: 16 });
      if (G.waveLabel && !G.boss) text(ctx, G.waveLabel, 0, 40, { size: 14, color: '#ffd0dc', lw: 3 });
    });
    // конфеты и серия — справа
    withHud(ctx, 'tr', () => {
      drawCandy(ctx, -110, 22, 1.2);
      text(ctx, String(R.candies), -88, 23, { size: 20, align: 'left', color: '#ffd166' });
      combo(-60, 70);
    });
    HUDBOX.pause = { x: view.W - sf.r - 24 * ui, y: sf.t + 58 * ui, r: 18 * ui };
    HUDBOX.bossY = sf.t + 60 * ui; HUDBOX.bossW = 500; HUDBOX.bossCx = view.W / 2; HUDBOX.puX = 40; HUDBOX.puY = G._noCounter ? 82 : 132;
  } else {
    // портрет: ряд 1 — сердца и конфеты, ряд 2 — полоса опыта и уровень, ряд 3 — счётчик капель, волна и серия
    withHud(ctx, 'tl', () => {
      const pitch = Math.min(40, (Wd * 0.58) / Math.max(1, S.maxHp));
      for (let i = 0; i < S.maxHp; i++) drawHeartPanty(ctx, 24 + i * pitch, 26, 0.75 * Math.min(1, pitch / 34), i < G.p.hp);
      ctx.font = `900 20px ${FONT}`; const cw = ctx.measureText(String(R.candies)).width;
      text(ctx, String(R.candies), Wd - 10, 26, { size: 20, align: 'right', color: '#ffd166' });
      drawCandy(ctx, Wd - 10 - cw - 18, 25, 1.2);
      HUDBOX.pause = { x: sf.l + (Wd - 10 - cw - 18 - 38) * ui, y: sf.t + 26 * ui, r: 18 * ui };
      xpBar(10, 52, Wd - 78); text(ctx, 'ур. ' + R.level, Wd - 10, 58, { size: 16, align: 'right' });
      if (!G._noCounter) counter(18, 92);
      if (G.waveLabel && !G.boss) text(ctx, G.waveLabel, Wd - 10, 88, { size: 14, align: 'right', color: '#ffd0dc', lw: 3 });
      combo(Wd - 10, G._noCounter ? 90 : 108);
      boosts(14, 150);
    });
    HUDBOX.bossY = sf.t + 96 * ui; HUDBOX.bossW = Wd - 24; HUDBOX.bossCx = (sf.l + view.W - sf.r) / 2; HUDBOX.puX = 24; HUDBOX.puY = G._noCounter ? 106 : 152;
  }
  // слоты оружия и пассивок: кадры киноплёнки (оружие) и значки-пины (пассивки) — внизу слева
  withHud(ctx, 'bl', () => {
    const nW = R.weapons.length, nP = R.passives.length;
    if (nW + nP) {
      const stripW = 16 + nW * 46 + (nP ? 12 + nP * 36 : 0);
      ctx.fillStyle = 'rgba(14,6,18,0.78)'; ctx.beginPath(); ctx.roundRect(10, -54, stripW, 48, 8); ctx.fill();
      ctx.fillStyle = 'rgba(243,226,192,0.22)';
      for (let x = 18; x < 10 + stripW - 6; x += 12) { ctx.fillRect(x, -51, 6, 3); }
    }
    let sx = 18;
    for (const w of R.weapons) { const d = WEAPONS[w.id]; frameSlot(ctx, sx, -30, d.icon, d.evolved ? 0 : w.lv, d.evolved ? 0 : d.lv.length, d.evolved, t); sx += 46; }
    sx += 10;
    for (const p of R.passives) { pinSlot(ctx, sx + 16, -30, PASSIVES[p.id].icon, p.lv, PASSIVES[p.id].max); sx += 36; }
  });
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
  fillFull(ctx, 'rgba(15,4,14,0.72)');   // затемнение — на весь вид (карты рисуются в дизайн-рамке)
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
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(view.W / 2, view.portrait ? view.H * 0.34 : 230); ctx.scale(sc, sc);
  text(ctx, s, 0, 0, { size: 54, color, lw: 9 });
  if (sub) text(ctx, sub, 0, 46, { size: 20, color: '#fff', lw: 5 });
  ctx.restore();
}

// Тач-управление в бою: кнопка паузы и плавающий джойстик (кольцо + ручка) там, где лежит левый палец; над кольцом — шеврон «вверх = прыжок».
// Большая кнопка прыжка выключена (inp.showJumpButton = false): прыгают тапом в любом месте или пальцем вверх.
// Рисуется поверх мира (полный вид); только когда isTouch и идёт бой (inp.gameplay).
export function drawTouchControls(ctx, inp) {
  if (!inp.isTouch || !inp.gameplay) return;
  const b = inp.layout(), jp = inp.jump, pz = HUDBOX.pause;
  inp.pauseButton = pz;
  ctx.save();
  // кнопка паузы (в бою на тач-экране иначе не открыть паузу)
  ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(14,6,18,0.7)'; ctx.beginPath(); ctx.arc(pz.x, pz.y, pz.r, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#f3e2c0'; ctx.stroke(); ctx.fillStyle = '#f3e2c0';
  ctx.fillRect(pz.x - pz.r * 0.34, pz.y - pz.r * 0.38, pz.r * 0.24, pz.r * 0.76); ctx.fillRect(pz.x + pz.r * 0.1, pz.y - pz.r * 0.38, pz.r * 0.24, pz.r * 0.76);
  if (inp.showJumpButton) {
    ctx.globalAlpha = jp ? 0.72 : 0.42;
    ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    const k = b.r / 58;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 18 * k); ctx.lineTo(b.x + 16 * k, b.y + 8 * k); ctx.lineTo(b.x - 16 * k, b.y + 8 * k); ctx.closePath(); ctx.fill();
  }
  const s = inp.stick;
  if (s.active) {
    const R = STICK.full + 15, dx = clamp(s.x - s.cx, -R, R), dy = clamp(s.y - s.cy, -28, 28);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.cx, s.cy, R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(s.cx, s.cy, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.arc(s.cx + dx, s.cy + dy, 28, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
    // шеврон «вверх = прыжок» на уровне порога (STICK.jumpUp); при прыжке вспыхивает
    const cy = s.cy - STICK.jumpUp, on = jp && s.cy - s.y >= STICK.jumpUp;
    ctx.globalAlpha = on ? 0.95 : 0.4; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = on ? '#ffeb7a' : '#fff';
    ctx.beginPath(); ctx.moveTo(s.cx - 14, cy + 6); ctx.lineTo(s.cx, cy - 6); ctx.lineTo(s.cx + 14, cy + 6); ctx.stroke();
  }
  ctx.restore();
}

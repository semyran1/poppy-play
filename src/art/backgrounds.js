// Фоны локаций — векторы в коде. Статичная часть рисуется один раз в offscreen-холст,
// поверх каждый кадр — живые слои (мерцание ламп, туман, капающие стены, луна).
import { TAU, rand } from '../engine/util.js';
import { drawSceneBg } from './scenes.js';
import { view } from '../engine/core.js';

// Локации игры -> векторные ассеты оригинала; процедурные фоны ниже — запасной вариант, пока вектор грузится
// lair — процедурный закат с утёсами ниже: у вектора title посреди кадра силуэт героини, он спорит с Рудой и Поппи
export const BG_MAP = { cinema: 'corridor', street: 'street', restroom: 'gothic', facade: 'facade', lair: 'lair' };

const W = 960, H = 540, FLOOR = 482;
const cache = new Map();

function off(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rgrad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Кровавые потёки на стене (как в коридоре оригинала)
function smear(ctx, x, y, s, r) {
  ctx.fillStyle = 'rgba(120,30,40,0.55)';
  ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 18 * s, r() * 3, 0, TAU); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU, d = (20 + r() * 25) * s;
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, (4 + r() * 8) * s, (3 + r() * 5) * s, a, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 3; i++) { const dx = (r() - 0.5) * 30 * s, len = (20 + r() * 50) * s; ctx.fillRect(x + dx - 2 * s, y, 4 * s, len); ctx.beginPath(); ctx.arc(x + dx, y + len, 3.5 * s, 0, TAU); ctx.fill(); }
}

function lamp(ctx, x, y) { // красный фонарь-бра
  ctx.fillStyle = rgrad(ctx, x, y + 14, 4, 90, [[0, 'rgba(255,60,60,0.45)'], [1, 'rgba(255,60,60,0)']]); ctx.fillRect(x - 90, y - 76, 180, 180);
  ctx.fillStyle = '#2a0c14'; ctx.fillRect(x - 2, y - 30, 4, 18);
  ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.roundRect(x - 9, y - 12, 18, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.roundRect(x - 4, y - 6, 8, 18, 4); ctx.fill();
  ctx.strokeStyle = '#2a0c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 9, y - 12, 18, 30, 8); ctx.stroke();
}

const DRAW = {
  // 1. Коридор кинотеатра: бирюзовые стены, красные бра, кровавые потёки, красная дорожка (Level cinema)
  cinema(ctx) {
    const r = seeded(7);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#0d2a33'], [0.6, '#16404a'], [1, '#0b1f26']]); ctx.fillRect(0, 0, W, H);
    // потолок с балками
    ctx.fillStyle = '#0a1b22'; ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#1d4e5a'; for (let x = 0; x < W; x += 160) ctx.fillRect(x + 20, 46, 120, 8);
    // перспектива: дальняя стена с дверью
    ctx.fillStyle = '#123640'; ctx.beginPath(); ctx.moveTo(300, 70); ctx.lineTo(660, 70); ctx.lineTo(660, 380); ctx.lineTo(300, 380); ctx.fill();
    ctx.strokeStyle = '#2c6a77'; ctx.lineWidth = 6; ctx.strokeRect(390, 150, 180, 230);
    ctx.fillStyle = '#071318'; ctx.fillRect(400, 160, 160, 220);
    ctx.fillStyle = vgrad(ctx, 160, 380, [[0, 'rgba(40,120,140,0.0)'], [1, 'rgba(40,120,140,0.35)']]); ctx.fillRect(400, 160, 160, 220);
    // ступеньки к двери
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#1b4752' : '#215663'; ctx.fillRect(380 - i * 14, 380 + i * 12, 200 + i * 28, 12); }
    // боковые стены
    ctx.fillStyle = '#0f2f38'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, 70); ctx.lineTo(300, 380); ctx.lineTo(0, FLOOR); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(660, 70); ctx.lineTo(660, 380); ctx.lineTo(W, FLOOR); ctx.fill();
    // трещины
    ctx.strokeStyle = 'rgba(5,20,25,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { let x = r() * W, y = 80 + r() * 260; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += r() * 30; ctx.lineTo(x, y); } ctx.stroke(); }
    // рамки-постеры
    for (const [x, y] of [[90, 150], [200, 130], [760, 130], [870, 150]]) { ctx.fillStyle = '#2a0c14'; ctx.fillRect(x - 24, y - 34, 48, 68); ctx.fillStyle = '#7a1a2a'; ctx.fillRect(x - 18, y - 28, 36, 56); ctx.fillStyle = '#ffcf6b'; ctx.beginPath(); ctx.arc(x, y - 6, 9, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 5; i++) smear(ctx, 60 + r() * 840, 90 + r() * 200, 0.4 + r() * 0.4, r);
    // кресла-банкетки по бокам
    for (const x of [70, 830]) { ctx.fillStyle = '#3a1020'; ctx.beginPath(); ctx.roundRect(x, 420, 70, 50, 10); ctx.fill(); ctx.fillStyle = '#5a1a30'; ctx.beginPath(); ctx.roundRect(x + 6, 410, 58, 22, 8); ctx.fill(); }
    // пол и красная дорожка
    ctx.fillStyle = '#0a1a20'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#c0262e'; ctx.beginPath(); ctx.moveTo(250, FLOOR); ctx.lineTo(710, FLOOR); ctx.lineTo(760, H); ctx.lineTo(200, H); ctx.fill();
    ctx.fillStyle = 'rgba(255,90,90,0.25)'; ctx.fillRect(250, FLOOR, 460, 3);
  },
  // 2. Туманная улица ночью: луна, дома с горящими окнами, кривые деревья, брусчатка (level street)
  street(ctx) {
    const r = seeded(21);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#071426'], [0.55, '#14324a'], [1, '#0b1a2a']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgrad(ctx, 600, 110, 20, 220, [[0, 'rgba(200,240,255,0.35)'], [1, 'rgba(200,240,255,0)']]); ctx.fillRect(0, 0, W, 400);
    ctx.fillStyle = '#e6f6ff'; ctx.beginPath(); ctx.arc(600, 110, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,200,220,0.5)'; ctx.beginPath(); ctx.arc(590, 104, 7, 0, TAU); ctx.arc(612, 122, 5, 0, TAU); ctx.fill();
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; ctx.fillRect(r() * W, r() * 200, 1.5, 1.5); }
    // облака
    ctx.fillStyle = 'rgba(30,60,85,0.9)';
    for (let i = 0; i < 6; i++) { const x = r() * W, y = 40 + r() * 120; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + k * 26, y + Math.sin(k) * 8, 22 + r() * 14, 0, TAU); ctx.fill(); } }
    // дальние дома
    const house = (x, w, h, col, win) => {
      ctx.fillStyle = col; ctx.fillRect(x, FLOOR - h, w, h);
      ctx.beginPath(); ctx.moveTo(x - 8, FLOOR - h); ctx.lineTo(x + w / 2, FLOOR - h - w * 0.45); ctx.lineTo(x + w + 8, FLOOR - h); ctx.fill();
      for (let wy = FLOOR - h + 20; wy < FLOOR - 30; wy += 38) for (let wx = x + 14; wx < x + w - 20; wx += 30) {
        const lit = r() < win; ctx.fillStyle = lit ? '#ffb24a' : '#0d1c2b'; ctx.fillRect(wx, wy, 14, 20);
        if (lit) { ctx.fillStyle = 'rgba(255,170,60,0.18)'; ctx.fillRect(wx - 6, wy - 6, 26, 32); }
      }
    };
    house(40, 150, 210, '#132c40', 0.25); house(220, 120, 160, '#10263a', 0.3); house(650, 130, 180, '#10263a', 0.3); house(800, 150, 230, '#132c40', 0.25);
    // деревья-силуэты
    const tree = (x, s) => {
      ctx.strokeStyle = '#050c16'; ctx.lineCap = 'round';
      const br = (x0, y0, a, len, w, d) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 20, (y0 + y1) / 2, x1, y1); ctx.stroke(); if (d > 0) { br(x1, y1, a - 0.5 - r() * 0.3, len * 0.7, w * 0.62, d - 1); br(x1, y1, a + 0.4 + r() * 0.3, len * 0.66, w * 0.6, d - 1); } };
      br(x, FLOOR, -Math.PI / 2 + (r() - 0.5) * 0.2, 120 * s, 22 * s, 4);
    };
    tree(30, 1.6); tree(930, 1.5); tree(470, 0.9);
    // фонари
    for (const x of [300, 640]) { ctx.fillStyle = '#081320'; ctx.fillRect(x - 3, FLOOR - 170, 6, 170); ctx.fillStyle = rgrad(ctx, x, FLOOR - 170, 2, 70, [[0, 'rgba(255,190,90,0.6)'], [1, 'rgba(255,190,90,0)']]); ctx.fillRect(x - 70, FLOOR - 240, 140, 140); ctx.fillStyle = '#ffc56b'; ctx.beginPath(); ctx.arc(x, FLOOR - 172, 7, 0, TAU); ctx.fill(); }
    // брусчатка
    ctx.fillStyle = '#0d1d2c'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = '#1c3448'; ctx.lineWidth = 1.5;
    for (let y = FLOOR + 8, row = 0; y < H; y += 14, row++) for (let x = (row % 2) * 18; x < W; x += 36) { ctx.beginPath(); ctx.roundRect(x, y, 32, 11, 4); ctx.stroke(); }
  },
  // 3. Готический туалет: каменная кладка, арка, раковины, лужи (Level PF / level final)
  restroom(ctx) {
    const r = seeded(33);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#14141c'], [1, '#22202a']]); ctx.fillRect(0, 0, W, H);
    // кладка
    for (let y = 0, row = 0; y < FLOOR; y += 30, row++) for (let x = -(row % 2) * 35; x < W; x += 70) {
      const v = 30 + Math.floor(r() * 14); ctx.fillStyle = `rgb(${v + 14},${v + 10},${v + 20})`; ctx.fillRect(x + 2, y + 2, 66, 26);
    }
    // арка-проход
    ctx.fillStyle = '#08080c'; ctx.beginPath(); ctx.moveTo(380, FLOOR); ctx.lineTo(380, 230); ctx.quadraticCurveTo(480, 120, 580, 230); ctx.lineTo(580, FLOOR); ctx.fill();
    ctx.strokeStyle = '#4b4658'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(380, FLOOR); ctx.lineTo(380, 230); ctx.quadraticCurveTo(480, 120, 580, 230); ctx.lineTo(580, FLOOR); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 480, 330, 10, 150, [[0, 'rgba(90,200,220,0.25)'], [1, 'rgba(90,200,220,0)']]); ctx.fillRect(380, 180, 200, 300);
    // факелы-бра
    for (const x of [300, 660]) { ctx.fillStyle = rgrad(ctx, x, 200, 2, 110, [[0, 'rgba(255,170,80,0.5)'], [1, 'rgba(255,170,80,0)']]); ctx.fillRect(x - 110, 90, 220, 220); ctx.fillStyle = '#2a2430'; ctx.fillRect(x - 8, 200, 16, 30); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(x, 192, 7, 13, 0, 0, TAU); ctx.fill(); }
    // зеркала и раковины
    for (const x of [130, 830]) {
      ctx.fillStyle = '#3a3646'; ctx.beginPath(); ctx.roundRect(x - 44, 130, 88, 120, 40); ctx.fill();
      ctx.fillStyle = '#1a2a34'; ctx.beginPath(); ctx.roundRect(x - 36, 138, 72, 104, 34); ctx.fill();
      ctx.strokeStyle = 'rgba(160,220,240,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 20, 160); ctx.lineTo(x + 10, 200); ctx.stroke();
      ctx.fillStyle = '#d9cbb8'; ctx.beginPath(); ctx.moveTo(x - 50, 330); ctx.lineTo(x + 50, 330); ctx.quadraticCurveTo(x + 46, 370, x, 375); ctx.quadraticCurveTo(x - 46, 370, x - 50, 330); ctx.fill();
      ctx.fillStyle = '#b5a690'; ctx.fillRect(x - 10, 372, 20, FLOOR - 372);
    }
    for (let i = 0; i < 3; i++) smear(ctx, 200 + r() * 560, 60 + r() * 120, 0.35 + r() * 0.35, r);
    // мокрый плиточный пол
    ctx.fillStyle = '#1e1b24'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    for (let x = 0; x < W; x += 48) { ctx.fillStyle = (x / 48) % 2 ? '#2a2632' : '#24212c'; ctx.fillRect(x, FLOOR, 48, H - FLOOR); }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(80,190,220,0.22)'; ctx.beginPath(); ctx.ellipse(80 + r() * 800, FLOOR + 22 + r() * 30, 40 + r() * 40, 6, 0, 0, TAU); ctx.fill(); }
  },
  // 4. Логово Руды: багровое небо, огромное солнце, чёрные скалы (cut 4.1 / финал)
  lair(ctx) {
    const r = seeded(51);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#3a0610'], [0.5, '#b0201e'], [0.75, '#ff6a3a'], [1, '#2a0408']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgrad(ctx, 480, 300, 60, 330, [[0, 'rgba(255,200,120,0.9)'], [0.35, 'rgba(255,90,60,0.5)'], [1, 'rgba(255,60,40,0)']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(480, 300, 120, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,10,20,0.85)';
    for (let i = 0; i < 7; i++) { const y = 80 + i * 40, x = r() * W; ctx.beginPath(); ctx.ellipse(x, y, 160 + r() * 120, 10 + r() * 8, 0, 0, TAU); ctx.fill(); }
    // скалы-силуэты с потёками
    ctx.fillStyle = '#1a0306';
    ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(0, 120); for (let x = 0; x <= 260; x += 26) ctx.lineTo(x, 140 + r() * 120 + x * 0.6); ctx.lineTo(260, FLOOR); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, FLOOR); ctx.lineTo(W, 120); for (let x = W; x >= 700; x -= 26) ctx.lineTo(x, 140 + r() * 120 + (W - x) * 0.6); ctx.lineTo(700, FLOOR); ctx.fill();
    ctx.fillStyle = '#2a0408'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = 'rgba(232,32,42,0.6)'; ctx.beginPath(); ctx.ellipse(480, FLOOR + 26, 420, 16, 0, 0, TAU); ctx.fill();
  },
  // Фасад кинотеатра под луной (меню, cut 1)
  facade(ctx) {
    const r = seeded(77);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#07040a'], [0.6, '#2a0a0e'], [1, '#120406']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgrad(ctx, 640, 120, 40, 260, [[0, 'rgba(255,240,210,0.55)'], [1, 'rgba(255,240,210,0)']]); ctx.fillRect(0, 0, W, 420);
    ctx.fillStyle = '#f5ead2'; ctx.beginPath(); ctx.arc(640, 120, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,150,0.5)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(610 + r() * 60, 90 + r() * 60, 6 + r() * 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(60,24,32,0.55)';
    for (let i = 0; i < 6; i++) { const x = r() * W, y = 60 + r() * 140; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + k * 30, y + Math.sin(k * 1.3) * 10, 26 + r() * 16, 0, TAU); ctx.fill(); } }
    // здание
    const bx = 260, bw = 440, by = 250;
    ctx.fillStyle = '#3a0c12'; ctx.fillRect(bx, by, bw, FLOOR - by);
    ctx.fillStyle = '#4e1018'; ctx.beginPath(); ctx.moveTo(bx + 150, by); ctx.lineTo(bx + 150, by - 50); ctx.quadraticCurveTo(bx + 220, by - 140, bx + 290, by - 50); ctx.lineTo(bx + 290, by); ctx.fill();
    ctx.fillStyle = '#2a080c'; ctx.fillRect(bx - 20, by - 8, bw + 40, 16);
    ctx.fillStyle = '#ff3a3a'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 18;
    for (const x of [bx + 40, bx + 120, bx + 320, bx + 400]) ctx.fillRect(x - 6, by + 30, 12, 110);
    ctx.fillStyle = '#ffcf6b'; ctx.fillRect(bx + 170, by + 24, 100, 26);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe3a8'; ctx.beginPath(); ctx.roundRect(bx + 185, by + 60, 70, 100, 30); ctx.fill();
    ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.roundRect(bx + 195, by + 70, 50, 80, 22); ctx.fill();
    ctx.fillStyle = '#1a0406'; ctx.fillRect(bx + 10, by + 170, bw - 20, 12);
    ctx.fillStyle = 'rgba(255,170,80,0.7)'; ctx.fillRect(bx + 30, by + 182, bw - 60, FLOOR - by - 182);
    // толпа-силуэты
    ctx.fillStyle = '#0a0204';
    for (let i = 0; i < 46; i++) { const x = r() * W, h = 34 + r() * 26, y = FLOOR + 6 - r() * 20; ctx.beginPath(); ctx.ellipse(x, y - h, 6, 7, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - 8, y - h + 6, 16, h - 4, 6); ctx.fill(); }
    ctx.fillStyle = '#12040a'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = 'rgba(255,60,50,0.35)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(r() * W, FLOOR + 20 + r() * 30, 60, 5, 0, 0, TAU); ctx.fill(); }
  },
};

export function drawBackground(ctx, name, t) {
  if (!(BG_MAP[name] && drawSceneBg(ctx, BG_MAP[name]))) {
    let c = cache.get(name);
    if (!c) { c = off(DRAW[name]); cache.set(name, c); }
    ctx.drawImage(c, 0, 0);
  }
  // живые слои
  if (name === 'cinema') {
    const f = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 3.1);
    ctx.fillStyle = `rgba(255,40,50,${0.04 + f * 0.05})`; ctx.fillRect(0, 0, W, FLOOR);
  }
  if (name === 'street' || name === 'restroom' || name === 'facade') {
    for (let i = 0; i < 4; i++) {
      const y = FLOOR - 40 - i * 26, x = ((t * (12 + i * 5) + i * 300) % (W + 600)) - 300;
      ctx.fillStyle = name === 'facade' ? 'rgba(120,40,40,0.12)' : 'rgba(170,210,230,0.08)';
      ctx.beginPath(); ctx.ellipse(x, y, 320, 34, 0, 0, TAU); ctx.ellipse(x + 520, y + 10, 260, 28, 0, 0, TAU); ctx.fill();
    }
  }
  if (name === 'lair') { ctx.fillStyle = `rgba(255,120,60,${0.08 + 0.05 * Math.sin(t * 2)})`; ctx.fillRect(0, 0, W, H); }
}

// Фон боя на весь динамический вид: масштаб «cover» с привязкой к полу (пол фона 482 → view.ground), верх при необходимости обрезается.
// Горизонталь: если фон шире вида (портрет, ультраширокий), показывается полоса вокруг «фокуса» сцены (доля ширины фона) с лёгкой
// прокруткой за героиней (camX — её x в координатах вида). На 960×540 (s = 1, без запаса) ничего не сдвигается — как раньше.
export const BG_FOCUS = { cinema: 0.37, street: 0.5, restroom: 0.5, facade: 0.5, lair: 0.5 };
// bgPlace(ctx, …) — ставит систему координат фона 960×540 в вид (вызывать внутри save/restore): так же рисуются «живые» слои,
// привязанные к предметам фона (лампы готики и т. п.).
export function bgPlace(ctx, name, camX = null) {
  const G = view.ground, s = Math.max(view.W / 960, G / FLOOR), ex = 960 * s - view.W;
  const cam = camX === null ? 0.5 : camX / view.W;
  const u = Math.min(1, Math.max(0, (BG_FOCUS[name] ?? 0.5) + (cam - 0.5) * 0.7));
  ctx.translate(-ex * u, G - FLOOR * s); ctx.scale(s, s);
}
export function drawBackgroundView(ctx, name, t, camX = null) {
  ctx.save(); bgPlace(ctx, name, camX);
  drawBackground(ctx, name, t);
  ctx.restore();
}

// Рамка-виньетка (Sprite9/12 оригинала — рваные чёрные края)
export function drawVignette(ctx, t) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

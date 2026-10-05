// Пост-обработка кадра «хэллоуинский кинотеатр» (docs/ATMOSPHERE.md, P1-1): цветокор главы, тонированная
// виньетка, «сердцебиение» на низком здоровье, плёночное зерно, царапины и пылинки, мерцание проектора,
// переход-диафрагма между сценами. В бою всё на половинной силе — враги должны читаться.
// W, H — живые привязки к размеру вида (engine/core.js); эффекты считаются от него, форма виньетки — эллипс по пропорции вида
import { W, H, view } from '../engine/core.js';
const DW = 960, DH = 540;

// тинт главы: [цвет, режим, сила]
const TINT = {
  cinema: [['#6b2fa3', 'soft-light', 0.18]],
  street: [['#ff7a1a', 'soft-light', 0.12], ['#1a0b2e', 'multiply', 0.22, 'down']],
  restroom: [['#e0233c', 'soft-light', 0.10]],
  lair: [['#ff9a3c', 'overlay', 0.10]],
};
export const post = { strength: 1, calm: false };   // calm — без плёночных царапин (гардероб)

// ---- виньетка: кэш на offscreen
let vigCan = null;
function vignette() {
  if (vigCan && vigCan.width === W && vigCan.height === H) return vigCan;
  vigCan = document.createElement('canvas'); vigCan.width = W; vigCan.height = H;
  const c = vigCan.getContext('2d');
  c.translate(W / 2, H / 2); c.scale(W / DW, H / DH);   // 960×540 → тот же рисунок; на других видах — эллипс по пропорции
  const g = c.createRadialGradient(0, 0, DH * 0.42, 0, 0, DH * 0.98);
  g.addColorStop(0, 'rgba(14,6,18,0)'); g.addColorStop(0.6, 'rgba(14,6,18,0.32)'); g.addColorStop(1, 'rgba(14,6,18,0.66)');
  c.fillStyle = g; c.fillRect(-DW, -DH, DW * 2, DH * 2);
  return vigCan;
}

// ---- зерно: 4 тайла шума 256×256
let grain = null;
function grainTiles(ctx) {
  if (grain) return grain;
  grain = [];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), id = x.createImageData(256, 256), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (Math.random() * 2 - 1) * 40; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    x.putImageData(id, 0, 0); grain.push(ctx.createPattern(c, 'repeat'));
  }
  return grain;
}

// Мир боя / сцены: цветокор + виньетка + пульс опасности. Рисовать ДО интерфейса.
// o: { bg: ключ главы, hp, maxHp, t, fight }
export function drawGrade(ctx, o = {}) {
  const s = post.strength * (o.fight ? 0.6 : 1);
  if (s <= 0) return;
  ctx.save();
  for (const [col, mode, a, dir] of TINT[o.bg] || TINT.cinema) {
    ctx.globalCompositeOperation = mode; ctx.globalAlpha = a * s;
    if (dir === 'down') { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; }
    else ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(vignette(), 0, 0);
  // сердцебиение: 2 HP — 0,8 Гц, 1 HP — 1,1 Гц, двойной удар
  if (o.fight && o.hp > 0 && o.hp <= 2) {
    const f = o.hp <= 1 ? 1.1 : 0.8, ph = (o.t * f) % 1;
    const beat = t => Math.max(0, 1 - Math.abs(ph - t) / 0.06);
    const a = Math.max(beat(0.06), beat(0.28) * 0.8) * (o.hp <= 1 ? 0.26 : 0.18);
    if (a > 0.003) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(W / DW, H / DH);
      const g = ctx.createRadialGradient(0, 0, DH * 0.3, 0, 0, DH * 0.85);
      g.addColorStop(0, 'rgba(224,35,60,0)'); g.addColorStop(1, `rgba(224,35,60,${a})`);
      ctx.fillStyle = g; ctx.fillRect(-DW, -DH, DW * 2, DH * 2); ctx.restore();
    }
  }
  ctx.restore();
}

// Плёнка поверх всего кадра: зерно, мерцание, (вне боя) царапины и пылинки
const specks = [];
let frame = 0, tile = 0;
export function drawFilm(ctx, o = {}) {
  const s = post.strength; if (s <= 0) return;
  frame++; if (frame % 2 === 0) tile = (tile + 1) % 4;
  const fight = !!o.fight;
  ctx.save();
  // зерно
  const pat = grainTiles(ctx)[tile];
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = (fight ? 0.05 : 0.09) * s;
  ctx.translate(-(Math.random() * 256) | 0, -(Math.random() * 256) | 0);
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  // мерцание проектора
  const fl = (Math.sin(frame * 0.71) * 0.5 + Math.sin(frame * 1.37 + 1) * 0.5) * 0.5 + 0.5;
  ctx.globalAlpha = (fight ? 0.015 : 0.03) * fl * s; ctx.fillStyle = '#0e0612'; ctx.fillRect(0, 0, W, H);
  // царапины и пылинки
  if (Math.random() < 0.04 * s) specks.push(!fight && !post.calm && Math.random() < 0.5
    ? { k: 'line', x: Math.random() * W, y0: Math.random() * H * 0.3, h: H * (0.6 + Math.random() * 0.4), life: 3 + (Math.random() * 6 | 0) }
    : { k: 'dot', x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.6, life: 1 + (Math.random() * 2 | 0) });
  for (const p of specks) {
    p.life--;
    if (p.k === 'line') { if (post.calm) { p.life = 0; continue; } p.x += Math.random() * 4 - 2; ctx.globalAlpha = 0.25 * s; ctx.fillStyle = '#fff1c9'; ctx.fillRect(p.x, p.y0, 1, p.h); }
    else { ctx.globalAlpha = 0.5 * s; ctx.fillStyle = '#0e0612'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.4, p.r, p.x, 0, Math.PI * 2); ctx.fill(); }
  }
  for (let i = specks.length - 1; i >= 0; i--) if (specks[i].life <= 0) specks.splice(i, 1);
  ctx.restore();
}

// Переход-диафрагма (iris): после смены сцены чёрная заливка с растущей круглой дырой
let iris = null;
export function startIris(x = W / 2, y = H / 2, dur = 0.55) { iris = { x, y, t: 0, dur }; }
export function drawIris(ctx, rdt) {
  if (!iris) return;
  iris.t += rdt; const k = Math.min(1, iris.t / iris.dur);
  if (k >= 1) { iris = null; return; }
  const e = 1 - Math.pow(1 - k, 3);   // easeOutCubic
  const R = 4 + e * Math.hypot(W, H);
  ctx.save(); ctx.fillStyle = '#0e0612';
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(iris.x, iris.y, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,241,201,0.35)'; ctx.beginPath(); ctx.arc(iris.x, iris.y, R, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ---- Эмбиент главы (P2-1, P2-2): луч проектора с пылью в кинотеатре, листья на улице, туман у пола
const dust = Array.from({ length: 40 }, () => ({ fx: Math.random(), ox: 0, fy: Math.random(), y: null, s: 1 + Math.random() * 1.5, seed: Math.random() * 9 }));
const LEAF_C = ['#ff7a1a', '#d9480f', '#8a3a10', '#ff7a1a', '#d9480f', '#6b2fa3'];
const leaves = Array.from({ length: 16 }, (_, i) => ({ x: null, fx: Math.random(), fy: Math.random(), y: null, vy: 30 + Math.random() * 30, ph: Math.random() * 6, sz: 8 + Math.random() * 6, c: LEAF_C[i % LEAF_C.length], rot: Math.random() * 6 }));
let gustT = 0, gust = 0, lastT = 0, glitch = 0;
export function drawAmbient(ctx, bg, t, fight = true) {
  const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  const s = post.strength; if (s <= 0) return;
  ctx.save();
  if (bg === 'cinema') {
    // луч проектора: трапеция от точки над экраном, «сбои» раз в 8–15 с
    if (Math.random() < dt / 11) glitch = 0.18;
    glitch = Math.max(0, glitch - dt);
    const fl = 0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 3.1) - (glitch > 0 && Math.sin(t * 60) > 0 ? 0.6 : 0);
    ctx.globalCompositeOperation = 'lighter';
    const G = view.ground, cx = W / 2;
    const g = ctx.createLinearGradient(0, -20, 0, G);
    g.addColorStop(0, `rgba(255,241,201,${0.13 * fl * s})`); g.addColorStop(1, 'rgba(255,241,201,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 30, -20); ctx.lineTo(cx + 30, -20); ctx.lineTo(cx + 280, G); ctx.lineTo(cx - 280, G); ctx.closePath(); ctx.fill();
    // пыль в луче
    for (const d of dust) {
      if (d.y === null) d.y = d.fy * (G - 2);
      d.ox += Math.sin(t * 0.7 + d.seed) * 10 * dt; d.y += Math.cos(t * 0.5 + d.seed * 2) * 8 * dt - 4 * dt;
      if (d.y < -5) d.y = G - 2; if (d.y > G + 3) d.y = 0;
      const dx = d.fx * W + d.ox;
      const half = 30 + (d.y + 20) / (G + 20) * 250, inside = Math.max(0, 1 - Math.abs(dx - cx) / half);
      if (inside <= 0) continue;
      ctx.fillStyle = `rgba(255,241,201,${0.6 * inside * (0.6 + 0.4 * Math.sin(t * 3 + d.seed)) * fl * s})`;
      ctx.beginPath(); ctx.arc(dx, d.y, d.s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (bg === 'street') {
    gustT -= dt; if (gustT <= 0) { gustT = 6 + Math.random() * 4; gust = 1.2; }
    gust = Math.max(0, gust - dt);
    for (const L of leaves) {
      if (L.y === null) { L.x = L.fx * W; L.y = L.fy * H; }
      L.y += L.vy * dt; L.x += (Math.sin(t * 2.4 + L.ph) * 30 + gust * 120) * dt; L.rot += dt * (1.5 + gust * 4);
      if (L.y > H + 5 || L.x > W + 20) { L.y = -10; L.x = Math.random() * W - (gust > 0 ? 200 : 0); }
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.rot); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + L.ph)));
      ctx.fillStyle = L.c; ctx.globalAlpha = 0.85 * s;
      ctx.beginPath(); ctx.moveTo(-L.sz / 2, 0); ctx.quadraticCurveTo(0, -L.sz * 0.45, L.sz / 2, 0); ctx.quadraticCurveTo(0, L.sz * 0.45, -L.sz / 2, 0); ctx.fill();
      ctx.restore();
    }
  }
  // туман у пола: три пласта
  for (let i = 0; i < 3; i++) {
    const sp = [8, 14, 22][i], off = (t * sp) % 320;
    ctx.fillStyle = i === 2 ? `rgba(107,47,163,${0.08 * s})` : `rgba(26,11,46,${0.28 * s})`;
    for (let x = -320 + off; x < W + 320; x += 320) { ctx.beginPath(); ctx.ellipse(x + i * 90, view.ground - 4 - i * 6, 210, 18 + i * 4, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

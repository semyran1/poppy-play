// Поппи: платформер-контроллер с «честными» приёмами (койот-тайм, буфер прыжка, переменная высота),
// кадры неуязвимости после удара, сквош/стретч при прыжке и приземлении.
import { clamp } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { drawHeroine, heroineMuzzle } from '../art/heroine.js';

export const GROUND = 482;
export const ARENA = { left: 40, right: 920 };

const IMG = {};
// Игровая модель — оригинальная Поппи с бластером из Construct 3, повёрнутая как в раскладке оригинала (242°);
// точка дула — «bullet point» оригинала после поворота (assets/poppy_gun.json).
export const MODEL = { h: 100, w: 0, muzzleX: 0, muzzleY: 0 };
export function loadPoppyImages() {
  const names = { gun: 'assets/poppy_gun.png', stand: 'assets/poppy_stand.png', run1: 'assets/poppy_run1.png', run2: 'assets/poppy_run2.png' };
  const meta = fetch('assets/poppy_gun.json').then(r => r.json()).then(m => {
    const k = MODEL.h / m.h; MODEL.w = m.w * k; MODEL.muzzleX = (m.muzzle[0] - m.w / 2) * k; MODEL.muzzleY = (m.muzzle[1] - m.h) * k + 4;
  }).catch(() => { MODEL.w = 92; MODEL.muzzleX = 7; MODEL.muzzleY = -92; });
  return Promise.all([meta, ...Object.entries(names).map(([k, src]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; IMG[k + '_hurt'] = tint(im, '#ff2a4a'); res(); }; im.onerror = res; im.src = src; }))]);
}
// Точка вылета снарядов (дуло бластера) в координатах мира
// Поза куклы героини по состоянию игрока (бег/прыжок — слепки мокапа, всегда с прицелом вверх)
export function playerPose(p, t) {
  const moving = Math.abs(p.vx) > 40;
  let kind = 'aim', u = 0;
  if (!p.onGround) { kind = 'jump'; u = p.vy < -200 ? 0.45 : p.vy < 150 ? 0.55 : 0.66; }
  else if (moving) { kind = 'run'; u = p.runU; }
  return { kind, u, t, aim: true, facing: p.facing || 'front', blink: (t % 3.7) < 0.12 ? 1 : 0 };
}
export const CLASSIC_H = 96;   // классическая модель оригинала (PNG с бластером)
export function muzzle(p) {
  if (p.hero === 'classic') { const k = CLASSIC_H / MODEL.h; return { x: p.x + MODEL.muzzleX * k * p.face, y: p.y + MODEL.muzzleY * k * p.sy }; }
  const m = heroineMuzzle(playerPose(p, 0), p.outfit), k = MODEL.h / 300;
  return { x: p.x + m[0] * k * p.face, y: p.y + m[1] * k };
}

// Заранее окрашенная копия силуэта (вспышка урона) — source-atop по общему холсту залил бы и фон
function tint(im, color) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export function createPlayer(stats) {
  return {
    x: 480, y: GROUND, vx: 0, vy: 0, w: 30, h: 88, runU: 0, outfit: 'pajama', facing: 'front',
    onGround: true, coyote: 0, jumpBuf: 0, jumpsLeft: 0,
    face: 1, runT: 0, sx: 1, sy: 1,
    hp: stats.maxHp, iframes: 0, dead: false, hurtFlash: 0,
    stats,
  };
}

export function updatePlayer(p, inp, dt) {
  const st = p.stats;
  const maxSpd = 340 * st.moveSpeed;
  let target = inp.move;
  if (inp.touchTargetX !== null) { // тач: идём к пальцу, с мёртвой зоной
    const d = inp.touchTargetX - p.x; target = Math.abs(d) < 10 ? 0 : clamp(d / 60, -1, 1);
  }
  const accel = p.onGround ? 3200 : 2200;
  const want = target * maxSpd;
  if (Math.abs(want) > 1) p.vx += clamp(want - p.vx, -accel * dt, accel * dt);
  else p.vx += clamp(-p.vx, -3600 * dt, 3600 * dt);
  if (Math.abs(target) > 0.2) p.face = Math.sign(target);

  // прыжок
  p.coyote = p.onGround ? 0.09 : p.coyote - dt;
  p.jumpBuf = inp.jumpPressed ? 0.12 : p.jumpBuf - dt;
  if (p.jumpBuf > 0) {
    if (p.coyote > 0) { doJump(p, 1); }
    else if (p.jumpsLeft > 0) { p.jumpsLeft--; doJump(p, 0.85); }
  }
  if (!inp.jump && p.vy < -200) p.vy += 4200 * dt; // отпустил — прыжок ниже
  const g = p.vy > 0 ? 2600 : 1750;
  p.vy = Math.min(p.vy + g * dt, 1100);
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, ARENA.left + p.w / 2, ARENA.right - p.w / 2);
  if (p.y >= GROUND) {
    if (!p.onGround && p.vy > 300) { p.sx = 1.25; p.sy = 0.75; sfx('thud', { vol: 0.35 }); }
    p.y = GROUND; p.vy = 0; p.onGround = true; p.jumpsLeft = st.extraJumps;
  } else p.onGround = false;

  p.sx += (1 - p.sx) * Math.min(1, dt * 14); p.sy += (1 - p.sy) * Math.min(1, dt * 14);
  p.runT += Math.abs(p.vx) * dt * 0.02;
  p.runU += Math.abs(p.vx) * dt / 104;   // фаза бега по пройденному пути — стопа не скользит
  p.iframes = Math.max(0, p.iframes - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
}

function doJump(p, k) {
  p.vy = -680 * k * p.stats.jump; p.onGround = false; p.coyote = 0; p.jumpBuf = 0;
  p.sx = 0.78; p.sy = 1.25; sfx('whoosh', { vol: 0.4, pitch: 1.4 });
}

// Хитбокс для урона — меньше спрайта (честность к игроку)
export function playerBox(p) { return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h }; }

export function drawPlayer(ctx, p, t) {
  if (p.dead) return;
  const blink = p.iframes > 0 && Math.floor(t * 20) % 2 === 0;
  const air = Math.min(1, (GROUND - p.y) / 200);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, GROUND + 3, 26 * (1 - air * 0.5), 6 * (1 - air * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  if (blink) return;
  ctx.save();
  if (p.hurtFlash > 0) ctx.filter = 'sepia(1) saturate(6) hue-rotate(-40deg) brightness(1.1)';
  ctx.translate(p.x, p.y);
  if (p.hero === 'classic' && IMG.gun) { // Поппи оригинала: модель с бластером, бег — подпрыгивание кодом
    const moving = Math.abs(p.vx) > 40 && p.onGround, H = CLASSIC_H, Wd = MODEL.w * H / MODEL.h;
    const bob = moving ? Math.abs(Math.sin(p.runT * 7)) * 5 : Math.sin(t * 3) * 1.5;
    ctx.rotate(moving ? Math.sin(p.runT * 7) * 0.05 + p.vx / 6000 : 0); ctx.scale(p.face * p.sx, p.sy);
    ctx.drawImage(IMG.gun, -Wd / 2, -H - bob, Wd, H);
  } else { ctx.scale(p.sx, p.sy); drawHeroine(ctx, 0, 0, MODEL.h, playerPose(p, t), p.outfit, { flip: p.face < 0 }); }
  ctx.restore();
}

// Глава 3 «Готика» (готический туалет, фон — вектор gothic с водой на полу).
// Враги: Фонтанчик (пузырьки 1 с → струя из пола: ранит и подбрасывает капли вверх), Призрак Перепадов
// (уязвим только в розовой фазе), Тяга к сладкому (луч ворует конфеты; сбить с добычей = конфеты ×2).
// Босс «Королева ПМС»: три маски — Гнев (удары и волны по полу), Слёзы (дождь из слёз с просветами),
// Тяга (самонаводящиеся сладости, сбиваются). Подсказка каждой атаки 0,8–1,2 с; снаряды крупные, с обводкой.
// Здесь же общий «движок» вражеских снарядов (f.own) и опасностей босса — им пользуется и финал с Рудой.
import { rand, clamp, pick, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { drawTentacle } from '../art/icons.js';
import { makeEnemy } from './enemies.js';
import { GROUND, ARENA } from './player.js';
import { view } from '../engine/core.js';

const JET_H = 372;           // высота струи фонтанчика (вершина у y ≈ 110)
const INK = '#14060f';

// ---------- маленькие помощники рисования ----------
function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function outlined(ctx, fill, rim, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = rim; ctx.stroke(); }
function label(ctx, s, x, y, size, color, rim = INK) {
  ctx.font = `900 ${size}px Nunito, "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 4.5); ctx.strokeStyle = rim; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// Капля-слеза остриём вверх (летит вниз), крупная, с тёмной обводкой и бликом
function tearPath(ctx, r) {
  ctx.beginPath(); ctx.moveTo(0, -r * 2.1);
  ctx.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.05, -r * 0.4, r, r * 0.2);
  ctx.bezierCurveTo(r * 0.95, r * 0.85, r * 0.45, r * 1.05, 0, r * 1.05);
  ctx.bezierCurveTo(-r * 0.45, r * 1.05, -r * 0.95, r * 0.85, -r, r * 0.2);
  ctx.bezierCurveTo(-r * 1.05, -r * 0.4, -r * 0.5, -r * 1.2, 0, -r * 2.1); ctx.closePath();
}
export function drawBigTear(ctx, x, y, r, rot = 0, fill = '#8fe3ff', rim = '#0b3a66') {
  glow(ctx, x, y, r * 2.8, 'rgba(140,220,255,0.75)');
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  tearPath(ctx, r); outlined(ctx, fill, rim, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(r * 0.35, -r * 0.2, r * 0.22, r * 0.4, 0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function heart(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
}
export { heart as heartPath, glow as softGlow, label as bigLabel };

// ======================================================================================
// Враги главы
// ======================================================================================
export function initC3(e, o) {
  if (e.type === 'spout') {
    e.y = GROUND + 4; e.r = 0; e.immune = true; e.noTarget = true; e.state = 'wait'; e.st = 0;
    e.jets = o.jets ?? 2; e.w = 42; e.top = GROUND; e.vy = 0; e.placed = !!o.placed;
  }
  if (e.type === 'ghost') { e.baseX = e.x; e.mood = 'pink'; e.moodT = rand(1.6, 2.4); e.swapT = 0; }
  if (e.type === 'craving') { e.state = 'enter'; e.st = 0; e.hoverY = ARENA.sky + rand(92, 140); e.vy = 150; e.loot = 0; e.cycles = 0; e.flap = rand(TAU); e.onKill = cravingKill; }
}

function cravingKill(G, e) {
  if (e.loot <= 0) return;
  const n = Math.min(40, e.loot * 2);
  for (let i = 0; i < n; i++) G.dropPickup?.('candy', e.x + rand(-20, 20), e.y, 1);
  G.floaters.add(e.x, e.y - 30, `Вернула ×2!`, { size: 22, color: '#ffd166', life: 1.2 });
  sfx('coin', { pitch: 1.6 });
}

export function updateC3(G, e, dt, k) {
  const p = G.p;
  switch (e.type) {
    case 'spout': {
      e.st += dt * k;
      if (e.state === 'wait') {
        if (!e.placed && Math.random() < 0.6) e.x = clamp(p.x + rand(-130, 130), 70, view.W - 70);
        // не ставим два фонтанчика вплотную
        for (const f of G.enemies) if (f !== e && f.type === 'spout' && Math.abs(f.x - e.x) < 70) e.x = clamp(e.x + (e.x < view.W / 2 ? 110 : -110), 70, view.W - 70);
        e.state = 'bubble'; e.st = 0; sfx('splash', { pitch: 0.5, vol: 0.25 });
      } else if (e.state === 'bubble') {
        if (Math.random() < dt * 14) G.parts.spawn({ x: e.x + rand(-16, 16), y: GROUND - 2, vy: -rand(30, 70), life: 0.5, size: rand(2.5, 5), color: 'rgba(190,240,255,0.9)', shape: 'ring' });
        if (e.st >= 1.0) { e.state = 'jet'; e.st = 0; e.jetId = (e.jetId || 0) + 1; sfx('splash', { pitch: 1.1, vol: 0.6 }); sfx('whoosh', { pitch: 0.6, vol: 0.4 }); G.shake(0.1);
          G.parts.burst(e.x, GROUND - 6, 12, { color: ['#bff3ff', '#ffffff', '#5fc8ff'], speed: [120, 300], g: 700, angle: -Math.PI / 2, spread: 0.9, life: [0.3, 0.6], size: [2, 5], shape: 'drop' }); }
      } else if (e.state === 'jet') {
        const rise = clamp(e.st / 0.14, 0, 1), fall = e.st > 0.95 ? clamp((e.st - 0.95) / 0.25, 0, 1) : 0;
        e.top = GROUND - JET_H * rise * (1 - fall);
        if (e.st < 1.1 && e.top < p.y - 8 && Math.abs(p.x - e.x) < e.w / 2 + 10) G.hurtPlayer('spout');
        // струя подбрасывает капли вверх (выигрываешь время) и подкидывает желе
        for (const f of G.enemies) {
          if (f === e || f.dead || Math.abs(f.x - e.x) > e.w / 2 + f.r || f.y < e.top - f.r) continue;
          if (f.type === 'droplet' || f.type === 'drop') f.vy = Math.min(f.vy, -95);
          else if (f.type === 'crier' || f.type === 'ghost') f.y -= 140 * dt;
          else if (f.type === 'jelly' && f.pushed !== e.jetId + e.seed) { f.pushed = e.jetId + e.seed; f.vy = Math.min(f.vy, -560); }
        }
        if (Math.random() < dt * 30) G.parts.spawn({ x: e.x + rand(-14, 14), y: e.top + 4, vx: rand(-90, 90), vy: -rand(20, 120), g: 600, life: 0.5, size: rand(2, 4), color: Math.random() < 0.5 ? '#ffffff' : '#9fe6ff', shape: 'drop' });
        if (e.st > 1.25) { e.jets--; e.state = e.jets > 0 ? 'rest' : 'gone'; e.st = 0; e.top = GROUND; }
      } else if (e.state === 'rest') { if (e.st > 1.4) { e.state = 'bubble'; e.st = 0; } }
      else if (e.state === 'gone' && e.st > 0.5) e.dead = true;
      break;
    }
    case 'ghost': {
      e.moodT -= dt * k; e.swapT = Math.max(0, e.swapT - dt);
      if (e.moodT <= 0) {
        e.mood = e.mood === 'pink' ? 'blue' : 'pink'; e.moodT = e.mood === 'pink' ? 2.4 : 1.9; e.swapT = 0.3;
        sfx(e.mood === 'pink' ? 'pickup' : 'whoosh', { pitch: e.mood === 'pink' ? 1.3 : 0.5, vol: 0.25, gap: 0.15 });
      }
      e.immune = e.mood === 'blue';
      const blue = e.immune;
      e.y += e.vy * k * dt * (blue ? 0.55 : 1);
      e.baseX = clamp(e.baseX, ARENA.left + 60, ARENA.right - 60);
      e.x = e.baseX + Math.sin(e.t * (blue ? 2.3 : 1.1) + e.seed) * (blue ? 80 : 46);
      if (e.y + e.r * 0.8 >= GROUND) G.floorHit(e);
      break;
    }
    case 'craving': {
      e.st += dt * k; e.flap += dt * 14;
      if (e.state === 'enter') { e.y += e.vy * k * dt; if (e.y >= e.hoverY) { e.state = 'hover'; e.st = 0; } }
      else if (e.state === 'hover') { e.x += clamp(p.x - e.x, -1, 1) * Math.min(Math.abs(p.x - e.x), 85) * k * dt; e.y = e.hoverY + Math.sin(e.t * 3) * 6; if (e.st > 1.3) { e.state = 'aim'; e.st = 0; sfx('select', { pitch: 1.6, vol: 0.3 }); } }
      else if (e.state === 'aim') { e.x += clamp(p.x - e.x, -1, 1) * Math.min(Math.abs(p.x - e.x), 30) * k * dt; if (e.st > 1.0) { e.state = 'beam'; e.st = 0; sfx('zap', { pitch: 0.7, vol: 0.3 }); } }
      else if (e.state === 'beam') {
        // луч засасывает конфеты и звёзды опыта с пола, а если поймал Поппи — крадёт конфеты из кармана
        for (const q of G.pickups) if ((q.kind === 'candy' || q.kind === 'xp') && !q.magnet && Math.abs(q.x - e.x) < 34 && q.y > e.y) {
          q.vx = (e.x - q.x) * 3; q.vy = -260;
          if (q.y < e.y + 24) { q.dead = true; if (q.kind === 'candy') e.loot += q.v; }
        }
        if (Math.abs(p.x - e.x) < 34 && !p.dead) {
          const n = Math.min(12, G.run.candies); G.run.candies -= n; e.loot += n + 2;
          G.floaters.add(p.x, p.y - 120, n ? `−${n} конфет!` : 'Ам!', { size: 22, color: '#ff7ac8', life: 1.2 });
          sfx('coin', { pitch: 0.6 }); e.state = 'flee'; e.st = 0;
          if (n) G.say('Эй! Это мои конфеты!', '#fff', 'shout');
        } else if (e.st > 1.3) { e.cycles++; e.state = e.cycles >= 3 ? 'flee' : 'hover'; e.st = 0; }
      } else if (e.state === 'flee') {
        e.y -= (e.loot ? 120 : 200) * k * dt; e.x += Math.sin(e.t * 5) * 60 * dt;
        if (e.y < -50) { e.dead = true; if (e.loot > 2) G.floaters.add(e.x, 40, 'Унесла конфеты…', { size: 16, color: '#ff9ad0' }); }
      }
      break;
    }
  }
}

export function drawC3(G, ctx, e) {
  const hit = e.hitT > 0;
  switch (e.type) {
    case 'spout': drawSpout(ctx, e, G.t); break;
    case 'ghost': drawGhost(ctx, e, hit); break;
    case 'craving': drawCraving(ctx, e, hit, G.t); break;
  }
}

function drawSpout(ctx, e, t) {
  const x = e.x, a = e.state === 'gone' ? 1 - e.st / 0.5 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  // лужица на полу
  const pw = e.state === 'bubble' ? 22 + e.st * 18 : 30;
  ctx.fillStyle = 'rgba(80,190,240,0.45)'; ctx.beginPath(); ctx.ellipse(x, GROUND + 3, pw, 6, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,245,255,0.7)'; ctx.stroke();
  if (e.state === 'bubble') {
    const k = e.st / 1.0, blink = Math.sin(e.st * (10 + k * 18)) > 0 ? 1 : 0.55;
    // колонна-подсказка: где ударит струя
    ctx.fillStyle = `rgba(110,210,255,${(0.12 + 0.22 * k) * blink})`; ctx.fillRect(x - e.w / 2, GROUND - JET_H, e.w, JET_H);
    ctx.setLineDash([12, 8]); ctx.lineDashOffset = t * 40; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(200,245,255,${0.5 + 0.5 * k})`;
    ctx.beginPath(); ctx.moveTo(x - e.w / 2, GROUND); ctx.lineTo(x - e.w / 2, GROUND - JET_H); ctx.moveTo(x + e.w / 2, GROUND); ctx.lineTo(x + e.w / 2, GROUND - JET_H); ctx.stroke(); ctx.setLineDash([]);
    // пузырьки
    for (let i = 0; i < 7; i++) {
      const ph = (e.st * 1.6 + i / 7) % 1, bx = x + Math.sin(i * 2.3 + e.seed) * 15, by = GROUND - ph * 46, r = 3 + (i % 3) * 1.6;
      ctx.globalAlpha = a * (1 - ph * 0.6); ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fillStyle = 'rgba(200,245,255,0.35)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#e6fbff'; ctx.stroke();
    }
    ctx.globalAlpha = a;
    label(ctx, '!', x, GROUND - 70 - Math.sin(e.st * 12) * 3, 32 + k * 8, '#e6fbff', '#062a44');
  }
  if (e.state === 'jet' && e.top < GROUND - 2) {
    const top = e.top, w = e.w;
    glow(ctx, x, (top + GROUND) / 2, (GROUND - top) * 0.55, 'rgba(120,220,255,0.35)');
    ctx.beginPath(); ctx.moveTo(x - w * 0.45, GROUND);
    for (let y = GROUND; y > top; y -= 18) ctx.lineTo(x - w * 0.5 + Math.sin(y * 0.09 + t * 22) * 4, y);
    ctx.lineTo(x - w * 0.3, top); ctx.lineTo(x + w * 0.3, top);
    for (let y = top; y < GROUND; y += 18) ctx.lineTo(x + w * 0.5 + Math.sin(y * 0.09 + t * 22 + 2) * 4, y);
    ctx.lineTo(x + w * 0.45, GROUND); ctx.closePath();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#3fb4ef'); g.addColorStop(0.45, '#e9fbff'); g.addColorStop(1, '#3fa0e0');
    outlined(ctx, g, '#073457', 3);
    // полосы течения
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const yy = top + ((t * 520 + i * 90) % Math.max(1, GROUND - top)); ctx.beginPath(); ctx.moveTo(x - 6 + i * 4, yy); ctx.lineTo(x - 6 + i * 4, Math.min(GROUND, yy + 26)); ctx.stroke(); }
    // пена на вершине
    for (let i = 0; i < 5; i++) { const fx = x + (i - 2) * 9, fy = top + Math.sin(t * 18 + i) * 3; ctx.beginPath(); ctx.arc(fx, fy, 9 - Math.abs(i - 2) * 1.5, 0, TAU); outlined(ctx, '#ffffff', '#073457', 2.5); }
  }
  ctx.restore();
}

function ghostPath(ctx, r, t) {
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(r, r * 1.1);
  const n = 4;
  for (let i = 0; i < n; i++) { const x0 = r - (i + 0.5) * (2 * r / n), x1 = r - (i + 1) * (2 * r / n), wob = Math.sin(t * 6 + i) * r * 0.08; ctx.quadraticCurveTo(x0, r * 1.45 + wob, x1, r * 1.1); }
  ctx.closePath();
}
function drawGhost(ctx, e, hit) {
  const r = e.r;
  let blue = e.mood === 'blue';
  if (e.moodT < 0.45 && Math.sin(e.t * 40) > 0) blue = !blue;         // мигает перед сменой настроения
  const pop = e.swapT > 0 ? 1 + e.swapT * 0.6 : 1;
  ctx.save(); ctx.translate(e.x, e.y + Math.sin(e.t * 3) * 3); ctx.scale(pop, 1 / pop);
  if (!blue) glow(ctx, 0, 4, r * 2.4, 'rgba(255,120,190,0.55)');
  ctx.globalAlpha = blue ? 0.62 : 1;
  ghostPath(ctx, r, e.t);
  outlined(ctx, hit && !blue ? '#ffffff' : blue ? '#8ea4c8' : '#ff9ccc', blue ? '#24325e' : '#8a1d55', 3);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.45, -r * 0.45, r * 0.18, r * 0.3, -0.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  if (!blue) {
    // хорошее настроение: глаза-дуги, румянец, улыбка
    ctx.strokeStyle = '#4a0a2a'; ctx.lineWidth = 3;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.36, -r * 0.05, r * 0.17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,60,120,0.55)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.58, r * 0.22, r * 0.16, r * 0.1, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, r * 0.22, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // сердечко над головой
    ctx.save(); ctx.translate(0, -r * 1.55 - Math.sin(e.t * 5) * 3); heart(ctx, 0, 0, 6); outlined(ctx, '#ff4f9a', '#4a0a2a', 2); ctx.restore();
  } else {
    // плохое настроение: грустные глаза со слезой, кривой рот, тучка
    ctx.fillStyle = '#16203f';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.36, 0, r * 0.13, r * 0.18, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#16203f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s * r * 0.18, -r * 0.32); ctx.lineTo(s * r * 0.56, -r * 0.2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-r * 0.25, r * 0.45); ctx.quadraticCurveTo(-r * 0.08, r * 0.28, 0, r * 0.42); ctx.quadraticCurveTo(r * 0.1, r * 0.3, r * 0.25, r * 0.45); ctx.stroke();
    ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.32 + (e.t * 30 % 10), 3, 4.5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0, -r * 1.6); ctx.fillStyle = '#5a6a8a'; ctx.strokeStyle = '#24325e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-7, 0, 7, 0, TAU); ctx.arc(3, -3, 9, 0, TAU); ctx.arc(11, 1, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9fe6ff'; for (let i = 0; i < 3; i++) { const yy = 8 + ((e.t * 40 + i * 7) % 14); ctx.fillRect(-6 + i * 7, yy, 2, 4); }
    ctx.restore();
  }
  ctx.restore();
}

function drawCraving(ctx, e, hit, t) {
  const r = e.r;
  // луч и его подсказка
  if (e.state === 'aim') {
    const k = e.st / 1.0, blink = Math.sin(e.st * 26) > 0 ? 1 : 0.5;
    ctx.save(); ctx.setLineDash([9, 8]); ctx.lineDashOffset = -t * 50; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,120,200,${(0.4 + 0.5 * k) * blink})`;
    ctx.beginPath(); ctx.moveTo(e.x - 14, e.y + r); ctx.lineTo(e.x - 34, GROUND); ctx.moveTo(e.x + 14, e.y + r); ctx.lineTo(e.x + 34, GROUND); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,120,200,${0.1 * k})`; ctx.beginPath(); ctx.moveTo(e.x - 14, e.y + r); ctx.lineTo(e.x + 14, e.y + r); ctx.lineTo(e.x + 34, GROUND); ctx.lineTo(e.x - 34, GROUND); ctx.fill();
    ctx.restore();
    label(ctx, '!', e.x, e.y - r - 26, 26, '#ff9ad0');
  }
  if (e.state === 'beam') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, e.y, 0, GROUND); g.addColorStop(0, 'rgba(255,110,200,0.65)'); g.addColorStop(1, 'rgba(255,110,200,0.18)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x - 14, e.y + r * 0.6); ctx.lineTo(e.x + 14, e.y + r * 0.6); ctx.lineTo(e.x + 34, GROUND); ctx.lineTo(e.x - 34, GROUND); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,245,0.8)'; for (let i = 0; i < 6; i++) { const ph = (t * 1.6 + i / 6) % 1, yy = GROUND - ph * (GROUND - e.y - r), xx = e.x + Math.sin(i * 3 + t * 4) * 18 * (1 - ph * 0.5); ctx.beginPath(); ctx.arc(xx, yy, 2.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.translate(e.x, e.y);
  // крылышки-фантики (хлопают)
  const fl = Math.sin(e.flap) * 0.35;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1); ctx.rotate(fl);
    ctx.beginPath(); ctx.moveTo(r * 0.85, 0); ctx.lineTo(r * 1.9, -r * 0.75); ctx.quadraticCurveTo(r * 1.6, 0, r * 1.9, r * 0.75); ctx.closePath();
    outlined(ctx, hit ? '#fff' : '#ff4fb0', '#5a0a3a', 2.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r * 1.05, -r * 0.12); ctx.lineTo(r * 1.7, -r * 0.5); ctx.stroke();
    ctx.restore();
  }
  // тело-леденец со спиралью
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r, 0, 0, TAU); outlined(ctx, hit ? '#fff' : '#ffe1f1', '#5a0a3a', 3);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05 - 1.5, r - 1.5, 0, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#ff5ab4'; ctx.lineWidth = r * 0.28;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + i * 0.3), t * 3 + i * 2.1, t * 3 + i * 2.1 + Math.PI * 0.9); ctx.stroke(); }
  ctx.restore();
  // глаза и рот с язычком
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.36, -r * 0.12, r * 0.24, r * 0.28, 0, 0, TAU); outlined(ctx, '#fff', '#5a0a3a', 2); ctx.fillStyle = '#2a0a2a'; ctx.beginPath(); ctx.arc(s * r * 0.34, -r * 0.06, r * 0.13, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * 0.3, -r * 0.12, r * 0.05, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#5a0a3a'; ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.22, r * 0.14 + (e.state === 'beam' ? r * 0.08 : 0), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.ellipse(r * 0.06, r * 0.55, r * 0.11, r * 0.08, 0.3, 0, TAU); ctx.fill();
  if (e.loot > 0) { label(ctx, `+${e.loot}`, 0, r + 16, 15, '#ffd166'); }
  ctx.restore();
}

// ======================================================================================
// Вражеские снаряды (G.foes с f.own = true): крупные, с обводкой, сбиваются выстрелами
// ======================================================================================
// kind: tear | candy | choco | letter | seed2
export function spawnFoe(G, kind, x, y, o = {}) {
  const base = { tear: { r: 13, why: 'Слеза Королевы' }, candy: { r: 15, why: 'Конфета Королевы' }, choco: { r: 15, why: 'Шоколадка Королевы' }, letter: { r: 16, why: 'Буква Руды' }, seed2: { r: 11, why: 'Семечко' } }[kind];
  const f = { own: true, kind, x, y, vx: 0, vy: 0, t: 0, hp: 1, life: 9, ...base, ...o };
  G.foes.push(f); return f;
}

export function updateOwnFoes(G, dt) {
  const p = G.p;
  for (const f of G.foes) {
    if (!f.own || f.dead) continue;
    f.t += dt;
    switch (f.kind) {
      case 'tear': f.vy = Math.min(f.vy + (f.g ?? 240) * dt, 380); break;
      case 'seed2': f.vy += 140 * dt; break;
      case 'candy': case 'choco': {
        // вылет дугой, затем медленное самонаведение — можно отбежать или сбить
        if (f.t > 0.45) {
          const want = Math.atan2(p.y - 45 - f.y, p.x - f.x), cur = Math.atan2(f.vy, f.vx);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const a = cur + clamp(d, -1.5 * dt, 1.5 * dt), sp = Math.min(150, Math.hypot(f.vx, f.vy) * (1 + dt * 0.25) + 4 * dt);
          f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp;
        } else { f.vx *= 1 - dt * 1.5; f.vy += 160 * dt; }
        f.rot = (f.rot || 0) + dt * 3;
        break;
      }
      case 'letter': {
        // строй: каждая буква держит своё смещение ox от Поппи, дрейф ограничен — слово остаётся читаемым
        const tx = clamp(p.x + (f.ox || 0), 30, view.W - 30), d = tx - f.x;
        f.vx = clamp(d * 1.5, -(f.drift || 42), f.drift || 42);
        f.vy += ((f.spd || 110) - f.vy) * Math.min(1, dt * 2);
        f.rot = Math.sin(f.t * 3 + (f.ox || 0)) * 0.12;
        break;
      }
    }
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.t > f.life) { f.dead = true; G.parts.burst(f.x, f.y, 5, { color: '#fff', speed: [30, 90], life: [0.2, 0.4], size: [1.5, 3] }); continue; }
    if (f.y > GROUND - f.r * 0.4) {
      f.dead = true;
      const col = f.kind === 'tear' ? ['#9fe6ff', '#fff'] : f.kind === 'letter' ? ['#ffd0dc', '#ff5a7a'] : f.kind === 'seed2' ? ['#ffe08a', '#fff'] : ['#ff9ad0', '#8a4a2a'];
      G.parts.burst(f.x, GROUND - 3, 6, { color: col, speed: [50, 150], g: 500, angle: -Math.PI / 2, spread: 1.1, life: [0.2, 0.4], size: [2, 4], shape: 'drop' });
      continue;
    }
    if (f.x < -40 || f.x > view.W + 40 || f.y < -200) { f.dead = true; continue; }
    if (!p.dead && Math.abs(f.x - p.x) < 15 + f.r * 0.8 && f.y + f.r * 0.6 > p.y - 90 && f.y - f.r * 0.6 < p.y) { f.dead = true; G.hurtPlayer(f.why); }
  }
}

export function drawOwnFoes(G, ctx) {
  for (const f of G.foes) {
    if (!f.own) continue;
    const fade = f.life - f.t < 0.6 ? clamp((f.life - f.t) / 0.6, 0, 1) : 1;
    ctx.save(); ctx.globalAlpha = fade;
    switch (f.kind) {
      case 'tear': drawBigTear(ctx, f.x, f.y, f.r, Math.atan2(f.vy, f.vx) - Math.PI / 2); break;
      case 'seed2': {
        glow(ctx, f.x, f.y, f.r * 2.6, 'rgba(255,220,110,0.6)');
        ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy, f.vx));
        ctx.beginPath(); ctx.ellipse(0, 0, f.r * 1.2, f.r * 0.8, 0, 0, TAU); outlined(ctx, '#fff1a8', '#3a1a06', 3);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(2, -3, 4, 2, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'candy': case 'choco': {
        const pulse = 1 + Math.sin(f.t * 8) * 0.08;
        glow(ctx, f.x, f.y, f.r * 2.8, 'rgba(255,225,140,0.6)');
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,240,190,${0.6 + 0.3 * Math.sin(f.t * 8)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.55 * pulse, 0, TAU); ctx.stroke();
        ctx.translate(f.x, f.y); ctx.rotate(f.rot || 0);
        if (f.kind === 'candy') {
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 9, 0); ctx.lineTo(s * 22, -10); ctx.quadraticCurveTo(s * 18, 0, s * 22, 10); ctx.closePath(); outlined(ctx, '#ff4fb0', INK, 3); }
          ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, TAU); outlined(ctx, '#ff8ccc', INK, 3);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(2, 7); ctx.moveTo(2, -8); ctx.lineTo(8, 2); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.roundRect(-18, -12, 36, 24, 4); outlined(ctx, '#7a4222', INK, 3);
          ctx.strokeStyle = '#4a250f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-6, 12); ctx.moveTo(6, -12); ctx.lineTo(6, 12); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
          ctx.beginPath(); ctx.rect(-18, 4, 36, 8); outlined(ctx, '#e0233c', INK, 2.5);
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-11, -7, 4, 2, 0, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'letter': {
        glow(ctx, f.x, f.y, 40, f.col2 || 'rgba(255,80,110,0.55)');
        ctx.translate(f.x, f.y); ctx.rotate(f.rot || 0);
        const s = 38;
        ctx.font = `900 ${s}px Nunito, "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#2a0408'; ctx.strokeText(f.ch, 0, 2);
        ctx.lineWidth = 4; ctx.strokeStyle = f.rim || '#e0233c'; ctx.strokeText(f.ch, 0, 2);
        ctx.fillStyle = f.col || '#fff3f6'; ctx.fillText(f.ch, 0, 2);
        break;
      }
    }
    ctx.restore();
  }
}

// ======================================================================================
// Опасности боссов (общие для Королевы и Руды): удары-колонны, волны по полу, дождь с просветами
// ======================================================================================
// колонна: kind 'pillar' (огонь) | 'tentacle' (щупальце Мисс Спазм); t < warn — подсказка
export function addSlam(b, kind, x, delay = 0, warn = 1.0) { b.slams.push({ kind, x: clamp(x, 60, view.W - 60), t: -delay, warn, dur: kind === 'tentacle' ? 0.5 : 0.4, w: kind === 'tentacle' ? 64 : 58 }); }
export function addWaves(b, x, speed = 300, color = 'fire') { for (const s of [-1, 1]) b.waves.push({ x: x + s * 10, v: s * speed, t: 0, color }); }
export function startRain(b, o = {}) {
  const gapW = o.gapW ?? 130, n = o.gaps ?? 2, gaps = [];
  // просветы не у самого края и не друг на друге
  for (let tries = 0; gaps.length < n && tries < 40; tries++) {
    const c = rand(110 + gapW / 2, view.W - 110 - gapW / 2);
    if (gaps.every(g => Math.abs(g.c - c) > gapW + 90)) gaps.push({ c, x0: c - gapW / 2, x1: c + gapW / 2 });
  }
  const cols = [], step = o.step ?? 46;
  for (let x = 58; x <= view.W - 58; x += step) if (gaps.every(g => x < g.x0 - 14 || x > g.x1 + 14)) cols.push({ x, times: Array.from({ length: o.per ?? 2 }, () => rand(0, o.dur ?? 2.3)).sort((a, b) => a - b) });
  b.rain = { t: 0, warn: o.warn ?? 1.1, dur: o.dur ?? 2.3, gaps, cols, light: !!o.light };
}

export function updateHazards(G, b, dt) {
  const p = G.p;
  for (const s of b.slams) {
    s.t += dt; if (s.t < 0) continue;
    const k = s.t - s.warn;
    if (k >= 0 && !s.struck) {
      s.struck = true; G.shake(0.3); sfx(s.kind === 'pillar' ? 'boom' : 'thud', { pitch: s.kind === 'pillar' ? 1.3 : 0.6, vol: 0.55 });
      G.parts.burst(s.x, GROUND - 4, 14, { color: s.kind === 'pillar' ? ['#ffd166', '#ff7a1a', '#e0233c', '#fff'] : ['#c85aa0', '#ffc2e6'], speed: [80, 280], g: 600, angle: -Math.PI / 2, spread: 1.2, life: [0.3, 0.6], size: [2, 5] });
    }
    if (k >= 0 && k < s.dur && !p.dead && Math.abs(p.x - s.x) < s.w / 2 + 8) G.hurtPlayer(s.kind === 'pillar' ? 'Огненный столб Королевы' : 'Щупальце (буря Руды)');
    if (k > s.dur + 0.3) s.done = true;
  }
  b.slams = b.slams.filter(s => !s.done);
  for (const w of b.waves) {
    w.t += dt; w.x += w.v * dt;
    if (w.x < ARENA.left - 30 || w.x > ARENA.right + 30) { w.done = true; continue; }
    if (Math.random() < dt * 30) G.parts.spawn({ x: w.x, y: GROUND - 10, vx: -w.v * 0.2 + rand(-40, 40), vy: -rand(60, 160), g: 500, life: 0.4, size: rand(2, 4), color: w.color === 'fire' ? (Math.random() < 0.5 ? '#ffd166' : '#ff5a2a') : '#ffc2e6' });
    if (!p.dead && !G.stats.boots && p.y > GROUND - 34 && Math.abs(p.x - w.x) < 22) G.hurtPlayer('Ударная волна');   // сапоги держат волну по полу
  }
  b.waves = b.waves.filter(w => !w.done);
  const R = b.rain;
  if (R) {
    R.t += dt; const k = R.t - R.warn;
    if (k >= 0) for (const c of R.cols) while (c.times.length && c.times[0] <= k) { c.times.shift(); spawnFoe(G, 'tear', c.x + rand(-5, 5), ARENA.sky + 100, { vy: 120, r: R.light ? 12 : 13 }); }
    if (k > R.dur + 0.2) b.rain = null;
  }
}
export const hazardsBusy = b => b.slams.length > 0 || b.waves.length > 0 || !!b.rain;

export function drawHazards(G, ctx, b) {
  const t = G.t;
  // подсказки колонн и сами удары
  for (const s of b.slams) {
    if (s.t < 0) continue;
    if (s.t < s.warn) {
      const k = s.t / s.warn, blink = Math.sin(s.t * (16 + 20 * k)) > 0 ? 1 : 0.55;
      const c = s.kind === 'pillar' ? '255,90,40' : '200,60,160';
      ctx.fillStyle = `rgba(${c},${(0.1 + 0.25 * k) * blink})`; ctx.fillRect(s.x - s.w / 2, 0, s.w, GROUND);
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${c},${0.5 + 0.4 * k})`; ctx.strokeRect(s.x - s.w / 2, -2, s.w, GROUND + 2);
      ctx.fillStyle = `rgba(30,0,10,${0.35 + 0.4 * k})`; ctx.beginPath(); ctx.ellipse(s.x, GROUND + 2, s.w * 0.5 + k * 8, 7, 0, 0, TAU); ctx.fill();
      // кольцо-таймер на полу
      ctx.lineWidth = 4; ctx.strokeStyle = s.kind === 'pillar' ? '#ffb070' : '#ff9ad0'; ctx.beginPath(); ctx.arc(s.x, GROUND - 40, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
      label(ctx, '!', s.x, GROUND - 40, 18, '#fff');
    } else {
      const k = s.t - s.warn;
      if (s.kind === 'pillar') {
        const a = k < s.dur ? 1 : clamp(1 - (k - s.dur) / 0.3, 0, 1), w = s.w * (k < 0.08 ? k / 0.08 : 1);
        ctx.save(); ctx.globalAlpha = a;
        glow(ctx, s.x, GROUND - 120, 150, 'rgba(255,120,40,0.6)');
        const g = ctx.createLinearGradient(s.x - w / 2, 0, s.x + w / 2, 0); g.addColorStop(0, '#e0233c'); g.addColorStop(0.3, '#ff9a3c'); g.addColorStop(0.5, '#fff1c9'); g.addColorStop(0.7, '#ff9a3c'); g.addColorStop(1, '#e0233c');
        ctx.beginPath(); ctx.moveTo(s.x - w * 0.3, 0);
        for (let y = 0; y <= GROUND; y += 24) ctx.lineTo(s.x - w / 2 + Math.sin(y * 0.07 + t * 30) * 5, y);
        for (let y = GROUND; y >= 0; y -= 24) ctx.lineTo(s.x + w / 2 + Math.sin(y * 0.07 + t * 30 + 1) * 5, y);
        ctx.closePath(); outlined(ctx, g, '#3a0606', 3);
        ctx.restore();
      } else {
        const y = k < 0.1 ? (k / 0.1) * GROUND : k < s.dur ? GROUND : GROUND * clamp(1 - (k - s.dur) / 0.3, 0, 1);
        if (y > 0) drawTentacle(ctx, s.x, 0, y, 58, 1, t);
      }
    }
  }
  // волны по полу: горящий гребень с обводкой
  for (const w of b.waves) {
    const fire = w.color === 'fire', dir = Math.sign(w.v);
    glow(ctx, w.x, GROUND - 16, 46, fire ? 'rgba(255,110,40,0.7)' : 'rgba(255,120,200,0.6)');
    ctx.save(); ctx.translate(w.x, GROUND); ctx.scale(dir, 1);
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-18, -8, -6, -30 - Math.sin(t * 30) * 3); ctx.quadraticCurveTo(4, -40, 12, -26); ctx.quadraticCurveTo(20, -12, 28, 0); ctx.closePath();
    outlined(ctx, fire ? '#ff6a2a' : '#ff6fb5', '#2a0404', 3);
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-6, -8, 2, -22); ctx.quadraticCurveTo(10, -14, 16, 0); ctx.closePath(); ctx.fillStyle = fire ? '#ffd166' : '#ffd6ec'; ctx.fill();
    ctx.restore();
  }
  // дождь: подсказка — тучи над зонами дождя и светлые «сухие» коридоры
  const R = b.rain;
  if (R) {
    const RT = 96 + ARENA.sky;   // верх тучи (на высоком виде опущен)
    const k = clamp(R.t / R.warn, 0, 1), on = R.t >= R.warn, a = on ? clamp(1 - (R.t - R.warn - R.dur) / 0.4, 0, 1) : k;
    ctx.save(); ctx.globalAlpha = a;
    // зоны дождя
    let x = 40; const zones = [];
    for (const g of [...R.gaps].sort((p, q) => p.x0 - q.x0)) { zones.push([x, g.x0]); x = g.x1; } zones.push([x, view.W - 40]);
    for (const [x0, x1] of zones) {
      ctx.fillStyle = `rgba(70,140,235,${on ? 0.12 : 0.08 + 0.14 * k * (Math.sin(R.t * 18) > 0 ? 1 : 0.6)})`; ctx.fillRect(x0, RT, x1 - x0, GROUND - RT);
      ctx.fillStyle = '#34507e'; ctx.strokeStyle = '#0e1a33'; ctx.lineWidth = 3;
      for (let cx = x0 + 22; cx < x1 - 10; cx += 44) { ctx.beginPath(); ctx.arc(cx, RT + Math.sin(cx + t * 2) * 3, 20, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#34507e'; ctx.fillRect(x0 + 4, RT - 4, Math.max(0, x1 - x0 - 8), 14);
    }
    // просветы
    for (const g of R.gaps) {
      ctx.fillStyle = 'rgba(255,250,220,0.10)'; ctx.fillRect(g.x0, RT, g.x1 - g.x0, GROUND - RT);
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,250,220,0.65)';
      ctx.beginPath(); ctx.moveTo(g.x0, RT); ctx.lineTo(g.x0, GROUND); ctx.moveTo(g.x1, RT); ctx.lineTo(g.x1, GROUND); ctx.stroke(); ctx.setLineDash([]);
      // стрелки «сюда»
      for (let i = 0; i < 2; i++) {
        const yy = GROUND - 70 - i * 26 + ((t * 40) % 26);
        ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(g.c - 12, yy - 8); ctx.lineTo(g.c, yy + 4); ctx.lineTo(g.c + 12, yy - 8); ctx.stroke();
      }
      if (!on) label(ctx, 'сюда', g.c, GROUND - 130, 16, '#fff6d0', '#1a2a44');
    }
    ctx.restore();
  }
}

// ======================================================================================
// Босс: Королева ПМС
// ======================================================================================
const MASKS = [
  { id: 'anger', name: 'Гнев', base: '#e0233c', hi: '#ff8a3c', rim: '#4a0408', aura: 'rgba(255,70,40,0.55)', gown: ['#7a0d18', '#e0233c'] },
  { id: 'tears', name: 'Слёзы', base: '#3f8fe6', hi: '#9fd8ff', rim: '#0b2a5a', aura: 'rgba(80,160,255,0.55)', gown: ['#14306a', '#3f8fe6'] },
  { id: 'crave', name: 'Тяга', base: '#ff5aa8', hi: '#ffc2e0', rim: '#5a0a3a', aura: 'rgba(255,100,190,0.55)', gown: ['#6a1050', '#ff5aa8'] },
];
const Q_ATT = { 1: ['slam', 'fire', 'slam2', 'fire'], 2: ['rain', 'fan', 'slam', 'rain', 'fan'], 3: ['sweets', 'rain', 'slam', 'sweets', 'summon'] };

export function makeQueen() {
  return {
    id: 'queen', name: 'Королева ПМС', intro: 'Три маски — три настроения', x: view.W / 2, y: -220, r: 66, s: 1,
    hp: 12000, maxHp: 12000, phase: 1, t: 0, st: 0, hitT: 0, invuln: 0, state: 'enter', last: null,
    eyeT: 0, dark: 0, slams: [], waves: [], rain: null, maskT: 0, arm: 0, box: 0, cast: 0,
    lines: { 2: 'Не смотри на меня! Я… я не плачу!', 3: 'Хочу сладкого. СЕЙЧАС ЖЕ!' },
    upd: updateQueen, drw: drawQueen,
  };
}

function updateQueen(G, b, dt) {
  b.t += dt; b.st += dt; b.hitT = Math.max(0, b.hitT - dt); b.invuln = Math.max(0, b.invuln - dt); b.maskT = Math.max(0, b.maskT - dt);
  updateHazards(G, b, dt);
  const ph = b.hp < b.maxHp * 0.33 ? 3 : b.hp < b.maxHp * 0.66 ? 2 : 1;
  if (ph > b.phase) {
    // маска трескается и падает, прилетает следующая
    const old = MASKS[b.phase - 1];
    b.phase = ph; b.maskT = 1.2; b.invuln = 1.2; b.state = 'idle'; b.st = 0; b.arm = 0; b.box = 0; b.cast = 0;
    G.freeze(0.12); G.shake(0.6); sfx('boom', { pitch: 1.6, vol: 0.5 }); sfx('bossHit', { pitch: 0.6 });
    G.parts.burst(b.x, b.y - 30, 26, { color: [old.base, old.hi, '#fff'], speed: [120, 340], g: 600, life: [0.5, 1], shape: 'rect', size: [3, 7] });
    G.floaters.add(view.W / 2, view.H * 0.55, `Маска «${MASKS[ph - 1].name}»!`, { size: 30, color: MASKS[ph - 1].hi, life: 1.6, vy: -30 });
    b.say = { s: b.lines[ph], t: 0 };
  }
  if (b.say) { b.say.t += dt; if (b.say.t > 2.4) b.say = null; }
  if (b.state === 'enter') {
    b.y += (ARENA.sky + 170 - b.y) * Math.min(1, dt * 2.4);
    if (b.st > 1.6) { b.state = 'idle'; b.st = 0; b.say = { s: 'На колени перед Королевой!', t: 0 }; }
    return;
  }
  // парит над Поппи, но не прилипает
  const tx = clamp(G.p.x + Math.sin(b.t * 0.6) * 190, 170, view.W - 170);
  const still = b.state === 'slam' || b.state === 'slam2';
  b.x += (tx - b.x) * Math.min(1, dt * (still ? 0.15 : 0.7));
  b.y += (ARENA.sky + (still && b.st < 1 ? 150 : 170) + Math.sin(b.t * 1.5) * 8 - b.y) * Math.min(1, dt * 3);
  b.arm += ((b.cast > 0 ? 1 : 0) - b.arm) * Math.min(1, dt * 10);
  b.box += ((b.state === 'sweets' && b.st < 1.0 ? 1 : 0) - b.box) * Math.min(1, dt * 8);
  b.eyeT = Math.max(0, b.eyeT - dt);

  if (b.state === 'idle') {
    const wait = [0, 1.25, 1.0, 0.85][b.phase];
    if (b.st > wait && !(b.rain && b.phase < 3)) {
      const L = Q_ATT[b.phase]; let a; do { a = pick(L); } while (a === b.last && L.length > 1);
      b.last = a; b.state = a; b.st = 0; b.done = 0;
      if (a === 'slam' || a === 'slam2') { b.cast = 1; b.slamX = b.x; sfx('zap', { pitch: 0.35 }); if (!b.waveHint) { b.waveHint = true; G.say('Волна по полу — перепрыгни!', '#fff'); } }
      if (a === 'fire') {
        const n = b.phase === 1 ? 3 : 2, xs = [G.p.x];
        const sp = Math.min(150, (view.W - 160) / n);   // на узкой арене (портрет) столбы ближе друг к другу; число попыток ограничено
        for (let tries = 0; xs.length < n && tries < 60; tries++) { const x = rand(80, view.W - 80); if (xs.every(q => Math.abs(q - x) > sp)) xs.push(x); }
        while (xs.length < n) xs.push(rand(80, view.W - 80));
        xs.forEach((x, i) => addSlam(b, 'pillar', x, i * 0.28, 1.0)); b.cast = 1; sfx('zap', { pitch: 0.5 });
      }
      if (a === 'rain') { startRain(b, { gaps: 2, gapW: b.phase === 2 ? 140 : 130, dur: 2.3, per: 2 }); b.say = b.say || { s: 'Все меня бросили!..', t: 0 }; sfx('whoosh', { pitch: 0.4 }); }
      if (a === 'fan') { b.eyeT = 1.0; sfx('select', { pitch: 0.5, vol: 0.4 }); }
      if (a === 'sweets') { sfx('select', { pitch: 1.4, vol: 0.4 }); }
    }
  } else if (b.state === 'slam' || b.state === 'slam2') {
    const hits = b.state === 'slam2' ? [1.0, 1.8] : [1.0];
    if (b.done < hits.length && b.st >= hits[b.done]) {
      b.done++; addWaves(b, b.slamX, b.phase === 1 ? 300 : 280); G.shake(0.45); sfx('boom', { pitch: 0.7 }); sfx('thud', { pitch: 0.5 });
      G.parts.burst(b.slamX, GROUND - 4, 18, { color: ['#ffd166', '#ff5a2a', '#fff'], speed: [100, 320], g: 700, angle: -Math.PI / 2, spread: 1.4, life: [0.3, 0.6], size: [2, 5] });
      b.strikeT = 0.25;
      if (b.done < hits.length) b.cast = 1; else b.cast = 0;
    }
    if (b.st > hits[hits.length - 1] + 0.9) { b.state = 'idle'; b.st = 0; b.cast = 0; }
  } else if (b.state === 'fire') {
    if (b.st > 0.4) b.cast = 0;
    if (!b.slams.length && b.st > 1.2) { b.state = 'idle'; b.st = 0; }
  } else if (b.state === 'rain') {
    if (b.st > 1.4) { b.state = 'idle'; b.st = 0; }      // дождь идёт сам, королева может параллельно бить (фаза 3)
  } else if (b.state === 'fan') {
    if (b.st >= 1.0 && !b.done) {
      b.done = 1; const n = b.phase === 2 ? 5 : 4, base = Math.atan2(G.p.y - 50 - (b.y - 26), G.p.x - b.x);
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.24; spawnFoe(G, 'tear', b.x, b.y - 20, { vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, g: 70 }); }
      sfx('pickup', { pitch: 0.5, vol: 0.5 });
    }
    if (b.st > 1.7) { b.state = 'idle'; b.st = 0; }
  } else if (b.state === 'sweets') {
    // коробка конфет трясётся 0,9 с, потом сладости вылетают веером и медленно наводятся
    if (b.st >= 0.9 && b.done < 5) {
      const i = b.done; if (b.st >= 0.9 + i * 0.12) {
        b.done++; const a = Math.PI * (0.12 + 0.19 * i);      // веер вниз-в-стороны, потом самонаведение
        spawnFoe(G, i % 2 ? 'choco' : 'candy', b.x - 50, b.y + 30, { vx: Math.cos(a) * 190, vy: Math.sin(a) * 120, life: 7.5 });
        sfx('pop', { pitch: 1.2 + i * 0.1, vol: 0.4 });
      }
    }
    if (b.st > 2.0) { b.state = 'idle'; b.st = 0; }
  } else if (b.state === 'summon') {
    if (!b.done) { b.done = 1; G.enemies.push(makeEnemy('craving', clamp(b.x - 160, 80, view.W - 80), -30, G.waveIndex)); G.enemies.push(makeEnemy('craving', clamp(b.x + 160, 80, view.W - 80), -30, G.waveIndex)); for (let i = 0; i < 3; i++) G.enemies.push(makeEnemy('droplet', b.x + rand(-80, 80), b.y + 60, G.waveIndex)); sfx('pop', { pitch: 0.6 }); b.say = { s: 'Принесите мне сладкого!', t: 0 }; }
    if (b.st > 1.3) { b.state = 'idle'; b.st = 0; }
  }
  b.strikeT = Math.max(0, (b.strikeT || 0) - dt);
}

// --- рисование маски: kind 0 Гнев, 1 Слёзы, 2 Тяга; (0,0) — центр лица
function maskPath(ctx) {
  ctx.beginPath(); ctx.moveTo(0, -32);
  ctx.bezierCurveTo(22, -32, 33, -18, 31, 0); ctx.bezierCurveTo(30, 16, 18, 30, 0, 33);
  ctx.bezierCurveTo(-18, 30, -30, 16, -31, 0); ctx.bezierCurveTo(-33, -18, -22, -32, 0, -32); ctx.closePath();
}
function drawMask(ctx, kind, t, o = {}) {
  const M = MASKS[kind];
  if (kind === 0) { // язычки пламени по краю
    for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.15 + i * 0.175), fx = Math.cos(a) * 30, fy = Math.sin(a) * 30, h = 14 + Math.sin(t * 14 + i * 2) * 5;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-7, 2); ctx.quadraticCurveTo(-4, -h * 0.6, 0, -h); ctx.quadraticCurveTo(4, -h * 0.6, 7, 2); ctx.closePath(); outlined(ctx, i % 2 ? '#ffd166' : '#ff7a1a', '#4a0408', 2); ctx.restore(); }
  }
  maskPath(ctx);
  const g = ctx.createLinearGradient(-20, -30, 20, 34); g.addColorStop(0, M.hi); g.addColorStop(0.55, M.base); g.addColorStop(1, M.rim);
  outlined(ctx, g, M.rim, 3.5);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(-14, -18, 7, 4, -0.6, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 0) {
    // злые прорези с жёлтым огнём, брови «V», оскал
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 5, -4); ctx.lineTo(s * 24, -12); ctx.lineTo(s * 21, 0); ctx.closePath(); ctx.fillStyle = '#1a0204'; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,224,102,${0.75 + 0.25 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(s * 15, -5, 3.5, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = '#1a0204'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(s * 4, -12); ctx.lineTo(s * 27, -22); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-15, 14); ctx.lineTo(15, 14); ctx.lineTo(11, 23); ctx.lineTo(-11, 23); ctx.closePath(); ctx.fillStyle = '#1a0204'; ctx.fill();
    ctx.fillStyle = '#fff1e6'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 8, 14); ctx.lineTo(-8 + i * 8, 19); ctx.lineTo(-4 + i * 8, 14); ctx.fill(); }
  } else if (kind === 1) {
    // грустные опущенные прорези, нарисованные дорожки слёз, дрожащий рот
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 6, -8); ctx.quadraticCurveTo(s * 16, -15, s * 25, -3); ctx.quadraticCurveTo(s * 15, -1, s * 6, -8); ctx.fillStyle = '#081a38'; ctx.fill();
      ctx.strokeStyle = '#081a38'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(s * 6, -16); ctx.lineTo(s * 22, -24); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,245,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s * 15, 0); ctx.quadraticCurveTo(s * 18, 12, s * 14, 24); ctx.stroke();
    }
    ctx.strokeStyle = '#081a38'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-11, 21);
    for (let i = 1; i <= 6; i++) ctx.lineTo(-11 + i * 22 / 6, 17 - (i % 2 ? 1 : -1) * 1.6 * Math.sin(t * 25) - Math.sin(i / 6 * Math.PI) * 4);
    ctx.stroke();
  } else {
    // глаза-сердечки, открытый рот с язычком и слюнкой, посыпка на щеках
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 14, -6); const k = 1 + 0.12 * Math.sin(t * 9); ctx.scale(k, k);
      heart(ctx, 0, 0, 8); outlined(ctx, '#8a0a4a', '#3a0420', 1.5);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -3, 2, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 18, 9, 7 + Math.sin(t * 6) * 1.5, 0, 0, TAU); ctx.fillStyle = '#3a0420'; ctx.fill();
    ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.ellipse(2, 22, 5, 3.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,255,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(7, 22); ctx.lineTo(8, 28 + Math.sin(t * 3) * 3); ctx.stroke();
    const spr = ['#ffd166', '#5ee6c8', '#fff', '#8b5cf6'];
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate((i % 2 ? 1 : -1) * (19 + (i % 3) * 3), 6 + (i % 3) * 5); ctx.rotate(i); ctx.fillStyle = spr[i % 4]; ctx.fillRect(-2.5, -1, 5, 2); ctx.restore(); }
  }
}

function drawQueen(G, ctx, b) {
  drawHazards(G, ctx, b);
  const t = b.t, kind = b.phase - 1, M = MASKS[kind], hit = b.hitT > 0 && Math.sin(t * 40) > 0;   // мигание, а не сплошной белый под лучом чая
  const x = b.x, y = b.y;
  ctx.save();
  if (b.invuln > 0 && Math.sin(t * 40) > 0) ctx.globalAlpha = 0.75;
  // аура настроения
  glow(ctx, x, y + 20, 180, M.aura, 0.8 + 0.2 * Math.sin(t * 3));
  ctx.translate(x, y); ctx.scale(0.88, 0.88);
  // платье: расходится в дымку с волнистым подолом
  const hem = 150;
  ctx.beginPath(); ctx.moveTo(-30, 18);
  ctx.bezierCurveTo(-60, 60, -90, 110, -96, hem);
  for (let i = 0; i <= 8; i++) { const hx = -96 + i * 24, hy = hem + (i % 2 ? 14 : -2) + Math.sin(t * 4 + i) * 6; ctx.lineTo(hx, hy); }
  ctx.bezierCurveTo(90, 110, 60, 60, 30, 18); ctx.closePath();
  const gg = ctx.createLinearGradient(0, 10, 0, hem + 10); gg.addColorStop(0, M.gown[0]); gg.addColorStop(0.6, M.gown[1]); gg.addColorStop(1, 'rgba(20,6,20,0.3)');
  outlined(ctx, hit ? '#ffffff' : gg, INK, 3.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; for (const fx of [-50, -18, 18, 50]) { ctx.beginPath(); ctx.moveTo(fx * 0.4, 40); ctx.quadraticCurveTo(fx * 0.9, 90, fx * 1.4, hem - 4); ctx.stroke(); }
  // кружевной воротник-веер за головой
  ctx.save(); ctx.translate(0, -18);
  for (let i = 0; i < 11; i++) { const a = Math.PI * (1.08 + i * 0.084); ctx.beginPath(); ctx.ellipse(Math.cos(a) * 44, Math.sin(a) * 34 + 20, 12, 8, a, 0, TAU); outlined(ctx, '#f3e6ff', '#3a2448', 2); }
  ctx.restore();
  // корсаж с золотой отделкой и брошью-сердцем цвета настроения
  ctx.beginPath(); ctx.moveTo(-32, 12); ctx.lineTo(32, 12); ctx.lineTo(20, 64); ctx.lineTo(-20, 64); ctx.closePath(); outlined(ctx, hit ? '#fff' : '#2a0a2a', INK, 3);
  ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(0, 46); ctx.lineTo(26, 16); ctx.stroke();
  heart(ctx, 0, 30, 8); outlined(ctx, M.base, '#ffc53d', 2.5);
  // руки: правая со скипетром (поднимается в подсказке удара), левая — с коробкой конфет в фазе Тяги
  const raise = b.arm, strike = b.strikeT > 0 ? 1 : 0;
  ctx.lineCap = 'round';
  // правая рука
  const sx = 34, sy = 18, hx = 64 - raise * 10 + strike * 6, hy = 40 - raise * 62 + strike * 60;
  ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 22, sy + 10 - raise * 30, hx, hy); ctx.stroke();
  ctx.strokeStyle = M.gown[0]; ctx.lineWidth = 10; ctx.stroke();
  // скипетр
  const ang = -Math.PI / 2 + 0.5 - raise * 0.5 + strike * 0.9;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang + Math.PI / 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -80); ctx.stroke();
  ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 5; ctx.stroke();
  if (raise > 0.3) glow(ctx, 0, -92, 60 * raise, M.aura, 1);
  heart(ctx, 0, -90, 14); outlined(ctx, M.base, INK, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(-5, -95, 3, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e9d6f0'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); ctx.fill(); ctx.stroke();
  // левая рука
  const lx = -62 + b.box * 4, ly = 44 - b.box * 10;
  ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-34, 18); ctx.quadraticCurveTo(-58, 30, lx, ly); ctx.stroke();
  ctx.strokeStyle = M.gown[0]; ctx.lineWidth = 10; ctx.stroke();
  if (b.box > 0.05) {
    // коробка конфет-сердце: трясётся перед залпом
    ctx.save(); ctx.translate(lx, ly - 6); ctx.translate(Math.sin(t * 50) * 3 * b.box, 0); ctx.scale(b.box, b.box);
    heart(ctx, 0, 0, 24); outlined(ctx, '#ff4fb0', INK, 3);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(14, 10); ctx.stroke();
    ctx.restore();
    label(ctx, '!', lx, ly - 46, 24, '#ffc2e0');
  }
  ctx.fillStyle = '#e9d6f0'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(lx, ly, 7, 0, TAU); ctx.fill(); ctx.stroke();
  // голова: причёска-кокон, корона, маска
  const hy0 = -30;
  ctx.fillStyle = '#3a1238'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, hy0 - 4, 38, Math.PI * 0.85, Math.PI * 2.15); ctx.fill(); ctx.stroke();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 34, hy0 + 14, 13, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, hy0 + 4, 30, 34, 0, 0, TAU); ctx.fillStyle = '#e9d6f0'; ctx.fill(); ctx.stroke();
  // корона
  ctx.save(); ctx.translate(0, hy0 - 40);
  ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(-34, -16); ctx.lineTo(-16, -2); ctx.lineTo(0, -26); ctx.lineTo(16, -2); ctx.lineTo(34, -16); ctx.lineTo(30, 8); ctx.closePath();
  outlined(ctx, '#ffc53d', '#4a2a06', 3);
  MASKS.forEach((m, i) => { const gx = (i - 1) * 22, gy = i === 1 ? -6 : 0; if (i === kind) glow(ctx, gx, gy, 18, m.aura, 1); ctx.beginPath(); ctx.arc(gx, gy, 5.5, 0, TAU); outlined(ctx, i < kind ? '#555' : m.base, '#4a2a06', 2); });
  ctx.restore();
  // маска на лице (при смене — новая прилетает сверху и крутится)
  ctx.save(); ctx.translate(0, hy0 + 4);
  if (b.maskT > 0) { const k = b.maskT / 1.2; ctx.translate(0, -k * 120); ctx.rotate(k * 6); ctx.scale(1 + k * 0.4, 1 + k * 0.4); }
  if (b.eyeT > 0) glow(ctx, 0, -4, 50, 'rgba(160,220,255,0.9)', b.eyeT);
  drawMask(ctx, kind, t);
  if (hit) { ctx.globalAlpha = 0.5; maskPath(ctx); ctx.fillStyle = '#fff'; ctx.fill(); }
  ctx.restore();
  // ещё не надетые маски парят по бокам от головы — видно, что впереди ещё фазы
  for (let i = kind + 1; i < 3; i++) {
    const sd = i === 1 ? -1 : 1, mx = sd * 116, my = hy0 - 34 + Math.sin(t * 2 + i) * 6;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(sd * 0.2 + Math.sin(t * 1.5 + i) * 0.1); ctx.scale(0.46, 0.46); drawMask(ctx, i, t); ctx.restore();
  }
  ctx.restore();
  // реплика королевы
  if (b.say) {
    const a = b.say.t < 0.15 ? b.say.t / 0.15 : b.say.t > 2.1 ? (2.4 - b.say.t) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    // сбоку от королевы, где больше места (не налезает на полосу HP)
    ctx.font = '900 17px Nunito, sans-serif'; const w = ctx.measureText(b.say.s).width + 28, side = x < view.W / 2 ? 1 : -1;
    const bx = clamp(x + side * (w / 2 + 96), w / 2 + 10, view.W - 10 - w / 2), by = y - 50;
    ctx.fillStyle = '#fff4fa'; ctx.beginPath(); ctx.moveTo(bx - side * (w / 2 - 6), by + 6); ctx.lineTo(x + side * 60, by + 22); ctx.lineTo(bx - side * (w / 2 - 6), by - 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 17, w, 34, 14); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = M.rim; ctx.stroke();
    ctx.fillStyle = M.rim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.say.s, bx, by + 1);
    ctx.restore();
  }
}

// ======================================================================================
// Эмбиент готики: капли с потолка и мерцание ламп (поверх векторного фона)
// ======================================================================================
const drips = Array.from({ length: 10 }, () => ({ x: 60 + Math.random() * 840, y: Math.random() * 480, v: 160 + Math.random() * 120 }));   // координаты фона 960×540: рисуется в пространстве фона (play.js bgSpace)
let lastAmbT = 0;
export function drawGothicAmbient(ctx, t) {
  const dt = Math.min(0.05, Math.max(0, t - lastAmbT)); lastAmbT = t;
  for (const [lx, ly] of [[180, 198], [230, 262], [845, 230]]) glow(ctx, lx, ly, 70, 'rgba(255,190,140,0.35)', 0.6 + 0.4 * Math.sin(t * 9 + lx) * Math.sin(t * 2.3 + ly));
  ctx.fillStyle = 'rgba(170,230,255,0.55)';
  for (const d of drips) {
    d.y += d.v * dt; if (d.y > 480) { d.y = 30 + Math.random() * 40; d.x = 60 + Math.random() * 840; }
    ctx.fillRect(d.x, d.y, 1.6, 7);
  }
  ctx.strokeStyle = 'rgba(200,240,255,0.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const xx = ((t * 30 + i * 210) % 1000) - 20; ctx.beginPath(); ctx.moveTo(xx, 492 + i * 7); ctx.lineTo(xx + 60, 492 + i * 7); ctx.stroke(); }
}

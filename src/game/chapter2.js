// Глава 2 «Улица»: враги Капля-плакса и Спазмик, вражеские снаряды (слёзы, семечки — сбиваются выстрелами),
// босс «Великое Вздутие» — злой томат оригинала (sprite35 → src/art/vec/bloat.js): прыгает как шар в Pang,
// раздувается до «БАБАХ», от урона делится 1 → 2 → 4.
import { rand, clamp, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { drawDrop } from '../art/sprites.js';
import { drawVec } from '../art/vec.js';
import { GROUND, ARENA } from './player.js';

let BLOAT = null;
import('../art/vec/bloat.js').then(m => { BLOAT = m.default; });

export const BLOAT_SIZES = [{ r: 80, hp: 3400, bounce: 300, vx: 85 }, { r: 55, hp: 1450, bounce: 250, vx: 110 }, { r: 37, hp: 600, bounce: 200, vx: 135 }];
const potential = s => s >= BLOAT_SIZES.length ? 0 : BLOAT_SIZES[s].hp + 2 * potential(s + 1);
export const BLOAT_TOTAL = potential(0);

export function initExtra(e, o) {
  if (e.type === 'crier') { e.hoverY = rand(80, 150); e.state = 'enter'; e.vy = 120; e.shootT = rand(1, 2); e.life = 0; e.dir = Math.random() < 0.5 ? -1 : 1; }
  if (e.type === 'spazm') { e.y = GROUND - e.r; e.dir = e.x < 480 ? 1 : -1; e.vx = 170 * e.dir; e.vy = 0; e.hopT = rand(0.4, 0.9); e.life = 0; }
  if (e.type === 'bloat') {
    const S = BLOAT_SIZES[e.size = o.size ?? 0];
    e.r0 = S.r; e.r = S.r; e.hp = e.maxHp = S.hp; e.bounceH = S.bounce; e.vx = o.vx ?? S.vx * (Math.random() < 0.5 ? -1 : 1); e.vy = o.vy ?? 0;
    e.count = 0; e.floor = 0; e.xp = 12 - e.size * 3; e.infl = 0; e.spitT = rand(2, 4);
  }
}

export function updateExtra(G, e, dt, k) {
  switch (e.type) {
    case 'crier': {
      e.life += dt;
      if (e.state === 'enter') { e.y += e.vy * k * dt; if (e.y >= e.hoverY) { e.state = 'hover'; e.vy = 0; } }
      else if (e.state === 'hover') {
        e.x += e.dir * 40 * k * dt; if (e.x < 80 || e.x > 880) e.dir *= -1;
        e.shootT -= dt * k;
        if (e.shootT <= 0) { e.shootT = 2.2; G.foes.push({ kind: 'tear', x: e.x + rand(-6, 6), y: e.y + e.r, vx: 0, vy: 120, r: 6, hp: 1 }); sfx('pickup', { pitch: 0.6, vol: 0.4 }); }
        if (e.life > 9) e.state = 'sink';
      } else { e.y += 45 * k * dt; if (e.y + e.r >= GROUND) G.floorHit(e); }
      break;
    }
    case 'spazm': {
      e.life += dt; e.vy += 1400 * dt; e.x += e.vx * k * dt; e.y += e.vy * k * dt;
      if (e.y >= GROUND - e.r) { e.y = GROUND - e.r; e.vy = 0; e.hopT -= dt; if (e.hopT <= 0) { e.hopT = rand(0.5, 1); e.vy = -rand(220, 380); } }
      if (e.x < ARENA.left + e.r) { e.dir = 1; e.vx = 170; } if (e.x > ARENA.right - e.r) { e.dir = -1; e.vx = -170; }
      if (e.life > 14) { e.vx = e.dir * 260; if (e.x < -30 || e.x > 990) e.dead = true; }
      break;
    }
    case 'bloat': {
      // раздувается: +2,5% в секунду; на 1,35× — «БАБАХ»: кольцо семечек и сброс размера
      e.infl += dt * 0.025; e.r = e.r0 * (1 + e.infl);
      if (e.infl > 0.35) {
        e.infl = 0; G.shake(0.5); sfx('boom', { pitch: 0.8 }); G.say('Бабах!', '#ff8a5a');
        for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.12 + 0.76 * i / 6); G.foes.push({ kind: 'seed', x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 9, hp: 1 }); }
        if (Math.hypot(G.p.x - e.x, G.p.y - 50 - e.y) < e.r * 1.7) G.hurtPlayer('«Бабах» Вздутия');
      }
      e.vy += 900 * dt * k; e.x += e.vx * k * dt; e.y += e.vy * k * dt;
      if (e.y + e.r >= GROUND) { e.y = GROUND - e.r; e.vy = -Math.sqrt(2 * 900 * e.bounceH); e.squash = 0.14; sfx('thud', { pitch: 0.7 - e.size * 0.1, vol: 0.5 }); G.shake(0.06 * (3 - e.size)); }
      if (e.x - e.r < ARENA.left) { e.x = ARENA.left + e.r; e.vx = Math.abs(e.vx); }
      if (e.x + e.r > ARENA.right) { e.x = ARENA.right - e.r; e.vx = -Math.abs(e.vx); }
      e.squash = Math.max(0, (e.squash || 0) - dt);
      e.spitT -= dt * k;
      if (e.spitT <= 0.7 && !e.aim) { e.aim = { x: G.p.x, y: G.p.y - 60 }; sfx('select', { pitch: 0.5, vol: 0.3 }); }   // прицелился: видно 0,7 с
      if (e.aim) { e.aim.x += (G.p.x - e.aim.x) * Math.min(1, dt * 3); e.aim.y = G.p.y - 60; }
      if (e.spitT <= 0) {
        const n = G.enemies.filter(f => f.type === 'bloat' && !f.dead).length;
        e.spitT = rand(3.2, 4.8) * (e.size === 2 ? 1.6 : 1) * (n > 3 ? 1.4 : 1);
        const dx = e.aim.x - e.x, dy = e.aim.y - e.y, L = Math.hypot(dx, dy) || 1; e.aim = null;
        G.foes.push({ kind: 'seed', x: e.x, y: e.y, vx: dx / L * 190, vy: dy / L * 190, r: 9, hp: 1 }); sfx('pop', { pitch: 0.6, vol: 0.5 });
      }
      break;
    }
  }
}

export function drawExtra(G, ctx, e) {
  const hit = e.hitT > 0 ? 1 : 0;
  switch (e.type) {
    case 'crier': {
      drawDrop(ctx, e.x, e.y, e.r, { t: e.t, hit, fill: '#7f6cff', rim: '#3a2a8a' });
      ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x + s * e.r * 0.42, e.y + e.r * 0.25); ctx.quadraticCurveTo(e.x + s * e.r * 0.5, e.y + e.r * 0.7, e.x + s * e.r * 0.45, e.y + e.r * (0.9 + 0.1 * Math.sin(e.t * 8))); ctx.stroke(); }
      if (e.state === 'hover' && e.shootT < 0.4) { ctx.fillStyle = '#8fe0ff'; ctx.beginPath(); ctx.arc(e.x, e.y + e.r + 4, 3 + (0.4 - e.shootT) * 8, 0, TAU); ctx.fill(); }
      break;
    }
    case 'spazm': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.sin(e.t * 20) * 0.15);
      ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, rr = e.r * (i % 2 ? 0.72 : 1.18 + 0.1 * Math.sin(e.t * 30 + i)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = hit ? '#fff' : '#d81b3c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4a0412'; ctx.stroke();
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(-3, -e.r * 0.7); ctx.lineTo(4, -2); ctx.lineTo(-1, -1); ctx.lineTo(3, e.r * 0.6); ctx.lineTo(-5, 1); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * e.r * 0.38, -e.r * 0.15, e.r * 0.22, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * e.r * 0.38 + e.dir * 1.5, -e.r * 0.12, e.r * 0.1, 0, TAU); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'bloat': {
      const sq = e.squash > 0 ? e.squash / 0.14 : 0;
      if (e.aim) {   // пунктир: куда полетит семечко
        ctx.save(); ctx.setLineDash([8, 8]); ctx.lineDashOffset = -e.t * 60; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,224,102,${0.35 + 0.35 * Math.sin(e.t * 20)})`;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.aim.x, e.aim.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ffe066'; ctx.font = '900 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#3a0a06'; ctx.strokeText('!', e.x, e.y - e.r - 14); ctx.fillText('!', e.x, e.y - e.r - 14); ctx.restore();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, GROUND + 3, e.r * 0.8, 8, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y + e.r * 0.25 * sq); ctx.scale(1 + 0.25 * sq, 1 - 0.25 * sq);
      if (e.infl > 0.25) ctx.translate(Math.sin(e.t * 50) * 2, 0); // дрожит перед «бабах»
      if (e.aim) { const k2 = 1 + 0.08 * Math.sin(e.t * 40); ctx.scale(k2, 1 / k2); }   // надулся перед плевком
      if (BLOAT) { const h = e.r * 2.5, w = BLOAT.w * h / BLOAT.h; drawVec(ctx, BLOAT, -w / 2, -h * 0.62, w, h, 'bloat@' + Math.round(h / 8) * 8); }
      else { ctx.fillStyle = '#d23a22'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); }
      if (hit) { ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.95, 0, TAU); ctx.fill(); }
      ctx.restore(); break;
    }
  }
}

// Вражеские снаряды
export function updateFoes(G, dt) {
  const p = G.p;
  for (const f of G.foes) {
    if (f.kind === 'tear') f.vy += 300 * dt; else f.vy += 120 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.y > GROUND - 2) { f.dead = true; G.parts.burst(f.x, GROUND - 2, 4, { color: f.kind === 'tear' ? '#8fe0ff' : '#ffd36b', speed: [40, 120], g: 400, angle: -Math.PI / 2, spread: 1, life: [0.2, 0.35], size: [1.5, 3] }); continue; }
    if (f.x < -20 || f.x > 980) { f.dead = true; continue; }
    if (!p.dead && Math.abs(f.x - p.x) < 16 + f.r && f.y > p.y - 90 && f.y < p.y) { f.dead = true; G.hurtPlayer(f.kind === 'tear' ? 'Слеза плаксы' : 'Семечко Вздутия'); }
  }
}
export function drawFoes(G, ctx) {
  for (const f of G.foes) {
    if (f.kind === 'tear') { drawDrop(ctx, f.x, f.y, f.r, { fill: '#8fe0ff', rim: '#2b6c8a' }); }
    else {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.atan2(f.vy, f.vx));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,80,0.35)'; ctx.beginPath(); ctx.ellipse(-10, 0, 18, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,120,0.45)'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 10, 6.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(2, -2, 3.5, 1.8, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}

// Враги: поведение и отрисовка. Создаются через makeEnemy, живут в G.enemies.
import { ENEMIES } from './data.js';
import { rand, clamp, TAU } from '../engine/util.js';
import { drawDrop, drawClot, drawFart, PAL } from '../art/sprites.js';
import { drawPopcorn } from '../art/icons.js';
import { GROUND, ARENA } from './player.js';
import { initExtra, updateExtra, drawExtra } from './chapter2.js';
import { initC3, updateC3, drawC3 } from './chapter3.js';

export function makeEnemy(type, x, y, w, o = {}) {
  const d = ENEMIES[type];
  const hpMul = 1 + 0.18 * w + 0.012 * w * w, spdMul = Math.min(1.75, 0.78 + 0.065 * w) * (o.spdK || 1);   // самая первая волна — обучение, капли медленнее
  const e = { type, x, y, vx: 0, vy: d.spd * spdMul, r: d.r, hp: d.hp * hpMul, maxHp: d.hp * hpMul, count: d.count, floor: d.floor, xp: d.xp, dmg: d.dmg, t: 0, seed: rand(10), hitT: 0, slowT: 0, slowK: 0, ...o };
  if (type === 'diver') { e.state = 'enter'; e.hoverY = rand(90, 170); e.vy = 160; e.hoverT = rand(1, 2); }
  if (type === 'jelly') {
    e.size = o.size ?? 0; e.r = d.sizes[e.size]; e.hp = (40 - e.size * 10) * hpMul; e.maxHp = e.hp;
    e.vx = o.vx ?? (Math.random() < 0.5 ? -75 : 75); e.vy = o.vy ?? 60; e.bounceH = d.bounce[e.size];
  }
  if (type === 'fart') { e.vx = 0; e.vy = d.spd * spdMul; e.baseX = x; }
  if (type === 'popcorn') { e.vx = rand(-30, 30); e.rot = rand(TAU); }
  initExtra(e, o); initC3(e, o);
  return e;
}

export function updateEnemy(G, e, dt) {
  e.t += dt; e.hitT = Math.max(0, e.hitT - dt);
  let k = 1;
  if (e.slowT > 0) { e.slowT -= dt; k = 1 - e.slowK; }
  if (G.freezeAll > 0) k *= 0.15;
  switch (e.type) {
    case 'droplet': case 'drop':
      e.vy += (e.type === 'drop' ? 20 : 35) * dt; // слегка разгоняются
      e.x += Math.sin(e.t * 2 + e.seed) * 10 * dt;
      e.y += e.vy * k * dt;
      if (e.y + e.r * 0.9 >= GROUND) G.floorHit(e);
      break;
    case 'diver':
      if (e.state === 'enter') { e.y += e.vy * k * dt; if (e.y >= e.hoverY) { e.state = 'hover'; e.vy = 0; } }
      else if (e.state === 'hover') {
        e.x += Math.sin(e.t * 4) * 40 * dt; e.hoverT -= dt * k;
        if (e.hoverT <= 0) { e.state = 'dive'; const dx = G.p.x - e.x, dy = (G.p.y - 50) - e.y, L = Math.hypot(dx, dy) || 1; e.vx = dx / L * ENEMIES.diver.spd; e.vy = dy / L * ENEMIES.diver.spd; e.warn = 0; }
        e.shake = e.hoverT < 0.45;
      } else {
        e.x += e.vx * k * dt; e.y += e.vy * k * dt; e.vx += Math.sin(e.t * 9) * 120 * dt;
        if (e.y + e.r >= GROUND) { G.pop(e, false); }
        if (e.x < -40 || e.x > 1000) e.dead = true;
      }
      break;
    case 'jelly': {
      e.vy += 900 * dt * k; e.x += e.vx * k * dt; e.y += e.vy * k * dt;
      if (e.y + e.r >= GROUND) { e.y = GROUND - e.r; e.vy = -Math.sqrt(2 * 900 * e.bounceH); e.squash = 0.12; G.sfxThud?.(e); }
      if (e.x - e.r < ARENA.left) { e.x = ARENA.left + e.r; e.vx = Math.abs(e.vx); }
      if (e.x + e.r > ARENA.right) { e.x = ARENA.right - e.r; e.vx = -Math.abs(e.vx); }
      e.squash = Math.max(0, (e.squash || 0) - dt);
      break;
    }
    case 'fart':
      e.y += e.vy * k * dt; e.x = e.baseX + Math.sin(e.t * 0.9 + e.seed) * 60;
      if (e.y + e.r * 0.6 >= GROUND) G.floorHit(e);
      break;
    case 'crier': case 'spazm': case 'bloat': updateExtra(G, e, dt, k); break;
    case 'spout': case 'ghost': case 'craving': updateC3(G, e, dt, k); break;
    case 'popcorn':
      e.vy += 160 * dt; e.x += e.vx * dt; e.y += e.vy * k * dt; e.rot += dt * 3;
      if (e.y + e.r >= GROUND) { G.pop(e, false); }
      break;
  }
}

export function drawEnemy(G, ctx, e) {
  const hit = e.hitT > 0 ? 1 : 0;
  // тень на полу — видно, куда упадёт (Kaboom)
  if (e.type !== 'jelly' && e.type !== 'bloat' && e.type !== 'spazm' && e.type !== 'spout' && e.y < GROUND) {
    const near = clamp(1 - (GROUND - e.y) / 480, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.12 + near * 0.25})`;
    ctx.beginPath(); ctx.ellipse(e.x, GROUND + 2, e.r * (0.5 + near * 0.6), 4 + near * 2, 0, 0, TAU); ctx.fill();
  }
  const frozen = e.slowT > 0;
  switch (e.type) {
    case 'droplet':
      if (e.golden) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,209,102,${0.25 + 0.15 * Math.sin(e.t * 10)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2, 0, TAU); ctx.fill(); ctx.restore(); }
      drawDrop(ctx, e.x, e.y, e.r, { t: e.t, seed: e.seed, hit, fill: frozen ? '#9fd8ff' : e.golden ? '#ffc93c' : undefined, rim: frozen ? '#3a7ca8' : e.golden ? '#8a5a00' : undefined }); break;
    case 'drop': drawDrop(ctx, e.x, e.y, e.r, { t: e.t, seed: e.seed, hit, mood: e.hp < e.maxHp ? 1 : 0, fill: frozen ? '#9fd8ff' : '#e0283a', rim: frozen ? '#3a7ca8' : PAL.bloodDark }); break;
    case 'diver': {
      const sh = e.shake ? Math.sin(e.t * 60) * 2 : 0;
      const rot = e.state === 'dive' ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0;
      drawDrop(ctx, e.x + sh, e.y, e.r, { t: e.t, rot, hit, mood: 1, fill: frozen ? '#9fd8ff' : '#ff4f8b', rim: frozen ? '#3a7ca8' : '#8a1048', stretch: e.state === 'dive' ? 1.6 : 1 });
      if (e.shake) { ctx.fillStyle = '#ffeb3b'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', e.x, e.y - e.r * 2.4); }
      break;
    }
    case 'jelly': {
      const sq = e.squash > 0 ? e.squash / 0.12 : 0;
      ctx.save(); ctx.translate(e.x, e.y + e.r * 0.2 * sq); ctx.scale(1 + 0.3 * sq, 1 - 0.3 * sq);
      drawClot(ctx, 0, 0, e.r, { t: e.t, hit, fill: frozen ? '#9fd8ff' : undefined, look: clamp((G.p.x - e.x) / 300, -1, 1) });
      ctx.restore(); break;
    }
    case 'fart': drawFart(ctx, e.x, e.y, e.r, { t: e.t, hit }); break;
    case 'popcorn': drawPopcorn(ctx, e.x, e.y, e.r, e.rot); break;
    case 'crier': case 'spazm': case 'bloat': drawExtra(G, ctx, e); break;
    case 'spout': case 'ghost': case 'craving': drawC3(G, ctx, e); break;
  }
  // полоска HP у толстых
  if ((e.type === 'fart' || (e.type === 'jelly' && e.size === 0)) && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 22, e.y - e.r - 14, 44, 5);
    ctx.fillStyle = '#ff5a6a'; ctx.fillRect(e.x - 22, e.y - e.r - 14, 44 * e.hp / e.maxHp, 5);
  }
}

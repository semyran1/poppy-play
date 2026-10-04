// Оружие: у каждого вида — fire (выстрел по перезарядке) и, если нужно, tick (постоянное действие).
// Снаряды живут в G.shots, постоянные эффекты (пар, чаша, луч, вихрь) — в G.fx.
import { WEAPONS } from './data.js';
import { rand, TAU, clamp } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { drawTampon, drawPad, drawPill, drawBottle, drawChoco, drawCup } from '../art/sprites.js';
import { drawBroom, drawIceBall } from '../art/icons.js';
import { BLASTER_SKIN, emitTrail, updateTrail, drawTrail } from '../art/accessories.js';

// Аксессуары (G.acc = save.acc.equip, задаётся в play.js): скин бластера красит вспышку и тампон, след — частицы
export const muzzleColor = (G) => BLASTER_SKIN[G.acc?.blaster]?.flash || 'rgba(160,230,255,0.85)';

// Итоговые параметры оружия на его уровне (уровни — приращения к первому)
export function weaponParams(id, lv) {
  const def = WEAPONS[id]; const p = { ...def.lv[0] };
  for (let i = 1; i < lv && i < def.lv.length; i++) Object.assign(p, def.lv[i]);
  delete p.text; return p;
}

import { muzzle } from './player.js';
const handY = p => muzzle(p).y;
const handX = p => muzzle(p).x;

function shot(G, o) {
  const s = { x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 10, pierce: 0, life: 2, t: 0, kind: 'tampon', src: 'tampon', hit: null, ...o };
  if (s.pierce > 0 || s.kind === 'pad') s.hit = new Map();
  G.shots.push(s); return s;
}

const FIRE = {
  tampon(G, w, P, S) {
    const n = P.n + S.amount, spd = 760 * S.speed;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2);
      const ang = -Math.PI / 2 + (n >= 3 ? off * 0.09 : 0);
      shot(G, { x: handX(G.p) + off * 9, y: handY(G.p), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 6, dmg: P.dmg, pierce: P.pierce, kind: 'tampon', src: w.id });
    }
    sfx('shoot', { vol: 0.5, gap: 0.05 });
    G.muzzle = 0.05;
  },
  gatling(G, w, P, S) { FIRE.tampon(G, w, P, S); },
  pad(G, w, P, S) {
    const n = P.n + Math.floor(S.amount / 2);
    for (let i = 0; i < n; i++) {
      const dir = n === 1 ? G.p.face * 0.35 : (i / (n - 1) - 0.5) * 1.2;
      shot(G, { x: handX(G.p), y: handY(G.p), vx: dir * 260, vy: -640 * S.speed, r: 16 * P.area * S.area, dmg: P.dmg, pierce: 999, kind: 'pad', src: w.id, life: 3, spin: 0 });
    }
    sfx('whoosh', { vol: 0.5, pitch: 0.9 });
  },
  pills(G, w, P, S) {
    const n = P.n + S.amount;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.35;
      shot(G, { x: handX(G.p), y: handY(G.p), vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 6, dmg: P.dmg, kind: 'pill', src: w.id, homing: 7, spd: 430 * S.speed, life: 2.6, color: i % 2 ? '#ff7aa8' : '#5ec2ff', boom: w.id === 'fizz' ? 52 * S.area : 0 });
    }
    sfx('shoot2', { vol: 0.5 });
  },
  fizz(G, w, P, S) { FIRE.pills(G, w, P, S); },
  bottle(G, w, P, S) {
    const n = P.n;
    for (let i = 0; i < n; i++) {
      const tx = clamp(G.densestX() + (i - (n - 1) / 2) * 90 + rand(-20, 20), 60, 900);
      const ty = G.densestY(tx);
      const T = 0.75; // время полёта
      const vx = (tx - handX(G.p)) / T, vy = (ty - handY(G.p) - 0.5 * 900 * T * T) / T;
      shot(G, { x: handX(G.p), y: handY(G.p), vx, vy, g: 900, r: 11, dmg: P.dmg, kind: 'bottle', src: w.id, life: T, rot: 0, onEnd: 'steam', P: { ...P, area: P.area * S.area, dur: P.dotDur * S.duration, geyser: w.id === 'geyser' } });
    }
    sfx('whoosh', { vol: 0.4, pitch: 0.7 });
  },
  geyser(G, w, P, S) { FIRE.bottle(G, w, P, S); },
  broom(G, w, P, S) {
    const R = 115 * P.area * S.area, cx = G.p.x, cy = G.p.y - 60;
    G.fx.push({ kind: 'sweep', x: cx, y: cy, r: R, t: 0, life: 0.22, dir: G.p.face });
    for (const e of G.enemies) {
      const dx = e.x - cx, dy = e.y - cy;
      if (dy < 30 && dx * dx + dy * dy < (R + e.r) ** 2) { G.damage(e, P.dmg, w.id); if (e.vy !== undefined && e.type !== 'jelly') e.y -= 12; }
    }
    if (G.boss) { const b = G.boss; if (Math.hypot(b.x - cx, b.y - cy) < R + b.r) G.damageBoss(P.dmg, w.id); }
    sfx('whoosh', { vol: 0.45, pitch: 1.2 });
  },
  choco(G, w, P, S) {
    const n = P.n + S.amount;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * P.spread) + rand(-0.04, 0.04);
      shot(G, { x: handX(G.p), y: handY(G.p), vx: Math.cos(a) * 640 * S.speed, vy: Math.sin(a) * 640 * S.speed, r: 7, dmg: P.dmg, kind: 'choco', src: w.id, life: 0.42 * S.duration + 0.05, rot: rand(TAU) });
    }
    sfx('shoot', { vol: 0.35, pitch: 0.7, gap: 0.08 });
  },
  fountain(G, w, P, S) { FIRE.choco(G, w, P, S); },
  ice(G, w, P, S) {
    const n = P.n + S.amount;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.16;
      shot(G, { x: handX(G.p), y: handY(G.p), vx: Math.cos(a) * 560 * S.speed, vy: Math.sin(a) * 560 * S.speed, r: 7, dmg: P.dmg, kind: 'ice', src: w.id, slow: P.slow, shatter: w.id === 'permafrost' });
    }
    sfx('zap', { vol: 0.35, pitch: 1.6, gap: 0.06 });
  },
  permafrost(G, w, P, S) { FIRE.ice(G, w, P, S); },
  cup(G, w, P, S) {
    G.fx.push({ kind: 'cup', x: G.p.x, y: 482, w: P.width * S.area, t: 0, life: P.dur * S.duration, grail: !!P.shots, src: w.id });
    sfx('pickup', { pitch: 0.7 });
  },
  grail(G, w, P, S) { FIRE.cup(G, w, P, S); },
};

// Постоянные действия (каждый шаг)
const TICK = {
  tea(G, w, P, S, dt) {
    w.beamT = (w.beamT ?? 0) + dt;
    const cyc = P.cd / S.haste + P.on * S.duration;
    if (P.cd === 0) w.on = true; else { if (w.beamT > cyc) w.beamT = 0; w.on = w.beamT < P.on * S.duration; }
    if (!w.on) return;
    const half = P.width * S.area / 2, top = 0, y0 = handY(G.p), bx = handX(G.p);
    for (const e of G.enemies) if (Math.abs(e.x - bx) < half + e.r && e.y < y0) G.damage(e, P.dps * dt * S.might, w.id, { tick: true });
    if (G.boss && Math.abs(G.boss.x - bx) < half + G.boss.r) G.damageBoss(P.dps * dt * S.might, w.id, { tick: true });
    w.beam = { x: bx, half, y0, top };
    if (Math.random() < dt * 30) G.parts.spawn({ x: bx + rand(-half, half), y: y0 - rand(0, 400), vy: -rand(40, 120), life: 0.5, size: rand(2, 4), color: '#fff3b0', glow: true });
  },
  ceremony(G, w, P, S, dt) { TICK.tea(G, w, P, S, dt); },
  angel(G, w, P, S, dt) {
    w.ang = (w.ang || 0) + dt * 3.2;
    const R = 78 * P.area * S.area, cx = G.p.x, cy = G.p.y - 62;
    w.orbit = [];
    for (let i = 0; i < P.n; i++) {
      const a = w.ang + i * TAU / P.n, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.75;
      w.orbit.push({ x, y, a });
      for (const e of G.enemies) {
        if ((e.x - x) ** 2 + (e.y - y) ** 2 < (e.r + 18) ** 2) { e.angelCd = e.angelCd || 0; if (G.t > e.angelCd) { e.angelCd = G.t + 0.35; G.damage(e, P.dmg, w.id); } }
      }
      for (const f of G.foes) if ((f.x - x) ** 2 + (f.y - y) ** 2 < (f.r + 16) ** 2) f.dead = true; // блокирует снаряды
    }
  },
  vortex(G, w, P, S, dt) {
    w.ang = (w.ang || 0) + dt * 9;
    const R = 115 * P.area * S.area, cx = G.p.x, cy = G.p.y - 60;
    w.tickT = (w.tickT || 0) - dt;
    if (w.tickT <= 0) {
      w.tickT = 0.3;
      for (const e of G.enemies) { const dx = e.x - cx, dy = e.y - cy; if (dy < 30 && dx * dx + dy * dy < (R + e.r) ** 2) G.damage(e, P.dmg * 0.3, w.id); }
      if (G.boss && Math.hypot(G.boss.x - cx, G.boss.y - cy) < R + G.boss.r) G.damageBoss(P.dmg * 0.3, w.id);
    }
    w.vort = { x: cx, y: cy, r: R };
  },
};

export function updateWeapons(G, dt) {
  const S = G.stats;
  for (const w of G.run.weapons) {
    const P = weaponParams(w.id, w.lv);
    if (TICK[w.id]) TICK[w.id](G, w, P, S, dt);
    if (!FIRE[w.id] || !P.cd) continue;
    const frenzy = G.run.frenzy > 0 ? 1.6 : 1;
    w.cdT = (w.cdT ?? rand(0, 0.2)) - dt * S.haste * frenzy;
    if (w.cdT <= 0) { w.cdT += P.cd; FIRE[w.id](G, w, { ...P, dmg: (P.dmg || 0) * S.might }, S); if (G.run.twin?.[w.id]) FIRE[w.id](G, w, { ...P, dmg: (P.dmg || 0) * S.might }, S); }
  }
}

// Движение снарядов игрока
export function updateShots(G, dt) {
  for (const s of G.shots) {
    s.t += dt;
    if (s.kind === 'pad') {
      s.vy += 900 * dt; s.spin += dt * 14;
      if (s.vy > 0) { const dx = G.p.x - s.x; s.vx += clamp(dx * 4, -900, 900) * dt; }
      if (s.vy > 0 && s.y > G.p.y - 70) s.dead = true;
    }
    if (s.homing) {
      const tgt = G.nearest(s.x, s.y);
      const want = tgt ? Math.atan2(tgt.y - s.y, tgt.x - s.x) : Math.atan2(s.vy, s.vx);
      let a = Math.atan2(s.vy, s.vx), d = want - a;
      while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      a += clamp(d, -s.homing * dt, s.homing * dt);
      s.vx = Math.cos(a) * s.spd; s.vy = Math.sin(a) * s.spd;
    }
    if (s.g) s.vy += s.g * dt;
    if (s.rot !== undefined) s.rot += dt * 10;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.t >= s.life || s.y < -40 || s.y > 560 || s.x < -40 || s.x > 1000) {
      if (s.onEnd === 'steam' && !s.dead) G.steam(s.x, Math.min(s.y, 482), s.P, s.src);
      s.dead = true;
    }
    if (G.acc?.trail && s.kind !== 'pad' && !s.dead) emitTrail(G.accTrail ??= [], s, G.acc.trail, dt);
  }
  if (G.accTrail) updateTrail(G.accTrail, dt);
}

export function drawShots(G, ctx) {
  if (G.accTrail?.length) drawTrail(ctx, G.accTrail);
  const body = BLASTER_SKIN[G.acc?.blaster]?.shot;
  for (const s of G.shots) {
    switch (s.kind) {
      case 'tampon': drawTampon(ctx, s.x, s.y, s.src === 'gatling' ? 1.15 : 1, { rot: Math.atan2(s.vy, s.vx) + Math.PI / 2, string: true, body }); break;
      case 'pad': drawPad(ctx, s.x, s.y, s.r / 16 * 0.85, { rot: Math.sin(s.spin) * 0.6 }); break;
      case 'pill': drawPill(ctx, s.x, s.y, 1, { rot: Math.atan2(s.vy, s.vx), color: s.color }); break;
      case 'bottle': drawBottle(ctx, s.x, s.y, 0.8, { rot: s.rot }); break;
      case 'choco': drawChoco(ctx, s.x, s.y, 0.55, { rot: s.rot }); break;
      case 'ice': drawIceBall(ctx, s.x, s.y, s.r); break;
      case 'grail': drawCup(ctx, s.x, s.y, 0.6, { rot: Math.atan2(s.vy, s.vx) + Math.PI / 2, filled: true }); break;
      default: ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
  }
}

// Постоянные эффекты оружия поверх мира
export function drawWeaponFx(G, ctx) {
  for (const w of G.run.weapons) {
    if (w.beam && w.on) {
      const b = w.beam, fl = 0.85 + Math.sin(G.t * 40) * 0.15;
      const g = ctx.createLinearGradient(b.x - b.half, 0, b.x + b.half, 0);
      g.addColorStop(0, 'rgba(255,240,150,0)'); g.addColorStop(0.5, `rgba(255,250,210,${0.85 * fl})`); g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(b.x - b.half * 1.6, 0, b.half * 3.2, b.y0);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * fl})`; ctx.fillRect(b.x - b.half * 0.25, 0, b.half * 0.5, b.y0);
      ctx.globalCompositeOperation = 'source-over';
      w.beam = null;
    }
    if (w.orbit) for (const o of w.orbit) drawPad(ctx, o.x, o.y, 0.8, { rot: o.a + Math.PI / 2 });
    if (w.vort) {
      const v = w.vort; ctx.save(); ctx.translate(v.x, v.y);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -10, v.r * (0.6 + i * 0.2), v.r * (0.3 + i * 0.1), 0, w.ang + i * 2, w.ang + i * 2 + 2.4); ctx.strokeStyle = `rgba(190,160,255,${0.6 - i * 0.15})`; ctx.lineWidth = 6 - i * 1.5; ctx.stroke(); }
      drawBroom(ctx, Math.cos(w.ang) * v.r * 0.7, -10 + Math.sin(w.ang) * v.r * 0.35, 1, w.ang + Math.PI / 2);
      ctx.restore();
    }
  }
}

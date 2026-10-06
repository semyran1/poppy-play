// Временные бонусы (docs/ATMOSPHERE.md §5): «Пауза» (враги замирают), «Замедленная съёмка», «Зонтик» (ловит капли
// над головой), «Хлопушка» (мгновенно лопает мелочь). Отдельный пул от предметов оригинала; режиссёр бонусов
// ограничивает частоту, подкручивает веса по ситуации и страхует, если долго ничего не выпадало.
import { rand, clamp, weighted, TAU } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { GROUND } from './player.js';
import { view } from '../engine/core.js';

export const PU = {
  freeze:   { name: 'Пауза', sub: 'Враги замерли', dur: 3.5, color: '#c9a878' },
  slow:     { name: 'Замедленная съёмка', sub: 'Всё медленно, кроме тебя', dur: 6, color: '#b48cff' },
  umbrella: { name: 'Зонтик', sub: 'Капли сверху не страшны', dur: 7, color: '#ff6b8b' },
  popper:   { name: 'Хлопушка!', sub: 'Вся мелочь — в конфетти', dur: 0, color: '#ffd166' },
  magnet:   { name: 'Сладкий магнит', sub: 'Всё сладкое — к тебе, конфет +50%', dur: 8, color: '#ffd166' },
  double:   { name: 'Двойной сеанс', sub: 'Серия не рвётся, опыт ×1,5', dur: 8, color: '#5ee6c8' },
  lipstick: { name: 'Помада «Не трожь»', sub: 'Неуязвима, касание жжёт', dur: 5, color: '#ff3b8a' },
  // микро-бонусы между волнами босса (BOSS_BONUS; выпадает ОДИН на перерыве, play.js bloatWaveDone)
  bheart:   { name: 'Запасное сердце', sub: '+1 ♥ (если все целы — щит на удар)', dur: 0, color: '#ff7a9a', boss: true },
  bshield:  { name: 'Щит от урона', sub: '8 с удары не проходят', dur: 8, color: '#bfe8ff', boss: true },
  bregen:   { name: 'Регенерация', sub: '12 с: сердце каждые 5 с', dur: 12, color: '#ff9ab8', boss: true },
  bmight:   { name: 'Боевой задор', sub: '10 с: урон +40%', dur: 10, color: '#ffb347', boss: true },
  bbubble:  { name: 'Мыльный пузырь', sub: '10 с: снаряды лопаются рядом', dur: 10, color: '#9fe9ff', boss: true },
};
export const BOSS_BONUS = Object.keys(PU).filter(k => PU[k].boss);
export const BOSS_BONUS_ORDER = ['bshield', 'bregen', 'bmight', 'bbubble'];   // активные (с таймером) — для HUD
// какие бонусы есть в забеге: пауза и зонтик — всегда, остальное — из Косметички (разнообразие)
const NEEDS = { bheart: '_never', bshield: '_never', bregen: '_never', bmight: '_never', bbubble: '_never', slow: 'v_slow', popper: 'v_popper', magnet: 'v_magnet', double: 'v_double', lipstick: 'v_lipstick' };
const CHANCE = { droplet: 0.005, drop: 0.01, diver: 0.015, jelly: 0.02, crier: 0.02, fart: 0.06, spazm: 0.015 };

export function initPowerups(G, meta = {}) {
  G.pu = { freeze: 0, slow: 0, umbrella: 0, magnet: 0, double: 0, lipstick: 0, bshield: 0, bregen: 0, bmight: 0, bbubble: 0 };
  G.puAvail = Object.keys(PU).filter(k => !NEEDS[k] || meta[NEEDS[k]]);
  G.puDir = { lastDrop: -99, waveDrops: 0, sinceT: 0, lastKind: null };
}
export function puWaveStart(G) { G.puDir.waveDrops = 0; G.puDir.sinceT = 0; G.puDir.waveT = 0; }

// Множитель времени врагов и их снарядов
export function enemyTimeScale(G) { return G.pu.freeze > 0 ? 0 : G.pu.slow > 0 ? 0.45 : 1; }

export function updatePowerups(G, dt) {
  for (const k in G.pu) G.pu[k] = Math.max(0, G.pu[k] - dt);
  const D = G.puDir; D.sinceT += dt; D.waveT = (D.waveT || 0) + dt;
  if (G.pu.umbrella > 0) umbrellaCatch(G);
  else if (G.stats.umbCatch > 0 && !G.p.dead) canopyCatch(G);   // Складной зонтик ур. 2+: купол ловит слёзы и семечки
  // боссовые микро-бонусы
  if (G.pu.bshield > 0) G.p.iframes = Math.max(G.p.iframes, 0.1);
  if (G.pu.bregen > 0 && !G.p.dead) { D.regT = (D.regT || 0) + dt; if (D.regT >= 5) { D.regT = 0; if (G.p.hp < G.stats.maxHp) { G.p.hp++; sfx('heal'); G.floaters.add(G.p.x, G.p.y - 130, '+1 ♥', { color: '#ff9ab8' }); } } } else D.regT = 0;
  if (G.pu.bbubble > 0 && !G.p.dead) for (const f of G.foes) if (!f.dead && Math.hypot(f.x - G.p.x, f.y - (G.p.y - 60)) < 125 + f.r) { f.dead = true; G.parts.burst(f.x, f.y, 6, { color: ['#bff3ff', '#fff'], speed: [40, 130], g: 40, life: [0.25, 0.5], size: [2, 4] }); sfx('pop', { pitch: 1.8, vol: 0.3, gap: 0.05 }); }
  if (G.pu.magnet > 0) for (const k of G.pickups) if (k.kind === 'xp' || k.kind === 'candy') k.magnet = true;
  if (G.pu.double > 0) { G.run.comboT = Math.max(G.run.comboT, 1.5); }
  if (G.pu.lipstick > 0) {
    G.p.iframes = Math.max(G.p.iframes, 0.1);
    for (const e of G.enemies) if (!e.dead && Math.abs(e.x - G.p.x) < e.r + 22 && e.y > G.p.y - 90 - e.r && e.y < G.p.y + e.r) { e.lipT = (e.lipT || 0) - dt; if (e.lipT <= 0) { e.lipT = 0.1; G.damage(e, 60, 'lipstick'); } }
    if (Math.random() < dt * 14) G.parts.spawn({ x: G.p.x + rand(-22, 22), y: G.p.y - rand(10, 110), vy: -rand(20, 60), life: 0.6, size: rand(2, 4), color: '#ff3b8a', shape: 'star' });
  }
}

// Шанс выпадения при убийстве врага
export function puOnKill(G, e) {
  const D = G.puDir, P = G.phase;
  if (P !== 'wave' && P !== 'boss') return;
  if (G.pickups.some(k => k.kind === 'pu')) return;
  if (G.t - D.lastDrop < 12 || D.waveDrops >= 3 || (P === 'wave' && D.waveT < 6)) return;
  const pity = D.sinceT > 30;
  if (!pity && Math.random() > (CHANCE[e.type] || 0.005) * (G.stats.luck || 1)) return;
  // веса по ситуации
  const n = G.enemies.length, low = G.p.hp <= 2;
  const opts = [
    { k: 'freeze', w: n >= 14 ? 2 : 1 },
    { k: 'umbrella', w: low ? 2.5 : 1 },
    { k: 'slow', w: (n >= 14 ? 2 : 1) * (G.run.wave >= 1 || G.run.chapter > 0 ? 1 : 0) },
    { k: 'popper', w: (n >= 14 ? 2 : 0.7) * (G.run.wave >= 1 || G.run.chapter > 0 ? 1 : 0) },
    { k: 'magnet', w: G.pickups.filter(k => k.kind === 'xp').length >= 25 ? 3 : 0.8 },
    { k: 'double', w: G.run.comboMul >= 1.5 ? 2 : 0.8 },
    { k: 'lipstick', w: low ? 2.5 : 0.7 },
  ].filter(o => o.k !== D.lastKind && o.w > 0 && G.puAvail.includes(o.k));
  if (!opts.length) return;
  const id = weighted(opts).k;
  D.lastDrop = G.t; D.waveDrops++; D.sinceT = 0; D.lastKind = id;
  G.pickups.push({ kind: 'pu', id, x: clamp(e.x, 50, view.W - 50), y: e.y, vx: rand(-40, 40), vy: -220, t: 0, life: 7.5 });
}

export function puPickup(G, k, bark) {
  const def = PU[k.id];
  G.puTitle = { name: def.name, sub: def.sub, color: def.color, t: 0 };
  sfx('levelup', { pitch: 1.2 }); G.freeze(0.05);
  bark('pu_' + k.id, { force: true });
  if (k.id === 'popper') return popper(G);
  if (k.id === 'bheart') {   // запасное сердце: +1 ♥ (если полные — щит на один удар)
    if (G.p.hp < G.stats.maxHp) { G.p.hp++; G.floaters.add(G.p.x, G.p.y - 130, '+1 ♥', { color: '#ff9ab8', size: 22 }); } else G.run.shield = true;
    return;
  }
  G.pu[k.id] = def.dur * (def.boss ? 1 : (G.stats.duration || 1));
  if (k.id === 'freeze' && G.boss && !G.boss.virtual) G.bossFreeze = 1.5;
}

function popper(G) {
  G.shake(0.6); G.freeze(0.12); sfx('boom', { pitch: 1.4, vol: 0.6 });
  G.flash = 0.6;
  for (const e of G.enemies.slice()) {
    if (e.dead) continue;
    if (e.type === 'droplet' || e.type === 'drop' || e.type === 'diver') { if (G.phase === 'wave') { G.run.counter -= 1; G.run.counterPop = 0.2; } G.pop(e, true); G.parts.burst(e.x, e.y, 6, { color: ['#ffd166', '#ff7aa8', '#5ee6c8', '#fff'], speed: [80, 240], g: 400, life: [0.4, 0.8], shape: 'rect', size: [2, 5] }); }
    else if (e.type === 'bloat') G.damage(e, e.maxHp * 0.15, 'popper');
    else G.damage(e, e.maxHp * 0.5, 'popper');
  }
  for (const f of G.foes) f.dead = true;
  if (G.boss && !G.boss.virtual) G.damageBoss(G.boss.maxHp * 0.03, 'popper');
  G.parts.burst(view.W / 2, view.H * 0.37, 60, { color: ['#ffd166', '#ff7aa8', '#5ee6c8', '#c9b0ff', '#fff'], speed: [150, 500], g: 350, life: [0.6, 1.3], shape: 'rect', size: [3, 6] });
}

// Купол зонтика над Поппи ловит капли сверху (−1 к счётчику без «+2»), гасит слёзы и семечки
function umbrellaCatch(G) {
  const p = G.p, cx = p.x, cy = p.y - 112, R = 62;
  for (const e of G.enemies) {
    if (e.dead || !['droplet', 'drop', 'diver', 'crier'].includes(e.type)) continue;
    const dx = e.x - cx, dy = e.y - cy;
    if (dy < 6 && dx * dx + dy * dy < (R + e.r) ** 2) {
      if (G.phase === 'wave') { G.run.counter -= e.count || 1; G.run.counterPop = 0.15; }
      G.pop(e, true); sfx('pop', { pitch: 1.6, vol: 0.4 });
      G.parts.burst(e.x, e.y, 5, { color: ['#fff', '#ffd0dc'], speed: [60, 160], g: 500, angle: -Math.PI / 2, spread: 1.4, life: [0.2, 0.4], size: [1.5, 3], shape: 'star' });
    }
  }
  for (const f of G.foes) { const dx = f.x - cx, dy = f.y - cy; if (dy < 6 && dx * dx + dy * dy < (R + f.r) ** 2) f.dead = true; }
}

// Купол Складного зонтика (пассивка ур. 2+) над Поппи ловит слёзы и семечки, летящие сверху (радиус G.stats.umbCatch)
function canopyCatch(G) {
  const p = G.p, cx = p.x, cy = p.y - 112, R = G.stats.umbCatch;
  for (const f of G.foes) {
    if (f.dead || f.own || (f.kind !== 'seed' && f.kind !== 'tear')) continue;
    const dx = f.x - cx, dy = f.y - cy;
    if (dy < 10 && dx * dx + dy * dy < (R + f.r) ** 2) { f.dead = true; sfx('pop', { pitch: 1.5, vol: 0.35, gap: 0.05 }); G.parts.burst(f.x, f.y, 5, { color: ['#fff', '#ffd0dc', '#e0233c'], speed: [50, 140], g: 400, angle: -Math.PI / 2, spread: 1.4, life: [0.2, 0.4], size: [1.5, 3], shape: 'star' }); }
  }
}

// ---------- отрисовка ----------
export function drawPuToken(ctx, k) {
  const def = PU[k.id], blink = k.life - k.t < 2 ? (Math.sin(k.t * (k.life - k.t < 1 ? 60 : 25)) > 0 ? 1 : 0.35) : 1;
  ctx.save(); ctx.translate(k.x, k.y); ctx.globalAlpha = blink;
  ctx.fillStyle = def.color; ctx.globalAlpha = blink * (0.25 + 0.12 * Math.sin(k.t * 6)); ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill();
  ctx.globalAlpha = blink;
  // жетон-«плёнка»
  ctx.fillStyle = '#0e0612'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffd166'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.5)'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + k.t; ctx.fillRect(Math.cos(a) * 13 - 1, Math.sin(a) * 13 - 1, 2, 2); }
  drawPuIcon(ctx, k.id, 0, 0, 1);
  if (k.boss) {   // боссовый бонус: подпись под жетоном
    ctx.globalAlpha = blink; ctx.font = '900 14px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#0e0612'; ctx.strokeText(def.name, 0, 42); ctx.fillStyle = def.color; ctx.fillText(def.name, 0, 42);
  }
  ctx.restore();
}
export function drawPuIcon(ctx, id, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const c = PU[id].color;
  if (id === 'freeze') { ctx.fillStyle = c; ctx.fillRect(-6, -7, 4, 14); ctx.fillRect(2, -7, 4, 14); }
  else if (id === 'slow') { // песочные часы
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.moveTo(-6, 8); ctx.lineTo(6, 8);
    ctx.moveTo(-5, -8); ctx.lineTo(5, 8); ctx.moveTo(5, -8); ctx.lineTo(-5, 8); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(3, 7); ctx.lineTo(0, 2); ctx.fill();
  } else if (id === 'umbrella') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -1, 9, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 7); ctx.arc(-2.5, 7, 2.5, 0, Math.PI); ctx.stroke();
  } else if (id === 'magnet') {
    ctx.strokeStyle = c; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, -1, 6.5, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-8.2, -1, 3.4, 4); ctx.fillRect(4.8, -1, 3.4, 4);
  } else if (id === 'double') {
    ctx.fillStyle = c; ctx.font = '900 11px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×2', 0, 1);
  } else if (id === 'lipstick') {
    ctx.fillStyle = '#c9a878'; ctx.fillRect(-4, 0, 8, 8); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(-3.5, -6); ctx.lineTo(3.5, -9); ctx.lineTo(3.5, 0); ctx.fill();
  } else if (id === 'bheart') {
    ctx.fillStyle = c; ctx.strokeStyle = '#3a0a14'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-13, -1, -7, -11, 0, -4); ctx.bezierCurveTo(7, -11, 13, -1, 0, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 8px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', 0, -1);
  } else if (id === 'bshield') {
    ctx.fillStyle = 'rgba(191,232,255,0.5)'; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, -6); ctx.lineTo(7, 3); ctx.quadraticCurveTo(0, 11, -7, 3); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-3, 2); ctx.stroke();
  } else if (id === 'bregen') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-3, 7); ctx.bezierCurveTo(-11, 1, -7, -7, -3, -3); ctx.bezierCurveTo(1, -7, 5, 1, -3, 7); ctx.fill();
    ctx.strokeStyle = '#5ee6c8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(6, 0); ctx.moveTo(2, -4); ctx.lineTo(10, -4); ctx.stroke();
  } else if (id === 'bmight') {
    ctx.fillStyle = c; ctx.strokeStyle = '#4a1a00'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-6, 1); ctx.lineTo(-1, 1); ctx.lineTo(-3, 10); ctx.lineTo(7, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'bbubble') {
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(159,233,255,0.25)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 5.5, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  } else { // хлопушка
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-2, -4); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff7aa8'; ctx.fillRect(3, -8, 3, 3); ctx.fillStyle = '#5ee6c8'; ctx.fillRect(6, -2, 3, 3); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -9, 2, 2);
  }
  ctx.restore();
}

// Купол зонтика над героиней
export function drawUmbrella(ctx, G) {
  const t = G.pu.umbrella, passive = !(t > 0) && G.stats.umbCatch > 0 && !G.p.dead;   // пассивка (ур. 2+): купол поменьше и полупрозрачный
  if (!(t > 0) && !passive) return;
  if (!passive && t < 1.5 && Math.sin(G.t * 30) < 0) return;
  const p = G.p, cx = p.x, cy = p.y - 112, R = passive ? G.stats.umbCatch : 62;
  ctx.save(); if (passive) ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 50); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + i * Math.PI / 6, a1 = a0 + Math.PI / 6;
    ctx.fillStyle = i % 2 ? '#e0233c' : '#7a0d18';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
  }
  // фестоны
  ctx.fillStyle = 'rgba(14,6,18,0.0)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const x0 = cx - R + i * R / 3; ctx.moveTo(x0, cy); ctx.quadraticCurveTo(x0 + R / 6, cy - 9, x0 + R / 3, cy); } ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx, cy - R - 3, 4, 0, TAU); ctx.fill();
  ctx.restore();
}

// Экранные эффекты бонусов (поверх мира, под интерфейсом)
export function drawPuScreen(ctx, G) {
  if (G.pu.freeze > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = 0.35; ctx.fillStyle = '#c9a878'; ctx.fillRect(0, 0, view.W, view.H); ctx.restore();
    const y = 120 + ((G.t * 160) % (view.H - 240)); ctx.fillStyle = 'rgba(255,241,201,0.10)'; ctx.fillRect(0, y, view.W, 3);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 6); ctx.fillStyle = '#f3e2c0'; { const py = view.portrait ? 210 : 60; ctx.fillRect(view.W / 2 - 28, py, 14, 40); ctx.fillRect(view.W / 2 - 4, py, 14, 40); } ctx.globalAlpha = 1;
  }
  if (G.pu.slow > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.3; ctx.fillStyle = '#6b2fa3'; ctx.fillRect(0, 0, view.W, view.H); ctx.restore(); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,241,201,${G.flash})`; ctx.fillRect(0, 0, view.W, view.H); }
  // название подобранного бонуса
  const T = G.puTitle;
  if (T && T.t < 1.4) {
    const a = T.t < 0.12 ? T.t / 0.12 : T.t > 1.1 ? (1.4 - T.t) / 0.3 : 1, sc = T.t < 0.12 ? 1.4 - 0.4 * (T.t / 0.12) : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(view.W / 2, view.portrait ? 260 : 150); ctx.scale(sc, sc); ctx.textAlign = 'center';
    ctx.font = '900 28px Nunito, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#0e0612'; ctx.strokeText(T.name, 0, 0); ctx.fillStyle = T.color; ctx.fillText(T.name, 0, 0);
    ctx.font = '800 15px Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(T.sub, 0, 24); ctx.fillStyle = '#f3e2c0'; ctx.fillText(T.sub, 0, 24);
    ctx.restore();
  }
}
export function tickPuScreen(G, rdt) { if (G.flash > 0) G.flash = Math.max(0, G.flash - rdt * 4); if (G.puTitle) G.puTitle.t += rdt; }

// HUD: иконки активных бонусов с кольцевым таймером
export function drawPuHud(ctx, G, x, y) {
  for (const id of ['freeze', 'slow', 'umbrella', 'magnet', 'double', 'lipstick', ...BOSS_BONUS_ORDER]) {
    const t = G.pu[id]; if (t <= 0) continue;
    const k = t / (PU[id].dur * (PU[id].boss ? 1 : (G.stats.duration || 1)));
    if (t < 1.5 && Math.sin(G.t * 20) < 0) { x += 36; continue; }
    ctx.fillStyle = '#0e0612'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(94,230,200,0.25)'; ctx.stroke();
    ctx.strokeStyle = '#5ee6c8'; ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    drawPuIcon(ctx, id, x, y, 0.8);
    x += 36;
  }
}

// Помада: розовое свечение вокруг героини (рисовать до неё)
export function drawLipstickGlow(ctx, G) {
  if (!(G.pu.lipstick > 0) || (G.pu.lipstick < 1 && Math.sin(G.t * 30) < 0)) return;
  const p = G.p, g = ctx.createRadialGradient(p.x, p.y - 55, 10, p.x, p.y - 55, 80);
  g.addColorStop(0, 'rgba(255,59,138,0.45)'); g.addColorStop(1, 'rgba(255,59,138,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 55, 80, 0, TAU); ctx.fill();
}

// Свечение боссовых микро-бонусов вокруг героини (рисовать после неё): щит, пузырь, задор
export function drawBonusFx(ctx, G) {
  const p = G.p; if (p.dead) return;
  const fade = t => (t < 1.5 && Math.sin(G.t * 28) < 0) ? 0.3 : 1;
  if (G.pu.bshield > 0) { const a = fade(G.pu.bshield); ctx.save(); ctx.globalAlpha = 0.28 * a; ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(p.x, p.y - 56, 62, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.9 * a; ctx.lineWidth = 3; ctx.strokeStyle = '#e8f6ff'; ctx.stroke(); ctx.restore(); }
  if (G.pu.bbubble > 0) { const a = fade(G.pu.bbubble); ctx.save(); ctx.globalAlpha = 0.8 * a; ctx.setLineDash([6, 7]); ctx.lineDashOffset = -G.t * 40; ctx.lineWidth = 2.5; ctx.strokeStyle = '#9fe9ff'; ctx.beginPath(); ctx.arc(p.x, p.y - 60, 125, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.07 * a; ctx.fillStyle = '#9fe9ff'; ctx.fill(); ctx.restore(); }
  if (G.pu.bmight > 0) { const a = fade(G.pu.bmight); const g = ctx.createRadialGradient(p.x, p.y - 55, 8, p.x, p.y - 55, 76); g.addColorStop(0, `rgba(255,179,71,${0.4 * a})`); g.addColorStop(1, 'rgba(255,179,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 55, 76, 0, TAU); ctx.fill(); }
}

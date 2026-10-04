// Мисс Спазм — босс главы «Кинотеатр». Правила боссов: подсказка атаки 0,8–1,2 с, фазы на 66% и 33%,
// каждая фаза добавляет атаку, одна атака не повторяется два раза подряд.
import { rand, pick, clamp } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { drawSpasm, drawTentacle } from '../art/icons.js';
import { makeEnemy } from './enemies.js';
import { GROUND } from './player.js';

export function makeSpasm() {
  return {
    id: 'spasm', name: 'Мисс Спазм', x: 480, y: -160, r: 72, s: 1,
    hp: 9000, maxHp: 9000, phase: 1, t: 0, hitT: 0, invuln: 0,
    state: 'enter', st: 0, last: null, eyeT: 0, dark: 0, slams: [],
    lines: { 2: 'Ой, кто-то злится!', 3: 'Свет! Мотор! СПАЗМ!' },
  };
}

const ATTACKS = {
  1: ['slam', 'popcorn', 'slam'],
  2: ['slam2', 'popcorn', 'summon', 'slam'],
  3: ['slam2', 'popcorn', 'summon', 'dark'],
};

export function updateBoss(G, b, dt) {
  b.t += dt; b.st += dt; b.hitT = Math.max(0, b.hitT - dt); b.invuln = Math.max(0, b.invuln - dt);
  b.eyeT = Math.max(0, b.eyeT - dt); b.dark = Math.max(0, b.dark - dt);
  // фазы
  const ph = b.hp < b.maxHp * 0.33 ? 3 : b.hp < b.maxHp * 0.66 ? 2 : 1;
  if (ph > b.phase) { b.phase = ph; b.invuln = 1; G.freeze(0.12); G.shake(0.6); G.say(b.lines[ph], '#ff9ad0'); sfx('bossHit', { pitch: 0.6 }); b.state = 'idle'; b.st = 0; }

  if (b.state === 'enter') { b.y += (120 - b.y) * Math.min(1, dt * 2.5); if (b.st > 1.6) { b.state = 'idle'; b.st = 0; } return; }
  // плавает над игроком
  const tx = clamp(G.p.x + Math.sin(b.t * 0.7) * 160, 160, 800);
  b.x += (tx - b.x) * Math.min(1, dt * 0.8);
  b.y = 120 + Math.sin(b.t * 1.6) * 10;

  if (b.state === 'idle') {
    if (b.st > (b.phase === 1 ? 1.3 : 0.9)) {
      let a; do { a = pick(ATTACKS[b.phase]); } while (a === b.last && ATTACKS[b.phase].length > 1);
      b.last = a; b.state = a; b.st = 0; b.done = false;
      if (a === 'slam' || a === 'slam2') { b.slams = [{ x: G.p.x, t: 0, warn: 1.0 }]; if (a === 'slam2') b.slams.push({ x: clamp(960 - G.p.x + rand(-60, 60), 80, 880), t: -0.55, warn: 1.0 }); sfx('zap', { pitch: 0.4 }); }
    }
  } else if (b.state === 'slam' || b.state === 'slam2') {
    let all = true;
    for (const s of b.slams) {
      s.t += dt;
      if (s.t < 0) { all = false; continue; }
      if (s.t < s.warn) { all = false; continue; }                 // тень-подсказка
      const k = s.t - s.warn;
      if (k < 0.12) { s.y = (k / 0.12) * GROUND; all = false; }    // удар вниз
      else if (k < 0.62) { s.y = GROUND; all = false; if (!s.hitDone) { s.hitDone = true; G.shake(0.3); sfx('thud', { pitch: 0.6 }); G.parts.burst(s.x, GROUND, 14, { color: ['#c85aa0', '#ffc2e6'], speed: [80, 260], g: 600, angle: -Math.PI / 2, spread: 1.2 }); if (b.phase === 3) b.eyeT = 2; } }
      else if (k < 0.92) { s.y = GROUND * (1 - (k - 0.62) / 0.3); all = false; }
      else s.y = 0;
      // урон Поппи в колонне щупальца
      if (s.y > 0 && Math.abs(G.p.x - s.x) < 36 && G.p.y - 90 < s.y) G.hurtPlayer('Щупальце Мисс Спазм');
    }
    if (all) { b.state = 'idle'; b.st = 0; b.slams = []; if (b.phase >= 2) b.eyeT = Math.max(b.eyeT, 1.4); }
  } else if (b.state === 'popcorn') {
    const n = b.phase === 1 ? 10 : 14;
    if (!b.done) { b.done = true; b.spawned = 0; G.say('Попкорн-дождь!', '#ffe08a'); }
    if (b.spawned < n && b.st > b.spawned * 0.16) { b.spawned++; G.enemies.push(makeEnemy('popcorn', rand(80, 880), -20, G.waveIndex)); }
    if (b.st > 2.6) { b.state = 'idle'; b.st = 0; }
  } else if (b.state === 'summon') {
    if (!b.done) { b.done = true; for (let i = 0; i < 4 + b.phase; i++) G.enemies.push(makeEnemy(i % 3 ? 'droplet' : 'diver', b.x + rand(-80, 80), b.y + 40, G.waveIndex)); sfx('pop', { pitch: 0.6 }); }
    if (b.st > 1.4) { b.state = 'idle'; b.st = 0; }
  } else if (b.state === 'dark') {
    if (!b.done) { b.done = true; b.dark = 3.5; G.say('Проектор барахлит…', '#c9b0ff'); }
    if (b.st > 1.2) { b.state = 'idle'; b.st = 0; }
  }
}

export function drawBoss(G, ctx, b) {
  // луч проектора за боссом
  const g = ctx.createLinearGradient(480, -40, b.x, b.y + 60);
  g.addColorStop(0, 'rgba(255,240,200,0.0)'); g.addColorStop(1, 'rgba(255,240,200,0.16)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(470, -10); ctx.lineTo(490, -10); ctx.lineTo(b.x + 110, b.y + 80); ctx.lineTo(b.x - 110, b.y + 80); ctx.fill();
  // подсказки ударов — тень колонны и мигание
  for (const s of b.slams) {
    if (s.t >= 0 && s.t < s.warn) {
      const k = s.t / s.warn, blink = Math.sin(s.t * 30) > 0 ? 1 : 0.6;
      ctx.fillStyle = `rgba(200,60,160,${(0.12 + k * 0.25) * blink})`; ctx.fillRect(s.x - 34, 0, 68, GROUND);
      ctx.fillStyle = `rgba(40,0,30,${0.3 + k * 0.4})`; ctx.beginPath(); ctx.ellipse(s.x, GROUND + 2, 30 + k * 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (s.y > 0) drawTentacle(ctx, s.x, 0, s.y, 58, 1, G.t);
  }
  const look = clamp((G.p.x - b.x) / 300, -1, 1);
  const eye = b.eyeT > 0 ? 1 : (b.state === 'idle' ? 0.35 : 0.15);
  drawSpasm(ctx, b.x, b.y, b.s, { t: b.t, eye, look, hit: b.hitT > 0 ? 1 : 0, mood: b.phase - 1, phase: b.phase });
  if (b.eyeT > 0) { ctx.fillStyle = '#ffeb3b'; ctx.font = '900 16px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×2', b.x, b.y - 60); }
}

// Полоса HP босса с засечками фаз
export function drawBossBar(ctx, b) {
  const x = 230, y = 60, w = 500, h = 14;
  ctx.fillStyle = 'rgba(20,0,20,0.7)'; ctx.beginPath(); ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 9); ctx.fill();
  ctx.fillStyle = '#5a1a4a'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 7); ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ff5aa8'); g.addColorStop(1, '#c85aa0');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w * b.hp / b.maxHp), h, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (const f of [0.33, 0.66]) ctx.fillRect(x + w * f - 1, y - 2, 2, h + 4);
  ctx.font = '900 15px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#2a0a14'; ctx.strokeText(b.name, 480, y - 9); ctx.fillStyle = '#ffd6ec'; ctx.fillText(b.name, 480, y - 9);
}

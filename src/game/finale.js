// Финал «Логово Руды». Руда — не монстр, а «соседка, что приходит раз в месяц»: девочка в красном худи
// (вектор оригинала src/art/vec/ruda.js, рисуется через drawActor). Атаки: буквы-снаряды из её реплик
// (каждая буква сбивается) и «буря» — облегчённые атаки прошлых боссов. На 10 % HP бой замирает:
// «Обнять» или «Добить» (G.run.ending = 'hug' | 'war').
import { rand, clamp, pick, TAU } from '../engine/util.js';
import { sfx, playMusic } from '../engine/audio.js';
import { drawActor, preload } from '../art/scenes.js';
import { button, text } from './ui.js';
import { makeEnemy } from './enemies.js';
import { GROUND } from './player.js';
import { spawnFoe, addSlam, addWaves, startRain, updateHazards, drawHazards, softGlow, heartPath } from './chapter3.js';

const H = 236;                  // рост Руды на экране
const FEET = 118;               // от центра хитбокса до ног
const PHRASES = {
  1: ['ЧАЮ?', 'ПЛЕД', 'Я ВЕРНУСЬ'],
  2: ['ШОКОЛАДКУ?', 'НЕ ЖДАЛА?', 'ГРЕЛКУ!'],
  3: ['28 ДНЕЙ', 'Я ВЕРНУСЬ', 'ОБНИМИ'],
};
const R_ATT = { 1: ['letters', 'storm', 'letters', 'drops'], 2: ['letters', 'storm', 'letters', 'drops'], 3: ['letters', 'storm', 'storm', 'letters'] };
const SUBS = {
  tentacle: { name: 'Щупальце Мисс Спазм!', dur: 1.9 },
  popcorn: { name: 'Попкорн-дождь!', dur: 1.7 },
  babah: { name: 'Бабах Вздутия!', dur: 1.5 },
  rain: { name: 'Слёзы Королевы!', dur: 1.2 },
  shock: { name: 'Гнев Королевы!', dur: 1.6 },
};

export function makeRuda() {
  preload(['ruda']);
  return {
    id: 'ruda', name: 'Руда', intro: 'Соседка, что приходит раз в месяц', x: 480, y: -200, r: 70, s: 1,
    hp: 14000, maxHp: 14000, minHp: 1400, phase: 1, t: 0, st: 0, hitT: 0, invuln: 0, state: 'enter', last: null,
    eyeT: 0, dark: 0, slams: [], waves: [], rain: null, noChest: true, alpha: 1, swell: 0, lean: 0,
    lines: { 2: 'Ты всё ещё тут? Упрямая.', 3: 'Ладно. Вспомним всех, кто был до меня!' },
    deathLine: 'Увидимся через 28 дней!',
    upd: updateRuda, drw: drawRuda, resolve,
    side() { return this.x < 480 ? 1 : -1; },   // в какую сторону больше места для реплики
  };
}

function bubble(b, s, dur = 2.4, big = false) { b.say = { s, t: 0, dur, big }; }

function updateRuda(G, b, dt) {
  b.t += dt; b.st += dt; b.hitT = Math.max(0, b.hitT - dt); b.invuln = Math.max(0, b.invuln - dt);
  updateHazards(G, b, dt);
  if (b.say) { b.say.t += dt; if (b.say.t > b.say.dur) b.say = null; }
  b.swell = Math.max(0, b.swell - dt * 2);
  if (Math.random() < dt * 4) G.parts.spawn({ x: b.x + rand(-80, 80), y: b.y + rand(-60, 90), vx: rand(-20, 20), vy: -rand(20, 60), life: 1.2, size: rand(2, 4), color: Math.random() < 0.5 ? '#ff5a4a' : '#ffb08a', shape: 'drop' });

  if (b.state === 'enter') {
    b.y += (196 - b.y) * Math.min(1, dt * 2.2);
    if (b.st > 1.7) { b.state = 'idle'; b.st = 0; bubble(b, 'Ну здравствуй, Поппи. Соскучилась?'); }
    return;
  }
  if (b.state === 'hug') return updateHug(G, b, dt);
  if (b.state === 'plea') {
    b.x += (480 - b.x) * Math.min(1, dt * 2); b.y += (200 - b.y) * Math.min(1, dt * 2);
    if (b.st > 1.6 && !b.asked) { b.asked = true; b.wantChoice = true; }
    return;
  }
  // фазы
  const ph = b.hp < b.maxHp * 0.33 ? 3 : b.hp < b.maxHp * 0.66 ? 2 : 1;
  if (ph > b.phase && b.state !== 'war') {
    b.phase = ph; b.invuln = 1; b.state = 'idle'; b.st = 0; G.freeze(0.12); G.shake(0.5); sfx('bossHit', { pitch: 0.7 });
    bubble(b, b.lines[ph]);
    G.parts.burst(b.x, b.y, 24, { color: ['#ff5a4a', '#ffd0dc', '#fff'], speed: [120, 320], g: 300, life: [0.5, 1], shape: 'star', size: [3, 6] });
  }
  // 10 %: бой замирает — выбор
  if (!b.chosen && b.hp <= b.minHp + 1) {
    b.state = 'plea'; b.st = 0; b.invuln = 99; G.ceasefire = true; b.slams = []; b.waves = []; b.rain = null;
    for (const f of G.foes) f.dead = true; for (const e of G.enemies) G.pop(e, true);
    bubble(b, 'Хватит… Может, просто чаю?', 99);
    sfx('heal', { pitch: 0.6 });
    return;
  }
  // парит, покачиваясь
  const tx = clamp(480 + Math.sin(b.t * 0.42) * 250 + (G.p.x - 480) * 0.25, 150, 810);
  b.x += (tx - b.x) * Math.min(1, dt * 0.8);
  b.y += (196 + Math.sin(b.t * 1.3) * 10 - b.y) * Math.min(1, dt * 3);
  b.lean += ((b.state === 'letters' && b.st < 1 ? 0.12 * b.side() : Math.sin(b.t * 0.9) * 0.05) - b.lean) * Math.min(1, dt * 4);

  if (b.state === 'idle') {
    const wait = b.war ? 2.4 : [0, 1.3, 1.1, 0.9][b.phase];
    if (b.st > wait && !b.rain) {
      if (b.war) { startLetters(G, b, 'ПОКА', 80); return; }
      const L = R_ATT[b.phase]; let a; do { a = pick(L); } while (a === b.last && L.length > 1);
      b.last = a; b.st = 0; b.done = 0;
      if (a === 'letters') startLetters(G, b, pick(PHRASES[b.phase]), [0, 112, 125, 138][b.phase]);
      else if (a === 'storm') startStorm(G, b);
      else { b.state = 'drops'; bubble(b, 'Девочки, ко мне!', 1.6); }
    }
  } else if (b.state === 'letters') {
    // реплика висит 1 с (подсказка), потом буквы отрываются по одной
    const L = b.letters;
    if (b.st >= 1.0) {
      while (L.next < L.chars.length && b.st >= 1.0 + L.next * 0.09) {
        const i = L.next++, c = L.chars[i]; if (c === ' ') continue;
        // буквы падают строкой (слово читается), строй дрейфует к Поппи — пробей брешь и встань под неё
        const lx = L.x0 + i * L.step;
        spawnFoe(G, 'letter', lx, L.y, { ch: c, vx: 0, vy: -70, spd: L.spd, life: 10, ox: (i - (L.chars.length - 1) / 2) * L.step * 1.25, drift: b.war ? 25 : 42 });
        sfx('pop', { pitch: 0.8 + i * 0.06, vol: 0.35 });
      }
      if (L.next >= L.chars.length && b.st > 1.0 + L.chars.length * 0.09 + 0.6) { b.state = 'idle'; b.st = 0; b.say = null; }
    }
  } else if (b.state === 'storm') {
    updateStorm(G, b, dt);
  } else if (b.state === 'drops') {
    if (b.st > 0.8 && !b.done) {
      b.done = 1; for (let i = 0; i < 4; i++) G.enemies.push(makeEnemy(i === 3 && b.phase > 1 ? 'crier' : 'droplet', clamp(b.x + rand(-160, 160), 80, 880), b.y + 40, G.waveIndex));
      sfx('pop', { pitch: 0.6 });
    }
    if (b.st > 1.5) { b.state = 'idle'; b.st = 0; }
  }
}

function startLetters(G, b, phrase, spd) {
  const side = b.side(), chars = [...phrase], step = 34;
  const cx = clamp(b.x + side * 210, 60 + chars.length * step / 2, 900 - chars.length * step / 2);
  b.letters = { chars, step, x0: cx - (chars.length - 1) * step / 2, y: Math.max(112, b.y - 60), next: 0, spd, cx };
  b.state = 'letters'; b.st = 0;
  bubble(b, phrase, 1.0 + chars.length * 0.09 + 0.2, true);
  sfx('select', { pitch: 0.8, vol: 0.4 });
}

function startStorm(G, b) {
  const all = Object.keys(SUBS), n = b.phase === 3 ? 3 : 2, list = [];
  while (list.length < n) { const s = pick(all); if (!list.includes(s)) list.push(s); }
  b.state = 'storm'; b.st = 0; b.storm = { list, i: -1, st: 0 };
  bubble(b, 'Буря! Вспомним всех?', 1.4);
  G.floaters.add(480, 330, 'БУРЯ!', { size: 44, color: '#ff9ad0', life: 1.2, vy: -40 });
  sfx('boom', { pitch: 0.5, vol: 0.5 });
}
function updateStorm(G, b, dt) {
  const S = b.storm; S.st += dt;
  if (S.i < 0) { if (S.st > 1.0) { S.i = 0; S.st = 0; S.done = 0; announce(G, b, S.list[0]); } return; }
  const sub = S.list[S.i], p = G.p;
  switch (sub) {
    case 'tentacle':
      if (!S.done) { S.done = 1; addSlam(b, 'tentacle', p.x, 0, 1.0); if (b.phase === 3) addSlam(b, 'tentacle', clamp(960 - p.x, 80, 880), 0.5, 1.0); }
      break;
    case 'popcorn':
      if ((S.done || 0) < 7 && S.st > (S.done || 0) * 0.17) { S.done = (S.done || 0) + 1; G.enemies.push(makeEnemy('popcorn', rand(80, 880), -20, 4)); }
      break;
    case 'babah':
      b.swell = Math.min(1, S.st / 0.9);
      if (S.st > 0.9 && !S.done) {
        S.done = 1; G.shake(0.4); sfx('boom', { pitch: 0.8 });
        for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 6); spawnFoe(G, 'seed2', b.x, b.y, { vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, why: 'Семечко (буря Руды)' }); }
      }
      break;
    case 'rain':
      if (!S.done) { S.done = 1; startRain(b, { gaps: 2, gapW: 150, dur: 1.8, per: 1, light: true }); }
      break;
    case 'shock':
      if (S.st > 0.9 && !S.done) { S.done = 1; addWaves(b, b.x, 260, 'pink'); G.shake(0.35); sfx('thud', { pitch: 0.5 }); }
      break;
  }
  if (S.st > SUBS[sub].dur) {
    S.i++; S.st = 0; S.done = 0;
    if (S.i >= S.list.length) { b.state = 'idle'; b.st = 0; } else announce(G, b, S.list[S.i]);
  }
}
function announce(G, b, sub) { G.floaters.add(480, 340, SUBS[sub].name, { size: 28, color: '#ffe0ea', life: 1.3, vy: -30 }); if (sub === 'shock') b.shockWarn = 0.9; }

// выбор игрока (вызывает play.js)
function resolve(G, ending) {
  const b = G.boss; b.chosen = true; b.say = null;
  if (ending === 'hug') {
    b.state = 'hug'; b.st = 0; b.invuln = 99; b.hugX = clamp(G.p.x + (G.p.x < 480 ? 86 : -86), 90, 870);
    G.say('Иди сюда. Обнимемся.', '#fff');
    sfx('heal', { pitch: 1.2 }); playMusic('calm');
  } else {
    b.state = 'idle'; b.st = 0; b.invuln = 0.6; b.minHp = 0; b.war = true; G.ceasefire = false;
    bubble(b, 'Ну и пожалуйста! Я всё равно вернусь…', 2.6);
    G.say('Прости, соседка. Сегодня без чая.', '#fff', 'shout');
    sfx('bossHit', { pitch: 0.5 });
  }
}
function updateHug(G, b, dt) {
  // спускается к Поппи, обнимашки, успокаивается и тает
  const fy = GROUND - FEET;
  b.x += (b.hugX - b.x) * Math.min(1, dt * 2); b.y += (fy - b.y) * Math.min(1, dt * 2);
  b.lean += (0 - b.lean) * Math.min(1, dt * 3);
  if (Math.random() < dt * 10) G.parts.spawn({ x: (b.x + G.p.x) / 2 + rand(-40, 40), y: G.p.y - rand(60, 120), vx: rand(-20, 20), vy: -rand(40, 90), life: 1.4, size: rand(4, 7), color: Math.random() < 0.5 ? '#ff7aa8' : '#ffd0dc', shape: 'star' });
  if (b.st > 1.8 && !b.hugLine) { b.hugLine = true; bubble(b, 'Чай с мятой… и плед. Увидимся через месяц.', 3.2); sfx('heal', { pitch: 0.9 }); }
  if (b.st > 4.8) b.alpha = clamp(1 - (b.st - 4.8) / 1.2, 0, 1);
  if (b.st > 6.0 && !b.ended) { b.ended = true; G.bossDefeated?.(true); }
}

function drawRuda(G, ctx, b) {
  drawHazards(G, ctx, b);
  const t = b.t, hit = b.hitT > 0;
  // подсказка волны «Гнева» в буре: красная черта по полу под Рудой
  if (b.state === 'storm' && b.storm?.list[b.storm.i] === 'shock' && b.storm.st < 0.9) {
    const k = b.storm.st / 0.9; ctx.fillStyle = `rgba(255,110,190,${0.3 + 0.5 * k * (Math.sin(t * 30) > 0 ? 1 : 0.5)})`; ctx.fillRect(b.x - 60 - k * 300, GROUND - 3, 120 + k * 600, 6);
  }
  ctx.save(); ctx.globalAlpha = b.alpha;
  // тень и аура
  if (b.state !== 'hug') { ctx.fillStyle = 'rgba(30,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.x, GROUND + 3, 60, 8, 0, 0, TAU); ctx.fill(); }
  softGlow(ctx, b.x, b.y - 10, 170, b.state === 'hug' ? 'rgba(255,150,190,0.55)' : 'rgba(255,60,50,0.5)', 0.7 + 0.2 * Math.sin(t * 2.4));
  ctx.translate(b.x, b.y + FEET);
  ctx.rotate(b.lean);
  const breath = 1 + Math.sin(t * 2.2) * 0.015, sw = b.swell;
  ctx.scale(breath * (1 + sw * 0.12) + (sw > 0.6 ? Math.sin(t * 60) * 0.02 : 0), (2 - breath) * (1 + sw * 0.08));
  const ok = drawActor(ctx, 'ruda', 0, 0, H);
  if (!ok) { ctx.fillStyle = '#c8281e'; ctx.beginPath(); ctx.ellipse(0, -H / 2, 60, H / 2, 0, 0, TAU); ctx.fill(); }
  if (hit && ok && Math.sin(t * 40) > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * b.alpha; drawActor(ctx, 'ruda', 0, 0, H); }
  ctx.restore();
  if (b.invuln > 0 && b.invuln < 5 && b.state !== 'hug') { ctx.strokeStyle = `rgba(255,220,230,${0.4 + 0.3 * Math.sin(t * 20)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 14, 0, TAU); ctx.stroke(); }
  if (b.state === 'hug' && b.st > 0.8) { const k = Math.min(1, (b.st - 0.8) / 0.4); ctx.save(); ctx.globalAlpha = k * b.alpha; heartPath(ctx, (b.x + G.p.x) / 2, G.p.y - 150 - Math.sin(t * 4) * 5, 16); ctx.fillStyle = '#ff5d8f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#4a0a1a'; ctx.stroke(); ctx.restore(); }
  drawSay(ctx, b);
}

function drawSay(ctx, b) {
  const S = b.say; if (!S) return;
  const a = S.t < 0.15 ? S.t / 0.15 : S.t > S.dur - 0.25 ? (S.dur - S.t) / 0.25 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * b.alpha;
  if (S.big && b.letters) {
    // реплика-атака: крупные буквы — ровно там, откуда вылетят снаряды
    const L = b.letters, w = L.chars.length * L.step + 36, k = clamp(b.st / 1.0, 0, 1);
    ctx.fillStyle = 'rgba(255,240,244,0.95)'; ctx.beginPath(); ctx.roundRect(L.cx - w / 2, L.y - 30, w, 60, 22); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#7a0d18'; ctx.stroke();
    const tx = clamp(b.x, L.cx - w / 2 + 20, L.cx + w / 2 - 20);
    ctx.beginPath(); ctx.moveTo(tx - 10, L.y + (b.x < L.cx ? 0 : 0) + 28); ctx.lineTo(b.x + (L.cx > b.x ? 40 : -40), b.y - 70); ctx.lineTo(tx + 10, L.y + 28); ctx.fillStyle = 'rgba(255,240,244,0.95)'; ctx.fill();
    ctx.font = '900 38px Nunito, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    L.chars.forEach((c, i) => {
      if (i < L.next) return;
      const x = L.x0 + i * L.step, y = L.y + 2 + Math.sin(b.t * 10 + i) * 2 * k;
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#2a0408'; ctx.strokeText(c, x, y);
      ctx.lineWidth = 3; ctx.strokeStyle = k > 0.6 && Math.sin(b.t * 30) > 0 ? '#ffd166' : '#e0233c'; ctx.strokeText(c, x, y);
      ctx.fillStyle = '#fff3f6'; ctx.fillText(c, x, y);
    });
  } else {
    // сбоку от Руды (полоса HP сверху не перекрывается)
    ctx.font = '900 17px Nunito, sans-serif'; const w = ctx.measureText(S.s).width + 30, side = b.x < 480 ? 1 : -1;
    const bx = clamp(b.x + side * (w / 2 + 84), w / 2 + 10, 950 - w / 2), by = b.state === 'hug' ? b.y - 140 : b.y - 70;
    ctx.fillStyle = '#fff4f6'; ctx.beginPath(); ctx.moveTo(bx - side * (w / 2 - 6), by + 6); ctx.lineTo(b.x + side * 50, by + 24); ctx.lineTo(bx - side * (w / 2 - 6), by - 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 18, w, 36, 15); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#7a0d18'; ctx.stroke();
    ctx.fillStyle = '#7a0d18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.s, bx, by + 1);
  }
  ctx.restore();
}

// Экран выбора на 10 % HP. Возвращает 0 (обнять), 1 (добить) или -1.
export function drawRudaChoice(ctx, G, inp) {
  const k = clamp(G.phaseT / 0.5, 0, 1);
  ctx.fillStyle = `rgba(20,2,10,${0.55 * k})`; ctx.fillRect(0, 0, 960, 540);
  if (k < 1) return -1;
  text(ctx, 'Руда устала. Что сделает Поппи?', 480, 300, { size: 26, color: '#ffe6ef', lw: 6 });
  let res = -1;
  const sel = G.choiceSel ?? 0, opts = [[250, 'Обнять', '#ff5d8f', 'мир, чай и плед'], [510, 'Добить', '#b3203a', 'война до конца']];
  opts.forEach(([x, lbl, col, sub], i) => {
    if (sel === i) { ctx.save(); ctx.strokeStyle = `rgba(255,230,160,${0.6 + 0.4 * Math.sin(G.t * 8)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x - 8, 342, 216, 84, 22); ctx.stroke(); ctx.restore(); }
    if (button(ctx, inp, x, 350, 200, 68, lbl, { color: col, size: 30 })) res = i;
    if (i === 0) { heartPath(ctx, x + 26, 384, 9); ctx.fillStyle = '#fff'; ctx.fill(); }
    text(ctx, sub, x + 100, 444, { size: 15, color: '#ffd0dc', weight: 800, lw: 3 });
  });
  text(ctx, '← →  и  Enter   ·   или кликни', 480, 486, { size: 13, color: '#c9b0ff', weight: 700, lw: 3 });
  return res;
}

// Эмбиент логова: искры и лепестки, поднимающиеся от пола
const embers = Array.from({ length: 26 }, () => ({ x: Math.random() * 960, y: Math.random() * 480, v: 20 + Math.random() * 40, s: 1 + Math.random() * 2.2, ph: Math.random() * 6 }));
let lastT = 0;
export function drawLairAmbient(ctx, t) {
  const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const e of embers) {
    e.y -= e.v * dt; e.x += Math.sin(t * 1.3 + e.ph) * 12 * dt; if (e.y < -5) { e.y = 485; e.x = Math.random() * 960; }
    ctx.fillStyle = `rgba(255,${120 + (e.ph * 20 | 0)},60,${0.35 + 0.3 * Math.sin(t * 4 + e.ph)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Питомцы (docs/MEME_ACCESSORIES.md §3): летают рядом с героиней, догоняют пружиной, покачиваются, смотрят в сторону
// движения, реагируют на события (убийство, подбор, потеря сердца, «ЧИСТО!», босс, серия) прыжком, сердечком или
// звёздочкой и редко говорят короткую реплику. Только косметика: ничего не ловят, не подсвечивают и не дают в бою.
// Рисунок — vec/pet_*.js (смотрят влево), посадка — src/art/accessories.js (drawAccVecAt).
import { drawAccVecAt, accVecData } from '../art/accessories.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

// Реплики (детям безопасно, никого не стыдят): idle — просто так, hurt — потеря сердца, boss — появился босс,
// clear — «ЧИСТО!», combo — большая серия. Не длиннее ~20 знаков: одна строка.
export const PET_LINES = {
  pet_okak: { idle: ['Окак.', 'Ну окак.', 'Окак, капли.'], hurt: ['…окак'], boss: ['Окак, босс.'], clear: ['ОКАК!!'], combo: ['ОКАК!!'] },
  pet_beaver: { idle: ['БОБР!', 'Полено есть?', 'Бобр одобряет.', 'Сидим, стреляем.'], hurt: ['Бобр рядом.'], boss: ['Я граф. Почти.'], clear: ['БОБР!!'], combo: ['БОБР!!'] },
  pet_guinea: { idle: ['Я не плачу.', 'Это блёстки!', 'Глаза по плошке!'], hurt: ['Хнык… держись!'], boss: ['Обнимашку?'], clear: ['Хнык… молодец!'], combo: ['Это блёстки!'] },
  pet_capy: { idle: ['Спокойствие.', 'Чилл.', 'Не суетись.', 'Тыква держится.'], hurt: ['Ммм… уют.'], boss: ['Не суетись.'], clear: ['Чилл.'], combo: ['Чилл-чилл.'] },
  pet_surfdog: { idle: ['Ловлю волну!', 'Вжух!', 'Хаос? Не слышал.'], hurt: ['Всё хорошо!'], boss: ['Ещё волну!'], clear: ['Ещё волну!'], combo: ['Вжух!!'] },
  pet_lionhare: { idle: ['Тихо, не спеша…', 'Капли были крупнее', 'Пол мыли сами'], hurt: ['Ррр. То есть хрум.'], boss: ['Тихо, не спеша…'], clear: ['Раньше было хуже'], combo: ['Тихо, не спеша…'] },
  pet_monkey: { idle: ['Держусь!', 'Плюш со мной.', 'Мы справимся.', 'Обнимемся?'], hurt: ['Держись!'], boss: ['Держусь!'], clear: ['Мы справимся.'], combo: ['Держусь!!'] },
};
// цвет конфетти питомца на убийстве и подборе: [щепки / листики / ...]
const PET_FX = { pet_beaver: '#b8854a', pet_capy: '#7cc44a' };

// Размер питомца нормирован по «массе» (площадь рисунка), а не по высоте: широкая Свинка-Плошка и Макака с тыквой не
// крупнее Кота. Множитель к номинальной высоте h (рост Кота): корень площади Кота / корень площади питомца, площади
// замерены tools/petmass.html; снизу ограничен 0,8, чтобы широкий не стал совсем мелким. Номинал в бою — 38 px (был 50).
export const PET_NOM = 38;
export const PET_K = { pet_okak: 1, pet_beaver: 0.91, pet_guinea: 0.8, pet_capy: 1.02, pet_surfdog: 1.02, pet_lionhare: 0.95, pet_monkey: 0.87 };

export function newPet() {
  return { x: 0, y: 0, vx: 0, vy: 0, t: 0, dir: 1, sq: 0, hop: 0, spin: 0, hide: 0, hurtT: 0, sign: null, fx: [], bubble: null,
    cd: rnd(4, 7), recent: [], spoke: 0, placed: false, lastId: null, happy: 0 };
}

// Цель пружины: у плеча со стороны, противоположной бластеру (hx, hy — героиня; face — куда она смотрит)
export function petTarget(hx, hy, face, big = 1) { return { x: hx - 34 * big * face, y: hy - 80 * big, face }; }

export function updatePet(P, dt, tgt, o = {}) {
  P.t += dt;
  const k = 40, d = 9;
  if (!P.placed || Math.hypot(tgt.x - P.x, tgt.y - P.y) > 420) { P.x = tgt.x; P.y = tgt.y; P.vx = P.vy = 0; P.placed = true; }
  // «прячется за героиню» (потеря сердца, босс): цель — сама героиня
  P.hide = Math.max(0, P.hide - dt); P.hurtT = Math.max(0, P.hurtT - dt);
  const tx = P.hide > 0 ? tgt.x + 34 * (o.big || 1) * tgt.face * 0.95 : tgt.x, ty = P.hide > 0 ? tgt.y + 12 * (o.big || 1) : tgt.y;
  const bob = Math.sin(P.t * TAU * 0.8) * 2.5 * (o.big || 1);
  P.vx += ((tx - P.x) * k - P.vx * d) * dt; P.vy += ((ty + bob - P.y) * k - P.vy * d) * dt;
  P.x += P.vx * dt; P.y += P.vy * dt;
  // разворот по знаку скорости, в покое — туда же, куда смотрит героиня
  if (Math.abs(P.vx) > 38) P.dir = Math.sign(P.vx); else P.dir = tgt.face || P.dir;
  P.sq = Math.max(0, P.sq - dt); P.hop = Math.max(0, P.hop - dt); P.spin = Math.max(0, P.spin - dt); P.happy = Math.max(0, P.happy - dt);
  for (const f of P.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; }
  P.fx = P.fx.filter(f => f.t < f.life);
  if (P.sign && (P.sign.t += dt) > P.sign.life) P.sign = null;
  if (P.bubble && (P.bubble.t += dt) > P.bubble.life) P.bubble = null;
  P.cd -= dt;
}

function burst(P, kind, n, o = {}) {
  for (let i = 0; i < n; i++) P.fx.push({ kind, x: o.x ?? 0, y: o.y ?? -22, vx: rnd(-30, 30), vy: -rnd(30, 70), g: o.g ?? 0, t: 0, life: o.life ?? 0.8, s: rnd(0.8, 1.2), col: o.col });
}

// Событие: 'kill' | 'pickup' | 'hurt' | 'clear' | 'boss' | 'combo' (n — длина серии)
export function petReact(P, id, ev, o = {}) {
  if (!P || !id) return;
  const L = PET_LINES[id];
  switch (ev) {
    case 'kill':
      P.sq = 0.12; P.hop = P.hopD = 0.12;
      if (PET_FX[id] && Math.random() < 0.3) burst(P, 'bit', 2, { col: PET_FX[id], g: 220, life: 0.5, y: -6 });
      break;
    case 'pickup':
      if (Math.random() < 0.35) burst(P, Math.random() < 0.5 ? 'star' : 'heart', 1, { life: 0.7 });
      P.sq = 0.1;
      break;
    case 'hurt':
      P.hide = 1.2; P.hurtT = 1.2; burst(P, 'tear', 2, { g: 120, life: 0.7, y: -8 }); say(P, id, 'hurt', { force: o.force, soft: true });
      break;
    case 'clear':
      P.spin = 0.3; P.hop = P.hopD = 0.3; burst(P, 'heart', 3, { life: 1 }); say(P, id, 'clear', { force: o.force });
      break;
    case 'boss':
      P.hide = 1.5; say(P, id, 'boss', { force: o.force });
      break;
    case 'combo':
      P.spin = 0.3; P.sign = { s: '×' + o.n, t: 0, life: 1.5 }; burst(P, 'star', 4, { life: 0.9 }); say(P, id, 'combo', { force: o.force });
      break;
  }
}

// Реплика: не чаще раза в 9–12 с, не поверх реплики Поппи (blocked), без повторов подряд (очередь «последние 3»)
export function say(P, id, cat, { force = false, blocked = false, soft = false } = {}) {
  const L = PET_LINES[id]?.[cat]; if (!L || blocked) return false;
  if (!force && P.cd > 0) return false;
  let pool = L.filter(s => !P.recent.includes(s)); if (!pool.length) pool = L;
  const s = pool[Math.floor(Math.random() * pool.length)];
  P.recent.push(s); if (P.recent.length > 3) P.recent.shift();
  P.bubble = { s, t: 0, life: 1.6 }; P.cd = soft ? rnd(5, 7) : rnd(9, 12); P.spoke++;
  return true;
}
// случайная реплика «просто так»: вызывать, когда Поппи молчит и идёт бой
export function petIdle(P, id, blocked) { if (P.cd <= 0 && !blocked && Math.random() < 0.02) say(P, id, 'idle', { blocked }); }

// ---------- рисование ----------
function heart(ctx, s) { ctx.beginPath(); ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.7, -s * 1.1, 0, -s * 0.4); ctx.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9); ctx.closePath(); }
function star(ctx, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, q = i % 2 ? r * 0.4 : r; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath(); }

// h — номинальная высота питомца на экране (в бою PET_NOM = 38; фактическая — × PET_K[id]), (P.x, P.y) — центр. Сначала тело, затем накладки и пузырь
export function drawPet(ctx, P, id, h = PET_NOM, o = {}) {
  const d = accVecData(id); if (!d) return;
  const sq = P.sq > 0 ? P.sq / 0.12 : 0, sqx = 1 + 0.15 * sq, sqy = 1 - 0.12 * sq;
  const tilt = Math.max(-0.07, Math.min(0.07, P.vx / 2200));
  const hopY = P.hop > 0 ? -Math.sin((1 - P.hop / (P.hopD || 0.12)) * Math.PI) * (P.hopD > 0.2 ? 9 : 4) : 0;
  const spin = P.spin > 0 ? (1 - P.spin / 0.3) * TAU : 0;
  ctx.save(); ctx.translate(P.x, P.y + hopY * (h / 50));
  // тень под питомцем в меню не нужна; в бою — мягкая
  ctx.rotate(tilt + spin); ctx.scale((P.dir > 0 ? -1 : 1) * sqx, sqy);
  if (P.hurtT > 0) ctx.globalAlpha = 0.95;
  drawAccVecAt(ctx, id, 0, 0, h * (PET_K[id] || 1), { ax: 0.5, ay: 0.5 });
  ctx.restore();
  const k = h / 50, kt = Math.max(k, 1);   // kt: подписи не мельчают
  // накладки: сердечки, звёздочки, слёзки, щепки
  for (const f of P.fx) {
    const a = 1 - f.t / f.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6)); ctx.translate(P.x + f.x * k, P.y + f.y * k);
    if (f.kind === 'heart') { heart(ctx, 4.5 * k * f.s); ctx.fillStyle = '#ff5fa2'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#7a0a3a'; ctx.stroke(); }
    else if (f.kind === 'star') { star(ctx, 5 * k * f.s); ctx.fillStyle = '#ffe066'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#a0600a'; ctx.stroke(); }
    else if (f.kind === 'tear') { ctx.beginPath(); ctx.ellipse(0, 0, 1.8 * k, 2.8 * k, 0, 0, TAU); ctx.fillStyle = '#8fd8ff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#2a6aa0'; ctx.stroke(); }
    else { ctx.fillStyle = f.col || '#b8854a'; ctx.fillRect(-1.5 * k, -1 * k, 3 * k, 2 * k); }
    ctx.restore();
  }
  // табличка серии в лапах
  if (P.sign) {
    const g = P.sign, a = g.t < 0.15 ? g.t / 0.15 : g.t > g.life - 0.3 ? (g.life - g.t) / 0.3 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.font = `900 ${Math.round(12 * kt)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(g.s).width + 10 * kt, sy = P.y + h * 0.12;   // табличка «в лапах»: на уровне груди
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(P.x - w / 2, sy - 9 * kt, w, 18 * kt, 4 * kt); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2a0a14'; ctx.stroke();
    ctx.fillStyle = '#c4143c'; ctx.fillText(g.s, P.x, sy + 1); ctx.restore();
  }
  if (P.hurtT > 0 && P.hurtT > 0.9) { ctx.save(); ctx.font = `900 ${Math.round(14 * kt)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff4a5a'; ctx.strokeStyle = '#2a0a14'; ctx.lineWidth = 3; ctx.strokeText('!', P.x, P.y - h * 0.6); ctx.fillText('!', P.x, P.y - h * 0.6); ctx.restore(); }
  if (P.bubble && !o.noBubble) drawPetBubble(ctx, P, h);
}

export function drawPetBubble(ctx, P, h, maxX = 954) {   // maxX — правый край для реплики (бой: view.W − 6)
  const b = P.bubble, L = b.life, a = b.t < 0.15 ? b.t / 0.15 : b.t > L - 0.25 ? (L - b.t) / 0.25 : 1;
  const pop = b.t < 0.15 ? 0.3 + 0.8 * (b.t / 0.15) : b.t < 0.22 ? 1.1 - (b.t - 0.15) / 0.07 * 0.1 : 1;
  const k = Math.max(h / 50, 1), fs = Math.round(12 * Math.min(k, 1.5));
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.font = `900 ${fs}px Nunito, sans-serif`;
  const w = ctx.measureText(b.s).width + 18, bx = Math.max(w / 2 + 6, Math.min(maxX - w / 2, P.x)), by = P.y - h * 0.62 - 22 * Math.min(k, 1.5) + (h < 50 ? 6 : 0);
  ctx.translate(bx, by + 12); ctx.scale(pop, pop); ctx.translate(-bx, -by - 12);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 12, w, 24, 11); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(42,10,20,0.55)'; ctx.stroke();
  const tx = Math.max(bx - w / 2 + 10, Math.min(bx + w / 2 - 10, P.x));
  ctx.beginPath(); ctx.moveTo(tx - 5, by + 11); ctx.lineTo(tx + 1, by + 21); ctx.lineTo(tx + 6, by + 11); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a0a14'; ctx.fillText(b.s, bx, by + 1);
  ctx.restore();
}

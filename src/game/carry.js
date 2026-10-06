// «Что взять с собой?» — выбор улучшений между главами одного забега (1→2, 2→3, 3→4; не перед финалом и не после него).
// Правило: из всех улучшений (оружие и пассивки) оставить можно половину, округляя вверх, минимум 2, максимум 4.
// Стартовый Тампон (и его эволюция Гатлинг) остаётся всегда и в счёт не идёт. Остальное «разбирается на конфеты»:
// цена = 10 × уровень, эволюция ×3, редкое ×1,5 (округление). Если улучшений ≤ лимита — экран пропускается («Берёшь всё»).
// Здесь — данные и правила (чистые функции, без DOM), обновление клавиатуры и рисование (портрет — на полном виде, ландшафт — в рамке 960×540).
// В play.js — только узкие хуки (фаза 'carry', carryStart / carryFinish). Заметки: docs/iter_carry.md.
import { view } from '../engine/core.js';
import { clamp } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { WEAPONS, PASSIVES } from './data.js';
import { text, button, FONT } from './ui.js';
import { drawIcon } from '../art/icons.js';
import { drawCandy } from '../art/sprites.js';
import { metrics, fitWrap } from './overlays_p.js';

export const CARRY = { minKeep: 2, maxKeep: 4, perLevel: 10, evoMul: 3, rareMul: 1.5, guard: 0.45 };   // guard — секунды после показа, когда ввод игнорируется

const evolvedFrom = id => Object.keys(WEAPONS).find(k => WEAPONS[k].evo === id);
// стартовое оружие (Тампон) и его эволюция остаются всегда
export const isStartWeapon = id => !!WEAPONS[id]?.start || (!!WEAPONS[id]?.evolved && !!WEAPONS[evolvedFrom(id)]?.start);
export const carryLimit = n => clamp(Math.ceil(n / 2), CARRY.minKeep, CARRY.maxKeep);
export const carryPrice = it => Math.round(CARRY.perLevel * it.lv * (it.evo ? CARRY.evoMul : 1) * (it.rare ? CARRY.rareMul : 1));

// Список улучшений забега (без стартового оружия). Поля: kind 'w'|'p', id, lv, max, name, icon, rare, evo, price, pairName (есть пара), ready (оружие 5 ур. + пара = эволюция)
export function carryItems(R) {
  const out = [];
  const hasP = id => R.passives.some(p => p.id === id);
  for (const w of R.weapons) {
    const d = WEAPONS[w.id]; if (!d || isStartWeapon(w.id)) continue;
    const pairOk = !d.evolved && d.pair && hasP(d.pair);
    out.push({ kind: 'w', id: w.id, lv: w.lv, max: d.lv.length, name: d.name, icon: d.icon, rare: !!d.rare, evo: !!d.evolved,
      pairName: pairOk ? PASSIVES[d.pair].name : null, ready: !!pairOk && w.lv >= d.lv.length });
  }
  for (const p of R.passives) {
    const d = PASSIVES[p.id]; if (!d) continue;
    const w = R.weapons.find(x => !WEAPONS[x.id].evolved && WEAPONS[x.id].pair === p.id);
    out.push({ kind: 'p', id: p.id, lv: p.lv, max: d.max, name: d.name, icon: d.icon, rare: !!d.rare, evo: false,
      pairName: w ? WEAPONS[w.id].name : null, ready: !!w && w.lv >= WEAPONS[w.id].lv.length });
  }
  for (const it of out) it.price = carryPrice(it);
  return out;
}
// Ценность для предвыбора: цена (уровень и редкость) + эволюция и готовые пары (оружие 5 ур. + пассивка) — выше всего
const worth = it => it.price + (it.evo ? 1000 : 0) + (it.ready ? 500 : 0) + (it.pairName ? 20 : 0);
export function carryPreselect(items, limit) {
  const order = items.map((it, i) => i).sort((a, b) => worth(items[b]) - worth(items[a]) || a - b);
  items.forEach(it => { it.keep = false; });
  order.slice(0, limit).forEach(i => { items[i].keep = true; });
}
export const keptCount = st => st.items.filter(i => i.keep).length;
export const carryGain = st => st.items.reduce((a, i) => a + (i.keep ? 0 : i.price), 0);
// Предупреждение: оружие 5 ур. остаётся (или это стартовое), а его пара уходит в конфеты → эволюции не будет
export function carrySplitWarn(st, R) {
  for (const w of R.weapons) {
    const d = WEAPONS[w.id]; if (d.evolved || !d.pair || w.lv < d.lv.length) continue;
    const pi = st.items.find(i => i.kind === 'p' && i.id === d.pair); if (!pi || pi.keep) continue;
    const wi = st.items.find(i => i.kind === 'w' && i.id === w.id);
    if (!wi || wi.keep) return `Без «${pi.name}» «${d.name}» не эволюционирует`;
  }
  return null;
}
// Состояние экрана. skip: true — показывать нечего («Берёшь всё»)
export function carryOpen(R) {
  const items = carryItems(R), limit = carryLimit(items.length);
  const start = R.weapons.find(w => isStartWeapon(w.id));
  const st = { items, limit, skip: items.length <= limit, t: 0, focus: items.length, msg: null, msgT: 0, shake: 0, cols: 1, startName: start ? WEAPONS[start.id].name : 'Тампон-бластер', R, px: -1, py: -1 };
  carryPreselect(items, limit);
  return st;
}
export function carryToggle(st, i) {
  const it = st.items[i]; if (!it) return false;
  if (it.keep) { it.keep = false; sfx('select', { pitch: 0.8 }); return true; }
  if (keptCount(st) >= st.limit) { st.msg = `Можно взять только ${st.limit}: сначала сними другую`; st.msgT = 2.6; st.shake = 0.35; sfx('thud', { vol: 0.35, pitch: 1.4 }); return false; }
  it.keep = true; sfx('select', { pitch: 1.4 }); return true;
}
// Применить выбор к забегу: убрать не выбранные оружие и пассивки. Возвращает { gained, dropped:[имена], kept }.
// Пересчёт характеристик и зачисление конфет — в play.js (carryFinish). Лимит соблюдается и здесь (лишнее уходит по возрастанию ценности).
export function carryApply(R, st) {
  const extra = st.items.filter(i => i.keep).sort((a, b) => worth(b) - worth(a)).slice(st.limit);
  for (const i of extra) i.keep = false;
  const k = (kind, id) => st.items.some(i => i.kind === kind && i.id === id && i.keep);
  R.weapons = R.weapons.filter(w => isStartWeapon(w.id) || k('w', w.id));
  R.passives = R.passives.filter(p => k('p', p.id));
  const dropped = st.items.filter(i => !i.keep);
  // состояние, привязанное к выброшенным пассивкам
  if (dropped.some(i => i.id === 'umbrellaP')) R.umbT = 0;
  if (dropped.some(i => i.id === 'socks')) R.regenT = 0;
  return { gained: dropped.reduce((a, i) => a + i.price, 0), dropped: dropped.map(i => i.name), kept: st.items.filter(i => i.keep).length };
}

// Клавиатура: ← → ↑ ↓ (A D W S) — фокус по карточкам и кнопке «Взять с собой» (последняя, фокус на ней при открытии),
// Space / Enter — переключить карточку или нажать кнопку, 1…7 — переключить карточку. Возвращает 'confirm' или null.
export function carryUpdate(st, inp, rdt) {
  st.t += rdt; st.msgT = Math.max(0, st.msgT - rdt); st.shake = Math.max(0, st.shake - rdt);
  if (st.msgT <= 0) st.msg = null;
  if (st.t < CARRY.guard) return null;
  const n = st.items.length, cols = st.cols || 1, h = inp.hit.bind(inp);
  const step = (h('ArrowLeft') || h('KeyA') ? -1 : 0) + (h('ArrowRight') || h('KeyD') ? 1 : 0) + (h('ArrowUp') || h('KeyW') ? -cols : 0) + (h('ArrowDown') || h('KeyS') ? cols : 0);
  if (step) {
    let f = st.focus + step;
    if (step === cols && cols > 1 && st.focus < n && st.focus + cols >= n) f = n;   // ↓ из последней строки — на кнопку
    st.focus = clamp(f, 0, n); sfx('select', { vol: 0.5 });
  }
  for (let i = 0; i < n; i++) if (h('Digit' + (i + 1))) { st.focus = i; carryToggle(st, i); }
  if (h('Enter') || h('Space')) { if (st.focus < n) carryToggle(st, st.focus); else return 'confirm'; }
  return null;
}

// ---------- Рисование ----------
function nameLines(ctx, s, maxW, size) {
  ctx.font = `900 ${size}px ${FONT}`;
  const toks = s.split(' ').flatMap((w, wi) => (w.match(/[^-]+-?|-/g) || [w]).map((t, pi) => ({ t, sp: pi === 0 && wi > 0 })));
  const lines = []; let cur = '';
  for (const k of toks) { const t = cur ? cur + (k.sp ? ' ' : '') + k.t : k.t; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = k.t; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function fitName(ctx, s, maxW, maxLines, size, minSize) {
  const ok = (f) => { const L = nameLines(ctx, s, maxW, f); return L.length <= maxLines && L.every(l => ctx.measureText(l).width <= maxW) ? L : null; };
  for (let f = Math.floor(size); f >= minSize; f--) { const L = ok(f); if (L) return { lines: L, size: f }; }
  for (let f = minSize - 1; f >= 12; f--) { const L = ok(f); if (L) return { lines: L, size: f }; }   // длинное слово без места для переноса — чуть мельче
  return { lines: nameLines(ctx, s, maxW, minSize), size: minSize };
}
function check(ctx, x, y, s, col) { ctx.save(); ctx.lineWidth = Math.max(3, s * 0.34); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.12, y + s * 0.4); ctx.lineTo(x + s * 0.55, y - s * 0.42); ctx.stroke(); ctx.restore(); }
const tagOf = it => (it.evo ? 'ЭВОЛЮЦИЯ ★' : (it.rare ? '★ ' : '') + `ур. ${it.lv}/${it.max}`) + (it.pairName ? ' ♥' : '');

// Одна карточка. r = {x,y,w,h}; o = { style:'wide'|'tall', F, e (появление 0..1), focus, press, idx, touch }
function drawCard(ctx, it, r, o) {
  const { x, y, w, h } = r, F = o.F, keep = it.keep, gold = it.rare || it.evo, on = o.focus || o.press;
  const col = keep ? '#5ee6c8' : '#7d6a85';
  ctx.save(); ctx.globalAlpha = o.e;
  if (on) { ctx.translate(x + w / 2, y + h / 2); const sc = o.press ? 0.985 : 1.02; ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2)); }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x, y + 6, w, h, 18); ctx.fill();
  ctx.fillStyle = keep ? '#2e0f2a' : '#1c101f'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
  if (keep && gold) { ctx.save(); ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 16 + 6 * Math.sin(performance.now() / 220); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd166'; ctx.stroke(); ctx.restore(); }
  ctx.lineWidth = on ? 5 : 3; ctx.strokeStyle = on ? '#fff' : col; ctx.stroke();
  const tall = o.style === 'tall';
  const iz = tall ? clamp(h * 0.34, 72, 96) : w > 300 ? clamp(h - 36, 56, 78) : 54, ix = tall ? x + (w - iz) / 2 : x + 12, iy = tall ? y + 14 : y + (h - iz) / 2;
  ctx.fillStyle = col; ctx.globalAlpha = o.e * (keep ? 0.2 : 0.1); ctx.beginPath(); ctx.roundRect(ix, iy, iz, iz, 14); ctx.fill();
  ctx.globalAlpha = o.e * (keep ? 1 : 0.5); drawIcon(ctx, it.icon, ix + iz / 2, iy + iz / 2, 2.4 * iz / 110); ctx.globalAlpha = o.e;
  // текст: название (до 2 строк), метка уровня, статус
  const tx = tall ? x + 10 : ix + iz + 10, tw = tall ? w - 20 : x + w - 12 - tx, al = tall ? 'center' : 'left', cx = tall ? x + w / 2 : tx;
  const top = tall ? iy + iz + 8 : y + 8, bot = y + h - 8;
  const nm = fitName(ctx, it.name, tw, 2, tall ? 21 : 20, F);
  const nameH = nm.lines.length * (nm.size + 3), tagH = F + 5, stH = F + 8, blockH = nameH + tagH + stH;
  let yy = top + Math.max(0, (bot - top - blockH) / 2);
  nm.lines.forEach((l, j) => text(ctx, l, cx, yy + nm.size * 0.55 + j * (nm.size + 3), { size: nm.size, align: al, color: keep ? '#fff' : '#bba9c0' }));
  yy += nameH;
  text(ctx, tagOf(it), cx, yy + tagH * 0.5, { size: F, align: al, color: it.rare || it.evo ? '#ffd166' : '#ff9ab8', lw: 4 });
  yy += tagH;
  const sy = yy + stH * 0.5;
  if (keep) {
    const label = 'Берёшь'; ctx.font = `900 ${F + 1}px ${FONT}`; const lw = ctx.measureText(label).width, gw = F * 0.9 + 8, total = gw + lw;
    const sx = tall ? cx - total / 2 : cx;
    check(ctx, sx + F * 0.5, sy, F * 0.9, '#5ee6c8'); text(ctx, label, sx + gw + 2, sy, { size: F + 1, align: 'left', color: '#5ee6c8', lw: 4 });
  } else {
    const label = `+${it.price}`; ctx.font = `900 ${F + 2}px ${FONT}`; const lw = ctx.measureText(label).width, total = lw + 30;
    const sx = tall ? cx - total / 2 : cx;
    text(ctx, label, sx, sy, { size: F + 2, align: 'left', color: '#ffd166', lw: 4 }); drawCandy(ctx, sx + lw + 16, sy + 1, 1.25);
  }
  if (!o.touch) text(ctx, String(o.idx + 1), x + w - 14, y + 16, { size: 15, align: 'right', color: 'rgba(255,255,255,0.5)', outline: false });
  ctx.restore(); ctx.globalAlpha = 1;
}

// Раскладка прямоугольников: n карточек в cols колонок внутри области reg, высота ch, зазор gap; неполный последний ряд — по центру
function gridRects(n, cols, reg, ch, gap) {
  const rows = Math.ceil(n / cols), cw = Math.min(reg.cw || 1e9, (reg.w - gap * (cols - 1)) / cols), out = [];
  const total = rows * ch + gap * (rows - 1), y0 = reg.y + Math.max(0, (reg.h - total) * 0.3);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), x0 = reg.x + (reg.w - (inRow * cw + gap * (inRow - 1))) / 2;
    out.push({ x: x0 + (i - row * cols) * (cw + gap), y: y0 + row * (ch + gap), w: cw, h: ch });
  }
  return out;
}
// Карточки + ввод указателем (касание по карточке переключает сразу)
function cardsPass(ctx, st, env, rects, style, F) {
  const inp = env.inp, p = inp.pointer, touch = !!inp.isTouch, moved = p.x !== st.px || p.y !== st.py;
  rects.forEach((r, i) => {
    const e0 = clamp((st.t - i * 0.06) / 0.25, 0, 1), e = 1 - (1 - e0) ** 3;
    const rr = { x: r.x, y: r.y + (1 - e) * 30, w: r.w, h: r.h };
    const over = p.x > rr.x && p.x < rr.x + rr.w && p.y > rr.y && p.y < rr.y + rr.h;
    if (over && !touch && moved) st.focus = i;
    if (over && p.clicked && st.t > CARRY.guard) { p.clicked = false; st.focus = i; carryToggle(st, i); }
    drawCard(ctx, st.items[i], rr, { style, F, e, focus: !touch && st.focus === i, press: over && p.down && st.t > CARRY.guard, idx: i, touch });
  });
  st.px = p.x; st.py = p.y; st.rects = rects;   // rects — для автотестов (координаты вида в портрете, рамки в ландшафте)
}
// Строка-сообщение: ошибка лимита > предупреждение о паре > подсказка первого раза > «Тампон всегда с тобой»
function msgOf(st, env) {
  if (st.msg) return { s: st.msg, c: '#ff9ab8' };
  const w = carrySplitWarn(st, st.R); if (w) return { s: w, c: '#ffd166' };
  if (!env.save?.carryHintDone) return { s: 'Забирай самое нужное: остальное обменяем на конфеты', c: '#bff3e6' };
  return { s: `${st.startName} всегда с тобой${st.items.some(i => i.pairName) ? '. ♥ — пара для эволюции' : ''}`, c: '#c9b0ff' };
}
const subOf = st => `Оставь ${st.limit} из ${st.items.length}. Остальное — в конфеты`;
function pill(ctx, st, x, y, w, h, size) {
  const kept = keptCount(st), full = kept >= st.limit, sh = st.shake > 0 ? Math.sin(st.shake * 70) * 5 * Math.min(1, st.shake / 0.35) : 0;
  ctx.save(); ctx.translate(sh, 0);
  ctx.fillStyle = 'rgba(30,8,24,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = st.shake > 0 ? '#ff6b8b' : full ? '#5ee6c8' : '#ff7aa8'; ctx.stroke();
  text(ctx, `Берёшь: ${kept} из ${st.limit}`, x + 22, y + h / 2 + 1, { size, align: 'left', color: st.shake > 0 ? '#ff9ab8' : full ? '#5ee6c8' : '#fff' });
  const g = carryGain(st), lab = `Конфеты: +${g}`; ctx.font = `900 ${size}px ${FONT}`; const lw = ctx.measureText(lab).width;
  text(ctx, lab, x + w - 52, y + h / 2 + 1, { size, align: 'right', color: g ? '#ffd166' : '#a58fb0' });
  drawCandy(ctx, x + w - 30, y + h / 2 + 1, 1.4); ctx.restore();
}
function focusRing(ctx, x, y, w, h) { ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - 5, y - 5, w + 10, h + 10, 20); ctx.stroke(); ctx.restore(); }

// Портрет: на полном виде W × H (540 × 840…1260). Возвращает 'confirm' или null.
export function drawCarryP(ctx, st, env) {
  const M = metrics(), { W, H } = M, inp = env.inp, F = M.minF, touch = !!inp.isTouch, n = st.items.length;
  ctx.fillStyle = 'rgba(15,4,14,0.86)'; ctx.fillRect(0, 0, W, H);
  let y = M.top + 14;
  const title = 'Что взять с собой?', ts = fitWrap(ctx, title, M.w, 1, 40, 28, 900);
  text(ctx, title, M.cx, y + 26, { size: ts.size, color: '#ffeb7a', lw: 8 }); y += 54;
  const sub = fitWrap(ctx, subOf(st), M.w, 2, 20, F, 800);
  sub.lines.forEach((l, j) => text(ctx, l, M.cx, y + sub.size * 0.6 + j * (sub.size + 4), { size: sub.size, color: '#ffd0dc', weight: 800, lw: 4 }));
  y += sub.lines.length * (sub.size + 4) + 8;
  pill(ctx, st, M.L, y, M.w, 46, 22); y += 46 + 12;
  const bH = M.btnH, pad = Math.max(M.sb + 16, H * 0.03), kbd = touch ? 0 : 24, btnY = H - pad - kbd - bH;
  const mm = msgOf(st, env), ml = fitWrap(ctx, mm.s, M.w - 8, 2, F + 1, F, 800), msgH = 2 * (F + 5);
  const gridBottom = btnY - 10 - msgH - 6, avail = gridBottom - y, gap = 10;
  const ch1 = (avail - gap * (n - 1)) / n, cols = n <= 4 || ch1 >= 100 ? 1 : 2, rows = Math.ceil(n / cols);
  const ch = clamp((avail - gap * (rows - 1)) / rows, 96, 150);
  st.cols = cols;
  const rects = gridRects(n, cols, { x: M.L, y, w: M.w, h: avail }, ch, gap);
  cardsPass(ctx, st, env, rects, 'wide', F);
  ml.lines.forEach((l, j) => text(ctx, l, M.cx, btnY - 10 - msgH + (msgH - ml.lines.length * (F + 5)) / 2 + (F + 5) / 2 + j * (F + 5), { size: ml.size, color: mm.c, weight: 800, lw: 4 }));
  const hit = button(ctx, inp, M.L, btnY, M.w, bH, 'Взять с собой', { size: 32 });
  if (!touch && st.focus === n) focusRing(ctx, M.L, btnY, M.w, bH);
  if (!touch) text(ctx, '← → ↑ ↓ — выбор · Пробел — взять/отдать · Enter — подтвердить', M.cx, btnY + bH + 17, { size: 14, color: '#c9b0ff', weight: 700, lw: 3 });
  return hit && st.t > CARRY.guard ? 'confirm' : null;
}

// Ландшафт: внутри дизайн-рамки 960×540 (withFrame), указатель — в координатах рамки. Возвращает 'confirm' или null.
export function drawCarryL(ctx, st, env) {
  const inp = env.inp, F = 17, touch = !!inp.isTouch, n = st.items.length;
  text(ctx, 'Что взять с собой?', 480, 44, { size: 40, color: '#ffeb7a', lw: 8 });
  text(ctx, subOf(st), 480, 82, { size: 20, color: '#ffd0dc', weight: 800, lw: 4 });
  const reg = { x: 24, y: 104, w: 912, h: 272 }, gap = 16;
  let rects, style;
  if (n <= 4) { style = 'tall'; reg.cw = 214; rects = gridRects(n, n, reg, 262, gap); st.cols = n; }
  else { style = 'wide'; rects = gridRects(n, 4, reg, (reg.h - 12) / 2, 12); st.cols = 4; }
  cardsPass(ctx, st, env, rects, style, F);
  pill(ctx, st, 190, 384, 580, 36, 21);
  const mm = msgOf(st, env); text(ctx, mm.s, 480, 438, { size: F + 1, color: mm.c, weight: 800, lw: 4 });
  const bw = 320, bh = 62, bx = 480 - bw / 2, by = 454;
  const hit = button(ctx, inp, bx, by, bw, bh, 'Взять с собой', { size: 28 });
  if (!touch && st.focus === n) focusRing(ctx, bx, by, bw, bh);
  if (!touch) text(ctx, '← → ↑ ↓ — выбор · Пробел — взять/отдать · Enter — подтвердить', 480, 530, { size: 14, color: '#c9b0ff', weight: 700, lw: 3 });
  return hit && st.t > CARRY.guard ? 'confirm' : null;
}

// Короткая плашка в начале главы: «Берёшь всё» (улучшений мало) или итог выбора. note = { text, sub, t }
export function drawCarryNote(ctx, note) {
  const T = note.t, k = T < 0.25 ? T / 0.25 : T > 2.2 ? Math.max(0, (2.6 - T) / 0.4) : 1; if (k <= 0) return;
  const cx = view.W / 2, cy = (view.portrait ? view.H * 0.34 : 230) + 124, ui = view.uiScale || 1;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(cx, cy - (1 - k) * 10); ctx.scale(ui, ui);
  ctx.font = `900 24px ${FONT}`; const w1 = ctx.measureText(note.text).width; ctx.font = `800 18px ${FONT}`; const w2 = note.sub ? ctx.measureText(note.sub).width + 34 : 0;
  const w = Math.min(view.W / ui - 24, Math.max(w1, w2) + 48), h = note.sub ? 74 : 46;
  ctx.fillStyle = 'rgba(20,60,50,0.9)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5ee6c8'; ctx.stroke();
  text(ctx, note.text, 0, note.sub ? -14 : 1, { size: 24, color: '#e8fff8' });
  if (note.sub) { text(ctx, note.sub, -12, 17, { size: 18, color: '#ffd166', weight: 800, lw: 4 }); ctx.font = `800 18px ${FONT}`; drawCandy(ctx, ctx.measureText(note.sub).width / 2 + 4, 18, 1.2); }
  ctx.restore();
}

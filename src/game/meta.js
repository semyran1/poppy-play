// Косметичка 2.0 — витрина после каждого забега: 3 случайных предложения, из них одно «сила» (постоянное
// усиление, ранги короче прежних) и два «разнообразие» (новые бонусы и события в забегах). Прокачка в первую
// очередь добавляет в игру штучки, а не облегчает её.
import { TAU, star } from '../engine/util.js';
import { drawCandy, drawPanties, drawDrop, drawPumpkin } from '../art/sprites.js';
import { sfx } from '../engine/audio.js';

// Сила: id совпадают со старым META_SHOP (старые сохранения не теряются, ранг обрезается по max)
export const META_POWER = [
  { id: 'might', name: 'Сила', desc: 'Все снаряды бьют на 5% сильнее (за ранг)', max: 3, base: 40, apply: (s, r) => { s.might += 0.05 * r; } },
  { id: 'hp', name: 'Запасные трусики', desc: 'Шестое сердце в начале каждого забега', max: 1, base: 160, rare: true, apply: (s, r) => { s.maxHp += r; } },
  { id: 'haste', name: 'Бодрость', desc: 'Оружие стреляет на 4% чаще (за ранг)', max: 3, base: 45, apply: (s, r) => { s.haste *= 1 + 0.04 * r; } },
  { id: 'speed', name: 'Кроссовки', desc: 'Поппи бегает на 4% быстрее (за ранг)', max: 3, base: 35, apply: (s, r) => { s.moveSpeed += 0.04 * r; } },
  { id: 'growth', name: 'Дневник', desc: 'Опыта за капли на 5% больше — новые уровни чуть раньше', max: 3, base: 40, apply: (s, r) => { s.growth += 0.05 * r; } },
  { id: 'magnet', name: 'Магнит', desc: 'Кристаллы опыта и конфеты тянутся к тебе издалека (+15%)', max: 3, base: 30, apply: (s, r) => { s.magnet *= 1 + 0.15 * r; } },
  { id: 'luck', name: 'Удача', desc: 'Чаще 4-я карта прокачки и предметы из капель (+5%)', max: 3, base: 50, apply: (s, r) => { s.luck += 0.05 * r; } },
  { id: 'reroll', rare: true, name: 'Перебор', desc: 'Ещё один перебор: заменить неудачные карты прокачки', max: 2, base: 70, apply: (s, r) => { s.rerolls += r; } },
  { id: 'greed', name: 'Копилка', desc: 'Конфет за забег на 10% больше (за ранг)', max: 3, base: 35, apply: (s, r) => { s.greed += 0.1 * r; } },
];
// Разнообразие: покупается один раз, добавляет новое в забеги
export const META_VARIETY = [
  { id: 'v_slow', name: 'Песочные часы', desc: 'Новый бонус в забегах: на 6 с враги и их снаряды замедляются вдвое', base: 60, icon: 'slow' },
  { id: 'v_popper', name: 'Хлопушка', desc: 'Новый бонус: мгновенно лопает все мелкие капли на экране', base: 70, icon: 'popper' },
  { id: 'v_magnet', name: 'Сладкий магнит', desc: 'Новый бонус: 8 с весь опыт и конфеты летят к тебе, конфет +50%', base: 60, icon: 'magnet' },
  { id: 'v_double', rare: true, name: 'Двойной сеанс', desc: 'Новый бонус: 8 с серия убийств не рвётся, опыта в 1,5 раза больше', base: 80, icon: 'double' },
  { id: 'v_lipstick', rare: true, name: 'Помада «Не трожь»', desc: 'Новый бонус: 5 с неуязвимости, капли от касания сгорают', base: 90, icon: 'lipstick' },
  { id: 'v_golden', name: 'Золотая капля', desc: 'Новое событие: раз в волну пролетает золотая капля — собьёшь, +25 конфет', base: 70, icon: 'golden' },
  { id: 'v_rain', name: 'Конфетный дождь', desc: 'Новое событие: после каждой волны 3 с сыплются конфеты — лови их', base: 60, icon: 'rain' },
  { id: 'v_festival', rare: true, name: 'Тыквенный фестиваль', desc: 'Тыквы-колокольчики вдвое чаще, а пятый приз — сразу три (конфеты, сердце, щит)', base: 70, icon: 'festival' },
];
const byId = id => META_POWER.find(m => m.id === id) || META_VARIETY.find(m => m.id === id);
export const isPower = id => META_POWER.some(m => m.id === id);
export const isRare = id => !!byId(id)?.rare;
export const metaById = byId;
export const hasMeta = (save, id) => !!(save.meta && save.meta[id]);

export function offerPrice(save, id) {
  const m = byId(id); if (!m) return 0;
  return Math.round((isPower(id) ? m.base * 1.5 * ((save.meta[id] || 0) + 1) : m.base) * (m.rare ? 2.2 : 1));
}
const pick = a => a[Math.floor(Math.random() * a.length)];

// Новая витрина: 1 сила + 2 разнообразия (чего не хватает — добираем другим типом)
export function rollOffers(save, o = {}) {
  const wsort = ids => ids.map(id => ({ id, k: Math.random() * (byId(id).rare ? 0.35 : 1) })).sort((a, b) => b.k - a.k).map(o => o.id);
  let pw0 = META_POWER.filter(m => (save.meta[m.id] || 0) < m.max).map(m => m.id), vr0 = META_VARIETY.filter(m => !save.meta[m.id]).map(m => m.id);
  // cheap (первые смерти): редкие карточки стоят 150–500 конфет — новичку они не по карману, витрина должна быть покупаемой
  if (o.cheap) { const ok = id => !byId(id).rare; if (pw0.filter(ok).length + vr0.filter(ok).length >= 3) { pw0 = pw0.filter(ok); vr0 = vr0.filter(ok); } }
  const pw = wsort(pw0), vr = vr0;
  const out = [];
  if (pw.length) out.push(pw[0]);
  const v2 = wsort(vr).reverse();
  while (out.length < 3 && v2.length) out.push(v2.pop());
  const p2 = pw.filter(id => !out.includes(id)).sort(() => Math.random() - 0.5);
  while (out.length < 3 && p2.length) out.push(p2.pop());
  save.offers = out; save.offerShuffled = false;
  return out;
}
export function ensureOffers(save) { if (!Array.isArray(save.offers)) rollOffers(save); return save.offers; }
export function buyOffer(save, id) {
  const price = offerPrice(save, id); if (save.candies < price) return false;
  save.candies -= price; save.meta[id] = (save.meta[id] || 0) + 1;
  save.offers = save.offers.filter(o => o !== id);
  return true;
}
// «Утешительный приз»: после ПЕРВОЙ смерти на счёте хватает минимум на две покупки с витрины (и не меньше FIRST_DEATH_BONUS сверху);
// после 2–3-й смерти — минимум на одну (если короткий забег не набрал). Конфеты зачисляются сразу; возвращает { n, label } или null.
export const FIRST_DEATH_BONUS = 25;
export function consolation(save) {
  const deaths = save.stats?.deaths || 0, prices = (save.offers || []).map(id => offerPrice(save, id)).sort((a, b) => a - b);
  if (!prices.length) return null;
  let need = 0, min = 0, label = 'Утешительный приз';
  if (!save.firstDeathGift && deaths <= 1) { save.firstDeathGift = true; need = prices[0] + (prices[1] || 0); min = FIRST_DEATH_BONUS; }
  else if (deaths <= 3) { need = prices[0]; label = 'Подарок за смелость'; }
  const n = Math.max(min, need - save.candies);
  if (n <= 0) return null;
  save.candies += n; save.stats.candiesTotal = (save.stats.candiesTotal || 0) + n;
  return { n, label };
}
export const SHUFFLE_PRICE = 15;
export function shuffleOffers(save) {
  if (save.offerShuffled || save.candies < SHUFFLE_PRICE || (save.offers || []).length < 3) return false;   // только целую витрину
  save.candies -= SHUFFLE_PRICE; rollOffers(save); save.offerShuffled = true; return true;
}


// ======================================================================================================
// Отрисовка: значки-иллюстрации, карточка предложения, рубашка, штамп и «раскрытие» витрины после забега
// ======================================================================================================
const INK = '#2a0a14';
const C = {
  ink: '#3a1a10', night: '#0e0612', velvet: '#7a0d18', velvetD: '#4a0610', dusk: '#2a1038', duskD: '#170822',
  gold: '#ffd166', mint: '#5ee6c8', paper: '#f3e2c0', shade: '#c9a878', pink: '#ff9ab8', lav: '#c9b0ff',
  proj: '#fff1c9', lip: '#ff3b8a', pumpkin: '#ff7a1a', red: '#c8283c',
};
const F = (w, s, it = '') => `${it}${w} ${s}px Nunito, "Trebuchet MS", sans-serif`;
const nowT = () => performance.now() / 1000;
const easeOutBack = k => { const c = 1.6; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
const easeOutCubic = k => 1 - (1 - k) ** 3;
const easeInCubic = k => k * k * k;

// Короткая «цепляющая» строка карточки (над описанием)
export const OFFER_PUNCH = {
  might: 'Бей больнее!', hp: 'Запас карман не тянет', haste: 'Пиу-пиу — чаще!', speed: 'Ноги в руки!',
  growth: 'Дорогой дневник: я качаюсь', magnet: 'Всё ко мне!', luck: 'Фортуна в сумочке', reroll: 'Не та карта? Сдай заново!',
  greed: 'Сладкий вклад', v_slow: 'Время — тянучка', v_popper: 'Бах — и чисто!', v_magnet: 'Конфеты сами липнут',
  v_double: 'Два сеанса по цене одного', v_lipstick: 'Не трожь — я в образе', v_golden: 'Лови золотце!',
  v_rain: 'Осадки: сладкие', v_festival: 'Тыквы звенят громче',
};
const QUIPS_DEATH = ['Умерла — не повод уйти без покупок.', 'Смерть — это антракт. Буфет открыт!', 'Ну хоть шопинг не отменили.',
  'Падать больно. Выбирать — приятно.', 'Конфеты есть — значит, не зря лежала.', 'Тактическое лежание окупилось!'];
const QUIPS_CLEAR = ['Победа — повод для шопинга!', 'Заслужила. Беру всё… ну, что по карману.', 'Сеанс окончен. Буфет — открыт!'];

// ---------- мелкие помощники рисования ----------
function inkFill(ctx, fill, lw = 3) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
function gloss(ctx, x, y, rx, ry, rot = -0.5, a = 0.6) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.restore(); }
function heartPath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.4, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
}
function spark4(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
function twinkle(ctx, x, y, r, t, ph, color = C.proj) { const k = 0.5 + 0.5 * Math.sin(t * 5 + ph); if (k > 0.15) spark4(ctx, x, y, r * (0.4 + 0.6 * k), color); }
function star5(ctx, x, y, r, fill, lw = 2) { ctx.save(); ctx.translate(x, y); star(ctx, r); inkFill(ctx, fill, lw); ctx.restore(); }
function diamond(ctx, x, y, s, fill) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); inkFill(ctx, fill, 2); gloss(ctx, x - s * 0.2, y - s * 0.4, s * 0.15, s * 0.3, 0.4, 0.7); }
function speedLines(ctx, pts, color = 'rgba(255,241,201,0.75)') { ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); for (const [x1, y1, x2, y2] of pts) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); } ctx.stroke(); }
function horseshoe(ctx, col, tip) {
  ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(-18, 18); ctx.lineTo(-18, 0); ctx.arc(0, 0, 18, Math.PI, 0); ctx.lineTo(18, 18);
  ctx.lineWidth = 20; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 14; ctx.strokeStyle = col; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-25.5, 9, 15, 12, 2); inkFill(ctx, tip, 2.5);
  ctx.beginPath(); ctx.roundRect(10.5, 9, 15, 12, 2); inkFill(ctx, tip, 2.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 19, Math.PI * 1.12, Math.PI * 1.42); ctx.stroke();
}
function miniTicket(ctx, x, y, w, h, rot, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 4); inkFill(ctx, fill, 2.5);
  ctx.fillStyle = C.velvet; ctx.beginPath(); ctx.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, 10, h - 3, [3, 0, 0, 3]); ctx.fill();
  ctx.fillStyle = 'rgba(243,226,192,0.8)'; for (let yy = -h / 2 + 5; yy < h / 2 - 2; yy += 6) ctx.fillRect(-w / 2 + 11, yy, 1.5, 3);
  ctx.restore();
}

// ---------- 17 иллюстраций (единицы: медальон радиусом ~47) ----------
const ICONS = {
  might(ctx, t) {   // боксёрская перчатка с ударом
    speedLines(ctx, [[-44, -8, -34, -8], [-46, 4, -34, 4], [-42, 16, -34, 16]]);
    ctx.save(); ctx.translate(Math.sin(t * 7) * 1.5, 0); ctx.rotate(-0.12);
    ctx.beginPath(); ctx.roundRect(-31, -15, 17, 32, 5); inkFill(ctx, C.proj);
    ctx.fillStyle = C.gold; ctx.fillRect(-26, -13, 5, 28);
    ctx.beginPath(); ctx.moveTo(-15, -15); ctx.bezierCurveTo(-8, -30, 26, -31, 30, -7); ctx.bezierCurveTo(33, 12, 20, 22, 4, 20); ctx.lineTo(-15, 18); ctx.closePath(); inkFill(ctx, '#ff4d6d');
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.bezierCurveTo(-5, 17, 14, 18, 18, 7); ctx.bezierCurveTo(12, 2, 0, 1, -7, 5); inkFill(ctx, '#e8355a', 2.5);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(19, -19); ctx.quadraticCurveTo(24, -7, 19, 3); ctx.stroke();
    gloss(ctx, 2, -17, 11, 4, -0.15, 0.55);
    ctx.restore();
    star5(ctx, 33, -26, 10, C.gold); twinkle(ctx, 38, 10, 5, t, 1);
  },
  hp(ctx, t) {      // запасные трусики с сердечком и «+1»
    const b = Math.sin(t * 3) * 1.5;
    drawPanties(ctx, -2, 6 + b, 1.75, { color: C.pink, rim: INK });
    heartPath(ctx, -2, 2 + b, 7); inkFill(ctx, C.lip, 1.8);
    gloss(ctx, -18, -6 + b, 6, 2.5, -0.1, 0.6);
    ctx.beginPath(); ctx.arc(26, -22, 12, 0, TAU); inkFill(ctx, C.mint, 2.5);
    ctx.fillStyle = INK; ctx.font = F(900, 13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+1', 26, -21);
  },
  haste(ctx, t) {   // кофе с молнией и паром
    ctx.strokeStyle = 'rgba(255,241,201,0.85)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); for (let j = 0; j <= 8; j++) { const yy = -14 - j * 3, xx = k * 9 + Math.sin(j * 0.9 + t * 6 + k) * 3; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 27, 31, 6, 0, 0, TAU); inkFill(ctx, C.proj);
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(23, 5, 8, -1.3, 1.3); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = C.pink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.lineTo(17, 21); ctx.quadraticCurveTo(0, 28, -17, 21); ctx.closePath(); inkFill(ctx, C.pink);
    ctx.beginPath(); ctx.ellipse(0, -8, 22, 5, 0, 0, TAU); inkFill(ctx, '#6b3a1a', 2.5);
    ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(-7, 10); ctx.lineTo(-1, 10); ctx.lineTo(-5, 21); ctx.lineTo(8, 6); ctx.lineTo(2, 6); ctx.lineTo(7, -1); ctx.closePath(); inkFill(ctx, C.gold, 2);
    gloss(ctx, -14, 2, 2.5, 7, 0.1, 0.5);
  },
  speed(ctx, t) {   // кроссовок в прыжке
    speedLines(ctx, [[-46, -12, -36, -12], [-48, -2, -38, -2]]);
    ctx.fillStyle = 'rgba(243,226,192,0.5)'; ctx.beginPath(); ctx.arc(-38, 16, 5, 0, TAU); ctx.arc(-45, 10, 3.5, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(2, -Math.abs(Math.sin(t * 6)) * 3); ctx.rotate(-0.08);
    ctx.beginPath(); ctx.roundRect(-33, 9, 68, 11, 5.5); inkFill(ctx, C.proj);
    ctx.beginPath(); ctx.moveTo(-31, 11); ctx.lineTo(-30, -10); ctx.quadraticCurveTo(-22, -17, -14, -12); ctx.lineTo(-7, -23);
    ctx.quadraticCurveTo(0, -26, 4, -19); ctx.lineTo(10, -7); ctx.quadraticCurveTo(31, -5, 34, 10); ctx.closePath(); inkFill(ctx, '#ff5d8f');
    ctx.beginPath(); ctx.moveTo(18, -6); ctx.quadraticCurveTo(31, -3, 34, 10); ctx.lineTo(16, 10); ctx.quadraticCurveTo(13, 2, 18, -6); inkFill(ctx, C.proj, 2);
    ctx.strokeStyle = C.mint; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-25, 4); ctx.quadraticCurveTo(-6, 9, 11, -3); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(4, -11); ctx.moveTo(-3, -8); ctx.lineTo(8, -5); ctx.stroke();
    gloss(ctx, -22, -6, 3, 6, 0.2, 0.45);
    ctx.restore();
  },
  growth(ctx, t) {  // дневник с сердечком и стрелкой вверх
    ctx.save(); ctx.rotate(-0.12);
    ctx.beginPath(); ctx.roundRect(-20, -27, 45, 57, 5); inkFill(ctx, C.proj);
    ctx.strokeStyle = C.shade; ctx.lineWidth = 1.2; ctx.beginPath(); for (let yy = -22; yy < 28; yy += 4) { ctx.moveTo(21, yy); ctx.lineTo(24, yy); } ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-25, -30, 44, 58, 6); inkFill(ctx, '#c85aa0');
    ctx.fillStyle = '#8e3a7a'; ctx.fillRect(-23.5, -28.5, 7, 55);
    heartPath(ctx, 3, -4, 10); inkFill(ctx, C.gold, 2);
    ctx.beginPath(); ctx.roundRect(13, -8, 12, 14, 3); inkFill(ctx, C.gold, 2); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(19, -2, 2, 0, TAU); ctx.fill();
    gloss(ctx, -6, -22, 9, 3, -0.1, 0.4);
    ctx.restore();
    const b = Math.sin(t * 4) * 2;
    ctx.save(); ctx.translate(30, -18 + b);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, -2); ctx.lineTo(4, -2); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-4, -2); ctx.lineTo(-10, -2); ctx.closePath(); inkFill(ctx, C.mint, 2.5);
    ctx.restore();
    twinkle(ctx, -34, 22, 6, t, 0.5); twinkle(ctx, 34, 20, 5, t, 2.2);
  },
  magnet(ctx, t) {  // красный магнит тянет кристаллы опыта
    ctx.save(); ctx.translate(0, -10); horseshoe(ctx, '#ff4d6d', '#e8eef6'); ctx.restore();
    ctx.strokeStyle = 'rgba(94,230,200,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.moveTo(-18, 14); ctx.quadraticCurveTo(-16, 24, -12, 28); ctx.moveTo(18, 14); ctx.quadraticCurveTo(16, 24, 10, 30); ctx.stroke(); ctx.setLineDash([]);
    const b = Math.sin(t * 5) * 2;
    diamond(ctx, -14, 32 - b, 7, C.mint); diamond(ctx, 4, 36 + b * 0.5, 6, C.mint); diamond(ctx, 20, 28 - b * 0.7, 5.5, C.mint);
  },
  luck(ctx, t) {    // четырёхлистник
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(6, 24, 18, 34);
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#2fa36b'; ctx.stroke();
    ctx.save(); ctx.rotate(Math.sin(t * 2) * 0.06);
    for (let k = 0; k < 4; k++) {
      ctx.save(); ctx.rotate(k * Math.PI / 2 + Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-17, -6, -21, -27, -8, -27); ctx.bezierCurveTo(-2, -27, 0, -21, 0, -18);
      ctx.bezierCurveTo(0, -21, 2, -27, 8, -27); ctx.bezierCurveTo(21, -27, 17, -6, 0, 0); inkFill(ctx, '#4fd39a', 2.5);
      ctx.strokeStyle = '#2fa36b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -16); ctx.stroke();
      gloss(ctx, -8, -20, 4, 2.2, -0.4, 0.5);
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); inkFill(ctx, C.gold, 1.5);
    twinkle(ctx, 30, -28, 7, t, 0, C.gold); twinkle(ctx, -32, 24, 5, t, 2);
  },
  reroll(ctx, t) {  // две карты и круговые стрелки
    ctx.save(); ctx.rotate(t * 0.8);
    for (let k = 0; k < 2; k++) {
      ctx.save(); ctx.rotate(k * Math.PI);
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 36, -0.35, 1.9);
      ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = C.mint; ctx.stroke();
      const a = 1.9, hx = Math.cos(a) * 36, hy = Math.sin(a) * 36;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(4, -2); ctx.lineTo(-2, 9); ctx.closePath();
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-9, -4); ctx.lineTo(9, -4); ctx.closePath(); inkFill(ctx, C.mint, 2);
      ctx.restore(); ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.rotate(-0.3); ctx.beginPath(); ctx.roundRect(-20, -20, 26, 36, 4); inkFill(ctx, C.lav, 2.5);
    ctx.fillStyle = INK; ctx.font = F(900, 18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', -7, -1); ctx.restore();
    ctx.save(); ctx.translate(6, 3); ctx.rotate(0.22); ctx.beginPath(); ctx.roundRect(-13, -18, 26, 36, 4); inkFill(ctx, C.proj, 2.5);
    star5(ctx, 0, 0, 8, C.gold, 1.5); ctx.restore();
  },
  greed(ctx, t) {   // копилка-свинка, в щель падает конфета
    ctx.beginPath(); ctx.roundRect(-17, 12, 9, 11, 3); inkFill(ctx, '#e87aa0', 2.5); ctx.beginPath(); ctx.roundRect(8, 12, 9, 11, 3); inkFill(ctx, '#e87aa0', 2.5);
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-27, -2); ctx.bezierCurveTo(-38, -4, -36, -14, -31, -12); ctx.bezierCurveTo(-28, -10, -32, -6, -35, -8);
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff7aa8'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -15); ctx.lineTo(12, -28); ctx.lineTo(20, -12); ctx.closePath(); inkFill(ctx, '#ff7aa8', 2.5);
    ctx.beginPath(); ctx.ellipse(0, 1, 28, 21, 0, 0, TAU); inkFill(ctx, C.pink);
    ctx.beginPath(); ctx.ellipse(27, 4, 7, 9, 0, 0, TAU); inkFill(ctx, '#ff7aa8', 2.5);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(25, 2, 1.6, 2.4, 0, 0, TAU); ctx.ellipse(29.5, 2, 1.6, 2.4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -6, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -7, 1.1, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,59,138,0.35)'; ctx.beginPath(); ctx.ellipse(12, 6, 5, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-11, -19, 16, 4.5, 2); ctx.fill();
    gloss(ctx, -12, -8, 9, 4, -0.4, 0.5);
    const k = (t * 0.9) % 1, cy = -44 + k * 24;
    ctx.save(); ctx.globalAlpha *= k < 0.85 ? 1 : (1 - k) / 0.15; drawCandy(ctx, -3, cy, 1.25, { rot: 0.5 + k }); ctx.restore();
  },
  v_slow(ctx, t) {  // песочные часы
    const glass = () => { ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(14, -26); ctx.quadraticCurveTo(14, -6, 3, 0); ctx.quadraticCurveTo(14, 6, 14, 26); ctx.lineTo(-14, 26); ctx.quadraticCurveTo(-14, 6, -3, 0); ctx.quadraticCurveTo(-14, -6, -14, -26); ctx.closePath(); };
    ctx.save(); ctx.rotate(Math.sin(t * 1.5) * 0.08);
    glass(); ctx.fillStyle = 'rgba(201,176,255,0.3)'; ctx.fill();
    const k = (t * 0.22) % 1;
    ctx.save(); glass(); ctx.clip();
    ctx.fillStyle = C.gold; ctx.fillRect(-16, -14 + k * 13, 32, 16);
    ctx.beginPath(); ctx.moveTo(-15, 27); ctx.quadraticCurveTo(0, 18 - k * 14, 15, 27); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    glass(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -22); ctx.quadraticCurveTo(-9, -10, -4, -5); ctx.stroke();
    ctx.lineCap = 'butt'; for (const sx of [-19, 19]) { ctx.beginPath(); ctx.moveTo(sx, -27); ctx.lineTo(sx, 27); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#a8784a'; ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(-24, -35, 48, 9, 3); inkFill(ctx, C.shade, 2.5); ctx.beginPath(); ctx.roundRect(-24, 26, 48, 9, 3); inkFill(ctx, C.shade, 2.5);
    ctx.restore();
    ctx.fillStyle = C.lav; ctx.font = F(900, 12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 3); ctx.fillText('z', 32, -18); ctx.font = F(900, 9); ctx.fillText('z', 38, -27);
  },
  v_popper(ctx, t) { // хлопушка с конфетти
    const p = 1 + 0.12 * Math.sin(t * 6);
    const bits = [[12, -18, C.gold, 0.4], [24, -8, C.mint, -0.6], [6, -32, C.pink, 0.9], [26, -26, C.lav, 0.2], [34, -14, C.gold, 1.2], [18, -36, C.mint, -0.3], [34, 0, C.pink, 0.7]];
    for (const [bx, by, c, r] of bits) { ctx.save(); ctx.translate(bx * p - 8, by * p + 6); ctx.rotate(r + t * 2); ctx.fillStyle = c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    ctx.lineCap = 'round'; ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.mint; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.bezierCurveTo(4, -10, 14, -4, 16 * p, -22 * p); ctx.stroke();
    ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.moveTo(-2, 4); ctx.bezierCurveTo(14, 0, 18, 10, 32 * p, -6 * p); ctx.stroke();
    ctx.save(); ctx.translate(-12, 12); ctx.rotate(0.65);
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(-15, -6); ctx.quadraticCurveTo(0, -12, 15, -6); ctx.closePath(); inkFill(ctx, C.pink);
    ctx.save(); ctx.clip(); ctx.fillStyle = C.gold; for (let k = -2; k < 4; k++) { ctx.save(); ctx.translate(0, k * 10); ctx.rotate(-0.5); ctx.fillRect(-30, -2, 60, 4); ctx.restore(); } ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(-15, -6); ctx.quadraticCurveTo(0, -12, 15, -6); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -7, 15, 5, 0, 0, TAU); inkFill(ctx, C.velvet, 2);
    ctx.restore();
    twinkle(ctx, 30, -34, 6, t, 0.3, C.gold);
  },
  v_magnet(ctx, t) { // розовый магнит, к нему липнут конфеты
    ctx.save(); ctx.translate(-8, -8); ctx.rotate(-0.75); horseshoe(ctx, C.lip, '#fff'); ctx.restore();
    const b = Math.sin(t * 5) * 2;
    drawCandy(ctx, 22 - b, 10, 1.25, { rot: 0.6, color: C.gold }); drawCandy(ctx, 8, 28 - b, 1.15, { rot: -0.4, color: C.pink }); drawCandy(ctx, 30, 30 + b * 0.5, 1.0, { rot: 1.1, color: C.mint });
    heartPath(ctx, 30, -14, 5); inkFill(ctx, C.lip, 1.5); heartPath(ctx, -30, 26, 4); inkFill(ctx, C.pink, 1.5);
  },
  v_double(ctx, t) { // два билета «×2»
    miniTicket(ctx, -8, -8, 46, 30, -0.35, C.lav);
    ctx.save(); ctx.translate(6, 8 + Math.sin(t * 3) * 1.5); ctx.rotate(0.12);
    miniTicket(ctx, 0, 0, 52, 32, 0, C.proj);
    ctx.font = F(900, 20); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText('×2', 6, 1); ctx.fillStyle = C.velvet; ctx.fillText('×2', 6, 1);
    ctx.restore();
    twinkle(ctx, 30, -24, 7, t, 0, C.gold); twinkle(ctx, -32, 22, 5, t, 2.5, C.gold);
  },
  v_lipstick(ctx, t) { // помада «Не трожь» и поцелуй
    const g = ctx.createRadialGradient(2, -4, 2, 2, -4, 34); g.addColorStop(0, 'rgba(255,59,138,0.55)'); g.addColorStop(1, 'rgba(255,59,138,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(2, -4, 34 + Math.sin(t * 4) * 2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(6, 2); ctx.rotate(0.35);
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-8, -24); ctx.lineTo(8, -32); ctx.lineTo(8, -6); ctx.closePath(); inkFill(ctx, C.lip);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-4, -22); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-11, -8, 22, 8, 2); inkFill(ctx, C.gold, 2.5);
    ctx.beginPath(); ctx.roundRect(-12, 0, 24, 28, 4); inkFill(ctx, C.dusk);
    ctx.fillStyle = C.gold; ctx.fillRect(-10.5, 9, 21, 3);
    gloss(ctx, -6, 14, 2, 8, 0, 0.35);
    ctx.restore();
    ctx.save(); ctx.translate(-24, 20); ctx.rotate(-0.3);
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.bezierCurveTo(-6, -8, -2, -6, 0, -3); ctx.bezierCurveTo(2, -6, 6, -8, 11, 0); ctx.bezierCurveTo(5, 9, -5, 9, -11, 0); ctx.fillStyle = C.lip; ctx.fill();
    ctx.strokeStyle = '#b01a5a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(0, 2.5, 9, 0); ctx.stroke();
    ctx.restore();
    twinkle(ctx, 32, -26, 6, t, 0.8, '#fff'); twinkle(ctx, -30, -20, 4, t, 2, C.pink);
  },
  v_golden(ctx, t) { // золотая капля с короной лучей
    ctx.save(); ctx.rotate(t * 0.5); ctx.fillStyle = 'rgba(255,209,102,0.22)';
    for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -44); ctx.lineTo(5, -44); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    drawDrop(ctx, -3, 12, 17, { fill: C.gold, rim: '#b0760e', t });
    ctx.beginPath(); ctx.arc(24, 24, 11, 0, TAU); inkFill(ctx, C.velvet, 2.5);
    ctx.fillStyle = C.gold; ctx.font = F(900, 10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+25', 24, 25);
    twinkle(ctx, 22, -26, 7, t, 0); twinkle(ctx, -28, -12, 5, t, 1.8); twinkle(ctx, -26, 26, 4, t, 3.1, C.gold);
  },
  v_rain(ctx, t) {   // облачко сыплет конфеты
    for (let k = 0; k < 4; k++) {
      const q = (t * 0.8 + k * 0.29) % 1, x = -18 + k * 12, y = 2 + q * 36;
      ctx.save(); ctx.globalAlpha *= q < 0.75 ? 1 : (1 - q) / 0.25; drawCandy(ctx, x, y, 1.05, { rot: q * 3 + k, color: [C.gold, C.pink, C.mint, C.lav][k] }); ctx.restore();
    }
    const blobs = [[-15, -10, 12], [0, -18, 15], [15, -10, 12], [-6, -4, 11], [8, -4, 11]];
    ctx.fillStyle = INK; ctx.beginPath(); for (const [x, y, r] of blobs) { ctx.moveTo(x + r + 3, y); ctx.arc(x, y, r + 3, 0, TAU); } ctx.fill();
    ctx.fillStyle = '#ece2ff'; ctx.beginPath(); for (const [x, y, r] of blobs) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill();
    gloss(ctx, -6, -24, 7, 3, -0.2, 0.7);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-6, -10, 3, 0.2, Math.PI - 0.2); ctx.moveTo(9, -10); ctx.arc(6, -10, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,59,138,0.4)'; ctx.beginPath(); ctx.ellipse(-12, -5, 3.5, 2, 0, 0, TAU); ctx.ellipse(12, -5, 3.5, 2, 0, 0, TAU); ctx.fill();
  },
  v_festival(ctx, t) { // тыква-фонарь и колокольчик
    drawPumpkin(ctx, -4, 10, 25, { t });
    ctx.save(); ctx.translate(24, -30); ctx.rotate(Math.sin(t * 5) * 0.35);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 18); ctx.quadraticCurveTo(-9, 2, 0, 2); ctx.quadraticCurveTo(9, 2, 9, 18); ctx.lineTo(11, 21); ctx.lineTo(-11, 21); ctx.closePath(); inkFill(ctx, C.gold, 2.5);
    ctx.beginPath(); ctx.arc(0, 23, 3, 0, TAU); inkFill(ctx, '#b0760e', 1.5);
    gloss(ctx, -4, 9, 2, 5, 0.2, 0.6);
    ctx.restore();
    twinkle(ctx, -32, -22, 6, t, 0.4, C.gold); twinkle(ctx, 36, 6, 4, t, 2.4);
  },
};

// Значок-иллюстрация предмета Косметички: медальон цвета типа + свой рисунок. size — диаметр в px.
// o.t — время для анимации, o.bare — без медальона
export function drawMetaIcon(ctx, id, x, y, size = 40, o = {}) {
  const m = byId(id), power = isPower(id), rare = !!m?.rare, t = o.t ?? nowT(), s = size / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (!o.bare) {
    if (rare) { ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(255,209,102,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill(); ctx.restore(); }
    const g = ctx.createRadialGradient(-14, -18, 4, 0, 0, 50);
    if (power) { g.addColorStop(0, '#b0243a'); g.addColorStop(1, C.velvetD); } else { g.addColorStop(0, '#4a2266'); g.addColorStop(1, C.duskD); }
    ctx.beginPath(); ctx.arc(0, 0, 47, 0, TAU); ctx.fillStyle = g; ctx.fill();
    if (rare) {   // лучи за рисунком
      ctx.save(); ctx.clip(); ctx.rotate(t * 0.4); ctx.fillStyle = 'rgba(255,209,102,0.13)';
      for (let k = 0; k < 10; k++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -50); ctx.lineTo(8, -50); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    ctx.lineWidth = rare ? 6 : 4.5; ctx.strokeStyle = rare ? C.gold : power ? '#ffd166' : C.mint; ctx.beginPath(); ctx.arc(0, 0, 47, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,241,201,0.22)'; ctx.beginPath(); ctx.arc(0, 0, 41, 0, TAU); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  (ICONS[id] || ICONS.might)(ctx, t);
  ctx.restore();
}

// ---------- карточка предложения (общая для меню и экрана итогов) ----------
const tierColors = id => isRare(id) ? { glow: C.gold, parts: [C.gold, C.proj, '#ffb020', C.pink, '#fff'] }
  : isPower(id) ? { glow: '#ff7a9a', parts: [C.pink, C.gold, C.proj, '#ff5d8f'] }
  : { glow: C.mint, parts: [C.mint, C.lav, C.proj, C.pink] };
function cardBody(ctx, x, y, w, h, rare, t) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12);
  if (rare) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.35, '#ffd875'); g.addColorStop(0.6, '#f2b84a'); g.addColorStop(1, '#ffe9a8');
    ctx.fillStyle = g;
  } else { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fbefd6'); g.addColorStop(1, '#e8d0a4'); ctx.fillStyle = g; }
  ctx.fill();
}
// диагональная полоса блика (k 0..1 — проход слева направо)
function sweep(ctx, x, y, w, h, k, a = 0.55, bw = 46) {
  const cx = x - 60 + k * (w + 120);
  const g = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.translate(cx, y + h / 2); ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.translate(-cx, -(y + h / 2));
  ctx.fillStyle = g; ctx.fillRect(cx - bw, y - 20, bw * 2, h + 40); ctx.restore();
}
function wrapLines(ctx, s, maxW) {
  const words = s.split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function fitFont(ctx, s, weight, size, maxW, it = '') { ctx.font = F(weight, size, it); const w = ctx.measureText(s).width; if (w > maxW) ctx.font = F(weight, Math.max(9, Math.floor(size * maxW / w)), it); }
function stampKUPLENO(ctx, cx, cy, k, big) {
  const sc = k < 1 ? 2.4 - 1.4 * easeOutBack(Math.min(1, k)) : 1, a = Math.min(1, k * 4);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.2); ctx.scale(sc * (big ? 1 : 0.8), sc * (big ? 1 : 0.8)); ctx.globalAlpha *= a;
  ctx.strokeStyle = '#d0203a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-84, -25, 168, 50, 9); ctx.stroke();
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(-77, -18, 154, 36, 6); ctx.stroke();
  ctx.font = F(900, 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d0203a'; ctx.fillText('КУПЛЕНО!', 0, 2);
  ctx.restore();
}

// btn(label, x, y, w, h, opts) → true при нажатии. o: { t, shine 0..1, flash 0..1, stamp 0..1+, noBtn, hover }
// Высокая карточка (h ≥ 170) — крупная раскладка с иллюстрацией, броской строкой и корешком цены; низкая — компактная (меню).
export function drawOfferCard(ctx, save, id, x, y, w, h, btn, i, o = {}) {
  const m = byId(id); if (!m) return false;
  const power = isPower(id), price = offerPrice(save, id), r = save.meta[id] || 0, rare = !!m.rare;
  const t = o.t ?? nowT(), big = h >= 170, can = save.candies >= price, tc = tierColors(id);
  let res = false;
  ctx.save();
  // ореол
  if (o.glow > 0) {
    ctx.save(); ctx.globalAlpha *= o.glow; ctx.shadowColor = tc.glow; ctx.shadowBlur = rare ? 34 : 22;
    ctx.fillStyle = tc.glow; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 12); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 6, w, h, 12); ctx.fill();
  cardBody(ctx, x, y, w, h, rare, t);
  // фольга: бегущий блеск и искорки; блик раскрытия
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
  if (rare) {
    const k = ((t * 0.42 + i * 0.31) % 1.5) / 1.2; if (k <= 1) sweep(ctx, x, y, w, h, k, 0.6, 38);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff'; for (let k2 = 0; k2 < 7; k2++) ctx.fillRect(x + ((k2 * 53 + t * 12) % (w + 30)) - 20, y, 2, h);
    ctx.globalAlpha = 1;
    for (let k2 = 0; k2 < 5; k2++) twinkle(ctx, x + 20 + ((k2 * 97) % (w - 40)), y + 34 + ((k2 * 61) % (h - 60)), 5, t, k2 * 1.7, '#fff');
  }
  if (o.shine != null && o.shine >= 0 && o.shine <= 1) sweep(ctx, x, y, w, h, o.shine, 0.75, 52);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12);
  if (rare) { ctx.lineWidth = 3.5; ctx.strokeStyle = '#c8901a'; ctx.stroke(); ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 9); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
  else { ctx.lineWidth = 2; ctx.strokeStyle = C.shade; ctx.stroke(); }
  // лента типа с перфорацией
  const rh = big ? 28 : 24;
  ctx.fillStyle = power ? C.velvet : C.dusk; ctx.beginPath(); ctx.roundRect(x, y, w, rh, [12, 12, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(243,226,192,0.45)'; for (let px = x + 12; px < x + w - 10; px += 14) ctx.fillRect(px, y + 3, 7, 4);
  ctx.font = F(900, big ? 13 : 12); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = power ? C.gold : C.mint; ctx.fillText(power ? 'СИЛА' : 'РАЗНООБРАЗИЕ', x + 12, y + rh / 2 + 3);
  let right = x + w - 12;
  if (power) { for (let k = m.max - 1; k >= 0; k--) { ctx.fillStyle = k < r ? C.gold : 'rgba(243,226,192,0.3)'; ctx.beginPath(); ctx.roundRect(right - 10, y + rh / 2, 10, 6, 2); ctx.fill(); right -= 14; } right -= 4; }
  if (rare) { ctx.fillStyle = C.gold; ctx.textAlign = 'right'; ctx.font = F(900, big ? 13 : 12); ctx.fillText('★ РЕДКОЕ', right, y + rh / 2 + 3); ctx.textAlign = 'left'; }
  const bought = o.stamp != null;
  if (big) {
    drawMetaIcon(ctx, id, x + 50, y + rh + 44, 78, { t });
    if (rare) {   // значок-розетка «★» на медальоне
      ctx.save(); ctx.translate(x + 80, y + rh + 14); ctx.rotate(Math.sin(t * 2) * 0.15);
      ctx.fillStyle = C.gold; ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, rr = k % 2 ? 11 : 13.5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); inkFill(ctx, C.gold, 1.8);
      star5(ctx, 0, 0, 7.5, '#fff6d8', 1.3); ctx.restore();
    }
    const tx = x + 98, tw = w - 108;
    ctx.fillStyle = C.ink; fitFont(ctx, m.name, 900, 18, tw); ctx.fillText(m.name, tx, y + rh + 20);
    ctx.font = F(800, 13, 'italic '); ctx.fillStyle = rare ? '#9a4a00' : power ? '#a01828' : '#6b2fa3';
    const pl = wrapLines(ctx, OFFER_PUNCH[id] || '', tw).slice(0, 2); pl.forEach((ln, k) => ctx.fillText(ln, tx, y + rh + 42 + k * 15));
    ctx.font = F(700, 12.5); ctx.fillStyle = '#5a3020';
    wrapLines(ctx, m.desc, w - 28).slice(0, 3).forEach((ln, k) => ctx.fillText(ln, x + 14, y + rh + 92 + k * 14));
    // линия отрыва и корешок цены
    const by = y + h - 40;
    ctx.strokeStyle = rare ? 'rgba(120,70,0,0.45)' : 'rgba(58,26,16,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x + 10, by - 6); ctx.lineTo(x + w - 10, by - 6); ctx.stroke(); ctx.setLineDash([]);
    if (!bought) {
      const sw = 84, sx = x + w - sw - 12, sy = by + 4, sh = 30;
      if (can) { ctx.save(); ctx.shadowColor = C.mint; ctx.shadowBlur = 10 + 6 * Math.sin(t * 5); ctx.fillStyle = C.gold; ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = can ? C.gold : C.red; ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 6); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = can ? 'rgba(58,26,16,0.35)' : 'rgba(255,230,239,0.4)'; for (let yy = sy + 4; yy < sy + sh - 3; yy += 5) ctx.fillRect(sx + 6, yy, 1.5, 2.5);
      drawCandy(ctx, sx + 22, sy + sh / 2 + 2, 1.15, { color: can ? '#ff9ab8' : C.gold });
      ctx.font = F(900, 18); ctx.textAlign = 'center'; ctx.fillStyle = can ? C.ink : '#fff'; ctx.fillText(String(price), sx + 56, sy + sh / 2 + 3);
      // подпись над корешком
      // плашка над корешком: «хватает!» (светится) или «нужно ещё N»
      const lbl = can ? 'хватает!' : `нужно ещё ${price - save.candies}`;
      ctx.font = F(900, 11); ctx.textAlign = 'center'; const lw = ctx.measureText(lbl).width + 14, ly = sy - 2;
      ctx.save(); if (can) { ctx.shadowColor = C.mint; ctx.shadowBlur = 8 + 5 * Math.sin(t * 5); }
      ctx.fillStyle = can ? C.mint : '#ffe0e4'; ctx.beginPath(); ctx.roundRect(sx + sw / 2 - lw / 2, ly - 8, lw, 15, 7.5); ctx.fill(); ctx.restore();
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(sx + sw / 2 - lw / 2, ly - 8, lw, 15, 7.5); ctx.stroke();
      ctx.fillStyle = can ? '#0b4a3c' : '#b01a30'; ctx.fillText(lbl, sx + sw / 2, ly);
      ctx.textAlign = 'left';
      if (!o.noBtn) res = btn(can ? 'Купить!' : 'Не хватает', x + 12, sy, w - sw - 36, sh, { disabled: !can, i, color: rare ? '#d4891a' : power ? '#b0243a' : '#6b2fa3' });
    }
  } else {
    drawMetaIcon(ctx, id, x + 30, y + 58, 46, { t });
    ctx.fillStyle = C.ink; fitFont(ctx, m.name, 900, 16, w - 68); ctx.fillText(m.name, x + 58, y + 46);
    ctx.font = F(700, 12); ctx.fillStyle = '#5a3020';
    wrapLines(ctx, m.desc, w - 68).slice(0, 3).forEach((ln, k) => ctx.fillText(ln, x + 58, y + 64 + k * 14));
    if (!bought && !o.noBtn) res = btn(`купить · ${price}`, x + 12, y + h - 36, w - 24, 28, { disabled: !can, i });
  }
  if (o.flash > 0) { ctx.save(); ctx.globalAlpha *= o.flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.restore(); }
  if (bought) stampKUPLENO(ctx, x + w / 2, y + h - (big ? 34 : 30), o.stamp, big);
  ctx.restore();
  return res;
}

// Рубашка карточки (до переворота): бархат / сумрак, у редкой — золото, чтобы предвкушение было видно заранее
export function drawOfferBack(ctx, id, x, y, w, h, t = nowT()) {
  const rare = isRare(id), power = isPower(id);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 6, w, h, 12); ctx.fill();
  if (rare) cardBody(ctx, x, y, w, h, true, t);
  else { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, power ? '#9a1424' : '#3e1a52'); g.addColorStop(1, power ? C.velvetD : C.duskD); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); }
  const ac = rare ? '#a86a00' : power ? C.gold : C.mint;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
  ctx.globalAlpha = 0.09; ctx.fillStyle = rare ? '#fff' : ac; for (let k = -h; k < w; k += 18) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.lineTo(x + k + h + 7, y); ctx.lineTo(x + k + 7, y + h); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.fillStyle = rare ? 'rgba(120,70,0,0.35)' : 'rgba(243,226,192,0.3)';
  for (let px = x + 12; px < x + w - 10; px += 14) { ctx.fillRect(px, y + 5, 7, 4); ctx.fillRect(px, y + h - 9, 7, 4); }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = ac; ctx.beginPath(); ctx.roundRect(x + 9, y + 15, w - 18, h - 30, 8); ctx.stroke();
  const cx = x + w / 2, cy = y + h / 2 - 6;
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fillStyle = rare ? 'rgba(255,255,255,0.35)' : 'rgba(14,6,18,0.45)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ac; ctx.stroke();
  ctx.font = F(900, 42); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rare ? '#a86a00' : ac; ctx.fillText(rare ? '★' : '?', cx, cy + 2);
  ctx.font = F(900, 11); ctx.fillStyle = rare ? '#7a4a00' : 'rgba(243,226,192,0.75)'; ctx.fillText(rare ? 'РЕДКОЕ!' : 'КОСМЕТИЧКА · СЕАНС', cx, cy + 50);
  if (rare) for (let k = 0; k < 4; k++) twinkle(ctx, x + 30 + k * (w - 60) / 3, y + 34 + (k % 2) * (h - 80), 6, t, k * 1.3, '#fff');
  ctx.restore();
}

// Банка конфет (итоги забега)
export function drawCandyJar(ctx, x, y, fill = 0.5, pulse = 0) {
  const s = 1 + 0.18 * pulse;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, 2 - s);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-16, -13, 32, 32, 9); ctx.clip();
  const lv = 19 - 30 * Math.min(1, Math.max(0.12, fill)), cols = [C.gold, C.pink, C.mint, C.lav, '#ff7a1a'];
  for (let k = 0; k < 14; k++) { const cx = -12 + (k * 7) % 26, cy = 16 - Math.floor(k / 4) * 7; if (cy < lv) continue; ctx.fillStyle = cols[k % 5]; ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,241,201,0.14)'; ctx.beginPath(); ctx.roundRect(-16, -13, 32, 32, 9); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = C.proj; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, -7); ctx.lineTo(-11, 8); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-13, -20, 26, 8, 3); inkFill(ctx, C.gold, 2);
  ctx.restore();
}
// Косметичка-сумочка (куда улетают купленные карточки)
export function drawCosmeticBag(ctx, x, y, pulse = 0) {
  const s = 1 + 0.25 * pulse;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(pulse * 12) * 0.1 * pulse);
  ctx.beginPath(); ctx.moveTo(-20, -6); ctx.quadraticCurveTo(-21, 14, -16, 15); ctx.lineTo(16, 15); ctx.quadraticCurveTo(21, 14, 20, -6); ctx.quadraticCurveTo(0, -13, -20, -6); ctx.closePath(); inkFill(ctx, '#ff7aa8', 2.5);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.setLineDash([2.5, 2]); ctx.beginPath(); ctx.moveTo(-17, -6); ctx.quadraticCurveTo(0, -11, 17, -6); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.roundRect(10, -11, 5, 9, 2); inkFill(ctx, C.gold, 1.5);
  heartPath(ctx, 0, 4, 5); inkFill(ctx, C.lip, 1.5);
  gloss(ctx, -12, 0, 2.5, 6, 0.1, 0.45);
  ctx.restore();
}

// ======================================================================================================
// Раскрытие витрины: счёт конфет в банку → карточки по одной (рубашкой вверх, переворот, вспышка, конфетти,
// ореол, блик) → покупка: штамп, конфеты из банки, карточка улетает в косметичку. Всё ~1,6 с, клик/Enter — сразу в конец.
// Время rv.r — «время раскрытия» (секунды), пропуск просто перематывает его вперёд.
// ======================================================================================================
const FLY = 0.26, FLIP = 0.16, SHINE = 0.5, CARD0 = 0.3, GAP = 0.2, COUNT = 0.55;
// портрет: карточки раскрываются по одной по центру экрана (вылет → переворот → пауза → полёт на своё место в столбике)
const CARD0P = 0.35, GAPP = 0.55, P_FLY = 0.3, P_FLIP = 0.18, P_HOLD = 0.2, P_GLIDE = 0.3, P_TOT = P_FLY + P_FLIP + P_HOLD + P_GLIDE;
export const CARD_W = 282, CARD_H = 210;

export function revealStart(save, o = {}) {
  const offers = (save.offers || []).slice();
  const rv = { r: 0, boost: 0, mode: o.mode || 'death', earned: Math.max(0, o.earned || 0), gift: o.gift && o.gift.n > 0 ? o.gift : null, jar: o.jar || null, bag: o.bag || { x: 914, y: 212 },
    quip: (o.mode === 'clear' ? QUIPS_CLEAR : QUIPS_DEATH)[Math.floor(Math.random() * (o.mode === 'clear' ? QUIPS_CLEAR : QUIPS_DEATH).length)],
    fx: [], slots: offers.map((id, k) => ({ id, s: o.portrait ? CARD0P + k * GAPP : CARD0 + k * GAP })), emptyS: CARD0, fired: {}, jarPulse: -9, bagPulse: -9, jarDisp: null, run: o.run, p: !!o.portrait };
  // летящие в банку конфеты
  if (rv.jar && rv.earned > 0) {
    const n = Math.min(12, 3 + Math.floor(rv.earned / 6));
    for (let k = 0; k < n; k++) rv.fx.push({ kind: 'fly', t0: 0.04 + k * 0.035, dur: 0.3, x0: (o.flyFrom ? o.flyFrom.x : 590) + Math.random() * 30, y0: o.flyFrom ? o.flyFrom.y : 132, x1: rv.jar.x, y1: rv.jar.y - 6, arc: 26 + Math.random() * 20, color: [C.gold, C.pink, C.mint][k % 3], arrive: 'jar', idx: k, n });
  }
  return rv;
}
const revealEnd = rv => Math.max(COUNT, ...rv.slots.map(s => s.s + (rv.p ? P_TOT : FLY + FLIP)), rv.slots.length ? 0 : rv.emptyS + FLY);
export const revealDone = rv => !!rv && rv.r >= revealEnd(rv);
// now — время с начала раскрытия (с), например G.phaseT − задержка
export function revealTick(rv, now) {
  const prev = rv.r; rv.r = Math.max(prev, now + rv.boost); rv.dt = rv.r - prev;
}
export function revealSkip(rv) {
  const end = revealEnd(rv); if (rv.r >= end) return;
  rv.boost += end - rv.r; rv.r = end; rv.skipped = true;
  sfx('pop', { pitch: 1.2 });
  for (const sl of rv.slots) if (sl.cx != null && !sl.bought) burst(rv, sl.cx, sl.cy, sl.id, 0.45);
}
// отметить покупку (вызывать после успешного buyOffer)
export function revealBought(rv, id, from) {
  const sl = rv.slots.find(s => s.id === id && !s.bought); if (!sl) return;
  sl.bought = rv.r;
  const jx = rv.jar ? rv.jar.x : (from?.x ?? 480), jy = rv.jar ? rv.jar.y : (from?.y ?? 40);
  for (let k = 0; k < 12; k++) rv.fx.push({ kind: 'fly', t0: rv.r + k * 0.022, dur: 0.32, x0: jx, y0: jy - 8, x1: (sl.cx ?? 480) + (Math.random() - 0.5) * 120, y1: (sl.cy ?? 300) + 40 + (Math.random() - 0.5) * 30, arc: 50 + Math.random() * 40, color: [C.gold, C.pink, C.mint][k % 3], arrive: 'card' });
  rv.jarPulse = rv.r;
  setTimeout(() => sfx('thud', { pitch: 1.5 }), 120);
}

function burst(rv, x, y, id, mul = 1) {
  const tc = tierColors(id), rare = isRare(id), t0 = rv.r;
  const nc = Math.round((rare ? 46 : 26) * mul), ns = Math.round((rare ? 22 : 12) * mul);
  for (let k = 0; k < nc; k++) { const a = Math.random() * TAU, sp = 140 + Math.random() * (rare ? 330 : 240); rv.fx.push({ kind: 'conf', t0, life: 0.9 + Math.random() * 0.6, x, y: y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 520, drag: 1.6, size: 3 + Math.random() * 3, color: tc.parts[k % tc.parts.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 16 }); }
  for (let k = 0; k < ns; k++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 200; rv.fx.push({ kind: 'spark', t0, life: 0.45 + Math.random() * 0.4, x: x + (Math.random() - 0.5) * 120, y: y + (Math.random() - 0.5) * 120, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp * 0.4 - 30, g: 0, drag: 2, size: 5 + Math.random() * (rare ? 9 : 6), color: k % 3 ? '#fff' : tc.glow }); }
  rv.fx.push({ kind: 'ring', t0, life: 0.4, x, y, size: 40, size2: rare ? 175 : 135, color: tc.glow, a: 0.7 });
  if (rare) rv.fx.push({ kind: 'ring', t0: t0 + 0.08, life: 0.45, x, y, size: 30, size2: 200, color: '#fff', a: 0.6 });
}
function fxPos(p, dt) {
  const d = p.drag || 0, f = d ? (1 - Math.exp(-d * dt)) / d : dt;
  return [p.x + p.vx * f, p.y + p.vy * f + 0.5 * (p.g || 0) * dt * dt];
}
function drawFx(ctx, rv) {
  const r = rv.r;
  for (let n = rv.fx.length - 1; n >= 0; n--) {
    const p = rv.fx[n], dt = r - p.t0;
    if (dt < 0) continue;
    if (p.kind === 'fly') {
      const k = Math.min(1, dt / p.dur);
      if (k >= 1) {
        rv.fx.splice(n, 1);
        if (dt - p.dur < 0.15) {   // не «застарело» (после пропуска — без звуков)
          if (p.arrive === 'jar') { rv.jarPulse = r; sfx('coin', { pitch: 0.9 + 0.7 * (p.idx / Math.max(1, p.n - 1)), gap: 0.015, vol: 0.7 }); }
          else if (p.arrive === 'card') rv.fx.push({ kind: 'spark', t0: r, life: 0.3, x: p.x1, y: p.y1, vx: 0, vy: -20, size: 7, color: '#fff' });
          else if (p.arrive === 'bag') { rv.bagPulse = r; sfx('pickup', { pitch: 1.2 }); for (let k2 = 0; k2 < 10; k2++) { const a = Math.random() * TAU; rv.fx.push({ kind: 'spark', t0: r, life: 0.5, x: p.x1, y: p.y1, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, drag: 3, size: 6, color: k2 % 2 ? C.gold : C.pink }); } }
        }
        continue;
      }
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e - Math.sin(Math.PI * k) * p.arc;
      if (!p.hidden) drawCandy(ctx, x, y, 1.1, { rot: k * 8, color: p.color });
      continue;
    }
    if (dt > p.life) { rv.fx.splice(n, 1); continue; }
    const k = dt / p.life;
    ctx.save(); ctx.globalAlpha = 1 - k * k;
    if (p.kind === 'ring') { ctx.globalAlpha *= p.a ?? 1; ctx.strokeStyle = p.color; ctx.lineWidth = 5 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (p.size2 - p.size) * easeOutCubic(k), 0, TAU); ctx.stroke(); }
    else {
      const [x, y] = fxPos(p, dt);
      if (p.kind === 'conf') { ctx.translate(x, y); ctx.rotate(p.rot + p.vr * dt); ctx.scale(1, Math.cos(dt * 14 + p.rot)); ctx.fillStyle = p.color; ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9); }
      else if (p.kind === 'spark') { ctx.globalCompositeOperation = 'lighter'; spark4(ctx, x, y, p.size * (1 - k * 0.5), p.color); }
    }
    ctx.restore();
  }
}

// Заголовок, реплика Поппи, «перетасовать», косметичка, карточки, пустые места и эффекты.
// ui: { y, header, btn(label,x,y,w,h,o), shuffleBtn(x,y,w,h) → bool, inp } → { buy: id | null, shuffle: bool }
export function drawRevealOffers(ctx, rv, save, ui) {
  const out = { buy: null, shuffle: false }, r = rv.r, y = ui.y, offers = save.offers || [];
  rv._save = save;
  // витрина поменялась (перетасовка) — новые карточки раскрываются заново, быстрее
  const live = rv.slots.filter(s => !s.bought).map(s => s.id);
  if (live.length !== offers.length || offers.some(id => !live.includes(id))) {
    const keep = rv.slots.filter(s => s.bought);
    rv.slots = offers.map((id, k) => ({ id, s: r + 0.05 + k * (rv.p ? 0.4 : 0.12) }));
    if (!offers.length && keep.length) rv.slots = keep;
  }
  // --- строка заголовка ---
  const hk = Math.min(1, Math.max(0, (r - 0.1) / 0.22));
  if (hk > 0) {
    if (!rv.fired.head && r - 0.1 < 0.2) sfx('thud', { pitch: 1.3 }); rv.fired.head = true;
    ctx.save(); ctx.translate(40, y); const sc = 1.7 - 0.7 * easeOutBack(hk); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, hk * 2);
    ctx.font = F(900, 25); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = C.night; ctx.strokeText(ui.header, 0, 0);
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#fff1c9'); g.addColorStop(1, C.gold); ctx.fillStyle = g; ctx.fillText(ui.header, 0, 0);
    const hw = ctx.measureText(ui.header).width;
    ctx.restore();
    // реплика Поппи — белое облачко «say»
    const qa = Math.min(1, Math.max(0, (r - 0.25) / 0.2));
    if (qa > 0 && rv.quip) {
      ctx.save(); ctx.globalAlpha = qa; ctx.font = F(800, 14, 'italic ');
      const qx = 40 + hw + 22, qw = Math.min(ctx.measureText(rv.quip).width + 22, 660 - qx), qy = y - 14 + (1 - qa) * 6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx, qy, qw, 28, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(qx + 2, qy + 10); ctx.lineTo(qx - 9, qy + 14); ctx.lineTo(qx + 2, qy + 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(qx, qy, qw, 28, 12); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; fitFont(ctx, rv.quip, 800, 14, qw - 22, 'italic '); ctx.fillText(rv.quip, qx + 11, qy + 15);
      ctx.restore();
    }
  }
  // косметичка (сюда улетают покупки) и перетасовка
  const bagP = Math.max(0, 1 - (r - rv.bagPulse) / 0.35);
  drawCosmeticBag(ctx, rv.bag.x, rv.bag.y, bagP);
  ctx.save(); ctx.font = F(900, 9); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(243,226,192,0.75)'; ctx.fillText('косметичка', rv.bag.x, rv.bag.y + 22); ctx.restore();
  if (revealDone(rv) && offers.length === 3 && !save.offerShuffled && ui.shuffleBtn && ui.shuffleBtn(716, y - 15, 156, 30)) out.shuffle = true;

  // --- карточки ---
  const n = rv.slots.length, W = CARD_W, H = CARD_H, gap = 22, cy0 = y + 18;
  if (!n) { drawSoldOut(ctx, rv, 480, cy0 + H / 2, r - rv.emptyS); drawFx(ctx, rv); return out; }
  const x0 = 480 - (n * W + (n - 1) * gap) / 2, p = ui.inp?.pointer;
  // лучи за редкими — первым проходом, чтобы не ложились на соседние карточки
  rv.slots.forEach((sl, k) => {
    const since = r - sl.s - FLY - FLIP;
    if (sl.bought == null && since >= 0 && isRare(sl.id)) rays(ctx, x0 + k * (W + gap) + W / 2, cy0 + H / 2, r, Math.min(1, since * 3));
  });
  rv.slots.forEach((sl, k) => {
    const x = x0 + k * (W + gap), cx = x + W / 2, cyy = cy0 + H / 2; sl.cx = cx; sl.cy = cyy;
    const d = r - sl.s;
    if (sl.bought != null) { drawBoughtSlot(ctx, rv, sl, x, cy0, W, H, k); return; }
    if (d < 0) return;
    const fly = Math.min(1, d / FLY), fl = Math.min(1, Math.max(0, (d - FLY) / FLIP));
    // события: вылет, переворот (вспышка + конфетти), только если не «застарели» после пропуска
    if (!sl.f1) { sl.f1 = true; if (d < 0.15) sfx('whoosh', { pitch: 1.1 + k * 0.12, vol: 0.7 }); }
    if (!sl.f2 && d >= FLY + FLIP / 2) { sl.f2 = true; if (d - FLY - FLIP / 2 < 0.2) { burst(rv, cx, cyy, sl.id); sfx('pop', { pitch: 1 + k * 0.15 }); if (isRare(sl.id)) sfx('ach', { pitch: 1.25 }); } }
    const float = fl >= 1 ? Math.sin(r * 2.2 + k * 1.9) * 2 : 0;
    const hover = fl >= 1 && p && p.x > x && p.x < x + W && p.y > cy0 && p.y < cy0 + H;
    const lift = hover ? -5 : 0;
    if (fl < 1) {
      const e = easeOutBack(fly), sx = Math.abs(Math.cos(fl * Math.PI));
      const ox = (1 - e) * (k - (n - 1) / 2) * -60, oy = (1 - e) * 360, rot = (1 - e) * (k % 2 ? 0.35 : -0.35) + Math.sin(fl * Math.PI) * 0.04;
      ctx.save(); ctx.translate(cx + ox, cyy + oy); ctx.rotate(rot); ctx.scale(Math.max(0.02, sx) * (1 + Math.sin(fl * Math.PI) * 0.08), 1 + Math.sin(fl * Math.PI) * 0.08);
      if (fl < 0.5) drawOfferBack(ctx, sl.id, -W / 2, -H / 2, W, H, r);
      else drawOfferCard(ctx, save, sl.id, -W / 2, -H / 2, W, H, fakeBtn(ctx, ui), k, { t: r, flash: 1 - (fl - 0.5) * 2 });
      ctx.restore();
      return;
    }
    const since = d - FLY - FLIP, glow = (isRare(sl.id) ? 0.55 : 0.32) + 0.18 * Math.sin(r * 3 + k) + (hover ? 0.3 : 0) + Math.max(0, 0.6 - since * 1.5);
    const flash = Math.max(0, 0.5 - since * 3);
    const res = drawOfferCard(ctx, save, sl.id, x, cy0 + float + lift, W, H, (label, bx, by, bw, bh, o) => ui.btn(label, bx, by, bw, bh, o), k,
      { t: r, glow, shine: since / SHINE, flash });
    if (res) out.buy = sl.id;
  });
  drawFx(ctx, rv);
  return out;
}
function fakeBtn(ctx, ui) { return (label, bx, by, bw, bh, o) => { ui.btn(label, bx, by, bw, bh, { ...o, fake: true }); return false; }; }
function rays(ctx, cx, cy, t, a) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.3); ctx.globalAlpha = 0.16 * a; ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = C.gold;
  for (let k = 0; k < 12; k++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -240); ctx.lineTo(22, -240); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
// купленная карточка: штамп → пауза → полёт в косметичку → пустое место
function drawBoughtSlot(ctx, rv, sl, x, y, W, H, k) {
  const d = rv.r - sl.bought;
  if (d > 0.95) { drawEmptySlot(ctx, x, y, W, H, Math.min(1, (d - 0.95) / 0.25)); return; }
  if (d < 0.55) { drawOfferCard(ctx, rv._save, sl.id, x, y, W, H, () => false, k, { t: rv.r, stamp: d / 0.16, glow: 0.4 }); return; }
  const f = easeInCubic(Math.min(1, (d - 0.55) / 0.4)), cx = x + W / 2, cy = y + H / 2;
  if (!sl.flewToBag) { sl.flewToBag = true; rv.fx.push({ kind: 'fly', t0: rv.r + 0.4 * (1 - f), dur: 0.001, x0: rv.bag.x, y0: rv.bag.y, x1: rv.bag.x, y1: rv.bag.y, arc: 0, arrive: 'bag', color: C.gold, hidden: true }); }
  const px = cx + (rv.bag.x - cx) * f, py = cy + (rv.bag.y - cy) * f - Math.sin(Math.PI * f) * 80, sc = 1 - 0.9 * f;
  drawEmptySlot(ctx, x, y, W, H, f);
  ctx.save(); ctx.translate(px, py); ctx.rotate(f * 1.2); ctx.scale(sc, sc);
  drawOfferCard(ctx, rv._save, sl.id, -W / 2, -H / 2, W, H, () => false, k, { t: rv.r, stamp: 1 });
  ctx.restore();
}
function drawEmptySlot(ctx, x, y, W, H, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(14,6,18,0.45)'; ctx.beginPath(); ctx.roundRect(x, y, W, H, 12); ctx.fill();
  ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,154,184,0.6)'; ctx.stroke(); ctx.setLineDash([]);
  drawCosmeticBag(ctx, x + W / 2, y + H / 2 - 22, 0);
  ctx.font = F(900, 17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.pink; ctx.fillText('Уже в косметичке ✓', x + W / 2, y + H / 2 + 14);
  ctx.font = F(700, 12); ctx.fillStyle = 'rgba(243,226,192,0.7)'; ctx.fillText('новое — после следующего забега', x + W / 2, y + H / 2 + 36);
  ctx.restore();
}
// витрина пуста: билет «АНШЛАГ»
function drawSoldOut(ctx, rv, cx, cy, d) {
  if (d < 0) return;
  const e = easeOutBack(Math.min(1, d / FLY)), w = 600, h = 178;
  if (!rv.fired.empty) { rv.fired.empty = true; if (d < 0.2) sfx('whoosh'); }
  ctx.save(); ctx.translate(cx, cy + (1 - e) * 300); ctx.rotate((1 - e) * -0.2 - 0.02);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 6, w, h, 14); ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#3a1648'); g.addColorStop(1, C.duskD);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.gold; ctx.stroke();
  ctx.fillStyle = C.velvet; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, 110, h, [14, 0, 0, 14]); ctx.fill();
  ctx.fillStyle = 'rgba(243,226,192,0.4)'; for (let yy = -h / 2 + 8; yy < h / 2 - 6; yy += 10) { ctx.beginPath(); ctx.arc(-w / 2 + 110, yy, 2, 0, TAU); ctx.fill(); }
  drawCosmeticBag(ctx, -w / 2 + 55, -10, Math.max(0, Math.sin(rv.r * 3)) * 0.15);
  ctx.font = F(900, 11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.gold; ctx.fillText('РЯД 13', -w / 2 + 55, 26); ctx.fillText('МЕСТО 31', -w / 2 + 55, 40);
  ctx.save(); ctx.translate(70, -26); ctx.rotate(-0.08 + Math.sin(rv.r * 2) * 0.02);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-118, -26, 236, 52, 8); ctx.stroke();
  ctx.font = F(900, 34); ctx.fillStyle = C.gold; ctx.fillText('АНШЛАГ!', 0, 2); ctx.restore();
  ctx.font = F(800, 16); ctx.fillStyle = C.paper; ctx.fillText('Всё с витрины уже в косметичке.', 70, 28);
  ctx.font = F(700, 13); ctx.fillStyle = '#ffd0dc'; ctx.fillText('Новые предложения — после следующего забега', 70, 52);
  for (let k = 0; k < 5; k++) twinkle(ctx, -40 + k * 60, -h / 2 + 18 + (k % 2) * (h - 36), 6, rv.r, k * 1.4, C.gold);
  ctx.restore();
}

// Строка «Утешительный приз +N» (под «+N конфет за забег»): звезда, подпись и счёт; появляется после основной суммы
const GIFT_T = 0.6;
export function drawGiftLine(ctx, rv, x, y, sc = 1) {
  if (!rv || !rv.gift) return;
  const k = Math.min(1, Math.max(0, (rv.r - GIFT_T) / 0.4)); if (k <= 0) return;
  if (!rv.fired.gift) { rv.fired.gift = true; if (k < 0.5) sfx('ach', { pitch: 1.5, vol: 0.5 }); }
  const cnt = Math.round(rv.gift.n * easeOutCubic(k)), pop = 1 + 0.25 * (1 - easeOutCubic(k));
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.5); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.translate(x, y + (1 - k) * 8); ctx.scale(sc, sc);
  ctx.save(); ctx.translate(10, 0); ctx.rotate(rv.r * 2); ctx.scale(pop, pop); star5(ctx, 0, 0, 9, C.gold, 1.6); ctx.restore();
  ctx.font = F(800, 15); ctx.fillStyle = C.pink; ctx.fillText(rv.gift.label, 28, 1);
  const lw = ctx.measureText(rv.gift.label).width;
  ctx.font = F(900, 20); ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(`+${cnt}`, 28 + lw + 12, 1); ctx.fillStyle = C.gold; ctx.fillText(`+${cnt}`, 28 + lw + 12, 1);
  ctx.restore();
}

// Строка «+N конфет» со счётом и банка с итогом копилки (панель итогов забега)
export function drawRevealCandies(ctx, rv, save, x, y) {
  const k = Math.min(1, Math.max(0, (rv.r - 0.04) / COUNT)), e = easeOutCubic(k);
  const shown = Math.round(rv.earned * e);
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const pop = k < 1 ? 1 + 0.08 * Math.sin(rv.r * 40) : 1;
  drawCandy(ctx, x + 10, y, 1.4);
  ctx.save(); ctx.translate(x + 26, y); ctx.scale(pop, pop);
  ctx.font = F(900, 24); ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(`+${shown}`, 0, 1); ctx.fillStyle = C.gold; ctx.fillText(`+${shown}`, 0, 1);
  const tw = ctx.measureText(`+${rv.earned}`).width;
  ctx.restore();
  ctx.font = F(800, 15); ctx.fillStyle = '#ffe6ef'; ctx.fillText('конфет за забег', x + 34 + tw, y + 2);
  if (rv.jar) {
    const gk = rv.gift ? easeOutCubic(Math.min(1, Math.max(0, (rv.r - GIFT_T) / 0.4))) : 1;   // утешительный приз ложится в банку позже основной суммы
    const target = save.candies - Math.round(rv.earned * (1 - e)) - (rv.gift ? Math.round(rv.gift.n * (1 - gk)) : 0);
    if (rv.jarDisp == null || k < 1) rv.jarDisp = target; else rv.jarDisp += (target - rv.jarDisp) * Math.min(1, (rv.dt || 0.016) * 9);
    const pulse = Math.max(0, 1 - (rv.r - rv.jarPulse) / 0.18);
    drawCandyJar(ctx, rv.jar.x, rv.jar.y, Math.min(1, save.candies / 400), pulse);
    ctx.font = F(900, 22); ctx.textAlign = 'right'; ctx.lineWidth = 5; ctx.strokeStyle = INK;
    const s = String(Math.round(rv.jarDisp)); ctx.strokeText(s, rv.jar.x - 24, y + 1); ctx.fillStyle = C.gold; ctx.fillText(s, rv.jar.x - 24, y + 1);
    ctx.font = F(700, 11); ctx.fillStyle = 'rgba(255,230,239,0.75)'; ctx.fillText('в копилке', rv.jar.x - 24, y + 20);
  }
  ctx.restore();
}

// ======================================================================================================
// Портретная витрина (экран смерти на полном виде 540×H, death_p.js): широкая карточка предложения, раскрытие по центру экрана
// (карточка вылетает рубашкой вверх, переворачивается, конфетти — и летит на своё место в столбике), пустые и купленные слоты.
// ======================================================================================================
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
// Широкая карточка (столбик): лента типа сверху, медальон слева, название и описание, справа — высокая кнопка «Купить» с ценой в конфетах.
// o: { minF, btnH, btnW, t, glow, shine, flash, stamp }; btn(label, x, y, w, h, extra) → true при нажатии
export function drawOfferWide(ctx, save, id, x, y, w, h, btn, i, o = {}) {
  const m = byId(id); if (!m) return false;
  const power = isPower(id), price = offerPrice(save, id), r = save.meta[id] || 0, rare = !!m.rare;
  const t = o.t ?? nowT(), can = save.candies >= price, tc = tierColors(id), fs = o.minF || 17, bought = o.stamp != null;
  let res = false;
  ctx.save();
  if (o.glow > 0) { ctx.save(); ctx.globalAlpha *= o.glow; ctx.shadowColor = tc.glow; ctx.shadowBlur = rare ? 30 : 20; ctx.fillStyle = tc.glow; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 12); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 6, w, h, 12); ctx.fill();
  cardBody(ctx, x, y, w, h, rare, t);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip();
  if (rare) {
    const k = ((t * 0.42 + i * 0.31) % 1.5) / 1.2; if (k <= 1) sweep(ctx, x, y, w, h, k, 0.6, 38);
    for (let k2 = 0; k2 < 6; k2++) twinkle(ctx, x + 30 + ((k2 * 97) % (w - 60)), y + 30 + ((k2 * 61) % (h - 44)), 5, t, k2 * 1.7, '#fff');
  }
  if (o.shine != null && o.shine >= 0 && o.shine <= 1) sweep(ctx, x, y, w, h, o.shine, 0.75, 52);
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12);
  if (rare) { ctx.lineWidth = 3.5; ctx.strokeStyle = '#c8901a'; ctx.stroke(); ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 9); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
  else { ctx.lineWidth = 2; ctx.strokeStyle = C.shade; ctx.stroke(); }
  // лента типа
  const rh = fs + 11;
  ctx.fillStyle = power ? C.velvet : C.dusk; ctx.beginPath(); ctx.roundRect(x, y, w, rh, [12, 12, 0, 0]); ctx.fill();
  ctx.font = F(900, fs - 1); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = power ? C.gold : C.mint; ctx.fillText(power ? 'СИЛА' : 'РАЗНООБРАЗИЕ', x + 14, y + rh / 2 + 1);
  let right = x + w - 14;
  if (power) { for (let k = m.max - 1; k >= 0; k--) { ctx.fillStyle = k < r ? C.gold : 'rgba(243,226,192,0.3)'; ctx.beginPath(); ctx.roundRect(right - 12, y + rh / 2 - 3, 12, 7, 2); ctx.fill(); right -= 17; } right -= 4; }
  if (rare) { ctx.fillStyle = C.gold; ctx.textAlign = 'right'; ctx.font = F(900, fs - 1); ctx.fillText('★ РЕДКОЕ', right, y + rh / 2 + 1); ctx.textAlign = 'left'; }
  // медальон
  const bh = h - rh, ib = clampN(bh - 18, 56, 88), icx = x + 14 + ib / 2, icy = y + rh + bh / 2;
  drawMetaIcon(ctx, id, icx, icy, ib, { t });
  if (rare) { ctx.save(); ctx.translate(icx + ib * 0.38, icy - ib * 0.38); ctx.rotate(Math.sin(t * 2) * 0.15); ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, rr = k % 2 ? 9 : 11; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); inkFill(ctx, C.gold, 1.6); star5(ctx, 0, 0, 6, '#fff6d8', 1.2); ctx.restore(); }
  // кнопка справа (высокая, цена внутри)
  const bw = o.btnW || 122, btnH = Math.min(bh - 14, o.btnH || 56), bx = x + w - 12 - bw, by = y + rh + (bh - btnH) / 2;
  const tx = x + 14 + ib + 12, tw = bx - 10 - tx;
  fitFont(ctx, m.name, 900, 22, tw); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(m.name, tx, y + rh + 20);
  let ds = Math.min(19, fs + 2), dl; const availT = bh - 40;
  for (; ds >= fs; ds--) { ctx.font = F(700, ds); dl = wrapLines(ctx, m.desc, tw); if (dl.length * ds * 1.17 <= availT) break; }
  if (ds < fs) { ds = fs; ctx.font = F(700, ds); dl = wrapLines(ctx, m.desc, tw); }
  ctx.font = F(700, ds); ctx.fillStyle = '#5a3020'; ctx.textAlign = 'left'; dl.forEach((ln, k) => ctx.fillText(ln, tx, y + rh + 44 + k * ds * 1.17));
  if (!bought) {
    const after = (c, bw2, bh2) => {
      c.save(); c.translate(0, bh2 * 0.2); c.font = F(900, fs + 5); c.textAlign = 'left'; c.textBaseline = 'middle';
      const pw = c.measureText(String(price)).width, x0 = -(26 + pw) / 2;
      drawCandy(c, x0 + 11, 1, 1.15, { color: can ? C.gold : C.pink }); c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(String(price), x0 + 26, 2); c.fillStyle = can ? C.gold : '#ffb0b8'; c.fillText(String(price), x0 + 26, 2);
      c.restore();
    };
    res = btn(can ? 'Купить!' : 'Не хватает', bx, by, bw, btnH, { disabled: !can, i, color: rare ? '#d4891a' : power ? '#b0243a' : '#6b2fa3', size: fs + 3, dy: -btnH * 0.16, after });
  }
  if (o.flash > 0) { ctx.save(); ctx.globalAlpha *= o.flash; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.restore(); }
  if (bought) stampKUPLENO(ctx, x + w / 2, y + h / 2 + 6, o.stamp, true);
  ctx.restore();
  return res;
}
function drawEmptySlotP(ctx, x, y, W, H, a, fs) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(14,6,18,0.45)'; ctx.beginPath(); ctx.roundRect(x, y, W, H, 12); ctx.fill();
  ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,154,184,0.6)'; ctx.stroke(); ctx.setLineDash([]);
  drawCosmeticBag(ctx, x + 52, y + H / 2, 0);
  const tall = H >= 100;
  ctx.font = F(900, fs + 2); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.pink; ctx.fillText('Уже в косметичке ✓', x + 92, y + H / 2 - (tall ? 13 : 0));
  if (tall) { ctx.font = F(700, fs); ctx.fillStyle = 'rgba(243,226,192,0.75)'; ctx.fillText('новое — после следующего забега', x + 92, y + H / 2 + 16); }
  ctx.restore();
}
function drawPlaceholderP(ctx, x, y, W, H, fs, pulse = 0) {
  ctx.save(); ctx.fillStyle = 'rgba(14,6,18,0.32)'; ctx.beginPath(); ctx.roundRect(x, y, W, H, 12); ctx.fill();
  ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,154,184,${0.3 + 0.3 * pulse})`; ctx.stroke(); ctx.setLineDash([]);
  ctx.font = F(900, fs + 14); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgba(243,226,192,${0.2 + 0.2 * pulse})`; ctx.fillText('?', x + W / 2, y + H / 2 + 2);
  ctx.restore();
}
function drawBoughtSlotP(ctx, rv, sl, x, y, W, H, k, o) {
  const d = rv.r - sl.bought;
  if (d > 0.95) { drawEmptySlotP(ctx, x, y, W, H, Math.min(1, (d - 0.95) / 0.25), o.minF); return; }
  if (d < 0.55) { drawOfferWide(ctx, rv._save, sl.id, x, y, W, H, () => false, k, { ...o, t: rv.r, stamp: d / 0.16, glow: 0.4 }); return; }
  const f = easeInCubic(Math.min(1, (d - 0.55) / 0.4)), cx = x + W / 2, cy = y + H / 2;
  if (!sl.flewToBag) { sl.flewToBag = true; rv.fx.push({ kind: 'fly', t0: rv.r + 0.4 * (1 - f), dur: 0.001, x0: rv.bag.x, y0: rv.bag.y, x1: rv.bag.x, y1: rv.bag.y, arc: 0, arrive: 'bag', color: C.gold, hidden: true }); }
  const px = cx + (rv.bag.x - cx) * f, py = cy + (rv.bag.y - cy) * f - Math.sin(Math.PI * f) * 60, sc = 1 - 0.92 * f;
  drawEmptySlotP(ctx, x, y, W, H, f, o.minF);
  ctx.save(); ctx.translate(px, py); ctx.rotate(f * 1.2); ctx.scale(sc, sc);
  drawOfferWide(ctx, rv._save, sl.id, -W / 2, -H / 2, W, H, () => false, k, { ...o, t: rv.r, stamp: 1 });
  ctx.restore();
}
// витрина пуста: билет «АНШЛАГ»
function drawSoldOutP(ctx, rv, rc, d, fs) {
  if (d < 0) return;
  const e = easeOutBack(Math.min(1, d / FLY)), w = rc.w, h = Math.min(150, Math.max(rc.h, 128)), cx = rc.x + w / 2, cy = rc.y + h / 2;
  if (!rv.fired.empty) { rv.fired.empty = true; if (d < 0.2) sfx('whoosh'); }
  ctx.save(); ctx.translate(cx, cy + (1 - e) * 300); ctx.rotate((1 - e) * -0.2 - 0.02);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 6, w, h, 14); ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#3a1648'); g.addColorStop(1, C.duskD);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.gold; ctx.stroke();
  ctx.fillStyle = C.velvet; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, 92, h, [14, 0, 0, 14]); ctx.fill();
  ctx.fillStyle = 'rgba(243,226,192,0.4)'; for (let yy = -h / 2 + 8; yy < h / 2 - 6; yy += 10) { ctx.beginPath(); ctx.arc(-w / 2 + 92, yy, 2, 0, TAU); ctx.fill(); }
  drawCosmeticBag(ctx, -w / 2 + 46, 0, Math.max(0, Math.sin(rv.r * 3)) * 0.15);
  const tcx = -w / 2 + 92 + (w - 92) / 2;
  ctx.save(); ctx.translate(tcx, -h * 0.24); ctx.rotate(-0.06 + Math.sin(rv.r * 2) * 0.02);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-104, -24, 208, 48, 8); ctx.stroke();
  ctx.font = F(900, 34); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.gold; ctx.fillText('АНШЛАГ!', 0, 2); ctx.restore();
  ctx.font = F(800, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.paper; ctx.fillText('Всё с витрины уже в косметичке.', tcx, h * 0.12);
  ctx.font = F(700, fs); ctx.fillStyle = '#ffd0dc'; ctx.fillText('Новое — после следующего забега', tcx, h * 0.12 + fs * 1.4);
  for (let k = 0; k < 5; k++) twinkle(ctx, -w / 2 + 120 + k * (w - 160) / 4, -h / 2 + 18 + (k % 2) * (h - 36), 6, rv.r, k * 1.4, C.gold);
  ctx.restore();
}
// ui: { M:{minF}, view:{W,H}, hdr:{x,y,w,size}, shuf:{x,y,w,h}|null, rects:[{x,y,w,h}], stage:{cx,cy,sc}, header, btn, shuffleBtn, btnH } → { buy, shuffle }
export function drawRevealOffersP(ctx, rv, save, ui) {
  const out = { buy: null, shuffle: false }, r = rv.r, offers = save.offers || [], fs = ui.M.minF, VW = ui.view.W, VH = ui.view.H, st = ui.stage;
  rv._save = save;
  const live = rv.slots.filter(s => !s.bought).map(s => s.id);
  if (live.length !== offers.length || offers.some(id => !live.includes(id))) {
    const keep = rv.slots.filter(s => s.bought);
    rv.slots = offers.map((id, k) => ({ id, s: r + 0.05 + k * 0.4 }));
    if (!offers.length && keep.length) rv.slots = keep;
  }
  // --- заголовок витрины ---
  const hk = Math.min(1, Math.max(0, (r - 0.1) / 0.22));
  if (hk > 0) {
    if (!rv.fired.head && r - 0.1 < 0.2) sfx('thud', { pitch: 1.3 }); rv.fired.head = true;
    ctx.save(); ctx.translate(ui.hdr.x, ui.hdr.y); const sc = 1.5 - 0.5 * easeOutBack(hk); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, hk * 2);
    fitFont(ctx, ui.header, 900, ui.hdr.size, ui.hdr.w); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = C.night; ctx.strokeText(ui.header, 0, 0);
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#fff1c9'); g.addColorStop(1, C.gold); ctx.fillStyle = g; ctx.fillText(ui.header, 0, 0);
    ctx.restore();
  }
  // косметичка (сюда улетают покупки)
  const bagP = Math.max(0, 1 - (r - rv.bagPulse) / 0.35);
  drawCosmeticBag(ctx, rv.bag.x, rv.bag.y, bagP);
  ctx.save(); ctx.font = F(900, fs - 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.night; ctx.strokeText('косметичка', rv.bag.x, rv.bag.y + 28); ctx.fillStyle = 'rgba(243,226,192,0.9)'; ctx.fillText('косметичка', rv.bag.x, rv.bag.y + 28); ctx.restore();
  if (revealDone(rv) && offers.length === 3 && !save.offerShuffled && ui.shuf && ui.shuffleBtn(ui.shuf.x, ui.shuf.y, ui.shuf.w, ui.shuf.h)) out.shuffle = true;
  // --- слоты ---
  const n = rv.slots.length;
  if (!n) { drawSoldOutP(ctx, rv, ui.rects[0], r - rv.emptyS, fs); drawFx(ctx, rv); return out; }
  const stage = [], base = { minF: fs, btnH: ui.btnH };
  const wideBtn = (label, bx, by, bw, bh, o) => ui.btn(label, bx, by, bw, bh, o);
  rv.slots.forEach((sl, k) => {
    const R = ui.rects[k]; if (!R) return;
    sl.cx = R.x + R.w / 2; sl.cy = R.y + R.h / 2;
    const d = r - sl.s;
    if (sl.bought != null) { drawBoughtSlotP(ctx, rv, sl, R.x, R.y, R.w, R.h, k, base); return; }
    if (d < 0) { drawPlaceholderP(ctx, R.x, R.y, R.w, R.h, fs); return; }
    const stageEnd = P_FLY + P_FLIP + P_HOLD;
    if (d < stageEnd) { drawPlaceholderP(ctx, R.x, R.y, R.w, R.h, fs, 1); stage.push({ sl, k, d, R, g: 0 }); return; }
    const g = Math.min(1, (d - stageEnd) / P_GLIDE);
    if (g < 1) { drawPlaceholderP(ctx, R.x, R.y, R.w, R.h, fs); ctx.save(); ctx.globalAlpha *= easeOutCubic(g); drawOfferWide(ctx, save, sl.id, R.x, R.y, R.w, R.h, fakeBtn(ctx, ui), k, { ...base, t: r }); ctx.restore(); stage.push({ sl, k, d, R, g }); return; }
    const since = d - P_TOT, glow = (isRare(sl.id) ? 0.5 : 0.28) + 0.16 * Math.sin(r * 3 + k) + Math.max(0, 0.6 - since * 1.5), flash = Math.max(0, 0.4 - since * 3);
    const res = drawOfferWide(ctx, save, sl.id, R.x, R.y, R.w, R.h, wideBtn, k, { ...base, t: r, glow, shine: since / SHINE, flash });
    if (res) out.buy = sl.id;
  });
  // --- сцена: карточка раскрывается по центру, крупно ---
  if (stage.length) {
    let da = 0; for (const c of stage) da = Math.max(da, c.g > 0 ? 1 - easeOutCubic(c.g) : Math.min(1, c.d / 0.12));
    ctx.fillStyle = `rgba(10,3,14,${0.62 * da})`; ctx.fillRect(0, 0, VW, VH);
    for (const { sl, k, d, R, g } of stage) {
      const W = CARD_W, H = CARD_H, rare = isRare(sl.id);
      if (!sl.f1) { sl.f1 = true; if (d < 0.15) sfx('whoosh', { pitch: 1.1 + k * 0.12, vol: 0.7 }); }
      if (!sl.f2 && d >= P_FLY + P_FLIP / 2) { sl.f2 = true; if (d - P_FLY - P_FLIP / 2 < 0.2) { burst(rv, st.cx, st.cy, sl.id); sfx('pop', { pitch: 1 + k * 0.15 }); if (rare) sfx('ach', { pitch: 1.25 }); } }
      const fly = Math.min(1, d / P_FLY), fl = Math.min(1, Math.max(0, (d - P_FLY) / P_FLIP)), hold = d - P_FLY - P_FLIP;
      if (rare && hold > 0 && g === 0) rays(ctx, st.cx, st.cy, r, Math.min(1, hold * 4));
      let px = st.cx, py = st.cy, sc = st.sc, rot = 0, a = 1, sx = 1;
      if (fly < 1) { const e = easeOutBack(fly); py = st.cy + (1 - e) * VH * 0.55; rot = (1 - e) * (k % 2 ? 0.3 : -0.3); sc = st.sc * (0.55 + 0.45 * e); }
      else if (fl < 1) sx = Math.max(0.02, Math.abs(Math.cos(fl * Math.PI)));
      else if (g === 0) sc = st.sc * (1 + 0.02 * Math.sin(r * 8));
      if (g > 0) { const e = g < 0.5 ? 2 * g * g : 1 - (-2 * g + 2) ** 2 / 2, tgt = R.h / H * 0.78; px = st.cx + (R.x + R.w / 2 - st.cx) * e; py = st.cy + (R.y + R.h / 2 - st.cy) * e; sc = st.sc + (tgt - st.sc) * e; a = 1 - easeOutCubic(g); }
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(px, py); ctx.rotate(rot); ctx.scale(sc * sx, sc);
      if (fl < 0.5 && g === 0) drawOfferBack(ctx, sl.id, -W / 2, -H / 2, W, H, r);
      else drawOfferCard(ctx, save, sl.id, -W / 2, -H / 2, W, H, fakeBtn(ctx, ui), k, { t: r, glow: 0.5 + 0.2 * Math.sin(r * 5), flash: Math.max(0, 0.5 - (hold + P_FLIP) * 3) * (fl >= 0.5 ? 1 : 0) });
      ctx.restore();
    }
    // реплика Поппи над сценой (пока идёт раскрытие)
    const qa = Math.min(1, Math.max(0, (r - 0.25) / 0.2)) * (1 - Math.min(1, Math.max(0, (r - (revealEnd(rv) - 0.4)) / 0.3)));
    if (qa > 0 && rv.quip) {
      ctx.save(); ctx.globalAlpha = qa * da; ctx.font = F(800, fs, 'italic ');
      const qw = Math.min(ctx.measureText(rv.quip).width + 26, VW - 32), qx = VW / 2 - qw / 2, qy = st.cy - CARD_H * st.sc / 2 - 56;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(qx, qy, qw, 36, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(VW / 2 - 10, qy + 34); ctx.lineTo(VW / 2, qy + 48); ctx.lineTo(VW / 2 + 10, qy + 34); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.roundRect(qx, qy, qw, 36, 14); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, rv.quip, 800, fs, qw - 24, 'italic '); ctx.fillText(rv.quip, VW / 2, qy + 19);
      ctx.restore();
    }
  }
  drawFx(ctx, rv);
  return out;
}
// Банка конфет и счётчик «в копилке» — закреплены сверху
export function drawJarCounterP(ctx, rv, save, x, y, fs) {
  const k = Math.min(1, Math.max(0, (rv.r - 0.04) / COUNT)), e = easeOutCubic(k);
  const gk = rv.gift ? easeOutCubic(Math.min(1, Math.max(0, (rv.r - GIFT_T) / 0.4))) : 1;
  const target = save.candies - Math.round(rv.earned * (1 - e)) - (rv.gift ? Math.round(rv.gift.n * (1 - gk)) : 0);
  if (rv.jarDisp == null || k < 1) rv.jarDisp = target; else rv.jarDisp += (target - rv.jarDisp) * Math.min(1, (rv.dt || 0.016) * 9);
  const pulse = Math.max(0, 1 - (rv.r - rv.jarPulse) / 0.18);
  ctx.save(); ctx.translate(x, y); ctx.scale(1.25, 1.25); drawCandyJar(ctx, 0, 0, Math.min(1, save.candies / 400), pulse); ctx.restore();
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK;
  const s = String(Math.round(rv.jarDisp)); ctx.font = F(900, fs + 11); ctx.strokeText(s, x - 30, y - 4); ctx.fillStyle = C.gold; ctx.fillText(s, x - 30, y - 4);
  ctx.font = F(800, fs - 1); ctx.lineWidth = 4; ctx.strokeText('в копилке', x - 30, y + 20); ctx.fillStyle = 'rgba(255,230,239,0.9)'; ctx.fillText('в копилке', x - 30, y + 20);
  ctx.restore();
}
// Строка «+N конфет за забег» с отсчётом
export function drawEarnedRowP(ctx, rv, x, y, fs) {
  const k = Math.min(1, Math.max(0, (rv.r - 0.04) / COUNT)), e = easeOutCubic(k), shown = Math.round(rv.earned * e);
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const pop = k < 1 ? 1 + 0.08 * Math.sin(rv.r * 40) : 1;
  drawCandy(ctx, x + 14, y, 1.7);
  ctx.save(); ctx.translate(x + 40, y); ctx.scale(pop, pop);
  ctx.font = F(900, fs + 13); ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(`+${shown}`, 0, 1); ctx.fillStyle = C.gold; ctx.fillText(`+${shown}`, 0, 1);
  const tw = ctx.measureText(`+${rv.earned}`).width; ctx.restore();
  ctx.font = F(800, fs + 2); ctx.fillStyle = '#ffe6ef'; ctx.fillText('конфет за забег', x + 50 + tw, y + 2);
  ctx.restore();
}

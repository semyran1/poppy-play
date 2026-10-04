// Новая Поппи v3: части сняты с листа персонажа (Nano Banana по референсам пользователя) векторизатором
// (tools/cutparts.py → tools/vectorize.py → src/art/vec/hero_*.js). Ноги — бедро и голень, вращаются вокруг
// замеренных суставов на угол «мокап − собственный угол рисунка» (слепки CMU в heroine_clips.js);
// опорная стопа ставится на пол; корпус с бластером качается с тазом.
import { drawVec } from './vec.js';
import CLIPS from './heroine_clips.js';
import { drawAccOverlay, keySheetSize, drawVecMinus, gunErasePolys } from './accessories.js';

// Аксессуары (src/art/accessories.js): o.acc — карта надетого { head, face, … }; без o.acc берётся общая
// (setHeroineAcc из сохранения), o.acc === false — без аксессуаров. Оверлей рисуется в координатах листа.
let ACC_DEF = null;
export function setHeroineAcc(equip) { ACC_DEF = equip || null; }
const accOf = (o) => o.acc === false ? null : (o.acc || ACC_DEF);

const K = 600 / 1465;                          // px листа → единицы вектора
const J = { hipF: [205, 870], kneeF: [140, 1110], ankleF: [85, 1330], hipN: [345, 870], kneeN: [405, 1100], ankleN: [500, 1330], muzzle: [490, 12] };
// смещения частей (parts.json) и уровень подошвы — по нарядам (у Лары ботинки ниже босых ступней)
const PARTS_BY = { pajama: { upper: [100, 3], thighF: [89, 807], shinF: [0, 1059], thighN: [280, 807], shinN: [356, 1049] }, lara: { upper: [87, 0], thighF: [86, 807], shinF: [5, 1059], thighN: [280, 807], shinN: [373, 1049] } };
const GROUND_BY = { pajama: 1452, lara: 1486 };
const BODY_H = (1452 - 240) * K;               // рост до макушки без бластера, ед.
const ang = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);   // от вертикали вниз, + вперёд (+x)
const REST = { tF: ang(J.hipF, J.kneeF), sF: ang(J.kneeF, J.ankleF), tN: ang(J.hipN, J.kneeN), sN: ang(J.kneeN, J.ankleN) };

// Наборы частей по нарядам: пижама — hero_*.js, Лара — hero_lara_*.js (тот же лист, та же поза → те же суставы)
const SETS = { pajama: 'hero_', lara: 'hero_lara_' };
const NAMES = ['upper', 'thighF', 'shinF', 'thighN', 'shinN', 'stand', 'face'];
const DATA = {}, LOADING = {};
let DATA_CUR = null;
export function loadHeroineVec(outfit = 'pajama') {
  const pre = SETS[outfit] || SETS.pajama;
  return LOADING[outfit] ??= Promise.all(NAMES.map(n => import(`./vec/${pre}${n}.js`).then(m => { (DATA[outfit] ??= {})[n] = m.default; })))
    .catch(e => { console.warn('наряд', outfit, e.message); LOADING[outfit] = null; });
}
export const heroineVecReady = (outfit = 'pajama') => !!DATA[outfit] && NAMES.every(n => DATA[outfit][n]);
function use(outfit) {
  if (!heroineVecReady(outfit)) { loadHeroineVec(outfit); return false; }
  DATA_CUR = DATA[outfit];
  return true;
}

// ---------- Поза «спиной» (руки с бластером прямо вверх; выбирается в гардеробе: save.facing = 'back') ----------
// Части сняты с back_pajama_gi.png / back_lara_gi.png (tools/cutparts_back.py → revec_hero.sh back → vec/hero_back_*.js,
// vec/hero_lara_back_*.js). Суставы — px исходника. Ноги по глубине: F — дальняя (справа на картинке), N — ближняя.
// «Вперёд» у рисунка — влево (−x): носки, взгляд и бластер; поэтому в игре рисунок зеркалится относительно анфаса
// (бластер впереди по ходу), а углы мокапа берутся со знаком fwd = −1. У каждой ноги своя линия пола (пижама
// повёрнута на три четверти: дальняя стопа выше), опора — пятка и носок (sole).
const BACK = {
  pajama: {
    pre: 'hero_back_', k: 1233 * K / (2429 - 265),
    J: { hipF: [625, 1405], kneeF: [745, 1840], ankleF: [850, 2290], hipN: [368, 1400], kneeN: [342, 1860], ankleN: [245, 2340], muzzle: [180, 20] },
    P: { upper: [78, 2], thighF: [520, 1295], shinF: [649, 1751], thighN: [233, 1290], shinN: [3, 1771] },
    hipC: [500, 1420], ground: 2429,
    sole: { F: [[905, 2345], [725, 2330]], N: [[280, 2427], [20, 2412]] },
  },
  lara: {
    pre: 'hero_lara_back_', k: 1269 * K / (2442 - 317),
    J: { hipF: [590, 1350], kneeF: [650, 1815], ankleF: [772, 2320], hipN: [300, 1350], kneeN: [235, 1815], ankleN: [125, 2320], muzzle: [145, 18] },
    P: { upper: [33, 2], thighF: [445, 1240], shinF: [571, 1726], thighN: [155, 1240], shinN: [2, 1726] },
    hipC: [445, 1350], ground: 2442,
    sole: { F: [[728, 2441], [835, 2425]], N: [[165, 2441], [60, 2432]] },
  },
};
const BACK_NAMES = ['upper', 'thighF', 'shinF', 'thighN', 'shinN'];
const BDATA = {}, BLOADING = {};
export function loadHeroineBack(outfit = 'pajama') {
  const B = BACK[outfit] || BACK.pajama;
  return BLOADING[outfit] ??= Promise.all(BACK_NAMES.map(n => import(`./vec/${B.pre}${n}.js`).then(m => { (BDATA[outfit] ??= {})[n] = m.default; })))
    .catch(e => { console.warn('спина', outfit, e.message); BLOADING[outfit] = null; });
}
export const heroineBackReady = (outfit = 'pajama') => !!BDATA[outfit] && BACK_NAMES.every(n => BDATA[outfit][n]);
for (const B of Object.values(BACK)) {
  B.O = [B.hipC[0], B.ground];
  B.REST = { tF: ang(B.J.hipF, B.J.kneeF), sF: ang(B.J.kneeF, B.J.ankleF), tN: ang(B.J.hipN, B.J.kneeN), sN: ang(B.J.kneeN, B.J.ankleN) };
  B.floor = { F: Math.max(...B.sole.F.map(q => q[1])), N: Math.max(...B.sole.N.map(q => q[1])) };
}

// Риг текущей позы: анфас (лист fig1) или спина. k — px исходника → ед. вектора, O — начало (между ступнями, на полу).
// Спина только для боевых поз; пока её части не загружены — рисуется анфас.
const isBack = (pose, o) => (o?.facing || pose.facing) === 'back' && pose.kind !== 'stand' && pose.kind !== 'talk';
function rigFor(outfit, back) {
  if (back && heroineBackReady(outfit)) {
    const B = BACK[outfit] || BACK.pajama;
    return { back: true, k: B.k, O: B.O, J: B.J, P: B.P, REST: B.REST, data: BDATA[outfit], pre: B.pre, hipC: B.hipC, fwd: -1,
      sole: (s) => B.sole[s], floor: B.floor };
  }
  if (back) loadHeroineBack(outfit);
  const g = GROUND_BY[outfit] || 1452, drop = g - 1330;
  return { back: false, k: K, O: [275, g], J, P: PARTS_BY[outfit] || PARTS_BY.pajama, REST, data: DATA_CUR, pre: SETS[outfit] || SETS.pajama,
    hipC: [275, 870], fwd: 1, floor: { F: g, N: g },
    // опора: пятка и носок (носок дальней ноги смотрит назад, ближней — вперёд, как на листе)
    sole: (s) => { const a = J['ankle' + s], off = s === 'N' ? [90, drop - 10] : [-40, drop]; return [[a[0], a[1] + drop], [a[0] + off[0], a[1] + off[1]]]; } };
}

function clipFrame(name, u) {
  const c = CLIPS[name]; if (!c) return null;
  const n = c.frames.length, cyc = c.kind === 'cycle';
  const x = cyc ? (((u % 1) + 1) % 1) * n : Math.max(0, Math.min(0.999, u)) * (n - 1);
  const i = Math.floor(x), k = x - i, a = c.frames[i], b = c.frames[cyc ? (i + 1) % n : Math.min(n - 1, i + 1)];
  const o = {}; for (const key in a) { let d = b[key] - a[key]; if (key !== 'bob') { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; } o[key] = a[key] + d * k; }
  return o;
}
const rot = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * co - y * s, c[1] + x * s + y * co]; };

// Поза ног: углы бедра/голени (от вертикали, + вперёд по рисунку) для каждой ноги
function legAngles(pose, R) {
  const k = pose.kind;
  let F = null;
  if (k === 'run' || k === 'walk') F = clipFrame(k, pose.u || 0);
  else if (k === 'jump') F = clipFrame('jump', pose.u ?? 0.5);
  if (!F) return { ...R.REST };
  // мокап: ближняя нога — правая (скилл); у спины «вперёд» по рисунку — влево (fwd = −1), а мах ног короче:
  // сзади шаг виден в ракурсе (×0,8), и верх бедра меньше выходит из-под ягодиц
  const f = R.fwd * (R.back ? 0.8 : 1);
  return { tF: f * F.lt, sF: f * F.ls, tN: f * F.rt, sN: f * F.rs };
}

// Геометрия ноги после поворота: колено, углы поворота частей (рад, canvas по часовой),
// gap — сколько осталось от самой нижней точки подошвы до своей линии пола
function legGeo(R, side, A) {
  const hip = R.J['hip' + side], knee0 = R.J['knee' + side];
  const dT = -(A['t' + side] - R.REST['t' + side]);          // canvas: + по часовой, а «вперёд» — против
  const dS = -(A['s' + side] - R.REST['s' + side]);
  const knee = rot(knee0, hip, dT);
  let low = -1e9;
  for (const q of R.sole(side)) { const r = rot(q, knee0, dS); low = Math.max(low, knee[1] + r[1] - knee0[1]); }
  return { hip, knee0, knee, dT, dS, gap: R.floor[side] - low };
}
// опорная стопа на полу: нога, ближе всех к своей линии пола, встаёт на неё (в прыжке — без подстановки)
const liftOf = (pose, gF, gN) => (pose.kind === 'run' || pose.kind === 'walk') ? Math.min(gF.gap, gN.gap) : 0;
const leanOf = (pose, R) => pose.kind === 'run' ? 0.06 * R.fwd : 0;

// в системе координат части рига (после drawPart) перейти к пикселям листа
function inSheet(ctx, R, fn) { ctx.save(); ctx.scale(R.k, R.k); ctx.translate(-R.O[0], -R.O[1]); fn(ctx); ctx.restore(); }

// before — рисуется под частью (скин бластера: рука держит его поверх), erase — многоугольники листа, которые стереть
// из рисунка части (старый бластер под скином), eraseKey — ключ кэша стёртой копии
function drawPart(ctx, R, name, pivot, to, a, scale, after, before, erase, eraseKey) {
  const d = R.data[name], off = R.P[name], k = R.k, O = R.O;
  ctx.save();
  ctx.translate((to[0] - O[0]) * k, (to[1] - O[1]) * k);
  ctx.rotate(a);
  ctx.translate(-(pivot[0] - O[0]) * k, -(pivot[1] - O[1]) * k);
  if (before) inSheet(ctx, R, before);
  const x = (off[0] - O[0]) * k, y = (off[1] - O[1]) * k;
  if (erase) drawVecMinus(ctx, d, x, y, d.w, d.h, eraseKey, erase, off[0], off[1], k, k);
  else drawVec(ctx, d, x, y, d.w, d.h, R.pre + name + '@' + scale.toFixed(2));
  if (after) inSheet(ctx, R, after);   // аксессуары: в пикселях листа, с тем же поворотом части
  ctx.restore();
}

// Нарисовать героиню в позе с бластером (бой) или стоя (сцены). h — рост до макушки на экране.
// pose.facing / o.facing === 'back' — поза «спиной» (только бой: aim / run / walk / jump).
export function drawHeroineVec(ctx, x, y, h, pose = {}, o = {}) {
  const outfit = o.outfit || 'pajama', pre = SETS[outfit] || SETS.pajama;
  if (!use(outfit)) return false;
  const sc = h / BODY_H, acc = accOf(o);
  const R = rigFor(outfit, isBack(pose, o));
  const accKey = R.back ? 'back' : 'aim';
  const ov = (part) => acc ? (c) => drawAccOverlay(c, part, accKey, outfit, acc, pose.t || 0, pose) : null;
  // скин бластера-рисунок: под корпус, а старый бластер из корпуса стирается (пока рисунок не загружен — обычный бластер)
  const erase = acc ? gunErasePolys(outfit, accKey, acc) : null;
  // спина зеркальна анфасу: «вперёд» у рисунка влево, а без flip героиня смотрит вправо (бластер впереди по ходу)
  const mirror = R.back ? !o.flip : !!o.flip;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * (mirror ? -1 : 1), sc);
  if (pose.kind === 'stand' || pose.kind === 'talk') {
    // стоящая фигура снята с того же листа в том же масштабе (K) — рисуем в родном размере
    const d = DATA_CUR.stand;
    ctx.scale(1, 1 + Math.sin((pose.t || 0) * 2.2) * 0.004);
    drawVec(ctx, d, -d.w / 2, -d.h, d.w, d.h, pre + 'stand@' + sc.toFixed(2));
    if (acc) { ctx.translate(-d.w / 2, -d.h); ctx.scale(d.w / Math.round(d.w / K), d.h / Math.round(d.h / K)); drawAccOverlay(ctx, 'stand', 'stand', outfit, acc, pose.t || 0, pose); }
    ctx.restore(); return true;
  }
  const A = legAngles(pose, R);
  const gF = legGeo(R, 'F', A), gN = legGeo(R, 'N', A);
  const lift = liftOf(pose, gF, gN);
  const breathe = Math.sin((pose.t || 0) * 2.4) * 2;
  ctx.translate(0, lift * R.k);
  // дальняя нога, ближняя нога, затем корпус (таз корпуса закрывает верх штанин)
  for (const [s, g] of [['F', gF], ['N', gN]]) {
    drawPart(ctx, R, 'shin' + s, R.J['knee' + s], g.knee, g.dS, sc, ov('shin' + s));
    drawPart(ctx, R, 'thigh' + s, g.hip, g.hip, g.dT, sc);
  }
  ctx.save(); ctx.translate(0, breathe * 0.3); drawPart(ctx, R, 'upper', R.hipC, R.hipC, leanOf(pose, R), sc, ov('upper'), erase && ov('upperBefore'), erase, R.pre + 'upper#' + outfit + accKey); ctx.restore();
  ctx.restore();
  return true;
}

// Дуло бластера в координатах экрана относительно (x, y), для h; x «вперёд» (+) — для героини, смотрящей вправо
// (player.js умножает на p.face). pose.facing === 'back' — дуло позы «спиной».
export function heroineVecMuzzle(pose, h, outfit = 'pajama') {
  use(outfit);
  const R = rigFor(outfit, isBack(pose));
  const sc = h / BODY_H, A = legAngles(pose, R);
  const gF = legGeo(R, 'F', A), gN = legGeo(R, 'N', A);
  const lift = liftOf(pose, gF, gN);
  const m = rot(R.J.muzzle, R.hipC, leanOf(pose, R));
  const mx = (m[0] - R.O[0]) * R.k * sc;
  return [R.back ? -mx : mx, ((m[1] - R.O[1]) + lift) * R.k * sc];
}

// Портрет для плашки диалога: крупный план с листа
export function drawHeroinePortrait(ctx, x, y, size, outfit = 'pajama') {
  if (!use(outfit)) return false; const d = DATA_CUR.face;
  const k = size / (d.w * 0.82);
  drawVec(ctx, d, x - d.w * 0.08 * k, y - d.h * 0.02 * k, d.w * k, d.h * k, (SETS[outfit] || 'hero_') + 'face@p' + size);
  return true;
}

// Кадр для главного меню: «шпионский постер» — боком, взгляд через плечо, бластер вверх (Nano Banana → вектор).
// Грузится лениво; пока не готов — false (рисовать обычную стойку).
const KEY = {}, KEY_LOAD = {};
const KEY_FILE = { pajama: 'hero_key', lara: 'hero_lara_key' };
export function loadHeroineKey(outfit = 'pajama') {
  const f = KEY_FILE[outfit] || KEY_FILE.pajama;
  return KEY_LOAD[f] ??= import(`./vec/${f}.js`).then(m => { KEY[f] = m.default; }).catch(() => { KEY_LOAD[f] = null; });
}
// (x, y) — точка между ступнями на полу, h — высота фигуры на экране
export function drawHeroineKey(ctx, x, y, h, outfit = 'pajama', o = {}) {
  const f = KEY_FILE[outfit] || KEY_FILE.pajama, d = KEY[f];
  if (!d) { loadHeroineKey(outfit); return false; }
  const k = h / d.h, w = d.w * k;
  ctx.save(); ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.scale(1, 1 + Math.sin((o.t || 0) * 2.2) * 0.004);   // дыхание
  const acc = accOf(o), erase = acc ? gunErasePolys(outfit, 'key', acc) : null, [SW, SH] = keySheetSize(outfit);
  if (erase) {   // скин бластера: рисунок под корпус, старый бластер стёрт
    ctx.save(); ctx.translate(-w * 0.55, -h); ctx.scale(w / SW, h / SH); drawAccOverlay(ctx, 'keyBefore', 'key', outfit, acc, o.t || 0, {}); ctx.restore();
    drawVecMinus(ctx, d, -w * 0.55, -h, w, h, f + '#' + Math.round(h), erase, 0, 0, w / SW, h / SH);
  } else drawVec(ctx, d, -w * 0.55, -h, w, h, f + '@' + Math.round(h));
  if (acc) { ctx.translate(-w * 0.55, -h); ctx.scale(w / SW, h / SH); drawAccOverlay(ctx, 'key', 'key', outfit, acc, o.t || 0, {}); }
  ctx.restore(); return true;
}

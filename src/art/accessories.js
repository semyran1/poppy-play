// Аксессуары героини: точки крепления (замер по листам персонажа) и рисование.
// Координаты — пиксели исходных PNG (tools/ref/heroine/*_gi.png): поза с бластером (fig1 / lara_fig1a, это же
// координаты рига: J, hipC в heroineVec.js), стойка (fig0 / lara_fig0), постер меню (key_pajama / key_lara), спина.
// heroineVec.js вызывает drawAccOverlay уже в системе координат листа (поворот корпуса `lean` и голени учтены).
// Слоты (docs/MEME_ACCESSORIES.md): заколка на пучок и брелок на поясе (точки, как у банта и плюша), скин бластера
// (рисунок вместо бластера по двум точкам «дуло → хват»), след выстрела. Питомец рисуется вне рига (src/game/pets.js).

import { drawVec, drawVecRaw } from './vec.js';
import { view } from '../engine/core.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- точки крепления ----------
// bow / clip — [x, y, угол, ширина]: бант и краб на пучке; hip — пояс (брелок), plushH — его рост; blaster / mag — контур
// корпуса и магазина бластера (сняты по синему цвету с PNG: что стирать под скином); gun: { m, h } — дуло и хват для скина
const AIM_PAJAMA = {
  hs: 1, safe: [435, 205, 540, 345],
  gun: { m: [502, -18], h: [490, 268] },
  bow: [142, 270, -0.5, 100], clip: [156, 292, 0.1, 112],
  hip: [190, 700], plushH: 125,
  mag: [[509, 252], [484, 250], [480, 254], [470, 285], [470, 293], [480, 305], [495, 303], [509, 285], [517, 267], [517, 260]],
  blaster: [[499, 0], [489, 0], [488, 9], [473, 9], [467, 15], [457, 11], [448, 27], [450, 45], [443, 68], [439, 68], [436, 84], [430, 87], [426, 96], [429, 114], [424, 117], [414, 146], [399, 154], [381, 195], [382, 206], [385, 207], [382, 238], [397, 252], [410, 253], [427, 247], [431, 218], [447, 190], [463, 183], [466, 173], [472, 174], [470, 187], [456, 198], [450, 217], [469, 213], [483, 205], [493, 183], [491, 171], [498, 148], [511, 142], [542, 77], [536, 48], [518, 29], [518, 12]],
};
const AIM_LARA = {
  ...AIM_PAJAMA,
  hip: [192, 738],
  blaster: [[508, 0], [488, 0], [485, 7], [457, 8], [451, 17], [447, 56], [441, 59], [441, 72], [432, 90], [425, 93], [427, 117], [414, 146], [397, 151], [397, 161], [387, 184], [378, 192], [385, 206], [380, 234], [396, 250], [426, 250], [438, 208], [446, 194], [461, 180], [468, 180], [469, 187], [448, 203], [448, 213], [443, 221], [461, 215], [464, 209], [485, 202], [494, 176], [492, 162], [496, 148], [510, 139], [542, 71], [536, 46], [518, 26], [520, 13]],
};
const STAND_PAJAMA = {
  hs: 0.92,
  bow: [112, 74, -0.5, 90], clip: [110, 86, 0.1, 104],
  hip: [72, 548], plushH: 118,
  blaster: null,
};
const STAND_LARA = {
  ...STAND_PAJAMA,
};
const KEY_PAJAMA = {
  hs: 1.72, W: 929, H: 2428, safe: [55, 295, 262, 520], shadow: [26, 8],
  gun: { m: [172, 6], h: [262, 360] },
  bow: [684, 300, 0.4, 165], clip: [688, 324, 0, 190],
  hip: [422, 1108], plushH: 215,
  mag: [[94, 379], [78, 390], [79, 409], [93, 444], [106, 456], [118, 456], [108, 422], [104, 389], [100, 379]],
  blaster: [[181, 0], [150, 17], [147, 21], [149, 41], [113, 73], [113, 89], [105, 97], [108, 114], [145, 213], [159, 219], [167, 240], [168, 250], [162, 269], [169, 298], [179, 303], [195, 339], [205, 392], [212, 392], [227, 374], [234, 372], [234, 357], [221, 349], [212, 336], [212, 323], [218, 322], [251, 343], [265, 386], [281, 393], [301, 393], [327, 372], [323, 348], [329, 338], [329, 325], [336, 317], [335, 306], [313, 246], [302, 245], [292, 234], [273, 178], [278, 155], [251, 82], [255, 46], [243, 20], [231, 20], [221, 14], [204, 15], [196, 0]],
};
const KEY_LARA = {
  ...KEY_PAJAMA, W: 915, H: 2440, shadow: null,
  bow: [672, 296, 0.4, 165], clip: [676, 316, 0, 190],
  mag: [[80, 363], [80, 380], [62, 392], [67, 424], [80, 449], [91, 457], [101, 457], [102, 445], [98, 442], [86, 390], [84, 363]],
  blaster: [[163, 0], [142, 10], [131, 21], [133, 41], [97, 73], [97, 88], [89, 96], [93, 117], [124, 204], [129, 212], [143, 219], [153, 245], [146, 261], [153, 298], [161, 302], [167, 311], [171, 332], [179, 349], [187, 392], [198, 390], [215, 372], [220, 371], [220, 361], [200, 344], [196, 336], [196, 324], [204, 322], [213, 332], [230, 338], [237, 345], [249, 392], [288, 393], [311, 373], [307, 349], [313, 338], [313, 326], [319, 319], [319, 308], [297, 246], [285, 245], [276, 234], [257, 178], [262, 155], [235, 82], [239, 45], [227, 20], [215, 20], [209, 15], [189, 15], [180, 0]],
};
// Поза «спиной» (back_pajama_gi / back_lara_gi, координаты рига спины в heroineVec.js): лица не видно — очки и
// стразы не рисуются, у чокера видна только лента (back: 1); eyeN = eyeF = центр затылка (крылья ободка — наружу).
// Ноги по глубине: F — дальняя (справа на картинке), N — ближняя (слева); носки смотрят влево.
const BACK_PAJAMA = {
  hs: 1.75, back: 1, safe: [25, 270, 225, 430], shadow: [-26, 6], far: 44,
  gun: { m: [176, 8], h: [262, 345] },
  bow: [682, 440, 0.3, 165], clip: [692, 462, 0, 190],
  hip: [735, 1119], plushH: 220,
  mag: [[94, 384], [82, 391], [81, 405], [95, 440], [111, 453], [101, 389]],
  blaster: [[172, 0], [172, 7], [150, 23], [153, 44], [118, 71], [117, 92], [109, 105], [146, 205], [163, 212], [172, 238], [167, 275], [200, 342], [208, 389], [231, 367], [232, 359], [209, 337], [209, 322], [224, 321], [255, 341], [268, 378], [278, 381], [279, 389], [297, 393], [324, 374], [322, 344], [334, 313], [313, 252], [292, 241], [275, 191], [276, 158], [251, 86], [254, 51], [241, 23], [201, 17], [197, 0]],
};
const BACK_LARA = {
  ...BACK_PAJAMA, hs: 1.67, shadow: null, far: 11,
  gun: { m: [140, 8], h: [225, 330] },
  bow: [548, 482, 0.2, 155], clip: [572, 512, 0, 180],
  hip: [660, 1197], plushH: 215,
  mag: [[43, 351], [35, 362], [52, 410]],
  blaster: [[129, 0], [127, 9], [109, 19], [107, 42], [79, 65], [69, 94], [99, 192], [119, 199], [125, 219], [121, 252], [133, 281], [143, 358], [152, 362], [166, 350], [166, 341], [146, 324], [146, 307], [162, 306], [189, 323], [207, 364], [241, 372], [268, 353], [274, 299], [257, 247], [245, 243], [234, 228], [222, 192], [224, 151], [199, 77], [201, 47], [192, 25], [174, 17], [155, 17], [150, 0]],
};
export const ACC_ANCHORS = {
  aim: { pajama: AIM_PAJAMA, lara: AIM_LARA },
  stand: { pajama: STAND_PAJAMA, lara: STAND_LARA },
  key: { pajama: KEY_PAJAMA, lara: KEY_LARA },
  back: { pajama: BACK_PAJAMA, lara: BACK_LARA },
};
export const keySheetSize = (outfit) => { const a = ACC_ANCHORS.key[outfit] || KEY_PAJAMA; return [a.W, a.H]; };

// ---------- векторные рисунки ----------
// Мемные предметы (docs/MEME_ACCESSORIES.md §4) нарисованы листами в стиле героини (Nano Banana → grade.py → inkedge.py →
// tools/vectorize.py, рост 130 ед.): src/art/vec/pet_*.js (питомцы), gun_*.js (скины бластера, дулом вверх, рукоять
// внизу), clip_*.js (заколки и брелоки); бант и краб — acc_bow / acc_claw. Грузятся лениво; пока рисунок не загружен —
// предмет не рисуется. Посадка — подобие по двум точкам или поворот вокруг опорной точки (ART).
const VFILE = { bow: 'acc_bow', claw: 'acc_claw' };
export const ACC_VEC = {
  pet_okak: 'pet_cat', pet_beaver: 'pet_beaver', pet_guinea: 'pet_ghostpig', pet_capy: 'pet_capybara', pet_surfdog: 'pet_bulldog',
  pet_lionhare: 'pet_lionbunny', pet_monkey: 'pet_macaque',
  blaster_squeak: 'gun_chicken', blaster_log: 'gun_log', blaster_baguette: 'gun_baguette', blaster_boba: 'gun_bubble',
  blaster_flip: 'gun_phone', blaster_lightstick: 'gun_lightstick',
  bow_cocktail: 'bow', claw_clean: 'claw', clip_maxbow: 'clip_bowbat',
  bun_sticks: 'bun_sticks', bun_scrunchie: 'bun_scrunchie', bun_witchhat: 'bun_witchhat', bun_wreath: 'bun_wreath', bun_ribbon: 'bun_ribbon', bun_fork: 'bun_fork',
  charm_runcow: 'clip_cow', charm_crybaby: 'clip_dropwitch', charm_67: 'clip_scale', charm_nope: 'clip_bat',
};
const VD = {}, VL = {};
const fileOf = (n) => VFILE[n] || (/^(pet|gun|clip|bun)_/.test(n) ? n : null);
export function loadAccVec(id) {
  const n = ACC_VEC[id] || id, f = fileOf(n);
  if (!f) return Promise.resolve();
  return VL[n] ??= import(`./vec/${f}.js`).then(m => { VD[n] = m.default; }).catch(e => { console.warn('аксессуар', n, e.message); VL[n] = null; });
}
// надетое (карта слотов или список id) — подгрузить заранее
export function preloadAcc(equip) {
  const ids = (Array.isArray(equip) ? equip : Object.values(equip || {})).filter(Boolean);
  return Promise.all(ids.map(loadAccVec));
}
// данные рисунка предмета (null, пока не загружен — загрузка запускается сама)
export function accVecData(id) { const n = ACC_VEC[id] || id; const d = VD[n]; if (!d) loadAccVec(id); return d || null; }
const DPR = Math.min(globalThis.devicePixelRatio || 1, 2);

// Опорные точки рисунков (ед. вектора; сетки — tools/memeview.html). piv — точка крепления (узелок, середина зубьев,
// верх карабина), m / h у скинов бластера — дуло (верх ствола) и «хват» (рукоять, куда ложатся пальцы)
const ART = {
  bow: { piv: [61, 40] },                                        // узелок
  claw: { piv: [116, 96] },                                      // середина зубьев (вцепляются в пучок)
  bun_sticks: { piv: [55, 80] },                                 // перекрестье палочек
  bun_scrunchie: { piv: [60, 58] },                              // центр кольца
  bun_witchhat: { piv: [62, 84] },                               // центр основания шляпки (поля)
  bun_wreath: { piv: [65, 65] },                                 // центр венка
  bun_ribbon: { piv: [75, 62] },                                 // бубенчик (узел)
  bun_fork: { piv: [62, 58] },                                   // стержень шпильки у лунной головки
  clip_bowbat: { piv: [72, 40] },                                // жемчужина в центре банта
  clip_cow: { piv: [41, 2] }, clip_dropwitch: { piv: [41, 2] }, clip_scale: { piv: [41, 2] }, clip_bat: { piv: [41, 2] },   // верх карабина
  gun_chicken: { m: [27, 2], h: [20, 112] }, gun_log: { m: [31, 0], h: [15, 113] }, gun_baguette: { m: [34, 0], h: [17, 115] },
  gun_bubble: { m: [36, 0], h: [18, 115] }, gun_phone: { m: [37, 0], h: [18, 113] }, gun_lightstick: { m: [30, 0], h: [16, 117] },
};
// Обрезка (многоугольники в ед. вектора)
const CLIP = { claw: [[18, 0], [219, 0], [219, 130], [18, 130]],
  fork: [[-5, -5], [140, -5], [140, 88], [-5, 88]], sticks: [[-5, -5], [145, -5], [145, 106], [-5, 106]] };   // концы шпильки и палочек уходят в волосы
// Заколки на пучке: use — якорь позы (bow: [x, y, угол, ширина] или clip: у краба), f — размер относительно банта,
// da — добавка к углу, dx / dy — сдвиг (px листа × hs); clip — обрезка
const HEAD = {
  bow_cocktail: { art: 'bow', use: 'bow', f: 1 },
  clip_maxbow: { art: 'clip_bowbat', use: 'bow', f: 1.15 },
  claw_clean: { art: 'claw', use: 'clip', f: 1, clip: CLIP.claw },
  // заколки на пучок (bun_*.js): якорь bow — центр пучка, clip — его основание; f — размер, da — доворот, abs — угол вместо якорного,
  // dx / dy — сдвиг в px листа × hs, glow — светлая кайма для тёмных предметов
  // pose: поправки по позам (aim — прицел / бег / прыжок, stand, key, back)
  bun_sticks: { art: 'bun_sticks', use: 'bow', f: 1.05, clip: CLIP.sticks, pose: { aim: { abs: -1.05, dx: 16, dy: -8 }, stand: { abs: -1.0, dx: 14, dy: -8 }, key: { abs: -0.2, dx: -16, dy: -10 }, back: { abs: -1.05, dx: 20, dy: -10 } } },
  bun_scrunchie: { art: 'bun_scrunchie', use: 'clip', f: 1.25, glow: 1, pose: { aim: { abs: -0.3, dy: -6 }, stand: { abs: -0.3, dy: -6 }, key: { abs: 0.3, dy: -8 }, back: { abs: 0.1, dy: -8 } } },
  bun_witchhat: { art: 'bun_witchhat', use: 'bow', f: 1.05, glow: 1, pose: { aim: { abs: -0.3, dy: -28, dx: 10 }, stand: { abs: -0.3, dy: -24, dx: 10 }, key: { abs: 0.3, dy: -30, dx: 4 }, back: { abs: -0.2, dy: -32, dx: 14 } } },
  bun_wreath: { art: 'bun_wreath', use: 'bow', f: 1.0, pose: { aim: { dy: -4 }, stand: { dy: -4 }, key: { dy: -6 }, back: { dy: -6 } } },
  bun_ribbon: { art: 'bun_ribbon', use: 'clip', f: 1.45, pose: { aim: { abs: -0.2, dy: -8 }, stand: { abs: -0.2, dy: -8 }, key: { abs: 0.2, dy: -10 }, back: { abs: 0, dy: -10 } } },
  bun_fork: { art: 'bun_fork', use: 'bow', f: 1.05, clip: CLIP.fork, pose: { aim: { abs: -0.85, dx: 16, dy: -4 }, stand: { abs: -0.85, dx: 14, dy: -4 }, key: { abs: -0.3, dx: -16, dy: -6 }, back: { abs: -0.85, dx: 20, dy: -6 } } },
};

// ---------- матрицы ----------
// Аффинное преобразование по трём парам точек a[i] → b[i]; [a, b, c, d, e, f] как у canvas transform
function affine3(a, b) {
  const [[x1, y1], [x2, y2], [x3, y3]] = a, D = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  const solve = (v1, v2, v3) => [(v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / D, (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / D,
    (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) / D];
  const [A, C, E] = solve(b[0][0], b[1][0], b[2][0]), [B, Dd, F] = solve(b[0][1], b[1][1], b[2][1]);
  return [A, B, C, Dd, E, F];
}
// подобие по двум парам точек (flip — зеркально), sy — масштаб поперёк линии a1→a2
function sim2(a1, a2, s1, s2, flip = false, sy = 1) {
  const ap = [a1[0] - (a2[1] - a1[1]), a1[1] + (a2[0] - a1[0])], v = [s2[0] - s1[0], s2[1] - s1[1]], g = flip ? -1 : 1;
  return affine3([a1, a2, ap], [s1, s2, [s1[0] - g * v[1] * sy, s1[1] + g * v[0] * sy]]);
}
// точка piv рисунка → (x, y), поворот a, ширина рисунка W (px листа), flip — зеркально
function simAt(d, piv, x, y, a, W, flip = false) {
  const k = W / d.w, c = Math.cos(a), s = Math.sin(a), fx = (flip ? -1 : 1) * k, fy = k;
  return [c * fx, s * fx, -s * fy, c * fy, x - c * fx * piv[0] + s * fy * piv[1], y - s * fx * piv[0] - c * fy * piv[1]];
}

// Нарисовать предмет: mk(d) → матрица «ед. вектора → текущие координаты». Битмап кэшируется под экранный размер
// (ключ drawVec содержит ширину×высоту), поэтому предмет чёткий и в бою (100 px), и на постере меню.
function drawArt(ctx, name, mk, clip = null, after = null, glow = null, pre = null) {
  const d = VD[name]; if (!d) { loadAccVec(name); return; }
  const M = mk(d); if (!M) return;
  ctx.save(); ctx.transform(...M); if (pre) pre(ctx);
  const t = ctx.getTransform(), sc = Math.max(Math.hypot(t.a, t.b), Math.hypot(t.c, t.d)) / DPR;   // логических px на ед.
  ctx.save();
  if (clip) { ctx.beginPath(); clip.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip(); }
  let w = d.w * sc; w = w < 48 ? Math.max(3, Math.round(w)) : Math.round(w / 3) * 3;
  const h = w * d.h / d.w;
  ctx.save(); ctx.scale(d.w / w, d.h / h);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 3 * DPR; }   // светлая кайма: тёмный предмет читается на тёмных волосах
  drawVec(ctx, d, 0, 0, w, h, 'acc_' + name);
  ctx.restore();
  ctx.restore();
  if (after) after(ctx, d);
  ctx.restore();
}
// Рисунок предмета высотой h с опорной точкой (долями рисунка ax, ay) в (x, y): питомцы, иконки.
// flip — зеркально (по умолчанию рисунки смотрят влево), rot — поворот вокруг опорной точки
export function drawAccVecAt(ctx, id, x, y, h, { flip = false, rot = 0, ax = 0.5, ay = 1, glow = null, clip = null, after = null } = {}) {
  const n = ACC_VEC[id] || id;
  drawArt(ctx, n, d => {
    const s = h / d.h, c = Math.cos(rot), sn = Math.sin(rot), fx = (flip ? -1 : 1) * s;
    const a = c * fx, b = sn * fx, cc = -sn * s, dd = c * s;
    return [a, b, cc, dd, x - (a * ax * d.w + cc * ay * d.h), y - (b * ax * d.w + dd * ay * d.h)];
  }, clip, after, glow);
}

// ---------- стирание старого бластера ----------
// Старый бластер — часть рисунка корпуса (рука держит его). Для скина-рисунка копия корпуса без бластера
// (контур бластера, снятый по синему, чуть расширен) строится один раз; новый рисунок ложится ПОД корпус,
// и пальцы остаются поверх рукояти.
const ERASED = new Map();
// polys — многоугольники в px листа, (ox, oy) — начало битмапа в px листа, sx, sy — px битмапа на px листа
export function drawVecMinus(ctx, d, x, y, w, h, key, polys, ox, oy, sx, sy, grow = 4) {
  let bm = ERASED.get(key);
  if (!bm) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const cx = c.getContext('2d'); cx.scale(DPR, DPR); drawVecRaw(cx, d, 0, 0, w, h);
    cx.globalCompositeOperation = 'destination-out'; cx.fillStyle = cx.strokeStyle = '#000'; cx.lineJoin = 'round';
    const trace = () => { cx.beginPath(); for (const poly of polys) { poly.forEach((p, i) => { const X = (p[0] - ox) * sx, Y = (p[1] - oy) * sy; i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.closePath(); } };
    // у рук (safe) стираем впритык — перчатки целы; далеко от рук — с запасом, чтобы не осталась синяя кайма
    cx.lineWidth = grow * sx; trace(); cx.fill(); cx.stroke();
    cx.save(); cx.beginPath(); cx.rect(-5, -5, w + 10, h + 10);
    const sf = polys.safe; if (sf) cx.rect((sf[0] - ox) * sx, (sf[1] - oy) * sy, (sf[2] - sf[0]) * sx, (sf[3] - sf[1]) * sy);
    cx.clip('evenodd'); cx.lineWidth = (polys.far || 11) * sx; trace(); cx.stroke();
    // у постера «Пижама» корпус обведён тёмной тенью со сдвигом: у старого бластера она остаётся тонкими полосами рядом со скином — стираем и тень
    const sh = polys.shadow; if (sh) for (const m of [1, 1.7]) { cx.save(); cx.translate(sh[0] * m * sx, sh[1] * m * sy); cx.lineWidth = (grow + 12) * sx; trace(); cx.fill(); cx.stroke(); cx.restore(); }
    cx.restore();
    ERASED.set(key, bm = c);
  }
  ctx.drawImage(bm, x, y, w, h);
}
// скин-рисунок бластера надет и загружен (иначе рисуем обычный бластер)
export function gunArtReady(id) { return !!GUN_ID[id] && !!VD[GUN_ID[id]]; }
const GUN_ID = Object.fromEntries(Object.keys(ACC_VEC).filter(k => k.startsWith('blaster_')).map(k => [k, ACC_VEC[k]]));
// какие многоугольники стереть в позе (poseKey: 'aim' | 'back' | 'key')
export function gunErasePolys(outfit, poseKey, acc) {
  if (!acc?.blaster || !GUN_ID[acc.blaster]) return null;
  if (!gunArtReady(acc.blaster)) { loadAccVec(acc.blaster); return null; }   // до загрузки рисунка — обычный бластер
  const A = (ACC_ANCHORS[poseKey] || ACC_ANCHORS.aim)[outfit] || (ACC_ANCHORS[poseKey] || ACC_ANCHORS.aim).pajama;
  if (!A.blaster) return null;
  const P = A.mag ? [A.blaster, A.mag] : [A.blaster]; P.safe = A.safe; P.shadow = A.shadow; P.far = A.far; return P;
}

// ---------- общая отрисовка ----------
// part: 'upperBefore' (под корпусом: скин бластера), 'upper' (поза с бластером), 'stand', 'key', 'keyBefore';
// poseKey: 'aim' | 'back' (поза спиной: те же части рига) | 'stand' | 'key'
export function drawAccOverlay(ctx, part, poseKey, outfit, acc, t = 0, pose = {}) {
  if (!acc) return;
  const A = (ACC_ANCHORS[poseKey] || ACC_ANCHORS.aim)[outfit] || (ACC_ANCHORS[poseKey] || ACC_ANCHORS.aim).pajama;
  const tr = ctx.getTransform(), base = globalThis.ACC_BASE || (view.scale * view.dpr);   // логический px игры
  const m = Math.hypot(tr.a, tr.b) / base;                    // экранных px на 1 px листа
  // мелкие предметы в бою (рост ~100 px) чуть крупнее, иначе их не разглядеть
  const R = { A, m, hs: A.hs, t, pose, poseKey, boost: clamp(1 + (0.13 - m) * 3.5, 1, 1.2) };
  if (globalThis.ACC_PROBE) globalThis.ACC_PROBE(part, poseKey, tr, A);   // проверочные листы: где лист позы на экране
  ctx.save();
  try {
    if (part === 'upperBefore' || part === 'keyBefore') { if (acc.blaster && A.blaster) drawGun(ctx, R, acc.blaster); }
    else if (part === 'upper' || part === 'stand' || part === 'key') {
      if (globalThis.GUN_DBG === 2 && A.blaster) for (const P of [A.blaster, A.mag].filter(Boolean)) { ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = 'rgba(255,0,255,0.35)'; ctx.fill(); }
      if (acc.back) drawCharm(ctx, R, acc.back);
      if (acc.head) drawHead(ctx, R, acc.head);
    }
  } finally { ctx.restore(); }
}

function heartPath(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.bezierCurveTo(-w * 0.62, h * 0.08, -w * 0.6, -h * 0.55, -w * 0.25, -h * 0.5);
  ctx.bezierCurveTo(-w * 0.1, -h * 0.48, 0, -h * 0.36, 0, -h * 0.24);
  ctx.bezierCurveTo(0, -h * 0.36, w * 0.1, -h * 0.48, w * 0.25, -h * 0.5);
  ctx.bezierCurveTo(w * 0.6, -h * 0.55, w * 0.62, h * 0.08, 0, h * 0.5);
  ctx.closePath();
}
function starPath(ctx, r, n = 4, inner = 0.38) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r * inner : r; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  ctx.closePath();
}

// ---------- заколка на пучке ----------
// bow / clip: [x, y, угол, ширина] — якоря позы (px листа); размер рисунка — по ширине банта (или краба), так что у
// всех заколок один масштаб «единицы вектора»; у спины затылок
const BASE_W = { bow: 127, clip: 232 };   // ширина рисунков acc_bow / acc_claw (ед.): от них отсчитан масштаб якорей
function drawHead(ctx, R, id) {
  const H = HEAD[id], A = R.A; if (!H) return;
  const an = A[H.use]; if (!an) return;
  const [x, y, a, w] = an, s = w * R.boost / BASE_W[H.use] * H.f;   // px листа на ед. вектора
  const pv = ART[H.art].piv, hs = A.hs, ov = H.pose?.[R.poseKey] || {};
  const glow = id === 'clip_maxbow' ? (R.boost > 1.04 ? 'rgba(255,205,235,0.95)' : 'rgba(255,205,235,0.6)')
    : H.glow ? (R.boost > 1.04 ? 'rgba(235,205,255,0.95)' : 'rgba(235,205,255,0.6)') : null;
  drawArt(ctx, H.art, d => simAt(d, pv, x + ((ov.dx ?? H.dx) || 0) * hs, y + ((ov.dy ?? H.dy) || 0) * hs, (ov.abs ?? H.abs ?? a) + ((ov.da ?? H.da) || 0), s * d.w), H.clip || null, null, glow);
}

// ---------- брелок ----------
// hip: [x, y] — где карабин цепляется за пояс; plushH — рост брелока (px листа); качается от бега
const CHARM_K = { charm_runcow: 1, charm_crybaby: 0.95, charm_67: 0.95, charm_nope: 0.9 };
function drawCharm(ctx, R, id) {
  const A = R.A, hip = A.hip, name = ACC_VEC[id]; if (!hip || !name) return;
  const pose = R.pose || {};
  const run = pose.kind === 'run' ? Math.sin((pose.u || 0) * TAU * 2) * 0.35 : 0;
  const sw = Math.sin(R.t * 2.6) * 0.12 + run;
  const H = (A.plushH || 96) * R.boost * (CHARM_K[id] || 1);
  drawArt(ctx, name, d => simAt(d, ART[name].piv, hip[0], hip[1], sw + (A.plushA || 0), H * d.w / d.h));
}

// ---------- скин бластера ----------
// m / h позы (px листа): дуло (там же вспышка и снаряды) и хват (куда ложатся пальцы). Рисунок — подобием по двум
// точкам (дуло рисунка → дуло позы, хват рисунка → хват позы) и ложится под корпус героини.
function drawGun(ctx, R, id) {
  const G = R.A.gun, name = GUN_ID[id]; if (!G || !name || !VD[name]) return;
  const a = ART[name];
  if (globalThis.GUN_DBG) dbgGun(ctx, R.A);
  const flip = G.flip !== false, sy = G.sy || 1;
  const mk = () => sim2(a.m, a.h, G.m, G.h, flip, sy);
  if (globalThis.GUN_ART) { drawArt(ctx, name, mk); return; }
  // корпус — рисунок без «сапожка»; рукоять и скоба рисуются кодом в палитре скина, размер — от кисти героини
  // (px листа × hs), а не от рисунка: во всех позах и в гардеробе рукоять одинаковая относительно рук
  const kU = Math.hypot(G.h[0] - G.m[0], G.h[1] - G.m[1]) / Math.hypot(a.h[0] - a.m[0], a.h[1] - a.m[1]);   // px листа на ед. рисунка
  const u = (R.A.hs || 1) / kU;   // ед. рисунка на «px кисти»
  drawArt(ctx, name, mk, GUN_CUT, (c) => drawGrip(c, name, u, flip ? 1 : -1));
}
// Рисунок: дуло вверх, «нога» («сапожок») слева внизу (в единицах вектора). Корпус режется горизонтально — «сапожок» уходит
// целиком, а вместо него код рисует основание, рукоять и скобу.
const GUN_CUT = [[-20, -10], [80, -10], [80, 93], [-20, 93]];
const GRIP = {   // палитра рукояти: заливка, тень, блик, тушь; cx, bw — центр и ширина корпуса рисунка у среза (замер: tools/gunart.html)
  gun_chicken: { f: '#f3bd0c', s: '#c98a00', h: '#ffe680', ink: '#3a1608', cx: 33, bw: 30 },
  gun_log: { f: '#7e5230', s: '#503016', h: '#a9774a', ink: '#250810', cx: 34, bw: 30 },
  gun_baguette: { f: '#c88844', s: '#98602c', h: '#eebd78', ink: '#3a1c0a', rope: '#dfc088', cx: 36, bw: 29 },
  gun_bubble: { f: '#c9a272', s: '#9e784c', h: '#efd6ae', ink: '#3b2412', cx: 31, bw: 28 },
  gun_phone: { f: '#ea58a6', s: '#b4307c', h: '#ff9fd0', ink: '#4a0d2c', cx: 33, bw: 27 },
  gun_lightstick: { f: '#5b4351', s: '#36242d', h: '#9a8091', ink: '#14080c', btn: '#ff3b5c', cx: 30, bw: 24 },
};
// Рукоять — как у синего бластера: висит ПОД стволом между руками вдоль его оси, скоба спереди (со стороны спускового
// крючка синего: у героини, смотрящей вправо, это сторона дула / лица). Размеры (px листа × hs): ширина ≈ кисть + 20 %, длина ≈ 1,3 кисти.
// u — ед. рисунка на px листа, fs — в какую сторону рисунка (по x) смотрит скоба.
const GRIP_W = 46, GRIP_L = 92, GRIP_TILT = 0.05;
function drawGrip(c, name, u, fs) {
  const P = GRIP[name]; if (!P) return;
  const W = Math.min(GRIP_W * u, P.bw * 0.8), L = GRIP_L * u, X = P.cx, Y0 = 90, e = 3 * u, hw = W / 2, r = Math.min(W * 0.28, 4 * e);
  const T = -GRIP_TILT * fs, ux = Math.sin(T), uy = Math.cos(T);   // ось рукояти: вниз, откинута от скобы
  const at = (t, w) => [X + ux * t - uy * w, Y0 + uy * t + ux * w];   // t — вдоль оси от среза, w — поперёк
  const ink = 2.3 * u * 2.6;   // ≈ 6 px листа
  const grip = () => {   // рукоять: от основания вниз, торец скруглён; корень внутри манжеты
    c.beginPath(); c.moveTo(...at(-2 * e, -hw)); c.lineTo(...at(L - r, -hw)); c.quadraticCurveTo(...at(L, -hw), ...at(L, -hw + r)); c.lineTo(...at(L, hw - r));
    c.quadraticCurveTo(...at(L, hw), ...at(L - r, hw)); c.lineTo(...at(-2 * e, hw)); c.closePath();
  };
  const cw = P.bw / 2 + 0.5, ch = 2.4 * e;   // манжета (нижний торец корпуса): плоская плашка поперёк оси рисунка
  const cuff = () => { c.beginPath(); c.roundRect(X - cw, Y0 - ch * 0.4, cw * 2, ch, Math.min(ch * 0.4, 2 * e)); };
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  // скоба: тонкая дуга из манжеты перед рукоятью (спереди — сторона fs)
  const sx = (t, w) => at(t, w * fs);
  c.beginPath(); c.moveTo(...sx(0, -hw * 0.9)); c.bezierCurveTo(...sx(L * 0.12, -hw - W * 0.6), ...sx(L * 0.5, -hw - W * 0.6), ...sx(L * 0.46, -hw * 0.98));
  c.strokeStyle = P.ink; c.lineWidth = ink * 2; c.stroke(); c.strokeStyle = P.f; c.lineWidth = ink * 0.9; c.stroke();
  // рукоять: заливка + тень по задней трети + блик по передней (cel)
  grip(); c.fillStyle = P.f; c.fill();
  c.save(); grip(); c.clip();
  c.fillStyle = P.s; c.beginPath(); c.moveTo(...at(-10, hw * 0.25 * fs)); c.lineTo(...at(L + 4, hw * 0.25 * fs)); c.lineTo(...at(L + 4, hw * 2 * fs)); c.lineTo(...at(-10, hw * 2 * fs)); c.fill();
  c.strokeStyle = P.h; c.lineWidth = ink * 0.7; c.beginPath(); c.moveTo(...at(L * 0.12, hw * 0.62 * -fs)); c.lineTo(...at(L * 0.86, hw * 0.62 * -fs)); c.stroke();
  c.strokeStyle = P.ink; c.globalAlpha = 0.5; c.lineWidth = ink * 0.4;
  for (const t of [0.34, 0.48, 0.62, 0.76]) { c.beginPath(); c.moveTo(...at(L * t, -hw * 0.9)); c.lineTo(...at(L * t, hw * 0.9)); c.stroke(); }   // насечки под пальцы
  c.globalAlpha = 1;
  if (P.rope) { c.strokeStyle = P.rope; c.lineWidth = ink * 0.8; c.globalAlpha = 0.6; for (const t of [0.4, 0.56, 0.72]) { c.beginPath(); c.moveTo(...at(L * t, -hw)); c.lineTo(...at(L * t + 3 * e, hw)); c.stroke(); } c.globalAlpha = 1; }
  c.restore();
  if (P.btn) { c.fillStyle = P.btn; c.beginPath(); c.arc(...at(L * 0.28, hw * 0.1 * -fs), W * 0.12, 0, TAU); c.fill(); }
  grip(); c.strokeStyle = P.ink; c.lineWidth = ink; c.stroke();
  cuff(); c.fillStyle = P.s; c.fill(); c.strokeStyle = P.ink; c.lineWidth = ink; c.stroke();
  c.restore();
}
// отладка (?dbg=1 в tools/gunzoom.html): дуло и хват позы, контур старого бластера, зона рук
function dbgGun(ctx, A) {
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#0f0';
  if (A.blaster) { ctx.beginPath(); A.blaster.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); }
  if (A.safe) { ctx.strokeStyle = '#ff0'; ctx.strokeRect(A.safe[0], A.safe[1], A.safe[2] - A.safe[0], A.safe[3] - A.safe[1]); }
  ctx.fillStyle = '#f0f'; for (const q of [A.gun.m, A.gun.h]) { ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// цвета вспышки дула и снаряда (тампон) у скинов; иконки рисуются самим рисунком
export const BLASTER_SKIN = {
  blaster_squeak: { flash: 'rgba(255,225,90,0.9)', shot: '#ffe14d' },
  blaster_log: { flash: 'rgba(255,165,60,0.9)', shot: '#b8854a' },
  blaster_baguette: { flash: 'rgba(255,232,180,0.9)', shot: '#ecc080' },
  blaster_boba: { flash: 'rgba(190,150,255,0.9)', shot: '#c9a0ff' },
  blaster_flip: { flash: 'rgba(255,140,200,0.9)', shot: '#ff7ac0' },
  blaster_lightstick: { flash: 'rgba(255,100,160,0.95)', shot: '#ff5fa2' },
};

// ---------- следы выстрелов ----------
const SPRINKLE = ['#ff6fae', '#7fe3ff', '#ffe066', '#a98bff', '#7cf0b4', '#ffffff'];
export function emitTrail(list, s, id, dt) {
  s.trT = (s.trT || 0) - dt;
  if (s.trT > 0 || list.length > 90) return;
  s.trT = 0.035;
  const sp = Math.hypot(s.vx, s.vy) || 1;
  list.push({
    id, x: s.x - s.vx / sp * 8 + (Math.random() - 0.5) * 6, y: s.y - s.vy / sp * 8 + (Math.random() - 0.5) * 6,
    vx: -s.vx * 0.04 + (Math.random() - 0.5) * 30, vy: -s.vy * 0.04 + (Math.random() - 0.5) * 30 + 10,
    t: 0, life: 0.38 + Math.random() * 0.18, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8,
    col: SPRINKLE[Math.floor(Math.random() * SPRINKLE.length)], s: 0.8 + Math.random() * 0.5,
  });
}
export function updateTrail(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.t >= p.life) list.splice(i, 1); }
}
export function drawTrail(ctx, list) {
  for (const p of list) {
    const k = 1 - p.t / p.life, sz = p.s * (0.5 + 0.5 * k);
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    drawTrailBit(ctx, p.id, sz, p.col);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
export function drawTrailBit(ctx, id, sz, col = '#ff6fae') {
  if (id === 'trail_hearts') {
    heartPath(ctx, 9 * sz, 8.5 * sz); ctx.fillStyle = '#ff5fa2'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#7a0a3a'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-2 * sz, -1.5 * sz, 1.1 * sz, 0, TAU); ctx.fill();
  } else if (id === 'trail_stars') {
    starPath(ctx, 5.5 * sz, 5, 0.45); ctx.fillStyle = '#ffe066'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#a0600a'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(-1 * sz, -1.2 * sz, 1.2 * sz, 0, TAU); ctx.fill();
  } else {   // посыпка
    ctx.beginPath(); ctx.roundRect(-4 * sz, -1.4 * sz, 8 * sz, 2.8 * sz, 1.4 * sz); ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(60,20,40,0.6)'; ctx.stroke();
  }
}

// ---------- иконки для гардероба ----------
// Предмет крупно в рамке size×size (центр cx, cy): тот же векторный рисунок, что на героине / в бою.
// Пока рисунок не загружен — пусто (грузится сам).
const ICON = {   // доля рамки по высоте, поворот
  pet: [0.98, 0], blaster: [1.22, 0.42], charm: [0.98, 0], clip: [0.86, 0],
};
export function drawAccIcon(ctx, id, slot, cx, cy, size, t = 0) {
  if (slot === 'trail') {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const k = i / 4; ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * k;
      ctx.translate(cx - size * 0.34 + k * size * 0.62, cy + size * 0.22 - k * size * 0.4 + Math.sin(t * 4 + i) * 2); ctx.rotate(i * 0.7);
      drawTrailBit(ctx, id, 1.1 + k * 0.9, SPRINKLE[i]); ctx.restore();
    }
    ctx.restore(); return;
  }
  const name = ACC_VEC[id]; if (!name) return;
  const d = accVecData(id); if (!d) return;
  const kind = slot === 'pet' ? 'pet' : slot === 'blaster' ? 'blaster' : slot === 'back' ? 'charm' : 'clip';
  let [k, rot] = ICON[kind];
  // рамка квадратная: широкий предмет ограничиваем по ширине
  let h = size * k;
  if (d.w / d.h * h > size * 0.98) h = size * 0.98 * d.h / d.w;
  const bob = kind === 'pet' ? Math.sin(t * 2.2) * size * 0.015 : 0;
  const sw = kind === 'charm' ? Math.sin(t * 2.6) * 0.12 : 0;
  if (kind === 'charm') drawAccVecAt(ctx, id, cx, cy - h / 2, h, { ax: 0.5, ay: 0, rot: sw });
  else if (kind === 'blaster') {   // скин без «сапожка», с рукоятью кодом — как в руках (зеркально: рукоять смотрит вправо)
    const hh = h * 0.9; drawAccVecAt(ctx, id, cx - size * 0.1, cy + hh / 2 + size * 0.08, hh, { ax: 0.5, ay: 1, rot: -0.1, flip: true, clip: GUN_CUT, after: (c) => drawGrip(c, name, 0.41, 1) });
  } else drawAccVecAt(ctx, id, cx, cy + h / 2 + bob, h, { ax: 0.5, ay: 1, rot, flip: false, glow: id === 'clip_maxbow' ? 'rgba(255,215,240,0.95)' : null });
}

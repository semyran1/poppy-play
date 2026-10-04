// Музыка из кода (Web Audio): секвенсор с формой песни (вступление / A / A' / B / бридж),
// гармонией, сидовой вариативностью и живыми слоями. Никаких аудиофайлов.
//
// API (реэкспортируется из audio.js):
//   playMusic(name, opts?)  name: 'menu' | 'fight' | 'fight2' | 'boss' | 'calm' | 'victory' | 'defeat'
//     opts.variant — для 'fight' принудительно 0 или 1; без него аранжировки чередуются при каждом новом входе в 'fight'
//     opts.then    — для стингеров 'victory' / 'defeat': что включить после (например 'calm'); без него — тишина
//     opts.restart — перезапустить песню, даже если она уже играет
//     opts.seed    — зерно вариаций (по умолчанию случайное на каждый запуск)
//   stopMusic(fadeSec = 0.8)
//   setMusicIntensity(x)  0..1 — плавно добавляет слои: >0.15 щётки/хэты, >0.25 клавесин/комп,
//                         >0.45 бочка/малый/томы, >0.7 подголоски-ответы. По умолчанию 1 (всё включено).
//   musicInfo()          — отладка: { name, variant, bar, section, pass }
//
// Нота мелодии в данных: "<ступень>[#|b][:длина в восьмых]"; ступень 1 = тоника, 8 = тоника октавой выше,
// 0 = седьмая ступень снизу; "-:<длина>" — пауза. Такты разделены, аккорды тактов — римскими (см. CHORDS).

const LOOKAHEAD = 0.2, TICK_MS = 30;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const wrap = (m, lo) => lo + (((m - lo) % 12) + 12) % 12;
const clamp01 = x => Math.max(0, Math.min(1, x));

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10],
};
// [смещение корня от тоники, интервалы]
const CHORDS = {
  i: [0, [0, 3, 7]], i7: [0, [0, 3, 7, 10]], im6: [0, [0, 3, 7, 9]], I: [0, [0, 4, 7]],
  bII: [1, [0, 4, 7]], ii: [2, [0, 3, 7]], iih7: [2, [0, 3, 6, 10]],
  III: [3, [0, 4, 7]], iv: [5, [0, 3, 7]], iv7: [5, [0, 3, 7, 10]], IV: [5, [0, 4, 7]],
  V: [7, [0, 4, 7]], V7: [7, [0, 4, 7, 10]],
  VI: [8, [0, 4, 7]], VI7: [8, [0, 4, 7, 10]], vi: [9, [0, 3, 7]],
  VII: [10, [0, 4, 7]], viio7: [11, [0, 3, 6, 9]],
};

// ---------------------------------------------------------------- песни
// on: b бас, p комп (клавесин/вибрафон/челеста), o орган, l мелодия, c подголосок-ответ, h хэты, k бочка, s малый
// Поля секции: n имя, b такты [аккорды, мелодия, подголосок?], li/ci — инструмент мелодии/подголоска,
// bs/cs/ds — стиль баса/компа/барабанов, fill — индексы тактов со сбивкой.

// МЕНЮ — ля минор, 92, свинг. Терменвокс + клавесин «умпа» + пиццикато, щётки.
const MENU_I = { n: 'intro', on: 'b o c h', b: [
  ['i', '', '1 3 5 3 1 3 5 8'],
  ['V7', '', '7# 2 4 5 7#:2 -:2'],
] };
const MENU_A = { n: 'A', on: 'b p o l c h', b: [
  ['i', '5:2 8 7# 8:3 -'],
  ['im6', '10 9 8 6# 5:4'],
  ['iv', '4:2 6 8 11:3 -'],
  ['i', '10 11 10 8 5:3 -'],
  ['VI', '6:2 8 10 13:3 -'],
  ['iih7', '13 12 11 9 11:4'],
  ['V7', '9 7# 5 7# 9:2 11:2'],
  ['V7', '9 8 7#:2 -:4'],
] };
const MENU_A2 = { n: "A'", on: 'b p o l c h k', b: [
  ...MENU_A.b.slice(0, 4),
  ['VI', '6:2 8 10 13:2 10:2'],
  ['iv', '11:2 10 8 6:2 4:2'],
  ['V7', '7# 9 11 9 7#:2 9:2'],
  ['i', '8:6 -:2'],
] };
const MENU_B = { n: 'B', on: 'b p o l c h k s', b: [
  ['III', '10 12 14:2 12 10:3'],
  ['III', '-:6 11 12'],
  ['VII', '14:2 13 12 11:3 -'],
  ['VII', '-:6 9 10'],
  ['VI', '13:3 12 13 15:3'],
  ['VI', '15 14 13 12 10:4'],
  ['V7', '12:2 11 9 7#:2 9:2'],
  ['V7', '11 10 9 7# 5:4'],
] };
const MENU_BR = { n: 'bridge', on: 'b o l c', bs: 'soft', b: [
  ['i', '12:6 -:2'],
  ['bII', '11:6 -:2'],
  ['iv', '13:4 11:2 8:2'],
  ['V7', '7#:4 9:4'],
] };
const MENU = {
  title: 'menu', bpm: 92, beats: 4, swing: 0.64, key: 45, scale: 'minor',
  leadOct: 12, ctrOct: 24, ctrLo: 72, bassLo: 36, padLo: 52, compLo: 57,
  bass: 'pizz', comp: 'oompah', compInst: 'harpsi', lead: 'theremin', ctr: 'celesta', drums: 'brush',
  glide: 0.07, vib: 22, vibRate: 5.2, artic: 0.85, orn: 0.12, resp: 0.75, drop: 0.05, fills: ['toms', 'bones', 'snare'],
  mod: [0, -2], wet: 0.36, vol: 0.85, mix: { pad: 0.9 },
  intro: [MENU_I], form: [MENU_A, MENU_A2, MENU_B, { ...MENU_A, n: 'A(cel)', li: 'celesta', ci: 'xylo', on: 'b p o l c h k s' }, MENU_BR, MENU_A2],
};

// БОЙ, аранжировка 1 — ре минор, 124, шаффл: «пляска скелетов». Терменвокс, клавесин умпа, пиццикато.
const FA_I = { n: 'intro', on: 'b p h k s', b: [['i', ''], ['V7', '']] };
const FA_A = { n: 'A', on: 'b p o l c h k s', b: [
  ['i', '5 5 8 5 3 6 5:2'],
  ['i', '4 3 1 0# 1:2 -:2'],
  ['VI', '6 6 10 6 8 6 3:2'],
  ['V7', '7# 9 7# 5 4:2 2:2'],
  ['i', '5 5 8 5 3 6 5:2'],
  ['i', '8 10 12 10 8:2 -:2'],
  ['iv-V7', '11 10 8 6 7#:2 9:2'],
  ['i', '8:4 -:4'],
] };
const FA_A2 = { n: "A'", on: 'b p o l c h k s', b: [
  FA_A.b[0], FA_A.b[1],
  ['VI', '6 8 10 8 6 5 6:2'],
  ['V7', '7# 5 7# 9 11:2 9:2'],
  FA_A.b[0],
  ['i', '8 10 12 13 12:2 10:2'],
  ['iv-V7', '11:2 10 8 7#:2 5:2'],
  ['i', '8:2 5 3 1:4'],
] };
const FA_B = { n: 'B', on: 'b p o l c h k s', cs: 'arp8', b: [
  ['III', '10:3 12 10:2 8:2'],
  ['VII', '9:3 7 -:4'],
  ['VI', '8:3 10 8:2 6:2'],
  ['V7', '7#:3 5 -:4'],
  ['III', '12:3 10 12:2 10:2'],
  ['VII', '11:3 9 -:4'],
  ['iv', '11:2 10:2 8:2 6:2'],
  ['V7', '7#:2 9:2 7#:2 5:2'],
] };
const FA_BR = { n: 'bridge', on: 'b o l c k s', ds: 'half', b: [
  ['bII', '6:4 9b:4'],
  ['bII', '11:6 -:2'],
  ['V7', '12:4 9:4'],
  ['V7', '7#:4 -:4'],
] };
const FIGHT_A = {
  title: 'fight/1', bpm: 124, beats: 4, swing: 0.6, key: 50, scale: 'minor',
  leadOct: 12, ctrOct: 24, ctrLo: 74, bassLo: 36, padLo: 53, compLo: 57,
  bass: 'pizz', comp: 'oompah', compInst: 'harpsi', lead: 'theremin', ctr: 'celesta', drums: 'shuffle',
  glide: 0.045, vib: 18, vibRate: 5.8, artic: 0.6, orn: 0.1, resp: 0.7, drop: 0.07, fills: ['snare', 'toms', 'bones', 'ks'],
  mod: [0, 2], wet: 0.28, mix: {},
  intro: [FA_I], form: [FA_A, FA_A2, FA_B, FA_BR, FA_A, FA_A2],
};

// БОЙ, аранжировка 2 — соль минор, 128, почти ровно: «костяной галоп». Ксилофон-кости, арпеджио клавесина,
// андалузский каданс; в B мелодию берёт терменвокс.
const FB_I = { n: 'intro', on: 'b p h k', b: [['i', ''], ['V', '']] };
const FB_A = { n: 'A', on: 'b p o l c h k s', b: [
  ['i', '5 3 1 3 5:2 8:2'],
  ['VII', '7 4 2 4 7:2 -:2'],
  ['VI', '6 3 1 3 6:2 8:2'],
  ['V', '7#:2 5 2 0#:4'],
  ['i', '5 3 1 3 5:2 8:2'],
  ['VII', '4 7 9 7 4:2 2:2'],
  ['VI-V', '6 5 3 1 0# 2 5:2'],
  ['i', '1:4 -:4'],
] };
const FB_B = { n: 'B', on: 'b p o l c h k s', li: 'theremin', cs: 'oompah', b: [
  ['VI', '8:3 6 3:4'],
  ['III', '7:3 5 3:4'],
  ['iv', '6:3 4 8:2 6:2'],
  ['V7', '7#:4 5:2 4:2'],
  ['VI', '8:2 10:2 8:2 6:2'],
  ['III', '7:2 5:2 7:2 10:2'],
  ['iv-V7', '8 6 4 6 7#:2 5:2'],
  ['i', '8:6 -:2'],
] };
const FB_BR = { n: 'bridge', on: 'b l h k s', b: [
  ['i', '8 - 8 - 5 - 3 -'],
  ['bII', '9b - 9b - 6 - 4 -'],
  ['i', '8 - 8 - 5 - 3 -'],
  ['V', '7# - 7# - 5 - 2 0#'],
] };
const FIGHT_B = {
  title: 'fight/2', bpm: 128, beats: 4, swing: 0.55, key: 43, scale: 'minor',
  leadOct: 24, ctrOct: 36, ctrLo: 76, bassLo: 36, padLo: 55, compLo: 62,
  bass: 'drive', comp: 'arp8', compInst: 'harpsi', lead: 'xylo', ctr: 'celesta', drums: 'galop',
  glide: 0.04, vib: 16, vibRate: 6, artic: 0.6, orn: 0.1, resp: 0.65, drop: 0.07, fills: ['bones', 'snare', 'toms'],
  mod: [0, -2], wet: 0.26, mix: { pluck: 0.8, bass: 0.8, lead: 1.2 },
  intro: [FB_I], form: [FB_A, { ...FB_A, n: "A'", li: 'harpsi', ci: 'xylo' }, FB_B, FB_BR, FB_A, FB_B],
};

// ГЛАВА 2, ночная улица — фа минор, 120, джазовый свинг: минорный блюз, шагающий бас, вибрафон «чарльстон»,
// метёлки и райд, терменвокс в альтовом регистре с блюзовой ступенью.
const F2_I = { n: 'intro', on: 'b h k s', b: [['i7', ''], ['V7', '']] };
const F2_H = { n: 'head', on: 'b p l h k s', b: [
  ['i7', '- 5 7 8 7 5 3:2'],
  ['i7', '4 5b 4 3 1:2 -:2'],
  ['i7', '- 5 7 8 7 5 3:2'],
  ['i7', '4 5b 5 7 8:2 -:2'],
  ['iv7', '- 8 10 11 10 8 6:2'],
  ['iv7', '11 10 8 6 4:2 -:2'],
  ['i7', '- 5 7 8 7 5 3:2'],
  ['i7', '4 5b 4 3 1:2 -:2'],
  ['VI7', '6:2 8:2 10:2 12b:2'],
  ['V7', '12:2 11 9 7#:2 5:2'],
  ['i7', '8:4 7 5 3:2'],
  ['V7', '5 - 7# 9 11 9 7#:2'],
] };
const F2_S = { n: 'solo', on: 'b p l c h k s', b: [
  ['i7', '8:3 10 12:4'],
  ['i7', '14:2 12 10 8:4'],
  ['i7', '-:8'],
  ['i7', '-:4 12 12b 11 10'],
  ['iv7', '8:3 6 11:4'],
  ['iv7', '13:2 11 10 8:4'],
  ['i7', '-:8'],
  ['i7', '-:4 5 7 8 10'],
  ['VI7', '12b:3 10 8:2 6:2'],
  ['V7', '11:3 9 7#:2 5:2'],
  ['i7', '8:6 -:2'],
  ['V7', '-:4 7#:2 5:2'],
] };
const F2_BR = { n: 'bridge', on: 'b p o l c h k s', b: [
  ['iih7', '9:3 11 13:4'],
  ['V7', '12:3 11 9:4'],
  ['i7', '8:3 10 12:2 10:2'],
  ['i7', '8:4 -:4'],
  ['iih7', '13:3 15 13:4'],
  ['V7', '12:3 9 7#:4'],
  ['VI7', '10:2 8:2 6:2 12b:2'],
  ['V7', '5:2 7#:2 9:2 11:2'],
] };
const FIGHT2 = {
  title: 'fight2', bpm: 120, beats: 4, swing: 0.66, key: 41, scale: 'minor',
  leadOct: 12, ctrOct: 24, ctrLo: 70, bassLo: 36, padLo: 53, compLo: 60,
  bass: 'walk', comp: 'charleston', compInst: 'vibes', lead: 'theremin', ctr: 'celesta', drums: 'ride',
  glide: 0.09, vib: 26, vibRate: 5, orn: 0.14, resp: 0.7, drop: 0.05, fills: ['snare', 'toms'], trem: 0.35,
  mod: [0, 3], wet: 0.34, vol: 0.95, mix: { pad: 0.8, lead: 1.05, pluck: 1.3 },
  intro: [F2_I], form: [F2_H, { ...F2_H, n: "head'", on: 'b p o l c h k s' }, F2_BR, F2_S, F2_H],
};

// БОСС — ми минор с фригийской II, 138, ровно, акценты 3+3+2. Остинато клавесина, орган, терменвокс.
const BO_I = { n: 'intro', on: 'b p h k', b: [['i', ''], ['i', '']] };
const BO_A = { n: 'A', on: 'b p o l h k s', b: [
  ['i', '8:3 10:3 12:2'],
  ['i', '12:3 11 10:2 8:2'],
  ['bII', '13:3 11:3 9b:2'],
  ['i', '8:6 -:2'],
  ['i', '15:3 14 12:2 10:2'],
  ['i', '11 12 11 10 8:4'],
  ['VI-bII', '13:2 15:2 13:2 11:2'],
  ['V', '14#:4 12:4'],
] };
const BO_B = { n: 'B', on: 'b p o l c h k s', b: [
  ['iv', '11:2 13:2 15:2 13:2'],
  ['iv', '11:6 -:2'],
  ['V', '12:2 14#:2 16:2 14#:2'],
  ['V', '12:6 -:2'],
  ['VI', '13:3 15:3 13:2'],
  ['bII', '13:3 11:3 9b:2'],
  ['viio7', '14#:2 13:2 11:2 9:2'],
  ['V', '12:4 -:4'],
] };
const BO_BR = { n: 'stomp', on: 'b o c k s', ds: 'stomp', ci: 'xylo', b: [
  ['i', '', '1 1 - 1 - 1 3 5'],
  ['bII', '', '2b 2b - 2b - 2b 4 6'],
  ['i', '', '1 1 - 1 - 1 3 5'],
  ['bII', '', '2b 2b - 2b - 4 6 9b'],
] };
const BOSS = {
  title: 'boss', bpm: 138, beats: 4, swing: 0.5, key: 40, scale: 'minor',
  leadOct: 12, ctrOct: 24, ctrLo: 72, bassLo: 36, padLo: 52, compLo: 59,
  bass: 'boss', comp: 'ostinato', compInst: 'harpsi', lead: 'theremin', ctr: 'xylo', drums: 'boss',
  glide: 0.05, vib: 20, vibRate: 6.4, artic: 0.55, orn: 0.08, resp: 0.6, drop: 0.05, fills: ['toms', 'snare', 'ks'],
  mod: [0, 1], wet: 0.3, vol: 0.85, mix: { pad: 1.45, kick: 1.05, lead: 1.25, bass: 0.9 },
  intro: [BO_I], form: [BO_A, { ...BO_A, n: "A'", li: 'harpsi', on: 'b p o l c h k s' }, BO_B, BO_BR, BO_A, BO_B],
};

// СПОКОЙНАЯ (сюжетные сцены) — до минор, вальс 3/4, 76. Музыкальная шкатулка (челеста), тихий орган,
// редкий терменвокс; во втором проходе мелодию поёт челеста.
const CA_I = { n: 'intro', on: 'p o', b: [['i', ''], ['VI', '']] };
const CA_A = { n: 'A', on: 'b p o l', b: [
  ['i', '5:4 3:2'],
  ['VI', '1:6'],
  ['III', '5:2 7:2 8:2'],
  ['VII', '9:6'],
  ['iv', '8:4 6:2'],
  ['i', '5:6'],
  ['iv', '6:2 4:2 3:2'],
  ['V7', '2:6'],
] };
const CA_B = { n: 'B', on: 'b p o l c', b: [
  ['VI', '-:2 6:2 8:2'],
  ['VI', '10:6'],
  ['III', '-:2 7:2 5:2'],
  ['III', '3:6'],
  ['iv', '-:2 4:2 6:2'],
  ['iv', '8:6'],
  ['V7', '7#:3 9 11:2'],
  ['V7', '7#:6'],
] };
const CA_C = { n: 'C', on: 'b p o l c h', b: [
  ['III', '3:2 5:2 7:2'],
  ['VII', '9:4 7:2'],
  ['VI', '8:4 6:2'],
  ['III', '5:6'],
  ['iv', '6:2 8:2 11:2'],
  ['V7', '9:4 7#:2'],
  ['i', '8:6'],
  ['i', '-:6'],
] };
const CALM = {
  title: 'calm', bpm: 76, beats: 3, swing: 0.54, key: 48, scale: 'minor',
  leadOct: 12, ctrOct: 24, ctrLo: 72, bassLo: 36, padLo: 55, compLo: 67,
  bass: 'soft', comp: 'musicbox', compInst: 'celesta', lead: 'theremin', ctr: 'vibes', drums: 'waltz',
  glide: 0.12, vib: 16, vibRate: 4.6, orn: 0.08, resp: 0.6, drop: 0, fills: [], leadVel: 0.75,
  mod: [0, -3], wet: 0.45, vol: 0.85, mix: { pluck: 1, lead: 0.85, pad: 0.9 },
  intro: [CA_I], form: [CA_A, CA_B, { ...CA_A, n: "A'", li: 'celesta', on: 'b o l c' }, CA_C],
};

// СТИНГЕРЫ — играют один раз.
const VICTORY = {
  title: 'victory', bpm: 140, beats: 4, swing: 0.5, key: 50, scale: 'major', once: true, tail: 2.2,
  leadOct: 12, ctrOct: 24, ctrLo: 74, bassLo: 36, padLo: 54, compLo: 62,
  bass: 'pizz', comp: 'oompah', compInst: 'harpsi', lead: 'celesta', ctr: 'xylo', drums: 'galop',
  glide: 0.05, vib: 20, vibRate: 5.5, orn: 0, resp: 0, drop: 0, fills: ['bones'],
  mod: [0], wet: 0.4, mix: {},
  intro: [], form: [
    { n: 'fanfare', on: 'b p o l h k s', fill: [1], b: [
      ['I', '1 3 5 8 5 8 10 12'],
      ['IV-V', '11:2 13:2 12:2 14:2'],
    ] },
    { n: 'end', on: 'b o l h k', bs: 'one', ds: 'hit', b: [['I', '15:8']] },
  ],
};
const DEFEAT = {
  title: 'defeat', bpm: 84, beats: 4, swing: 0.5, key: 50, scale: 'minor', once: true, tail: 1.6,
  leadOct: 12, ctrOct: 24, ctrLo: 74, bassLo: 36, padLo: 53, compLo: 57,
  bass: 'soft', comp: 'stab', compInst: 'harpsi', lead: 'theremin', ctr: 'celesta', drums: 'none',
  glide: 0.13, vib: 48, vibRate: 4.2, orn: 0, resp: 0, drop: 0, fills: [],
  mod: [0], wet: 0.4, mix: { lead: 1.1 },
  intro: [], form: [
    { n: 'wah', on: 'b l', b: [['V7', '9:3 9b:3 8:2']] },
    { n: 'waah', on: 'b o l', b: [['V7', '7#:8']] },
    { n: 'plunk', on: 'b p', bs: 'one', b: [['i', '-:8']] },
  ],
};

// ---------------------------------------------------------------- разбор данных
function parseLine(str, S, where) {
  const out = []; if (!str) return out;
  const E = S.beats * 2, scale = SCALES[S.scale];
  let pos = 0;
  for (const tok of str.trim().split(/\s+/)) {
    let m = /^-(?::([\d.]+))?$/.exec(tok);
    if (m) { pos += m[1] ? +m[1] : 1; continue; }
    m = /^(-?\d+)([#b]*)(?::([\d.]+))?$/.exec(tok);
    if (!m) throw new Error(`music: bad token "${tok}" in ${where}`);
    const idx = +m[1] - 1, oct = Math.floor(idx / 7);
    let st = scale[((idx % 7) + 7) % 7] + 12 * oct;
    for (const ch of m[2]) st += ch === '#' ? 1 : -1;
    const len = m[3] ? +m[3] : 1;
    out.push({ pos, len, st }); pos += len;
  }
  if (Math.abs(pos - E) > 1e-6) console.warn(`music: bar length ${pos}/${E} in ${where}`);
  return out;
}
function parseChords(str, S, where) {
  const names = str.split('-'), len = S.beats / names.length;
  return names.map((name, j) => {
    const c = CHORDS[name]; if (!c) throw new Error(`music: unknown chord ${name} in ${where}`);
    return { name, root: c[0], ivs: c[1], start: j * len, len };
  });
}
const flagsOf = s => Object.fromEntries([...(s || '')].filter(ch => ch !== ' ').map(ch => [ch, true]));
function flatten(S, secs) {
  const bars = [];
  secs.forEach((s, si) => s.b.forEach((row, i) => {
    const where = `${S.title}/${s.n}/${i + 1}`;
    bars.push({
      sec: s.n, si, i, nb: s.b.length, on: flagsOf(s.on), li: s.li, ci: s.ci, bs: s.bs, cs: s.cs, ds: s.ds,
      fill: s.fill ? new Set(s.fill) : null,
      chords: parseChords(row[0], S, where), mel: parseLine(row[1], S, where),
      ctr: row[2] != null ? parseLine(row[2], S, where + '/ctr') : null,
    });
  }));
  return bars;
}
function compile(raw) { const S = { ...raw }; S.intro = flatten(S, raw.intro); S.loop = flatten(S, raw.form); return S; }

const FIGHTS = [compile(FIGHT_A), compile(FIGHT_B)];
export const SONGS = {
  menu: compile(MENU), fight: FIGHTS, fight2: compile(FIGHT2), boss: compile(BOSS),
  calm: compile(CALM), victory: compile(VICTORY), defeat: compile(DEFEAT),
};
let fightNext = Math.floor(Math.random() * FIGHTS.length) - 1;

function barAt(S, i) {
  if (i < S.intro.length) return { B: S.intro[i], pass: 0, tr: 0 };
  const j = i - S.intro.length, L = S.loop.length;
  if (S.once && j >= L) return null;
  const pass = Math.floor(j / L);
  return { B: S.loop[j % L], pass, tr: S.mod[pass % S.mod.length] };
}

// ---------------------------------------------------------------- генерация такта (чистые данные)
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash2(a, b) { let h = (a ^ 0x9e3779b9) + Math.imul(b + 1, 0x85ebca6b) | 0; h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0; }

// Близкое расположение аккорда в октаве от lo; лишние ноты: сначала корень (у 5+ звуков), потом квинта.
function voicing(root, ivs, lo, max) {
  const iv = ivs.slice();
  if (iv.length > max && iv.length >= 5) iv.splice(iv.indexOf(0), 1);
  while (iv.length > max) { const j = iv.indexOf(7); iv.splice(j >= 0 ? j : 0, 1); }
  return iv.map(x => wrap(root + x, lo)).sort((a, b) => a - b);
}
const fifthOf = c => c.ivs.find(iv => iv >= 6 && iv <= 8) ?? 7;
function upStep(S, key, m) { const rel = (((m - key) % 12) + 12) % 12; return SCALES[S.scale].includes((rel + 1) % 12) ? 1 : 2; }

const BASS_VOICE = { walk: 'upright', soft: 'soft', one: 'soft' };
const BASS = {
  pizz(S, B, k, ev, key, nextRoot) {
    const r = k.r, E = S.beats * 2;
    for (const c of B.chords) {
      const root = wrap(key + c.root, S.bassLo), f5 = fifthOf(c), fifth = root + f5 <= S.bassLo + 14 ? root + f5 : root + f5 - 12;
      ev.push({ pos: c.start * 2, v: 'bass', m: root, len: 2, vel: 0.9 });
      if (c.len >= 3) ev.push({ pos: (c.start + 2) * 2, v: 'bass', m: r() < 0.2 ? root + 12 : fifth, len: 2, vel: 0.72 });
    }
    if (r() < 0.4) { const nr = wrap(nextRoot, S.bassLo); ev.push({ pos: E - 1, v: 'bass', m: nr + (r() < 0.5 ? -1 : 1), len: 1, vel: 0.55 }); }
  },
  walk(S, B, k, ev, key, nextRoot, chordAt) {
    const r = k.r, lo = S.bassLo - 3, hi = S.bassLo + 17;
    const near = (m, ref) => { let best = m; for (const x of [m - 12, m, m + 12]) if (x >= lo && x <= hi && (ref == null || Math.abs(x - ref) < Math.abs(best - ref))) best = x; return best; };
    let prev = k.mem.prevBass;
    for (let b = 0; b < S.beats; b++) {
      const c = chordAt(b * 2), root = wrap(key + c.root, S.bassLo);
      const last = b === c.start + c.len - 1;
      let m;
      if (b === c.start) m = (prev != null && r() < 0.25 && root + 12 <= hi) ? root + 12 : root;
      else if (last) {
        const nc = b + 1 < S.beats ? chordAt((b + 1) * 2) : null;
        const nr = near(wrap(nc ? key + nc.root : nextRoot, S.bassLo), prev);
        m = r() < 0.55 ? (prev > nr ? nr + 1 : nr - 1) : near(nr + 7, prev);
      } else {
        const ref = prev ?? root, cand = c.ivs.slice(1).map(iv => near(root + iv, ref)).filter(x => x !== ref);
        cand.sort((a, b2) => Math.abs(a - ref) - Math.abs(b2 - ref));
        m = cand[r() < 0.65 ? 0 : Math.min(1, cand.length - 1)] ?? root;
      }
      ev.push({ pos: b * 2, v: 'bass', m, len: 1.8, vel: b === 0 ? 0.85 : 0.72 });
      if (r() < 0.07 && b < S.beats - 1) ev.push({ pos: b * 2 + 4 / 3, v: 'bass', m, len: 0.5, vel: 0.35 });
      prev = m;
    }
    k.mem.prevBass = prev;
  },
  drive(S, B, k, ev, key, nextRoot, chordAt) {
    // галоп: «длинная-короткая-короткая» на каждые две доли (1 . 2& | 3 . 4&)
    for (let p = 0; p < S.beats * 2; p++) {
      if (p % 4 === 1) continue;
      const c = chordAt(p), root = wrap(key + c.root, S.bassLo);
      ev.push({ pos: p, v: 'bass', m: p % 4 === 0 ? root : (p % 4 === 2 ? root + 12 : root + fifthOf(c)), len: p % 4 === 0 ? 2 : 1, vel: p % 4 === 0 ? 0.85 : 0.55 });
    }
  },
  boss(S, B, k, ev, key, nextRoot, chordAt) {
    const vel = [1, 0.5, 0.55, 0.95, 0.5, 0.55, 0.9, 0.6];
    for (let p = 0; p < 8; p++) { const c = chordAt(p); ev.push({ pos: p, v: 'bass', m: wrap(key + c.root, S.bassLo) + (p === 6 ? 12 : p === 7 ? fifthOf(c) : 0), len: 1, vel: vel[p] * 0.9 }); }
  },
  soft(S, B, k, ev, key) {
    const r = k.r;
    for (const c of B.chords) {
      const root = wrap(key + c.root, S.bassLo), five = S.beats === 3 && r() < 0.35;
      ev.push({ pos: c.start * 2, v: 'bass', m: root, len: five ? 4 : c.len * 2, vel: 0.75 });
      if (five) ev.push({ pos: 4, v: 'bass', m: root + fifthOf(c), len: 2, vel: 0.45 });
    }
  },
  one(S, B, k, ev, key) { ev.push({ pos: 0, v: 'bass', m: wrap(key + B.chords[0].root, S.bassLo), len: S.beats * 2, vel: 0.9 }); },
};

const ARP_PATS = [[0, 1, 2, 1, 3, 2, 1, 2], [0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1], [3, 2, 1, 2, 0, 2, 1, 2]];
const COMP = {
  oompah(S, B, k, ev, key, chordAt) {
    const beats = S.beats === 3 ? [1, 2] : [1, 3];
    for (const b of beats) { const c = chordAt(b * 2); ev.push({ pos: b * 2, v: 'comp', m: voicing(key + c.root, c.ivs, S.compLo, 3), len: 0.8, vel: 0.8 }); }
    if (S.beats === 4 && k.r() < 0.3) { const c = chordAt(7); ev.push({ pos: 7, v: 'comp', m: voicing(key + c.root, c.ivs, S.compLo, 3), len: 0.5, vel: 0.5 }); }
  },
  arp8(S, B, k, ev, key, chordAt) {
    if (B.i === 0) k.mem.arpPat = Math.floor(k.r() * ARP_PATS.length);
    const pat = ARP_PATS[k.mem.arpPat || 0];
    for (let p = 0; p < S.beats * 2; p++) {
      const c = chordAt(p), t = voicing(key + c.root, c.ivs, S.compLo, 3); t.push(t[0] + 12);
      ev.push({ pos: p, v: 'comp', m: [t[pat[p % 8] % t.length]], len: 0.9, vel: p % 2 ? 0.5 : 0.7 });
    }
  },
  ostinato(S, B, k, ev, key, chordAt) {
    const pat = [0, 1, 2, 0, 1, 2, 1, 2];
    for (let p = 0; p < 8; p++) {
      const c = chordAt(p), root = wrap(key + c.root, S.compLo), t = [root, root + fifthOf(c), root + 12];
      ev.push({ pos: p, v: 'comp', m: [t[pat[p]]], len: 0.8, vel: p === 0 || p === 3 || p === 6 ? 0.85 : 0.5 });
    }
  },
  musicbox(S, B, k, ev, key, chordAt) {
    const r = k.r, c = chordAt(0), t = voicing(key + c.root, c.ivs, S.compLo, 3); t.push(t[0] + 12);
    if (r() < 0.3) { [0, 2, 4].forEach((p, j) => ev.push({ pos: p, v: 'comp', m: [t[[0, 2, 1][j]]], len: 2, vel: 0.5 })); return; }
    const pat = r() < 0.7 ? [0, 1, 2, 3, 2, 1] : [0, 2, 1, 3, 2, 1];
    pat.forEach((ix, p) => ev.push({ pos: p, v: 'comp', m: [t[ix]], len: 1, vel: p === 0 ? 0.6 : 0.45 }));
  },
  charleston(S, B, k, ev, key, chordAt) {
    const r = k.r(), hits = r < 0.55 ? [[0, 1, 0.6], [3, 2, 0.7]] : r < 0.85 ? [[3, 2, 0.65], [7, 1, 0.55]] : [[0, 1, 0.55], [4, 1, 0.5], [6, 1, 0.5]];
    for (const [p, len, vel] of hits) { const c = chordAt(p); ev.push({ pos: p, v: 'comp', m: voicing(key + c.root, c.ivs, S.compLo, 4), len, vel }); }
  },
  stab(S, B, k, ev, key) { const c = B.chords[0]; ev.push({ pos: 0, v: 'comp', m: voicing(key + c.root, c.ivs, S.compLo, 3), len: 2, vel: 0.9 }); },
};

const ALL8 = [0, 1, 2, 3, 4, 5, 6, 7];
const DRUMS = {
  shuffle: { k: [0, 4], s: [2, 6], h: ALL8, hv: [0.55, 0.35, 0.5, 0.35, 0.55, 0.35, 0.5, 0.4], gk: [7, 0.2], gs: [5, 0.15] },
  galop: { k: [0, 3, 4], s: [2, 6], h: ALL8, hv: [0.5, 0.3, 0.45, 0.3, 0.5, 0.3, 0.45, 0.35], oh: [7, 0.25] },
  ride: { k: [0, 4], kv: 0.35, s: [2, 6], swish: true, h: [0, 2, 3, 4, 6, 7], hv: [0.5, 0.45, 0.3, 0.5, 0.45, 0.3], ride: true },
  brush: { k: [0, 4], kv: 0.45, s: [2, 6], swish: true, h: ALL8, hv: [0.4, 0.25, 0.35, 0.25, 0.4, 0.25, 0.35, 0.3] },
  boss: { k: [0, 3, 6], s: [4], h: ALL8, hv: [0.6, 0.3, 0.35, 0.55, 0.35, 0.3, 0.55, 0.35], gs: [7, 0.3] },
  half: { k: [0], s: [4], h: [0, 2, 4, 6], hv: [0.5, 0.4, 0.5, 0.4] },
  stomp: { k: [0, 3, 6], s: [], toms: [4, 5], h: [] },
  waltz: { k: [0], kv: 0.3, s: [], h: [2, 4], hv: [0.3, 0.25] },
  hit: { k: [0], s: [], h: [], oh: [0, 1] },
  none: { k: [], s: [], h: [] },
};

function genBar(S, B, k) {
  const ev = [], r = k.r, E = S.beats * 2, on = B.on, key = S.key + k.tr;
  const chordAt = p => { const b = p / 2; for (const c of B.chords) if (b >= c.start - 1e-9 && b < c.start + c.len - 1e-9) return c; return B.chords[B.chords.length - 1]; };
  const next = k.next || B, nextRoot = S.key + (k.next ? k.nextTr : k.tr) + next.chords[0].root;
  const hum = () => (r() - 0.5) * 0.04;

  if (on.o) for (const c of B.chords) ev.push({ pos: c.start * 2, v: 'pad', m: voicing(key + c.root, c.ivs, S.padLo, 4), len: c.len * 2, vel: 1 });

  if (on.b) {
    const style = B.bs || S.bass, from = ev.length;
    BASS[style](S, B, k, ev, key, nextRoot, chordAt);
    for (let j = from; j < ev.length; j++) ev[j].voice = BASS_VOICE[style] || 'pizz';
  }
  if (on.p) { const from = ev.length; COMP[B.cs || S.comp](S, B, k, ev, key, chordAt); for (let j = from; j < ev.length; j++) ev[j].inst = S.compInst; }

  // мелодия + украшения (подъезд терменвокса снизу или форшлаг)
  const li = B.li || S.lead;
  if (on.l) {
    let prevEnd = -99;
    for (const n of B.mel) {
      const m = key + S.leadOct + n.st;
      const e = { pos: n.pos, v: 'lead', inst: li, m, len: n.len, vel: (n.pos % 2 === 0 ? 0.95 : 0.85) * (0.94 + r() * 0.1) * (S.leadVel || 1) };
      ev.push(e);
      if (li === 'theremin' && n.pos - prevEnd >= 1 && r() < S.orn * 2.2) e.scoop = true;
      else if (n.len >= 2 && r() < S.orn) ev.push({ pos: n.pos - 0.3, v: 'lead', inst: li, m: m + upStep(S, key, m), len: 0.3, vel: e.vel * 0.7, grace: true });
      prevEnd = n.pos + n.len;
    }
  }

  // подголосок: записанный или ответ на фразу мелодии (эхо / ракоход / арпеджио) в паузе
  const ci = B.ci || S.ctr;
  if (on.c) {
    if (B.ctr) for (const n of B.ctr) ev.push({ pos: n.pos, v: 'ctr', inst: ci, m: key + S.ctrOct + n.st, len: n.len, vel: 0.75 });
    else {
      const mel = on.l ? B.mel : [], last = mel[mel.length - 1];
      const from = last ? last.pos + last.len : 0, gap = E - from;
      if (gap >= 3 && r() < S.resp) {
        const fold = m => { while (m < S.ctrLo) m += 12; while (m >= S.ctrLo + 18) m -= 12; return m; };
        const c = chordAt(from), arp = voicing(key + c.root, c.ivs, S.ctrLo, 3);
        const pcs = c.ivs.map(iv => (key + c.root + iv) % 12);
        let src = mel.slice(-3).map(n => fold(key + S.leadOct + n.st)).filter(m => pcs.includes(m % 12));
        const mode = r();
        if (src.length < 2 || B.chords.length > 1 || mode > 0.75) src = r() < 0.5 ? arp : arp.slice().reverse().concat([arp[0]]);
        else if (mode > 0.4) src = src.reverse();
        const start = from + (gap >= 4 ? 1 : 0.5), ns = Math.min(src.length, Math.floor(E - start));
        for (let j = 0; j < ns; j++) ev.push({ pos: start + j, v: 'ctr', inst: ci, m: src[j], len: j === ns - 1 ? Math.max(1, E - start - j) : 1, vel: 0.62 + r() * 0.12 });
      }
    }
  }

  // барабаны и сбивки (каждые 4 такта; на 8-м и в конце секции — длиннее)
  const D = DRUMS[B.ds || S.drums];
  const fillBar = (on.k || on.s) && S.fills.length > 0 && (B.fill ? B.fill.has(B.i) : (B.i % 4 === 3 && B.nb >= 4));
  const big = fillBar && (B.i % 8 === 7 || B.i === B.nb - 1);
  const fillFrom = fillBar ? E - (big ? 4 : 2) : E;
  if (on.h) {
    D.h.forEach((p, j) => { if (p < fillFrom || r() < 0.4) ev.push({ pos: p + hum(), v: 'hat', vel: D.hv[j] * (0.85 + r() * 0.3), open: D.ride ? 0.6 : 0 }); });
    if (D.oh && r() < D.oh[1]) ev.push({ pos: D.oh[0], v: 'hat', vel: 0.4, open: 1 });
    if (k.mem.lastFill && B.i > 0) ev.push({ pos: 0, v: 'hat', vel: 0.5, open: 1 });
  }
  if (on.k) {
    D.k.forEach(p => { if (p < fillFrom) ev.push({ pos: p, v: 'kick', vel: (D.kv || 0.8) * (p === 0 ? 1 : 0.85) }); });
    if (D.gk && D.gk[0] < fillFrom && r() < D.gk[1]) ev.push({ pos: D.gk[0], v: 'kick', vel: 0.4 });
  }
  if (on.s) {
    D.s.forEach(p => { if (p < fillFrom) ev.push({ pos: p + hum(), v: 'snare', vel: 0.7 * (0.9 + r() * 0.2), swish: !!D.swish }); });
    if (D.gs && D.gs[0] < fillFrom && r() < D.gs[1]) ev.push({ pos: D.gs[0], v: 'snare', vel: 0.2 });
  }
  if (D.toms && (on.k || on.s)) D.toms.forEach((p, j) => ev.push({ pos: p, v: 'tom', m: wrap(key + chordAt(p).root, 43) + (j ? -5 : 0), vel: 0.7 }));
  if (fillBar) {
    const type = S.fills[Math.floor(r() * S.fills.length)], c = chordAt(fillFrom), n = E - fillFrom;
    const tones = c.ivs.slice(0, 3).map(iv => key + c.root + iv);
    if (type === 'snare') for (let p = fillFrom; p < E - 1e-9; p += 0.5) ev.push({ pos: p, v: 'snare', vel: 0.22 + 0.5 * (p - fillFrom) / n });
    else if (type === 'ks') for (let p = fillFrom; p < E - 1e-9; p += 1) ev.push({ pos: p, v: (p - fillFrom) % 2 ? 'snare' : 'kick', vel: 0.45 + 0.35 * (p - fillFrom) / n });
    else if (type === 'toms') {
      const tt = [wrap(tones[0], 45) + 12, wrap(tones[2], 45), wrap(tones[1], 45), wrap(tones[0], 45)], step = n / (big ? 8 : 4);
      for (let j = 0; j * step < n - 1e-9; j++) ev.push({ pos: fillFrom + j * step, v: 'tom', m: tt[j % 4] - (j >= 4 ? 5 : 0), vel: 0.55 + 0.04 * j });
    } else { // bones: «скелет-ксилофон» триолями вверх по аккорду
      const tt = tones.map(m => wrap(m, 72)).sort((a, b) => a - b); tt.push(tt[0] + 12);
      for (let j = 0; j * (2 / 3) < n - 1e-9; j++) ev.push({ pos: fillFrom + j * (2 / 3), v: 'bones', m: tt[j % tt.length] + 12 * Math.floor(j / tt.length), vel: 0.6 });
    }
  }
  k.mem.lastFill = fillBar;

  // провалы: «стоп-тайм» (все бьют только первую долю) или «тонко» (без бочки и компа)
  if (S.drop > 0 && B.i > 0 && B.i % 4 !== 3 && !fillBar && r() < S.drop * (k.pass > 0 ? 1.5 : 1)) {
    const stop = r() < 0.5, rhythm = { bass: 1, comp: 1, kick: 1, snare: 1, hat: 1, tom: 1 };
    for (let j = ev.length - 1; j >= 0; j--) {
      const e = ev[j];
      if (stop ? (rhythm[e.v] && e.pos > 0.05) : (e.v === 'kick' || e.v === 'comp')) ev.splice(j, 1);
    }
    if (stop && on.k && !ev.some(e => e.v === 'kick')) ev.push({ pos: 0, v: 'kick', vel: 0.9 });
  }
  return ev;
}

// Чистая проверка нот без звука (для тестов): такты с аккордами и событиями.
export function renderSongNotes(name, nBars, opts = {}) {
  const S = name === 'fight' ? FIGHTS[opts.variant || 0] : SONGS[name];
  const seed = opts.seed ?? 1, mem = { prevBass: null, arpPat: 0, lastFill: false }, bars = [];
  for (let i = 0; i < nBars; i++) {
    const bar = barAt(S, i); if (!bar) break;
    const nx = barAt(S, i + 1);
    const events = genBar(S, bar.B, { r: mulberry32(hash2(seed, i)), pass: bar.pass, tr: bar.tr, next: nx && nx.B, nextTr: nx ? nx.tr : bar.tr, mem });
    bars.push({ i, sec: bar.B.sec, pass: bar.pass, tr: bar.tr, chords: bar.B.chords.map(c => ({ name: c.name, root: S.key + bar.tr + c.root, ivs: c.ivs, start: c.start, len: c.len })), events });
  }
  return { S, bars, cycle: S.intro.length + S.loop.length * S.mod.length };
}

// ---------------------------------------------------------------- звуковой движок
const BUSES = {
  bass:  { layer: 'core',    f: ['lowpass', 900, 0.7],   pan: 0,     lvl: 0.6,  rev: 0.06, dly: 0 },
  pluck: { layer: 'arp',     f: ['lowpass', 3200, 0.5],  pan: -0.28, lvl: 0.6,  rev: 0.28, dly: 0.12, trem: 5.3 },
  pad:   { layer: 'core',    f: ['lowpass', 1700, 0.5],  pan: 0,     lvl: 0.45, rev: 0.4,  dly: 0, trem: 4.4 },
  lead:  { layer: 'core',    f: ['lowpass', 2400, 0.6],  pan: 0.06,  lvl: 0.36, rev: 0.32, dly: 0.2 },
  lead2: { layer: 'core',    f: ['lowpass', 4200, 0.5],  pan: 0.06,  lvl: 0.45, rev: 0.3,  dly: 0.18 },
  bell:  { layer: 'counter', f: ['lowpass', 4500, 0.5],  pan: 0.32,  lvl: 0.5,  rev: 0.4,  dly: 0.22 },
  kick:  { layer: 'drums',   f: null,                    pan: 0,     lvl: 0.6,  rev: 0.03, dly: 0 },
  snare: { layer: 'drums',   f: ['bandpass', 2200, 0.8], pan: 0.08,  lvl: 0.8,  rev: 0.16, dly: 0 },
  tom:   { layer: 'drums',   f: null,                    pan: -0.12, lvl: 0.42, rev: 0.22, dly: 0 },
  hat:   { layer: 'perc',    f: ['highpass', 6500, 0.6], pan: 0.22,  lvl: 0.42, rev: 0.08, dly: 0 },
};
const LAYER_AT = { perc: [0.1, 0.15], arp: [0.25, 0.15], drums: [0.45, 0.15], counter: [0.7, 0.15] };
const layerGain = (L, x) => L === 'core' ? 1 : clamp01((x - LAYER_AT[L][0]) / LAYER_AT[L][1]);
const FM = {
  celesta: { ratio: 4, idx: 1.4, idxT: 0.07, dec: 1.1, pk: 0.26 },
  xylo:    { ratio: 3.02, idx: 2.2, idxT: 0.02, dec: 0.3, pk: 0.34 },
  vibes:   { ratio: 4, idx: 0.6, idxT: 0.18, dec: 1.4, pk: 0.2 },
};
function swingBeat(b, s) { const i = Math.floor(b), f = b - i; return i + (f < 0.5 ? f * 2 * s : s + (f - 0.5) * 2 * (1 - s)); }

export function createMusicEngine(ac, dest, getVol = () => 1, opt = {}) {
  const G = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const wave = (amps) => { const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1); amps.forEach((a, i) => { im[i + 1] = a; }); return ac.createPeriodicWave(re, im); };
  const W = {
    bass: wave([1, 0.45, 0.2, 0.1, 0.05, 0.025]),
    organ: wave([1, 0.6, 0.25, 0.35, 0, 0.12, 0, 0.1]),
    there: wave([1, 0.22, 0.09, 0.04, 0.015]),
    harp: wave(Array.from({ length: 14 }, (_, i) => 1 / (i + 1) * (i % 2 ? 0.8 : 1))),
  };
  // общий шумовой буфер (1 с) и импульс реверберации (2.1 с, тёмный хвост)
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const imp = ac.createBuffer(2, Math.floor(ac.sampleRate * 2.1), ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch), n = d.length, pre = Math.floor(ac.sampleRate * 0.012); let lp = 0;
    for (let i = pre; i < n; i++) { const x = (i - pre) / (n - pre); lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.4 * x); d[i] = lp * Math.pow(1 - x, 2.6); }
  }

  const out = G(0.8); out.connect(dest);
  const warm = ac.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 5500; warm.Q.value = 0.5; warm.connect(out);
  const mIn = G(1); mIn.connect(warm);
  const songDry = G(0); songDry.connect(mIn);
  const revIn = G(0), revHP = ac.createBiquadFilter(), conv = ac.createConvolver(), revOut = G(0.3);
  revHP.type = 'highpass'; revHP.frequency.value = 220; conv.buffer = imp;
  revIn.connect(revHP); revHP.connect(conv); conv.connect(revOut); revOut.connect(mIn);
  const dlyIn = G(0), dly = ac.createDelay(1.5), fb = G(0.28), dlyLP = ac.createBiquadFilter(), dlyOut = G(0.45);
  dly.delayTime.value = 0.36; dlyLP.type = 'lowpass'; dlyLP.frequency.value = 2200;
  dlyIn.connect(dly); dly.connect(dlyLP); dlyLP.connect(fb); fb.connect(dly); dlyLP.connect(dlyOut); dlyOut.connect(mIn);
  const fadeParams = [songDry.gain, revIn.gain, dlyIn.gain];

  const bus = {}, lfos = [];
  for (const [name, d] of Object.entries(BUSES)) {
    const b = { def: d, in: G(1), post: G(d.lvl) }; let node = b.in;
    if (d.f) { const f = ac.createBiquadFilter(); f.type = d.f[0]; f.frequency.value = d.f[1]; f.Q.value = d.f[2]; node.connect(f); node = f; }
    if (d.trem) {
      const tg = G(1), lfo = ac.createOscillator(); b.tremDepth = G(0); lfo.frequency.value = d.trem;
      lfo.connect(b.tremDepth); b.tremDepth.connect(tg.gain); lfo.start(); lfos.push(lfo); b.trem = tg; node.connect(tg); node = tg;
    }
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = d.pan; node.connect(p); node = p; }
    node.connect(b.post); b.post.connect(songDry);
    if (d.rev) { const s = G(d.rev); b.post.connect(s); s.connect(revIn); }
    if (d.dly) { const s = G(d.dly); b.post.connect(s); s.connect(dlyIn); }
    bus[name] = b;
  }
  // терменвокс: один постоянный голос (портаменто и вибрато — автоматизацией параметров, без новых узлов)
  const T = { osc: ac.createOscillator(), amp: G(0), vlfo: ac.createOscillator(), vib: G(0), held: false, lastEnd: -1, lastF: 0 };
  T.osc.setPeriodicWave(W.there); T.osc.frequency.value = 440; T.osc.connect(T.amp); T.amp.connect(bus.lead.in);
  T.vlfo.frequency.value = 5.4; T.vlfo.connect(T.vib); T.vib.connect(T.osc.detune);
  T.osc.start(); T.vlfo.start();

  const hold = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } };
  const fadeTo = (v, t, dur) => fadeParams.forEach(p => { hold(p, t); p.linearRampToValueAtTime(v, t + dur); });
  function releaseLead(t) { hold(T.amp.gain, t); T.amp.gain.setTargetAtTime(0, t, 0.05); hold(T.osc.frequency, t); T.held = false; T.lastEnd = -1; }

  let st = null, intensity = 1, fadingUntil = 0;
  const queue = [], layerOffAt = {};
  const solo = opt.solo || null;

  // ---- голоса
  const vca = (t) => { const g = ac.createGain(); g.gain.setValueAtTime(0, t); return g; };
  const mkOsc = (w, f, t) => { const o = ac.createOscillator(); if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w); o.frequency.setValueAtTime(f, t); return o; };
  function vBass(e, t, d, dst) {
    const f = mtof(e.m), o = mkOsc(W.bass, f * 1.012, t), g = vca(t), pk = 0.55 * e.vel * (e.voice === 'pizz' ? 1 : e.voice === 'upright' ? 0.5 : 0.5);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    let end;
    if (e.voice === 'pizz') { g.gain.linearRampToValueAtTime(pk, t + 0.005); end = t + Math.min(d + 0.12, 0.42); g.gain.exponentialRampToValueAtTime(0.0008, end); }
    else {
      const soft = e.voice === 'soft';
      g.gain.linearRampToValueAtTime(pk, t + (soft ? 0.03 : 0.006)); g.gain.setTargetAtTime(0, t + 0.03, soft ? 0.9 : 0.4);
      g.gain.setTargetAtTime(0, t + d, soft ? 0.18 : 0.05); end = t + d + (soft ? 0.9 : 0.3);
    }
    o.connect(g); g.connect(dst); o.start(t); o.stop(end + 0.02);
  }
  function vHarp(e, t, d, dst) {
    const ms = [].concat(e.m), g = vca(t), pk = 0.2 * e.vel / Math.sqrt(ms.length), end = t + Math.min(Math.max(d, 0.15), 0.6) + 0.12;
    g.gain.linearRampToValueAtTime(pk, t + 0.003); g.gain.exponentialRampToValueAtTime(pk * 0.3, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0004, end);
    for (const m of ms) for (const dt of (ms.length > 1 ? [-5, 5] : [0])) { const o = mkOsc(W.harp, mtof(m), t); o.detune.setValueAtTime(dt, t); o.connect(g); o.start(t); o.stop(end + 0.02); }
    g.connect(dst);
  }
  function vFM(e, t, d, dst, P) {
    const ms = [].concat(e.m), amp = vca(t), pk = P.pk * e.vel / Math.sqrt(ms.length);
    const end = t + 0.002 + Math.min(P.dec, d + 0.6);
    amp.gain.linearRampToValueAtTime(pk, t + 0.002); amp.gain.exponentialRampToValueAtTime(0.0004, end);
    for (const m of ms) {
      const f = mtof(m), c = mkOsc('sine', f, t), mo = mkOsc('sine', f * P.ratio, t), mg = ac.createGain();
      mg.gain.setValueAtTime(f * P.idx, t); mg.gain.setTargetAtTime(f * P.idx * 0.03, t, P.idxT);
      mo.connect(mg); mg.connect(c.frequency); c.connect(amp); c.start(t); mo.start(t); c.stop(end + 0.02); mo.stop(end + 0.02);
    }
    amp.connect(dst);
  }
  function vPad(e, t, d, dst) {
    const g = vca(t), pk = 0.12 * e.vel / Math.sqrt(e.m.length);
    g.gain.linearRampToValueAtTime(pk, t + 0.14); g.gain.setValueAtTime(pk, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.35);
    for (const m of e.m) { const o = mkOsc(W.organ, mtof(m), t); o.detune.setValueAtTime((Math.random() - 0.5) * 8, t); o.connect(g); o.start(t); o.stop(t + d + 0.4); }
    g.connect(dst);
  }
  function vThere(e, t, d) {
    const S = st.S, f = mtof(e.m), p = T.osc.frequency, a = T.amp.gain, pk = 0.2 * e.vel;
    if (T.held && t <= T.lastEnd + 0.03) {
      // легато: скольжение к новой ноте; повтор той же ноты и «отрывистые» песни — короткий провал громкости
      const dip = Math.abs(f - T.lastF) < 0.5 ? 0.3 : (S.artic ?? 1);
      if (dip < 1) a.setTargetAtTime(pk * dip, t - 0.035, 0.012);
      p.setTargetAtTime(f, t - 0.005, S.glide); a.setTargetAtTime(pk, t, dip < 1 ? 0.02 : 0.05);
    }
    else {
      if (e.scoop) { p.setValueAtTime(f * 0.94, t); p.setTargetAtTime(f, t + 0.005, 0.05); }
      else if (T.lastEnd > 0 && t - T.lastEnd < 0.25) p.setTargetAtTime(f, t - 0.01, S.glide * 0.6);
      else p.setValueAtTime(f, t);
      a.setTargetAtTime(pk, t, 0.03);
      T.vib.gain.setValueAtTime(S.vib * 0.15, t); T.vib.gain.linearRampToValueAtTime(S.vib, t + 0.4);
    }
    const nx = queue.find(q => q.v === 'lead' && q.inst === 'theremin');
    T.held = !!nx && nx.t <= t + d + 0.02;
    if (!T.held) a.setTargetAtTime(0, t + Math.max(0.05, d - 0.04), 0.07);
    T.lastEnd = t + d; T.lastF = f;
  }
  function vNoise(t, dst, pk, att, dec) {
    const src = ac.createBufferSource(), g = vca(t);
    src.buffer = noise; g.gain.linearRampToValueAtTime(pk, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + att + dec);
    src.connect(g); g.connect(dst); src.start(t, Math.random() * 0.6); src.stop(t + att + dec + 0.02);
  }
  function vKick(e, t, dst) {
    const o = mkOsc('sine', 115, t), g = vca(t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11); g.gain.linearRampToValueAtTime(0.8 * e.vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.28);
  }
  function vTom(e, t, dst) {
    const f = mtof(e.m), o = mkOsc('sine', f * 1.5, t), g = vca(t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05); g.gain.linearRampToValueAtTime(0.55 * e.vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + 0.32);
  }
  const busOf = e => e.v === 'comp' ? 'pluck' : e.v === 'lead' ? (e.inst === 'theremin' ? 'lead' : 'lead2') : e.v === 'ctr' ? 'bell' : e.v === 'bones' ? 'tom' : e.v;
  function plucked(e, t, d, dst) { if (e.inst === 'harpsi') vHarp(e, t, d, dst); else vFM(e, t, d, dst, FM[e.inst] || FM.celesta); }
  function fire(e) {
    const bn = busOf(e), b = bus[bn];
    if (solo && !solo.includes(bn)) return;
    const L = b.def.layer;
    if (L !== 'core' && layerGain(L, intensity) === 0 && ac.currentTime > (layerOffAt[L] || 0)) return;
    if (getVol() <= 0.0001) return;
    const t = e.t, d = e.d, dst = b.in;
    switch (e.v) {
      case 'bass': vBass(e, t, d, dst); break;
      case 'pad': vPad(e, t, d, dst); break;
      case 'comp': case 'ctr': plucked(e, t, d, dst); break;
      case 'lead': if (e.inst === 'theremin') vThere(e, t, d); else plucked(e, t, d, dst); break;
      case 'kick': vKick(e, t, dst); break;
      case 'snare': vNoise(t, dst, 0.5 * e.vel, e.swish ? 0.03 : 0.002, e.swish ? 0.22 : 0.13); break;
      case 'hat': vNoise(t, dst, 0.4 * e.vel, 0.002, 0.045 + (e.open || 0) * 0.3); break;
      case 'tom': vTom(e, t, dst); break;
      case 'bones': vFM(e, t, d, dst, FM.xylo); break;
    }
  }

  function applySong(S, t) {
    for (const [name, b] of Object.entries(bus)) b.post.gain.setTargetAtTime(b.def.lvl * ((S.mix && S.mix[name]) ?? 1), t, 0.05);
    revOut.gain.setTargetAtTime(S.wet ?? 0.3, t, 0.05); out.gain.setTargetAtTime(0.8 * (S.vol ?? 1), t, 0.05);
    dly.delayTime.setValueAtTime(Math.min(1.2, 0.75 * 60 / S.bpm), t);
    bus.pluck.tremDepth.gain.setValueAtTime((S.trem || 0) * 0.5, t); bus.pluck.trem.gain.setValueAtTime(1 - (S.trem || 0) * 0.5, t);
    bus.pad.tremDepth.gain.setValueAtTime(0.06, t); bus.pad.trem.gain.setValueAtTime(0.94, t);
    T.vlfo.frequency.setValueAtTime(S.vibRate || 5.4, t);
  }
  function play(name, opts = {}) {
    if (!name) { stop(); return; }
    if (st && st.name === name && !opts.restart) return;
    let S = SONGS[name], variant = 0;
    if (name === 'fight') { variant = opts.variant ?? (fightNext = (fightNext + 1) % FIGHTS.length); S = FIGHTS[variant % FIGHTS.length]; }
    if (!S) { console.warn('music: unknown song', name); return; }
    const now = ac.currentTime, busy = !!st || fadingUntil > now;
    fadeTo(0, now, busy ? 0.25 : 0.01); releaseLead(now); queue.length = 0;
    const start = now + (busy ? 0.3 : 0.05);
    fadeParams.forEach(p => { p.setValueAtTime(0, start); p.linearRampToValueAtTime(1, start + 0.08); });
    applySong(S, start);
    st = { S, name, variant, seed: (opts.seed ?? Math.random() * 4294967296) >>> 0, i: 0, nextBarT: start, barDur: S.beats * 60 / S.bpm,
      then: opts.then || null, ended: false, endT: 0, marks: [], mem: { prevBass: null, arpPat: 0, lastFill: false } };
    tick();
  }
  function stop(fade = 0.8) {
    if (!st) return;
    const now = ac.currentTime;
    fadeTo(0, now, fade); releaseLead(now + fade * 0.5); queue.length = 0; st = null; fadingUntil = now + fade;
  }
  function setIntensity(x) {
    intensity = clamp01(+x || 0); const now = ac.currentTime;
    for (const b of Object.values(bus)) {
      const L = b.def.layer; if (L === 'core') continue;
      const tg = layerGain(L, intensity); if (tg === 0) layerOffAt[L] = now + 2.5;
      b.in.gain.setTargetAtTime(tg, now, 0.6);
    }
  }
  function tick(hz) {
    const now = ac.currentTime, horizon = hz ?? now + LOOKAHEAD;
    if (st && !st.ended && st.nextBarT < now - 0.05) { // проспали (вкладка в фоне) — перескакиваем, без залпа нот
      const skip = Math.ceil((now - st.nextBarT) / st.barDur) + 1;
      queue.length = 0; releaseLead(now); st.i += skip; st.nextBarT += skip * st.barDur;
    }
    let added = false;
    while (st && !st.ended && st.nextBarT < horizon + st.barDur) {
      const S = st.S, bar = barAt(S, st.i);
      if (!bar) { st.ended = true; st.endT = st.nextBarT + (S.tail ?? 1.5); break; }
      const nx = barAt(S, st.i + 1), spb = 60 / S.bpm, t0 = st.nextBarT;
      const evs = genBar(S, bar.B, { r: mulberry32(hash2(st.seed, st.i)), pass: bar.pass, tr: bar.tr, next: nx && nx.B, nextTr: nx ? nx.tr : bar.tr, mem: st.mem });
      for (const e of evs) {
        const b0 = swingBeat(e.pos / 2, S.swing);
        e.t = t0 + b0 * spb; e.d = e.len ? (swingBeat((e.pos + e.len) / 2, S.swing) - b0) * spb : 0.1;
        queue.push(e);
      }
      st.marks.push({ t: t0, i: st.i, sec: bar.B.sec, pass: bar.pass }); if (st.marks.length > 4) st.marks.shift();
      st.i++; st.nextBarT += st.barDur; added = true;
    }
    if (added) queue.sort((a, b) => a.t - b.t);
    while (queue.length && queue[0].t < horizon) { const e = queue.shift(); if (e.t >= now - 0.02 && st) fire(e); }
    if (st && st.ended && now >= st.endT) { const then = st.then; st = null; fadingUntil = now; if (then) play(then); }
  }
  function info() {
    if (!st) return { name: null };
    const now = ac.currentTime; let m = st.marks[0];
    for (const x of st.marks) if (x.t <= now) m = x;
    return { name: st.name, variant: st.variant, bar: m ? m.i : 0, section: m ? m.sec : '', pass: m ? m.pass : 0, queued: queue.length };
  }
  return { play, stop, setIntensity, tick, info };
}

// Офлайн-рендер для тестов: возвращает AudioBuffer.
export async function renderMusicOffline(name, seconds, opts = {}) {
  const sr = opts.sampleRate || 22050, off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const e = createMusicEngine(off, off.destination, () => 1, { solo: opts.solo });
  e.setIntensity(opts.intensity ?? 1);
  e.play(name, { variant: opts.variant, seed: opts.seed ?? 12345 });
  e.tick(seconds);
  return off.startRendering();
}

// ---------------------------------------------------------------- живой экземпляр
let eng = null, pending = null, pendingIntensity = 1;
export function musicInit(ac, dest, getVol) {
  if (eng) return;
  eng = createMusicEngine(ac, dest, getVol);
  eng.setIntensity(pendingIntensity);
  setInterval(() => eng.tick(), TICK_MS);
  if (pending) { eng.play(pending.name, pending.opts); pending = null; }
}
// Если звук ещё не разблокирован жестом, запоминаем запрос и включаем его при initAudio.
export function playMusic(name, opts = {}) { if (!eng) { pending = name ? { name, opts } : null; return; } eng.play(name, opts); }
export function stopMusic(fade) { if (!eng) { pending = null; return; } eng.stop(fade); }
export function setMusicIntensity(x) { pendingIntensity = x; if (eng) eng.setIntensity(x); }
export function musicInfo() { return eng ? eng.info() : null; }

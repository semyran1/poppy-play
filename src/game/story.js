// Сюжетные сцены по раскладкам оригинала (cut 1, Cut 2, Cut 4, Cut 5, Level Final, Cut 6, Cut Final): фоны и персонажи —
// векторы с ассетов оригинала. Координаты пересчитаны с 854×480 на 960×540 (×1,124).
// Реплики — из листов событий оригинала (osnova.set-text), с правкой опечаток; новое — в том же тоне («дерзко, но не мерзко»).
// Режиссура (docs/ATMOSPHERE.md §6): letterbox, камера с наездами и восьмёркой, набор текста с паузами,
// бипы голоса, удержанные биты, вставки-«кинокадры», мысли, пропуск удержанием.
// Единый стиль вставок и реакций — как у холодного открытия (ракорд 3-2-1): кремовая бумага, тушь, перфорация,
// плоские формы, ограниченная палитра P. Реакции в духе корейских дорам: тройной наезд, романтика, шок, уныние,
// капля пота и «венка», сплит-экран.
import { drawSceneBg, drawActor, drawPortrait, preload, loaded } from '../art/scenes.js';
import { drawVignette } from '../art/backgrounds.js';
import { text, wrap, FONT } from './ui.js';
import { view as VP } from '../engine/core.js';
import { sfx, playMusic } from '../engine/audio.js';
import { drawHeroine } from '../art/heroine.js';
import { drawHeroinePortrait, loadHeroineKey, drawHeroineKey } from '../art/heroineVec.js';

const W = 960, H = 540, LB = 54, LB_COL = '#0e0612', GOLD = '#ffd166', THINK = '#e6d9ff', TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  linear: k => k, inQuad: k => k * k, inCubic: k => k * k * k, outQuad: k => 1 - (1 - k) ** 2, outCubic: k => 1 - (1 - k) ** 3,
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2, outSine: k => Math.sin(k * Math.PI / 2),
  inOutCubic: k => k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2,
  outBack: k => { const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },
};
// Палитра «киноплёнки» (ракорд 3-2-1): бумага, тушь, красный акцент; розовый — романтика, голубой — пот и уныние
const P = {
  paper: '#f3e2c0', hi: '#fff6e2', sh: '#d8bf92', sepia: '#a9865a', ink: '#3a1a10', red: '#c8243a', redDk: '#8e1626',
  pink: '#f08aa4', gold: '#eaa83a', cool: '#a8d8ea', choc: '#6b3a22', film: '#120b07',
};
// Область рисования сцены. Ландшафт — дизайн-рамка 960×540 (как раньше); портрет (view.portrait) — окно кино или весь вид, см. «Портретная раскладка» ниже.
// W×H (выше) — размер МИРА (фоны 960×540); SW×SH — размер того, во что сейчас рисуют экранные слои (реакции, вспышки, ракорд…), SCX/SCY — центр камеры на нём.
let SW = 960, SH = 540, SCX = 480, SCY = 270, TOPPAD = LB + 30, PORT = false;
const area = (w, h, cx = w / 2, cy = h / 2, top = LB + 30) => { SW = w; SH = h; SCX = cx; SCY = cy; TOPPAD = top; };
const hash = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
const hex = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, n) => Math.round(v + (B[n] - v) * k)).join(',')})`; };

const IMG = {};
function img(name) { if (!IMG[name]) { IMG[name] = new Image(); IMG[name].src = `assets/poppy_${name}.png`; } return IMG[name]; }

const SPEAKERS = {
  'Поппи': { color: '#ff9ab8', side: 'left', portrait: 'poppy', voice: 1.6, key: 'poppy' },
  'Краш': { color: '#5ec2ff', side: 'right', portrait: 'crush', voice: 0.95, key: 'crush' },
  'Руда': { color: '#ff5a4a', side: 'right', portrait: 'ruda', voice: 0.72, key: 'ruda' },
};

// Стингеры: [звук, параметры, задержка с]
const STING = {
  dread: [['boom', { pitch: 0.42, vol: 0.55 }], ['hurt', { pitch: 0.3, vol: 0.2 }], ['boom', { pitch: 0.24, vol: 0.4 }, 0.45]],
  punch: [['thud', { pitch: 0.9, vol: 0.75 }], ['whoosh', { pitch: 0.7, vol: 0.35 }]],
  whip: [['whoosh', { pitch: 1.5, vol: 0.55 }]],
  ding: [['coin', { pitch: 0.55, vol: 0.5 }], ['pickup', { pitch: 0.5, vol: 0.4 }, 0.06], ['hurt', { pitch: 0.5, vol: 0.12 }, 0.1]],
  pop: [['pop', { pitch: 1.1, vol: 0.5 }]],
  heart: [['heal', { pitch: 1.35, vol: 0.32 }]],
  steam: [['heal', { pitch: 2.5, vol: 0.32 }], ['whoosh', { pitch: 0.8, vol: 0.3 }], ['heal', { pitch: 2.7, vol: 0.28 }, 0.32], ['heal', { pitch: 3.1, vol: 0.3 }, 0.7]],
  thunder: [['zap', { pitch: 0.5, vol: 0.25 }], ['boom', { pitch: 0.3, vol: 0.6 }, 0.25], ['thud', { pitch: 0.35, vol: 0.5 }, 0.32]],
  title: [['boom', { pitch: 0.5, vol: 0.6 }], ['levelup', { pitch: 0.5, vol: 0.3 }, 0.12]],
  run: [['whoosh', { pitch: 1.1, vol: 0.4 }, 0.55]],
  tick: [['coin', { pitch: 0.32, vol: 0.18 }], ['coin', { pitch: 0.28, vol: 0.18 }, 0.5], ['coin', { pitch: 0.32, vol: 0.18 }, 1.0]],
  heroic: [['levelup', { pitch: 0.75, vol: 0.22 }]],
  creak: [['hurt', { pitch: 0.25, vol: 0.15 }]],
  shock: [['zap', { pitch: 0.7, vol: 0.3 }], ['boom', { pitch: 0.55, vol: 0.45 }], ['thud', { pitch: 0.5, vol: 0.5 }, 0.05]],
  poof: [['pop', { pitch: 0.55, vol: 0.5 }], ['whoosh', { pitch: 0.9, vol: 0.35 }], ['heal', { pitch: 1.8, vol: 0.2 }, 0.15]],
  card: [['thud', { pitch: 0.6, vol: 0.35 }], ['whoosh', { pitch: 0.6, vol: 0.25 }]],
};
export const CAPTION = { intro: 'ПРОЛОГ', afterCinema: 'АНТРАКТ', afterStreet: 'ГЛАВА 2 · ФИНАЛ', afterGothic: 'ГЛАВА 3 · ФИНАЛ', finaleHug: 'ЭПИЛОГ', finaleWar: 'ЭПИЛОГ' };

// Шаг сцены: { bg, who, s, poppy:{x,y,h,img,exit,move}, crush:{x,y,h,run,enter}, ruda:{x,y,h,enter,weak,exit}, title, plate, card } + режиссура:
//   cam: { on:'poppy'|'crush'|'ruda'|'both', zoom, x, y, dx, dy, dur, ease, cut, whip, late, from:{…} }
//   beat, hold, auto, sfx, face, shake, tilt, style:'think', insert:'calendar'|{k,at:'end',dur,sfx}, push, dark,
//   trans:'iris'|'flash', mark (событие на «|» в тексте), outro:'burn', music, hop, pose:'key'.
//   if: 'lara'|'pajama'|'classic'|'new' — шаг только для наряда/героини (классическая героиня — всегда «Лара»).
//   fx: строка или массив — 'hearts', 'steam', 'pulse', 'lightning' и реакции-«дорамы»:
//     'zoom3' — тройной наезд склейками, 'romance' — розовый свет, боке, лепестки, 'shock' — вспышка-градиент
//     и радиальные линии, 'lines' — только линии, 'gloom' — синий тон, линии уныния, дождик из тучки,
//     'sweat' / 'vein' — капля пота / «венка»; цель через двоеточие: 'shock:ruda', 'sweat:crush'.
//   split: { a, b, zoom } — сплит-экран «два крупных плана».
//   poppy.move: число (откуда входит) или true (с прошлого места) — идёт пешком.
// В тексте: *трясётся*, ~волной~, | — пауза-событие.
const CRUSH_FACADE = { x: 585, y: 505, h: 152 };
const CRUSH_HALL = { x: 410, y: 518, h: 157 }, POPPY_HALL = { x: 550, y: 523, h: 150, img: 'stand' };
const RESTROOM_POPPY = { x: 270, y: 508, h: 150, img: 'stand' }, RUDA_DOWN = { x: 540, y: 478, h: 132, weak: true };

// Возвращение в зал (Cut 6 оригинала) — общее для обеих концовок
function cinemaReturn(end) {
  const war = end === 'war';
  return [
    { bg: 'hall', crush: CRUSH_HALL, poppy: { ...POPPY_HALL, move: 1020 }, ruda: null, trans: 'iris', who: null, s: '', auto: 1.5,
      cam: { from: { x: 480, y: 240, zoom: 1.2 }, x: 480, y: 320, zoom: 1.0, dur: 1.8, ease: 'inOutSine' }, push: 0.02 },
    { who: 'Поппи', s: 'Привет, я не сильно опоздала?', face: 'wink', cam: { on: 'poppy', zoom: 1.5, dur: 0.5 } },
    { who: 'Краш', s: 'Реклама только закончилась! А где ты пропадала?', cam: { on: 'crush', zoom: 1.6, cut: true } },
    { if: 'lara', who: 'Краш', s: 'Искала сокровища, как настоящая ~Лара Крофт~?' },
    { if: 'lara', who: 'Поппи', s: war ? 'Почти. Сражалась с древним злом.' : 'Почти. Договаривалась с древним злом.', face: 'smug', fx: 'sweat' },
    { if: 'pajama', who: 'Краш', s: 'Я уж думал, ты сбежала домой досыпать — в такой-то пижаме.' },
    { if: 'pajama', who: 'Поппи', s: 'Пижама — это боевая форма. Ты просто не знал.', face: 'smug', fx: 'sweat' },
    { who: 'Краш', s: 'Присаживайся, пожалуйста, я купил попкорн.', face: 'blush', insert: 'popcorn', fx: 'romance', sfx: 'heart', cam: { on: 'both', zoom: 1.35, dur: 0.5 } },
    { who: 'Поппи', s: 'Была очень длинная очередь! Давай смотреть?', face: 'wink' },
    { who: 'Краш', s: 'Давай! Держись, будет *страааашно!*', fx: 'lines:crush', sfx: 'whip', cam: { on: 'crush', zoom: 1.7, cut: true } },
    { who: 'Поппи', style: 'think', s: war ? '(Страшно мне будет через месяц.)' : '(Страшно мне будет через два часа.)', fx: 'sweat',
      insert: war ? 'calnext' : 'hourglass', cam: { on: 'poppy', zoom: 1.6, cut: true } },
    { who: 'Поппи', style: 'think', s: '(А сейчас я буду наслаждаться фильмом.)', cam: { on: 'both', zoom: 1.25, dur: 0.8 } },
    { who: 'Поппи', style: 'think', s: '(В отличной компании.)', face: 'blush', split: { a: 'poppy', b: 'crush', zoom: 2.0 }, fx: ['romance', 'hearts'], sfx: 'heart', hold: 0.8 },
    // у классической героини — арт оригинала (Cut Final), у новой — общий план зала
    { if: 'classic', bg: 'finale', poppy: null, crush: null, trans: 'iris', who: null, s: '', auto: 2.6, fx: 'romance',
      cam: { from: { x: 480, y: 270, zoom: 1.15 }, x: 480, y: 270, zoom: 1.0, dur: 3, ease: 'inOutSine' } },
    { if: 'new', who: null, s: '', fx: 'romance', auto: 2.0, cam: { x: 480, y: 300, zoom: 1.0, dur: 2.2, ease: 'inOutSine' } },
    { card: 'end', who: null, s: '', music: 'victory', sfx: 'card', auto: 8, push: 0 },
  ];
}

export const STORY = {
  intro: [
    // холодное открытие: стрекот проектора, ракорд 3-2-1, диафрагма открывается на фасад
    { cold: 'countdown', bg: 'facade', poppy: { x: 353, y: 502, h: 150, img: 'stand' }, cam: { x: 480, y: 324, zoom: 1.0, cut: true }, push: 0.02 },
    { who: 'Поппи', s: 'Привет!', face: 'wink', hop: true, sfx: 'pop', hold: 0.25, push: 0.02 },
    { who: 'Поппи', s: 'Меня зовут Поппи.', cam: { on: 'poppy', zoom: 1.25, dur: 2, ease: 'inOutSine' }, push: 0.02 },
    { who: 'Поппи', s: 'Сегодня у меня ~важный~ день.' },
    { who: 'Поппи', s: 'Мой краш пригласил меня в кино.', face: 'blush', fx: ['romance', 'hearts'], sfx: 'heart', insert: 'ticket', cam: { on: 'poppy', zoom: 1.5, cut: true } },
    { who: 'Поппи', s: 'Сказал, это будет *очень страшный* фильм!', face: 'smug', cam: { x: 480, y: 330, zoom: 1.04, cut: true } },
    { who: 'Поппи', s: 'Ха, готова поспорить, он испугается намного больше меня.', face: 'smug' },
    // панчлайн: удержанный бит, резкий наезд, стингер, вставка-календарь
    { who: 'Поппи', s: 'Ведь на самом деле я боюсь совсем другого…', beat: 0.9, dark: 0.35, face: 'panic', sfx: 'dread', shake: 0.15, fx: 'sweat',
      cam: { on: 'poppy', zoom: 1.75, dur: 0.12, ease: 'outQuad', late: true }, push: 0.02, insert: { k: 'calendar', at: 'end', dur: 1.9 }, hold: 0.7 },
    // Краш вбегает: камера хлыстом вправо
    { crush: { ...CRUSH_FACADE, run: true, enter: true }, who: 'Краш', s: 'Привет, Поппи!', beat: 0.45, sfx: 'whip',
      cam: { x: 610, y: 360, zoom: 1.4, dur: 0.18, ease: 'inOutCubic', whip: true } },
    // наряд: Лара — по умолчанию (и всегда у классической героини), пижама открывается после первой главы
    { if: 'lara', crush: CRUSH_FACADE, who: 'Краш', s: 'Костюм Лары Крофт, прикольно!', cam: { on: 'crush', zoom: 1.7, cut: true } },
    { if: 'pajama', crush: CRUSH_FACADE, who: 'Краш', s: 'Ты пришла… в пижаме? С персиками?', cam: { on: 'crush', zoom: 1.7, cut: true } },
    { if: 'pajama', who: 'Поппи', s: '', face: 'panic', fx: ['zoom3', 'sweat'], auto: 0.9 },
    { if: 'pajama', who: 'Краш', s: 'Это самый *смелый* костюм в зале!', sfx: 'heroic', cam: { on: 'crush', zoom: 1.6, cut: true } },
    // реакционный кадр: склейка на Поппи, без текста
    { who: 'Поппи', s: '', face: 'blush', pose: 'key', fx: ['romance:poppy', 'hearts'], sfx: 'heart', cam: { on: 'poppy', zoom: 1.55, dy: 70, cut: true }, auto: 1.1 },
    { if: 'pajama', who: 'Поппи', s: 'Это хэллоуинская пижама. Очень страшная. Персики — ~злые~.', face: 'wink', fx: 'sweat', cam: { on: 'poppy', zoom: 1.45, cut: true } },
    // сплит-экран: два крупных плана, розовый свет
    { who: 'Краш', s: 'Тебе очень идёт.', face: 'blush', split: { a: 'poppy', b: 'crush', zoom: 2.0 }, fx: 'romance', sfx: 'heart', hold: 0.5 },
    { who: 'Краш', s: 'Пойдём скорее в зал, а то всё пропустим!', cam: { on: 'both', zoom: 1.3, dur: 0.5 } },
    // кинозал: общий план «краном» вниз, затем мысль-паника
    { bg: 'hall', crush: CRUSH_HALL, poppy: POPPY_HALL, trans: 'iris', who: null, s: '', auto: 0.9,
      cam: { from: { x: 480, y: 240, zoom: 1.2 }, x: 480, y: 320, zoom: 1.0, dur: 1.8, ease: 'inOutSine' }, push: 0.02 },
    // «началось»: шок-вспышка и тройной наезд
    { who: 'Поппи', style: 'think', s: '(Внезапно началось то, чего я так боялась!)', beat: 0.5, tilt: 4, fx: ['pulse', 'shock', 'zoom3'], sfx: 'ding', shake: 0.35, shakeText: true, face: 'panic',
      push: 0.01, hold: 0.6 },
    { who: 'Поппи', s: 'Мне нужно отлучиться, можешь пока занять места.', face: 'panic', fx: 'sweat', cam: { on: 'both', zoom: 1.45, dur: 0.4 } },
    { who: 'Поппи', s: 'И купить попкооорн!', face: 'wink', insert: 'popcorn', sfx: 'pop', cam: { on: 'poppy', zoom: 1.65, cut: true } },
    { poppy: { ...POPPY_HALL, img: 'run1', exit: true }, who: 'Поппи', s: 'Я быстро!', sfx: 'run', auto: 1.2, outro: 'burn',
      cam: { on: 'both', zoom: 1.35, dx: 70, dur: 0.9, ease: 'inOutSine' } },
  ],
  afterCinema: [
    { bg: 'queue', poppy: { x: 332, y: 496, h: 252, img: 'stand' }, trans: 'iris', who: 'Поппи', style: 'think', s: '(Ля-я, у туалета огромная очередь!)', beat: 1.0, face: 'panic', fx: 'gloom',
      cam: { from: { x: 650, y: 250, zoom: 1.2 }, on: 'poppy', zoom: 1.04, dur: 2.4, ease: 'inOutSine' }, insert: { k: 'wc', at: 'end', dur: 1.7 } },
    { who: 'Поппи', s: 'Мне нужно поторопиться, если хочу не опоздать.', insert: 'clock', sfx: 'tick', face: 'panic', fx: 'sweat' },
    { if: 'lara', who: 'Поппи', s: 'Похоже, меня ждёт приключение, достойное ~Лары Крофт~.', face: 'smug', pose: 'key', sfx: 'heroic', cam: { on: 'poppy', zoom: 1.1, dy: 80, dur: 0.9, ease: 'inOutSine' } },
    { if: 'pajama', who: 'Поппи', s: 'Похоже, меня ждёт приключение, достойное ~Лары Крофт~. Пижамное издание!', face: 'smug', pose: 'key', sfx: 'heroic', cam: { on: 'poppy', zoom: 1.1, dy: 80, dur: 0.9, ease: 'inOutSine' } },
    { who: 'Поппи', s: 'А ещё ощущения становятся всё неприятней, |и я начинаю понемногу *закипать!!!*', beat: 0.6, face: 'panic',
      cam: { on: 'poppy', zoom: 1.12, dur: 0.6 }, insert: { k: 'kettle', at: 'end', dur: 2.2, sfx: 'steam' },
      mark: { tilt: 3, shake: 0.3, face: 'angry', fx: ['steam', 'vein'], sfx: 'punch', cam: { on: 'poppy', zoom: 1.28, dur: 0.14, ease: 'outQuad' } } },
    { poppy: { x: 332, y: 496, h: 252, img: 'run2' }, who: 'Поппи', s: 'Но я разберусь со всем этим и с тем, кто это устроил!', face: 'angry', sfx: 'punch', shake: 0.2, fx: ['lines', 'vein'],
      cam: { on: 'poppy', zoom: 1.0, dy: 40, cut: true }, push: 0.1 },
    { bg: 'title', poppy: null, title: true, who: null, s: '', trans: 'flash', sfx: 'title', push: 0,
      cam: { from: { x: 480, y: 270, zoom: 1.25 }, x: 480, y: 270, zoom: 1.0, dur: 3.5, ease: 'outCubic' } },
  ],
  afterStreet: [
    { bg: 'castle', poppy: { x: 470, y: 470, h: 120, img: 'stand' }, trans: 'iris', who: 'Поппи', style: 'think', s: '(Похоже, мне туда.)', beat: 1.1, fx: 'lightning',
      cam: { from: { x: 700, y: 210, zoom: 1.35 }, x: 480, y: 310, zoom: 1.0, dur: 2.8, ease: 'inOutSine' } },
    { who: 'Поппи', s: 'Ну и местечко.', sfx: 'creak', fx: 'gloom', cam: { on: 'poppy', zoom: 2.0, cut: true } },
    { who: 'Поппи', s: 'Это что? Заброшенное здание в готическом стиле?', cam: { x: 640, y: 250, zoom: 1.18, dur: 1.8, ease: 'inOutSine' } },
    { who: 'Поппи', s: 'Мрак, лужи и полное отсутствие комфорта. |Что вы смеётесь?', cam: { on: 'poppy', zoom: 1.3, dur: 0.5 }, hold: 0.4,
      mark: { cam: { on: 'poppy', zoom: 2.7, dy: 40, cut: true }, sfx: 'punch', face: 'angry', fx: 'vein' } },
    { bg: 'castle', poppy: null, plate: { top: 'ГЛАВА 3', title: '«Готика»' }, who: null, s: '', fx: 'lightning', sfx: 'card', auto: 3.2,
      cam: { x: 600, y: 250, zoom: 1.15, dur: 4, ease: 'inOutSine' } },
  ],
  // После главы 3 (готика, босс «Королева ПМС»): кабинка и Руда. Диалог — Level Final оригинала.
  afterGothic: [
    { bg: 'gothic', poppy: { x: 480, y: 505, h: 150, img: 'stand' }, trans: 'iris', who: 'Поппи', s: 'Королева ПМС повержена. Корона ей всё равно не шла.', beat: 0.7, face: 'smug',
      cam: { from: { x: 480, y: 230, zoom: 1.3 }, x: 480, y: 320, zoom: 1.0, dur: 2.2, ease: 'inOutSine' }, insert: { k: 'crown', at: 'end', dur: 1.9 } },
    { who: 'Поппи', s: 'Лужи, фонтаны, мрачная атмосферка… Зато я почти у цели!', face: 'wink', cam: { on: 'poppy', zoom: 1.4, dur: 0.8 } },
    { bg: 'restroom', poppy: RESTROOM_POPPY, trans: 'iris', who: 'Поппи', style: 'think', s: '(Свободная кабинка. Неужели?..)', beat: 0.6, face: 'wink', sfx: 'heroic',
      cam: { from: { x: 450, y: 250, zoom: 1.5 }, x: 480, y: 300, zoom: 1.0, dur: 2.0, ease: 'inOutSine' }, insert: { k: 'unlock', at: 'end', dur: 1.9 } },
    // дверь открывается — а там Руда
    { ruda: { x: 470, y: 436, h: 128, enter: true }, who: null, s: '', sfx: 'dread', fx: ['shock:ruda', 'zoom3:ruda'], dark: 0.12, auto: 1.1 },
    { who: 'Поппи', s: 'Ну привет! Может, объяснишь мне, почему ты так себя ведёшь?', face: 'angry', fx: 'vein', cam: { on: 'both', zoom: 1.2, dur: 0.5 } },
    { who: 'Руда', s: 'Привет, Поппи!', cam: { on: 'ruda', zoom: 1.7, cut: true } },
    { if: 'lara', who: 'Руда', s: 'Костюм Лары Крофт? А тебе идёт!' },
    { if: 'pajama', who: 'Руда', s: 'Пижама с персиками? Смело. Мне нравится.' },
    { if: 'pajama', who: 'Поппи', s: 'Спасибо… Стоп. Не подлизывайся!', face: 'angry', fx: 'vein', cam: { on: 'poppy', zoom: 1.6, cut: true } },
    { who: 'Руда', s: 'Почему ты тут?', cam: { on: 'ruda', zoom: 1.7, cut: true } },
    { who: 'Поппи', s: 'Это почему ты тут? Я, конечно, понимаю, но почему *сегодня???*', face: 'angry', fx: ['vein', 'lines'], shake: 0.25, cam: { on: 'poppy', zoom: 1.6, cut: true } },
    { who: 'Поппи', s: 'Ты знаешь, какой сегодня день?', insert: 'calendar' },
    { who: 'Руда', s: 'Какой-то нелепый праздник?', fx: 'sweat', cam: { on: 'both', zoom: 1.3, dur: 0.4 } },
    { who: 'Руда', s: 'Ты же понимаешь, что это не важно?' },
    { who: 'Руда', s: 'Пришло время проверить твоё умение ~держать себя в руках~.', fx: 'lines:ruda', sfx: 'creak', cam: { on: 'ruda', zoom: 1.8, dur: 0.3 } },
    { who: 'Руда', s: 'Ты знаешь об этом, но ты здесь. Чего ты хочешь?' },
    { who: 'Поппи', s: 'Да, я всё понимаю. Но сегодня очень важный день.', face: 'panic', cam: { on: 'poppy', zoom: 1.5, cut: true } },
    { who: 'Поппи', s: 'Парень, который мне нравится, позвал меня в кино. Он ждёт меня в зале.', face: 'blush', fx: 'romance:poppy', sfx: 'heart', insert: 'ticket' },
    { who: 'Поппи', s: 'Дай мне два часа, а потом я вернусь, и мы с тобой разберёмся!', face: 'angry', cam: { on: 'both', zoom: 1.2, dur: 0.4 } },
    { who: 'Руда', s: 'Два часа? Сначала докажи, что умеешь держать себя в руках!', beat: 0.4, fx: 'shock:ruda', sfx: 'thunder', shake: 0.35,
      cam: { on: 'ruda', zoom: 2.0, dur: 0.12, ease: 'outQuad', late: true } },
    { who: null, s: '', split: { a: 'poppy', b: 'ruda', zoom: 2.0 }, fx: 'lines:poppy', sfx: 'punch', auto: 1.5 },
    { who: null, s: '', plate: { top: 'ФИНАЛ', title: 'Руда', sub: 'соседка, что приходит раз в месяц' }, dark: 0.45, sfx: 'card', auto: 3, cam: { x: 480, y: 300, zoom: 1.0, cut: true }, push: 0.03 },
  ],
  // Концовка «обнять»: мир. Руда — не монстр, а соседка; «У тебя 2 часа» — реплика оригинала.
  finaleHug: [
    { bg: 'restroom', poppy: RESTROOM_POPPY, ruda: RUDA_DOWN, trans: 'iris', who: 'Руда', s: 'Ну… давай. Добивай.', beat: 0.6, fx: 'gloom:ruda',
      cam: { from: { x: 480, y: 250, zoom: 1.3 }, on: 'both', zoom: 1.15, dur: 1.8, ease: 'inOutSine' } },
    { who: 'Поппи', s: 'Нет.', beat: 0.5, cam: { on: 'poppy', zoom: 1.8, cut: true }, hold: 0.4 },
    { who: 'Поппи', s: 'Ты не монстр. Ты просто… ~соседка, что приходит раз в месяц~.', cam: { on: 'both', zoom: 1.25, dur: 0.6 } },
    { who: 'Руда', s: 'Меня обычно встречают таблетками и проклятиями.', fx: 'sweat:ruda', cam: { on: 'ruda', zoom: 1.7, cut: true } },
    { who: 'Поппи', s: 'А я встречу обнимашками.', face: 'blush', cam: { on: 'poppy', zoom: 1.6, cut: true } },
    { poppy: { ...RESTROOM_POPPY, x: 468, y: 502, move: true }, ruda: { ...RUDA_DOWN, weak: false }, who: null, s: '', fx: ['romance', 'hearts'], sfx: 'heart', auto: 1.6,
      cam: { on: 'both', zoom: 1.55, dur: 1.4, ease: 'inOutSine' } },
    { who: 'Руда', s: '…Тёплая. Ладно, Поппи, твоя взяла. По-хорошему.', face: 'blush', fx: ['romance', 'hearts'], sfx: 'heart' },
    { who: 'Руда', s: 'У тебя два часа.', insert: 'hourglass', cam: { on: 'ruda', zoom: 1.9, cut: true } },
    { who: 'Руда', s: 'А потом — грелка, шоколадка и сериальчик. Договорились, соседка?', insert: 'hotwater', cam: { on: 'both', zoom: 1.5, dur: 0.5 } },
    { who: 'Поппи', s: 'Договорились!', face: 'wink', hop: true, sfx: 'pop', fx: 'romance' },
    ...cinemaReturn('hug'),
  ],
  // Концовка «добить»: смешно, но с грустинкой — через месяц она всё равно вернётся.
  finaleWar: [
    { bg: 'restroom', poppy: RESTROOM_POPPY, ruda: RUDA_DOWN, trans: 'iris', who: 'Поппи', s: 'Это тебе за испорченное свидание!', beat: 0.4, face: 'angry', fx: ['lines', 'vein'], sfx: 'punch', shake: 0.4,
      cam: { on: 'poppy', zoom: 1.5, cut: true } },
    { who: 'Руда', s: 'Ай! Всё-всё-всё, сдаюсь!', fx: ['shock:ruda', 'sweat:ruda'], shake: 0.3, cam: { on: 'ruda', zoom: 1.8, cut: true } },
    { who: 'Руда', s: 'Ты победила. ~Сегодня~.', cam: { on: 'both', zoom: 1.2, dur: 0.6 } },
    { who: 'Руда', s: 'Но ты же знаешь: я вернусь. Через месяц. Как по календарю.', insert: { k: 'calnext', at: 'end', dur: 2.0 } },
    { who: 'Поппи', s: 'Знаю. В следующий раз встречу тебя с грелкой и шоколадкой наготове.', face: 'smug', insert: { k: 'hotwater', at: 'end' } },
    { who: 'Руда', s: 'Дерзко. Мне нравится. До встречи, соседка!', cam: { on: 'ruda', zoom: 1.6, cut: true } },
    { ruda: { ...RUDA_DOWN, exit: true }, who: null, s: '', sfx: 'poof', auto: 1.0, cam: { on: 'both', zoom: 1.1, dur: 0.8 } },
    { ruda: null, who: 'Поппи', style: 'think', s: '(Победа… а почему-то немного грустно.)', beat: 0.5, fx: 'gloom', cam: { on: 'poppy', zoom: 1.6, dur: 1.4, ease: 'inOutSine' } },
    { who: 'Поппи', style: 'think', s: '(Она ведь не злая. Просто всегда приходит не вовремя.)', fx: 'gloom' },
    { who: 'Поппи', s: 'Так! Хватит раскисать. Меня ждёт кино!', face: 'angry', fx: 'lines', sfx: 'punch', shake: 0.2, cam: { on: 'poppy', zoom: 1.3, cut: true } },
    ...cinemaReturn('war'),
  ],
};

export function storyAssets(key) {
  return [...new Set((STORY[key] || []).flatMap(s => [s.bg, s.crush ? (s.crush.run ? 'crushRun' : 'crush') : null, s.ruda ? 'ruda' : null]).filter(Boolean).concat(['crush']))];
}

// ---------- Набор текста ----------
const PAUSE = { ',': 0.08, '.': 0.25, '!': 0.2, '?': 0.2, '…': 0.45, ':': 0.12, ';': 0.12, '—': 0.1 };
const CLOSERS = ')»"';
const isP = c => c in PAUSE || CLOSERS.includes(c);
function parseLine(src, think) {
  const s = think ? src.replace(/^\((.*)\)$/s, '$1') : src;   // скобки мыслей заменяет лавандовая плашка
  const chars = []; let shake = false, wave = false;
  for (const c of s) {
    if (c === '*') { shake = !shake; continue; }
    if (c === '~') { wave = !wave; continue; }
    if (c === '|') { if (chars.length) chars[chars.length - 1].mark = true; continue; }
    chars.push({ c, shake, wave, t: 0 });
  }
  for (let k = 0; k < chars.length;) {   // растянутые буквы («попкооорн») — по 120 мс
    let e = k; const lc = chars[k].c.toLowerCase();
    while (e < chars.length && chars[e].c.toLowerCase() === lc) e++;
    if (e - k >= 3 && /\p{L}/u.test(lc)) for (let q = k; q < e; q++) chars[q].slow = true;
    k = e;
  }
  let T = 0;
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k]; ch.t = T;
    T += ch.slow ? 0.12 : 1 / 38;
    const nx = chars[k + 1];
    if (isP(ch.c) && nx && !isP(nx.c)) {   // пауза в конце кластера знаков — по самому «тяжёлому»
      let m = 0; for (let q = k; q >= 0 && isP(chars[q].c); q--) m = Math.max(m, PAUSE[chars[q].c] || 0);
      T += m;
    }
    if (ch.mark) T += 0.6;
  }
  return { chars, total: T, laid: false };
}
function layoutLine(ctx, L, maxW) {
  const words = []; let cur = [];
  L.chars.forEach((ch, k) => { if (ch.c === ' ') { words.push(cur); cur = []; } else cur.push(k); }); words.push(cur);
  const sw = ctx.measureText(' ').width; let x = 0, line = 0;
  for (const w of words) {
    const ww = w.reduce((a, k) => a + (L.chars[k].w = ctx.measureText(L.chars[k].c).width), 0);
    if (x > 0 && x + ww > maxW) { x = 0; line++; }
    for (const k of w) { L.chars[k].x = x; L.chars[k].line = line; x += L.chars[k].w; }
    x += sw;
  }
  // точные позиции — по ширине префикса строки (с кернингом), а не суммой отдельных букв
  let curLine = -1, acc = '';
  L.chars.forEach((ch, k) => {
    if (ch.c === ' ') { if (curLine >= 0) acc += ' '; return; }
    if (ch.line !== curLine) { curLine = ch.line; acc = ''; }
    ch.x = ctx.measureText(acc).width; acc += ch.c;
  });
  L.laid = true; L.lines = line + 1;
}

// ---------- Раскладка интерфейса ----------
const PX = 148, PY = 404, PW = 664, PH = 122;         // плашка диалога лежит на нижней полосе
const SLOT = { size: 108, y: 380, left: 28, right: 824 };
const SB = { x: 826, y: 490, w: 114, h: 36 };          // «Пропустить» (удержание 0,8 с)
const COLD = { lead: 0.9, num: 0.5, flash: 2.4, reveal: 2.5, dur: 3.25 };
const CRUSH_K = 1.5;   // Краш и Руда рядом с новой героиней: её рост на экране ≈ 1,45 h (лист персонажа), их вектор — во весь рост h

// ---------- Портретная раскладка (view.portrait: W = 540…630, H = 840…1260) ----------
// Сверху узкая полоса: подпись главы и «Пропустить» (≥ 44 CSS px). Под ней «окно кино» ≈ 58–60 % высоты: тот же кадр, что в ландшафте (камера ведётся в ландшафтных
// координатах, по вертикали план тот же: zoom·K, K = высота окна / 432 — как у кадра 960×432 между чёрными полосами), по горизонтали окно узкое → portraitCam(). Внизу плашка диалога:
// портреты по краям верхнего ряда, имя рядом с говорящим, крупный текст (22–24 лог. px ≈ 15–17 CSS px на телефоне). Считается заново на каждый кадр: поворот и смена размера — на лету.
export function portLay(V = VP) {
  const sc = V.scale, sf = V.safe, side = 12;
  const skH = clamp(Math.ceil(46 / sc), 40, 68), skW = clamp(Math.ceil(110 / sc), 150, 210);
  const top = sf.t + skH + 16, bot = sf.b + 14, free = V.H - top - bot;
  let wh = Math.min(Math.round(free * 0.66), Math.round(432 * 1.7)), ph = clamp(free - wh - 12, 0, 420);
  if (ph < 250) { wh -= 250 - ph; ph = 250; }
  const py = V.H - bot - ph, ps = clamp(Math.round(ph * 0.4), 96, 150), font = ph >= 330 ? 26 : ph >= 285 ? 24 : 22, lh = Math.round(font * 1.36);
  const textTop = py + 14 + ps + 8, textH = ph - (textTop - py) - 32;
  return {
    ww: V.W, wy: top, wh, K: wh / 432, px: side + sf.l, pw: V.W - 2 * side - sf.l - sf.r, py, ph, ps, font, lh, textTop, textH, maxLines: Math.max(2, Math.floor(textH / lh)),
    skip: { x: V.W - sf.r - side - skW, y: sf.t + 8, w: skW, h: skH },
  };
}

export function createStory(app, key, onDone) {
  const inp = app.inp;
  const outfit = () => app.save.outfit || 'lara';
  const hero = () => app.save.hero || 'new';
  const look = () => hero() === 'classic' ? 'lara' : outfit();          // классическая героиня всегда в «Ларе»
  const okIf = c => !c || [].concat(c).every(k => k === 'classic' ? hero() === 'classic' : k === 'new' ? hero() !== 'classic' : k === look());
  const AK = () => hero() === 'classic' ? 1 : CRUSH_K;
  let steps = [];
  let i, t, stepT, st, R, phase, closeT, outroT, outroDur, outroKind, lbT, panelK, skipK, armed, done;
  let tw, pushT, pushDur, pushAmt, tilt, tiltTarget, trauma, flash, lightning, pulse, dark, darkTarget;
  let loadWait = 0, prevWho, whoT, face, faceT, parts, queue, ins, irisT, lastClack, coldN, view, burnAt, nextBolt;
  let insK = 0, insSide = 1, pBase = null;   // портрет: «карточка-вставка» уводит говорящего в сторону; pBase — последняя портретная камера (до наезда и тряски)
  // реакции-«дорамы»
  let evq, romanceK, romanceT, romanceOn, gloomK, gloomT, gloomOn, shock, stamps, split, splitK, splitOn, poofDone, BASE, shk;

  // --- камера ---
  function faceOf(name) {
    if (name === 'poppy' && st.poppy) { const p = st.poppy; return { x: p.x, y: p.y - p.h * (hero() === 'classic' ? 0.86 : 1.28) }; }
    if (name === 'crush' && st.crush) { const c = st.crush; return { x: c.x, y: c.y - c.h * AK() * 0.8 }; }
    if (name === 'ruda' && st.ruda) { const r = st.ruda; return { x: r.x, y: r.y - r.h * AK() * 0.68 }; }
    if (name === 'both') { const a = faceOf('poppy'), b = faceOf(otherKey()); if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return a || b; }
    return null;
  }
  const otherKey = () => st.crush ? 'crush' : st.ruda ? 'ruda' : null;
  // экранный «масштаб лица» (1 ≈ новая героиня h=150 на общем плане)
  function unitOf(name) {
    if (name === 'poppy' && st.poppy) return st.poppy.h * (hero() === 'classic' ? 1 : 1.45) / 218;
    if (name === 'crush' && st.crush) return st.crush.h * AK() / 218;
    if (name === 'ruda' && st.ruda) return st.ruda.h * AK() / 218;
    return 1;
  }
  function clampCam(c, lb = LB) {
    const hw = 480 / c.z, hh = (270 - lb) / c.z;
    return { x: hw >= 480 ? 480 : clamp(c.x, hw, W - hw), y: hh >= 270 ? 270 : clamp(c.y, hh, H - hh), z: c.z };
  }
  function resolveCam(c, from) {
    const z = c.zoom ?? from.z; let x = c.x, y = c.y;
    if (c.on) { const f = faceOf(c.on); if (f) { x = f.x + (c.dx || 0); y = f.y + (c.dy ?? 50) / z; } }   // лицо — в верхней трети, над плашкой
    return clampCam({ x: x ?? from.x, y: y ?? from.y, z });
  }
  const pushF = () => 1 + pushAmt * EASE.outSine(clamp(pushT / pushDur, 0, 1));
  function camNow() {
    const k = tw.dur <= 0 ? (tw.t >= 0 ? 1 : 0) : clamp(tw.t / tw.dur, 0, 1), e = (EASE[tw.ease] || EASE.inOutSine)(k);
    return { x: lerp(tw.from.x, tw.to.x, e), y: lerp(tw.from.y, tw.to.y, e), z: lerp(tw.from.z, tw.to.z, e) };
  }
  function moveCam(c, s, reverseTo) {
    const cur = camNow(); let from = clampCam({ x: cur.x, y: cur.y, z: cur.z * pushF() });
    let to = from, dur = 0.6, ease = 'inOutSine', delay = 0, whip = false;
    if (c) {
      if (c.from) from = resolveCam(c.from, from);
      to = resolveCam(c, from); dur = c.cut ? 0 : (c.dur ?? 0.6); ease = c.ease || ease;
      delay = c.late ? (s?.beat || 0) : (c.delay || 0); whip = !!c.whip;
    } else if (reverseTo) { to = resolveCam({ on: reverseTo, zoom: 1.5 }, from); dur = 0.35; }   // восьмёрка
    else if (from.z > 2.3) { to = clampCam({ x: 480, y: 330, z: 1 }); dur = 0; }                   // наезд упёрся — склейка на общий
    // портрет: цель камеры (кого ведём) и откуда стартует портретная камера (непрерывно с предыдущего кадра)
    const on = c ? (c.on ?? (c.x !== undefined || c.y !== undefined ? null : tw.on)) : reverseTo ?? (from.z > 2.3 ? null : tw.on);
    const pFrom = pBase ? { x: pBase.x, y: pBase.y, z: pBase.z * pushF(), mode: pBase.mode } : null;
    tw = { from, to, t: -delay, dur, ease, whip, on, dx: c?.dx || 0, pFrom };
    pushT = 0;
  }
  const toScreen = (p, v) => ({ x: (p.x - v.x) * v.z + SCX, y: (p.y - v.y) * v.z + SCY });

  // --- портретная камера ---
  // Камера story ведётся в ландшафтных координатах (tw: from → to) и не знает о раскладке. В портрете окно узкое (≈ 0,39 ширины кадра), поэтому
  // portraitCam(L) пересчитывает цель: тот же вертикальный план (zoom·K), по горизонтали — на том, кого ведёт камера (tw.on): один герой — на нём;
  // двое ('both') — общий вид, а если пара не помещается в 540 даже при отъезде до «обложки» фона — камера держит говорящего. Явная панорама (x, y) сохраняется, но говорящий
  // всегда остаётся в кадре. Пока на экране вставка-карточка, говорящий уезжает в сторону, противоположную карточке (insK).
  const speakerKey = () => { const k = SPEAKERS[R.s.who]?.key; return k && st[k] ? k : null; };
  function spanOf(name) {   // горизонтальный след героя в мире: центр и полуширина
    const a = name === 'poppy' ? st.poppy : name === 'crush' ? st.crush : name === 'ruda' ? st.ruda : null;
    if (!a) return null;
    return { x: a.x, hw: name === 'poppy' ? a.h * (hero() === 'classic' ? 0.3 : 0.4) : a.h * AK() * 0.34 };
  }
  function portraitTarget(L) {
    const to = tw.to, zmin = Math.max(L.wh / 540, L.ww / 960);
    let zp = Math.max(to.z * L.K, zmin), cx = to.x, cy = to.y;
    const off = insK * insSide * L.ww * 0.2;   // вставка-карточка на экране: говорящий уходит в противоположную карточке сторону (px окна)
    const names = tw.on === 'both' ? ['poppy', otherKey()] : tw.on ? [tw.on] : [], spans = names.map(spanOf).filter(Boolean);
    const spk = spanOf(speakerKey()), pad = 26;
    if (spans.length) {
      const f = faceOf(tw.on); if (f) cx = f.x + tw.dx + off / zp;
      if (spans.length > 1) {   // двое: помещаются? иначе отъезд, иначе говорящий
        const l = Math.min(...spans.map(s => s.x - s.hw)), r = Math.max(...spans.map(s => s.x + s.hw));
        if ((r - l) * zp + 2 * pad > L.ww) {
          const zfit = (L.ww - 2 * pad) / (r - l);
          if (zfit >= zmin) { zp = zfit; cx = (l + r) / 2 + off / zp; }
          else if (spk && spans.some(s => s.x === spk.x)) { const fs = faceOf(speakerKey()); if (fs) cx = fs.x + off / zp; }
        } else { const vw = L.ww / zp, lo = r + pad / zp - vw / 2, hi = l - pad / zp + vw / 2; cx = lo <= hi ? clamp(cx, lo, hi) : (l + r) / 2; }
      }
    } else cx += off / zp;
    if (spk) {   // говорящий всегда в кадре (если помещается целиком; крупный план лица — как есть)
      const vw = L.ww / zp, lo = spk.x + spk.hw + pad / zp - vw / 2, hi = spk.x - spk.hw - pad / zp + vw / 2;
      if (lo <= hi) cx = clamp(cx, lo, hi);
    }
    const hw = L.ww / 2 / zp, hh = L.wh / 2 / zp;
    return { x: hw >= 480 ? 480 : clamp(cx, hw, W - hw), y: hh >= 270 ? 270 : clamp(cy, hh, H - hh), z: zp, mode: 'p' };
  }
  function portraitCam(L) {   // базовая портретная камера: мягкий переход от прежней к цели, тем же кривым, что и ландшафтная
    const tgt = portraitTarget(L), k = tw.dur <= 0 ? (tw.t >= 0 ? 1 : 0) : clamp(tw.t / tw.dur, 0, 1), e = (EASE[tw.ease] || EASE.inOutSine)(k), f = tw.pFrom && tw.pFrom.mode === 'p' ? tw.pFrom : tgt;
    return pBase = { x: lerp(f.x, tgt.x, e), y: lerp(f.y, tgt.y, e), z: lerp(f.z, tgt.z, e), mode: 'p' };
  }

  // --- звук ---
  function sting(name) {
    if (!name) return;
    for (const [n, o, d] of STING[name] || [[name, {}]]) { if (d) queue.push({ at: t + d, n, o }); else sfx(n, o); }
  }
  function beep(c) {
    const sp = SPEAKERS[R.s.who] || SPEAKERS['Поппи'];
    const code = c.toLowerCase().charCodeAt(0);
    sfx('select', { pitch: sp.voice * (0.9 + ((code * 7) % 9) * 0.025), vol: 0.25, gap: 0.03, jitter: 0.04 });
  }

  // --- эффекты шага ---
  function zoom3(on) {   // тройной наезд склейками: средний → крупный → сверхкрупный, «дун-дун-дун»
    [1.4, 1.9, 2.55].forEach((z, n) => evq.push({ at: t + n * 0.16, fn: () => {
      moveCam({ on, zoom: z, dy: 34, cut: true }, null); pushAmt = 0.012; flash = Math.max(flash, 0.3 - n * 0.07);
      sfx('thud', { pitch: 0.75 + n * 0.25, vol: 0.65 }); sfx('whoosh', { pitch: 1.4 + n * 0.35, vol: 0.22 });
    } }));
  }
  function spawnFx(spec) {
    for (const one of [].concat(spec || [])) {
      const [fx, on0] = one.split(':'), on = on0 || null, f = faceOf(on || 'poppy');
      if (fx === 'hearts' && f) for (let k = 0; k < 3; k++) parts.push({ k: 'heart', x: f.x + (k - 1) * 22, y: f.y - 10, vx: (k - 1) * 10, vy: -38, age: -k * 0.18, life: 1.6, r: 7 + k });
      else if (fx === 'steam') R.steam = 2.6;
      else if (fx === 'pulse') pulse = 1;
      else if (fx === 'lightning') { lightning = 1; sting('thunder'); }
      else if (fx === 'romance') { romanceT = 1; romanceOn = on || (otherKey() ? 'both' : 'poppy'); }
      else if (fx === 'gloom') { gloomT = 1; gloomOn = on || 'poppy'; }
      else if (fx === 'shock' || fx === 'lines') { shock = { t: 0, on: on || 'poppy', kind: fx }; if (fx === 'shock') { flash = Math.max(flash, 0.55); sting('shock'); } }
      else if (fx === 'zoom3') zoom3(on || 'poppy');
      else if (fx === 'sweat' || fx === 'vein') {
        const who = on || 'poppy'; stamps = stamps.filter(m => !(m.k === fx && m.on === who)); stamps.push({ k: fx, on: who, t: 0 });
        sfx(fx === 'vein' ? 'thud' : 'pop', fx === 'vein' ? { pitch: 1.5, vol: 0.4 } : { pitch: 1.7, vol: 0.28 });
      }
    }
  }
  function fire(o) {   // события начала текста и метки «|»
    if (o.sfx) sting(o.sfx);
    if (o.shake) trauma = Math.min(1, trauma + o.shake + 0.25);
    if (o.tilt !== undefined) tiltTarget = o.tilt;
    if (o.face !== undefined && o.face !== face) { face = o.face; faceT = 0; }
    if (o.fx) spawnFx(o.fx);
    if (o.cam) moveCam(o.cam, null);
  }
  function showInsert(spec) {
    const o = typeof spec === 'string' ? { k: spec } : spec, sp = SPEAKERS[R.s.who], f = faceOf(sp ? sp.key : 'poppy') || faceOf('poppy');
    if (VP.portrait) {   // портрет: карточка с той стороны окна, где стоит собеседник; говорящего камера уводит на противоположную (insK)
      const L = portLay(), me = sp ? sp.key : 'poppy', ot = me === 'poppy' ? otherKey() : 'poppy', a = st[me], b = ot && st[ot];
      insSide = b && a ? (b.x >= a.x ? 1 : -1) : me === 'poppy' ? 1 : -1;
      const s = 1.12, cw = CARD.w * s;
      ins = { k: o.k, t: 0, dur: o.dur ?? 2.0, x: L.ww / 2 + insSide * (L.ww / 2 - cw / 2 - 8), y: L.wh * 0.31, rot: insSide < 0 ? -0.06 : 0.06, s };
    } else {
      const sx = f && view ? (f.x - view.x) * view.z + 480 : 300, left = sx > 480;
      ins = { k: o.k, t: 0, dur: o.dur ?? 2.0, x: left ? 250 : 712, y: 200, rot: left ? -0.06 : 0.06 };
    }
    sting(o.sfx || 'pop');
  }
  function startText() {
    const s = R.s; R.started = true; pushT = 0;
    fire({ sfx: s.sfx, shake: s.shake, fx: s.fx });
    if (s.insert && s.insert.at !== 'end') showInsert(s.insert);
    if (!R.L.chars.length) textDone();
  }
  function textDone() { R.typed = true; if (R.s.insert && R.s.insert.at === 'end') showInsert(R.s.insert); }
  function completeText() {
    for (let k = R.shown; k < R.L.chars.length; k++) if (R.L.chars[k].mark && R.s.mark) fire(R.s.mark);
    R.shown = R.L.chars.length; R.typeT = R.L.total + 1; textDone();
  }

  function apply(k) {
    const s = steps[k]; i = k;
    const prevPoppy = st.poppy;
    for (const f of ['bg', 'poppy', 'crush', 'ruda']) if (f in s) st[f] = s[f];
    if ('poppy' in s) {   // героиня идёт пешком: из точки move (или с прошлого места)
      const mv = s.poppy && s.poppy.move;
      st.walk = mv != null && mv !== false ? { from: typeof mv === 'number' ? mv : prevPoppy ? prevPoppy.x : s.poppy.x, t0: t } : null;
    }
    if (s.bg && s.bg !== st.lastBg) { st.lastBg = s.bg; parts = parts.filter(p => !p.amb); }
    st.title = !!s.title; st.plate = s.plate || (s.soon ? { title: s.soon } : null); st.card = s.card || null;
    stepT = 0; poofDone = false;
    evq.length = 0; stamps = []; romanceT = 0; gloomT = 0; shock = null;
    if (s.split) { split = s.split; splitOn = true; } else splitOn = false;
    if (s.music) playMusic(s.music, s.music === 'victory' ? { then: 'calm' } : undefined);
    const think = s.style === 'think';
    R = { s, think, L: s.s ? parseLine(s.s, think) : { chars: [], total: 0, laid: true, lines: 0 }, beat: s.beat || 0, typeT: 0, shown: 0,
      started: false, typed: false, doneT: 0, pending: false, letters: 0, steam: 0 };
    const nf = s.face || null; if (nf !== face) { face = nf; faceT = 0; }
    const talks = s.who && s.s, changed = talks && s.who !== prevWho;
    if (changed) whoT = 0;
    const rev = changed && prevWho && st.poppy && otherKey() && SPEAKERS[s.who] ? SPEAKERS[s.who].key : null;
    if (talks) prevWho = s.who;
    pushAmt = s.push ?? (talks ? 0.06 : 0.03); pushDur = Math.max(2.5, R.L.total + 2);
    moveCam(s.cam, s, rev);
    tiltTarget = s.tilt || 0; darkTarget = s.dark || 0;
    irisT = s.trans === 'iris' ? 0 : null;
    if (s.trans === 'flash') flash = 1;
    if (!R.beat) startText();
  }
  function next() {
    if (i + 1 >= steps.length) { phase = 'outro'; outroT = 0; outroKind = R.s.outro || 'bars'; outroDur = outroKind === 'burn' ? 0.9 : 0.5;
      if (outroKind === 'burn') { sfx('splat', { pitch: 0.45, vol: 0.35 }); sfx('whoosh', { pitch: 0.5, vol: 0.4 }); } return; }
    sfx('select', { vol: 0.12, pitch: 0.6 });
    if (steps[i + 1].trans === 'iris' && i >= 0) { phase = 'closing'; closeT = 0; sfx('whoosh', { pitch: 0.55, vol: 0.25 }); }
    else apply(i + 1);
  }
  function finish() { if (done) return; done = true; inp.endStep(); onDone(); }
  const skipRect = () => VP.portrait ? portLay().skip : SB;
  const inBtn = (x, y) => { const b = skipRect(), k = (VP.scale * (VP.portrait ? 1 : VP.frame.s)) || 1, m = Math.min(12 / k, Math.max(VP.portrait ? 8 : 0, (44 / k - b.h) / 2)); return x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m; };   // на тач-экране — с запасом

  // --- атмосфера: частицы ---
  function ambient(dt) {
    const bg = st.bg, r = Math.random;
    if ((bg === 'facade' || bg === 'title') && r() < dt * 7) parts.push({ amb: 1, k: 'ember', x: r() * W, y: 560, vx: (r() - 0.5) * 20, vy: -25 - r() * 35, age: 0, life: 4 + r() * 3, r: 1 + r() * 1.6 });
    if ((bg === 'hall' || bg === 'queue') && r() < dt * 8) parts.push({ amb: 1, k: 'mote', x: bg === 'hall' ? 340 + r() * 280 : r() * W, y: 60 + r() * 300, vx: (r() - 0.5) * 8, vy: (r() - 0.3) * 6, age: 0, life: 3 + r() * 3, r: 0.8 + r() * 1.2 });
    if ((bg === 'gothic' || bg === 'restroom') && r() < dt * 3) parts.push({ amb: 1, k: 'mote', x: r() * W, y: 80 + r() * 320, vx: (r() - 0.5) * 6, vy: 4 + r() * 6, age: 0, life: 4 + r() * 3, r: 0.8 + r() * 1.1 });
    if (bg === 'castle' && r() < dt * 0.25) parts.push({ amb: 1, k: 'bat', x: -30, y: 80 + r() * 140, vx: 90 + r() * 60, vy: 0, age: 0, life: 14, r: 5 + r() * 4, ph: r() * 6 });
    if (bg === 'castle' && t > nextBolt) { nextBolt = t + 8 + r() * 6; lightning = 0.7; queue.push({ at: t + 0.4, n: 'boom', o: { pitch: 0.28, vol: 0.4 } }); }
    if (R.steam > 0) { R.steam -= dt; const f = faceOf('poppy'); if (f && r() < dt * 12) parts.push({ k: 'steam', x: f.x + (r() - 0.5) * 50, y: f.y - st.poppy.h * 0.12, vx: (r() - 0.5) * 20, vy: -50 - r() * 30, age: 0, life: 1.1, r: 6 + r() * 5 }); }
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]; p.age += dt; if (p.age < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'heart') p.x += Math.sin(p.age * 6 + k) * 0.4;
      if (p.k === 'puff') { p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; }
      if (p.age > p.life || p.x > W + 60) parts.splice(k, 1);
    }
    if (parts.length > 160) parts.splice(0, parts.length - 160);
  }

  const api = {
    portraitLayout: true,   // в портрете сцена сама рисует раскладку на полном виде (см. main.js, usesFullView)
    enter() {
      steps = (STORY[key] || []).filter(s => okIf(s.if));
      if (!steps.length) steps = [{ who: null, s: '', auto: 0 }];
      i = -1; st = {}; t = 0; parts = []; queue = []; ins = null; phase = 'play'; done = false;
      lbT = 0; panelK = 0; skipK = 0; armed = false; trauma = 0; tilt = 0; flash = 0; lightning = 0; pulse = 0; dark = 0;
      prevWho = null; whoT = 9; face = null; faceT = 9; lastClack = 0; coldN = 0; burnAt = { x: 610, y: 230 }; nextBolt = 6;
      evq = []; romanceK = 0; romanceT = 0; gloomK = 0; gloomT = 0; shock = null; stamps = []; split = null; splitK = 0; splitOn = false; shk = { x: 0, y: 0, r: 0 };
      tw = { from: { x: 480, y: 270, z: 1 }, to: { x: 480, y: 270, z: 1 }, t: 0, dur: 0, ease: 'linear', on: null, dx: 0, pFrom: null }; insK = 0; insSide = 1; pBase = null; pushT = 0; pushAmt = 0; pushDur = 1;
      apply(0); playMusic('calm'); preload(storyAssets(key)); loadHeroineKey(outfit());
    },
    // отладка и проверки: перейти к шагу k (window.__app.cur().goto(k))
    goto(k) {
      k = clamp(k, 0, steps.length - 1);
      for (let j = 0; j < k; j++) for (const f of ['bg', 'poppy', 'crush', 'ruda']) if (f in steps[j]) st[f] = steps[j][f];   // накопленное состояние сцены
      st.walk = null; apply(k);
    },
    get stepIndex() { return i; },
    get stepCount() { return steps.length; },
    // проверки: раскладка текущего кадра (портрет — окно, плашка, «Пропустить» в логических координатах вида), строки текста, ввод
    layoutInfo() {
      const L = VP.portrait ? portLay() : null, ch = R.L, sr = skipRect();
      return { portrait: VP.portrait, scale: VP.scale, dx: VP.dx, dy: VP.dy, safe: { ...VP.safe }, win: L && { x: 0, y: L.wy, w: L.ww, h: L.wh }, panel: L && { x: L.px, y: L.py, w: L.pw, h: L.ph },
        cam: view && { x: +view.x.toFixed(1), y: +view.y.toFixed(1), z: +view.z.toFixed(3), tw: { t: +tw.t.toFixed(2), dur: tw.dur, on: tw.on } },
        skip: { x: sr.x, y: sr.y, w: sr.w, h: sr.h }, lines: ch.lines || 0, maxLines: L ? L.maxLines : 4, fits: !L || (ch.lines || 0) <= L.maxLines, typed: R.typed, skipK, step: i };
    },
    update(dt) {
      if (done) return;
      inp.poll(); t += dt;
      for (let q = queue.length - 1; q >= 0; q--) if (queue[q].at <= t) { sfx(queue[q].n, queue[q].o); queue.splice(q, 1); }
      while (evq.length && evq[0].at <= t) evq.shift().fn();
      const s = R.s, p = inp.pointer, onBtn = inBtn(p.x, p.y);
      // letterbox и плашка
      const lbWant = phase !== 'outro' && !(s.cold && stepT < COLD.reveal) && !s.card;
      lbT = clamp(lbT + (lbWant ? dt : -dt) / 0.5, 0, 1);
      panelK = clamp(panelK + (s.who && phase === 'play' && (irisT === null || irisT > 0.45) ? dt : -dt) / 0.18, 0, 1);
      // пропуск: удерживать кнопку или Esc 0,8 с (тап по кнопке запускает заполнение, клик по сцене отменяет)
      if (p.pressed && onBtn) armed = true;
      const holding = armed || (p.down && onBtn) || inp.down('Escape');
      skipK = holding ? skipK + dt / 0.8 : Math.max(0, skipK - dt * 2.5);
      if (skipK >= 1) return finish();
      // эффекты
      trauma = Math.max(0, trauma - dt * 1.3); tilt += (tiltTarget - tilt) * Math.min(1, dt * 7);
      flash = Math.max(0, flash - dt * 2.5); lightning = Math.max(0, lightning - dt * 1.8); pulse = Math.max(0, pulse - dt * 0.25);
      dark += (darkTarget - dark) * Math.min(1, dt * 3);
      romanceK += (romanceT - romanceK) * Math.min(1, dt * 3.5); gloomK += (gloomT - gloomK) * Math.min(1, dt * 3);
      splitK = clamp(splitK + (splitOn ? dt : -dt) / 0.35, 0, 1); if (!splitOn && splitK <= 0) split = null;
      if (shock) { shock.t += dt; if (shock.t > 1.3) shock = null; }
      for (const m of stamps) m.t += dt;
      if (ins) { ins.t += dt; if (ins.t > ins.dur + 0.4) ins = null; }
      insK += ((ins && ins.t < ins.dur + 0.1 ? 1 : 0) - insK) * Math.min(1, dt * 4);
      ambient(dt);
      if (phase === 'outro') { outroT += dt; inp.endStep(); if (outroT >= outroDur) finish(); return; }
      if (phase === 'closing') { closeT += dt; if (closeT >= 0.42) { phase = 'play'; apply(i + 1); } inp.endStep(); return; }
      if (st.bg && !loaded(st.bg) && (loadWait += dt) < 4) { inp.endStep(); return; }   // фон ещё грузится — сцена ждёт (без «загрузки» под диафрагмой)
      stepT += dt; tw.t += dt; whoT += dt; faceT += dt; if (irisT !== null) irisT += dt;
      if (R.started) pushT += dt;
      // холодное открытие: стрекот, ракорд, вспышка
      if (s.cold) {
        if (stepT < COLD.reveal && t - lastClack > 1 / 14) { lastClack = t; sfx('thud', { pitch: 3.4, vol: 0.09, gap: 0.02, jitter: 0.25 }); }
        const n = stepT >= COLD.lead ? Math.floor((stepT - COLD.lead) / COLD.num) + 1 : 0;
        if (n > coldN && n <= 3) { coldN = n; sfx('select', { pitch: 1.25, vol: 0.4 }); }
        if (stepT >= COLD.flash && coldN < 4) { coldN = 4; sfx('zap', { pitch: 0.6, vol: 0.3 }); sfx('whoosh', { pitch: 0.7, vol: 0.4 }); }
        if (stepT >= COLD.reveal && coldN < 5) { coldN = 5; flash = 0.85; }
        if (stepT >= COLD.dur) next();
      } else if (!R.started) { R.beat -= dt; if (R.beat <= 0) startText(); }
      else if (!R.typed) {
        R.typeT += dt; const ch = R.L.chars;
        while (R.shown < ch.length && ch[R.shown].t <= R.typeT) {
          const c = ch[R.shown++];
          if (!R.think && /[\p{L}\d]/u.test(c.c) && R.letters++ % 2 === 0) beep(c.c);
          if (c.mark && s.mark) fire(s.mark);
        }
        if (R.shown >= ch.length) textDone();
      } else { R.doneT += dt; R.typeT += dt; }
      // Руда исчезает облачком
      if (st.ruda && st.ruda.exit && !poofDone && stepT > 0.2) {
        poofDone = true; const f = faceOf('ruda'), u = st.ruda.h * AK();
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; parts.push({ k: 'puff', x: f.x + Math.cos(a) * 20, y: f.y + u * 0.25 + Math.sin(a) * 30, vx: Math.cos(a) * 120, vy: Math.sin(a) * 90 - 30, age: -k * 0.01, life: 0.8, r: 10 + (k % 3) * 5 }); }
      }
      // клик по сцене: ускорить набор / листать (Esc — только пропуск)
      const press = (p.pressed && !onBtn) || (inp.anyPressed && !p.pressed && !inp.hit('Escape'));
      if (press) {
        armed = false;
        if (s.cold) { if (stepT < COLD.reveal) { stepT = COLD.reveal; coldN = 4; } else next(); }
        else if (!R.started) { R.beat = 0; startText(); }
        else if (!R.typed) completeText();
        else if (R.doneT >= (s.hold ?? 0.12)) next();
        else R.pending = true;
      }
      if (phase === 'play' && R.s === s && R.typed && !s.cold && R.doneT >= (s.hold ?? 0.12) && (R.pending || (s.auto != null && R.doneT >= (s.hold ?? 0.12) + s.auto))) next();
      inp.endStep();
    },
    draw(ctx) {
      const s = R.s;
      if (VP.portrait) return drawPort(ctx, s);
      PORT = false; pBase = null; area(960, 540);   // ландшафт: дизайн-рамка 960×540, как раньше
      // ---- мир через камеру ----
      const c = camNow(), rad = tilt * Math.PI / 180, lbE = EASE.inOutCubic(lbT);
      const z = c.z * pushF() * (1 + Math.abs(Math.sin(rad)) * 0.8);
      const tr = trauma * trauma;
      view = clampCam({ x: c.x, y: c.y, z }, LB * lbE);
      shk = { x: (Math.sin(t * 47.3) + Math.sin(t * 31.7 + 1)) * tr * 9, y: (Math.sin(t * 39.1 + 2) + Math.sin(t * 23.3)) * tr * 7, r: rad + Math.sin(t * 29) * tr * 0.025 };
      BASE = ctx.getTransform();
      ctx.fillStyle = LB_COL; ctx.fillRect(0, 0, W, H);
      worldPass(ctx, view, shk, 0, null);
      if (split && splitK > 0.001) drawSplit(ctx);
      if (st.bg && !loaded(st.bg)) text(ctx, 'загрузка…', 480, 270, { size: 18, color: '#ffd0dc' });
      // ---- экранные слои ----
      if (dark > 0.01) { ctx.fillStyle = `rgba(8,2,10,${dark})`; ctx.fillRect(0, 0, W, H); }
      drawVignette(ctx, t);
      if (pulse > 0) {   // красная пульсация виньетки (паника)
        const a = pulse * (0.35 + 0.25 * Math.sin(t * 7));
        const g = ctx.createRadialGradient(480, 270, 160, 480, 270, 560); g.addColorStop(0, 'rgba(160,0,20,0)'); g.addColorStop(1, `rgba(170,0,24,${a})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (lightning > 0) { const a = lightning * (0.55 + 0.45 * Math.sin(lightning * 40)); ctx.fillStyle = `rgba(210,225,255,${Math.max(0, a) * 0.55})`; ctx.fillRect(0, 0, W, H); }
      drawFxFront(ctx);
      // зерно и мерцание плёнки накладывает корневая сцена (src/art/post.js drawFilm) — здесь не дублируем
      if (tw.whip && tw.t >= 0 && tw.t < tw.dur + 0.08) drawWhip(ctx, clamp(tw.t / (tw.dur + 0.08), 0, 1));
      if (ins) drawInsert(ctx, ins);
      if (st.plate) drawPlate(ctx, st.plate, stepT);
      if (s.cold) { const f = faceOf('poppy') || { x: 480, y: 270 }; drawCold(ctx, stepT, toScreen(f, view)); }
      if (st.card) drawEndCard(ctx, stepT);
      if (flash > 0) { ctx.fillStyle = `rgba(255,246,224,${flash})`; ctx.fillRect(0, 0, W, H); }
      // ---- letterbox ----
      const bh = Math.round(LB * lbE);
      if (bh > 0) {
        ctx.fillStyle = LB_COL; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.globalAlpha = lbE * 0.45;
        text(ctx, CAPTION[key] || '', 22, bh - 27, { size: 12, align: 'left', color: '#ffd0dc', outline: false, weight: 900 });
        text(ctx, 'клик — дальше · держи Esc — пропустить', 938, bh - 27, { size: 12, align: 'right', color: '#ffffff', outline: false, weight: 700 });
        ctx.globalAlpha = 1;
      }
      if (st.title && stepT > 1.2) { ctx.globalAlpha = clamp((stepT - 1.2) / 0.6, 0, 1); text(ctx, 'Глава 2 «Улица»', 480, 513, { size: 24, color: '#ffd0dc' }); ctx.globalAlpha = 1; }
      // ---- диалог ----
      currentOutfit = outfit(); currentHero = hero();
      if (panelK > 0 && s.who) drawDialog(ctx, s.who, '', { k: EASE.outCubic(panelK), R, st, whoT, face, faceT, t });
      // ---- переходы ----
      if (phase === 'closing') drawIris(ctx, 480, 270, (1 - EASE.inCubic(clamp(closeT / 0.36, 0, 1))) * 620);
      else if (irisT !== null && irisT < 0.7) drawIris(ctx, 480, 260, EASE.outCubic(clamp((irisT - 0.12) / 0.5, 0, 1)) * 620);
      if (phase === 'outro') {
        const k = clamp(outroT / outroDur, 0, 1);
        if (outroKind === 'burn') drawBurn(ctx, burnAt.x, burnAt.y, k, t);
        else { ctx.fillStyle = `rgba(14,6,18,${EASE.inQuad(k)})`; ctx.fillRect(0, 0, W, H); }
      }
      drawSkip(ctx, skipK, inBtn(inp.pointer.x, inp.pointer.y), armed || skipK > 0);
    },
  };
  return api;

  // ---------- проход мира: фон → «задник» реакций → персонажи → частицы ----------
  function worldPass(ctx, v, sh, ox, panel, oy = 0) {
    ctx.save();
    ctx.translate(SCX + sh.x + ox, SCY + sh.y + oy); ctx.rotate(sh.r); ctx.scale(v.z, v.z); ctx.translate(-v.x, -v.y);
    if (!drawSceneBg(ctx, st.bg)) { ctx.fillStyle = '#0a0408'; ctx.fillRect(0, 0, W, H); }
    drawBack(ctx, st.bg, t);
    ctx.save(); ctx.setTransform(BASE); if (ox || oy) ctx.translate(ox, oy); drawFxBack(ctx, v, panel); ctx.restore();
    drawActors(ctx, v);
    drawParts(ctx, parts, t);
    if (st.title && !PORT) drawTitleCard(ctx, stepT);
    ctx.restore();
  }
  // ---------- портретный кадр: полоса сверху · окно кино · плашка диалога (всё в координатах вида; окно — со своим началом координат и обрезкой) ----------
  function drawPort(ctx, s) {
    PORT = true;
    const V = VP, L = portLay(), rad = tilt * Math.PI / 180, tr = trauma * trauma, lbE = EASE.inOutCubic(lbT);
    const base = portraitCam(L);
    view = { x: base.x, y: base.y, z: base.z * pushF() * (1 + Math.abs(Math.sin(rad))) };
    shk = { x: (Math.sin(t * 47.3) + Math.sin(t * 31.7 + 1)) * tr * 9, y: (Math.sin(t * 39.1 + 2) + Math.sin(t * 23.3)) * tr * 7, r: rad + Math.sin(t * 29) * tr * 0.025 };
    ctx.fillStyle = LB_COL; ctx.fillRect(0, 0, V.W, V.H);
    // ---- окно кино ----
    ctx.save(); ctx.translate(0, L.wy); ctx.beginPath(); ctx.rect(0, 0, L.ww, L.wh); ctx.clip();
    area(L.ww, L.wh, L.ww / 2, L.wh / 2, 28);
    BASE = ctx.getTransform();
    ctx.fillStyle = '#0a0408'; ctx.fillRect(0, 0, SW, SH);
    worldPass(ctx, view, shk, 0, null);
    if (split && splitK > 0.001) drawSplit(ctx);
    if (st.bg && !loaded(st.bg)) text(ctx, 'загрузка…', SW / 2, SH / 2, { size: 20, color: '#ffd0dc' });
    if (dark > 0.01) { ctx.fillStyle = `rgba(8,2,10,${dark})`; ctx.fillRect(0, 0, SW, SH); }
    drawVignetteBox(ctx);
    if (pulse > 0) {
      const a = pulse * (0.35 + 0.25 * Math.sin(t * 7));
      const g = ctx.createRadialGradient(SW / 2, SH / 2, 160, SW / 2, SH / 2, 560); g.addColorStop(0, 'rgba(160,0,20,0)'); g.addColorStop(1, `rgba(170,0,24,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    }
    if (lightning > 0) { const a = lightning * (0.55 + 0.45 * Math.sin(lightning * 40)); ctx.fillStyle = `rgba(210,225,255,${Math.max(0, a) * 0.55})`; ctx.fillRect(0, 0, SW, SH); }
    drawFxFront(ctx);
    if (tw.whip && tw.t >= 0 && tw.t < tw.dur + 0.08) drawWhip(ctx, clamp(tw.t / (tw.dur + 0.08), 0, 1));
    if (ins) drawInsert(ctx, ins);
    if (st.plate) drawPlate(ctx, st.plate, stepT);
    if (st.title) drawTitleCardP(ctx, stepT);
    if (flash > 0) { ctx.fillStyle = `rgba(255,246,224,${flash})`; ctx.fillRect(0, 0, SW, SH); }
    const faceP = s.cold ? toScreen(faceOf('poppy') || { x: 480, y: 270 }, view) : null;   // центр раскрытия ракорда (в координатах окна)
    ctx.restore();
    // ---- верхняя полоса: подпись главы ----
    area(V.W, V.H);
    ctx.globalAlpha = lbE * 0.6;
    text(ctx, CAPTION[key] || '', V.safe.l + 16, L.skip.y + L.skip.h / 2, { size: 17, align: 'left', color: '#ffd0dc', outline: false, weight: 900 });
    ctx.globalAlpha = 1;
    if (st.title && stepT > 1.2) { ctx.globalAlpha = clamp((stepT - 1.2) / 0.6, 0, 1); text(ctx, 'Глава 2 «Улица»', V.W / 2, L.py + L.ph / 2, { size: 28, color: '#ffd0dc' }); ctx.globalAlpha = 1; }
    // ---- плашка диалога ----
    currentOutfit = outfit(); currentHero = hero();
    if (panelK > 0 && s.who) drawDialogP(ctx, s.who, { k: EASE.outCubic(panelK), R, st, whoT, face, faceT, t }, L);
    // ---- ракорд и финальная карточка — на весь вид ----
    if (s.cold && faceP) { const px = faceP.x, py = faceP.y + L.wy; drawCold(ctx, stepT, { x: px, y: py }, 48, Math.hypot(Math.max(px, V.W - px), Math.max(py, V.H - py)) + 30); }
    if (st.card) drawEndCard(ctx, stepT, 48);
    // ---- переходы: диафрагма и затемнение на весь вид, центр — в окне ----
    const icx = V.W / 2, icy = L.wy + L.wh / 2, R0 = Math.hypot(Math.max(icx, V.W - icx), Math.max(icy, V.H - icy)) + 30;
    if (phase === 'closing') drawIris(ctx, icx, icy, (1 - EASE.inCubic(clamp(closeT / 0.36, 0, 1))) * R0);
    else if (irisT !== null && irisT < 0.7) drawIris(ctx, icx, icy, EASE.outCubic(clamp((irisT - 0.12) / 0.5, 0, 1)) * R0);
    if (phase === 'outro') {
      const k = clamp(outroT / outroDur, 0, 1);
      if (outroKind === 'burn') drawBurn(ctx, V.W * 0.62, L.wy + L.wh * 0.4, k, t);
      else { ctx.fillStyle = `rgba(14,6,18,${EASE.inQuad(k)})`; ctx.fillRect(0, 0, V.W, V.H); }
    }
    drawSkip(ctx, skipK, inBtn(inp.pointer.x, inp.pointer.y), armed || skipK > 0, L.skip, 19);
  }
  // Сплит-экран: два крупных плана, косой стык с кремовой кромкой; панели въезжают с боков
  function splitView(name, side) {
    const f = faceOf(name); if (!f) return null;
    if (PORT) {   // портрет: две панели друг над другом, лицо — в центре своей панели
      const z = (split.zoom || 2.0) * 1.15, pcy = SH * (side < 0 ? 0.26 : 0.74);
      return { x: f.x, y: clamp(f.y + (SH / 2 - pcy) / z, SH / 2 / z, H - SH / 2 / z), z };
    }
    const z = split.zoom || 2.0;
    return { x: f.x - side * 235 / z, y: clamp(f.y + 40 / z, 270 / z, H - 270 / z), z };
  }
  function drawSplit(ctx) {
    const e = EASE.outCubic(splitK), slide = (1 - e) * (PORT ? SH : 620);
    for (const [side, name] of [[-1, split.a || 'poppy'], [1, split.b || otherKey()]]) {
      const v = name && splitView(name, side); if (!v) continue;
      if (PORT) {   // косой стык по горизонтали: верхняя панель въезжает сверху, нижняя — снизу
        const oy = side * slide, my = SH / 2, d = 36;
        ctx.save(); ctx.beginPath();
        if (side < 0) { ctx.moveTo(-10, oy - 10); ctx.lineTo(SW + 10, oy - 10); ctx.lineTo(SW + 10, my - d + oy); ctx.lineTo(-10, my + d + oy); }
        else { ctx.moveTo(-10, my + d + oy); ctx.lineTo(SW + 10, my - d + oy); ctx.lineTo(SW + 10, SH + 10 + oy); ctx.lineTo(-10, SH + 10 + oy); }
        ctx.closePath(); ctx.clip();
        worldPass(ctx, v, { x: 0, y: 0, r: 0 }, 0, name, oy);
        ctx.restore();
        ctx.save(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(-6, my + d + 3 + oy); ctx.lineTo(SW + 6, my - d - 3 + oy);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = P.paper; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
        continue;
      }
      const ox = side * slide;
      ctx.save(); ctx.beginPath();
      if (side < 0) { ctx.moveTo(ox - 10, 0); ctx.lineTo(530 + ox, 0); ctx.lineTo(430 + ox, H); ctx.lineTo(ox - 10, H); }
      else { ctx.moveTo(530 + ox, 0); ctx.lineTo(W + 10 + ox, 0); ctx.lineTo(W + 10 + ox, H); ctx.lineTo(430 + ox, H); }
      ctx.closePath(); ctx.clip();
      worldPass(ctx, v, { x: 0, y: 0, r: 0 }, ox, name);
      ctx.restore();
      ctx.save(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(530 + ox, -6); ctx.lineTo(430 + ox, H + 6);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = P.paper; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
    }
  }
  // где на экране лицо (с учётом сплита) и его масштаб
  function screenFace(on) {
    if (on === 'both') {
      const a = screenFace('poppy'), b = otherKey() && screenFace(otherKey());
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, u: (a.u + b.u) / 2 } : a || b;
    }
    const f = faceOf(on); if (!f) return null;
    if (split && splitK > 0.5 && (on === (split.a || 'poppy') || on === (split.b || otherKey()))) {
      const v = splitView(on, on === (split.a || 'poppy') ? -1 : 1);
      return { ...toScreen(f, v), u: v.z * unitOf(on) };
    }
    const p = toScreen(f, view); return { x: p.x + shk.x, y: p.y + shk.y, u: view.z * unitOf(on) };
  }
  function drawFxBack(ctx, v, panel) {
    const at = on => { const f = faceOf(panel || on); return f ? toScreen(f, v) : { x: SCX, y: SCY - 30 }; };
    if (romanceK > 0.01) drawRomanceBack(ctx, at(romanceOn), romanceK, t);
    if (gloomK > 0.01 && (!panel || panel === gloomOn)) drawGloomBack(ctx, at(gloomOn), gloomK, v.z * unitOf(gloomOn));
    if (shock && (!panel || panel === shock.on)) drawShockBack(ctx, at(shock.on), shock, t);
  }
  function drawFxFront(ctx) {
    if (romanceK > 0.01) {
      const faces = split && splitK > 0.5 ? [screenFace(split.a || 'poppy'), screenFace(split.b || otherKey())] : romanceOn === 'both' ? [screenFace('poppy'), screenFace(otherKey())] : [screenFace(romanceOn)];
      drawRomanceFront(ctx, faces.filter(Boolean), romanceK, t);
    }
    if (gloomK > 0.01) { const f = screenFace(gloomOn); if (f) drawGloomFront(ctx, f, gloomK, t); }
    for (const m of stamps) { const f = screenFace(m.on); if (f) drawStamp(ctx, m, f, t); }
  }

  // ---------- персонажи (в координатах сцены) ----------
  // «Шпионский» ключевой кадр: вполоборота спиной, взгляд через плечо, бластер вверх (только новая героиня)
  function drawKeyPose(ctx, p, hop, q) {
    const k = clamp(stepT / 0.22, 0, 1), sq = 1 + Math.sin(k * Math.PI) * 0.06;   // «щелчок» позы
    ctx.save(); ctx.translate(p.x * q, (p.y - hop) * q); ctx.scale(1 / sq, sq);
    const ok = drawHeroineKey(ctx, 0, 0, Math.round(p.h * 1.32 * q), outfit(), { t, flip: R.s.poseFlip ?? false });
    ctx.restore();
    ctx.save(); ctx.scale(q, q);
    if (ok && stepT < 0.6) {   // блик-звёздочка на бластере
      const a = 1 - stepT / 0.6, f = faceOf('poppy');
      ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x + 26, f.y - 30); ctx.rotate(stepT * 3);
      drawSparkle(ctx, 0, 0, 14 * (0.6 + a * 0.4)); ctx.restore();
    }
    ctx.restore();
    return ok;
  }
  function drawActors(ctx, v) {
    // на крупных планах персонажи рисуются в двойном разрешении (кэш векторов — по размеру), чтобы не мылились
    const q = v.z > 2.2 ? 3 : v.z > 1.2 ? 2 : 1;
    ctx.save(); ctx.scale(1 / q, 1 / q); drawActorsQ(ctx, q); ctx.restore();
  }
  function drawActorsQ(ctx, q) {
    const cur = R.s, ak = AK();
    if (st.ruda) {   // Руда — дальше всех: дышит, парит, при появлении «вырастает», при уходе — облачко
      const r = st.ruda, kIn = r.enter ? clamp(stepT / 0.6, 0, 1) : 1, h = r.h * ak;
      let alpha = kIn, sx = 1, sy = 1, rot = 0, y = r.y + Math.sin(t * 1.6) * 1.5;
      if (cur.who === 'Руда' && R.started && !R.typed) y -= Math.abs(Math.sin(t * 9)) * 2.5;
      if (r.enter) { const e = EASE.outBack(kIn); sy = 0.55 + 0.45 * e; sx = 1.2 - 0.2 * e; }
      if (r.weak) { rot = Math.sin(t * 1.3) * 0.035; y += 3; }
      if (r.exit) { const e = clamp((stepT - 0.15) / 0.5, 0, 1); alpha *= 1 - EASE.inQuad(e); sx *= 1 + e * 0.5; sy *= 1 - e * 0.85; }
      if (alpha > 0.01) {
        if (!r.weak) {   // тёплое красное свечение
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * alpha;
          const g = ctx.createRadialGradient(r.x * q, (y - h * 0.5) * q, 10, r.x * q, (y - h * 0.5) * q, h * 0.75 * q);
          g.addColorStop(0, 'rgba(200,36,58,0.45)'); g.addColorStop(1, 'rgba(200,36,58,0)'); ctx.fillStyle = g;
          ctx.fillRect((r.x - h) * q, (y - h * 1.3) * q, h * 2 * q, h * 1.6 * q); ctx.restore();
        }
        ctx.save(); ctx.translate(r.x * q, y * q); ctx.rotate(rot); ctx.scale(sx, sy);
        drawActor(ctx, 'ruda', 0, 0, h * q, { alpha }); ctx.restore();
      }
    }
    if (st.crush) {
      const c = st.crush, k = c.enter ? Math.min(1, stepT / 0.7) : 1;
      const x = c.enter ? 1060 + (c.x - 1060) * (1 - (1 - k) ** 3) : c.x;
      const running = c.run && k < 1, talking = cur.who === 'Краш' && R.started && !R.typed;
      const y = c.y + (running ? -Math.abs(Math.sin(t * 14)) * 6 : Math.sin(t * 2) * 1.2) - (talking ? Math.abs(Math.sin(t * 11)) * 2.5 : 0);
      drawActor(ctx, 'crush', x * q, y * q, c.h * ak * q, { flip: !!st.poppy && st.poppy.x < x });   // одна модель; рисунок смотрит вправо — к Поппи поворачиваем
    }
    if (st.poppy) {
      const p = st.poppy, other = st.crush || st.ruda;
      const speaking = cur.who === 'Поппи' && R.started && !R.typed && !R.think;
      const exitK = p.exit ? Math.min(1, Math.max(0, stepT - 0.6) / 0.8) : 0;
      const hop = cur.hop && stepT < 0.9 ? Math.abs(Math.sin(stepT * Math.PI * 2.2)) * 12 * (1 - stepT / 0.9) : 0;
      let px = p.x, walking = false, dir = 0;
      if (st.walk) {
        const dist = Math.abs(p.x - st.walk.from), dur = clamp(dist / 260, 0.6, 1.8), k = clamp((t - st.walk.t0) / dur, 0, 1);
        px = lerp(st.walk.from, p.x, EASE.inOutSine(k)); walking = k < 1; dir = Math.sign(p.x - st.walk.from);
      }
      // шаг в сцене — мультяшное «подпрыгивание» стоящей фигуры (цикл ходьбы боевого рига держит бластер)
      const step = walking ? Math.abs(Math.sin(t * 9)) * 5 : 0;
      const pose = p.exit && exitK > 0 ? { kind: 'run', u: t * 1.4, t }
        : { kind: speaking ? 'talk' : 'stand', t, mouth: speaking ? Math.abs(Math.sin(t * 16)) * 0.7 : 0, blink: (t % 3.3) < 0.12 ? 1 : 0, look: other ? 0.8 : 0 };
      if (hero() === 'classic') {
        const run = (p.exit && exitK > 0) || walking;
        const im = img(run ? (walking && Math.floor(t * 8) % 2 ? 'run2' : 'run1') : (p.img || 'stand'));
        if (im.complete && im.naturalWidth) {
          const w = im.width * p.h / im.height, bob = run ? Math.abs(Math.sin(t * 12)) * 5 : Math.sin(t * 2.2) * 1.5;
          ctx.save(); ctx.scale(q, q); ctx.translate(px + exitK * 600, p.y - bob - hop); if (p.exit || dir > 0) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -p.h, w, p.h); ctx.restore();
        }
      } else if (!(cur.pose === 'key' && !p.exit && drawKeyPose(ctx, p, hop, q))) {
        const flip = walking ? dir < 0 : !!other && other.x < p.x;
        ctx.save(); ctx.translate((px + exitK * 600) * q, (p.y - hop - step) * q); if (walking) ctx.rotate(Math.sin(t * 9) * 0.03);
        drawHeroine(ctx, 0, 0, p.h * 1.32 * q, pose, outfit(), { flip }); ctx.restore();
      }
    }
  }
}

// ---------- фон: свет и туман поверх вектора ----------
function drawBack(ctx, bg, t) {
  if (bg === 'hall') {   // луч проектора над залом
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const a = 0.11 + 0.025 * Math.sin(t * 17) * Math.sin(t * 5.3);
    const g = ctx.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, `rgba(255,232,190,${a})`); g.addColorStop(1, 'rgba(255,190,120,0.01)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(445, 0); ctx.lineTo(515, 0); ctx.lineTo(640, 320); ctx.lineTo(320, 320); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (bg === 'castle' || bg === 'gothic') {   // стелющийся туман
    ctx.save();
    for (let k = 0; k < 5; k++) {
      const x = ((t * (10 + k * 3) + k * 290) % 1500) - 270, y = 430 + k * 16;
      const g = ctx.createRadialGradient(x, y, 10, x, y, 260); g.addColorStop(0, 'rgba(170,200,220,0.13)'); g.addColorStop(1, 'rgba(170,200,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 260, 40, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
function heartPath(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.closePath();
}
function drawParts(ctx, parts, t) {
  for (const p of parts) {
    if (p.age < 0) continue;
    const k = p.age / p.life, fade = Math.min(1, p.age / 0.2) * (1 - k);
    if (p.k === 'ember') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${140 + 60 * Math.sin(p.age * 9) | 0},60,${0.7 * fade})`; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.age * 2 + p.r * 9) * 8, p.y, p.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'mote') { ctx.fillStyle = `rgba(255,236,200,${0.45 * fade * (0.6 + 0.4 * Math.sin(p.age * 5 + p.x))})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    else if (p.k === 'heart') { const s = 1 + 0.15 * Math.sin(p.age * 10); ctx.globalAlpha = fade; heartPath(ctx, p.x, p.y, p.r * s); shape(ctx, P.pink, 2); ctx.globalAlpha = 1; }
    else if (p.k === 'steam' || p.k === 'puff') {   // мультяшные клубы с обводкой тушью
      const r = p.r * (1 + k * (p.k === 'puff' ? 1.2 : 1.6));
      ctx.globalAlpha = (p.k === 'puff' ? 1 : 0.85) * fade; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); shape(ctx, P.hi, 2); ctx.globalAlpha = 1;
    }
    else if (p.k === 'bat') {
      const f = Math.sin(t * 18 + p.ph) * 0.8, x = p.x, y = p.y + Math.sin(p.age * 3 + p.ph) * 12, r = p.r;
      ctx.fillStyle = '#0c0812'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - r, y - r * f - r * 0.4, x - r * 2.2, y - r * f); ctx.quadraticCurveTo(x - r * 1.2, y + r * 0.1, x, y + r * 0.35);
      ctx.quadraticCurveTo(x + r * 1.2, y + r * 0.1, x + r * 2.2, y - r * f); ctx.quadraticCurveTo(x + r, y - r * f - r * 0.4, x, y); ctx.fill();
    }
  }
}

// ---------- реакции-«дорамы» (экранные координаты) ----------
// заливка + обводка тушью — основа «плоского» стиля вставок и штампов
function shape(ctx, fill, lw = 4) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.stroke(); }
}
// слитный контур (облако из кружков): двойная обводка под заливкой — линия только снаружи
function blob(ctx, fill, lw = 3) { ctx.lineWidth = lw * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); }
function star4(ctx, x, y, r) { ctx.beginPath(); for (let n = 0; n < 8; n++) { const rr = n % 2 ? r * 0.3 : r, a = n / 8 * TAU - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function drawSparkle(ctx, x, y, r) { star4(ctx, x, y, r); shape(ctx, P.hi, Math.max(1.2, r * 0.14)); }
function drawSweat(ctx, x, y, s) {   // капля пота: голубая, с бликом
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.bezierCurveTo(s * 0.45, -s * 0.55, s * 0.85, -s * 0.1, s * 0.85, s * 0.3);
  ctx.arc(0, s * 0.3, s * 0.85, 0, Math.PI); ctx.bezierCurveTo(-s * 0.85, -s * 0.1, -s * 0.45, -s * 0.55, 0, -s * 1.3); ctx.closePath();
  shape(ctx, P.cool, Math.max(1.5, s * 0.16));
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-s * 0.32, s * 0.2, s * 0.15, s * 0.3, 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawVein(ctx, x, y, s) {   // «венка» злости: четыре дуги, обводка тушью
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  // четыре «уголка» углом к центру, между ними — просветы крестом (как 💢)
  const g = s * 0.2, path = () => { ctx.beginPath(); for (const [a, b] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) { ctx.moveTo(a * g, b * s); ctx.quadraticCurveTo(a * g * 1.1, b * g * 1.1, a * s, b * g); } };
  path(); ctx.strokeStyle = P.ink; ctx.lineWidth = s * 0.44; ctx.stroke();
  path(); ctx.strokeStyle = P.red; ctx.lineWidth = s * 0.22; ctx.stroke();
  ctx.restore();
}
function drawStamp(ctx, m, f, t) {
  const u = Math.max(0.6, f.u), k = EASE.outBack(clamp(m.t / 0.25, 0, 1));
  if (m.k === 'sweat') drawSweat(ctx, f.x + 19 * u, f.y - 20 * u + Math.min(1, m.t / 1.6) * 7 * u, 9 * u * k);
  if (m.k === 'vein') drawVein(ctx, f.x + 17 * u, f.y - 25 * u, 9 * u * k * (1 + 0.12 * Math.sin(t * 13)));
}
function drawShockBack(ctx, c, S, t) {   // шок: вспышка-градиент от лица и радиальные линии
  const T = S.t, env = T < 0.07 ? T / 0.07 : 1 - clamp((T - 0.6) / 0.55, 0, 1);
  if (env <= 0) return;
  ctx.save();
  if (S.kind === 'shock') {
    const g = ctx.createRadialGradient(c.x, c.y, 20, c.x, c.y, 640);
    g.addColorStop(0, `rgba(255,246,226,${env})`); g.addColorStop(0.28, `rgba(243,190,160,${env * 0.95})`);
    g.addColorStop(0.62, `rgba(200,36,58,${env * 0.9})`); g.addColorStop(1, `rgba(58,26,16,${env * 0.95})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  } else {
    const g = ctx.createRadialGradient(c.x, c.y, 60, c.x, c.y, 600); g.addColorStop(0, 'rgba(243,226,192,0)'); g.addColorStop(1, `rgba(200,36,58,${env * 0.35})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  }
  const fr = Math.floor(t * 20), n = 68, r0 = S.kind === 'shock' ? 120 : 160;
  ctx.fillStyle = `rgba(58,26,16,${(S.kind === 'shock' ? 0.85 : 0.6) * env})`; ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU + (hash(k * 7.7 + fr) - 0.5) * 0.08, w = 0.006 + hash(k * 3.1 + fr * 1.3) * 0.02, r1 = r0 + hash(k * 5.3 + fr * 0.7) * 140;
    ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
    ctx.lineTo(c.x + Math.cos(a - w) * 1150, c.y + Math.sin(a - w) * 1150);
    ctx.lineTo(c.x + Math.cos(a + w) * 1150, c.y + Math.sin(a + w) * 1150); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}
function drawGloomBack(ctx, c, k, u) {   // уныние: синий тон и вертикальные «линии уныния» за героем
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(86,112,190,${k * 0.9})`; ctx.fillRect(0, 0, SW, SH);
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(12,18,44,${k * 0.3})`; ctx.fillRect(0, 0, SW, SH);
  ctx.strokeStyle = `rgba(16,22,58,${k * 0.6})`; ctx.lineCap = 'round';
  for (let n = 0; n < 24; n++) {
    const x = c.x + (n - 11.5) * 15 * Math.max(1, u) + hash(n * 3.3) * 8, len = (160 + hash(n * 9.1) * 180 - Math.abs(n - 11.5) * 8) * Math.max(1, u * 0.8);
    ctx.lineWidth = 2 + hash(n * 1.7) * 3; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, -10 + len * k); ctx.stroke();
  }
  ctx.restore();
}
function drawGloomFront(ctx, f, k, t) {   // тучка над головой и дождик колонной, лёгкий синий тон и на герое
  const u = Math.max(0.7, f.u);
  ctx.save();
  ctx.fillStyle = `rgba(40,64,140,${k * 0.15})`; ctx.fillRect(0, 0, SW, SH);
  const cy = Math.max(TOPPAD, f.y - 90 * u), cw = 50 * clamp(u, 0.8, 1.5);
  // дождь из тучки
  ctx.strokeStyle = `rgba(200,222,255,${0.75 * k})`; ctx.lineWidth = Math.max(1.5, 1.6 * u); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let n = 0; n < 26; n++) {
    const x0 = f.x - cw * 0.85 + hash(n * 2.3) * cw * 1.7, len = 16 * u, span = SH - cy;
    const y = cy + ((hash(n * 5.9) * span + t * 620) % span), x = x0 - (y - cy) * 0.08;
    ctx.moveTo(x, y); ctx.lineTo(x - 2 * u, y + len);
  }
  ctx.stroke();
  // мелкий дождь по кадру
  ctx.strokeStyle = `rgba(190,210,250,${0.22 * k})`; ctx.lineWidth = 1; ctx.beginPath();
  for (let n = 0; n < 50; n++) { const x = hash(n * 7.1) * SW, y = (hash(n * 3.9) * SH + t * 520) % SH; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 18); }
  ctx.stroke();
  // тучка
  ctx.globalAlpha = k; ctx.translate(f.x, cy + Math.sin(t * 2) * 2 * u);
  ctx.beginPath();
  for (const [x, y, r] of [[-0.6, 0.15, 0.36], [-0.2, -0.18, 0.46], [0.28, -0.08, 0.4], [0.62, 0.18, 0.3]]) { ctx.moveTo(x * cw + r * cw, y * cw); ctx.arc(x * cw, y * cw, r * cw, 0, TAU); }
  ctx.rect(-0.62 * cw, 0.05 * cw, 1.24 * cw, 0.42 * cw);
  ctx.lineWidth = Math.max(4, 5.2 * u); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.stroke();   // двойная обводка под заливкой — контур только снаружи
  ctx.fillStyle = '#5d6a8e'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(-0.3 * cw, -0.28 * cw, 0.14 * cw, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawRomanceBack(ctx, c, k, t) {   // романтика: мягкий розовый свет и боке за героями
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 480);
  g.addColorStop(0, `rgba(255,200,212,${0.7 * k})`); g.addColorStop(0.5, `rgba(240,120,160,${0.28 * k})`); g.addColorStop(1, 'rgba(120,20,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  for (let n = 0; n < 18; n++) {
    const r = 14 + hash(n * 2.9) * 36, x = hash(n * 4.7) * SW + Math.sin(t * 0.4 + n) * 30;
    const y = ((hash(n * 8.3) * SH - t * (8 + hash(n) * 14)) % SH + SH) % SH, tw = 0.55 + 0.45 * Math.sin(t * 1.3 + n * 2.1);
    const col = n % 3 === 0 ? '255,214,150' : n % 3 === 1 ? '255,160,190' : '255,236,220';
    const gg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r); gg.addColorStop(0, `rgba(${col},${0.3 * k * tw})`); gg.addColorStop(0.82, `rgba(${col},${0.24 * k * tw})`); gg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawRomanceFront(ctx, faces, k, t) {   // лепестки, сердечки и искорки у лиц
  ctx.save(); ctx.globalAlpha = k;
  for (let n = 0; n < 16; n++) {
    const sp = 34 + hash(n * 1.9) * 40, span = SW + 200;
    const x = (((hash(n * 6.1) * span - t * sp * 0.6) % span) + span) % span - 100 + Math.sin(t * 1.5 + n) * 18;
    const y = ((hash(n * 3.7) * (SH + 80) + t * sp) % (SH + 80)) - 40;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.2 + n); ctx.scale(1, 0.5 + 0.5 * Math.abs(Math.sin(t * 2.6 + n)));
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, 0, 0, TAU); shape(ctx, n % 4 ? '#f6aac0' : P.hi, 1.4); ctx.restore();
  }
  faces.forEach((f, fi) => {
    const u = Math.max(0.7, f.u);
    for (let n = 0; n < 4; n++) {   // сердечки поднимаются
      const ph = (t * 0.45 + hash(n * 2.2 + fi)) % 1, x = f.x + (n % 2 ? 1 : -1) * (46 + hash(n * 5.5 + fi * 3) * 50) * u + Math.sin(t * 3 + n) * 6, y = f.y - 16 * u - ph * 120 * u;
      ctx.globalAlpha = k * Math.sin(ph * Math.PI); heartPath(ctx, x, y, (5 + hash(n + fi) * 4) * u); shape(ctx, P.pink, 1.5);
    }
    for (let n = 0; n < 4; n++) {   // искорки мерцают
      const a = -Math.PI * (0.08 + 0.84 * hash(n * 9.3 + fi)), r = (50 + hash(n * 4.1) * 40) * u, tw = Math.max(0, Math.sin(t * 3.2 + n * 1.7 + fi));
      ctx.globalAlpha = k; if (tw > 0.05) drawSparkle(ctx, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.8, 9 * u * tw);
    }
  });
  ctx.restore();
}

function drawWhip(ctx, k) {   // «хлыст»: горизонтальные штрихи на проезде
  const a = Math.sin(k * Math.PI);
  ctx.save(); ctx.globalAlpha = a * 0.5;
  for (let n = 0; n < 22; n++) {
    const y = (n * 97.3 + 13) % SH, w = 120 + (n * 53) % 260, x = ((n * 211) % (SW + 300)) - 150 - k * 300;
    ctx.fillStyle = n % 3 ? 'rgba(255,255,255,0.5)' : 'rgba(255,200,170,0.6)'; ctx.fillRect(x, y, w, 2 + (n % 3));
  }
  ctx.restore();
}
function drawIris(ctx, cx, cy, r) {
  ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, SW, SH);
  if (r > 0.5) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); }
  ctx.fill('evenodd'); ctx.restore();
}
function drawBurn(ctx, cx, cy, k, t) {   // прожог плёнки: рваное пятно растёт
  const R = EASE.inQuad(k) * 1250 + 10;
  const path = () => { ctx.beginPath(); for (let n = 0; n <= 48; n++) { const a = n / 48 * TAU, rr = R * (1 + 0.15 * Math.sin(a * 5 + 1.3) * Math.sin(a * 3 + t * 4)); n ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); };
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
  g.addColorStop(0, '#fff1c9'); g.addColorStop(0.62, '#fff1c9'); g.addColorStop(0.82, '#ff7a1a'); g.addColorStop(1, '#0e0612');
  ctx.fillStyle = g; path(); ctx.fill();
}

// ---------- холодное открытие: ракорд 3-2-1 (эталон стиля вставок) ----------
// bw — ширина перфорированных полос по бокам (80 в ландшафте, 48 в портрете), R — радиус диафрагмы «раскрытия» (720 / до дальнего угла вида)
function drawCold(ctx, T, pt, bw = 80, R = 720) {
  if (T >= COLD.reveal) { drawIris(ctx, pt.x, pt.y, EASE.outCubic(clamp((T - COLD.reveal) / 0.7, 0, 1)) * R); return; }
  ctx.fillStyle = '#060305'; ctx.fillRect(0, 0, SW, SH);
  if (T >= COLD.flash) { ctx.fillStyle = '#fff6e0'; ctx.fillRect(0, 0, SW, SH); return; }
  const r = Math.random, cx = SW / 2, cy = SH / 2, iw = SW - 2 * bw;
  if (T < COLD.lead) {   // проектор разгоняется: мерцающий прямоугольник света
    ctx.fillStyle = `rgba(255,236,200,${(0.04 + r() * 0.07) * (0.3 + T / COLD.lead)})`; ctx.fillRect(bw + 10, 40, iw - 20, SH - 80);
  } else {
    const u = (T - COLD.lead) / COLD.num, n = 3 - Math.floor(u), kk = u % 1;
    ctx.save(); ctx.translate(0, (r() - 0.5) * 3);
    leaderPaper(ctx, kk, cy, 196, bw);
    text(ctx, String(n), cx, cy + 14, { size: 240, color: '#1e140c', outline: '#f8f0e0', lw: 8 });
    const vg = ctx.createRadialGradient(cx, cy, 250, cx, cy, 560); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg; ctx.fillRect(bw, -4, iw, SH + 8);
    for (let q = 0; q < 3; q++) if (r() < 0.5) { ctx.fillStyle = `rgba(20,12,6,${0.2 + r() * 0.3})`; ctx.fillRect(bw + 20 + r() * (iw - 40), 0, 1 + r() * 1.5, SH); }
    ctx.restore();
  }
  perforation(ctx, (T * 1100) % 54, bw);
}
// бумага ракорда: сепия-градиент, сектор «радара», перекрестие, двойное кольцо
function leaderPaper(ctx, sweep, cy = SH / 2, ring = 196, bw = 80) {
  const cx = SW / 2, g = ctx.createRadialGradient(cx, SH / 2, 60, cx, SH / 2, 520); g.addColorStop(0, '#e2d1ae'); g.addColorStop(1, '#5e4a33');
  ctx.fillStyle = g; ctx.fillRect(bw, -4, SW - 2 * bw, SH + 8);
  if (sweep != null) { ctx.fillStyle = 'rgba(40,28,16,0.33)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 560, -Math.PI / 2, -Math.PI / 2 + sweep * TAU); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(40,30,20,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bw, cy); ctx.lineTo(SW - bw, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, SH); ctx.stroke();
  ctx.strokeStyle = '#f8f0e0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, ring, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, ring - 30, 0, TAU); ctx.stroke();
}
function perforation(ctx, off, bw = 80) {   // перфорация по краям плёнки
  ctx.fillStyle = '#0b0806'; ctx.fillRect(0, 0, bw, SH); ctx.fillRect(SW - bw, 0, bw, SH);
  ctx.fillStyle = 'rgba(217,199,164,0.35)';
  const hx = (bw - 32) / 2;
  for (let y = -54 + off; y < SH; y += 54) { ctx.beginPath(); ctx.roundRect(hx, y, 32, 22, 5); ctx.roundRect(SW - bw + hx, y, 32, 22, 5); ctx.fill(); }
}
// Финальная карточка: тот же ракорд, сердце в кольце и посвящение оригинала. В портрете (SW < 700) фраза переносится по словам, крупнее и ниже сердца
function drawEndCard(ctx, T, bw = 80) {
  const pt = SW < 700, cx = SW / 2, iw = SW - 2 * bw, hy = pt ? SH * 0.3 : 196;
  ctx.fillStyle = '#060305'; ctx.fillRect(0, 0, SW, SH);
  const a = clamp(T / 0.7, 0, 1), fr = Math.floor(T * 24);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (hash(fr) - 0.5) * 2.4 * (1 - clamp(T / 3, 0, 1)));
  leaderPaper(ctx, null, hy - 6, 104, bw);
  const beat = Math.max(0, Math.sin(T * 5.5)) ** 8, hk = EASE.outBack(clamp((T - 0.3) / 0.4, 0, 1));
  ctx.save(); ctx.translate(cx, hy); ctx.scale(hk * (1 + beat * 0.1), hk * (1 + beat * 0.1)); heartPath(ctx, 0, 0, 40); shape(ctx, P.red, 6);
  ctx.fillStyle = 'rgba(255,246,226,0.7)'; ctx.beginPath(); ctx.ellipse(-22, -18, 7, 12, 0.6, 0, TAU); ctx.fill(); ctx.restore();
  const l1 = clamp((T - 0.9) / 0.6, 0, 1), l2 = clamp((T - 1.6) / 0.6, 0, 1), l3 = clamp((T - 2.6) / 0.8, 0, 1);
  if (!pt) {
    ctx.globalAlpha = a * l1; text(ctx, 'посвящается всем девушкам,', cx, 352 + (1 - l1) * 8, { size: 34, color: P.ink, outline: false, weight: 900 });
    ctx.globalAlpha = a * l2; text(ctx, 'которых не пугают неприятности', cx, 398 + (1 - l2) * 8, { size: 34, color: P.ink, outline: false, weight: 900 });
    ctx.globalAlpha = a * l3; text(ctx, 'Поппи: Хэллоуинский кошмар · КОНЕЦ', cx, 462, { size: 15, color: '#5e4a33', outline: false, weight: 900 });
  } else {
    let y = hy + 112;
    for (const [str, k] of [['посвящается всем девушкам,', l1], ['которых не пугают неприятности', l2]]) {
      ctx.globalAlpha = a * k;
      for (const ln of wrap(ctx, str, iw - 56, 32, 900)) { text(ctx, ln, cx, y + (1 - k) * 8, { size: 32, color: P.ink, outline: false, weight: 900 }); y += 40; }
      y += 10;
    }
    ctx.globalAlpha = a * l3; y += 14;
    for (const ln of wrap(ctx, 'Поппи: Хэллоуинский кошмар · КОНЕЦ', iw - 40, 18, 900)) { text(ctx, ln, cx, y, { size: 18, color: '#5e4a33', outline: false, weight: 900 }); y += 24; }
  }
  ctx.globalAlpha = a;
  const vg = ctx.createRadialGradient(cx, SH / 2, 250, cx, SH / 2, 560); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(bw, -4, iw, SH + 8);
  if (hash(fr * 1.7) < 0.3) { ctx.fillStyle = 'rgba(40,24,12,0.3)'; ctx.fillRect(bw + 20 + hash(fr) * (iw - 40), 0, 1.2, SH); }
  ctx.restore();
  perforation(ctx, (54 * 8 * EASE.outCubic(clamp(T / 1.6, 0, 1))) % 54, bw);   // плёнка доезжает и встаёт
}

// ---------- кнопка пропуска с кольцом ----------
function drawSkip(ctx, k, hover, active, rect = SB, size = 14) {
  const { x, y, w, h } = rect, r = h / 2;
  ctx.save();
  ctx.fillStyle = hover || active ? 'rgba(70,46,64,0.95)' : 'rgba(40,26,38,0.85)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  text(ctx, active ? 'Держи…' : 'Пропустить ›', x + w / 2, y + h / 2 + 1, { size, color: active ? GOLD : '#f3e2ea', outline: false, weight: 900 });
  if (k > 0) {
    const per = 2 * (w - 2 * r) + TAU * r;
    ctx.lineWidth = 3.5; ctx.strokeStyle = GOLD; ctx.lineCap = 'round';
    ctx.setLineDash([per * Math.min(1, k), per + 10]);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); ctx.lineTo(x + w / 2, y); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---------- вставки: «кинокадры» одной семьи ----------
// Кусок плёнки: тёмная основа, перфорация по бокам (плёнка «доезжает» в окно), кремовый кадр с сепией,
// перекрестием и кольцом ракорда, наклон, появление с перелётом, дрожь 24 к/с, уход вниз с поворотом.
const CARD = { w: 248, h: 214, band: 24 };
let CA = 1;   // прозрачность текущей карточки (уход) — рисовальщики вставок умножают на неё свою
function drawFilmCard(ctx, o, w, h, paint) {
  const kIn = clamp(o.t / 0.34, 0, 1), kOut = o.dur != null ? clamp((o.t - o.dur) / 0.32, 0, 1) : 0;
  const eIn = EASE.outBack(kIn), sc = (0.2 + 0.8 * eIn) * (1 - 0.2 * EASE.inQuad(kOut)) * (o.s || 1);   // o.s — масштаб карточки (портрет крупнее)
  const fr = Math.floor(o.t * 24), sd = o.rot >= 0 ? 1 : -1;
  ctx.save(); ctx.globalAlpha = CA = 1 - EASE.inQuad(kOut);
  ctx.translate(o.x + (hash(fr * 3.1 + o.x) - 0.5) * 1.2 + kOut * 70 * sd, o.y + (hash(fr * 1.7 + o.y) - 0.5) * 1.2 + EASE.inQuad(kOut) * 110);
  ctx.rotate(o.rot + (1 - eIn) * 0.45 * sd + kOut * 0.35 * sd); ctx.scale(sc, sc);
  const hw = w / 2, hh = h / 2, B = CARD.band;
  ctx.fillStyle = 'rgba(8,2,6,0.45)'; ctx.beginPath(); ctx.roundRect(-hw + 9, -hh + 11, w, h, 6); ctx.fill();
  ctx.fillStyle = P.film; ctx.beginPath(); ctx.roundRect(-hw, -hh, w, h, 6); ctx.fill();
  const off = ((1 - EASE.outCubic(kIn)) * 88) % 22;
  ctx.save(); ctx.beginPath(); ctx.rect(-hw, -hh + 3, w, h - 6); ctx.clip();
  ctx.fillStyle = 'rgba(243,226,192,0.4)'; ctx.beginPath();
  for (let y = -hh - 22 + off; y < hh + 22; y += 22) { ctx.roundRect(-hw + 6, y, B - 12, 11, 3); ctx.roundRect(hw - B + 6, y, B - 12, 11, 3); }
  ctx.fill(); ctx.restore();
  const pw = w - 2 * B, ph = h - 14;
  ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, -ph / 2, pw, ph); ctx.clip();
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, Math.max(pw, ph) * 0.72); g.addColorStop(0, '#f7ebcf'); g.addColorStop(1, '#c4a374');
  ctx.fillStyle = g; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.strokeStyle = 'rgba(58,26,16,0.13)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-pw / 2, 0); ctx.lineTo(pw / 2, 0); ctx.moveTo(0, -ph / 2); ctx.lineTo(0, ph / 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,232,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, Math.min(pw, ph) * 0.44, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, Math.min(pw, ph) * 0.44 - 13, 0, TAU); ctx.stroke();
  paint(ctx, o.t, pw, ph);
  const vg = ctx.createRadialGradient(0, 0, Math.min(pw, ph) * 0.35, 0, 0, Math.max(pw, ph) * 0.75); vg.addColorStop(0, 'rgba(40,20,8,0)'); vg.addColorStop(1, 'rgba(40,20,8,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  if (hash(fr * 2.3 + o.x) < 0.35) { ctx.fillStyle = 'rgba(58,26,16,0.28)'; ctx.fillRect(-pw / 2 + hash(fr) * pw, -ph / 2, 1.2, ph); }   // царапина
  if (hash(fr * 5.1) < 0.12) { ctx.fillStyle = 'rgba(58,26,16,0.4)'; ctx.beginPath(); ctx.arc((hash(fr * 7) - 0.5) * pw, (hash(fr * 9) - 0.5) * ph, 1.6, 0, TAU); ctx.fill(); }
  if (kIn < 1) { ctx.fillStyle = `rgba(255,248,232,${(1 - kIn) * 0.9})`; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); }   // вспышка при появлении
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.restore();
}
function drawInsert(ctx, o) { drawFilmCard(ctx, o, CARD.w, CARD.h, INSERTS[o.k] || (() => {})); }
// Плашка главы — большой кинокадр по центру
function drawPlate(ctx, pl, T) {
  const pt = SW < 700;   // портрет: карточка уже окна, крупнее подпись
  drawFilmCard(ctx, pt ? { x: SW / 2, y: SH * 0.44, rot: -0.025, t: T, dur: null } : { x: 480, y: 250, rot: -0.025, t: T, dur: null }, pt ? Math.min(500, SW - 30) : 620, pt ? 250 : 210, (c, TT, pw) => {
    if (pl.top) text(c, pl.top, 0, -52, { size: pt ? 24 : 20, color: '#7a5a36', outline: false, weight: 900 });
    text(c, pl.title, 0, pl.sub ? -2 : 8, { size: pt ? 54 : 58, color: P.ink, outline: false, weight: 900 });
    const k = clamp((TT - 0.35) / 0.4, 0, 1);
    if (k > 0) { c.strokeStyle = P.red; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); const L = pw * 0.36; c.moveTo(-L, 38 + (pl.sub ? -6 : 8)); c.quadraticCurveTo(0, 46 + (pl.sub ? -6 : 8), -L + 2 * L * k, 34 + (pl.sub ? -6 : 8)); c.stroke(); }
    if (pl.sub) text(c, pl.sub, 0, 62, { size: pt ? 20 : 18, color: '#5e4a33', outline: false, weight: 800 });
  });
}
// звукоподражание: тушь + красная кайма + бумажная заливка, буквы скачут
function sfxWord(ctx, s, x, y, size, T, rot = -0.15) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `900 ${size}px ${FONT}`; let cx = -ctx.measureText(s).width / 2;
  [...s].forEach((ch, n) => {
    const w = (ctx.font = `900 ${size}px ${FONT}`, ctx.measureText(ch).width), dy = Math.sin(T * 18 + n * 1.3) * size * 0.08;
    text(ctx, ch, cx + w / 2, dy, { size, color: P.ink, outline: P.ink, lw: size * 0.42 });
    text(ctx, ch, cx + w / 2, dy, { size, color: P.hi, outline: P.red, lw: size * 0.2 });
    cx += w;
  });
  ctx.restore();
}
function calPage(ctx, T, month, num, day, note, tear) {
  ctx.save(); ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(58,26,16,0.25)'; ctx.fillRect(-64, -64, 140, 156);
  const page = (n, col) => {
    ctx.beginPath(); ctx.rect(-70, -72, 140, 156); shape(ctx, col || P.hi, 4);
    ctx.beginPath(); ctx.rect(-70, -72, 140, 34); shape(ctx, P.red, 4);
    text(ctx, month, 0, -54, { size: 17, color: P.hi, outline: false });
    text(ctx, n, 0, 14, { size: 78, color: P.ink, outline: false });
    text(ctx, day, 0, 62, { size: 14, color: '#7a5a36', outline: false, weight: 800 });
  };
  page(num);
  for (let n = 0; n < 4; n++) { ctx.beginPath(); ctx.arc(-48 + n * 32, -72, 6, 0, TAU); shape(ctx, P.sh, 3); }
  const k = clamp((T - 0.45) / 0.45, 0, 1);
  if (k > 0) {   // красный кружок от руки
    ctx.strokeStyle = P.red; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
    for (let a = 0; a <= k * TAU * 1.12; a += 0.08) { const an = a - 2, rx = 52 + Math.sin(a * 2.3) * 3, ry = 40 + Math.cos(a * 1.7) * 3; ctx.lineTo(Math.cos(an) * rx, 14 + Math.sin(an) * ry); }
    ctx.stroke();
  }
  if (note) note(T);
  if (tear && T < 0.55) {   // предыдущий листок отрывается и улетает
    const e = EASE.inQuad(clamp(T / 0.55, 0, 1));
    ctx.save(); ctx.translate(e * 120, -e * 150); ctx.rotate(e * 0.9); ctx.globalAlpha = CA * (1 - e); page(tear, P.paper); ctx.restore();
  }
  ctx.restore();
}
const INSERTS = {
  // листок отрывного календаря: «30» улетает, «31» обведено, сердечко на полях
  calendar(ctx, T) {
    calPage(ctx, T, 'ОКТЯБРЬ', '31', 'суббота', TT => {
      if (TT > 0.85) { const s = EASE.outBack(clamp((TT - 0.85) / 0.25, 0, 1)); heartPath(ctx, 56, -24, 9 * s); shape(ctx, P.pink, 2.5); }
    }, '30');
  },
  // тот же календарь через месяц: «она вернётся»
  calnext(ctx, T) {
    calPage(ctx, T, 'НОЯБРЬ', '28', '', TT => {
      if (TT > 0.85) {
        const s = EASE.outBack(clamp((TT - 0.85) / 0.25, 0, 1));
        ctx.save(); ctx.translate(54, -22); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, -12); ctx.bezierCurveTo(6, -4, 10, 2, 10, 6); ctx.arc(0, 6, 10, 0, Math.PI); ctx.bezierCurveTo(-10, 2, -6, -4, 0, -12); ctx.closePath(); shape(ctx, P.red, 2.5); ctx.restore();
        ctx.save(); ctx.rotate(-0.12); ctx.globalAlpha = CA * clamp((TT - 1.0) / 0.3, 0, 1);
        ctx.font = `italic 900 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.red; ctx.fillText('она вернётся', -4, 66); ctx.restore();
      }
    }, '27');
  },
  // билет на двоих
  ticket(ctx, T) {
    const tk = (fill, txt) => {
      ctx.beginPath(); ctx.moveTo(-86, -46); ctx.lineTo(86, -46); ctx.lineTo(86, -12); ctx.arc(86, 0, 12, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(86, 46);
      ctx.lineTo(-86, 46); ctx.lineTo(-86, 12); ctx.arc(-86, 0, 12, Math.PI / 2, -Math.PI / 2, true); ctx.closePath(); shape(ctx, fill, 4);
      if (!txt) return;
      ctx.strokeStyle = P.hi; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(44, -40); ctx.lineTo(44, 40); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'КИНО', -22, -20, { size: 30, color: P.hi, outline: false });
      text(ctx, 'УЖАСЫ · 21:00', -22, 10, { size: 14, color: P.hi, outline: false, weight: 900 });
      text(ctx, 'ряд 7 · место 13', -22, 30, { size: 12, color: P.paper, outline: false, weight: 800 });
      ctx.save(); ctx.translate(66, 0); ctx.rotate(-Math.PI / 2); text(ctx, 'НА ДВОИХ', 0, 10, { size: 10, color: P.hi, outline: false }); ctx.restore();
      const s = 1 + Math.max(0, Math.sin(T * 7)) ** 6 * 0.25; heartPath(ctx, 66, -6, 8 * s); shape(ctx, P.pink, 2.5);
    };
    ctx.save(); ctx.translate(10, -26); ctx.rotate(0.16); tk(P.sh, false); ctx.restore();
    ctx.save(); ctx.translate(0, 18 + Math.sin(T * 3) * 2); ctx.rotate(-0.08); tk(P.red, true); ctx.restore();
  },
  // ведёрко попкорна, зёрна выстреливают
  popcorn(ctx, T) {
    const bucket = () => { ctx.beginPath(); ctx.moveTo(-60, -4); ctx.lineTo(60, -4); ctx.lineTo(44, 88); ctx.lineTo(-44, 88); ctx.closePath(); };
    bucket(); ctx.save(); ctx.clip();
    for (let n = -4; n < 4; n++) { ctx.fillStyle = n % 2 ? P.red : P.hi; ctx.beginPath(); ctx.moveTo(n * 16, -4); ctx.lineTo(n * 16 + 16, -4); ctx.lineTo(n * 11.4 + 11.4, 88); ctx.lineTo(n * 11.4, 88); ctx.closePath(); ctx.fill(); }
    ctx.restore(); bucket(); shape(ctx, null, 4);
    for (let n = 0; n < 13; n++) {
      const x = -50 + (n % 7) * 17 + (n > 6 ? 8 : 0), y = -12 - (n > 6 ? 18 : 0) - Math.sin(n * 2.1) * 4, r = 11 + (n % 3);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x + r * 1.2, y - r * 0.5); ctx.arc(x + r * 0.6, y - r * 0.5, r * 0.6, 0, TAU); blob(ctx, P.hi, 2.5);
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.32, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.roundRect(-66, -10, 132, 14, 4); shape(ctx, P.hi, 4);
    ctx.beginPath(); ctx.arc(0, 42, 21, 0, TAU); shape(ctx, P.gold, 3.5); text(ctx, 'ПОП', 0, 43, { size: 14, color: P.red, outline: false });
    for (let n = 0; n < 3; n++) {
      const tt = (T + n * 0.3) % 0.9, x = [-22, 8, 32][n] + 44 * tt * (n - 1), y = -40 - (290 * tt - 300 * tt * tt);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.moveTo(x + 10, y - 3); ctx.arc(x + 5, y - 3, 5, 0, TAU); blob(ctx, P.hi, 2.2);
    }
    if ((T % 0.9) < 0.35) sfxWord(ctx, 'ПОП!', 58, -70, 20, T, 0.2);
  },
  // чайник со свистком: силуэт, конфорка, крышка гремит, пар клубами, свисток, тряска, сердитое «лицо»
  kettle(ctx, T) {
    const heat = clamp(T / 1.1, 0, 1), boil = clamp((T - 0.55) / 0.4, 0, 1);
    const g = ctx.createRadialGradient(0, 50, 10, 0, 50, 140); g.addColorStop(0, `rgba(232,88,58,${0.12 + heat * 0.5})`); g.addColorStop(1, 'rgba(232,88,58,0)');
    ctx.fillStyle = g; ctx.fillRect(-100, -100, 200, 200);
    // конфорка и пламя
    for (let n = 0; n < 7; n++) {
      const x = -48 + n * 16, fl = 11 + 6 * Math.sin(T * 22 + n * 1.7) + heat * 7;
      ctx.beginPath(); ctx.moveTo(x - 7, 90); ctx.quadraticCurveTo(x - 7, 90 - fl * 0.6, x, 90 - fl); ctx.quadraticCurveTo(x + 7, 90 - fl * 0.6, x + 7, 90); ctx.closePath(); shape(ctx, P.red, 2.5);
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.moveTo(x - 3, 90); ctx.quadraticCurveTo(x, 90 - fl * 0.8, x + 3, 90); ctx.fill();
    }
    ctx.beginPath(); ctx.roundRect(-70, 86, 140, 10, 4); shape(ctx, P.ink, 0);
    const body = mix(P.hi, '#e8604a', heat * 0.85), shade = mix(P.sh, P.redDk, heat * 0.8);
    const sh = boil * 2.4 + heat * 0.5, sq = 1 + Math.sin(T * 26) * 0.03 * boil;
    ctx.save(); ctx.translate(-10 + Math.sin(T * 61) * sh, Math.abs(Math.sin(T * 37)) * -sh); ctx.translate(0, 80); ctx.scale(1 / sq, sq); ctx.translate(0, -80);
    const bodyPath = () => { ctx.beginPath(); ctx.moveTo(-58, 78); ctx.bezierCurveTo(-76, 44, -66, 0, -34, -12); ctx.bezierCurveTo(-14, -19, 14, -19, 34, -12); ctx.bezierCurveTo(66, 0, 76, 44, 58, 78); ctx.quadraticCurveTo(0, 86, -58, 78); ctx.closePath(); };
    // ручка-дуга
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-36, -8); ctx.bezierCurveTo(-40, -66, 40, -66, 36, -8);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 14; ctx.stroke(); ctx.strokeStyle = P.red; ctx.lineWidth = 7; ctx.stroke();
    // носик со свистком
    ctx.beginPath(); ctx.moveTo(44, 54); ctx.bezierCurveTo(64, 46, 76, 22, 84, -2); ctx.lineTo(96, 3); ctx.bezierCurveTo(90, 30, 76, 60, 52, 74); ctx.closePath(); shape(ctx, body, 4);
    ctx.save(); ctx.translate(91, -3); ctx.rotate(-0.42 + Math.sin(T * 40) * 0.1 * boil); ctx.beginPath(); ctx.roundRect(-9, -13, 18, 15, 4); shape(ctx, P.red, 3.5);
    ctx.beginPath(); ctx.arc(0, -6, 2.6, 0, TAU); shape(ctx, P.ink, 0); ctx.restore();
    // корпус: заливка, тень справа, красный поясок, блик
    bodyPath(); shape(ctx, body, 0);
    ctx.save(); bodyPath(); ctx.clip();
    ctx.fillStyle = shade; ctx.beginPath(); ctx.ellipse(56, 44, 34, 66, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = P.red; ctx.fillRect(-90, 52, 180, 11);
    ctx.fillStyle = 'rgba(255,252,240,0.9)'; ctx.beginPath(); ctx.ellipse(-36, 18, 8, 22, 0.45, 0, TAU); ctx.fill();
    ctx.restore();
    bodyPath(); shape(ctx, null, 5);
    // сердитое «лицо» чайника — как у Поппи
    if (heat > 0.25) {
      const e = clamp((heat - 0.25) / 0.3, 0, 1);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 16 - 3 * e); ctx.lineTo(-10, 22); ctx.moveTo(22, 16 - 3 * e); ctx.lineTo(6, 22); ctx.stroke();
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(-16, 30, 3.5, 5, 0, 0, TAU); ctx.ellipse(12, 30, 3.5, 5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, 44); for (let n = 0; n <= 4; n++) ctx.lineTo(-10 + n * 5, 44 + (n % 2 ? -3 : 1) * e); ctx.lineWidth = 3; ctx.stroke();
    }
    // крышка гремит
    const lid = boil * Math.max(0, Math.sin(T * 30)) * 5;
    ctx.save(); ctx.translate(0, -lid); ctx.rotate(Math.sin(T * 33) * 0.08 * boil);
    ctx.beginPath(); ctx.ellipse(0, -14, 26, 7, 0, 0, TAU); shape(ctx, shade, 4);
    ctx.beginPath(); ctx.arc(0, -23, 7, 0, TAU); shape(ctx, P.red, 3.5); ctx.restore();
    ctx.restore();
    // пар из свистка — клубы с обводкой, и дуги свиста
    for (let n = 0; n < 6; n++) {
      const tt = (T * 1.5 + n / 6) % 1, vis = clamp((T - 0.45 - n * 0.04) / 0.2, 0, 1);
      if (vis <= 0) continue;
      const x = 84 + tt * 18 + Math.sin(tt * 8 + n) * 5, y = -22 - tt * 82, r = 5 + tt * 13;
      ctx.globalAlpha = CA * vis * (1 - tt * 0.85); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x - r * 0.7, y + r * 0.4, r * 0.6, 0, TAU); ctx.arc(x + r * 0.7, y + r * 0.3, r * 0.55, 0, TAU); blob(ctx, P.hi, 2.5);
    }
    ctx.globalAlpha = CA;
    if (boil > 0) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let n = 0; n < 3; n++) { const r = 14 + n * 9 + (T * 40 % 9); ctx.globalAlpha = CA * boil * (1 - n * 0.28); ctx.beginPath(); ctx.arc(80, -12, r, -1.9, -1.1); ctx.stroke(); }
      ctx.globalAlpha = CA;
      sfxWord(ctx, 'ФЬЮЮЮ!', -26, -72, 24 * (0.8 + 0.2 * EASE.outBack(clamp((T - 0.55) / 0.3, 0, 1))), T, -0.18);
    }
  },
  // будильник: колокольчики, молоточек, бегущие стрелки, «ТИК-ТАК»
  clock(ctx, T) {
    ctx.save(); ctx.translate(0, 16); ctx.rotate(Math.sin(T * 48) * 0.06);
    ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-34, 48); ctx.lineTo(-46, 70); ctx.moveTo(34, 48); ctx.lineTo(46, 70); ctx.stroke();
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 40, -52); ctx.rotate(sd * 0.5 + Math.sin(T * 60 + sd) * 0.12); ctx.beginPath(); ctx.arc(0, 0, 20, Math.PI, 0); ctx.closePath(); shape(ctx, P.gold, 4); ctx.beginPath(); ctx.arc(0, -22, 4.5, 0, TAU); shape(ctx, P.ink, 0); ctx.restore(); }
    ctx.save(); ctx.translate(0, -60); ctx.rotate(Math.sin(T * 60) * 0.5); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -10); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -12, 5, 0, TAU); shape(ctx, P.red, 3); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); shape(ctx, P.red, 5);
    ctx.fillStyle = 'rgba(255,246,226,0.55)'; ctx.beginPath(); ctx.arc(-40, -30, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); shape(ctx, P.hi, 3.5);
    ctx.lineWidth = 3; ctx.strokeStyle = P.ink;
    for (let n = 0; n < 12; n++) { const a = n / 12 * TAU, r2 = n % 3 ? 37 : 33; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke(); }
    const hand = (a, l, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); };
    hand(-Math.PI / 2 + 8.9 / 12 * TAU + T * 0.4, 24, 6, P.ink); hand(-Math.PI / 2 + T * TAU * 1.4, 34, 4, P.ink); hand(-Math.PI / 2 + T * TAU * 4, 38, 2, P.red);
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); shape(ctx, P.red, 2);
    ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) for (let n = 0; n < 3; n++) { const a = sd < 0 ? Math.PI + 0.4 + n * 0.35 : -0.4 - n * 0.35, r = 70 + ((T * 30 + n * 4) % 10); ctx.beginPath(); ctx.moveTo(sd * 40 + Math.cos(a) * r * 0.55, -36 + Math.sin(a) * r * 0.55); ctx.lineTo(sd * 40 + Math.cos(a) * r * 0.7, -36 + Math.sin(a) * r * 0.7); ctx.stroke(); }
    const tick = Math.floor(T * 2) % 2;
    sfxWord(ctx, tick ? 'ТАК' : 'ТИК', tick ? 58 : -58, -80, 18, T, tick ? 0.2 : -0.2);
  },
  // дверь туалета: «ЗАНЯТО» мигает, очередь силуэтов в костюмах
  wc(ctx, T) {
    ctx.strokeStyle = 'rgba(58,26,16,0.18)'; ctx.lineWidth = 1.5;
    for (let x = -100; x < 100; x += 25) { ctx.beginPath(); ctx.moveTo(x, -100); ctx.lineTo(x, 100); ctx.stroke(); }
    for (let y = -100; y < 100; y += 25) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(100, y); ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(-56, -92, 112, 200, 6); shape(ctx, P.sepia, 4);
    ctx.strokeStyle = 'rgba(58,26,16,0.45)'; ctx.lineWidth = 3; ctx.strokeRect(-42, -78, 84, 52); ctx.strokeRect(-42, 22, 84, 60);
    ctx.beginPath(); ctx.arc(0, -52, 21, 0, TAU); shape(ctx, P.ink, 0); text(ctx, 'WC', 0, -51, { size: 18, color: P.paper, outline: false });
    ctx.beginPath(); ctx.arc(40, 6, 6, 0, TAU); shape(ctx, P.gold, 3);
    const on = Math.floor(T * 4) % 2 === 0;
    ctx.beginPath(); ctx.roundRect(-38, -14, 70, 22, 5); shape(ctx, on ? P.red : P.redDk, 3); text(ctx, 'ЗАНЯТО', -3, -3, { size: 12, color: P.hi, outline: false });
    for (let n = 0; n < 5; n++) {   // очередь: ведьма, кошка, тыква…
      const x = -84 + n * 42, y = 112 + Math.sin(T * 5 + n * 1.3) * 2;
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(x, y, 22, 18, 0, 0, TAU); ctx.arc(x, y - 30, 13, 0, TAU); ctx.fill();
      if (n === 1) { ctx.beginPath(); ctx.moveTo(x - 20, y - 38); ctx.lineTo(x + 20, y - 38); ctx.lineTo(x + 4, y - 74); ctx.closePath(); ctx.fill(); }
      if (n === 3) { ctx.beginPath(); ctx.moveTo(x - 12, y - 36); ctx.lineTo(x - 10, y - 54); ctx.lineTo(x - 2, y - 42); ctx.moveTo(x + 12, y - 36); ctx.lineTo(x + 10, y - 54); ctx.lineTo(x + 2, y - 42); ctx.fill(); }
      if (n === 4) { ctx.fillRect(x - 2, y - 50, 4, 9); }
    }
  },
  // защёлка кабинки: «ЗАНЯТО» → «СВОБОДНО», «ЩЁЛК!»
  unlock(ctx, T) {
    ctx.fillStyle = 'rgba(169,134,90,0.6)'; ctx.fillRect(-100, -100, 200, 200);
    ctx.strokeStyle = 'rgba(58,26,16,0.16)'; ctx.lineWidth = 2; for (let y = -96; y < 100; y += 14) { ctx.beginPath(); ctx.moveTo(-100, y + Math.sin(y) * 2); ctx.bezierCurveTo(-30, y + 4, 30, y - 4, 100, y); ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(-80, -44, 160, 88, 10); shape(ctx, P.sh, 4);
    for (const [x, y] of [[-70, -34], [70, -34], [-70, 34], [70, 34]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); shape(ctx, P.ink, 0); }
    const turn = EASE.inOutCubic(clamp((T - 0.45) / 0.3, 0, 1)), free = turn >= 0.5;
    ctx.beginPath(); ctx.roundRect(-66, -24, 98, 48, 6); shape(ctx, P.ink, 0);
    ctx.save(); ctx.translate(-17, 0); ctx.scale(1, Math.max(0.05, Math.abs(Math.cos(turn * Math.PI))));
    ctx.beginPath(); ctx.roundRect(-45, -19, 90, 38, 4); shape(ctx, free ? P.hi : P.red, 0);
    text(ctx, free ? 'СВОБОДНО' : 'ЗАНЯТО', 0, 1, { size: 13, color: free ? P.ink : P.hi, outline: false }); ctx.restore();
    ctx.save(); ctx.translate(52, 0); ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); shape(ctx, P.gold, 4); ctx.rotate(turn * Math.PI / 2); ctx.beginPath(); ctx.roundRect(-5, -16, 10, 32, 4); shape(ctx, P.ink, 0); ctx.restore();
    if (turn >= 1) {
      const k = clamp((T - 0.75) / 0.25, 0, 1);
      for (const [x, y, r] of [[-84, -62, 10], [76, -66, 13], [86, 58, 9], [-78, 64, 11]]) drawSparkle(ctx, x, y, r * EASE.outBack(k) * (0.8 + 0.2 * Math.sin(T * 8 + x)));
      sfxWord(ctx, 'ЩЁЛК!', 0, -72, 24 * EASE.outBack(k), T, -0.08);
    }
  },
  // песочные часы: «два часа»
  hourglass(ctx, T) {
    const k = clamp(T / 2.4, 0, 1);
    ctx.save(); ctx.translate(0, -6); ctx.rotate(Math.sin(T * 2) * 0.03);
    const glass = () => { ctx.beginPath(); ctx.moveTo(-34, -70); ctx.lineTo(34, -70); ctx.bezierCurveTo(36, -38, 8, -20, 5, -6); ctx.bezierCurveTo(8, 8, 36, 26, 34, 58); ctx.lineTo(-34, 58); ctx.bezierCurveTo(-36, 26, -8, 8, -5, -6); ctx.bezierCurveTo(-8, -20, -36, -38, -34, -70); ctx.closePath(); };
    glass(); shape(ctx, 'rgba(255,250,235,0.75)', 0);
    ctx.save(); glass(); ctx.clip();
    ctx.fillStyle = P.gold; ctx.fillRect(-40, lerp(-50, -8, k), 80, 60);
    ctx.fillStyle = P.hi; ctx.fillRect(-40, -6, 80, 6);
    const top = lerp(56, 14, k); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.moveTo(-40, 60); ctx.quadraticCurveTo(0, top - 18, 40, 60); ctx.closePath(); ctx.fill();
    if (k < 1) { ctx.strokeStyle = P.gold; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -T * 60; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 58); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    glass(); shape(ctx, null, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-20, -48, 4, 12, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-46, -74); ctx.lineTo(-46, 62); ctx.moveTo(46, -74); ctx.lineTo(46, 62); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-58, -86, 116, 14, 5); shape(ctx, P.sepia, 4);
    ctx.beginPath(); ctx.roundRect(-58, 58, 116, 14, 5); shape(ctx, P.sepia, 4);
    ctx.restore();
    text(ctx, 'ДВА ЧАСА', 0, 86, { size: 16, color: P.ink, outline: false });
  },
  // грелка и шоколадка — оружие мира
  hotwater(ctx, T) {
    ctx.strokeStyle = 'rgba(58,26,16,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let n = 0; n < 3; n++) { const x = -40 + n * 14, ph = (T * 0.8 + n * 0.33) % 1; ctx.globalAlpha = CA * Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(x, -66 - ph * 20); ctx.bezierCurveTo(x - 8, -76 - ph * 20, x + 8, -84 - ph * 20, x, -94 - ph * 20); ctx.stroke(); }
    ctx.globalAlpha = CA;
    ctx.save(); ctx.translate(-26, 8); ctx.rotate(-0.12 + Math.sin(T * 2.5) * 0.03);
    ctx.beginPath(); ctx.roundRect(-15, -66, 30, 28, 6); shape(ctx, P.redDk, 4);
    ctx.beginPath(); ctx.roundRect(-20, -78, 40, 16, 5); shape(ctx, P.gold, 4);
    ctx.beginPath(); ctx.roundRect(-52, -44, 104, 118, 30); shape(ctx, P.red, 5);
    ctx.strokeStyle = 'rgba(58,26,16,0.35)'; ctx.lineWidth = 3; for (let y = 40; y < 68; y += 9) { ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(40, y); ctx.stroke(); }
    const s = 1 + Math.max(0, Math.sin(T * 5)) ** 6 * 0.15; heartPath(ctx, 0, 6, 18 * s); shape(ctx, P.pink, 3);
    ctx.fillStyle = 'rgba(255,246,226,0.6)'; ctx.beginPath(); ctx.ellipse(-34, -18, 6, 16, 0.2, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(56, 34); ctx.rotate(0.32);
    ctx.beginPath(); ctx.roundRect(-26, -50, 52, 96, 4); shape(ctx, P.choc, 4);
    ctx.strokeStyle = '#8f5634'; ctx.lineWidth = 2; for (let y = -38; y < -4; y += 14) { ctx.beginPath(); ctx.moveTo(-22, y); ctx.lineTo(22, y); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -2); for (let n = 0; n <= 8; n++) ctx.lineTo(-28 + n * 7, -2 + (n % 2 ? -5 : 0)); ctx.lineTo(28, 48); ctx.lineTo(-28, 48); ctx.closePath(); shape(ctx, P.hi, 4);
    ctx.fillStyle = P.red; ctx.fillRect(-26, 14, 52, 16); text(ctx, 'ШОКО', 0, 23, { size: 12, color: P.hi, outline: false });
    ctx.restore();
  },
  // корона Королевы ПМС падает, трескается и подпрыгивает
  crown(ctx, T) {
    let y = 30, rot = -0.22;
    if (T < 0.4) { const e = EASE.inQuad(T / 0.4); y = -150 + 180 * e; rot = 0.6 - 0.82 * e; }
    else if (T < 0.75) y = 30 - Math.sin((T - 0.4) / 0.35 * Math.PI) * 26;
    ctx.fillStyle = 'rgba(58,26,16,0.25)'; ctx.beginPath(); ctx.ellipse(0, 72, 66 * clamp(0.5 + (y + 150) / 360, 0.4, 1), 9, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-56, 30); ctx.lineTo(-60, -28); ctx.lineTo(-30, 0); ctx.lineTo(0, -40); ctx.lineTo(30, 0); ctx.lineTo(60, -28); ctx.lineTo(56, 30); ctx.closePath(); shape(ctx, P.gold, 4);
    ctx.beginPath(); ctx.rect(-58, 18, 116, 20); shape(ctx, P.gold, 4);
    for (const [x, yy] of [[-60, -30], [0, -44], [60, -30]]) { ctx.beginPath(); ctx.arc(x, yy, 7, 0, TAU); shape(ctx, P.gold, 3); }
    for (const x of [-38, 38]) { ctx.beginPath(); ctx.arc(x, 28, 6, 0, TAU); shape(ctx, P.red, 2.5); }
    text(ctx, 'ПМС', 0, 29, { size: 12, color: P.ink, outline: false });
    ctx.fillStyle = 'rgba(255,248,230,0.7)'; ctx.beginPath(); ctx.ellipse(-36, -2, 4, 12, 0.5, 0, TAU); ctx.fill();
    if (T > 0.4) { ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(4, -18); ctx.lineTo(-4, -4); ctx.lineTo(8, 12); ctx.lineTo(0, 36); ctx.stroke(); }
    ctx.restore();
    if (T > 0.4) {
      const k = clamp((T - 0.4) / 0.3, 0, 1);
      for (const [x, yy, r] of [[-78, 50, 11], [80, 40, 13], [-60, -40, 8], [70, -52, 9]]) drawSparkle(ctx, x * (0.7 + 0.3 * k), yy, r * EASE.outBack(k));
      sfxWord(ctx, 'ДЗЫНЬ!', 0, -78, 22 * EASE.outBack(k), T, -0.1);
    }
  },
};
export const INSERT_KEYS = Object.keys(INSERTS);
// для проверок и галереи: нарисовать вставку k в момент T (по центру x, y)
export function drawInsertPreview(ctx, k, x, y, T, dur = 99) { drawFilmCard(ctx, { x, y, rot: 0.04, t: T, dur }, CARD.w, CARD.h, INSERTS[k] || (() => {})); }
export function drawStampPreview(ctx, k, x, y, u = 2) { if (k === 'sweat') drawSweat(ctx, x, y, 11 * u); else drawVein(ctx, x, y, 10 * u); }

// ---------- плашка диалога и портреты ----------
let currentOutfit = 'lara', currentHero = 'new';
function drawDialog(ctx, who, _s, D) {
  const { R, st, t } = D, a = D.k, sp = SPEAKERS[who] || SPEAKERS['Поппи'], th = R.think;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 18);
  // портреты: Поппи слева, собеседник справа; неговорящий — темнее (60 %) и чуть меньше
  const other = st.ruda || who === 'Руда' ? 'Руда' : 'Краш';
  if (st.poppy || who === 'Поппи') drawSlot(ctx, 'Поппи', SLOT.left, who === 'Поппи', D);
  if ((other === 'Краш' && st.crush) || (other === 'Руда' && st.ruda) || who === other) drawSlot(ctx, other, SLOT.right, who === other, D);
  if (th) {   // мысли: облачный верх и пузырьки от портрета
    ctx.fillStyle = THINK;
    for (let x = PX + 18; x < PX + PW - 10; x += 26) { ctx.beginPath(); ctx.arc(x, PY + 3, 12, 0, TAU); ctx.fill(); }
    for (const [x, y, r] of [[140, 372, 4], [152, 361, 6], [168, 350, 8]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  }
  ctx.fillStyle = th ? THINK : 'rgba(18,10,16,0.97)'; ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 16); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = th ? '#9d86da' : sp.color; ctx.stroke();
  const name = th ? who + ' · думает' : who;
  ctx.font = `900 16px ${FONT}`; const nw = ctx.measureText(name).width + 28;
  ctx.fillStyle = th ? '#9d86da' : sp.color; ctx.beginPath(); ctx.roundRect(PX + 22, PY - 14, nw, 28, 14); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#1a0a14'; ctx.stroke();
  text(ctx, name, PX + 22 + nw / 2, PY + 1, { size: 16, color: '#1c0c16', outline: false });
  // текст с эффектами: *тряска*, ~волна~, мягкое появление букв
  ctx.font = `${th ? 'italic ' : ''}700 21px ${FONT}`;
  const fk = (document.fonts ? document.fonts.status : '') + ctx.font;   // веб-шрифт мог догрузиться — пересчитать раскладку
  if (!R.L.laid || R.L.fk !== fk) { layoutLine(ctx, R.L, PW - 56); R.L.fk = fk; }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const ch = R.L.chars, fr = Math.floor(t * 30), base = th ? '#3b2766' : '#fff6fa', lines = R.L.lines || 1;
  const y0 = PY + PH / 2 + 5 - (lines - 1) * 14;
  for (let k = 0; k < R.shown && k < ch.length; k++) {
    const c = ch[k]; if (c.c === ' ') continue;
    let x = PX + 28 + c.x, y = y0 + c.line * 28;
    if (c.shake || R.s.shakeText) { const m = c.shake ? 3 : 1.6; x += (hash(k * 13 + fr) - 0.5) * m; y += (hash(k * 7 + fr * 3) - 0.5) * m; }   // *слово* ±1,5 px, вся строка — мельче
    if (c.wave) y += Math.sin(t * 7 + k * 0.55) * 2;
    const age = R.typeT - c.t;
    if (age < 0.08) { ctx.globalAlpha = a * clamp(age / 0.08, 0.25, 1); y += (1 - clamp(age / 0.08, 0, 1)) * 3; } else ctx.globalAlpha = a;
    ctx.fillStyle = c.shake ? (th ? '#a0204a' : '#ff8fa3') : c.wave ? (th ? '#6a3cc0' : '#ffe08a') : base;
    ctx.fillText(c.c, x, y);
  }
  ctx.globalAlpha = a;
  if (R.typed && ch.length && R.doneT >= (R.s.hold ?? 0.12)) {   // «готово» — мигающий треугольник
    const x = PX + PW - 26, y = PY + PH - 20 + Math.sin(t * 6) * 3;
    ctx.fillStyle = th ? '#7a62c0' : sp.color; ctx.beginPath(); ctx.moveTo(x - 7, y - 5); ctx.lineTo(x + 7, y - 5); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// Плашка диалога в портрете (L = portLay()): портреты по краям верхнего ряда (Поппи слева, собеседник справа), имя рядом с говорящим, текст ниже — крупно, сверху вниз
function drawDialogP(ctx, who, D, L) {
  const { R, st, t } = D, a = D.k, sp = SPEAKERS[who] || SPEAKERS['Поппи'], th = R.think, { px: x, py: y, pw: w, ph: h, ps } = L;
  const other = st.ruda || who === 'Руда' ? 'Руда' : 'Краш', hasL = !!st.poppy || who === 'Поппи', hasR = (other === 'Краш' && !!st.crush) || (other === 'Руда' && !!st.ruda) || who === other;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 22);
  if (th) { ctx.fillStyle = THINK; for (let xx = x + 18; xx < x + w - 10; xx += 26) { ctx.beginPath(); ctx.arc(xx, y + 3, 12, 0, TAU); ctx.fill(); } }   // мысли: облачный верх плашки
  ctx.fillStyle = th ? THINK : 'rgba(18,10,16,0.97)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = th ? '#9d86da' : sp.color; ctx.stroke();
  const ry = y + 14, lx = x + 16, rx = x + w - 16 - ps;
  if (hasL) drawSlot(ctx, 'Поппи', lx, who === 'Поппи', D, ps, ry);
  if (hasR) drawSlot(ctx, other, rx, who === other, D, ps, ry);
  // имя — плашкой рядом с портретом говорящего (на внутренней стороне)
  const name = th ? who + ' · думает' : who, fs = 19;
  ctx.font = `900 ${fs}px ${FONT}`; const nw = ctx.measureText(name).width + 30, left = who === 'Поппи' || !hasR;
  const nx = left ? lx + ps + 14 : rx - 14 - nw, ny = ry + ps / 2 - 16;
  ctx.fillStyle = th ? '#9d86da' : sp.color; ctx.beginPath(); ctx.roundRect(nx, ny, nw, 32, 16); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#1a0a14'; ctx.stroke();
  text(ctx, name, nx + nw / 2, ny + 17, { size: fs, color: '#1c0c16', outline: false });
  // текст с теми же эффектами, что в ландшафте: *тряска*, ~волна~, мягкое появление букв
  const maxW = w - 44;
  ctx.font = `${th ? 'italic ' : ''}700 ${L.font}px ${FONT}`;
  const fk = (document.fonts ? document.fonts.status : '') + ctx.font + '|' + maxW;   // шрифт догрузился или сменилась ширина — пересчитать раскладку
  if (!R.L.laid || R.L.fk !== fk) { layoutLine(ctx, R.L, maxW); R.L.fk = fk; }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const ch = R.L.chars, fr = Math.floor(t * 30), base = th ? '#3b2766' : '#fff6fa';
  for (let k = 0; k < R.shown && k < ch.length; k++) {
    const c = ch[k]; if (c.c === ' ') continue;
    let xx = x + 22 + c.x, yy = L.textTop + L.lh / 2 + c.line * L.lh;
    if (c.shake || R.s.shakeText) { const m = c.shake ? 3 : 1.6; xx += (hash(k * 13 + fr) - 0.5) * m; yy += (hash(k * 7 + fr * 3) - 0.5) * m; }
    if (c.wave) yy += Math.sin(t * 7 + k * 0.55) * 2;
    const age = R.typeT - c.t;
    if (age < 0.08) { ctx.globalAlpha = a * clamp(age / 0.08, 0.25, 1); yy += (1 - clamp(age / 0.08, 0, 1)) * 3; } else ctx.globalAlpha = a;
    ctx.fillStyle = c.shake ? (th ? '#a0204a' : '#ff8fa3') : c.wave ? (th ? '#6a3cc0' : '#ffe08a') : base;
    ctx.font = `${th ? 'italic ' : ''}700 ${L.font}px ${FONT}`; ctx.fillText(c.c, xx, yy);
  }
  ctx.globalAlpha = a;
  if (R.typed && ch.length && R.doneT >= (R.s.hold ?? 0.12)) {   // «готово»: «Дальше ▸» — подсказка (листает тап по любому месту экрана)
    const bx = x + w - 22, by = y + h - 20 + Math.sin(t * 6) * 2;
    text(ctx, 'Дальше', bx - 26, by, { size: 17, align: 'right', color: th ? '#7a62c0' : sp.color, outline: false, weight: 900 });
    ctx.fillStyle = th ? '#7a62c0' : sp.color; ctx.beginPath(); ctx.moveTo(bx - 14, by - 7); ctx.lineTo(bx, by); ctx.lineTo(bx - 14, by + 7); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawVignetteBox(ctx) {   // виньетка окна (в ландшафте — drawVignette из backgrounds.js на всю рамку)
  const g = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.36, SW / 2, SH / 2, SH * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
}
function drawSlot(ctx, who, x, active, D, ps = SLOT.size, y0 = SLOT.y) {
  const sp = SPEAKERS[who]; let y = y0;
  if (active && D.whoT < 0.2) y -= Math.sin(D.whoT / 0.2 * Math.PI) * 6;          // прыжок при смене говорящего
  if (who === 'Поппи' && D.faceT < 0.2) y -= Math.sin(D.faceT / 0.2 * Math.PI) * 6; // и при смене эмоции
  const sc = active ? 1 : 0.9;
  ctx.save(); ctx.translate(x + ps / 2, y + ps); ctx.scale(sc, sc); ctx.translate(-ps / 2, -ps);
  if (who === 'Поппи' && D.face === 'panic') ctx.translate(Math.sin(D.t * 40) * 1.2, 0);
  ctx.fillStyle = '#2a1820'; ctx.beginPath(); ctx.roundRect(0, 0, ps, ps, 12); ctx.fill();
  if (sp.portrait === 'poppy' && currentHero === 'classic') { const im = img('stand'); if (im.complete && im.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, ps, ps, 12); ctx.clip(); const k = ps / 100; ctx.drawImage(im, -32 * k, -4 * k, im.width * k, im.height * k); ctx.restore(); } }
  else if (sp.portrait === 'poppy') {   // крупный план с листа персонажа (запасной — кукла)
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, ps, ps, 12); ctx.clip();
    if (!drawHeroinePortrait(ctx, ps * 0.1, ps * 0.07, ps * 0.8, currentOutfit)) { const Hh = 430, k = Hh / 300; drawHeroine(ctx, ps / 2 - 10 * k, ps / 2 + 8 + 280 * k, Hh, { kind: 'talk', t: D.t, mouth: 0 }, currentOutfit); }
    ctx.restore();
  }
  else if (sp.portrait === 'crush') drawPortrait(ctx, 'crush', 0, 0, ps, [52, 48, 120]);
  else if (sp.portrait === 'ruda') drawPortrait(ctx, 'ruda', 0, 0, ps, [100, 20, 150]);
  if (who === 'Поппи' && D.face) drawFace(ctx, D.face, ps, D.t);
  if (!active) { ctx.fillStyle = 'rgba(14,6,18,0.4)'; ctx.beginPath(); ctx.roundRect(0, 0, ps, ps, 12); ctx.fill(); }
  ctx.lineWidth = active ? 3 : 2; ctx.strokeStyle = active ? sp.color : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.roundRect(0, 0, ps, ps, 12); ctx.stroke();
  ctx.restore();
}
// Эмоции поверх портрета — те же штампы, что и в кадре: румянец-штрихи, капля пота, искорка, «венка»
function drawFace(ctx, f, ps, t) {
  ctx.save();
  if (f === 'blush') {
    for (const cx of [0.3, 0.66]) {
      ctx.fillStyle = 'rgba(240,110,140,0.4)'; ctx.beginPath(); ctx.ellipse(ps * cx, ps * 0.7, ps * 0.09, ps * 0.045, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,36,58,0.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let n = -1; n <= 1; n++) { ctx.beginPath(); ctx.moveTo(ps * cx + n * 6 - 2, ps * 0.7 + 4); ctx.lineTo(ps * cx + n * 6 + 3, ps * 0.7 - 4); ctx.stroke(); }
    }
  }
  if (f === 'panic') drawSweat(ctx, ps * 0.84, ps * 0.3 + (t * 14 % 8), 9);
  if (f === 'smug' || f === 'wink') drawSparkle(ctx, ps * 0.86, ps * 0.2, 10 * (1 + Math.sin(t * 8) * 0.25));
  if (f === 'angry') { ctx.fillStyle = 'rgba(255,40,30,0.13)'; ctx.fillRect(0, 0, ps, ps); drawVein(ctx, ps * 0.8, ps * 0.22, 9 * (1 + Math.sin(t * 12) * 0.1)); }
  ctx.restore();
}

// Титульник (cut 4.1): буквы были запечены в картинку — затёрты при векторизации и нарисованы шрифтом.
// Рисуется в координатах сцены, чтобы двигаться вместе с фоном под камерой.
function drawTitleCardP(ctx, t) {   // титульник в портрете: три строки по центру окна (в ландшафте надписи лежат на картинке в мире)
  const a = Math.min(1, t * 1.5);
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'Поппи:', SW / 2, SH * 0.36, { size: 92, color: '#5a0a12', lw: 10, outline: '#0e0204' });
  text(ctx, 'Хэллоуинский', SW / 2, SH * 0.36 + 82, { size: 52, color: '#5a0a12', lw: 8, outline: '#0e0204' });
  text(ctx, 'кошмар', SW / 2, SH * 0.36 + 138, { size: 52, color: '#5a0a12', lw: 8, outline: '#0e0204' });
  ctx.restore();
}
function drawTitleCard(ctx, t) {
  const a = Math.min(1, t * 1.5);
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'Поппи:', 200, 302, { size: 96, color: '#5a0a12', lw: 10, outline: '#0e0204' });
  text(ctx, 'Хэллоуинский', 936, 92, { size: 44, align: 'right', color: '#5a0a12', lw: 8, outline: '#0e0204' });
  text(ctx, 'кошмар', 936, 140, { size: 44, align: 'right', color: '#5a0a12', lw: 8, outline: '#0e0204' });
  ctx.restore();
}

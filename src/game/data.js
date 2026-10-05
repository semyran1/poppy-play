// Все игровые числа в одном месте. Логика их только читает (правило: данные отдельно от кода).

// ---------- Базовые характеристики Поппи (множители 1 = база) ----------
export const BASE_STATS = {
  maxHp: 5, moveSpeed: 1, jump: 1, extraJumps: 0,
  might: 1,        // урон
  haste: 1,        // скорострельность (делит перезарядку)
  area: 1, speed: 1, duration: 1, amount: 0,   // площадь, скорость снарядов, длительность, +снаряды
  crit: 0.03, critMul: 2,
  magnet: 90, growth: 1, greed: 1, luck: 1,
  armor: 0,        // шанс не потерять сердце (0..0.5)
  regen: 0,        // сердце раз в N сек (0 = нет)
  revives: 0, rerolls: 1,
};

// ---------- Оружие: уровни как приращения ----------
// cd — перезарядка (с), dmg — урон, n — снарядов, pierce — сколько врагов пробивает, area — размер
export const WEAPONS = {
  tampon: {
    name: 'Тампон-бластер', icon: 'tampon', pair: 'cotton', evo: 'gatling', start: true,
    desc: 'Стреляет вверх. Надёжно, как мама.',
    lv: [
      { cd: 0.25, dmg: 10, n: 1, pierce: 0 },
      { n: 2, text: '+1 тампон' },
      { dmg: 14, text: 'урон +40%' },
      { cd: 0.2, text: 'скорострельность +25%' },
      { n: 3, pierce: 1, text: '+1 тампон, пробивает' },
    ],
  },
  gatling: {
    name: 'Тампонада-Гатлинг', icon: 'tampon', evolved: true,
    desc: 'Эволюция: ливень тампонов, пробивает двоих.',
    lv: [{ cd: 0.09, dmg: 14, n: 3, pierce: 2 }],
  },
  pad: {
    name: 'Прокладка-бумеранг', icon: 'pad', pair: 'wings', evo: 'angel',
    desc: 'Улетает вверх и возвращается. Пробивает всех.',
    lv: [
      { cd: 1.3, dmg: 15, n: 1, area: 1 },
      { dmg: 20, text: 'урон +33%' },
      { n: 2, text: '+1 прокладка' },
      { area: 1.3, cd: 1.1, text: 'больше и чаще' },
      { n: 3, dmg: 26, text: '+1 прокладка, урон' },
    ],
  },
  angel: {
    name: 'Ангел-хранитель', icon: 'pad', evolved: true,
    desc: 'Эволюция: 4 прокладки кружат и бьют всё вокруг.',
    lv: [{ cd: 0, dmg: 22, n: 4, area: 1.5 }],
  },
  pills: {
    name: 'Ибупрофенчик', icon: 'pill', pair: 'water', evo: 'fizz', rare: true,
    desc: 'Самонаводящиеся таблетки. Найдут боль сами.',
    lv: [
      { cd: 0.85, dmg: 12, n: 2 },
      { n: 3, text: '+1 таблетка' },
      { dmg: 16, text: 'урон +33%' },
      { n: 4, cd: 0.75, text: '+1 таблетка, чаще' },
      { n: 5, dmg: 20, text: '+1 таблетка, урон' },
    ],
  },
  fizz: {
    name: 'Шипучка', icon: 'pill', evolved: true,
    desc: 'Эволюция: таблетки взрываются шипящим облачком.',
    lv: [{ cd: 0.6, dmg: 22, n: 5, area: 1 }],
  },
  bottle: {
    name: 'Грелка', icon: 'bottle', pair: 'blanket', evo: 'geyser', rare: true,
    desc: 'Бросок в самую толпу и облако горячего пара.',
    lv: [
      { cd: 1.8, dmg: 22, n: 1, area: 1, dot: 7, dotDur: 2 },
      { dot: 11, text: 'пар горячее' },
      { area: 1.35, text: 'облако больше' },
      { n: 2, text: '+1 грелка' },
      { dmg: 32, dot: 17, cd: 1.5, text: 'урон и пар' },
    ],
  },
  geyser: {
    name: 'Гейзер', icon: 'bottle', evolved: true,
    desc: 'Эволюция: столб пара на всю высоту экрана.',
    lv: [{ cd: 1.5, dmg: 36, n: 2, area: 1.4, dot: 42, dotDur: 1.6 }],
  },
  broom: {
    name: 'Ведьмина метла', icon: 'broom', pair: 'sneakers', evo: 'vortex',
    desc: 'Взмах над головой. Сметает всё, что близко.',
    lv: [
      { cd: 1.2, dmg: 30, area: 1 },
      { area: 1.2, text: 'шире взмах' },
      { dmg: 42, text: 'урон +40%' },
      { cd: 0.9, text: 'чаще' },
      { area: 1.45, dmg: 55, text: 'шире и сильнее' },
    ],
  },
  vortex: {
    name: 'Ведьмин вихрь', icon: 'broom', evolved: true,
    desc: 'Эволюция: вихрь всё время крутится над Поппи.',
    lv: [{ cd: 0, dmg: 70, area: 1.6 }],
  },
  choco: {
    name: 'Шоколадка', icon: 'choco', pair: 'sweet', evo: 'fountain', rare: true,
    desc: 'Веер долек вблизи. Сладкая месть.',
    lv: [
      { cd: 0.8, dmg: 5, n: 4, spread: 0.36 },
      { n: 5, text: '+1 долька' },
      { dmg: 7, text: 'урон +40%' },
      { n: 6, cd: 0.7, text: '+1 долька, чаще' },
      { n: 7, dmg: 8, spread: 0.5, text: 'шире и сильнее' },
    ],
  },
  fountain: {
    name: 'Шоко-фонтан', icon: 'choco', evolved: true,
    desc: 'Эволюция: непрерывный шоколадный фонтан.',
    lv: [{ cd: 0.18, dmg: 10, n: 5, spread: 0.55 }],
  },
  tea: {
    name: 'Ромашковый чай', icon: 'tea', pair: 'headphones', evo: 'ceremony',
    desc: 'Луч успокоения вверх. Прожигает весь столбец.',
    lv: [
      { cd: 2.4, on: 0.8, dps: 60, width: 22 },
      { on: 1.0, text: 'горит дольше' },
      { dps: 85, text: 'урон +40%' },
      { width: 32, text: 'шире' },
      { cd: 1.8, dps: 110, text: 'чаще и сильнее' },
    ],
  },
  ceremony: {
    name: 'Чайная церемония', icon: 'tea', evolved: true,
    desc: 'Эволюция: луч горит всегда.',
    lv: [{ cd: 0, on: 99, dps: 150, width: 46 }],
  },
  ice: {
    name: 'Пломбир', icon: 'ice', pair: 'mirror', evo: 'permafrost',
    desc: 'Ледяные шарики замедляют на 40%.',
    lv: [
      { cd: 0.5, dmg: 8, n: 1, slow: 0.4 },
      { n: 2, text: '+1 шарик' },
      { dmg: 12, text: 'урон +50%' },
      { slow: 0.55, cd: 0.42, text: 'сильнее замедляет' },
      { n: 3, dmg: 15, text: '+1 шарик, урон' },
    ],
  },
  permafrost: {
    name: 'Вечная мерзлота', icon: 'ice', evolved: true,
    desc: 'Эволюция: замёрзшие раскалываются с тройным уроном.',
    lv: [{ cd: 0.32, dmg: 16, n: 3, slow: 0.7 }],
  },
  cup: {
    name: 'Лунная чаша', icon: 'cup', pair: 'thermos', evo: 'grail', locked: true,
    desc: 'Серебряная чаша на полу ловит капли — и ковёр остаётся чистым.',
    lv: [
      { cd: 9, dur: 6, width: 60 },
      { width: 80, text: 'шире' },
      { dur: 8, text: 'дольше' },
      { width: 110, cd: 8, text: 'шире и чаще' },
      { width: 140, dur: 9, text: 'огромная' },
    ],
  },
  grail: {
    name: 'Святой Грааль', icon: 'cup', evolved: true,
    desc: 'Эволюция: пойманные капли вылетают обратно снарядами.',
    lv: [{ cd: 7, dur: 9, width: 150, shots: 30 }],
  },
};

// ---------- Пассивки ----------
export const PASSIVES = {
  cotton:     { name: 'Ватный запас', icon: 'cotton', max: 5, rare: true, desc: '+5% урона; +1 снаряд на ур. 2 и 4', apply: (s, lv) => { s.might += 0.05; if (lv === 2 || lv === 4) s.amount += 1; } },
  wings:      { name: 'Крылышки', icon: 'wings', max: 5, desc: '+10% скорость снарядов', apply: s => { s.speed += 0.1; } },
  water:      { name: 'Стакан воды', icon: 'water', max: 5, desc: '−7% перезарядка', apply: s => { s.haste *= 1.075; } },
  blanket:    { name: 'Плед', icon: 'blanket', max: 5, desc: '+6% шанс не потерять сердце (до 30%)', apply: s => { s.armor = Math.min(0.3, s.armor + 0.06); } },
  sneakers:   { name: 'Удобные кеды', icon: 'sneakers', max: 5, desc: '+8% скорость бега', apply: s => { s.moveSpeed += 0.08; } },
  sweet:      { name: 'Сладкоежка', icon: 'sweet', max: 5, desc: '+25% радиус подбора', apply: s => { s.magnet *= 1.25; } },
  headphones: { name: 'Наушники', icon: 'headphones', max: 5, desc: '+12% площадь', apply: s => { s.area += 0.12; } },
  mirror:     { name: 'Зеркальце', icon: 'mirror', max: 5, desc: '+5% шанс крита', apply: s => { s.crit += 0.05; } },
  glitter:    { name: 'Блёстки', icon: 'glitter', max: 5, desc: '+10% урона', apply: s => { s.might += 0.1; } },
  calendar:   { name: 'Календарик', icon: 'calendar', max: 5, desc: '+10% опыта', apply: s => { s.growth += 0.1; } },
  cloak:      { name: 'Плащ Лары', icon: 'cloak', max: 3, desc: 'Ур.1: двойной прыжок; далее прыжок выше', apply: (s, lv) => { if (lv === 1) s.extraJumps += 1; else s.jump += 0.08; } },
  umbrellaP:  { name: 'Складной зонтик', icon: 'umbrellaP', max: 3, desc: 'Щит от одного удара; восстанавливается раз в 24 / 18 / 12 с', apply: (s, lv) => { s.umbCd = [0, 24, 18, 12][lv]; } },
  boots:      { name: 'Резиновые сапоги', icon: 'boots', max: 2, desc: 'Спазмики и огонь по полу не ранят; прыжок на Спазмика давит его. Ур.2: давка лопает капли рядом', apply: (s, lv) => { s.boots = lv; } },
  mint:       { name: 'Мятная жвачка', icon: 'mint', max: 3, desc: 'Когда тебя ранят, холодная волна лопает капли рядом (радиус 110 / 150 / 190)', apply: (s, lv) => { s.mint = [0, 110, 150, 190][lv]; } },
  socks:      { name: 'Тёплые носочки', icon: 'socks', max: 3, desc: 'Сердце восстанавливается само (раз в 90 / 70 / 55 с)', apply: (s, lv) => { s.regen = [0, 90, 70, 55][lv]; } },
  thermos:    { name: 'Термос', icon: 'thermos', max: 5, desc: '+12% длительность эффектов', apply: s => { s.duration += 0.12; }, locked: true },
  luckycat:   { name: 'Кошка-талисман', icon: 'luckycat', max: 5, desc: '+10% удача (4-я карта, сундуки)', apply: s => { s.luck += 0.1; }, locked: true },
};

// ---------- Враги ----------
// r — радиус, hp, spd — px/с, count — сколько снимает со счётчика при убийстве, floor — сколько добавляет на полу
export const ENEMIES = {
  droplet: { r: 13, hp: 8, spd: 125, count: 1, floor: 2, xp: 1, cost: 1, dmg: 1 },
  drop:    { r: 19, hp: 26, spd: 95, count: 1, floor: 2, xp: 2, cost: 3, dmg: 1, split: 2 },
  diver:   { r: 14, hp: 16, spd: 290, count: 1, floor: 0, xp: 3, cost: 2, dmg: 1 },
  jelly:   { r: 40, hp: 40, spd: 75, count: 1, floor: 0, xp: 1, cost: 10, dmg: 1, sizes: [40, 30, 21, 13], bounce: [330, 270, 210, 160] },
  fart:    { r: 30, hp: 160, spd: 30, count: 3, floor: 10, xp: 6, cost: 6, dmg: 1 },
  popcorn: { r: 9, hp: 6, spd: 150, count: 0, floor: 0, xp: 0, cost: 0, dmg: 1 },
  // глава 2 «Улица»
  crier:   { r: 18, hp: 34, spd: 0, count: 1, floor: 2, xp: 4, cost: 4, dmg: 1 },   // Капля-плакса: висит и роняет слёзы
  spazm:   { r: 15, hp: 40, spd: 0, count: 0, floor: 0, xp: 4, cost: 5, dmg: 1 },   // Спазмик: катится по полу (перепрыгивается). ТОЛЬКО со 2-й главы
  spazmj:  { base: 'spazm', hop: true, r: 15, hp: 40, spd: 0, count: 0, floor: 0, xp: 5, cost: 7, dmg: 1 },   // Спазмик-прыгун: катится и подскакивает; позже и реже (с волны 4 главы 2)
  bloat:   { r: 80, hp: 2600, spd: 0, count: 0, floor: 0, xp: 12, cost: 0, dmg: 1 }, // Великое Вздутие (босс-томат)
  // глава 3 «Готика» (src/game/chapter3.js)
  spout:   { r: 0, hp: 1, spd: 0, count: 0, floor: 0, xp: 0, cost: 3, dmg: 1 },     // Фонтанчик: пузырьки 1 с → струя из пола
  ghost:   { r: 22, hp: 55, spd: 26, count: 2, floor: 3, xp: 5, cost: 5, dmg: 1 },  // Призрак Перепадов: уязвим только розовым
  craving: { r: 21, hp: 46, spd: 0, count: 1, floor: 0, xp: 4, cost: 4, dmg: 1 },   // Тяга к сладкому: луч ворует конфеты
};

// ---------- Главы и волны ----------
// mix — веса типов, budget — бюджет угрозы в секунду (режиссёр), counter — стартовое значение счётчика
export const CHAPTERS = [
  {
    // Глава 1 «Кинотеатр»: ТОЛЬКО капли сверху (капля, капелька, пикирующая, облако) — ничего, что катится или прыгает по полу
    // (Спазмик и желе начинаются со 2-й главы). soft — «мягкий вход»: первые t секунд волны только медленные капли и меньше потока,
    // потом плавно (за 8 с) обычный режим. leak — во сколько раз счётчик должен вырасти, чтобы случилась «Протечка» (по умолчанию 1,5).
    id: 'cinema', name: 'Кинотеатр', bg: 'cinema', boss: 'spasm',
    waves: [
      { counter: 24, budget: 0.72, leak: 2.2, soft: { t: 30, mix: { droplet: 1 }, k: 0.55, spd: 0.76 }, mix: { droplet: 7, drop: 2 }, intro: 'droplet', hint: 'Сбивай капли, пока они не упали на пол!' },
      { counter: 38, budget: 1.0, leak: 1.8, soft: { t: 10, mix: { droplet: 5, drop: 1 }, k: 0.8, spd: 0.92 }, mix: { droplet: 5, drop: 3, diver: 1 }, intro: 'diver', hint: 'Эти пикируют! Отпрыгни вбок.' },
      { counter: 52, budget: 1.65, mix: { droplet: 4, drop: 3, diver: 3 }, intro: 'drop', hint: 'Капли покрупнее: расколешь — разлетятся на две!' },
      { counter: 62, budget: 1.65, mix: { droplet: 4, drop: 3, diver: 2, fart: 1 }, intro: 'fart', hint: 'Облако нельзя пускать к полу: +10!' },
    ],
  },
  {
    id: 'street', name: 'Улица', bg: 'street', boss: 'bloat',
    waves: [
      { counter: 44, budget: 1.45, mix: { droplet: 5, drop: 3, diver: 2, crier: 2 }, intro: 'crier', hint: 'Плаксы роняют слёзы — сбивай их на лету!' },
      { counter: 56, budget: 1.75, mix: { droplet: 4, drop: 3, diver: 2, crier: 2, spazm: 1 }, intro: 'spazm', hint: 'Это Спазмик: катится по полу и врезается. Перепрыгни!' },
      { counter: 68, budget: 2.1, mix: { droplet: 4, drop: 3, diver: 3, crier: 2, spazm: 1.5, jelly: 1 }, intro: 'jelly', hint: 'Большое желе! Дели его, пока не поздно.' },
      { counter: 80, budget: 2.45, mix: { droplet: 4, drop: 3, diver: 3, crier: 2, spazm: 1.5, spazmj: 0.7, jelly: 1, fart: 1 }, intro: 'spazmj', hint: 'Этот Спазмик ещё и подпрыгивает! Не лезь под него.' },
    ],
  },
  {
    id: 'gothic', name: 'Готика', bg: 'restroom', boss: 'queen',
    waves: [
      { counter: 54, budget: 1.85, mix: { droplet: 5, drop: 3, diver: 2, spout: 2 }, intro: 'spout', hint: 'Пузырьки на полу — сейчас ударит струя! Отойди.' },
      { counter: 66, budget: 2.2, mix: { droplet: 4, drop: 3, diver: 2, crier: 2, spout: 1, ghost: 2 }, intro: 'ghost', hint: 'Призрак уязвим, только когда розовый!' },
      { counter: 78, budget: 2.55, mix: { droplet: 4, drop: 3, diver: 2, crier: 1, ghost: 2, spout: 1, craving: 2 }, intro: 'craving', hint: 'Тяга к сладкому ворует конфеты лучом. Сбей её!' },
      { counter: 90, budget: 2.9, mix: { droplet: 4, drop: 3, diver: 3, crier: 2, ghost: 2, spout: 2, craving: 1, jelly: 1 }, intro: 'jelly', hint: 'Последняя волна перед Королевой!' },
    ],
  },
  {
    id: 'lair', name: 'Логово Руды', bg: 'lair', boss: 'ruda',
    waves: [
      { counter: 46, budget: 2.35, mix: { droplet: 4, drop: 3, diver: 2, crier: 2, ghost: 1, spout: 1 }, intro: 'drop', hint: 'Логово Руды. Ещё немного, Поппи!' },
      { counter: 60, budget: 3.0, mix: { droplet: 4, drop: 3, diver: 3, crier: 1, ghost: 2, spout: 1, craving: 1, jelly: 1 }, intro: 'ghost', hint: 'Она уже близко. Чувствуешь?' },
    ],
  },
];

// ---------- Сенсорная помощь (телефон) ----------
// Включается сама, когда играют пальцем (app.inp.isTouch): палец закрывает экран и точность ниже, чем у клавиатуры.
// Игроку не показывается («режима лёгкий» нет). Применяется в одном месте: play.js, G.A = assistFor(inp) в начале шага мира.
// enemyTime — «время врагов» (скорость падения/полёта врагов и их снарядов, и темп спавна волны), iframes — окно неуязвимости
// после удара (с), hit — множитель радиуса касания врага с Поппи (прощение), bossTempo — темп атак босса (медленнее = больше времени
// на реакцию; урон снаряда всё равно одно сердце).
export const TOUCH_ASSIST = { enemyTime: 0.9, iframes: 1.15, hit: 0.84, bossTempo: 0.92 };
export const NO_ASSIST = { enemyTime: 1, iframes: 0.8, hit: 1, bossTempo: 1 };
export const assistFor = (inp) => (inp && inp.isTouch ? TOUCH_ASSIST : NO_ASSIST);

// ---------- Опыт ----------
export function xpToNext(level) {
  if (level < 6) return 4 + 6 * (level - 1);          // 4 10 16 22 28 — быстрый старт
  if (level < 11) return 40 + 12 * (level - 6);        // 40 52 64 76 88
  if (level < 21) return 100 + 15 * (level - 11);      // 100 … 235
  return 250 + 20 * (level - 21);
}

// ---------- Косметичка (мета) ----------
// Косметичка 2.0 — см. meta.js (сила + разнообразие, витрина после забега)
export { META_POWER as META_SHOP } from './meta.js';
export function metaPrice(item, rank, totalBought) { return Math.round(item.base * (rank + 1) * (1 + 0.1 * totalBought)); }

// ---------- Гардероб: наряды открываются достижениями ----------
export const WARDROBE = [
  { id: 'lara', name: 'Лара Крофт', desc: 'Костюм для свидания в кино на Хэллоуин.', unlock: null },
  { id: 'pajama', name: 'Пижама с персиками', desc: 'Домашняя и уютная. Краш оценит смелость.', unlock: 'spasm', hint: 'Достижение «Снято!» — победи Мисс Спазм' },
];

// ---------- Профиль по умолчанию (сохранение) ----------
export const DEFAULT_SAVE = {
  candies: 0,               // конфеты: валюта забега, только для Косметички (meta.js)
  gems: 0,                  // стразы: вторая валюта, только для аксессуаров (gems.js); за достижения и за реальные деньги через площадку
  gemsInit: false,          // стразы за уже полученные достижения начислены (один раз для старых сейвов)
  gemTokens: [],            // последние purchaseToken зачисленных пакетов (защита от двойного зачисления)
  meta: {},                 // id -> ранг
  ach: {},                  // id -> true
  unlocked: {},             // id оружия/пассивки -> true
  stats: { kills: 0, runs: 0, farts: 0, pads: 0, candiesTotal: 0, bossKills: 0, evolutions: 0, wins: 0, deaths: 0 },
  best: { chapter: 0, combo: 0, level: 0 },
  settings: { sfx: 0.8, music: 0.45, shake: 0.8, numbers: true },
  seenIntro: false,
  firstDeathGift: false,    // «Утешительный приз» за первую смерть уже выдан (meta.js, consolation)
  outfit: 'lara',
  facing: 'front',       // поза в бою: 'front' — лицом (вполоборота), 'back' — спиной к нам, бластер вверх
  progress: 0,           // следующая доступная глава (контрольная точка)
  hero: 'new',          // 'new' — Поппи с референсов (кукла), 'classic' — Поппи оригинальной игры
};

// Аксессуары (docs/MEME_ACCESSORIES.md, docs/ACCESSORIES_MONETIZATION.md): каталог мемных предметов, сохранение,
// покупка, награды, находки. Только косметика: на силу не влияет. Рисование — src/art/accessories.js, питомцы — pets.js.
// Источники: 'shop' — стразы (price по редкости, GEM_PRICE; конфетами аксессуары больше не покупаются),
// 'ach' — достижение (ach), 'find' — редкая находка в бою. Платных рандомных коробок нет: за деньги — только
// стразы пакетами (src/platform), а предмет покупается напрямую за видимую цену.
import { GEM_PRICE, gemsOf, spendGems, gemWord } from './gems.js';

export const SLOTS = [
  { id: 'pet', name: 'Питомец' },
  { id: 'blaster', name: 'Бластер' },
  { id: 'head', name: 'Заколка' },
  { id: 'back', name: 'Брелок' },
  { id: 'trail', name: 'След' },
];

export const RARITY = {
  common: { name: 'обычный', color: '#d9cfe0' },
  rare: { name: 'редкий', color: '#6ec8ff' },
  epic: { name: 'эпический', color: '#c58cff' },
  legend: { name: 'легендарный', color: '#ffd166' },
};

// Мем живёт в названии и флейворе (их можно менять без перерисовки); форма — вечная
export const ACCESSORIES = [
  // питомцы: летают рядом с героиней (src/game/pets.js)
  { id: 'pet_okak', slot: 'pet', name: 'Кот в худи «Окак»', rarity: 'rare', src: 'shop',
    flavor: 'Капля упала на пол. Кот: «окак». Ты: тоже «окак».' },
  { id: 'pet_beaver', slot: 'pet', name: 'Бобракула', rarity: 'epic', src: 'shop',
    flavor: 'Клыки настоящие. Просто это резцы.' },
  { id: 'pet_guinea', slot: 'pet', name: 'Свинка-Плошка', rarity: 'common', src: 'ach', ach: 'die1',
    flavor: 'Я не плачу. Это блёстки.' },
  { id: 'pet_capy', slot: 'pet', name: 'Капибара «Чилл-тыква»', rarity: 'rare', src: 'ach', ach: 'tea',
    flavor: 'Тыква на голове не падает. И ты не падай.' },
  { id: 'pet_surfdog', slot: 'pet', name: 'Бульдожка «На волне»', rarity: 'rare', src: 'ach', ach: 'nohit',
    flavor: 'Вокруг капли, а он на волне. Будь как он.' },
  { id: 'pet_lionhare', slot: 'pet', name: 'Львозаяц «Тихо, не спеша»', rarity: 'epic', src: 'find',
    flavor: 'Раньше капли падали медленнее. И были крупнее.' },
  { id: 'pet_monkey', slot: 'pet', name: 'Макака-обнимака', rarity: 'legend', src: 'ach', ach: 'hug',
    flavor: 'Держится за плюш. Ты держишься за бластер. Вы справитесь.' },
  // скины бластера: новая форма в руках (рисунок вместо бластера), дуло и вспышка те же
  { id: 'blaster_squeak', slot: 'blaster', name: 'Резиновая курица «Пи-пиу»', rarity: 'common', src: 'shop',
    flavor: 'Пищит. Стреляет. Пугает. Именно в таком порядке.' },
  { id: 'blaster_log', slot: 'blaster', name: 'Бластер «Погрызено бобром»', rarity: 'epic', src: 'shop',
    flavor: 'Бобр погрыз. Бобр одобрил. Бобр претензий не имеет.' },
  { id: 'blaster_baguette', slot: 'blaster', name: 'Багет «С черемшой»', rarity: 'rare', src: 'ach', ach: 'gothicDry',
    flavor: 'Против вампиров — чеснок. Против капель — багет. Удобно.' },
  { id: 'blaster_boba', slot: 'blaster', name: 'Бабл-ти «Глазки»', rarity: 'epic', src: 'find',
    flavor: 'Взболтать, не смешивать. Глазки не жевать.' },
  { id: 'blaster_flip', slot: 'blaster', name: 'Раскладушка «Возьми трубку»', rarity: 'rare', src: 'shop',
    flavor: 'Капли звонили. Сбросила.' },
  { id: 'blaster_lightstick', slot: 'blaster', name: 'Лайтстик «Айдол»', rarity: 'epic', src: 'ach', ach: 'lvl20',
    flavor: 'Фанклуб капель распущен. Остался только твой.' },
  // заколки на пучок (Рожки, Палочка и Краб-клыки убраны по отзыву: не нравились; «Сухо и готично» теперь даёт Багет)
  { id: 'bow_cocktail', slot: 'head', name: 'Бант «Базовый минимум»', rarity: 'common', src: 'shop',
    flavor: 'Базовый минимум — бант. Роскошный максимум — бант побольше.' },
  { id: 'clip_maxbow', slot: 'head', name: 'Бант «Роскошный максимум»', rarity: 'epic', src: 'ach', ach: 'queen',
    flavor: 'Бархат цвета сливы, крылья летучей мыши и жемчужина-луна. Мечта в стиле coquette.' },
  { id: 'claw_clean', slot: 'head', name: 'Краб «Клин-гёрл»', rarity: 'common', src: 'ach', ach: 'onegun',
    flavor: 'Собрала волосы — собрала жизнь.' },
  // заколки на пучок (src/art/vec/bun_*.js): сидят на пучке во всех позах
  { id: 'bun_sticks', slot: 'head', name: 'Палочки «Тыква и мышка»', rarity: 'rare', src: 'shop',
    flavor: 'Пучок держится на честном слове. И на двух палочках.' },
  { id: 'bun_scrunchie', slot: 'head', name: 'Чёрный скранчи с мышкой', rarity: 'common', src: 'shop',
    flavor: 'Чёрный бархат и мышка-подвеска. Тихая готика для хвостика.' },
  { id: 'bun_witchhat', slot: 'head', name: 'Шляпка-малышка', rarity: 'epic', src: 'ach', ach: 'cupcatch',
    flavor: 'Поймала двадцать капель — самое время варить зелье. Шляпка уже на пучке.' },
  { id: 'bun_wreath', slot: 'head', name: 'Венок из жасмина', rarity: 'rare', src: 'shop',
    flavor: 'Пахнет жасмином. Капли пахнут иначе. Венок держит оборону.' },
  { id: 'bun_ribbon', slot: 'head', name: 'Алая лента с бубенчиком', rarity: 'rare', src: 'ach', ach: 'bell',
    flavor: 'Дзынь. Это не капля, это ты идёшь.' },
  { id: 'bun_fork', slot: 'head', name: 'Лунная шпилька', rarity: 'epic', src: 'ach', ach: 'lvl10',
    flavor: 'Уровень растёт, как луна. Шпилька держит и то, и другое.' },
  // брелоки на пояс (качаются от бега)
  { id: 'charm_runcow', slot: 'back', name: 'Коровка «Бегу-бегу»', rarity: 'common', src: 'ach', ach: 'runs5',
    flavor: 'Пятый забег. Коровка бежит вместе с тобой.' },
  { id: 'charm_crybaby', slot: 'back', name: 'Плюш-Плакса', rarity: 'epic', src: 'shop',
    flavor: 'Плачет за тебя, пока ты стреляешь.' },
  { id: 'charm_67', slot: 'back', name: 'Брелок «Сикс-севен»', rarity: 'common', src: 'shop',
    flavor: 'Насколько страшно? Ну… сикс-севен.' },
  { id: 'charm_nope', slot: 'back', name: 'Мышка «Вряд ли»', rarity: 'rare', src: 'ach', ach: 'spasm0',
    flavor: 'Поцарапают тебя? Вряд ли.' },
  // след выстрела
  { id: 'trail_hearts', slot: 'trail', name: 'След «Сердечки»', rarity: 'common', src: 'ach', ach: 'combo25',
    flavor: 'Стреляю с любовью. Капли не оценили.' },
  { id: 'trail_sprinkles', slot: 'trail', name: 'След «Посыпка»', rarity: 'common', src: 'shop',
    flavor: 'Как на пончике. Только пончик — это ты.' },
  { id: 'trail_stars', slot: 'trail', name: 'След «Звездопад»', rarity: 'epic', src: 'find',
    flavor: 'Загадай желание. Хотя нет, стреляй.' },
];
for (const a of ACCESSORIES) if (a.src === 'shop') a.price = GEM_PRICE[a.rarity];   // цена в стразах — только от редкости
export const ACC = Object.fromEntries(ACCESSORIES.map(a => [a.id, a]));
export const accByAch = Object.fromEntries(ACCESSORIES.filter(a => a.ach).map(a => [a.ach, a]));

// Убранные предметы старого каталога: цена в конфетах (вернём, если куплены за конфеты; уже купленное за конфеты не трогаем и заново не возвращаем)
const LEGACY_REFUND = { heart_glasses: 400, face_gems: 150, plush_monster: 600, forces_white: 500, blaster_candy: 250, blaster_pumpkin: 700, clip_horns: 450, clip_wand: 300 };

// Сохранение: save.acc = { owned: { id: 'shop'|'ach'|'find'|'gift' }, equip: { slot: id|null }, pity }
// Старые предметы (ободок, очки, стразы, чокер, обувь, «Зубастик», пастельные бластеры) молча убираются;
// купленное за конфеты возвращается конфетами, награды за достижения подхватываются новыми предметами.
export function ensureAcc(save) {
  const A = save.acc && typeof save.acc === 'object' ? save.acc : (save.acc = {});
  A.owned ??= {}; A.equip ??= {}; A.pity ??= 0;
  for (const id of Object.keys(A.owned)) {
    if (ACC[id]) continue;
    if (A.owned[id] === 'shop' && LEGACY_REFUND[id]) save.candies = (save.candies || 0) + LEGACY_REFUND[id];
    delete A.owned[id];
  }
  for (const s of Object.keys(A.equip)) if (!SLOTS.some(x => x.id === s)) delete A.equip[s];
  for (const s of SLOTS) if (!(s.id in A.equip)) A.equip[s.id] = null;
  // достижения, полученные до появления наград, отдают предмет задним числом
  for (const a of ACCESSORIES) if (a.ach && save.ach?.[a.ach] && !A.owned[a.id]) A.owned[a.id] = 'ach';
  for (const s in A.equip) if (A.equip[s] && (!ACC[A.equip[s]] || ACC[A.equip[s]].slot !== s || !A.owned[A.equip[s]])) A.equip[s] = null;
  return A;
}
export const owns = (save, id) => !!save.acc?.owned?.[id];
export function grantAcc(save, id, src = 'gift') {
  const A = ensureAcc(save); if (!ACC[id] || A.owned[id]) return false;
  A.owned[id] = src; return true;
}
export function equipAcc(save, id) {
  const A = ensureAcc(save), it = ACC[id]; if (!it || !A.owned[id]) return false;
  A.equip[it.slot] = A.equip[it.slot] === id ? null : id; return true;   // повторное нажатие — снять
}
// Покупка за стразы (не за конфеты). Покупка сразу надевает предмет.
export function buyAcc(save, id) {
  const it = ACC[id]; if (!it || it.src !== 'shop' || owns(save, id) || !spendGems(save, it.price)) return false;
  grantAcc(save, id, 'shop'); ensureAcc(save).equip[it.slot] = id; return true;
}
// Сколько стразов не хватает до предмета (0 — хватает)
export const gemsShort = (save, it) => Math.max(0, it.price - gemsOf(save));
// Как открыть (подсказка на замке); achName — функция id → название достижения
export function accHint(it, achName, long = false) {
  if (it.src === 'shop') return long ? `Купить за ${it.price} ${gemWord(it.price)}` : `${it.price} ${gemWord(it.price)}`;
  if (it.src === 'ach') return `Достижение «${achName(it.ach)}»`;
  return long ? 'Находка в бою: 2,5% за волну, 5% за босса. Точно — не позже 30-й волны.' : 'Находка в бою: 2,5% за волну';
}

// Редкая находка (§3.5, упрощённо): бросок на «ЧИСТО!» волны и на победу над боссом; мягкая гарантия после
// 12 пустых бросков (+4% за каждый), жёсткая на 30-м. Пул — только ещё не найденные; пусто — null.
export function rollFind(save, { boss = false } = {}, rnd = Math.random) {
  const A = ensureAcc(save);
  const pool = ACCESSORIES.filter(a => a.src === 'find' && !A.owned[a.id]);
  if (!pool.length) return null;
  const dry = A.pity || 0;
  const p = (boss ? 0.05 : 0.025) + Math.max(0, dry - 11) * 0.04;
  if (dry + 1 < 30 && rnd() >= p) { A.pity = dry + 1; return null; }
  A.pity = 0;
  const it = pool[Math.floor(rnd() * pool.length)];
  grantAcc(save, it.id, 'find');
  return it;
}

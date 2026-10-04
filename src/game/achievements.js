// Достижения: почти каждое что-то открывает (оружие, пассивку, бонус). Проверяются по событиям забега.
// check(ev, run, save) вызывается на каждом событии; вернуть true = получено.
// unlock с префиксом 'acc_' — аксессуар (src/game/accessories.js), попадает в save.acc.owned.
// gems — награда стразами (вторая валюта, src/game/gems.js), «в меру»: +5 за мелкие, +10 за первое прохождение главы, +20 за самые трудные.
import { grantAcc } from './accessories.js';
import { addGems, ensureGems } from './gems.js';
export const ACHIEVEMENTS = [
  { id: 'first', gems: 5, name: 'Первая капля', desc: 'Сбить первую каплю', check: (e) => e.type === 'kill' },
  { id: 'clean', gems: 5, name: 'Чистый ковёр', desc: 'Пройти волну, не уронив ни одной капли на пол', unlock: 'luckycat', check: (e) => e.type === 'waveClear' && e.floorHits === 0 },
  { id: 'pads10', name: 'Ловкие руки', desc: 'Поймать 5 прокладок за забег', unlock: 'cup', check: (e, r) => e.type === 'pad' && r.pads >= 5 },
  { id: 'combo25', name: 'В ритме', desc: 'Серия из 25 убийств', unlock: 'acc_trail_hearts', check: (e) => e.type === 'combo' && e.n >= 25 },
  { id: 'combo100', gems: 20, name: 'Серийная героиня', desc: 'Серия из 100 убийств', check: (e) => e.type === 'combo' && e.n >= 100 },
  { id: 'air8', name: 'Лара гордилась бы', desc: '8 убийств за один прыжок', unlock: 'cloak', check: (e) => e.type === 'air' && e.n >= 8 },
  { id: 'fart10', name: 'Свежий воздух', desc: 'Сбить 10 облаков (за всё время)', check: (e, r, s) => e.type === 'kill' && e.enemy === 'fart' && s.stats.farts >= 10 },
  { id: 'jellyS', name: 'Мелкая нарезка', desc: 'Разбить желе до самых маленьких кусочков', check: (e) => e.type === 'kill' && e.enemy === 'jelly' && e.size === 3 },
  { id: 'lvl10', name: 'Растём!', desc: 'Достичь 10-го уровня за забег', unlock: 'acc_bun_fork', check: (e) => e.type === 'level' && e.level >= 10 },
  { id: 'lvl20', name: 'Звезда сеанса', desc: 'Достичь 20-го уровня за забег', unlock: 'acc_blaster_lightstick', check: (e) => e.type === 'level' && e.level >= 20 },
  { id: 'max1', name: 'До упора', desc: 'Прокачать оружие до 5-го уровня', check: (e) => e.type === 'weaponLevel' && e.level >= 5 },
  { id: 'evo1', gems: 5, name: 'Эволюция', desc: 'Получить первую эволюцию оружия', unlock: 'thermos', check: (e) => e.type === 'evolve' },
  { id: 'full4', name: 'Полная сумочка', desc: 'Собрать 4 вида оружия', check: (e, r) => e.type === 'gain' && r.weapons.length >= 4 },
  { id: 'spasm', name: 'Снято!', desc: 'Победить Мисс Спазм (открывает пижаму с персиками)', unlock: 'outfit_pajama', check: (e) => e.type === 'bossKill' && e.boss === 'spasm' },
  { id: 'spasm0', gems: 20, name: 'Ни царапины', desc: 'Победить босса, не потеряв ни сердца', unlock: 'acc_charm_nope', check: (e) => e.type === 'bossKill' && e.damageTaken === 0 },
  { id: 'bloat', name: 'Лопнула!', desc: 'Победить Великое Вздутие', check: (e) => e.type === 'bossKill' && e.boss === 'bloat' },
  // хардкор: босс главы 2 без единого удара (G.run.bossHits сбрасывается в начале боя) → поза в бою «Спиной»
  { id: 'iceQueen', gems: 20, name: 'Ледяная королева', desc: 'Победить Великое Вздутие без единого удара', unlock: 'pose_back', check: (e) => e.type === 'bossKill' && e.boss === 'bloat' && e.damageTaken === 0 },
  { id: 'chapter2', gems: 10, name: 'Прогулка', desc: 'Пройти главу «Улица»', check: (e) => e.type === 'chapterClear' && e.chapter === 1 },
  { id: 'chapter1', gems: 10, name: 'Сеанс окончен', desc: 'Пройти главу «Кинотеатр»', check: (e) => e.type === 'chapterClear' && e.chapter === 0 },
  { id: 'chapter3', gems: 10, name: 'Рассвет над замком', desc: 'Пройти главу «Готика»', check: (e) => e.type === 'chapterClear' && e.chapter === 2 },
  { id: 'fast1', name: 'Спринтерша', desc: 'Пройти главу быстрее 5 минут', unlock: 'sneakersStart', check: (e) => e.type === 'chapterClear' && e.time < 300 },
  { id: 'onegun', name: 'Минимализм', desc: 'Пройти главу только с одним оружием', unlock: 'acc_claw_clean', check: (e, r) => e.type === 'chapterClear' && r.weapons.length === 1 },
  { id: 'nohit', name: 'Неуловимая', desc: 'Пройти волну без потери сердца', unlock: 'acc_pet_surfdog', check: (e) => e.type === 'waveClear' && e.damageTaken === 0 },
  { id: 'last30', name: 'Последняя капля', desc: 'Сбить последнюю каплю волны у самого пола', unlock: 'mirrorStart', check: (e) => e.type === 'waveClear' && e.lastY > 430 },
  { id: 'heal', name: 'Свежее бельё', desc: 'Подобрать трусики при одном сердце', check: (e) => e.type === 'panties' && e.hpBefore === 1 },
  { id: 'die1', gems: 5, name: 'Бывает', desc: 'Проиграть в первый раз. Это нормально!', unlock: 'acc_pet_guinea', check: (e) => e.type === 'death' },
  { id: 'runs5', name: 'Упрямая', desc: 'Начать 5 забегов', unlock: 'acc_charm_runcow', check: (e, r, s) => e.type === 'runStart' && s.stats.runs >= 5 },
  { id: 'candy500', name: 'Сладкоежка', desc: 'Собрать 500 конфет за всё время', unlock: 'choco', check: (e, r, s) => e.type === 'candy' && s.stats.candiesTotal >= 500 },
  { id: 'shop1', gems: 5, name: 'Шопинг', desc: 'Купить что-нибудь в Косметичке', check: (e) => e.type === 'metaBuy' },
  { id: 'kills1000', gems: 5, name: 'Тысяча капель', desc: 'Сбить 1000 капель (за всё время)', unlock: 'ice', check: (e, r, s) => e.type === 'kill' && s.stats.kills >= 1000 },
  { id: 'tea', name: 'Спокойствие', desc: 'Убить 30 врагов ромашковым чаем за забег', unlock: 'acc_pet_capy', check: (e, r) => e.type === 'kill' && (r.killsBy.tea || 0) + (r.killsBy.ceremony || 0) >= 30 },
  { id: 'cupcatch', name: 'Полная чаша', desc: 'Поймать чашей 20 капель за забег', unlock: 'acc_bun_witchhat', check: (e, r) => e.type === 'cup' && r.cupCatches >= 20 },
  { id: 'bell', name: 'Жонглёрка', desc: 'Подбросить тыквенный колокольчик 8 раз', unlock: 'acc_bun_ribbon', check: (e) => e.type === 'bell' && e.n >= 8 },
  // глава 3 «Готика» и финал
  { id: 'gothicDry', name: 'Сухо и готично', desc: 'Пройти волну «Готики», не уронив ни капли на пол', unlock: 'acc_blaster_baguette', check: (e, r) => e.type === 'waveClear' && e.floorHits === 0 && r.chapter === 2 },
  { id: 'queen', name: 'Долой маски!', desc: 'Победить Королеву ПМС', unlock: 'acc_clip_maxbow', check: (e) => e.type === 'bossKill' && e.boss === 'queen' },
  { id: 'hug', name: 'Обнимашки', desc: 'Обнять Руду в финале', unlock: 'acc_pet_monkey', check: (e, r) => e.type === 'bossKill' && e.boss === 'ruda' && r.ending === 'hug' },
  { id: 'war', name: 'Через 28 дней', desc: 'Добить Руду в финале', check: (e, r) => e.type === 'bossKill' && e.boss === 'ruda' && r.ending === 'war' },
  { id: 'finale', gems: 10, name: 'Посвящается всем девушкам', desc: 'Пройти финал «Логово Руды»', check: (e) => e.type === 'chapterClear' && e.chapter === 3 },
  { id: 'secret', name: 'Кетчуп?', desc: '???  Простоять 20 секунд в углу кинотеатра', secret: true, check: (e) => e.type === 'corner' },
];

// Награды, которые не оружие и не аксессуар: подпись в тосте и в списке достижений
export const REWARD_NAMES = { pose_back: 'Поза «Спиной»', outfit_pajama: 'Пижама с персиками' };
// Поза в бою по сохранению: «Спиной» только после «Ледяной королевы» (старые сейвы и тесты → «Лицом»)
export const BACK_POSE_ACH = 'iceQueen';
export const BACK_POSE_HINT = 'Достижение «Ледяная королева»: победи Великое Вздутие без единого удара';
export const facingOf = (save) => save?.facing === 'back' && save.ach?.[BACK_POSE_ACH] ? 'back' : 'front';

// Страз-награда за достижение; один раз для старых сейвов: уже полученные достижения отдают стразы задним числом (save.gemsInit)
export function backfillAchGems(save) {
  ensureGems(save);
  if (save.gemsInit) return 0;
  save.gemsInit = true;
  let n = 0; for (const a of ACHIEVEMENTS) if (a.gems && save.ach?.[a.id]) n += a.gems;
  addGems(save, n); return n;
}

export function createAchievementTracker(save, onGet) {
  const got = save.ach;
  return function emit(ev, run) {
    for (const a of ACHIEVEMENTS) {
      if (got[a.id]) continue;
      let ok = false; try { ok = a.check(ev, run || {}, save); } catch { ok = false; }
      if (ok) { got[a.id] = true; if (a.gems) addGems(save, a.gems); if (a.unlock) { save.unlocked[a.unlock] = true; if (a.unlock.startsWith('acc_')) grantAcc(save, a.unlock.slice(4), 'ach'); } onGet(a); }
    }
  };
}

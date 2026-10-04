// Реплики Поппи по событиям (docs/ATMOSPHERE.md, P1-2 и §4): приоритеты, кулдауны категорий, глобальная пауза,
// «мешок» без повторов, условия по памяти (кто убил в прошлый раз). Вывод — пузырь над героиней (G.say).
import { shuffle } from '../engine/util.js';

// pri — перебивает пузырь с меньшим; chance — вероятность; cd — молчание категории, с; style — say|think|shout
const B = {
  runStart: { pri: 2, chance: 1, cd: 0, lines: ['План простой: выжить и успеть к фильму.', 'Календарь, мог бы и предупредить.', 'Лара грабит гробницы. Я — очередь в туалет.', 'Спокойно, Поппи. Это просто очень красный фильм.'] },
  runStartRetry: { pri: 2, chance: 1, cd: 0, lines: ['Второй дубль. Капли, улыбаемся!', 'Так, ещё разок. Я злая и выспавшаяся.'] },
  runStartJelly: { pri: 2, chance: 1, cd: 0, lines: ['Желе, я тебя запомнила.'] },
  levelup: { pri: 3, chance: 0.5, cd: 0, lines: ['Апгрейд! Как шоколадка, только без калорий.', 'Сила пришла. Настроение тоже… разное.', 'Беру не глядя. Как всё в эти дни.', 'Я на все сто. Ну, на восемьдесят.', 'Как Лара!'] },
  lowHp: { pri: 4, chance: 1, cd: 20, style: 'think', lines: ['Мне нужен плед, грелка и чтобы все отстали.', 'Ещё капля — и я заплачу над рекламой йогурта.', 'Держусь. На честном слове и ибупрофене.', 'Я не плачу. Это глаза потеют.'] },
  heal: { pri: 3, chance: 1, cd: 4, lines: ['Свежее бельё — лучшее зелье здоровья!', 'Запасные! Мама говорила — пригодятся.', 'Вот теперь я снова человек.'] },
  pad: { pri: 3, chance: 0.5, cd: 10, lines: ['Крылышки! Летим, девочки.', 'Минус пять. Красота.'] },
  bossSpasm: { pri: 5, chance: 1, cd: 0, style: 'shout', lines: ['Мисс Спазм? Мы знакомы. Ежемесячно.', 'А, это ты сводишь мне живот? Ну держись.', 'Наконец-то главная злодейка фильма.'] },
  bossBloat: { pri: 5, chance: 1, cd: 0, style: 'shout', lines: ['Великое Вздутие… Джинсы, держитесь!', 'Помидор-переросток? Сейчас сдуем.'] },
  combo: { pri: 2, chance: 1, cd: 12, lines: ['Комбо! Гормоны — это топливо.', 'Я в ударе! Не подходите — укушу.', 'Нельзя останавливаться. Захочется прилечь.'] },
  bigKill: { pri: 2, chance: 0.6, cd: 8, lines: ['Бабах! Вот это разрядка.', 'Минус желе, плюс к самооценке.', 'Ха! Следующий.'] },
  fartKill: { pri: 2, chance: 0.8, cd: 8, lines: ['Облако разогнала. Фу. Но горжусь.', 'Проветрили!'] },
  fartFloor: { pri: 3, chance: 1, cd: 6, style: 'shout', lines: ['Фу-у-у! Кто это сделал?!', 'Это не я! Это облако!'] },
  hurt: { pri: 2, chance: 1, cd: 6, style: 'shout', lines: ['Ай! Я и так на взводе!', 'Эй! Без капель!', 'Больно же!', 'Ну вот…'] },
  floor: { pri: 1, chance: 0.3, cd: 10, lines: ['Ковёр! Здравствуй, химчистка.', 'Мимо. Это не я, это гормоны.', 'Фу, пятно.'] },
  waveClear: { pri: 3, chance: 0.6, cd: 0, lines: ['Чисто! Как совесть после шоколадки. Почти.', 'Одна волна позади.', 'Кто молодец? Я молодец.'] },
  bell: { pri: 2, chance: 1, cd: 0, once: true, lines: ['Тыква! Подбивай её — приз меняется'] },
  pu_freeze: { pri: 3, chance: 1, cd: 0, lines: ['Пауза! Минута тишины, наконец-то.'] },
  pu_slow: { pri: 3, chance: 1, cd: 0, lines: ['Медлееенно… Как моё утро.'] },
  pu_umbrella: { pri: 3, chance: 1, cd: 0, lines: ['Зонтик! Сегодня осадки — красные.'] },
  pu_popper: { pri: 3, chance: 1, cd: 0, lines: ['Хлопушка! Всем спасибо, все свободны.'] },
};
// Крупным текстом на экранах смерти и итогов главы
export const DEATH_LINES = ['Всё. Я под одеяло. Разбудите в следующем месяце.', 'Это не поражение. Это тактическое лежание.', 'Ну и сеанс… А попкорн так и не купили.'];
export const CLEAR_LINES = ['Снято! Кто молодец? Поппи молодец.', 'Один зал чист. Осталось найти туалет без очереди.', 'Краш, держи места! Я почти!'];

const COLORS = { say: '#fff', think: '#e6d9ff', shout: '#fff' };

export function createBarks(G) {
  const last = {}, bags = {}, seenOnce = {};
  let globalT = -99;
  function draw(key) {
    const L = B[key].lines;
    if (!bags[key] || bags[key].length <= Math.floor(L.length * 0.3)) bags[key] = shuffle(L.slice());
    return bags[key].pop();
  }
  // bark('hurt') → true, если сказала
  return function bark(key, { force = false } = {}) {
    const b = B[key]; if (!b) return false;
    const now = G.t;
    if (G.phase === 'cards' || G.paused) return false;
    if (b.once && seenOnce[key]) return false;
    if (!force) {
      if (b.cd && now - (last[key] ?? -99) < b.cd) return false;
      const gap = b.chance < 1 ? 8 : 3.5;
      if (b.pri < 4 && now - globalT < gap) return false;
      if (Math.random() > b.chance) return false;
      if (G.bubble && G.bubble.pri > b.pri && G.bubble.t < G.bubble.life) return false;
    }
    const s = draw(key);
    last[key] = now; globalT = now; seenOnce[key] = true;
    const life = Math.min(3.2, Math.max(1.4, 0.9 + 0.055 * s.length));
    G.bubble = { s, t: 0, life, pri: b.pri, style: b.style || 'say', color: COLORS[b.style || 'say'] };
    return true;
  };
}

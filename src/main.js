// Точка входа: профиль, звук, сцены, тосты достижений, хуки для автотестов.
import './engine/compat.js';   // polyfill: roundRect, structuredClone (старые Safari / WebView)
import { createGame, view, onViewChange } from './engine/core.js';
import { withFrame } from './engine/frame.js';
import { createInput } from './engine/input.js';
import { initAudio, audioState, applyVolumes, sfx, suspendAudio } from './engine/audio.js';
import { loadSave, writeSave } from './engine/util.js';
import { DEFAULT_SAVE, CHAPTERS } from './game/data.js';
import { normalizeSave } from './game/savefix.js';   // защита от ломаных/старых сейвов (QA)
import { createAchievementTracker, facingOf, REWARD_NAMES, backfillAchGems } from './game/achievements.js';
import { grantPurchase, gemWord } from './game/gems.js';
import { platform } from './platform/index.js';
import { ensureAcc, rollFind, ACC } from './game/accessories.js';
import { loadPoppyImages } from './game/player.js';
import { createPlay } from './game/play.js';
import { sanitizeWorld, sanitizePlayer, watchHeroDrawn } from './game/viewguard.js';
import { createMenu } from './game/menus.js';
import { createGod } from './game/god.js';   // режим бога / панель DEV (только ?god=1, не на платформах; docs/iter_god.md)
import { createStory, STORY } from './game/story.js';
import { preload } from './art/scenes.js';
import { loadHeroineVec, loadHeroineBack, setHeroineAcc } from './art/heroineVec.js';
import { preloadAcc } from './art/accessories.js';
import { petReact } from './game/pets.js';
import { text, FONT, BTNLOG } from './game/ui.js';
import { drawStar } from './art/sprites.js';
import { drawGem } from './art/gem.js';
import { drawFilm, drawIris, startIris } from './art/post.js';

const canvas = document.getElementById('game');
const game = createGame(canvas);
const inp = createInput(game);
const save = normalizeSave(loadSave(DEFAULT_SAVE));
save.hero = 'new';
backfillAchGems(save);                  // стразы: нормализация поля и (один раз) награды за уже полученные достижения
setHeroineAcc(ensureAcc(save).equip);   // аксессуары: сохранение + общая карта надетого для всех поз героини
preloadAcc(save.acc.equip);             // векторы надетых предметов (остальные — лениво, при первой отрисовке)
audioState.sfx = save.settings.sfx; audioState.music = save.settings.music;

const toasts = [];
const AFTER = ['afterCinema', 'afterStreet', 'afterGothic'];
// сюжетная сцена из story.js (все ключи уже есть; запасной путь — сразу дальше, если сцены нет)
function story(key, next) { if (STORY[key]?.length) setScene(createStory(app, key, next)); else next(); }
const app = {
  game, inp, save,
  persist: () => writeSave(save),
  emit: null,
  goMenu: () => setScene(menu),
  // «Играть» всегда начинается с истории (её можно пропустить кнопкой или Esc)
  startStory: () => { save.seenIntro = true; app.persist(); setScene(createStory(app, 'intro', () => setScene(play, { chapter: 0 }))); },
  replayIntro: () => setScene(createStory(app, 'intro', () => setScene(play, { chapter: 0 }))),
  // после главы: сюжетная сцена, затем следующая глава в том же забеге (если она уже есть)
  // глава 0 → afterCinema, 1 → afterStreet, 2 → afterGothic, 3 (финал) → finaleHug / finaleWar и меню
  afterChapter: (ch = 0) => {
    const key = ch >= 3 ? (play.run()?.ending === 'hug' ? 'finaleHug' : 'finaleWar') : AFTER[ch];
    story(key, () => { if (play.hasNext() && ch + 1 < CHAPTERS.length) setScene(play, { continue: true, chapter: ch + 1 }); else setScene(menu); });   // (ch + 1 < CHAPTERS.length: afterChapter(3) при рассинхроне run.chapter не должен открывать несуществующую главу)
  },
  // продолжение с контрольной точки из меню (новый забег с главы N): сцена перед главой N
  continueFrom: (ch) => story(ch > 0 ? AFTER[ch - 1] : 'intro', () => setScene(play, { chapter: ch })),
  toggleSound: () => { const on = save.settings.sfx > 0; save.settings.sfx = on ? 0 : 0.8; save.settings.music = on ? 0 : 0.45; audioState.sfx = save.settings.sfx; audioState.music = save.settings.music; applyVolumes(); app.persist(); },
};
const track = createAchievementTracker(save, a => { toasts.push({ a, t: 0 }); sfx('ach'); app.persist(); });
app.toast = (o) => { toasts.push({ a: o.a || { name: o.name || '' }, find: o.find, t: 0 }); };   // для автотестов
app.emit = (ev, run) => {
  if (app.god?.blocksAch?.(run)) return;   // режим бога: забег с читами не даёт достижений и находок
  track(ev, run);
  // редкая находка-аксессуар: бросок на «ЧИСТО!» волны (не в первой волне первого забега) и на победу над боссом
  if ((ev.type === 'waveClear' && !(save.stats.runs <= 1 && (run?.wave || 0) === 0)) || ev.type === 'bossKill') {
    const it = rollFind(save, { boss: ev.type === 'bossKill' });
    if (it) { toasts.push({ a: { name: it.name }, find: it, t: 0 }); sfx('ach'); app.persist(); }
  }
};

// Платформа (src/platform): один init при старте; любой сбой — игра идёт без покупок. grant зачисляет купленные стразы в сейв.
app.platform = platform;
platform.init({ grant: (n, token) => { const ok = grantPurchase(save, n, token); if (ok) writeSave(save); return ok; } }).catch(() => { });

const play = createPlay(app);
const menu = createMenu(app);
app.setScene = (s, o) => setScene(s, o);   // для панели DEV (god.js): открыть сцену / экран
app.god = createGod(app, { play, menu }); window.__god = app.god;

// Корневая сцена: текущая сцена + тосты поверх
let cur = null;
app.cur = () => cur;
// смена сцены — с диафрагмой (iris) из чёрного; сама смена мгновенная, чтобы не ломать логику и тесты
function setScene(s, opts) { const changed = cur && cur !== s; cur = s; s.enter?.(game, opts); if (changed && (s === play || s === menu)) startIris(view.W / 2, s === play ? view.H * 0.74 : view.H / 2); }   // у катсцен своя диафрагма
// Раскладка сцены: scene.frame !== false — рисуется в «дизайн-рамке» 960×540 (landscape: по центру, вокруг эмбиент;
// portrait: заглушка — рамка вписана по ширине), scene.frame === false — полный вид (бой).
// scene.portraitLayout === true — в портрете сцена сама рисует раскладку на полном виде (по умолчанию false).
let guardN = 0;
const usesFullView = s => !!s && (s.frame === false || (view.portrait && s.portraitLayout === true));
game.setScene({
  update(dt, rdt) {
    inp.setSpace(usesFullView(cur) ? null : view.frame);
    app.god.tick(rdt); if (app.god.frozen()) { inp.gameplay = false; inp.endStep(); return; }   // панель DEV открыта: игра на паузе
    if (cur !== play) inp.gameplay = false;
    cur?.update?.(dt, rdt); for (const t of toasts) t.t += rdt; while (toasts.length && toasts[0].t > 3.2) toasts.shift();
    // страж боя: героиня/враги/снаряды/питомец/сундук/босс всегда в допустимых границах вида (NaN, улёт за экран, провал под пол — чиним, не падаем)
    if (cur === play && play.G?.run && play.G.p) { if (play.G.p) sanitizePlayer(play.G.p, game, 'страж'); if ((guardN = (guardN + 1) % 12) === 0) sanitizeWorld(play.G, game, 'страж'); }
  },
  updateFrozen(rdt) { inp.setSpace(usesFullView(cur) ? null : view.frame); cur?.updateFrozen?.(rdt); },
  draw(ctx) {
    if (usesFullView(cur)) { inp.setSpace(null); cur?.draw?.(ctx); }
    else withFrame(game, ctx, c => cur?.draw?.(c), { clip: true, ambient: true });
    inp.setSpace(usesFullView(cur) ? null : view.frame);
    if (cur === play && play.G?.run) watchHeroDrawn(play.G, game, ['intro', 'wave', 'clear', 'boss', 'bossIntro', 'bossDead'].includes(play.G.phase));   // «героиня не рисуется» → восстановить
    drawFilm(ctx, { fight: cur === play && !['dead', 'chapterClear'].includes(play.G.phase) });
    drawIris(ctx, 1 / 60);
    inp.endFrame();   // клики для кнопок интерфейса живут до конца кадра
    const ui = view.uiScale, saf = view.safe;
    let stackOff = 0;   // сумма высот предыдущих плашек: плашки разной высоты (с наградой-предметом и стразами) не должны налезать друг на друга
    toasts.slice(0, view.portrait && cur === play && ['dead', 'chapterClear', 'choice'].includes(play.G?.phase) ? 2 : 3).forEach((o, i) => {
      // тосты — сверху по центру, выезжают вниз (не перекрывают HUD и таблицы итогов)
      // на экранах смерти и итогов плашки уходят в правый нижний угол (сверху там итоги и витрина)
      const low = cur === play && ['dead', 'chapterClear', 'choice'].includes(play.G?.phase);
      // награда-аксессуар: строка «+ предмет в Гардеробе»; стразы: строка «+N стразов»; находка — розовая рамка
      const gift = o.find || (o.a.unlock?.startsWith('acc_') ? ACC[o.a.unlock.slice(4)] : REWARD_NAMES[o.a.unlock] ? { name: REWARD_NAMES[o.a.unlock] } : null), gems = !o.find && o.a.gems || 0;
      const rows = (gift && !o.find ? 1 : 0) + (gems ? 1 : 0), th = 54 + rows * 18;
      // портрет: плашка во всю ширину (view.W − 32), сверху по центру под HUD боя (в меню — у самого верха), на экранах смерти и итогов — снизу над кнопками
      const P = view.portrait, tw = P ? (view.W - Math.max(16, saf.l + 8) - Math.max(16, saf.r + 8)) / ui : 290;
      const inFight = cur === play && !['dead', 'chapterClear', 'choice'].includes(play.G?.phase), barH = Math.max(56, 46 / view.scale) + 40;
      const step = P ? th + 12 : 98;
      const kk = Math.min(1, o.t < 0.3 ? o.t / 0.3 : 1), k = o.t < 0.3 ? o.t / 0.3 : o.t > 2.8 ? (3.2 - o.t) / 0.4 : 1;
      ctx.save();
      // масштаб интерфейса на маленьких экранах — вокруг якоря (верх по центру / правый нижний угол); на десктопе ui = 1
      const ax = low && !P ? view.W - saf.r : view.W / 2, ay = low ? view.H : 0;
      ctx.translate(ax, ay); ctx.scale(ui, ui); ctx.translate(-ax, -ay);
      const lowOff = P ? (cur === play && ['dead', 'chapterClear'].includes(play.G?.phase) ? barH : 14) + saf.b : saf.b;
      const topY = P ? (saf.t + (inFight ? 160 * ui : 10)) / ui : saf.t + 90;
      const y = low ? (P ? view.H - lowOff / ui + 20 : view.H + 20 - saf.b) - (th + 30) * kk - stackOff : topY - 150 + 150 * kk + stackOff;
      stackOff += step;
      ctx.globalAlpha = Math.max(0, k); const x = P ? view.W / 2 - tw / 2 : low ? view.W - saf.r - 296 : view.W / 2 - 145;
      ctx.fillStyle = o.find ? 'rgba(70,20,60,0.94)' : 'rgba(20,60,50,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, tw, th, 14); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = o.find ? '#ff9ad0' : '#5ee6c8'; ctx.stroke();
      drawStar(ctx, x + 28, y + 27, 14, o.find ? '#ff9ad0' : undefined);
      text(ctx, o.find ? 'Находка! Уже в Гардеробе' : 'Достижение!', x + 52, y + 17, { size: 13, align: 'left', color: o.find ? '#ff9ad0' : '#5ee6c8', lw: 3 });
      const fit = (str, size, w) => { ctx.font = `800 ${size}px ${FONT}`; const m = ctx.measureText(str).width; return m > w ? Math.max(8, Math.floor(size * w / m)) : size; };   // длинные названия предметов — мельче
      text(ctx, o.a.name, x + 52, y + 37, { size: fit(o.a.name, 17, tw - 62), align: 'left' });
      let ry = y + 58;
      if (gift && !o.find) { const g = `+ ${gift.name} в Гардеробе`; text(ctx, g, x + 52, ry, { size: fit(g, 12, tw - 62), align: 'left', color: '#ffd166', lw: 3 }); ry += 18; }
      if (gems) { text(ctx, `+${gems} ${gemWord(gems)}`, x + 68, ry, { size: 12, align: 'left', color: '#ff9ad0', lw: 3 }); drawGem(ctx, x + 58, ry, 9); }
      ctx.restore();
    });
  },
});

// Смена вида (поворот, адресная строка): отпустить касания и джойстик (pointercancel при повороте теряется — иначе «залипшее» движение/прыжок)
onViewChange((v, prev) => { if (v.portrait !== prev.portrait || Math.abs(v.W / prev.W - 1) > 0.2 || Math.abs(v.H / prev.H - 1) > 0.2) inp.resetTouches?.(); inp.setSpace(usesFullView(cur) ? null : view.frame); });   // мелкие сдвиги (адресная строка) касание не обрывают

// Звук запускается по первому жесту (политика браузеров)
const unlock = () => { initAudio(); applyVolumes(); };
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));

// Хуки проверки агентом
window.render_game_to_text = () => JSON.stringify(cur === play ? play.toText() : { scene: cur === menu ? 'menu' : 'story', view: { W: view.W, H: view.H, portrait: view.portrait } });
window.advanceTime = (ms) => game.step(Math.round(ms / (1000 / 60)));
window.__petReact = (e) => { const G = play.G; if (G?.pet) petReact(G.pet, G.petId, e, { n: 25, force: true }); };   // проверка реакций питомца
window.__btns = BTNLOG; window.__app = app; window.__menu = menu; window.__play = play; window.__go = (name, o) => setScene(name === 'play' ? play : menu, o);

preload(['facade2', 'facade', 'corridor']);
const Q = new URLSearchParams(location.search);
Promise.all([loadPoppyImages(), loadHeroineVec(save.outfit || 'lara'), facingOf(save) === 'back' && loadHeroineBack(save.outfit || 'lara')]).then(() => setScene(Q.has('play') ? play : menu, { chapter: +(Q.get('chapter') || 0) }));

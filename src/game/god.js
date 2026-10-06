// Режим бога: панель «DEV» для проверки всей игры (docs/iter_god.md).
// Включается только ссылкой ?god=1 (запоминается в localStorage: poppy.god=1; ?god=0 выключает) и НЕ работает на платформах
// (Яндекс Игры, VK, OK, Poki, CrazyGames…: платформа не none/dev, есть SDK платформы или чужой хост — режим выключен жёстко,
// даже с параметром). Интерфейс — обычный DOM поверх холста (нативная прокрутка пальцем и колесом, safe-area, кнопки ≥ 44 CSS px,
// портретная раскладка: крупные табы сверху; ландшафт: боковая колонка), поэтому не зависит от раскладки игры.
// Пока панель открыта, главный цикл не вызывает update сцены (main.js: god.frozen()) — бой на паузе.
// Честность: любое чит-изменение ставит save.godUsed = true и save.godLog (что именно), помечает текущий забег (run.godTaint) —
// такой забег не даёт достижений и находок (main.js: god.blocksAch), рекорды не отправляются (app.canSubmitScore() = false, пока режим включён),
// а перед первым чит-изменением сессии сейв копируется в localStorage poppy2.save.v1.godbackup (кнопка «восстановить сейв до режима бога»).
import { platform } from '../platform/index.js';
import { view } from '../engine/core.js';
import { sfx } from '../engine/audio.js';
import { WEAPONS, PASSIVES, ENEMIES, CHAPTERS, WARDROBE, DEFAULT_SAVE, xpToNext } from './data.js';
import { ACHIEVEMENTS, BACK_POSE_ACH, facingOf } from './achievements.js';
import { ACCESSORIES, ensureAcc, grantAcc } from './accessories.js';
import { addGems } from './gems.js';
import { STORY, CAPTION, createStory } from './story.js';
import { makeEnemy } from './enemies.js';
import { carryItems } from './carry.js';
import { playerBox, GROUND, ARENA } from './player.js';
import { loadHeroineKey, loadHeroineVec, loadHeroineBack, drawHeroineKey, drawHeroineVec, drawHeroinePortrait } from '../art/heroineVec.js';

export const GOD_KEYS = { flag: 'poppy.god', opts: 'poppy.god.opts', pos: 'poppy.god.pos', save: 'poppy2.save.v1', backup: 'poppy2.save.v1.godbackup', backupAt: 'poppy2.save.v1.godbackup.at' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};

// ---------- Где режим запрещён ----------
// платформа не none/dev, есть SDK платформы или страница лежит на хосте платформы — режим выключен (параметр и флаг игнорируются)
const SDK_GLOBALS = ['YaGames', 'ysdk', 'vkBridge', 'FAPI', 'PokiSDK', 'CrazyGames', 'GamePix', 'GameDistribution', 'gdsdk'];
const PLATFORM_HOST = /(^|\.)(yandex\.[a-z.]+|yagames\.[a-z]+|yastatic\.net|vk\.com|vk-apps\.com|vkuseraudio\.net|ok\.ru|odnoklassniki\.ru|crazygames\.com|poki\.com|gamepix\.com|gamedistribution\.com)$/i;
export function platformBlocked(platformName = platform.name, g = globalThis, host = g.location?.hostname || '') {
  if (platformName !== 'none' && platformName !== 'dev') return true;
  for (const k of SDK_GLOBALS) if (g[k]) return true;
  if (g.Telegram?.WebApp?.initData) return true;
  return PLATFORM_HOST.test(host || '');
}
// Решение при старте: ?god=1 включает и запоминает (если не запрещено), ?god=0 выключает и забывает
export function resolveGod({ search = '', platformName = platform.name, g = globalThis, host, get = store.get, set = store.set, del = store.del } = {}) {
  const blocked = platformBlocked(platformName, g, host ?? g.location?.hostname ?? '');
  const q = new URLSearchParams(search).get('god');
  if (!blocked) { if (q === '1') set(GOD_KEYS.flag, '1'); else if (q === '0') del(GOD_KEYS.flag); }
  return { on: !blocked && (q === '1' || (q !== '0' && get(GOD_KEYS.flag) === '1')), blocked };
}

// ---------- Настройки режима (держатся в localStorage, чтобы переживать перезагрузку) ----------
const DEF_OPTS = { immortal: false, hits: true, dmg: 1, speed: 1, time: 1, hpAdd: 0, fps: false, info: false, boxes: false, noHud: false, touch: null };
function loadOpts() { try { return { ...DEF_OPTS, ...JSON.parse(store.get(GOD_KEYS.opts) || '{}') }; } catch { return { ...DEF_OPTS }; } }

const h = (tag, a = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in a) {
    const v = a[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TABS = [['battle', 'Бой'], ['build', 'Сборка'], ['chapter', 'Глава'], ['wardrobe', 'Наряды'], ['save', 'Сейв']];
const PHASE_RU = { intro: 'вступление', wave: 'волна', clear: 'чисто', boss: 'босс', bossIntro: 'выход босса', bossDead: 'босс повержен', cards: 'карточки', carry: 'с собой', dead: 'смерть', chapterClear: 'итоги', choice: 'выбор' };
const ENEMY_NAMES = { droplet: 'Капелька', drop: 'Капля', diver: 'Пикирующая', jelly: 'Желе', fart: 'Облако', popcorn: 'Попкорн', crier: 'Плакса', spazm: 'Спазмик', spazmj: 'Спазмик-прыгун', bloat: 'Вздутие (мелкое)', spout: 'Фонтанчик', ghost: 'Призрак', craving: 'Тяга' };

export function createGod(app, env) {
  const { play, menu } = env, game = app.game, inp = app.inp, save = app.save;
  const G = play.G, hk = play.godHooks || {};
  const opts = loadOpts();
  const ui = { tab: 'battle', enemy: 'droplet', count: 3, deathN: 1, confirm: null, ta: '', msg: '', prevOutfit: null };
  const init = resolveGod({ search: globalThis.location?.search || '' });
  let flag = init.on, enabled = flag, open = false, saved = false, backedUp = false, locked = false;
  const saveOpts = () => store.set(GOD_KEYS.opts, JSON.stringify(opts));
  const live = () => app.cur?.() === play && !!G.run && !!G.p;
  const persist = () => app.persist?.();

  // ---------- Чит-учёт, бэкап сейва ----------
  function ensureBackup() {
    if (backedUp) return; backedUp = true;
    const has = store.get(GOD_KEYS.backup);
    if (!save.godUsed || !has) { store.set(GOD_KEYS.backup, JSON.stringify(save)); store.set(GOD_KEYS.backupAt, String(Date.now())); }
  }
  // kind — что именно; taint — отметить текущий забег (достижения за него не выдаются)
  function cheat(kind, taint = true) {
    ensureBackup();
    save.godUsed = true;
    const L = save.godLog && typeof save.godLog === 'object' ? save.godLog : (save.godLog = { n: 0, what: {} });
    L.what = L.what || {}; L.what[kind] = (L.what[kind] || 0) + 1; L.n = (L.n || 0) + 1; L.last = Date.now();
    if (taint && G.run) G.run.godTaint = true;
    persist();
  }
  const lockSave = () => { locked = true; app.persist = () => { }; };   // перед перезагрузкой: игра больше ничего не пишет поверх подготовленного сейва

  // ---------- Мелочи ----------
  const status = (msg) => { ui.msg = msg; if (els.status) els.status.textContent = msg; };
  const recalc = () => { if (!G.run || !hk.computeStats) return; hk.computeStats(); if (G.p) G.p.hp = Math.min(G.p.hp, G.stats.maxHp); };
  const gemsNow = () => Math.floor(+save.gems) || 0;

  // ---------- Действия (панель и автотесты вызывают одни и те же) ----------
  const A = {
    // --- бой ---
    setOpt(k, v) {
      opts[k] = v; saveOpts();
      const gameplay = { immortal: v === true, dmg: v !== 1, speed: v !== 1, time: v !== 1, hpAdd: v > 0 };
      if (gameplay[k]) cheat('opt:' + k);
      if (k === 'speed' || k === 'hpAdd') recalc();
      if (k === 'touch') applyTouch();
      applyHud();
    },
    hearts(d) {
      if (!live()) return; const p = G.p, max = G.stats.maxHp;
      if (d === 'full') p.hp = max;
      else if (d > 0) { if (p.hp < max) p.hp++; else if (opts.hpAdd < 5) { opts.hpAdd++; saveOpts(); recalc(); p.hp = Math.min(G.stats.maxHp, p.hp + 1); } }
      else p.hp = Math.max(1, p.hp - 1);
      p.dead = false; cheat('hearts');
    },
    levels(n) {
      if (!live()) return; const R = G.run; let need = Math.max(0, R.xpNext - R.xp);
      for (let k = 1; k < n; k++) need += xpToNext(R.level + k);
      R.xp += need; cheat('levels');
    },
    nextCard() { if (!live() || !hk.openCards) return false; if (!['wave', 'boss', 'clear', 'intro'].includes(G.phase)) return false; hk.openCards({ list: hk.buildCards() }); cheat('card'); closePanel(); return true; },
    candies(n) { if (live()) { G.run.candies += n; G.banked = (G.banked || 0) + n; } save.candies = (save.candies || 0) + n; cheat('candies', !!live()); },
    gems(n) { addGems(save, n); cheat('gems', false); },
    // --- сборка ---
    giveWeapon(id, lv = 1) {
      if (!live()) return; const R = G.run, def = WEAPONS[id]; if (!def) return;
      lv = clamp(lv, 1, def.evolved ? 1 : def.lv.length);
      const base = def.evolved ? Object.keys(WEAPONS).find(k => WEAPONS[k].evo === id) : null;
      if (base) R.weapons = R.weapons.filter(w => w.id !== base);   // эволюция заменяет своё оружие
      if (def.evo) R.weapons = R.weapons.filter(w => w.id !== def.evo);   // и наоборот
      const w = R.weapons.find(w => w.id === id);
      if (w) { w.lv = lv; delete w.cdT; } else R.weapons.push({ id, lv });
      recalc(); cheat('weapon');
    },
    takeWeapon(id) { if (!live()) return; G.run.weapons = G.run.weapons.filter(w => w.id !== id); recalc(); cheat('weapon'); },
    givePassive(id, lv = 1) {
      if (!live()) return; const R = G.run, def = PASSIVES[id]; if (!def) return;
      lv = clamp(lv, 1, def.max);
      const oldMax = G.stats.maxHp, p = R.passives.find(p => p.id === id);
      if (p) p.lv = lv; else R.passives.push({ id, lv });
      recalc(); if (G.stats.maxHp > oldMax) G.p.hp += G.stats.maxHp - oldMax;
      if (id === 'umbrellaP' && G.stats.umbCd) R.umbT = G.stats.umbCd;   // щит зонтика готов сразу
      cheat('passive');
    },
    takePassive(id) { if (!live()) return; G.run.passives = G.run.passives.filter(p => p.id !== id); recalc(); cheat('passive'); },
    resetBuild() { if (!live()) return; const R = G.run; R.weapons = [{ id: 'tampon', lv: 1 }]; R.passives = []; R.shield = false; recalc(); cheat('build'); },
    // --- главы и экраны ---
    startChapter(ch, o = {}) {
      cheat('chapter');
      if (o.keep && !G.run) hk.startRun?.(0);
      app.setScene(play, o.keep ? { continue: true, chapter: ch } : { chapter: ch });
      if (o.boss) { G.run.pendingLevels = 0; clearFoes(); hk.startBoss(); }   // к боссу без карточек контрольной точки (билд — вкладка «Сборка»)
      else if (o.wave > 0) hk.startWave(o.wave);
      closePanel();
    },
    skipWave() {
      if (!live()) return; if (G.phase === 'intro') { G.phase = 'wave'; G.phaseT = 0; }
      if (G.phase === 'wave') { hk.waveClear(); cheat('skipWave'); closePanel(); }
    },
    lastWave() { if (!live()) return; clearFoes(); hk.startWave(CHAPTERS[G.run.chapter].waves.length - 1); cheat('lastWave'); closePanel(); },
    summonBoss() { if (!live()) return; clearFoes(); hk.startBoss(); cheat('boss'); closePanel(); },
    killBoss() { if (!live() || !G.boss || G.boss.dead) return false; G.bossDefeated(false); cheat('killBoss'); closePanel(); return true; },
    rudaChoice() {
      if (!live()) return;
      if (G.run.chapter !== 3 || !G.boss || G.boss.id !== 'ruda') { cheat('chapter'); app.setScene(play, { chapter: 3 }); clearFoes(); hk.startBoss(); }
      const b = G.boss; if (!b || b.id !== 'ruda') return;
      b.state = 'plea'; b.st = 0; b.asked = false; b.hp = b.minHp + 0.5; b.invuln = 99; b.slams = []; b.waves = []; b.rain = null; G.ceasefire = true;
      G.phase = 'boss'; G.phaseT = 0; cheat('ruda'); closePanel();
    },
    clearScreen(ending) { if (!live()) return; G.run.ending = ending || G.run.ending; hk.chapterClear(); cheat('chapterClear'); closePanel(); },
    chest() { if (!live()) return; hk.openChest(); cheat('chest'); closePanel(); },
    death(n = 1) {
      if (!live()) return; const S = save.stats; S.deaths = Math.max(0, n - 1); if (n <= 1) save.firstDeathGift = false;
      G.p.dead = false; hk.die(); cheat('death'); closePanel();
    },
    carry() {
      if (!live()) return; const R = G.run;
      const extra = [['pad', 3], ['pills', 2], ['broom', 2]];   // экран «взять с собой» показывается, когда улучшений больше лимита
      for (const [id, lv] of extra) if (carryItems(R).length < 5 && !R.weapons.some(w => w.id === id)) R.weapons.push({ id, lv });
      for (const [id, lv] of [['wings', 2], ['cotton', 2], ['water', 1]]) if (carryItems(R).length < 5 && !R.passives.some(p => p.id === id)) R.passives.push({ id, lv });
      recalc(); G.phase = 'intro'; G.phaseT = 0; hk.carryStart(); cheat('carry'); closePanel();
    },
    story(key) { app.setScene(createStory(app, key, () => app.goMenu())); closePanel(); },
    menuView(view_, o = {}) { app.goMenu(); menu.setView(view_, o); closePanel(); },
    spawn(type, n = 1) {
      if (!live() || !ENEMIES[type]) return 0;
      const def = ENEMIES[type], kind = def.base || type; let made = 0;
      if (type === 'bloat' && !G.boss?.virtual) return 0;   // Вздутие живёт только в бою с боссом-томатом
      for (let i = 0; i < n; i++) {
        const x = ARENA.left + 40 + Math.random() * (view.W - 2 * ARENA.left - 80);
        const o = type === 'jelly' ? { size: G.run.chapter === 0 ? 1 : 0 } : def.hop ? { hop: true } : type === 'bloat' ? { size: 2 } : {};
        G.enemies.push(makeEnemy(kind, x, type === 'jelly' ? 60 : -30, G.waveIndex || 0, o)); made++;
      }
      cheat('spawn'); return made;
    },
    clearEnemies() { if (!live()) return; clearFoes(); cheat('clearEnemies'); },
    // --- наряды, позы, достижения ---
    wear(id) {
      save.outfit = id; loadHeroineKey(id); loadHeroineVec(id); if (facingOf(save) === 'back') loadHeroineBack(id);
      if (G.p) G.p.outfit = id; cheat('outfit', false);
    },
    pose(kind) {
      if (kind === 'back') { grantAch(BACK_POSE_ACH); save.facing = 'back'; loadHeroineBack(save.outfit || 'lara'); } else save.facing = 'front';
      if (G.p) { G.p.facing = facingOf(save); if (G.p.facing === 'back') loadHeroineBack(G.p.outfit); }
      cheat('pose', false);
    },
    unlockAll(on) {
      const g = grants();
      if (on) {
        for (const a of ACCESSORIES) if (!ensureAcc(save).owned[a.id]) { save.acc.owned[a.id] = 'god'; g.acc.push(a.id); }
        for (const w of WARDROBE) if (w.unlock) grantAch(w.unlock);
        grantAch(BACK_POSE_ACH); g.all = true;
      } else { revokeGrants(); g.all = false; }
      ensureAcc(save); cheat('unlockAll', false);
    },
    ach(id, on) { if (on) grantAch(id); else revokeAch(id); ensureAcc(save); cheat('ach', false); },
    achAll(on) { for (const a of ACHIEVEMENTS) { if (on) grantAch(a.id); else revokeAch(a.id); } ensureAcc(save); cheat('ach', false); },
    // --- сейв ---
    firstRun() {
      cheat('firstRun', false);
      save.stats.runs = 0; save.stats.deaths = 0; save.tutorial = { move: false, jump: false }; save.seenIntro = false; save.firstDeathGift = false;
      save.hints = {}; save.carryHintDone = false; save.progress = 0; persist();
    },
    resetSave() { ensureBackup(); store.set(GOD_KEYS.save, JSON.stringify(structuredClone(DEFAULT_SAVE))); lockSave(); reload(); },
    restore() { const b = store.get(GOD_KEYS.backup); if (!b) return false; store.set(GOD_KEYS.save, b); lockSave(); reload(); return true; },
    exportText() { return JSON.stringify(save); },
    importText(txt) {
      let o; try { o = JSON.parse(txt); } catch { return 'Это не JSON'; }
      if (!o || typeof o !== 'object' || Array.isArray(o)) return 'Ожидался объект сейва';
      ensureBackup(); store.set(GOD_KEYS.save, JSON.stringify(o)); lockSave(); reload(); return null;
    },
  };
  function reload() { setTimeout(() => { try { location.reload(); } catch { } }, 60); }
  function clearFoes() { for (const e of G.enemies) if (e.type !== 'bloat') G.pop(e, true); for (const f of G.foes) f.dead = true; }

  // записи god-флагов, чтобы «всё куплено» и открытые достижения откатывались
  function grants() {
    const g = save.godGrants && typeof save.godGrants === 'object' ? save.godGrants : (save.godGrants = {});
    g.acc ||= []; g.ach ||= []; g.unlocked ||= []; return g;
  }
  function achRewards(a) { const out = { unlocked: null, acc: null }; if (a.unlock) { out.unlocked = a.unlock; if (a.unlock.startsWith('acc_')) out.acc = a.unlock.slice(4); } return out; }
  function grantAch(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id); if (!a || save.ach[id]) return false;
    const g = grants(), r = achRewards(a);
    save.ach[id] = true; g.ach.push(id);   // стразы за достижение не начисляются: это отметка для проверки, а не награда
    if (r.unlocked && !save.unlocked[r.unlocked]) { save.unlocked[r.unlocked] = true; g.unlocked.push(r.unlocked); }
    if (r.acc && grantAcc(save, r.acc, 'god')) g.acc.push(r.acc);
    return true;
  }
  function revokeAch(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id); if (!a || !save.ach[id]) return;
    const r = achRewards(a); delete save.ach[id];
    if (r.unlocked) delete save.unlocked[r.unlocked];
    if (r.acc && ['ach', 'god'].includes(save.acc?.owned?.[r.acc])) delete save.acc.owned[r.acc];
    const g = grants(); g.ach = g.ach.filter(x => x !== id);
    fixLooks();
  }
  function revokeGrants() {
    const g = grants();
    for (const id of g.acc) if (save.acc?.owned?.[id] === 'god' || save.acc?.owned?.[id] === 'ach') delete save.acc.owned[id];
    for (const k of g.unlocked) delete save.unlocked[k];
    for (const id of g.ach) delete save.ach[id];
    g.acc = []; g.ach = []; g.unlocked = []; fixLooks();
  }
  // после отзыва наград: закрытый наряд и поза «Спиной» не должны остаться надетыми
  function fixLooks() {
    const w = WARDROBE.find(x => x.id === save.outfit);
    if (w?.unlock && !save.ach[w.unlock]) { save.outfit = 'lara'; if (G.p) G.p.outfit = 'lara'; }
    if (save.facing === 'back' && !save.ach[BACK_POSE_ACH]) save.facing = 'front';
    if (G.p) G.p.facing = facingOf(save);
  }

  // ---------- Эффекты режима (вызываются из play.js / main.js) ----------
  const api = {
    get enabled() { return enabled; },
    get open() { return open; },
    get opts() { return opts; },
    get immortal() { return enabled && opts.immortal; },
    get dmgMul() { return enabled ? opts.dmg : 1; },
    get hideHud() { return enabled && opts.noHud; },
    get ui() { return ui; },
    act: A, cheat, ensureBackup,
    patchStats(s) { if (!enabled) return; if (opts.speed !== 1) s.moveSpeed *= opts.speed; if (opts.hpAdd > 0) s.maxHp += opts.hpAdd; },
    // бессмертие: удар виден (вспышка, тряска, подпись), сердца целы; возвращает true — удар поглощён
    onHurt(g, why) {
      if (!enabled || !opts.immortal) return false;
      const p = g.p; p.iframes = g.A?.iframes ?? 0.8; g.run.godTaint = true;
      if (opts.hits) { p.hurtFlash = 0.15; g.shake(0.25); sfx('hurt', { vol: 0.35 }); g.floaters.add(p.x, p.y - 120, 'Бессмертие', { color: '#ffd166', size: 16 }); g.lastGodHit = why; }
      return true;
    },
    blocksAch: (run) => !!run?.godTaint,
    canSubmitScore: () => !enabled,
    // хитбоксы (в мировых координатах боя, поверх мира, под HUD)
    drawBattle(ctx, g) {
      if (!enabled || !opts.boxes || !g.p) return;
      ctx.save(); ctx.lineWidth = 2;
      const circ = (x, y, r, col) => { if (!(r > 0)) return; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
      const pb = playerBox(g.p); ctx.strokeStyle = '#5ee6c8'; ctx.strokeRect(pb.x, pb.y, pb.w, pb.h);
      for (const e of g.enemies) if (!e.dead) circ(e.x, e.y, e.r * (e.type === 'bloat' ? 0.82 : 0.9) * (g.A?.hit ?? 1), e.immune ? '#999' : '#ff4a5a');
      if (g.boss && !g.boss.dead && !g.boss.virtual) circ(g.boss.x, g.boss.y, g.boss.r, '#ffd166');
      for (const s of g.shots) circ(s.x, s.y, s.r, '#8cf');
      for (const f of g.foes) circ(f.x, f.y, f.r, '#fa4');
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(view.W, GROUND); ctx.stroke();
      ctx.restore();
    },
    frozen: () => enabled && open,
    tick(rdt) {
      if (!flag) return;   // режим не заказан (нет ?god=1): ни DOM, ни таймеров, ни работы в кадре
      const blocked = platformBlocked();
      const on = flag && !blocked;
      if (on !== enabled) setEnabled(on);
      if (!enabled) return;
      if (opts.touch !== null) inp.isTouch = !!opts.touch;   // симуляция тача / десктопа (input.js сам сбрасывает флаг по событиям мыши)
      if (live() && (opts.immortal || opts.dmg !== 1 || opts.speed !== 1 || opts.time !== 1 || opts.hpAdd)) G.run.godTaint = true;
      hudAcc += rdt;
    },
    openPanel(tab) { if (!enabled) return false; if (tab) ui.tab = tab; openPanel(); return true; },
    closePanel: () => closePanel(),
    render: () => render(),
    resolve: resolveGod, platformBlocked,
  };
  app.canSubmitScore = api.canSubmitScore;
  // множитель времени: поверх game.timeScale (play.js сам ставит 0,25 при гибели босса и 1 после — это «база»)
  if (flag) { let base = game.timeScale ?? 1; Object.defineProperty(game, 'timeScale', { configurable: true, get() { return base * (enabled ? opts.time : 1); }, set(v) { base = v; } }); }

  // ---------- DOM: стили, корень, жетон ----------
  const css = `
#god-badge{position:fixed;z-index:900;right:max(6px,env(safe-area-inset-right));top:58%;width:52px;height:44px;margin:0;padding:0;border-radius:12px;border:2px solid #ffd166;background:rgba(40,12,48,.8);color:#ffd166;font:900 15px/1 Nunito,"Trebuchet MS",system-ui,sans-serif;letter-spacing:1px;touch-action:none;opacity:.82;cursor:pointer;-webkit-tap-highlight-color:transparent}
#god-badge[hidden],#god-root[hidden],#god-hud[hidden]{display:none}
#god-hud{position:fixed;z-index:880;left:50%;transform:translateX(-50%);bottom:max(4px,env(safe-area-inset-bottom));max-width:96vw;padding:3px 9px;border-radius:9px;background:rgba(14,6,18,.72);color:#f3e2c0;font:800 12px/1.25 Nunito,system-ui,sans-serif;pointer-events:none;text-align:center;white-space:nowrap}
#god-root{position:fixed;inset:0;z-index:1000;background:rgba(14,5,20,.97);color:#ffe6ef;font:700 17px/1.3 Nunito,"Trebuchet MS",system-ui,sans-serif;user-select:text;-webkit-user-select:text;touch-action:pan-y}
#god-root *{box-sizing:border-box}
#god-root .g-shell{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"head" "tabs" "main";padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#god-root .g-head{grid-area:head;display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:2px solid #4a1a44}
#god-root .g-title{font-weight:900;color:#ffd166;letter-spacing:1px;white-space:nowrap}
#god-root .g-info{flex:1;min-width:0;font-size:14px;color:#ffd0dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#god-root .g-tabs{grid-area:tabs;display:flex;gap:6px;padding:8px 10px;overflow-x:auto;border-bottom:2px solid #4a1a44}
#god-root .g-tab{flex:1 1 0;min-width:0;min-height:48px;padding:0 4px;border-radius:12px;border:2px solid #5a2a52;background:#2a1030;color:#ffe6ef;font:900 clamp(14px,4.1vw,17px) Nunito,system-ui,sans-serif;cursor:pointer}
#god-root .g-tab[aria-selected=true]{background:#ff5d8f;border-color:#ffd0dc;color:#fff}
#god-root .g-main{grid-area:main;display:flex;flex-direction:column;min-height:0;min-width:0}
#god-root .g-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px 12px 24px}
#god-root .g-status{min-height:34px;padding:6px 12px;border-top:2px solid #4a1a44;background:#1c0a24;color:#5ee6c8;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#god-root .g-sec{margin:0 0 16px;padding:10px 12px 12px;border-radius:14px;background:#22102b;border:2px solid #3e1a3a}
#god-root h3{margin:0 0 8px;font:900 18px Nunito,system-ui,sans-serif;color:#ffd166}
#god-root h4{margin:10px 0 6px;font:900 16px Nunito,system-ui,sans-serif;color:#ffb0c8}
#god-root .g-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}
#god-root .g-lbl{min-width:96px;font-weight:900;color:#ffd0dc}
#god-root .gb{min-height:46px;min-width:46px;padding:6px 14px;border-radius:12px;border:2px solid #6a2a5e;background:#3a1a40;color:#fff;font:800 17px Nunito,system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
#god-root .gb:active{transform:translateY(1px)}
#god-root .gb[aria-pressed=true],#god-root .gb.on{background:#ff5d8f;border-color:#ffd0dc}
#god-root .gb.mint{background:#176a58;border-color:#5ee6c8}
#god-root .gb.danger{background:#7a1228;border-color:#ff6a85}
#god-root .gb[disabled]{opacity:.38;cursor:default}
#god-root .gb.lv{min-width:46px;padding:6px 0}
#god-root .g-item{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid #3e1a3a}
#god-root .g-item:first-of-type{border-top:0}
#god-root .g-name{font-weight:900;flex:1 1 180px}
#god-root .g-name small{display:block;font-weight:700;font-size:14px;color:#c9a0c0}
#god-root .tag{display:inline-block;margin-left:6px;padding:0 6px;border-radius:7px;background:#4a1a44;color:#ffd166;font-size:13px;font-weight:900}
#god-root .g-note{margin:6px 0;color:#c9a0c0;font-size:15px}
#god-root .g-warn{margin:6px 0 10px;padding:8px 10px;border-radius:10px;background:#4a1a24;border:2px solid #ff6a85;color:#ffd0d8}
#god-root textarea{width:100%;min-height:110px;padding:8px;border-radius:10px;border:2px solid #6a2a5e;background:#14061a;color:#ffe6ef;font:600 14px/1.3 ui-monospace,Consolas,monospace;user-select:text;-webkit-user-select:text}
#god-root canvas.g-prev{position:static;left:auto;top:auto;display:block;width:100%;max-width:640px;border-radius:12px;background:#14061a}
#god-root .g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0 18px}
@media (max-width:520px){ #god-root .g-lbl{flex:1 0 100%;min-width:0;margin-bottom:-2px} #god-root .gb{padding:6px 12px} }
@media (orientation:landscape){
 #god-root .g-shell{grid-template-columns:min(210px,30vw) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"head main" "tabs main"}
 #god-root .g-head{border-bottom:0;border-right:2px solid #4a1a44;flex-wrap:wrap;gap:4px 10px}
 #god-root .g-info{flex-basis:100%;white-space:normal;font-size:13px}
 #god-root .g-tabs{flex-direction:column;overflow-x:hidden;overflow-y:auto;border-bottom:0;border-right:2px solid #4a1a44}
 #god-root .g-tab{flex:0 0 auto;text-align:left}
 #god-badge{top:44%}
}
@media (orientation:landscape) and (max-height:520px){ #god-root .g-info{display:none} #god-root .g-head{padding:6px 8px} #god-root .g-tabs{gap:4px;padding:6px 8px} #god-root .g-tab{min-height:46px} }
#god-root .g-body>*{max-width:1100px}`;
  const style = h('style', { id: 'god-css' }); style.textContent = css;
  const els = {};
  els.badge = h('button', { id: 'god-badge', type: 'button', 'aria-label': 'DEV: открыть панель режима бога', hidden: true }, 'DEV');
  els.hud = h('div', { id: 'god-hud', hidden: true });
  els.root = h('div', { id: 'god-root', role: 'dialog', 'aria-label': 'Панель DEV', hidden: true });
  els.info = h('span', { class: 'g-info' });
  els.status = h('div', { class: 'g-status', role: 'status' });
  els.body = h('div', { class: 'g-body' });
  els.tabs = h('nav', { class: 'g-tabs', role: 'tablist' });
  els.root.append(h('div', { class: 'g-shell' },
    h('header', { class: 'g-head' }, h('span', { class: 'g-title' }, 'DEV'), els.info, h('button', { class: 'gb', type: 'button', id: 'g-close', 'aria-label': 'Закрыть панель', onclick: () => closePanel() }, '✕')),
    els.tabs, h('div', { class: 'g-main' }, els.body, els.status)));
  // панель — не часть игры: клавиши, жесты и выделение не должны доходить до обработчиков игры (input.js, core.js)
  for (const ev of ['keydown', 'keyup']) els.root.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closePanel(); });
  for (const ev of ['touchmove', 'wheel', 'selectstart', 'dragstart', 'dblclick', 'gesturestart', 'gesturechange']) els.root.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  els.root.addEventListener('pointerdown', e => e.stopPropagation());

  let started = false;
  function start() {   // всё «тяжёлое» (DOM, таймеры, слушатели) — только когда режим заказан ссылкой
    if (started) return; started = true;
    document.head.append(style); document.body.append(els.badge, els.hud, els.root);
    requestAnimationFrame(t => { fpsT = t; requestAnimationFrame(loop); });
    setInterval(() => { if (enabled && !els.hud.hidden) els.hud.textContent = hudText(); if (open) liveInfo(); }, 400);
  }
  // жетон: тап открывает панель, перетаскивание двигает (чтобы не мешал HUD и кнопкам); позиция запоминается
  function placeBadge(fx, fy) {
    const b = els.badge, W = innerWidth, Hh = innerHeight, w = 52, hh = 44;
    b.style.left = clamp(fx * W, 4, W - w - 4) + 'px'; b.style.top = clamp(fy * Hh, 4, Hh - hh - 4) + 'px'; b.style.right = 'auto';
  }
  try { const p = JSON.parse(store.get(GOD_KEYS.pos) || 'null'); if (p && isFinite(p.x) && isFinite(p.y)) queueMicrotask(() => placeBadge(p.x, p.y)); } catch { }
  { let d = null;
    els.badge.addEventListener('pointerdown', e => { e.stopPropagation(); d = { x: e.clientX, y: e.clientY, moved: false, r: els.badge.getBoundingClientRect() }; els.badge.setPointerCapture?.(e.pointerId); });
    els.badge.addEventListener('pointermove', e => { if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.hypot(dx, dy) < 8) return; d.moved = true; placeBadge((d.r.left + dx) / innerWidth, (d.r.top + dy) / innerHeight); });
    els.badge.addEventListener('pointerup', e => { if (!d) return; const m = d.moved, r = els.badge.getBoundingClientRect(); d = null; if (m) store.set(GOD_KEYS.pos, JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight })); else openPanel(); });
    els.badge.addEventListener('pointercancel', () => { d = null; });
    els.badge.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPanel(); } else e.stopPropagation(); });
    addEventListener('resize', () => { if (els.badge.style.left) { const r = els.badge.getBoundingClientRect(); placeBadge(r.left / innerWidth, r.top / innerHeight); } });
  }

  // ---------- Показ FPS и вида ----------
  let hudAcc = 0, frames = 0, fpsT = 0, fpsVal = 0;
  function applyHud() { els.hud.hidden = !(enabled && (opts.fps || opts.info)); }
  function hudText() {
    const v = view, parts = [];
    if (opts.fps) parts.push(`FPS ${fpsVal}`);
    if (opts.info) parts.push(`вид ${v.W}×${v.H} · ${v.portrait ? 'портрет' : 'ландшафт'} · DPR ${v.dpr} · scale ${v.scale.toFixed(2)} · ui ${v.uiScale.toFixed(2)} · окно ${v.vw}×${v.vh}${inp.isTouch ? ' · тач' : ''}`);
    return parts.join(' · ');
  }
  function loop(now) {
    requestAnimationFrame(loop);
    frames++; if (now - fpsT >= 500) { fpsVal = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; if (!els.hud.hidden) els.hud.textContent = hudText(); }
  }
  function liveInfo() {
    const R = G.run, bits = [];
    if (live()) bits.push(`♥ ${G.p.hp}/${G.stats.maxHp}`, `ур. ${R.level}`, `${CHAPTERS[R.chapter].name}`, PHASE_RU[G.phase] || G.phase); else bits.push('вне боя');
    bits.push(`конфеты ${save.candies || 0}`, `стразы ${gemsNow()}`); els.info.textContent = bits.join(' · ');
  }
  function applyTouch() { if (opts.touch === null) return; inp.isTouch = !!opts.touch; }

  // ---------- Включение / выключение ----------
  function setEnabled(on) {
    enabled = on; if (on) start(); els.badge.hidden = !on;
    if (!on) { closePanel(); stopPreview(); }
    applyHud();
  }
  function openPanel() {
    if (!enabled || open) return;
    open = true; inp.resetTouches?.(); inp.gameplay = false; els.root.hidden = false; els.badge.hidden = true; render(); els.body.scrollTop = 0; liveInfo();
  }
  function closePanel() {
    if (!open) return; open = false; els.root.hidden = true; els.badge.hidden = !enabled; stopPreview(); inp.resetTouches?.();
  }

  // ---------- Компоненты панели ----------
  const say = (m) => status(m);
  function btn(label, fn, o = {}) {
    return h('button', {
      type: 'button', class: ['gb', o.cls, o.on ? 'on' : '', o.danger ? 'danger' : '', o.lv ? 'lv' : ''].filter(Boolean).join(' '), 'data-g': o.id, disabled: o.disabled, title: o.title,
      'aria-pressed': o.pressed === undefined ? undefined : String(!!o.pressed),
      onclick: () => { try { sfx('select', { vol: 0.3 }); } catch { } try { fn(); } catch (e) { console.error(e); say('Ошибка: ' + (e.message || e)); } render(); },
    }, label);
  }
  const toggle = (label, id, on, set) => btn(label + (on ? ': вкл' : ': выкл'), () => set(!on), { id, pressed: on });
  const row = (...k) => h('div', { class: 'g-row' }, k);
  const lblRow = (label, ...k) => h('div', { class: 'g-row' }, h('span', { class: 'g-lbl' }, label), k);
  const sec = (title, ...k) => h('section', { class: 'g-sec' }, h('h3', {}, title), k);
  const note = (t) => h('p', { class: 'g-note' }, t);
  const chips = (idp, vals, cur, set, o = {}) => vals.map(([v, l]) => btn(l, () => set(v), { id: idp + ':' + v, pressed: cur === v, disabled: o.disabled }));
  const needLive = () => live() ? null : h('div', { class: 'g-warn' }, 'Бой не идёт: эти кнопки работают только в бою. ', btn('Начать бой: глава 1', () => A.startChapter(0), { id: 'start-battle', cls: 'mint' }));

  // ---------- Вкладка «Бой» ----------
  function tabBattle() {
    const L = live(), off = !L;
    return [
      needLive(),
      sec('Защита и урон',
        row(toggle('Бессмертие', 'imm', opts.immortal, v => { A.setOpt('immortal', v); say(v ? 'Бессмертие включено: попадания видны, сердца целы' : 'Бессмертие выключено'); }),
          toggle('Показ попаданий', 'hits', opts.hits, v => A.setOpt('hits', v))),
        lblRow('Урон', chips('dmg', [[1, '×1'], [3, '×3'], [10, '×10'], [99999, '1 удар']], opts.dmg, v => { A.setOpt('dmg', v); say('Множитель урона: ' + (v === 99999 ? 'убивать с одного удара' : '×' + v)); })),
        lblRow('Бег', chips('spd', [[1, '×1'], [1.5, '×1,5'], [2, '×2'], [3, '×3']], opts.speed, v => A.setOpt('speed', v))),
        lblRow('Время', chips('time', [[0.25, '0,25×'], [0.5, '0,5×'], [1, '1×'], [2, '2×']], opts.time, v => A.setOpt('time', v)))),
      sec('Сердца, уровень, валюта',
        lblRow('Сердца', btn('−', () => A.hearts(-1), { id: 'hp-', disabled: off }), btn('+', () => A.hearts(1), { id: 'hp+', disabled: off }), btn('Полное', () => A.hearts('full'), { id: 'hp-full', disabled: off }),
          h('span', {}, L ? `${G.p.hp}/${G.stats.maxHp}` : '')),
        lblRow('Уровень', btn('+1 уровень', () => A.levels(1), { id: 'lv+1', disabled: off }), btn('+5 уровней', () => A.levels(5), { id: 'lv+5', disabled: off }),
          btn('Следующая карточка', () => { if (!A.nextCard()) say('Карточка открывается в бою между экранами'); }, { id: 'card', disabled: off })),
        lblRow('Конфеты', btn('+100', () => A.candies(100), { id: 'candy+100' }), btn('+1000', () => A.candies(1000), { id: 'candy+1000' }), h('span', {}, `сейчас ${save.candies || 0}`)),
        lblRow('Стразы', btn('+100', () => A.gems(100), { id: 'gem+100' }), btn('+1000', () => A.gems(1000), { id: 'gem+1000' }), h('span', {}, `сейчас ${gemsNow()}`))),
      sec('Показ',
        row(toggle('FPS', 'fps', opts.fps, v => A.setOpt('fps', v)), toggle('Размер вида / DPR', 'info', opts.info, v => A.setOpt('info', v))),
        row(toggle('Хитбоксы', 'boxes', opts.boxes, v => A.setOpt('boxes', v)), toggle('Скрыть HUD', 'nohud', opts.noHud, v => A.setOpt('noHud', v))),
        note('Читы сохраняют метку в сейве (godUsed), а забег с читами не даёт достижений.'),
        row(btn('Сбросить читы', () => { Object.assign(opts, DEF_OPTS); saveOpts(); recalc(); applyHud(); say('Читы сброшены'); }, { id: 'opts-reset' }))),
    ];
  }

  // ---------- Вкладка «Сборка» ----------
  function lvChips(kind, id, max, cur, give, take) {
    const out = [];
    for (let l = 1; l <= max; l++) out.push(btn(String(l), () => give(id, l), { id: `${kind}:${id}:${l}`, pressed: cur === l, lv: true, disabled: !live() }));
    out.push(btn('✕', () => take(id), { id: `${kind}-rm:${id}`, disabled: !live() || !cur, lv: true, title: 'снять' }));
    return out;
  }
  function tabBuild() {
    const R = live() ? G.run : null;
    const tier = d => d.rare || d.tier === 'rare' ? h('span', { class: 'tag' }, '★ редкое') : null;
    const wBase = Object.keys(WEAPONS).filter(k => !WEAPONS[k].evolved), wEvo = Object.keys(WEAPONS).filter(k => WEAPONS[k].evolved);
    const wItem = (id) => {
      const d = WEAPONS[id], cur = R?.weapons.find(w => w.id === id)?.lv || 0;
      const ctl = d.evolved
        ? [btn(cur ? 'Выдано' : 'Выдать', () => A.giveWeapon(id, 1), { id: `w:${id}:1`, pressed: !!cur, disabled: !R }), btn('✕', () => A.takeWeapon(id), { id: `w-rm:${id}`, disabled: !R || !cur, lv: true })]
        : lvChips('w', id, d.lv.length, cur, A.giveWeapon, A.takeWeapon);
      return h('div', { class: 'g-item' }, h('div', { class: 'g-name' }, d.name, tier(d), d.locked ? h('span', { class: 'tag' }, 'закрыто в игре') : null, h('small', {}, d.evolved ? 'эволюция' : `пара: ${PASSIVES[d.pair]?.name || '—'}`)), h('div', { class: 'g-row' }, ctl));
    };
    const pIds = Object.keys(PASSIVES), pDef = pIds.filter(k => PASSIVES[k].def), pRest = pIds.filter(k => !PASSIVES[k].def);
    const pItem = (id) => {
      const d = PASSIVES[id], cur = R?.passives.find(p => p.id === id)?.lv || 0;
      return h('div', { class: 'g-item' }, h('div', { class: 'g-name' }, d.name, tier(d), d.def ? h('span', { class: 'tag' }, 'защита') : null, h('small', {}, d.desc.length > 70 ? d.desc.slice(0, 68) + '…' : d.desc)), h('div', { class: 'g-row' }, lvChips('p', id, d.max, cur, A.givePassive, A.takePassive)));
    };
    const cur = R ? [
      ...R.weapons.map(w => h('div', { class: 'g-item' }, h('div', { class: 'g-name' }, WEAPONS[w.id].name, h('small', {}, WEAPONS[w.id].evolved ? 'эволюция' : `оружие, ур. ${w.lv} из ${WEAPONS[w.id].lv.length}`)), btn('убрать', () => A.takeWeapon(w.id), { id: `cur-w:${w.id}` }))),
      ...R.passives.map(p => h('div', { class: 'g-item' }, h('div', { class: 'g-name' }, PASSIVES[p.id].name, h('small', {}, `пассивка, ур. ${p.lv} из ${PASSIVES[p.id].max}`)), btn('убрать', () => A.takePassive(p.id), { id: `cur-p:${p.id}` }))),
    ] : [note('Сборка видна в бою.')];
    return [
      needLive(),
      sec('Текущая сборка', cur, row(btn('Стартовое оружие', () => A.giveWeapon('tampon', 1), { id: 'start-weapon', disabled: !R }), btn('Сбросить сборку', () => A.resetBuild(), { id: 'reset-build', danger: true, disabled: !R }))),
      sec('Оружие (выбери уровень)', h('div', { class: 'g-grid' }, wBase.map(wItem)), h('h4', {}, 'Эволюции'), h('div', { class: 'g-grid' }, wEvo.map(wItem))),
      sec('Защитные пассивки', h('div', { class: 'g-grid' }, pDef.map(pItem))),
      sec('Остальные пассивки', h('div', { class: 'g-grid' }, pRest.map(pItem))),
    ];
  }

  // ---------- Вкладка «Глава» ----------
  function tabChapter() {
    const L = live(), off = !L, last = L ? G.run.chapter : -1;
    const chapBtns = (idp, fn, keep) => CHAPTERS.map((c, i) => btn(`${i + 1}. ${c.name}`, () => fn(i), { id: idp + ':' + i, disabled: keep && i === 0 }));
    return [
      sec('Начать главу',
        h('div', { class: 'g-note' }, 'Новый забег с контрольной точки (как «Продолжить» из меню).'), row(chapBtns('ch', i => A.startChapter(i))),
        h('h4', {}, 'Сразу к боссу'), row(chapBtns('boss', i => A.startChapter(i, { boss: true }))),
        h('h4', {}, 'Продолжить текущий забег в главу (со сборкой)'), row(chapBtns('cont', i => A.startChapter(i, { keep: true }), true))),
      sec('Текущий бой', needLive(),
        row(btn('Пропустить волну', () => A.skipWave(), { id: 'skip-wave', disabled: off }), btn('К последней волне', () => A.lastWave(), { id: 'last-wave', disabled: off }),
          btn('Призвать босса', () => A.summonBoss(), { id: 'boss-now', disabled: off }), btn('Победить босса', () => { if (!A.killBoss()) say('Босса сейчас нет'); }, { id: 'boss-kill', disabled: off }),
          btn('Выбор Руды', () => A.rudaChoice(), { id: 'ruda', disabled: off })),
        row(btn('Итоги главы', () => A.clearScreen(), { id: 'clear', disabled: off }), btn('Итоги: Обнять', () => A.clearScreen('hug'), { id: 'clear-hug', disabled: off }), btn('Итоги: Добить', () => A.clearScreen('war'), { id: 'clear-war', disabled: off }),
          btn('Сундук', () => A.chest(), { id: 'chest', disabled: off }), btn('«Что взять с собой?»', () => A.carry(), { id: 'carry', disabled: off })),
        lblRow('Экран смерти', [[1, '1-я'], [2, '2-я'], [3, '3-я'], [10, '10-я']].map(([n, l]) => btn(l, () => A.death(n), { id: 'die:' + n, disabled: off })),
          h('span', { class: 'g-note' }, 'меняет счётчик смертей (сейв)')),
        L ? note(`${CHAPTERS[last].name}, волна ${G.run.wave + 1}/${CHAPTERS[last].waves.length}, фаза «${G.phase}»`) : null),
      sec('Враги', needLive(),
        row(...Object.keys(ENEMIES).map(t => btn(ENEMY_NAMES[t] || t, () => { ui.enemy = t; }, { id: 'en:' + t, pressed: ui.enemy === t, disabled: off }))),
        lblRow('Сколько', chips('cnt', [[1, '1'], [3, '3'], [5, '5'], [10, '10']], ui.count, v => { ui.count = v; }, { disabled: off })),
        row(btn('Создать', () => { const n = A.spawn(ui.enemy, ui.count); say(n ? `Создано: ${n} × ${ENEMY_NAMES[ui.enemy] || ui.enemy}` : 'Не создано (Вздутие — только в бою с боссом-томатом)'); }, { id: 'en-spawn', cls: 'mint', disabled: off }),
          btn('Убрать всех', () => A.clearEnemies(), { id: 'en-clear', disabled: off }))),
      sec('Сюжетные сцены',
        row(...Object.keys(STORY).map(k => btn(`${k}`, () => A.story(k), { id: 'story:' + k, title: CAPTION[k] || k }))),
        note('Сцена заканчивается возвратом в меню; пропуск — кнопкой или Esc.')),
      sec('Экраны меню',
        row(btn('Меню', () => A.menuView('main'), { id: 'menu:main' }), btn('Косметичка', () => A.menuView('shop'), { id: 'menu:shop' }), btn('Достижения', () => A.menuView('ach'), { id: 'menu:ach' }),
          btn('Гардероб', () => A.menuView('wardrobe', { tab: 'outfits' }), { id: 'menu:wardrobe' }), btn('Аксессуары', () => A.menuView('wardrobe', { tab: 'acc' }), { id: 'menu:acc' }))),
    ];
  }

  // ---------- Вкладка «Наряды» ----------
  let prev = null;
  function stopPreview() { if (prev) { prev.stop = true; prev = null; } }
  function startPreview(cv) {
    stopPreview(); const me = prev = { stop: false };
    const cells = [['Постер', 'key'], ['Бой · лицом', 'aim', 'front'], ['Бой · спиной', 'aim', 'back'], ['Бег · лицом', 'run', 'front'], ['Бег · спиной', 'run', 'back'], ['Говорит', 'talk']];
    const t0 = performance.now();
    const frame = () => {
      if (me.stop || !cv.isConnected || !open) return; requestAnimationFrame(frame);
      const dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth || 320, cols = cw >= 520 ? 3 : 2, rows = Math.ceil(cells.length / cols), ch = rows * 210;
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.height = ch + 'px'; }
      const c = cv.getContext('2d'), t = (performance.now() - t0) / 1000, outfit = save.outfit || 'lara', cwid = cw / cols;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, cw, ch);
      cells.forEach(([label, kind, face], i) => {
        const x0 = (i % cols) * cwid, y0 = Math.floor(i / cols) * 210, cx = x0 + cwid / 2, fy = y0 + 178;
        c.fillStyle = i % 2 ? '#1c0a24' : '#22102b'; c.fillRect(x0, y0, cwid, 210);
        c.fillStyle = 'rgba(255,209,102,.18)'; c.beginPath(); c.ellipse(cx, fy + 2, 46, 8, 0, 0, 7); c.fill();
        let ok = false;
        try {
          if (kind === 'key') ok = drawHeroineKey(c, cx + 6, fy, 168, outfit, { t });
          else if (kind === 'talk') { ok = drawHeroineVec(c, cx, fy, 130, { kind: 'talk', t }, { outfit }); drawHeroinePortrait(c, cx + 36, y0 + 52, 40, outfit); }
          else ok = drawHeroineVec(c, cx, fy, 130, { kind, t, u: (t * 1.2) % 1, facing: face, aim: true }, { outfit });
        } catch (e) { ok = false; }
        if (!ok) { c.fillStyle = '#c9a0c0'; c.font = '700 14px Nunito,system-ui'; c.textAlign = 'center'; c.fillText('загрузка…', cx, y0 + 100); }
        c.fillStyle = '#ffd0dc'; c.font = '800 15px Nunito,system-ui'; c.textAlign = 'center'; c.fillText(label, cx, y0 + 202);
      });
    };
    requestAnimationFrame(frame);
  }
  function tabWardrobe() {
    const g = save.godGrants || {}, all = !!g.all, face = facingOf(save), cur = save.outfit || 'lara';
    for (const w of WARDROBE) { loadHeroineVec(w.id); loadHeroineKey(w.id); loadHeroineBack(w.id); }
    const got = ACHIEVEMENTS.filter(a => save.ach[a.id]).length;
    const cv = h('canvas', { class: 'g-prev', 'data-g': 'preview', width: 320, height: 420 });
    queueMicrotask(() => startPreview(cv));
    return [
      sec('Всё открыто',
        row(toggle('Все наряды и аксессуары «куплены»', 'unlock-all', all, v => { A.unlockAll(v); say(v ? 'Всё открыто (флаг «god», можно отключить)' : 'Флаги god убраны'); })),
        note(`Аксессуаров в каталоге: ${ACCESSORIES.length}. Отключение убирает только то, что выдал режим бога.`)),
      sec('Наряд и поза',
        lblRow('Наряд', ...WARDROBE.map(w => btn(w.name, () => A.wear(w.id), { id: 'wear:' + w.id, pressed: cur === w.id }))),
        lblRow('Поза в бою', btn('Лицом', () => A.pose('front'), { id: 'pose:front', pressed: face === 'front' }), btn('Спиной', () => A.pose('back'), { id: 'pose:back', pressed: face === 'back' })),
        note('«Спиной» открывается флагом god (в сейве отметка достижения «Ледяная королева»; отключается в «Всё открыто»).'),
        row(btn('Открыть Гардероб', () => A.menuView('wardrobe', { tab: 'outfits' }), { id: 'open-wardrobe' }), btn('Аксессуары', () => A.menuView('wardrobe', { tab: 'acc' }), { id: 'open-acc' }))),
      sec('Героиня в позах (текущий наряд)', cv),
      sec(`Достижения ${got}/${ACHIEVEMENTS.length}`,
        row(btn('Открыть все', () => { A.achAll(true); say('Все достижения открыты (без стразов)'); }, { id: 'ach-all' }), btn('Сбросить все', () => { A.achAll(false); say('Все достижения сброшены'); }, { id: 'ach-none', danger: true })),
        h('div', { class: 'g-grid' }, ACHIEVEMENTS.map(a => h('div', { class: 'g-item' }, h('div', { class: 'g-name' }, a.secret ? 'Секрет' : a.name, h('small', {}, a.secret ? '???' : a.desc)),
          btn(save.ach[a.id] ? 'Сбросить' : 'Открыть', () => A.ach(a.id, !save.ach[a.id]), { id: 'ach:' + a.id, pressed: !!save.ach[a.id] }))))),
    ];
  }

  // ---------- Вкладка «Сейв» ----------
  function tabSave() {
    const bk = store.get(GOD_KEYS.backup), at = +store.get(GOD_KEYS.backupAt) || 0;
    const L = save.godLog?.what ? Object.entries(save.godLog.what).map(([k, v]) => `${k}×${v}`).join(', ') : '—';
    const confirmRow = (what, label, fn) => ui.confirm === what
      ? row(h('span', { class: 'g-lbl' }, 'Точно?'), btn('Да, ' + label, fn, { id: what + '-yes', danger: true }), btn('Отмена', () => { ui.confirm = null; }, { id: what + '-no' }))
      : row(btn(label[0].toUpperCase() + label.slice(1), () => { ui.confirm = what; }, { id: what, danger: true }));
    const ta = h('textarea', { 'data-g': 'ta', id: 'g-ta', spellcheck: 'false', autocomplete: 'off', placeholder: 'Сюда вставь JSON сейва для импорта', oninput: e => { ui.ta = e.target.value; } });
    ta.value = ui.ta;
    return [
      sec('Честность',
        note(`Метка чита в сейве: ${save.godUsed ? 'ДА (godUsed)' : 'нет'}. Что именно: ${L}.`),
        note(bk ? `Бэкап до режима бога: ${at ? new Date(at).toLocaleString('ru-RU') : 'есть'}.` : 'Бэкапа пока нет (создаётся перед первым чит-изменением).'),
        confirmRow('restore', 'восстановить сейв до режима бога', () => { ui.confirm = null; if (!A.restore()) say('Бэкапа нет'); else say('Восстанавливаю…'); }),
        note('Рекорды в лидерборд не отправляются, пока режим включён; забег с читами не даёт достижений.')),
      sec('Прогресс',
        confirmRow('reset', 'сбросить весь прогресс', () => { ui.confirm = null; say('Сбрасываю…'); A.resetSave(); }),
        row(btn('Симулировать первый запуск', () => { A.firstRun(); say('Первый запуск: забегов 0, туториал заново, история заново'); }, { id: 'firstrun' })),
        note('Не трогает достижения, косметичку и аксессуары: только счётчики и подсказки.')),
      sec('Экспорт и импорт',
        row(btn('Скопировать сейв', async () => {
          const txt = A.exportText(); ui.ta = txt; ta.value = txt;
          let ok = false;
          const pr = navigator.clipboard?.writeText?.(txt);   // вызов — прямо внутри клика (иначе браузер откажет)
          try { await pr; ok = !!pr; } catch { }
          const t2 = els.body.querySelector('#g-ta') || ta;   // после клика панель перерисовалась — берём свежее поле
          if (!ok) { try { t2.focus(); t2.select(); ok = document.execCommand?.('copy') || false; } catch { } }
          say(ok ? 'Сейв скопирован в буфер (поле ниже — на случай сбоя)' : 'Буфер недоступен: сейв выделен в поле, скопируй вручную'); if (!ok) { t2.focus(); t2.select(); }
        }, { id: 'export' })),
        ta,
        row(btn('Импортировать из поля', () => { const err = A.importText(ta.value || ui.ta); say(err ? 'Ошибка импорта: ' + err : 'Сейв загружен, перезапускаю…'); }, { id: 'import', cls: 'mint' }))),
      sec('Симуляция устройства',
        lblRow('Ввод', btn('Авто', () => A.setOpt('touch', null), { id: 'touch:auto', pressed: opts.touch === null }), btn('Тач', () => A.setOpt('touch', true), { id: 'touch:on', pressed: opts.touch === true }), btn('Десктоп', () => A.setOpt('touch', false), { id: 'touch:off', pressed: opts.touch === false })),
        note(`Сейчас inp.isTouch = ${inp.isTouch}. Тач включает сенсорную помощь, кнопку паузы и подсказки тача.`)),
    ];
  }

  const RENDER = { battle: tabBattle, build: tabBuild, chapter: tabChapter, wardrobe: tabWardrobe, save: tabSave };
  function render() {
    if (!open) return;
    const top = els.body.scrollTop;
    const keepTa = document.activeElement?.id === 'g-ta';
    stopPreview();
    els.tabs.replaceChildren(...TABS.map(([id, l]) => h('button', { class: 'g-tab', type: 'button', role: 'tab', 'data-g': 'tab:' + id, 'aria-selected': String(ui.tab === id), onclick: () => { ui.tab = id; ui.confirm = null; render(); els.body.scrollTop = 0; } }, l)));
    els.body.replaceChildren(...RENDER[ui.tab]().flat(3).filter(Boolean));
    els.body.scrollTop = top; els.status.textContent = ui.msg || 'Готово. Читы помечают сейв (godUsed).';
    if (keepTa) els.body.querySelector('#g-ta')?.focus();
    liveInfo();
  }

  if (enabled) { start(); els.badge.hidden = false; applyHud(); }
  return api;
}

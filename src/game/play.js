// Сцена боя: волны главы, режиссёр спавна, счётчик капель, урон, комбо, подбор, прокачка, босс, сундук.
import { BASE_STATS, WEAPONS, PASSIVES, ENEMIES, CHAPTERS, META_SHOP, xpToNext, assistFor, CARD_TUNE } from './data.js';
import { createPlayer, updatePlayer, drawPlayer, playerBox, GROUND, ARENA, muzzle } from './player.js';
import { view, onViewChange } from '../engine/core.js';
import { sanitizeWorld } from './viewguard.js';
import { withFrame, fillFull } from '../engine/frame.js';
import { makeEnemy, updateEnemy, drawEnemy } from './enemies.js';
import { updateWeapons, updateShots, drawShots, drawWeaponFx, weaponParams, muzzleColor } from './weapons.js';
import { makeSpasm, updateBoss, drawBoss, drawBossBar } from './boss.js';
import { BLOAT_SIZES, BLOAT_TOTAL, BLOAT_WAVES, BLOAT_MARKS, bloatFutureHp, bloatK, updateFoes, drawFoes } from './chapter2.js';
import { makeQueen, updateOwnFoes, drawOwnFoes, drawGothicAmbient } from './chapter3.js';
import { makeRuda, drawRudaChoice, drawRudaChoiceP, drawLairAmbient } from './finale.js';
import { drawHUD, drawCards, banner, text, button, panel, drawTouchControls, wrap, HUDBOX, withHud } from './ui.js';
import { drawBackground, drawBackgroundView, bgPlace, drawVignette, BG_MAP } from '../art/backgrounds.js';
import { drawSceneBg, preload } from '../art/scenes.js';
import { drawCandy, drawPad, drawPanties, drawTampon, drawCup, drawSplat, drawPumpkin, drawStar, PAL } from '../art/sprites.js';
import { drawChest, drawIcon } from '../art/icons.js';
import { Particles, Floaters, Tweens, rand, randi, pick, clamp, weighted, shuffle, TAU } from '../engine/util.js';
import { sfx, playMusic, setMusicIntensity } from '../engine/audio.js';
import { createBarks, DEATH_LINES, CLEAR_LINES } from './barks.js';
import { newPet, petTarget, updatePet, petReact, petIdle, drawPet, drawPetBubble, PET_NOM } from './pets.js';
import { loadAccVec, preloadAcc } from '../art/accessories.js';
import { rollOffers, consolation, drawGiftLine, ensureOffers, buyOffer, shuffleOffers, drawOfferCard, offerPrice, hasMeta, SHUFFLE_PRICE, revealStart, revealTick, revealSkip, revealDone, revealBought, drawRevealOffers, drawRevealCandies } from './meta.js';
import { PU, BOSS_BONUS, drawBonusFx, drawLipstickGlow, initPowerups, puWaveStart, enemyTimeScale, updatePowerups, puOnKill, puPickup, drawPuToken, drawUmbrella, drawPuScreen, tickPuScreen, drawPuHud } from './powerups.js';
import { drawGrade, drawAmbient } from '../art/post.js';
import { loadHeroineBack } from '../art/heroineVec.js';
import { facingOf } from './achievements.js';
import { drawCardsP, drawPauseP, drawClearP, drawChestHintP } from './overlays_p.js';
import { drawDeathP as drawDeathPortrait } from './death_p.js';
import { carryOpen, carryUpdate, carryApply, drawCarryP, drawCarryL, drawCarryNote } from './carry.js';   // «Что взять с собой?» между главами (docs/iter_carry.md)
import { tutStart, tutUpdate, drawTutorial } from './tutorial.js';

const BELL_SHOTS = new Set(['tampon', 'gatling', 'shot', undefined]);   // таблетки, пар, метла и прочее тыкву не трогают
const HURT_NAMES = { droplet: 'капелька', drop: 'капля', diver: 'пикирующая капля', jelly: 'желе', popcorn: 'попкорн Мисс Спазм', crier: 'капля-плакса', spazm: 'Спазмик', bloat: 'Великое Вздутие', fart: 'облако', spout: 'фонтанчик', ghost: 'Призрак Перепадов', craving: 'Тяга к сладкому' };
const BELL_PRIZE = ['+15 конфет', '+1 ♥', 'Ярость', 'Щит', 'Двойной приз'];
const POPPY_LINES = {
  hurt: ['Ай!', 'Ну вот…', 'Больно же!', 'Эй!'],
  floor: ['Ковёр!', 'Мимо…', 'Фу, пятно'],
  levelup: ['Я крутая!', 'Ещё!', 'Как Лара!'],
};

export function createPlay(app) {
  const G = {};
  let scene_continue = null;

  function computeStats() {
    const s = { ...BASE_STATS };
    for (const m of META_SHOP) { const r = Math.min(m.max, app.save.meta[m.id] || 0); if (r) m.apply(s, r); }
    for (const p of G.run.passives) for (let l = 1; l <= p.lv; l++) PASSIVES[p.id].apply(s, l);
    app.god?.patchStats?.(s);   // режим бога (god.js): скорость бега, запас сердец; без режима — ничего не делает
    G.stats = s; if (G.p) G.p.stats = s;
    return s;
  }

  // Следующая глава в том же забеге: оружие, пассивки и уровень сохраняются, сердца — полные
  function continueRun(chapter) {
    const R = G.run; R.chapter = chapter; R.chapterTime = 0; R.damageTaken = 0;
    G.enemies = []; G.shots = []; G.foes = []; G.pickups = []; G.fx = []; G.stains = [];
    G.tut = null; G.boss = null; G.chest = null; G.fog = 0; G.p.hp = Math.min(G.stats.maxHp, G.p.hp + 2); G.p.dead = false; G.p.x = view.W / 2; G.p.y = GROUND; G.p.vx = 0; G.p.vy = 0;
    preloadChapter(chapter);
    initPowerups(G, app.save.meta); G.flash = 0; G.puTitle = null; G.runStartBark = 'runStart'; G.ceasefire = false;
    startWave(0);
  }
  scene_continue = continueRun;
  // «Что взять с собой?» (carry.js): сразу после continueRun. Улучшений ≤ лимита — плашка «Берёшь всё»; app.autoCarry / scene.autoCarry (тесты, боты) — сразу предвыбор.
  function carryStart() {
    G.carry = null; G.carryNote = null;
    const st = carryOpen(G.run);
    if (st.skip) { if (st.items.length) G.carryNote = { text: 'Берёшь всё', t: 0 }; return; }
    if (scene.autoCarry || app.autoCarry) { carryFinish(st); return; }
    G.carry = st; G.phase = 'carry'; G.phaseT = 0; sfx('levelup', { vol: 0.5 });
  }
  function carryFinish(st) {
    if (!st || st.done) return;   // идемпотентно: второй вызов (клавиша и касание в одном кадре) не начисляет конфеты повторно
    st.done = true;
    const R = G.run, r = carryApply(R, st);
    computeStats(); G.p.hp = Math.min(G.p.hp, G.stats.maxHp);   // уровень, сердца и опыт не трогаем
    if (r.gained > 0) {   // конфеты обмена — как собранные: в конфеты забега и сразу в банк (при смерти / победе второй раз не засчитаются)
      R.candies += r.gained; G.banked = (G.banked || 0) + r.gained; app.save.candies += r.gained; app.persist();
      sfx('coin', { pitch: 1.2 });   // сумму показывает плашка G.carryNote
    }
    G.carryNote = { text: 'Взято с собой', sub: r.gained > 0 ? `+${r.gained} конфет за остальное` : null, t: 0 };
    G.carry = null; if (G.phase === 'carry') { G.phase = 'intro'; G.phaseT = 0; }
    if (!app.save.carryHintDone) { app.save.carryHintDone = true; app.persist(); }
    sfx('select', { pitch: 1.5 });
  }
  function startRun(chapter = 0) {
    G.run = {
      chapter, wave: 0, level: 1, xp: 0, xpNext: xpToNext(1),
      weapons: [{ id: 'tampon', lv: 1 }], passives: [],
      candies: 0, kills: 0, combo: 0, comboT: 0, comboMul: 1, bestCombo: 0, airKills: 0,
      pads: 0, cupCatches: 0, killsBy: {}, counter: 0, counterStart: 0, counterPop: 0, counterBad: 0,
      frenzy: 0, pierceAll: 0, shield: false, twin: {},
      time: 0, chapterTime: 0, damageTaken: 0, waveDamage: 0, floorHits: 0, lastKillY: 0,
      revivesUsed: 0, rerolls: 0, pendingLevels: 0, bellKills: 0, score: 0,
    };
    G.p = createPlayer({ ...BASE_STATS }); G.p.outfit = app.save.outfit || 'lara'; G.p.facing = facingOf(app.save);
    if (G.p.facing === 'back') loadHeroineBack(G.p.outfit);   // поза «спиной» (гардероб); до загрузки — анфас
    G.p.hero = app.save.hero || 'new';   // (QA: оператор раньше был проглочен комментарием выше)
    G.acc = app.save.acc?.equip || {}; G.accTrail = [];   // аксессуары: скин бластера и след выстрела (weapons.js)
    G.petId = G.acc.pet || null; G.pet = G.petId ? newPet() : null; preloadAcc(G.acc);   // рисунки надетого (питомец, скин бластера, заколка, брелок) — заранее
    // питомец (pets.js): только косметика
    computeStats(); G.p.hp = G.stats.maxHp; G.run.rerolls = G.stats.rerolls;
    G.enemies = []; G.shots = []; G.foes = []; G.pickups = []; G.fx = []; G.stains = [];
    G.parts = new Particles(500); G.floaters = new Floaters(); G.tweens = new Tweens();
    G.t = 0; G.trauma = 0; G.fog = 0; G.boss = null; G.freezeAll = 0; G.bubble = null; G.muzzle = 0;
    G.budget = 0; G.nextType = null; G.cornerT = 0; G.padTimer = 14; G.slowmo = 0; G.ceasefire = false;
    preload(['corridor', 'dead', 'victory']);
    G.tut = tutStart(app, chapter);   // микро-туториал: только самый первый забег (до увеличения stats.runs)
    app.save.stats.runs++; app.persist();
    G.run.firstRun = chapter === 0 && app.save.stats.runs <= 1; G.run.sinceRare = 1; G.run.cardN = 0;   // самый первый забег игры: классные карточки чаще (CARD_TUNE.first)
    app.emit({ type: 'runStart' }, G.run);
    // старт с контрольной точки (глава 2+): быстрый набор билда — по 4 повышения за пройденную главу
    if (chapter > 0) { G.run.pendingLevels = chapter * (chapter >= 2 ? 5 : 4);   // готика и финал: билд ближе к сквозному забегу (ур. 20+)
       G.run.candies += 20 * chapter; preloadChapter(chapter); }
    G.banked = 0;
    initPowerups(G, app.save.meta); G.bellCycle = hasMeta(app.save, 'v_festival') ? 5 : 4; G.bark = createBarks(G); G.flash = 0; G.puTitle = null;
    const mem = app.save.barkMem || {};
    G.runStartBark = mem.lastDeathBy === 'jelly' && Math.random() < 0.5 ? 'runStartJelly' : mem.lastWasDeath ? 'runStartRetry' : 'runStart';
    startWave(0);
  }

  const chapter = () => CHAPTERS[G.run.chapter];
  // векторный фон главы (и Руда для финала) — заранее, чтобы не мигал запасной фон
  function preloadChapter(ch) { const c = CHAPTERS[ch]; preload([BG_MAP[c.bg] || 'corridor', ...(c.boss === 'ruda' ? ['ruda'] : [])]); }
  G.waveIndexOf = () => G.run.chapter * 4 + G.run.wave;

  function startWave(i) {
    G.run.wave = i; G.waveIndex = G.waveIndexOf();
    const wv = chapter().waves[i];
    G.run.counter = wv.counter; G.run.counterStart = wv.counter;
    G.run.floorHits = 0; G.run.waveDamage = 0; G.run.waveTime = 0; G.run.goldenDone = false; G.run.goldenAt = null;
    G.introDone = false; G.budget = wv.soft ? 0 : 2; G.nextType = wv.intro;   // мягкий вход: первая капля не сразу, а секунды через две
    G.phase = 'intro'; G.phaseT = 0;
    G.waveLabel = `${chapter().name} · волна ${i + 1} из ${chapter().waves.length}`;
    G.pendingRumor = rumorKey(G.run.chapter, i);   // слух (ненавязчивая подсказка, один раз на сейв)
    G.bannerText = [`Волна ${i + 1}`, wv.hint];
    puWaveStart(G);
    playMusic(chapter().bg === 'street' || chapter().bg === 'lair' ? 'fight2' : 'fight');
  }

  // ---------- Помощники для оружия и врагов ----------
  G.nearest = (x, y) => {
    let best = null, bd = 1e12;
    for (const e of G.enemies) { if (e.noTarget) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd && e.y > -20) { bd = d; best = e; } }
    if (G.boss && !G.boss.virtual && G.boss.state !== 'enter') { const d = (G.boss.x - x) ** 2 + (G.boss.y - y) ** 2; if (d < bd) best = G.boss; }
    return best;
  };
  G.densestX = () => {
    if (G.boss) return G.boss.x;
    if (!G.enemies.length) return G.p.x;
    let best = G.p.x, bc = -1;
    for (const e of G.enemies) { if (e.noTarget) continue; let c = 0; for (const f of G.enemies) if (Math.abs(f.x - e.x) < 80) c++; if (c > bc) { bc = c; best = e.x; } }
    return best;
  };
  G.densestY = (x) => {
    if (G.boss) return G.boss.y;
    let y = 300, n = 0; for (const e of G.enemies) if (Math.abs(e.x - x) < 90) { y += e.y; n++; }
    return n ? clamp((y - 300) / n, 60, GROUND - 42) : 300;
  };
  G.freeze = (s) => app.game.freeze(s);
  G.shake = (a) => { G.trauma = Math.min(1, G.trauma + a); };
  G.say = (s, color = '#fff', style = 'say') => { G.bubble = { s, t: 0, color, style, pri: 1, life: Math.min(3.2, Math.max(1.6, 0.9 + 0.055 * s.length)) }; };

  // Урон врагу: крит, вспышка, склеенные цифры
  G.damage = (e, dmg, src, o = {}) => {
    if (e.dead || e.hp <= 0 || e.immune) return;   // призрак в серой фазе, фонтанчик
    const S = G.stats;
    let crit = false;
    if (app.god?.dmgMul > 1) dmg *= app.god.dmgMul;   // режим бога: множитель урона
    if (G.pu.bmight > 0) dmg *= 1.4;   // микро-бонус между волнами босса
    if (!o.tick && Math.random() < S.crit) { dmg *= S.critMul; crit = true; }
    if (o.shatter && e.slowT > 0) { dmg *= 3; crit = true; }
    e.hp -= dmg; e.hitT = o.tick ? Math.max(e.hitT, 0.02) : 0.06;
    e.dmgAcc = (e.dmgAcc || 0) + dmg;
    if (!e.dmgShowT || G.t > e.dmgShowT || crit) {
      if (app.save.settings.numbers && e.dmgAcc >= 1) G.floaters.add(e.x + rand(-8, 8), e.y - e.r, String(Math.round(e.dmgAcc)), { size: crit ? 22 : 15, color: crit ? '#ffd166' : '#fff', life: 0.6, vy: -70 });
      e.dmgAcc = 0; e.dmgShowT = G.t + 0.1;
    }
    if (e.hp <= 0) G.kill(e, src);
  };
  G.damageBoss = (dmg, src, o = {}) => {
    const b = G.boss; if (!b || b.virtual || b.invuln > 0 || b.state === 'enter' || b.dead) return;
    if (b.eyeT > 0) dmg *= 2;
    if (app.god?.dmgMul > 1) dmg *= app.god.dmgMul;   // режим бога
    if (G.pu.bmight > 0) dmg *= 1.4;
    if (!o.tick && Math.random() < G.stats.crit) dmg *= G.stats.critMul;
    b.hp -= dmg; if (b.minHp && b.hp < b.minHp) b.hp = b.minHp;   // Руда: на 10 % — выбор, а не смерть
    b.hitT = 0.05; G.run.bossDmg = (G.run.bossDmg || 0) + dmg;
    b.dmgAcc = (b.dmgAcc || 0) + dmg;
    if (!b.dmgShowT || G.t > b.dmgShowT) { if (app.save.settings.numbers) G.floaters.add(b.x + rand(-50, 50), b.y + rand(-30, 30), String(Math.round(b.dmgAcc)), { size: 16, color: b.eyeT > 0 ? '#ffd166' : '#fff', life: 0.6 }); b.dmgAcc = 0; b.dmgShowT = G.t + 0.12; }
    if (!o.tick) sfx('bossHit', { vol: 0.3, gap: 0.08 });
    if (b.hp <= 0) bossDie();
  };

  // Лопнуть без награды (удар о Поппи, удар о пол у пикирующих)
  G.pop = (e, reward) => {
    e.dead = true;
    G.parts.burst(e.x, e.y, 6, { color: ['#ff6b8b', '#ffd0dc', '#fff'], speed: [60, 180], g: 500, life: [0.2, 0.45], size: [2, 4], shape: 'star' });
    if (!reward) sfx('pop', { vol: 0.3, pitch: 0.8 });
  };

  G.kill = (e, src) => {
    if (e.dead) return; e.dead = true;
    const R = G.run, S = G.stats;
    R.kills++; app.save.stats.kills++;
    R.killsBy[src] = (R.killsBy[src] || 0) + 1;
    if (e.type === 'fart') app.save.stats.farts++;
    // счётчик
    if (G.phase === 'wave' && e.count) { const k = R.waveTime > 75 ? 2 : 1; R.counter -= e.count * k; R.counterPop = 0.15; R.lastKillY = e.y; }
    // комбо
    R.combo++; R.comboT = 1.5; R.comboMul = Math.min(3, 1 + 0.1 * Math.floor(R.combo / 5)); R.bestCombo = Math.max(R.bestCombo, R.combo);
    if (R.combo % 25 === 0) { G.floaters.add(G.p.x, G.p.y - 140, `Серия ${R.combo}!`, { size: 26, color: '#ffeb7a', life: 1.2 }); sfx('coin', { pitch: 1.5 }); for (let i = 0; i < 5; i++) dropPickup('candy', e.x + rand(-30, 30), e.y, 1); }
    app.emit({ type: 'combo', n: R.combo }, R);
    if (G.pet) { petReact(G.pet, G.petId, 'kill'); if (R.combo === 10 || R.combo === 25 || R.combo === 50) petReact(G.pet, G.petId, 'combo', { n: R.combo }); }
    if (!G.p.onGround) R.airKills++;
    R.score += Math.round(10 * R.comboMul);
    // частицы: конфетти и блёстки вместо крови
    const big = e.type === 'jelly' && e.size <= 1 || e.type === 'fart';
    const col = e.type === 'fart' ? ['#ffd0dc', '#c9b0ff', '#fff'] : e.type === 'diver' ? ['#ff4f8b', '#ffd0dc', '#fff'] : ['#ff3a4a', '#ff8a9a', '#ffd0dc', '#fff'];
    G.parts.burst(e.x, e.y, big ? 16 : e.type === 'drop' ? 10 : 6, { color: col, speed: [80, 260], g: 600, life: [0.3, 0.55], size: [2, 5], shape: Math.random() < 0.5 ? 'star' : 'drop' });
    G.parts.spawn({ x: e.x, y: e.y, shape: 'ring', size: e.r * 0.6, size2: e.r * 1.8, life: 0.25, color: '#fff' });
    G.fx.push({ kind: 'splat', x: e.x, y: e.y, r: e.r, t: 0, life: 0.3, color: e.type === 'fart' ? '#e9c8ff' : '#ff5a6a' });
    sfx(big ? 'popBig' : 'pop', { pitch: 1.4 - Math.min(0.7, e.r / 60), vol: 0.6 });
    if (big) { G.shake(0.15); G.freeze(0.04); }
    // опыт и конфеты
    dropPickup('xp', e.x, e.y, Math.max(1, Math.round(e.xp * (1 + 0.1 * G.waveIndex))));
    if (Math.random() < (e.xp >= 4 ? 0.19 : e.xp >= 2 ? 0.095 : 0.06) * S.greed) dropPickup('candy', e.x, e.y, 1);   // умеренно: 6 / 9,5 / 19 % (итерация 18 подняла до 7,5 / 12 / 24 %, вышло много)
    if (Math.random() < 0.012 * S.luck) dropItem(e.x, e.y);
    // деление
    if (e.type === 'drop') for (const s of [-1, 1]) G.enemies.push(makeEnemy('droplet', e.x + s * 8, e.y, G.waveIndex, { vy: -60, vx: s * 40 }));
    if (e.type === 'bloat') {
      G.shake(0.5); G.freeze(0.06); sfx('popBig', { pitch: 0.6 + e.size * 0.2 });
      G.parts.burst(e.x, e.y, 24, { color: ['#ff3a2a', '#ff8a5a', '#ffd36b', '#fff'], speed: [120, 380], g: 500, life: [0.4, 0.9], shape: 'drop', size: [3, 7] });
      if (G.boss) { G.boss.x = e.x; G.boss.y = e.y; }
      if (!G.enemies.some(f => f.type === 'bloat' && !f.dead)) bloatWaveDone(e);   // волна кончилась: перерыв и микро-бонус, либо победа
    }
    if (e.type === 'jelly' && e.size < 3) for (const s of [-1, 1]) G.enemies.push(makeEnemy('jelly', e.x, e.y, G.waveIndex, { size: e.size + 1, vx: s * 75, vy: -320 }));
    // колокольчик каждые 20 убийств
    if (++R.bellKills >= (hasMeta(app.save, 'v_festival') ? 10 : 20) && !G.pickups.some(p => p.kind === 'bell')) { R.bellKills = 0; G.pickups.push({ kind: 'bell', x: e.x, y: e.y, vx: 0, vy: -200, hits: 0, t: 0, life: 16 }); if (!R.bellHint) { R.bellHint = true; G.bark('bell', { force: true }); } }
    if (e.golden) { addCandies(25); G.floaters.add(e.x, e.y - 20, '+25 конфет!', { size: 24, color: '#ffd166' }); sfx('ach', { pitch: 1.6 }); G.parts.burst(e.x, e.y, 24, { color: ['#ffd166', '#fff3b0', '#fff'], speed: [80, 300], g: 300, life: [0.4, 0.9], shape: 'star', size: [2, 5] }); }
    puOnKill(G, e);
    if (e.onKill) e.onKill(G, e);   // Тяга к сладкому отдаёт украденное ×2
    if (e.type === 'fart') G.bark('fartKill'); else if ((e.type === 'jelly' && e.size <= 1) || e.type === 'crier') G.bark('bigKill');
    if (R.comboMul >= (R.comboBarkAt || 1.5)) { if (G.bark('combo')) R.comboBarkAt = R.comboMul + 0.5; }
    app.emit({ type: 'kill', enemy: e.type, size: e.size }, R);
  };

  G.floorHit = (e) => {
    if (e.dead) return; e.dead = true;
    const R = G.run;
    // чаша ловит
    for (const f of G.fx) if (f.kind === 'cup' && Math.abs(e.x - f.x) < f.w / 2 && e.type !== 'fart') {
      R.cupCatches++; app.emit({ type: 'cup' }, R);
      if (G.phase === 'wave') { R.counter -= e.count; R.counterPop = 0.15; }
      dropPickup('xp', e.x, GROUND - 20, e.xp); sfx('splash', { pitch: 1.5 }); f.fill = Math.min(1, (f.fill || 0) + 0.1);
      if (f.grail) for (let i = 0; i < 2; i++) G.shots.push({ x: f.x, y: GROUND - 20, vx: rand(-100, 100), vy: -400, r: 7, dmg: 30 * G.stats.might, pierce: 0, life: 2.5, t: 0, kind: 'grail', src: 'grail', homing: 6, spd: 460 });
      return;
    }
    if (G.phase === 'wave') { R.counter += e.floor; R.counterBad = 0.3; }
    R.floorHits++; R.combo = 0; R.comboMul = 1;
    if (e.type === 'fart') { G.fog = 6; sfx('fart'); G.shake(0.25); G.floaters.add(e.x, GROUND - 40, '+10', { size: 28, color: '#c9b0ff' }); G.bark('fartFloor'); }
    else {
      sfx('splat', { vol: 0.5 }); G.floaters.add(e.x, GROUND - 30, '+' + e.floor, { size: 22, color: '#ff4a5a' });
      G.stains.push({ x: e.x, w: 26 + e.r * 1.6, t: 0, life: 8 });
      G.parts.burst(e.x, GROUND - 4, 8, { color: ['#ff3a4a', '#ff8a9a'], speed: [60, 200], g: 700, angle: -Math.PI / 2, spread: 1.1, life: [0.2, 0.4], size: [2, 4], shape: 'drop' });
      G.bark('floor');
    }
    // протечка: счётчик ушёл далеко вверх
    if (G.phase === 'wave' && R.counter > R.counterStart * (chapter().waves[R.wave].leak ?? 1.5)) { R.counter = R.counterStart; G.hurtPlayer('Протечка'); G.floaters.add(view.W / 2, view.H * 0.37, 'Протечка!', { size: 34, color: '#ff4a5a', life: 1.2 }); }
  };

  G.hurtPlayer = (why, o = {}) => {
    const p = G.p; if (p.iframes > 0 || p.dead || G.phase === 'clear') return;
    const R = G.run;
    if (app.god?.onHurt?.(G, why)) return;   // режим бога: бессмертие (попадание видно, сердца целы)
    if (R.shield) { R.shield = false; p.iframes = 1; sfx('heal', { pitch: 0.7 }); G.floaters.add(p.x, p.y - 120, 'Щит!', { color: '#bfe8ff' }); return; }
    if (o.soft && Math.random() < G.stats.duvet) { p.iframes = 0.6; G.floaters.add(p.x, p.y - 120, 'Пуховик!', { color: '#c9b0ff', size: 16 }); sfx('thud', { pitch: 1.6, vol: 0.4 }); return; }   // слёзы, семечки, попкорн, падение помидора вязнут в пуху
    if (Math.random() < G.stats.armor) { p.iframes = 0.6; G.floaters.add(p.x, p.y - 120, 'Плед спас!', { color: '#ffd0dc', size: 16 }); sfx('heal', { pitch: 1.3 }); return; }
    p.hp--; p.iframes = G.A?.iframes ?? 0.8; p.hurtFlash = 0.15; R.damageTaken++; R.waveDamage++; R.bossHits = (R.bossHits || 0) + 1;
    R.combo = 0; R.comboMul = 1;
    G.freeze(0.08); G.shake(0.4); sfx('hurt');
    if (navigator.vibrate && app.save.settings.vibrate) navigator.vibrate(40);
    G.parts.burst(p.x, p.y - 60, 12, { color: ['#ff3a4a', '#fff'], speed: [100, 260], life: [0.2, 0.5], shape: 'star' });
    if (G.stats.mint) { G.parts.spawn({ x: p.x, y: p.y - 50, shape: 'ring', size: 20, size2: G.stats.mint, life: 0.35, color: '#9ff0d8' }); for (const e of G.enemies) if (!e.dead && ['droplet', 'drop', 'diver', 'crier'].includes(e.type) && Math.hypot(e.x - p.x, e.y - (p.y - 50)) < G.stats.mint) G.kill(e, 'mint'); }
    if (G.pet) petReact(G.pet, G.petId, 'hurt');
    G.lastHurt = why; R.hurtBy = R.hurtBy || {}; R.hurtBy[why] = (R.hurtBy[why] || 0) + 1;
    if (p.hp <= 0) die(); else if (!(p.hp <= 2 && G.bark('lowHp'))) G.bark('hurt');
  };

  G.steam = (x, y, P, src) => {
    G.fx.push({ kind: P.geyser ? 'geyser' : 'steam', x, y, r: 50 * P.area, t: 0, life: P.dur, dps: P.dot * G.stats.might, src });
    // удар при падении
    for (const e of G.enemies) if ((e.x - x) ** 2 + (e.y - y) ** 2 < (45 * P.area + e.r) ** 2) G.damage(e, P.dmg, src);
    if (G.boss && Math.hypot(G.boss.x - x, G.boss.y - y) < 60 + G.boss.r) G.damageBoss(P.dmg, src);
    sfx('splash', { vol: 0.5 }); G.parts.burst(x, y, 10, { color: ['#ffffff', '#ffd6e0'], speed: [40, 160], life: [0.3, 0.7], size: [4, 9], g: -60 });
  };

  G.dropPickup = (kind, x, y, v) => dropPickup(kind, x, y, v);
  function dropPickup(kind, x, y, v) {
    if (G.pickups.length > 160) { const old = G.pickups.find(p => p.kind === 'xp'); if (old) { old.v += v; return; } }
    G.pickups.push({ kind, x, y, vx: rand(-80, 80), vy: rand(-220, -120), v, t: 0, life: 25, rot: rand(TAU) });
  }
  function dropItem(x, y) {
    const it = weighted([{ k: 'pad', w: 4 }, { k: 'panties', w: G.p.hp < G.stats.maxHp ? 3 : 1 }, { k: 'pack', w: 2 }, { k: 'cupItem', w: 1.5 }]).k;
    G.pickups.push({ kind: it, x: clamp(x, 60, view.W - 60), y: Math.min(y, 100), vx: 0, vy: 40, t: 0, life: 30, rot: 0, item: true });
  }

  // ---------- Прокачка ----------
  // Тиры карточек (data.js: tier, CARD_TUNE): имбовые (rare: Тампон-бластер и его улучшения, Ибупрофенчик, Грелка, Шоколадка, Ватный запас)
  // реже; «защита от серий» (rareGap, rarePity); улучшение уже взятого — реже нового; самый первый забег щедрее; перед последней волной главы
  // защитных карточек больше, и хотя бы одна попадётся, если защиты ещё нет. Состояние в G.run: sinceRare, cardN.
  function buildCards() {
    const R = G.run, T = CARD_TUNE, pool = [];
    if (G.phase === 'cards' && R.cardMemo) { R.cardN = R.cardMemo.n; R.sinceRare = R.cardMemo.s; }   // «Перебор»: счётчики как до этого предложения
    R.cardMemo = { n: R.cardN || 0, s: R.sinceRare ?? 1 };
    const unlocked = id => !(WEAPONS[id]?.locked || PASSIVES[id]?.locked) || app.save.unlocked[id];
    const ownedW = id => R.weapons.find(w => w.id === id || WEAPONS[w.id].evolved && Object.keys(WEAPONS).find(k => WEAPONS[k].evo === w.id) === id);
    const tierOf = def => def.tier || (def.rare ? 'rare' : 'common'), tw = def => T.tierW[tierOf(def)];
    const ph = G.phase === 'cards' ? G.prevPhase : G.phase;
    const near = R.wave >= chapter().waves.length - 1 && ph !== 'bossDead' && !(G.boss && G.boss.dead);   // впереди босс (последняя волна или сам бой)
    const dW = def => def.def && near ? T.defNear : 1;
    const cardN = R.cardN || 0, first = !!R.firstRun && cardN < T.first.boostLevels, guar = !!R.firstRun && cardN < T.first.guaranteed;
    for (const w of R.weapons) {
      const def = WEAPONS[w.id];
      if (!def.evolved && w.lv < def.lv.length) pool.push({ kind: 'w', id: w.id, w: T.upgradeW * T.upgradeDecay ** (w.lv - 1) * tw(def), tier: tierOf(def), rare: tierOf(def) === 'rare', name: def.name, icon: def.icon, tag: `${tierOf(def) === 'rare' ? '★ ' : ''}ур. ${w.lv + 1}`, desc: def.lv[w.lv].text, pairHint: hasPassive(def.pair) ? 'есть пара для эволюции' : null });
    }
    if (R.weapons.length < 4) for (const id in WEAPONS) {
      const def = WEAPONS[id]; if (def.evolved || ownedW(id) || !unlocked(id)) continue;
      const hpFrac = G.p.hp / G.stats.maxHp, bonus = id === 'bottle' ? (hpFrac <= 0.5 ? 1.8 : 0.6) : 1;   // Грелка — когда тебе нужно лечиться и держаться
      pool.push({ kind: 'w', id, w: bonus * tw(def), tier: tierOf(def), rare: tierOf(def) === 'rare', name: def.name, icon: def.icon, tag: tierOf(def) === 'rare' ? '★ редкое оружие' : 'новое оружие', desc: def.desc, isNew: true, newRare: tierOf(def) === 'rare', pairHint: hasPassive(def.pair) ? 'пара к пассивке' : null });
    }
    for (const p of R.passives) { const def = PASSIVES[p.id]; if (p.lv < def.max) pool.push({ kind: 'p', id: p.id, w: T.upgradeW * T.upgradeDecay ** (p.lv - 1) * tw(def) * dW(def) * 1.25, tier: tierOf(def), rare: tierOf(def) === 'rare', def: !!def.def, name: def.name, icon: def.icon, tag: `${tierOf(def) === 'rare' ? '★ ' : ''}ур. ${p.lv + 1}`, desc: def.desc }); }
    if (R.passives.length < 4) for (const id in PASSIVES) {
      if (R.passives.find(p => p.id === id) || !unlocked(id)) continue;
      const def = PASSIVES[id];
      const pairOf = R.weapons.find(w => WEAPONS[w.id].pair === id);
      pool.push({ kind: 'p', id, w: (pairOf ? 1.4 : 0.9) * tw(def) * dW(def) * (id === 'boots' && R.chapter >= 1 && R.chapter <= 2 ? 1.5 : 1), tier: tierOf(def), rare: tierOf(def) === 'rare', def: !!def.def, name: def.name, icon: def.icon, tag: tierOf(def) === 'rare' ? '★ редкая пассивка' : 'новая пассивка', desc: def.desc, isNew: true, pairHint: pairOf ? 'пара к ' + WEAPONS[pairOf.id].name : null });
    }
    const n = Math.random() < 0.1 * G.stats.luck ? 4 : 3;
    const list = [], rares = pool.filter(c => c.rare), sinceRare = R.sinceRare ?? 1;
    const allowRare = guar || sinceRare >= T.rareGap;
    let cand = pool.filter(c => !c.rare || allowRare);
    if (cand.length < n) cand = pool.slice();
    if (first) cand = cand.map(c => c.rare ? { ...c, w: c.w * T.first.boost } : c);
    const take = c => { list.push(c); const i = cand.indexOf(c); if (i >= 0) cand.splice(i, 1); };
    if (guar && rares.length) {   // первый забег: в первых повышениях одна «классная» (новое имбовое оружие заметнее улучшения)
      take(weighted(cand.filter(c => c.rare).map(c => ({ ...c, w: c.w * (c.newRare ? 3 : 1), src: c })))?.src || cand.find(c => c.rare));
      cand = cand.filter(c => !c.rare);   // ровно одна
    }
    while (list.length < n && cand.length) take(weighted(cand));
    // защита от серий: давно не было имбовой — гарантируем одну
    if (!list.some(c => c.rare) && sinceRare >= T.rarePity && rares.length) { const r = weighted(rares); const i = list.map(c => !c.def).lastIndexOf(true); if (list.length) list[i >= 0 ? i : list.length - 1] = r; else list.push(r); }
    // впереди босс, а защиты у игрока нет — в предложении будет хотя бы одна защитная
    if (near && list.length && !R.passives.some(p => PASSIVES[p.id].def) && !list.some(c => c.def)) {
      const defs = pool.filter(c => c.def && !list.includes(c));
      if (defs.length) { const d = weighted(defs); let i = -1; list.forEach((c, k) => { if (!c.rare) i = k; }); list[i >= 0 ? i : list.length - 1] = d; }
    }
    R.cardN = cardN + 1; R.sinceRare = list.some(c => c.rare) ? 0 : sinceRare + 1;
    if (!list.length) list.push({ kind: 'heal', name: 'Шоколадка', icon: 'choco', tag: 'бонус', desc: '+1 сердце и 15 конфет' }, { kind: 'candy', name: 'Пакет конфет', icon: 'candy', tag: 'бонус', desc: '+30 конфет' });
    return list;
  }
  function hasPassive(id) { return G.run.passives.some(p => p.id === id); }
  // Чашка какао: на повышении уровня греет (+1 сердце при малом запасе; ур. 3 — всегда)
  function cocoaWarm() {
    const L = G.stats.cocoa, p = G.p; if (!L || p.dead || p.hp >= G.stats.maxHp) return;
    if (p.hp <= [0, 2, 3, 99][L]) { p.hp++; G.floaters.add(p.x, p.y - 130, 'Какао! +1 ♥', { color: '#ffb48a', size: 18 }); sfx('heal', { pitch: 1.1 }); }
  }
  function applyCard(c) {
    const R = G.run;
    if (c.kind === 'w') {
      const w = R.weapons.find(w => w.id === c.id);
      if (w) { w.lv++; app.emit({ type: 'weaponLevel', level: w.lv }, R); } else { R.weapons.push({ id: c.id, lv: 1 }); app.emit({ type: 'gain' }, R); }
    } else if (c.kind === 'p') {
      const p = R.passives.find(p => p.id === c.id);
      if (p) p.lv++; else R.passives.push({ id: c.id, lv: 1 });
      const oldMax = G.stats.maxHp; computeStats(); if (G.stats.maxHp > oldMax) G.p.hp += G.stats.maxHp - oldMax;
    } else if (c.kind === 'heal') { G.p.hp = Math.min(G.stats.maxHp, G.p.hp + 1); addCandies(15); }
    else if (c.kind === 'candy') addCandies(30);
    else if (c.kind === 'evolve') evolve(c.id);
    computeStats();
  }
  function evolve(id) {
    const R = G.run, w = R.weapons.find(w => w.id === id); if (!w) return;
    w.id = WEAPONS[id].evo; w.lv = 1; w.cdT = 0;
    app.save.stats.evolutions++; app.emit({ type: 'evolve' }, R);
    G.floaters.add(view.W / 2, view.H * 0.37, 'ЭВОЛЮЦИЯ!', { size: 40, color: '#ffd166', life: 1.6 });
    sfx('ach'); G.shake(0.3);
  }
  function addCandies(n) { const v = Math.round(n * G.stats.greed * G.run.comboMul * (G.pu?.magnet > 0 ? 1.5 : 1)); G.run.candies += v; app.save.stats.candiesTotal += v; app.emit({ type: 'candy' }, G.run); }

  function openCards(opts) {
    G.cards = opts; G.cardSel = 0; G.cardAppear = 0; G.prevPhase = G.phase; G.phase = 'cards';
    sfx('levelup');
  }

  // ---------- Смерть, босс, глава ----------
  function die() {
    const p = G.p; p.dead = true; G.phase = 'dead'; G.phaseT = 0;
    app.save.stats.deaths++; app.emit({ type: 'death' }, G.run);
    app.save.barkMem = { lastDeathBy: G.lastHurt, lastWasDeath: true }; G.deathLine = pick(DEATH_LINES);
    rollOffers(app.save, { cheap: app.save.stats.deaths <= 2, starter: !app.save.firstDeathGift && app.save.stats.deaths <= 1 });   // первые смерти: без дорогих редких карточек; первая — со «Стартовым набором» (дешёвая карточка, meta.js)
    G.parts.burst(p.x, p.y - 60, 40, { color: ['#ff3a4a', '#ff9ab8', '#fff', '#ffd166'], speed: [100, 400], g: 500, life: [0.5, 1.2], shape: 'star', size: [3, 7] });
    sfx('boom'); G.freeze(0.2); G.shake(0.8);
    bankCandies(false);
    G.run.gift = consolation(app.save, { time: G.run.time }); if (G.run.gift) app.persist();   // «Утешительный приз» (meta.js): первая смерть — хватит на «Стартовый набор», дальше — малая добавка по длине забега
    playMusic('defeat', { then: 'calm' });
  }
  function bankCandies(win) {
    const add = G.run.candies - (G.banked || 0); G.banked = G.run.candies;
    app.save.candies += Math.max(0, add);
    app.save.best.combo = Math.max(app.save.best.combo, G.run.bestCombo);
    app.save.best.level = Math.max(app.save.best.level, G.run.level);
    app.persist();
  }
  // ---------- Босс «Великое Вздутие»: три волны (chapter2.js: BLOAT_WAVES). Между волнами — перерыв ~2,8 с, семечки исчезают, выпадает ОДИН микро-бонус ----------
  const BLOAT_BREAK = 2.8;
  function spawnBloatWave(w, first = false) {
    const B = G.bloat, K = bloatK(), W = view.W, sizes = BLOAT_WAVES[w].sizes, n = sizes.length;
    sizes.forEach((sz, i) => {
      const x = n === 1 ? W / 2 : W * (0.2 + 0.6 * i / (n - 1)), dir = i % 2 ? -1 : 1;
      G.enemies.push(makeEnemy('bloat', x, ARENA.sky + (n === 1 ? 120 : 70), 0, { size: sz, vx: BLOAT_SIZES[sz].vx * K.vx * (n === 1 ? 1 : dir), vy: n === 1 ? 0 : -140 }));
    });
    B.w = w; B.state = 'fight'; B.t = 0;
    G.boss.waveName = `Волна ${w + 1} из ${BLOAT_WAVES.length}: ${BLOAT_WAVES[w].name}`;
    if (!first) { G.floaters.add(W / 2, view.H * 0.3, `Волна ${w + 1}: ${BLOAT_WAVES[w].name}`, { size: 30, color: '#ffd166', life: 1.8 }); sfx('boom', { pitch: 0.7, vol: 0.6 }); G.shake(0.3); }
  }
  function bloatWaveDone(e) {
    const B = G.bloat; if (!B || B.w >= BLOAT_WAVES.length - 1) { bossDie(); return; }
    B.state = 'break'; B.t = 0;
    for (const f of G.foes) { f.dead = true; G.parts.burst(f.x, f.y, 4, { color: ['#ffe066', '#fff'], speed: [40, 120], life: [0.2, 0.4], size: [2, 3.5] }); }   // семечки исчезают
    const hurt = G.p.hp < G.stats.maxHp;
    B.bonus = weighted([{ k: 'bheart', w: hurt ? 1.5 : 0.3 }, { k: 'bshield', w: 1 }, { k: 'bregen', w: hurt ? 1.2 : 0.4 }, { k: 'bmight', w: 1 }, { k: 'bbubble', w: 1 }]).k;
    G.pickups.push({ kind: 'pu', id: B.bonus, boss: true, x: clamp(e.x, 90, view.W - 90), y: clamp(e.y, ARENA.sky + 90, GROUND - 120), vx: 0, vy: -120, t: 0, life: 16 });
    G.boss.waveName = `Волна ${B.w + 1} пройдена`;
    G.shake(0.4); sfx('ach', { pitch: 1.1 });
    G.say(pick(['Один помидор — минус! Передышка.', 'Фух. Ещё не всё — но уже вкусно.', 'Томатный сок — это тоже напиток.']), '#fff');
  }
  function updateBloatBreak(dt) {
    const B = G.bloat; if (!B || B.state !== 'break' || !G.boss || G.boss.dead) return;
    B.t += dt; if (B.t >= BLOAT_BREAK) spawnBloatWave(B.w + 1);
  }

  // ---------- Слухи (ненавязчивые подсказки; по разу на сейв) ----------
  const RUMORS = {
    c1: 'В очереди шепчутся: в соседнем зале всё катится по полу. Кто-то обмолвился про резиновые сапоги…',
    c1b: 'Из Вздутия сыплются семечки. Зонтик бы не помешал.',
    c2: 'Говорят, Королева топает так, что по полу идёт волна. Сапоги, мол, выручают.',
    c2b: 'Королева плачет ливнем. Зонтик держится крепче, чем нервы.',
    c3: 'Руда зовёт старых знакомых — по одному. Пригодится всё, что уже пригодилось.',
  };
  function rumorKey(ch, wave) {
    const last = wave === CHAPTERS[ch].waves.length - 1;
    if (wave === 0 && ch >= 1 && ch <= 3) return 'c' + ch;
    if (last && (ch === 1 || ch === 2)) return 'c' + ch + 'b';
    return null;
  }
  function showRumor() {
    const k = G.pendingRumor; G.pendingRumor = null; if (!k) return;
    const h = app.save.hints = app.save.hints || {}; if (h[k]) return;
    h[k] = true; app.persist(); G.rumor = { text: RUMORS[k], t: 0, life: 6.5 };
  }
  function drawRumor(ctx) {
    const r = G.rumor; if (!r || G.paused) return;
    const a = r.t < 0.5 ? r.t / 0.5 : r.t > r.life - 0.7 ? Math.max(0, (r.life - r.t) / 0.7) : 1;
    const w = Math.min(view.W - 36, 540), x = view.W / 2, y = view.portrait ? view.H * 0.3 : 168;
    ctx.save(); ctx.globalAlpha = a; ctx.font = '800 16px Nunito, sans-serif';
    const lines = wrap(ctx, r.text, w - 40, 16, 800), h = 40 + lines.length * 21;
    ctx.translate(0, (1 - a) * 8);
    ctx.fillStyle = 'rgba(24,8,30,0.84)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 14); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,209,102,0.8)'; ctx.stroke();
    text(ctx, 'Слух из очереди', x, y + 16, { size: 12, color: '#ff9ab8', weight: 900, outline: false });
    lines.forEach((ln, i) => text(ctx, ln, x, y + 38 + i * 21, { size: 16, color: '#ffe6ef', weight: 800, outline: false }));
    ctx.restore();
  }

  function startBoss() {
    G.phase = 'bossIntro'; G.phaseT = 0; G.bloat = null;
    if (chapter().boss === 'bloat') {
      // «виртуальный» босс: сам томат — враги-куски в G.enemies, здесь только имя и общая полоса HP
      G.boss = { id: 'bloat', name: 'Великое Вздутие', intro: 'Три волны: большой, два средних, три мелких', virtual: true, x: view.W / 2, y: ARENA.sky + 200, r: 0, hp: BLOAT_TOTAL, maxHp: BLOAT_TOTAL, state: 'fight', slams: [], dark: 0, eyeT: 0, invuln: 0, t: 0, marks: BLOAT_MARKS };
      G.bloat = { w: 0, state: 'fight', t: 0, bonus: null }; spawnBloatWave(0, true);
    } else G.boss = chapter().boss === 'queen' ? makeQueen() : chapter().boss === 'ruda' ? makeRuda() : makeSpasm();
    G.waveLabel = `${chapter().name} · босс`;
    G.run.bossHits = 0; G.run.bossDmg = 0;
    if (G.pet) petReact(G.pet, G.petId, 'boss');
    playMusic('boss'); sfx('boom', { pitch: 0.5 });
    const bk = { bloat: 'bossBloat', spasm: 'bossSpasm' }[chapter().boss];
    if (bk) G.bark(bk, { force: true });
    else G.say(chapter().boss === 'queen' ? 'Королева ПМС? Корону сниму вместе с маской.' : 'Руда… Ну привет, соседка.', '#fff', 'shout');
  }
  // peaceful — финал «Обнять»: без взрывов, сердечки; noChest — после финального босса сундук не нужен
  G.bossDefeated = (peaceful) => { if (G.boss && !G.boss.dead) bossDie(peaceful); };
  function bossDie(peaceful = false) {
    const b = G.boss; b.dead = true; G.phase = 'bossDead'; G.phaseT = 0;
    if (peaceful) { G.shake(0.2); sfx('heal', { pitch: 0.8 }); setTimeout(() => sfx('ach'), 300); G.parts.burst(b.x, b.y, 30, { color: ['#ff7aa8', '#ffd0dc', '#fff', '#ffd166'], speed: [60, 240], g: -40, life: [0.8, 1.6], shape: 'star', size: [3, 7] }); }
    else {
      G.freeze(0.2); app.game.timeScale = 0.25; G.slowmo = 1.2; G.shake(1);
      for (let i = 0; i < 6; i++) setTimeout(() => G.parts.burst(b.x + rand(-60, 60), b.y + rand(-40, 40), 16, { color: ['#ff9ad0', '#ffd166', '#fff', '#5ee6c8', '#c85aa0'], speed: [100, 420], g: 300, life: [0.6, 1.2], shape: Math.random() < 0.5 ? 'star' : 'rect', size: [3, 7] }), i * 120);
      sfx('boom'); setTimeout(() => sfx('ach'), 300);
    }
    for (const e of G.enemies) G.pop(e, true);
    for (const f of G.foes) f.dead = true;
    if (b.slams) b.slams = []; if (b.waves) b.waves = []; b.rain = null;
    for (let i = 0; i < 25; i++) dropPickup('candy', b.x + rand(-60, 60), b.y, 1);
    if (b.deathLine && !peaceful) { G.floaters.add(clamp(b.x, 200, view.W - 200), view.H * 0.61, b.deathLine, { size: 24, color: '#ffd0dc', life: 2.6, vy: -20 }); setTimeout(() => G.say('Победила! …Но чай я всё-таки заварю. На двоих.', '#fff'), 900); }
    if (peaceful) G.say('Пока, Руда. Приходи без сюрпризов.', '#fff');
    G.chest = b.noChest ? null : { x: b.x, y: b.y, vy: -100, t: 0, landed: false };
    app.save.stats.bossKills++;
    app.emit({ type: 'bossKill', boss: b.id, damageTaken: G.run.bossHits }, G.run);
  }
  function openChest() {
    const R = G.run;
    // эволюция, если есть оружие 5-го уровня и его пара
    const ev = R.weapons.find(w => { const d = WEAPONS[w.id]; return !d.evolved && d.evo && w.lv >= d.lv.length && hasPassive(d.pair); });
    if (ev) openCards({ title: 'Сундук!', subtitle: 'Эволюция оружия', list: [{ kind: 'evolve', id: ev.id, name: WEAPONS[WEAPONS[ev.id].evo].name, icon: WEAPONS[ev.id].icon, tag: 'ЭВОЛЮЦИЯ', desc: WEAPONS[WEAPONS[ev.id].evo].desc, evolve: true }], after: 'chapterClear' });
    else { const list = buildCards(); openCards({ title: 'Сундук!', subtitle: 'Подсказка: оружие 5-го ур. + его пара = эволюция', list, after: 'chapterClear', bonusCandies: 40 }); }
  }
  function chapterClear() {
    G.phase = 'chapterClear'; G.phaseT = 0;
    addCandies(35);
    app.emit({ type: 'chapterClear', chapter: G.run.chapter, time: G.run.chapterTime }, G.run);
    app.save.best.chapter = Math.max(app.save.best.chapter, G.run.chapter + 1);
    app.save.progress = Math.max(app.save.progress || 0, Math.min(CHAPTERS.length - 1, G.run.chapter + 1));
    app.save.stats.wins++;
    app.save.barkMem = { lastWasDeath: false }; G.clearLine = pick(CLEAR_LINES);
    rollOffers(app.save);
    if (G.run.ending) G.clearLine = G.run.ending === 'hug' ? 'Мир, чай и плед. Хэллоуин спасён.' : 'Победа! Ровно до следующего месяца.';
    bankCandies(true); playMusic('victory', { then: 'calm' });
  }

  // ---------- Шаг симуляции ----------
  function updateWorld(dt) {
    const R = G.run, p = G.p, inp = app.inp;
    G.A = assistFor(inp);   // сенсорная помощь (data.js TOUCH_ASSIST): на телефоне мягче; в тестах isTouch = false
    G.t += dt; R.time += dt; R.chapterTime += dt;
    if (G.phase === 'wave') R.waveTime += dt;
    if (!p.dead) {
      // липкие пятна замедляют
      const onStain = p.onGround && G.stains.some(s => Math.abs(s.x - p.x) < s.w / 2);
      const sp = G.stats.moveSpeed; if (onStain) G.stats.moveSpeed *= 0.7;
      updatePlayer(p, inp, dt);
      G.stats.moveSpeed = sp;
      // «Лара парит»: держишь прыжок при падении
      if (inp.jump && p.vy > 160) p.vy = 160;
      if (p.onGround && R.airKills) { app.emit({ type: 'air', n: R.airKills }, R); if (R.airKills >= 5) G.floaters.add(p.x, p.y - 140, `Воздушная серия ${R.airKills}!`, { size: 20, color: '#5ee6c8' }); R.airKills = 0; }
      // трусики-жалость: ранена и долго без лечения → прилетают сверху (1 сердце — быстрее)
      if (p.hp <= 1 && (G.phase === 'wave' || G.phase === 'boss')) {
        R.healPity = (R.healPity || 0) + dt;
        if (R.healPity > 35 && !G.pickups.some(k => k.kind === 'panties')) { R.healPity = 0; G.pickups.push({ kind: 'panties', x: clamp(p.x + rand(-260, 260), 80, view.W - 80), y: -20, vx: 0, vy: 55, t: 0, life: 30, rot: 0, item: true }); }
      } else R.healPity = 0;
      // складной зонтик: щит от одного удара восстанавливается сам
      if (G.stats.umbCd && !R.shield) { R.umbT = (R.umbT || 0) + dt; if (R.umbT > G.stats.umbCd) { R.umbT = 0; R.shield = true; G.floaters.add(p.x, p.y - 130, 'Зонтик готов', { color: '#bfe8ff', size: 15 }); sfx('heal', { pitch: 1.6, vol: 0.4 }); } }
      // реген
      if (G.stats.regen) { R.regenT = (R.regenT || 0) + dt; if (R.regenT > G.stats.regen) { R.regenT = 0; if (p.hp < G.stats.maxHp) { p.hp++; sfx('heal'); G.floaters.add(p.x, p.y - 130, '+1 ♥', { color: '#ff9ab8' }); } } }
      // секрет: угол кинотеатра
      if (p.x < 80 && p.onGround && G.phase === 'wave') { G.cornerT += dt; if (G.cornerT > 20) app.emit({ type: 'corner' }, R); } else G.cornerT = 0;
      if (!G.ceasefire) updateWeapons(G, dt);   // финал: перемирие на время выбора и объятий
    }
    if (G.pet && !p.dead) { updatePet(G.pet, dt, petTarget(p.x, p.y, p.face)); const talk = !!G.bubble && G.bubble.t < G.bubble.life; if (talk) G.pet.bubble = null; else if (G.phase === 'wave' || G.phase === 'boss') petIdle(G.pet, G.petId, false); }
    updateShots(G, dt);
    R.frenzy = Math.max(0, R.frenzy - dt); R.pierceAll = Math.max(0, R.pierceAll - dt);
    R.comboT -= dt; if (R.comboT <= 0 && R.combo) { R.combo = 0; R.comboMul = 1; R.comboBarkAt = 1.5; }
    R.counterPop = Math.max(0, R.counterPop - dt); R.counterBad = Math.max(0, R.counterBad - dt);
    G.fog = Math.max(0, G.fog - dt); G.freezeAll = Math.max(0, (G.freezeAll || 0) - dt);

    updatePowerups(G, dt);
    { const I = G.pu.freeze > 0 ? 0.1 : clamp(0.3 + G.enemies.length / 16 * 0.5 + (G.boss ? 0.3 : 0) + (p.hp <= 1 ? 0.2 : 0), 0, 1);
      G.musI = (G.musI ?? I) + (I - (G.musI ?? I)) * Math.min(1, dt / 1.2);
      if (Math.abs(G.musI - (G.musISent ?? -1)) > 0.05) { G.musISent = G.musI; setMusicIntensity(G.musI); } }
    const edt = dt * enemyTimeScale(G) * G.A.enemyTime;
    G.bossFreeze = Math.max(0, (G.bossFreeze || 0) - dt);
    if (G.phase === 'wave') director(edt);
    for (const e of G.enemies) updateEnemy(G, e, edt);
    if (G.boss && !G.boss.dead && !G.boss.virtual) (G.boss.upd || updateBoss)(G, G.boss, G.bossFreeze > 0 ? 0 : (G.pu.slow > 0 ? dt * 0.6 : dt) * G.A.bossTempo);
    if (G.boss && G.boss.virtual && !G.boss.dead) { // общая полоса: живые куски + их будущие дети
      G.boss.hp = G.enemies.filter(e => e.type === 'bloat' && !e.dead).reduce((a, e) => a + Math.max(0, e.hp), 0) + (G.bloat ? bloatFutureHp(G.bloat.w) : 0);
      updateBloatBreak(dt);
    }
    { // снаряды глав 1–2 (chapter2.js) и крупные снаряды глав 3–4 (f.own, chapter3.js) — у каждых своя физика
      const own = G.foes.filter(f => f.own); if (own.length) G.foes = G.foes.filter(f => !f.own);
      updateFoes(G, edt); if (own.length) { G.foes.push(...own); } updateOwnFoes(G, edt); }
    collide();
    updatePickups(dt);
    updateFx(dt);
    G.enemies = G.enemies.filter(e => !e.dead); G.shots = G.shots.filter(s => !s.dead); G.foes = G.foes.filter(f => !f.dead);
    G.pickups = G.pickups.filter(p => !p.dead); G.fx = G.fx.filter(f => f.t < f.life);
    G.stains = G.stains.filter(s => (s.t += dt) < s.life);
    G.parts.update(dt, GROUND); G.floaters.update(dt); G.tweens.update(dt);
    if (G.bubble) { G.bubble.t += dt; if (G.bubble.t > G.bubble.life) G.bubble = null; }
    G.muzzle = Math.max(0, G.muzzle - dt);
    // уровень
    while (R.xp >= R.xpNext) { R.xp -= R.xpNext; R.level++; R.xpNext = xpToNext(R.level); R.pendingLevels++; app.emit({ type: 'level', level: R.level }, R); }
  }

  function director(dt) {
    const R = G.run, wv = chapter().waves[R.wave];
    const inten = 1 + 0.3 * Math.sin(R.waveTime * TAU / 25);
    let adapt = 1; if (G.p.hp <= 1) adapt = 0.9; else if (R.waveTime > 20 && R.waveDamage === 0) adapt = 1.1;
    // нарастание: первая волна игры — обучение, дальше давление растёт
    const ramp = G.run.chapter === 0 ? [1.0, 1.25, 1.4, 1.45][R.wave] ?? 1.45 : 1.45;
    // «мягкий вход» волны (wv.soft): первые t с — только простые капли, поток слабее и медленнее; последние 8 с плавно к обычному режиму
    const soft = wv.soft, softOn = !!soft && R.waveTime < soft.t, sk = soft ? clamp((R.waveTime - (soft.t - 8)) / 8, 0, 1) : 1;
    G.budget += wv.budget * ramp * inten * adapt * (soft ? soft.k + (1 - soft.k) * sk : 1) * dt;
    if (G.enemies.length >= 32) return;
    if (!G.nextType) G.nextType = weighted(Object.entries(softOn ? soft.mix : wv.mix).map(([k, w]) => ({ k, w }))).k;
    const t = G.nextType, def = ENEMIES[t], cost = def.cost, kind = def.base || t;   // spazmj — тот же Спазмик с подскоками
    const CAP = { fart: 2, spout: 2, craving: 1, ghost: 3, spazm: G.run.chapter === 1 && R.wave < 2 ? 1 : 2, spazmj: 1 };   // первое знакомство со Спазмиком: по одному
    if (CAP[t] && G.enemies.filter(e => e.type === kind && !!e.hop === !!def.hop).length >= CAP[t]) { G.nextType = null; return; }
    if (t === 'jelly' && G.enemies.some(e => e.type === 'jelly' && e.size <= 1)) { G.nextType = null; return; }
    if (G.budget >= cost) {
      G.budget -= cost; G.nextType = null;
      const x = t === 'jelly' ? (Math.random() < 0.5 ? 120 : view.W - 120) : rand(80, view.W - 80);
      const spdK = (1 + 0.12 * Math.min(1, R.waveTime / 50)) * (soft ? soft.spd + (1 - soft.spd) * sk : 1);   // внутри волны капли разгоняются
      G.enemies.push(makeEnemy(kind, x, t === 'jelly' ? 60 : -30, G.waveIndex, t === 'jelly' ? { size: G.run.chapter === 0 ? 1 : 0, spdK } : def.hop ? { spdK, hop: true } : { spdK }));
    }
    // прокладка по таймеру — связь с оригиналом (поймать = −5)
    if (hasMeta(app.save, 'v_golden') && !R.goldenDone && R.waveTime > (R.goldenAt ??= rand(8, 20))) {
      R.goldenDone = true; const gx = rand(120, view.W - 120);
      G.enemies.push(makeEnemy('droplet', gx, -20, G.waveIndex, { golden: true, count: 0, floor: 0, vy: 140 }));
      G.say('Золотая капля! Лови!', '#ffd166');
    }
    G.padTimer -= dt;
    if (G.padTimer <= 0) { G.padTimer = rand(16, 24); G.pickups.push({ kind: 'pad', x: rand(120, view.W - 120), y: -20, vx: 0, vy: 55, t: 0, life: 30, rot: 0, item: true }); }
    if (R.counter <= 0) waveClear();
  }

  function waveClear() {
    const R = G.run;
    G.phase = 'clear'; G.phaseT = 0; R.counter = 0;
    app.game.timeScale = 0.3; G.slowmo = 0.4;
    for (const e of G.enemies) G.pop(e, true);
    for (const p of G.pickups) if (p.kind === 'xp' || p.kind === 'candy') p.magnet = true;
    sfx('ach', { pitch: 1.2 }); G.shake(0.3);
    G.parts.burst(view.W / 2, view.H * 0.37, 40, { color: ['#ffd166', '#ff7aa8', '#5ee6c8', '#fff'], speed: [150, 450], g: 400, life: [0.6, 1.2], shape: 'rect', size: [3, 6] });
    addCandies(9 + R.wave * 3 + (R.floorHits === 0 ? 8 : 0));   // за волну; чистая (ни капли на полу) — бонус
    G.bark('waveClear');
    if (G.pet) petReact(G.pet, G.petId, 'clear');
    if (hasMeta(app.save, 'v_rain')) for (let i = 0; i < 18; i++) setTimeout(() => { if (G.phase === 'clear') G.pickups.push({ kind: 'candy', x: rand(80, view.W - 80), y: -10, vx: rand(-20, 20), vy: rand(40, 120), v: 1, t: 0, life: 6, rot: 0 }); }, i * 110);
    app.emit({ type: 'waveClear', floorHits: R.floorHits, damageTaken: R.waveDamage, lastY: R.lastKillY }, R);
  }

  function collide() {
    const p = G.p, pb = playerBox(p);
    // снаряды по врагам
    for (const s of G.shots) {
      if (s.dead) continue;
      for (const e of G.enemies) {
        if (e.dead || e.immune) continue;   // выстрелы проходят сквозь серого призрака
        const rr = (s.r + e.r * 0.9) ** 2;
        if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 > rr) continue;
        if (s.hit) { const last = s.hit.get(e); if (last !== undefined && G.t - last < (s.kind === 'pad' ? 0.3 : 99)) continue; s.hit.set(e, G.t); }
        G.damage(e, s.dmg, s.src, { shatter: s.shatter });
        if (s.slow) { e.slowT = 1.5 * G.stats.duration; e.slowK = s.slow; }
        if (s.boom) { for (const f of G.enemies) if (f !== e && (f.x - s.x) ** 2 + (f.y - s.y) ** 2 < (s.boom + f.r) ** 2) G.damage(f, s.dmg * 0.6, s.src); G.parts.burst(s.x, s.y, 8, { color: ['#bff3ff', '#fff'], speed: [40, 140], life: [0.2, 0.4] }); }
        if (s.kind === 'bottle') { G.steam(s.x, s.y, s.P, s.src); s.dead = true; break; }
        if (G.run.pierceAll > 0) continue;
        if (s.pierce > 0) { s.pierce--; continue; }
        s.dead = true; break;
      }
      // по боссу
      const b = G.boss;
      if (!s.dead && b && !b.dead && b.state !== 'enter' && (s.x - b.x) ** 2 + (s.y - b.y) ** 2 < (s.r + b.r) ** 2) {
        if (s.kind === 'pad') { if (!s.bossT || G.t - s.bossT > 0.3) { s.bossT = G.t; G.damageBoss(s.dmg, s.src); } }
        else { G.damageBoss(s.dmg, s.src); if (s.kind === 'bottle') G.steam(s.x, s.y, s.P, s.src); s.dead = true; }
      }
      // вражеские снаряды (слёзы, семечки) сбиваются
      if (!s.dead) for (const f of G.foes) if (!f.dead && (s.x - f.x) ** 2 + (s.y - f.y) ** 2 < (s.r + f.r + 8) ** 2) { f.dead = true; G.parts.burst(f.x, f.y, 4, { color: '#fff', speed: [40, 120], life: [0.15, 0.3], size: [1.5, 3] }); if (!s.pierce) { s.dead = true; } break; }
      // колокольчик
      if (!s.dead && !s.homing && BELL_SHOTS.has(s.kind)) for (const k of G.pickups) if (k.kind === 'bell' && G.t - (k.hitT || -9) > 0.18 && (s.x - k.x) ** 2 + (s.y - k.y) ** 2 < (s.r + 18) ** 2) {
        k.vy = -390; k.hitT = G.t; k.hits++; s.dead = true; sfx('coin', { pitch: 1 + (k.hits % 4) * 0.15 }); app.emit({ type: 'bell', n: k.hits }, G.run); break;
      }
    }
    // враги по Поппи
    if (!p.dead) for (const e of G.enemies) {
      if (e.dead) continue;
      const cx = clamp(e.x, pb.x, pb.x + pb.w), cy = clamp(e.y, pb.y, pb.y + pb.h);
      if ((e.x - cx) ** 2 + (e.y - cy) ** 2 < (e.r * (e.type === 'bloat' ? 0.82 : 0.9) * G.A.hit) ** 2) {   // помидор: контур спрайта прощает больше
        if (e.type === 'spazm' && G.stats.boots) {
          if (p.vy > 60 && p.y < e.y) { p.vy = -420; G.kill(e, 'boots'); G.shake(0.2); sfx('thud', { pitch: 1.3 }); if (G.stats.boots >= 2) for (const f of G.enemies) if (!f.dead && f.type !== 'jelly' && f.type !== 'bloat' && Math.hypot(f.x - p.x, f.y - p.y) < 140) G.kill(f, 'boots'); }
          continue;
        }
        if (p.iframes > 0) continue;
        G.hurtPlayer(e.type, { soft: e.type === 'popcorn' || e.type === 'bloat' });
        if (e.type === 'bloat') G.p.iframes = Math.max(G.p.iframes, (G.A?.iframes ?? 0.8) + 0.5);   // после удара помидора передышка длиннее: не добивает цепочкой
        if (e.type === 'jelly' || e.type === 'bloat') { e.vx = Math.sign(e.x - p.x || 1) * Math.abs(e.vx || 75) * 1.4; e.vy = -Math.abs(e.vy) - 250; }
        else if (e.type !== 'fart' && !e.noPop && !e.immune && !e.boss && ['droplet', 'drop', 'diver', 'popcorn', 'crier', 'spazm'].includes(e.type)) G.pop(e, false);
      }
    }
  }

  function updatePickups(dt) {
    const p = G.p, R = G.run;
    for (const k of G.pickups) {
      k.t += dt; if (k.t > k.life) { k.dead = true; continue; }
      if (k.kind === 'bell') {
        k.vy += 230 * dt; k.y += k.vy * dt; k.x += Math.sin(k.t * 2) * 30 * dt;
        if (k.y > GROUND - 14) { k.dead = true; G.parts.burst(k.x, k.y, 6, { color: '#ffd166' }); continue; }
      } else if (k.kind === 'pu' && k.boss && k.t > 1.1) { const d = Math.hypot(p.x - k.x, (p.y - 50) - k.y) || 1, sp = 380 + k.t * 50; k.x += (p.x - k.x) / d * sp * dt; k.y += ((p.y - 50) - k.y) / d * sp * dt; }   // микро-бонус босса сам подлетает
      else if (k.kind === 'pu') { k.vy += 600 * dt; k.x += k.vx * dt; k.y += k.vy * dt; if (k.y > GROUND - 18) { k.y = GROUND - 18; k.vy = 0; k.vx = 0; } }
      else if (k.item) { k.y += k.vy * dt; k.x += Math.sin(k.t * 2.5) * 25 * dt; k.rot = Math.sin(k.t * 3) * 0.3; if (k.y > GROUND - 10) { k.y = GROUND - 10; k.vy = 0; } }
      else {
        const d = Math.hypot(p.x - k.x, (p.y - 50) - k.y);
        if (k.magnet || d < G.stats.magnet) { k.magnet = true; const sp = 300 + k.t * 600; k.x += (p.x - k.x) / d * sp * dt; k.y += ((p.y - 50) - k.y) / d * sp * dt; }
        else { k.vy += 600 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 0.98; if (k.y > GROUND - 8) { k.y = GROUND - 8; k.vy *= -0.35; k.vx *= 0.7; } }
      }
      // подбор
      const dx = p.x - k.x, dy = (p.y - 50) - k.y;
      if (!p.dead && Math.abs(dx) < 34 && Math.abs(dy) < 62) collect(k);
    }
  }
  let pitchStep = 0, pitchT = 0;
  function collect(k) {
    const R = G.run, p = G.p;
    k.dead = true;
    if (G.pet && (k.kind !== 'xp' || Math.random() < 0.04)) petReact(G.pet, G.petId, 'pickup');
    if (G.t - pitchT > 0.5) pitchStep = 0; pitchT = G.t; pitchStep = Math.min(12, pitchStep + 1);
    switch (k.kind) {
      case 'xp': R.xp += k.v * G.stats.growth * (G.pu.double > 0 ? 1.5 : 1); sfx('pickup', { pitch: Math.pow(2, pitchStep / 12), jitter: 0, gap: 0.02, vol: 0.5 }); break;
      case 'candy': addCandies(k.v); sfx('coin', { vol: 0.5 }); break;
      case 'pad':
        R.pads++; app.save.stats.pads++; app.emit({ type: 'pad' }, R);
        if (G.phase === 'wave') { R.counter -= 5; R.counterPop = 0.2; }
        G.floaters.add(k.x, k.y - 20, G.phase === 'wave' ? '−5 капель!' : 'Прокладка!', { color: '#bfe8ff', size: 22 }); sfx('heal', { pitch: 1.4 }); G.bark('pad');
        break;
      case 'panties':
        app.emit({ type: 'panties', hpBefore: p.hp }, R);
        R.healPity = 0; G.bark('heal'); if (p.hp < G.stats.maxHp) { p.hp++; G.floaters.add(k.x, k.y - 20, '+1 ♥', { color: '#ff9ab8', size: 22 }); } else { addCandies(10); G.floaters.add(k.x, k.y - 20, '+10 конфет', { color: '#ffd166' }); }
        sfx('heal'); break;
      case 'pack': R.frenzy = 8 * G.stats.duration; G.floaters.add(k.x, k.y - 20, 'Скорострельность!', { color: '#ffd166', size: 20 }); sfx('levelup', { pitch: 1.3 }); break;
      case 'cupItem': R.pierceAll = 8 * G.stats.duration; G.floaters.add(k.x, k.y - 20, 'Пробивает всё!', { color: '#ff9ab8', size: 20 }); sfx('levelup', { pitch: 1.5 }); break;
      case 'pu': puPickup(G, k, G.bark); break;
      case 'bell': {
        const c = Math.floor(k.hits / 4) % G.bellCycle;
        if (c === 4) { addCandies(30); p.hp = Math.min(G.stats.maxHp, p.hp + 1); R.shield = true; G.floaters.add(k.x, k.y - 20, 'Двойной приз!', { color: '#ffd166', size: 22 }); sfx('ach', { pitch: 1.6 }); break; }
        if (c === 0) { addCandies(15); G.floaters.add(k.x, k.y - 20, '+15 конфет', { color: '#ffd166' }); }
        else if (c === 1) { p.hp = Math.min(G.stats.maxHp, p.hp + 1); G.floaters.add(k.x, k.y - 20, '+1 ♥', { color: '#ff9ab8' }); }
        else if (c === 2) { R.frenzy = 10; G.floaters.add(k.x, k.y - 20, 'Ярость!', { color: '#c9b0ff' }); }
        else { R.shield = true; G.floaters.add(k.x, k.y - 20, 'Щит!', { color: '#bfe8ff' }); }
        sfx('ach', { pitch: 1.4 }); break;
      }
    }
  }

  function updateFx(dt) {
    for (const f of G.fx) {
      f.t += dt;
      if (f.kind === 'steam' || f.kind === 'geyser') {
        f.tick = (f.tick || 0) - dt;
        if (f.tick <= 0) {
          f.tick = 0.25;
          for (const e of G.enemies) {
            const inside = f.kind === 'geyser' ? Math.abs(e.x - f.x) < f.r * 0.6 + e.r : (e.x - f.x) ** 2 + (e.y - f.y) ** 2 < (f.r + e.r) ** 2;
            if (inside) G.damage(e, f.dps * 0.25, f.src, { tick: true });
          }
          if (G.boss && Math.abs(G.boss.x - f.x) < f.r + G.boss.r && (f.kind === 'geyser' || Math.abs(G.boss.y - f.y) < f.r + G.boss.r)) G.damageBoss(f.dps * 0.25, f.src, { tick: true });
        }
        if (Math.random() < dt * 20) G.parts.spawn({ x: f.x + rand(-f.r, f.r) * (f.kind === 'geyser' ? 0.5 : 0.8), y: f.kind === 'geyser' ? rand(0, GROUND) : f.y + rand(-f.r, f.r) * 0.5, vy: -rand(30, 90), life: 0.7, size: rand(6, 12), size2: 18, color: 'rgba(255,255,255,0.5)' });
      }
    }
  }

  // ---------- Отрисовка ----------
  function drawWorld(ctx) {
    const p = G.p;
    // тряска камеры: сила = травма², сумма синусов (не random)
    const tr = G.trauma * G.trauma * app.save.settings.shake;
    const sx = (0.6 * Math.sin(G.t * 47) + 0.4 * Math.sin(G.t * 89 + 1.3)) * 9 * tr;
    const sy = (0.6 * Math.sin(G.t * 53 + 0.7) + 0.4 * Math.sin(G.t * 97 + 2.1)) * 7 * tr;
    ctx.save(); ctx.translate(sx, sy);
    // параллакс: фон чуть уезжает против движения героини (рисуем с запасом 2 %)
    // фон: cover-масштаб с привязкой к полу и прокруткой за героиней (art/backgrounds.js), плюс прежний лёгкий параллакс
    { const W2 = view.W / 2, pv = view.H * 300 / 540, dx = ((p.x - W2) / W2) * -7; ctx.save(); ctx.translate(W2 + dx, pv); ctx.scale(1.02, 1.02); ctx.translate(-W2, -pv); drawBackgroundView(ctx, chapter().bg, G.t, p.x); ctx.restore(); }
    ctx.fillStyle = chapter().bg === 'lair' ? 'rgba(10,4,16,0.5)' : 'rgba(6,12,20,0.32)'; ctx.fillRect(-20, -20, view.W + 40, view.H + 40); // фон тише врагов (читаемость)
    drawAmbient(ctx, chapter().bg, G.t);
    if (chapter().bg === 'restroom') { ctx.save(); bgPlace(ctx, chapter().bg, p.x); drawGothicAmbient(ctx, G.t); ctx.restore(); } else if (chapter().bg === 'lair') drawLairAmbient(ctx, G.t);
    // пятна на полу
    for (const s of G.stains) { const a = 1 - s.t / s.life; ctx.fillStyle = `rgba(255,122,168,${0.5 * a})`; ctx.beginPath(); ctx.ellipse(s.x, GROUND + 4, s.w / 2, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${0.3 * a})`; ctx.beginPath(); ctx.ellipse(s.x - s.w * 0.15, GROUND + 3, s.w * 0.12, 1.5, 0, 0, TAU); ctx.fill(); }
    // постоянные эффекты под персонажами
    for (const f of G.fx) {
      if (f.kind === 'cup') { const a = Math.min(1, (f.life - f.t) / 0.4); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,154,184,0.25)'; ctx.fillRect(f.x - f.w / 2, GROUND - 60, f.w, 60); drawCup(ctx, f.x, GROUND - 16, f.w / 30, { filled: (f.fill || 0) > 0.05 }); ctx.globalAlpha = 1; }
      if (f.kind === 'steam') { const a = 1 - f.t / f.life; ctx.fillStyle = `rgba(255,240,245,${0.35 * a})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.8 + 0.2 * Math.sin(G.t * 8)), 0, TAU); ctx.fill(); }
      if (f.kind === 'geyser') { const a = 1 - f.t / f.life; ctx.fillStyle = `rgba(255,240,245,${0.4 * a})`; ctx.fillRect(f.x - f.r * 0.6, 0, f.r * 1.2, GROUND); }
    }
    if (G.boss && !G.boss.virtual && !(G.boss.dead && G.boss.drw)) (G.boss.drw || drawBoss)(G, ctx, G.boss);
    if (G.chest) drawChest(ctx, G.chest.x, G.chest.y, 1, G.t);
    for (const e of G.enemies) drawEnemy(G, ctx, e);
    drawPickups(ctx);
    drawShots(G, ctx);
    { const own = G.foes.filter(f => f.own); if (own.length) { const all = G.foes; G.foes = all.filter(f => !f.own); drawFoes(G, ctx); G.foes = all; } else drawFoes(G, ctx); drawOwnFoes(G, ctx); }
    drawLipstickGlow(ctx, G); drawBonusFx(ctx, G);
    if (G.pet && !p.dead) drawPet(ctx, G.pet, G.petId, PET_NOM, { noBubble: true });   // питомец — за героиней
    drawPlayer(ctx, p, G.t);
    if (G.pet && !p.dead && G.pet.bubble && !(G.bubble && G.bubble.t < G.bubble.life)) drawPetBubble(ctx, G.pet, PET_NOM, view.W - 6);
    drawUmbrella(ctx, G);
    if (G.muzzle > 0 && !p.dead) { const m = muzzle(p); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = muzzleColor(G); ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    drawWeaponFx(G, ctx);
    for (const f of G.fx) {
      if (f.kind === 'splat') drawSplat(ctx, f.x, f.y, f.r, f.t / f.life, f.color);
      if (f.kind === 'sweep') { const k = f.t / f.life; ctx.strokeStyle = `rgba(220,200,255,${1 - k})`; ctx.lineWidth = 10 * (1 - k) + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.4 * k), Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    }
    G.parts.draw(ctx);
    G.floaters.draw(ctx);
    // реплика Поппи
    if (G.bubble && !p.dead) {
      const b = G.bubble, L = b.life || 1.8, a = b.t < 0.15 ? b.t / 0.15 : b.t > L - 0.25 ? (L - b.t) / 0.25 : 1;
      const pop = b.t < 0.15 ? 0.3 + 0.8 * (b.t / 0.15) : b.t < 0.22 ? 1.1 - (b.t - 0.15) / 0.07 * 0.1 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      const st = b.style || 'say', fnt = (st === 'think' ? 'italic 800' : '900') + ' 15px Nunito, sans-serif';
      ctx.font = fnt; const w = ctx.measureText(b.s).width + 26;
      const bx = clamp(p.x, w / 2 + 10, view.W - 10 - w / 2), by = p.y - 128 - (G.pu?.umbrella > 0 ? 64 : 0);
      ctx.save(); ctx.translate(bx, by + 16); ctx.scale(pop, pop); ctx.translate(-bx, -by - 16);
      ctx.fillStyle = st === 'think' ? '#e6d9ff' : '#fff';
      if (st === 'shout') {
        ctx.beginPath(); const n = Math.max(10, Math.round(w / 14));
        for (let i = 0; i < n * 2; i++) { const ang = i / (n * 2) * TAU, rr = i % 2 ? 1 : 1.12; const ex = bx + Math.cos(ang) * (w / 2) * rr, ey = by + Math.sin(ang) * 20 * rr; i ? ctx.lineTo(ex, ey) : ctx.moveTo(ex, ey); }
        ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#e0233c'; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 16, w, 32, 14); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(42,10,20,0.35)'; ctx.stroke();
      }
      const tx = clamp(p.x, bx - w / 2 + 14, bx + w / 2 - 14);
      ctx.fillStyle = st === 'think' ? '#e6d9ff' : '#fff';
      if (st === 'think') { for (const [ox, oy, r] of [[0, 22, 5], [-4, 32, 3.5], [-7, 40, 2.5]]) { ctx.beginPath(); ctx.arc(tx + ox, by + oy, r, 0, TAU); ctx.fill(); } }
      else { ctx.beginPath(); ctx.moveTo(tx - 6, by + 14); ctx.lineTo(tx + 2, by + 27); ctx.lineTo(tx + 8, by + 14); ctx.fill(); }
      const jx = st === 'shout' ? Math.sin(G.t * 60) * 1.2 : 0;
      ctx.font = fnt; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = st === 'think' ? '#3a1a5a' : '#2a0a14'; ctx.fillText(b.s, bx + jx, by + 1);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // туман от облака
    if (G.fog > 0) { const a = Math.min(1, G.fog / 1.5) * 0.55; const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, `rgba(200,170,230,${a})`); g.addColorStop(1, `rgba(200,170,230,${a * 0.3})`); ctx.fillStyle = g; ctx.fillRect(0, 0, view.W, GROUND); }
    // темнота (фаза 3 босса): видно только круг вокруг Поппи
    if (G.boss && G.boss.dark > 0) {
      const a = Math.min(1, G.boss.dark / 0.5) * (0.85 + Math.sin(G.t * 23) * 0.05);
      const g = ctx.createRadialGradient(p.x, p.y - 60, 60, p.x, p.y - 60, 220);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(-20, -20, view.W + 40, view.H + 40);
    }
    ctx.restore();
    drawGrade(ctx, { bg: chapter().bg, hp: G.p.dead ? 0 : G.p.hp, maxHp: G.stats.maxHp, t: G.t, fight: true });
    drawPuScreen(ctx, G);
  }

  function drawPickups(ctx) {
    for (const k of G.pickups) {
      const blink = k.t > k.life - 3 && Math.floor(k.t * 10) % 2 === 0; if (blink) continue;
      switch (k.kind) {
        case 'xp': { const s = 3 + Math.min(5, k.v); drawStar(ctx, k.x, k.y, s + Math.sin(k.t * 10) * 0.8, k.v >= 4 ? '#c9b0ff' : '#5ee6c8'); break; }
        case 'candy': drawCandy(ctx, k.x, k.y, 0.9, { rot: k.t * 3 }); break;
        case 'pad': glowItem(ctx, k, '#bfe8ff'); drawPad(ctx, k.x, k.y, 0.9, { rot: k.rot }); break;
        case 'panties': glowItem(ctx, k, '#ff9ab8'); drawPanties(ctx, k.x, k.y, 0.9, { rot: k.rot }); break;
        case 'pack': glowItem(ctx, k, '#ffd166'); for (let i = -1; i <= 1; i++) drawTampon(ctx, k.x + i * 8, k.y, 1, { rot: k.rot }); break;
        case 'cupItem': glowItem(ctx, k, '#ff9ab8'); drawCup(ctx, k.x, k.y, 1.2, { rot: k.rot }); break;
        case 'pu': drawPuToken(ctx, k); break;
        case 'bell': {
          const c = ['#ffd166', '#ff9ab8', '#c9b0ff', '#e8f6ff', '#ff7a1a'][Math.floor(k.hits / 4) % G.bellCycle];
          drawPumpkin(ctx, k.x, k.y, 15, { t: k.t });
          ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(k.x, k.y, 20, 0, TAU); ctx.stroke();
          ctx.font = '800 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,8,24,0.85)'; const lbl = BELL_PRIZE[Math.floor(k.hits / 4) % G.bellCycle];
          ctx.strokeText(lbl, k.x, k.y + 36); ctx.fillStyle = c; ctx.fillText(lbl, k.x, k.y + 36);
          if (k.hits % 4) { for (let i = 0; i < 4; i++) { ctx.fillStyle = i < k.hits % 4 ? c : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(k.x - 9 + i * 6, k.y + 46, 2, 0, TAU); ctx.fill(); } }
          break;
        }
      }
    }
  }
  function glowItem(ctx, k, c) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(k.t * 6); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(k.x, k.y, 26, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }

  // ---------- Сцена ----------
  const scene = {
    enter(game, opts = {}) { G.game = game; game.timeScale = 1; G.slowmo = 0; G.paused = false; if (opts.continue) { scene_continue(opts.chapter); carryStart(); } else startRun(opts.chapter || 0); },
    hasNext: () => G.run.chapter + 1 < CHAPTERS.length, run: () => G.run,
    G,
    update(dt, rdt) {
      const inp = app.inp;
      // тач: джойстик и прыжок работают только пока идёт бой (не пауза, не карточки, не экраны итогов)
      inp.gameplay = !G.paused && !G.p.dead && LIVE.has(G.phase);
      // оверлеи (карточки, смерть, итоги, выбор, пауза) живут в дизайн-рамке → указатель в её координатах
      inp.setSpace(!ovPortrait() && (G.paused || OVERLAY.has(G.phase)) ? view.frame : null);   // в портрете оверлеи на полном виде — указатель в координатах вида
      inp.poll();
      G.trauma = Math.max(0, G.trauma - 1.5 * rdt);
      if (G.slowmo > 0) { G.slowmo -= rdt; if (G.slowmo <= 0) app.game.timeScale = 1; }
      G.phaseT += rdt; tickPuScreen(G, rdt); if (G.rumor && !G.paused && (G.rumor.t += rdt) > G.rumor.life) G.rumor = null;
      if (G.carryNote && (G.carryNote.t += rdt) > 2.6) G.carryNote = null;
      if (inp.pausePressed && !['cards', 'dead', 'chapterClear', 'choice', 'carry'].includes(G.phase)) { G.paused = !G.paused; sfx('select'); }
      if (G.paused) { inp.endStep(); return; }
      switch (G.phase) {
        case 'intro': updateWorld(dt); if (G.phaseT > 1.8) { G.phase = 'wave'; G.phaseT = 0; showRumor(); if (G.runStartBark) { G.bark(G.runStartBark, { force: true }); G.runStartBark = null; } else G.say(chapter().waves[G.run.wave].hint.split('!')[0] + '!', '#fff'); } break;
        case 'wave': updateWorld(dt); break;
        case 'boss':
          updateWorld(dt);
          // Руда на 10 %: бой замирает, выбор «Обнять» / «Добить»
          if (G.boss?.wantChoice && G.phase === 'boss') { G.boss.wantChoice = false; G.phase = 'choice'; G.phaseT = 0; G.choiceSel = 0; sfx('select', { pitch: 0.7 }); }
          break;
        case 'choice': {
          G.t += dt; if (G.boss) G.boss.t += dt; G.parts.update(dt, GROUND); G.floaters.update(dt);
          if (G.bubble) { G.bubble.t += dt; if (G.bubble.t > G.bubble.life) G.bubble = null; }
          if (inp.hit('ArrowLeft') || inp.hit('KeyA')) { G.choiceSel = 0; sfx('select'); }
          if (inp.hit('ArrowRight') || inp.hit('KeyD')) { G.choiceSel = 1; sfx('select'); }
          if (G.phaseT > 0.6) { if (inp.hit('Digit1')) G.choose2(0); else if (inp.hit('Digit2')) G.choose2(1); else if (inp.hit('Enter') || inp.hit('Space')) G.choose2(G.choiceSel); }
          break;
        }
        case 'clear':
          updateWorld(dt);
          if (G.phaseT > 2.6 && !G.pickups.some(p => p.magnet)) {
            if (G.run.wave < chapter().waves.length - 1) startWave(G.run.wave + 1); else startBoss();
          }
          break;
        case 'bossIntro': updateWorld(dt); if (G.phaseT > 2.4) { G.phase = 'boss'; G.phaseT = 0; } break;
        case 'bossDead':
          updateWorld(dt);
          if (G.chest && !G.chest.landed) { G.chest.vy += 600 * dt; G.chest.y += G.chest.vy * dt; if (G.chest.y > GROUND - 20) { G.chest.y = GROUND - 20; G.chest.landed = true; sfx('thud'); } }
          if (G.chest?.landed && Math.abs(G.p.x - G.chest.x) < 50 && G.phaseT > 1) { G.chest = null; G.boss = null; openChest(); }
          if (G.chest?.landed && G.phaseT > 6) { G.chest.x += (G.p.x - G.chest.x) * Math.min(1, dt * 3); } // сам подъедет
          if (G.boss?.noChest && G.phaseT > 3.2) { G.boss = null; chapterClear(); }   // финал: сразу итоги
          break;
        case 'cards': updateCards(rdt); break;
        case 'carry': if (!G.carry) { G.phase = 'intro'; G.phaseT = 0; } else if (carryUpdate(G.carry, inp, rdt) === 'confirm') carryFinish(G.carry); break;
        case 'dead': case 'chapterClear': G.parts.update(rdt, GROUND); G.floaters.update(rdt); break;
      }
      // повышение уровня открывает карты в бою
      if (G.run.pendingLevels > 0 && ['wave', 'boss', 'clear', 'intro'].includes(G.phase) && !G.p.dead && !G.ceasefire) {
        G.bark('levelup'); G.run.pendingLevels--; cocoaWarm(); openCards({ list: buildCards() });
      }
      tutUpdate(app, G, inp, dt);
      inp.endStep();
    },
    updateFrozen(rdt) { G.trauma = Math.max(0, G.trauma - 1.5 * rdt); },
    draw(ctx) {
      const game = app.game, inp = app.inp;
      drawWorld(ctx);
      // HUD и бой — на полном виде (якорь по реальным краям экрана); оверлеи ниже — в дизайн-рамке 960×540 (engine/frame.js)
      if (G.phase !== 'chapterClear' && G.phase !== 'choice' && !app.god?.hideHud) { drawHUD(ctx, G); withHud(ctx, 'tl', () => drawPuHud(ctx, G, HUDBOX.puX, HUDBOX.puY)); }
      app.god?.drawBattle?.(ctx, G);   // режим бога: хитбоксы
      if (G.boss && !G.boss.dead && G.phase !== 'bossIntro') drawBossBar(ctx, G.boss);
      if (G.phase === 'intro') banner(ctx, G.bannerText[0], G.bannerText[1], G.phaseT / 1.8);
      if (G.phase === 'clear') banner(ctx, 'ЧИСТО!', G.run.floorHits === 0 ? 'Ни одной капли на полу! +8 конфет' : null, Math.min(G.phaseT / 2.6, 1), '#5ee6c8');
      if (G.phase === 'bossIntro') banner(ctx, G.boss.name, G.boss.intro || 'Ей не понравился фильм…', G.phaseT / 2.4, '#ff9ad0');
      if (G.phase === 'boss' && G.bloat?.state === 'break' && G.bloat.bonus && BLOAT_WAVES[G.bloat.w + 1]) banner(ctx, `Волна ${G.bloat.w + 1} позади!`, `Бонус: ${PU[G.bloat.bonus].name}`, Math.min(1, G.bloat.t / BLOAT_BREAK), '#ffd166');
      drawRumor(ctx);
      if (G.phase === 'choice') { if (ovPortrait()) { const r = drawRudaChoiceP(ctx, G, inp); if (r >= 0) G.choose2(r); } else withFrame(game, ctx, c => { const r = drawRudaChoice(c, G, inp); if (r >= 0) G.choose2(r); }); }
      if (G.phase === 'bossDead' && G.chest?.landed) { if (ovPortrait()) drawChestHintP(ctx, G, G.t); else text(ctx, 'Подойди к сундуку!', view.W / 2, view.H * 0.555, { size: 24, color: '#ffd166' }); }
      drawTouchControls(ctx, inp);
      // подсказки по управлению: первый забег — микро-туториал (tutorial.js, тач и десктоп); дальше на десктопе — строка внизу в первые секунды главы.
      // Тач-подсказка про кнопку прыжка справа убрана: прыжок теперь тапом в любом месте / пальцем вверх.
      drawTutorial(ctx, app, G);
      if (!G.tut && !inp.isTouch && G.run.wave === 0 && G.run.time < 9 && ['intro', 'wave'].includes(G.phase)) {
        ctx.globalAlpha = Math.min(1, (9 - G.run.time) / 1.5); text(ctx, '← → или A D — бег   ·   Пробел — прыжок   ·   Esc — пауза', view.W / 2, view.H - 20, { size: 14, color: '#f3e2c0', lw: 3 }); ctx.globalAlpha = 1;
      }
      // Оверлеи: ландшафт — дизайн-рамка 960×540 по центру вида (эмбиент по краям); портрет (ovPortrait) — своя раскладка на полном виде 540×H
      if (G.phase === 'cards') {
        if (ovPortrait()) {
          const o = drawCardsP(ctx, G, G.cards, G.cardSel, G.cardAppear, inp); G.cardRects = o.rects;
          if (o.reroll && G.cardAppear > 0.35 && button(ctx, inp, o.reroll.x, o.reroll.y, o.reroll.w, o.reroll.h, `Перебор (${G.run.rerolls})`, { size: 26, color: '#8b5cf6' })) reroll();
        } else withFrame(game, ctx, c => {
          G.cardRects = drawCards(c, G, G.cards, G.cardSel, G.cardAppear);
          if (G.cards && G.run.rerolls > 0 && !G.cards.title && G.cardAppear > 0.35 && button(c, inp, 400, 462, 160, 44, `Перебор (${G.run.rerolls})`, { size: 17, color: '#8b5cf6' })) reroll();
        });
      }
      if (G.phase === 'carry' && G.carry) {   // «Что взять с собой?»: портрет — на полном виде, ландшафт — в дизайн-рамке
        const env = { inp, save: app.save };
        if (ovPortrait()) { if (drawCarryP(ctx, G.carry, env) === 'confirm') carryFinish(G.carry); }
        else withFrame(game, ctx, c => { fillFull(c, 'rgba(15,4,14,0.86)'); if (drawCarryL(c, G.carry, env) === 'confirm') carryFinish(G.carry); });
      }
      if (G.carryNote && G.phase !== 'carry') drawCarryNote(ctx, G.carryNote);
      if (G.phase === 'dead') { if (ovPortrait()) drawDeathP(ctx); else withFrame(game, ctx, drawDeath, { ambient: true }); }
      if (G.phase === 'chapterClear') { if (ovPortrait()) drawChapterClear(ctx, true); else withFrame(game, ctx, drawChapterClear, { ambient: true }); }
      if (G.paused) { if (ovPortrait()) drawPause(ctx, true); else withFrame(game, ctx, drawPause); }
    },
  };
  // Сцена боя рисуется на ПОЛНОМ виде (арена = view.W, пол = view.ground); портретную раскладку делает сама (HUD, джойстик).
  scene.frame = false; scene.portraitLayout = true;
  // Оверлеи боя (карточки, смерть, итоги, выбор Руды, пауза, подсказка сундука): в портрете рисуются сами на полном виде (overlays_p.js, death_p.js);
  // false — вернуть старую заглушку (дизайн-рамка 960×540 с эмбиентом). Ландшафт всегда в дизайн-рамке.
  scene.overlayPortraitLayout = true;
  const ovPortrait = () => view.portrait && scene.overlayPortraitLayout;
  const OVERLAY = new Set(['cards', 'dead', 'chapterClear', 'choice', 'carry']);
  const LIVE = new Set(['intro', 'wave', 'clear', 'boss', 'bossIntro', 'bossDead']);

  // Смена размера окна / поворот телефона во время боя: позиции переносятся с сохранением относительного места
  // (по x — пропорционально ширине арены, у пола — на то же расстояние от пола, выше — растяжением), без «телепортов».
  onViewChange((v, prev) => {
    if (!G.run || !G.p) return;
    if (![v.W, prev.W, prev.ground, v.ground].every(n => Number.isFinite(n) && n > 0)) { sanitizeWorld(G, app.game, 'смена вида (невалидные размеры)'); return; }
    const fx = v.W / prev.W, g0 = prev.ground, g1 = v.ground, k0 = g0 - 250, ky = k0 > 0 ? (g1 - 250) / k0 : 1;
    const mx = x => x * fx, my = y => y >= k0 ? y + (g1 - g0) : y * ky;
    const mv = o => { if (!o) return; for (const k of ['x', 'baseX', 'hugX', 'tx']) if (typeof o[k] === 'number') o[k] = mx(o[k]); for (const k of ['y', 'hoverY']) if (typeof o[k] === 'number') o[k] = my(o[k]); };
    mv(G.p); mv(G.pet); mv(G.chest); mv(G.boss);
    for (const arr of [G.enemies, G.shots, G.foes, G.pickups, G.fx]) for (const o of arr || []) mv(o);
    for (const s of G.stains || []) s.x = mx(s.x);
    if (G.boss) { for (const s of G.boss.slams || []) if (typeof s.x === 'number') s.x = mx(s.x); for (const w of G.boss.waves || []) w.x = mx(w.x); G.boss.rain = null; if (G.boss.letters) G.boss.letters = null; }
    for (const e of G.enemies || []) if (e.aim) { e.aim.x = mx(e.aim.x); e.aim.y = my(e.aim.y); }
    G.p.x = clamp(G.p.x, ARENA.left + G.p.w / 2, ARENA.right - G.p.w / 2);
    if (G.p.y > GROUND) G.p.y = GROUND;
    if (G.pet) G.pet.placed = false;
    if (G.rv && !!G.rv.p !== !!(v.portrait && scene.overlayPortraitLayout)) G.rv = null;   // раскрытие награды на экране смерти рассчитано под другую раскладку — начнётся заново (в конце состояния)
    sanitizeWorld(G, app.game, 'после смены вида');   // самолечение: NaN / улетевшие за вид / провалившиеся под пол (viewguard.js)
  });

  function updateCards(rdt) {
    const inp = app.inp; G.cardAppear += rdt;
    const n = G.cards.list.length;
    if (inp.hit('ArrowLeft') || inp.hit('KeyA')) { G.cardSel = (G.cardSel + n - 1) % n; sfx('select'); }
    if (inp.hit('ArrowRight') || inp.hit('KeyD')) { G.cardSel = (G.cardSel + 1) % n; sfx('select'); }
    // после выбора экран карт закрыт — сразу выходим (иначе обращение к G.cards === null)
    for (let i = 0; i < n; i++) if (inp.hit('Digit' + (i + 1))) return choose(i);
    if (G.cardAppear > 0.35 && (inp.hit('Enter') || inp.hit('Space'))) return choose(G.cardSel);
    if (G.cardRects && G.cardAppear > 0.35) for (let i = 0; i < G.cardRects.length; i++) {
      const r = G.cardRects[i], p = inp.pointer, over = p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
      if (over && !inp.isTouch) G.cardSel = i;
      if (over && p.pressed) return choose(i);
    }
    if (G.run.rerolls > 0 && !G.cards.title && G.cardAppear > 0.35 && inp.hit('KeyR')) reroll();
  }
  // выбор в финале: 0 — обнять, 1 — добить
  G.choose2 = (i) => {
    if (G.phase !== 'choice' || !G.boss) return;
    G.run.ending = i === 0 ? 'hug' : 'war'; G.phase = 'boss'; G.phaseT = 0;
    sfx('select', { pitch: 1.3 }); G.boss.resolve?.(G, G.run.ending);
    app.emit({ type: 'ending', ending: G.run.ending }, G.run);
  };
  function reroll() { G.run.rerolls--; G.cards = { list: buildCards() }; G.cardAppear = 0; sfx('whoosh'); }
  function choose(i) {
    const c = G.cards.list[i]; if (!c) return;
    applyCard(c); sfx('select', { pitch: 1.4 });
    if (G.cards.bonusCandies) addCandies(G.cards.bonusCandies);
    const after = G.cards.after; G.cards = null;
    if (after === 'chapterClear') chapterClear(); else G.phase = G.prevPhase;
  }

  function drawDeath(ctx) {
    const T = G.phaseT, S = app.save;
    // раскрытие награды: своё на каждую смерть (новый забег или время фазы пошло заново)
    if (!G.rv || G.rv.run !== G.run || T < (G.rv.lastT ?? 0)) { ensureOffers(S); G.rv = revealStart(S, { mode: 'death', earned: G.run.candies, gift: G.run.gift, jar: { x: 884, y: 130 }, bag: { x: 912, y: 194 }, run: G.run }); }
    const rv = G.rv; rv.lastT = T; revealTick(rv, Math.max(0, T - 0.3));
    const k = Math.min(1, T / 0.4);
    fillFull(ctx, `rgba(30,0,10,${0.75 * k})`);
    if (T < 0.2) return;
    // экран смерти оригинала: девочка на закате (вектор с Sprite19) и надпись от руки
    ctx.globalAlpha = Math.min(1, (T - 0.2) / 0.4); drawSceneBg(ctx, 'dead'); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(20,0,8,0.42)'; ctx.fillRect(0, 0, 960, 540);
    text(ctx, 'не сдавайся!', 36, 58, { size: 38, align: 'left', color: '#fff', weight: 700, outline: 'rgba(40,0,10,0.6)', lw: 4 });
    text(ctx, 'попробуй ещё раз', 36, 98, { size: 28, align: 'left', color: '#ffe6ef', weight: 700, outline: 'rgba(40,0,10,0.6)', lw: 4 });
    if (G.deathLine) { ctx.font = '800 16px Nunito, sans-serif'; wrap(ctx, '«' + G.deathLine + '»', 440, 16, 800).slice(0, 2).forEach((ln, i) => text(ctx, ln, 36, 138 + i * 21, { size: 16, align: 'left', color: '#ffd0dc', weight: 800, outline: 'rgba(40,0,10,0.6)', lw: 3 })); }
    // «как близко была победа» (Cuphead)
    const nw = chapter().waves.length, total = nw + 1, done = G.boss ? nw + (1 - Math.max(0, G.boss.hp) / G.boss.maxHp) : G.run.wave + (1 - Math.max(0, G.run.counter) / G.run.counterStart);
    const pct = Math.round(done / total * 100);
    panel(ctx, 520, 20, 410, 166);
    text(ctx, `До конца главы: ${pct}%`, 725, 44, { size: 20 });
    ctx.fillStyle = '#4a1a3a'; ctx.beginPath(); ctx.roundRect(545, 60, 360, 12, 6); ctx.fill();
    ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.roundRect(545, 60, 360 * pct / 100, 12, 6); ctx.fill();
    text(ctx, `Уровень ${G.run.level} · серия ${G.run.bestCombo} · капель сбито ${G.run.kills}`, 725, 92, { size: 14, color: '#ffe6ef', outline: false, weight: 700 });
    drawRevealCandies(ctx, rv, S, 545, 130);
    drawGiftLine(ctx, rv, 545, 154);   // «Утешительный приз +N» (первая смерть и короткие забеги): отдельной строкой под «+N конфет за забег»
    if (G.lastHurt) text(ctx, `Подвело: ${G.lastHurt === 'Протечка' ? 'протечка (счётчик капель вырос)' : (HURT_NAMES[G.lastHurt] || G.lastHurt)}`, 725, 177, { size: 13, color: '#ffb0c0', outline: false, weight: 700 });
    drawOffers(ctx, 204);
    const fin = revealDone(rv);
    const binp = T < 0.6 ? NO_INP : app.inp;   // первые 0,6 с кнопки не нажимаются (игрок ещё лихорадочно тапает по полю боя — как в портретном экране смерти, death_p.js)
    if (button(ctx, binp, 300, 448, 170, 52, 'Ещё раз', { color: '#ff5d8f' }) || (fin && app.inp.uiHit('Enter'))) { startRun(G.run.chapter); return; }
    if (button(ctx, binp, 490, 448, 170, 52, 'В меню', { color: '#8b5cf6' })) { app.goMenu(); return; }
    // клик мимо кнопок или Enter / Пробел — сразу к концу раскрытия
    if (!fin && T > 0.45 && (app.inp.pointer.clicked || app.inp.uiHit('Enter') || app.inp.uiHit('Space'))) { app.inp.pointer.clicked = false; revealSkip(rv); }
  }
  // витрина Косметички с раскрытием: 3 предложения (1 сила + 2 разнообразие), обновляется после каждого забега.
  // Работает и на итогах главы: G.rv = revealStart(S, { mode: 'clear', ... }) + revealTick, затем drawOffers(ctx, y)
  const NO_INP = { pointer: { x: -9999, y: -9999, down: false, clicked: false } };
  function drawOffers(ctx, y, rv = G.rv) {
    const S = app.save; if (!rv) return;
    const res = drawRevealOffers(ctx, rv, S, {
      y, inp: app.inp, header: rv.mode === 'clear' ? 'Награда за победу!' : 'Награда за смелость!',
      btn: (label, bx, by, bw, bh, o) => button(ctx, o.fake ? NO_INP : app.inp, bx, by, bw, bh, label, { size: 16, color: o.color || '#7a0d18', disabled: o.disabled }),
      shuffleBtn: (bx, by, bw, bh) => button(ctx, app.inp, bx, by, bw, bh, `↻ перетасовать · ${SHUFFLE_PRICE}`, { size: 13, color: '#5a3a8a', disabled: S.candies < SHUFFLE_PRICE }),
    });
    if (res.shuffle && shuffleOffers(S)) { app.persist(); sfx('whoosh'); }
    if (res.buy && buyOffer(S, res.buy)) { revealBought(rv, res.buy); app.persist(); sfx('coin', { pitch: 1.3 }); app.emit({ type: 'metaBuy' }); computeStats(); }
  }
  // Портретный экран смерти (death_p.js): покупки и перетасовка — те же функции экономики, что и в ландшафте (drawOffers)
  function offerActions(res, rv) {
    const S = app.save;
    if (res.shuffle && shuffleOffers(S)) { app.persist(); sfx('whoosh'); }
    if (res.buy && buyOffer(S, res.buy)) { revealBought(rv, res.buy); app.persist(); sfx('coin', { pitch: 1.3 }); app.emit({ type: 'metaBuy' }); computeStats(); }
  }
  const deathEnv = { G, app, chapter: () => chapter(), HURT_NAMES, startRun: ch => startRun(ch), act: offerActions };
  const drawDeathP = ctx => drawDeathPortrait(ctx, deathEnv);
  function drawChapterClear(ctx, portrait = false) {
    const fin = G.run.chapter === CHAPTERS.length - 1;
    const title = fin ? (G.run.ending === 'hug' ? 'Мир!' : 'Победа!') : 'Сеанс окончен!', titleColor = fin && G.run.ending === 'hug' ? '#ff9ab8' : '#5ee6c8';
    const line = G.clearLine ? `«${G.clearLine}»` : `Глава «${chapter().name}» пройдена`;
    const R = G.run, m = Math.floor(R.chapterTime / 60), s = Math.floor(R.chapterTime % 60);
    const rows = [['Время', `${m}:${String(s).padStart(2, '0')}`], ['Уровень', R.level], ['Капель сбито', R.kills], ['Лучшая серия', R.bestCombo], ['Конфет заработано', R.candies]];
    const NEXT = ['Дальше — очередь в туалет и глава 2 «Улица»', 'Дальше — заброшенный замок и глава 3 «Готика»', 'Дальше — логово Руды. Финал',
      G.run.ending === 'hug' ? 'Концовка «Мир»: Руда вернётся через месяц — с чаем и пледом' : 'Концовка «Война»: Руда обещала вернуться через 28 дней'];
    if (portrait) { if (drawClearP(ctx, { inp: app.inp, title, titleColor, line, rows, next: NEXT[G.run.chapter] || '' }) || app.inp.uiHit('Enter')) app.afterChapter(G.run.chapter); return; }
    drawSceneBg(ctx, 'victory'); ctx.fillStyle = 'rgba(20,4,18,0.55)'; ctx.fillRect(0, 0, 960, 540);
    text(ctx, title, 480, 90, { size: 48, color: titleColor });
    text(ctx, line, 480, 132, { size: 18, color: '#ffd0dc' });
    panel(ctx, 260, 165, 440, 190);
    rows.forEach(([a, b], i) => { text(ctx, a, 290, 195 + i * 32, { size: 18, align: 'left', weight: 700, outline: false, color: '#ffe6ef' }); text(ctx, String(b), 670, 195 + i * 32, { size: 20, align: 'right', color: '#ffd166' }); });
    text(ctx, NEXT[G.run.chapter] || '', 480, 385, { size: 15, color: '#c9b0ff', outline: false, weight: 700 });
    if (button(ctx, app.inp, 395, 420, 170, 56, 'Дальше', { color: '#ff5d8f' }) || app.inp.uiHit('Enter')) app.afterChapter(G.run.chapter);
  }
  function drawPause(ctx, portrait = false) {
    if (portrait) {
      const r = drawPauseP(ctx, app.inp, app.save.settings.sfx > 0);
      if (r === 'cont') G.paused = false; else if (r === 'sound') app.toggleSound(); else if (r === 'quit') { G.paused = false; die(); }
      return;
    }
    fillFull(ctx, 'rgba(15,4,14,0.7)');
    text(ctx, 'Пауза', 480, 140, { size: 48 });
    if (button(ctx, app.inp, 380, 200, 200, 56, 'Продолжить')) { G.paused = false; }
    if (button(ctx, app.inp, 380, 270, 200, 56, app.save.settings.sfx > 0 ? 'Звук: вкл' : 'Звук: выкл', { color: '#8b5cf6' })) app.toggleSound();
    if (button(ctx, app.inp, 380, 340, 200, 56, 'Сдаться', { color: '#5a4a58' })) { G.paused = false; die(); }
  }

  // Пауза по клику на HUD-кнопку не делаем: Esc/P и потеря фокуса
  // автопауза: вкладка/приложение свёрнуты (visibilitychange) или окно потеряло фокус (blur: переключились в другое окно, нажали на рекламный iframe) — бой не идёт без игрока
  const autoPause = () => { if (app.cur?.() === scene && ['wave', 'boss', 'intro'].includes(G.phase)) G.paused = true; };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  addEventListener('blur', autoPause);

  // Хуки для автотестов (develop-web-game)
  scene.toText = () => ({
    coords: `origin top-left, x→right, y→down, view ${view.W}x${view.H}${view.portrait ? ' (portrait)' : ''}, floor y=${GROUND}`,
    phase: G.phase, chapter: G.run.chapter, wave: G.run.wave + 1, counter: Math.ceil(G.run.counter),
    player: { x: Math.round(G.p.x), y: Math.round(G.p.y), hp: G.p.hp, maxHp: G.stats.maxHp, onGround: G.p.onGround },
    level: G.run.level, xp: Math.round(G.run.xp), xpNext: G.run.xpNext, candies: G.run.candies, combo: G.run.combo,
    weapons: G.run.weapons.map(w => w.id + ':' + w.lv), passives: G.run.passives.map(p => p.id + ':' + p.lv),
    enemies: G.enemies.slice(0, 30).map(e => ({ t: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp) })),
    boss: G.boss ? { hp: Math.round(G.boss.hp), phase: G.boss.phase, state: G.boss.state } : null,
    ending: G.run.ending || null, cards: G.cards ? G.cards.list.map(c => c.name) : null, carry: G.carry ? { limit: G.carry.limit, items: G.carry.items.map(i => i.id + ':' + i.lv + ':' + (i.keep ? 1 : 0)) } : null, hurtBy: G.run.hurtBy || {}, kills: G.run.kills, time: Math.round(G.run.time), shots: G.shots.length, pickups: G.pickups.length,
  });
  scene.choose = choose;
  scene.hooks = { openCards, buildCards, die, openChest, chapterClear, startRun, carryStart, carryFinish };   // для автотестов (tools/portover.mjs)
  scene.godHooks = { computeStats, startWave, startBoss, waveClear, continueRun, openCards, buildCards, die, openChest, chapterClear, startRun, carryStart };   // режим бога (god.js)
  return scene;
}

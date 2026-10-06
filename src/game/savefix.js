// Нормализация сохранения после загрузки (QA): старые версии, ломаные поля, null, массивы вместо объектов, мусор и «раздутые» сейвы.
// Цель — игра никогда не падает на данных из localStorage и не показывает NaN/undefined; конфеты и стразы не теряются и не растут из ничего.
// Вызывается один раз в main.js сразу после loadSave (loadSave уже отбросил несовместимые по типу значения и опасные ключи).
import { DEFAULT_SAVE, WARDROBE, CHAPTERS } from './data.js';
import { META_POWER, META_VARIETY, metaById } from './meta.js';
import { ACHIEVEMENTS } from './achievements.js';
import { ensureGems } from './gems.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0, lo = 0, hi = 1e9) => { v = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? +v : NaN); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const int = (v, d = 0, lo = 0, hi = 1e9) => Math.floor(num(v, d, lo, hi));
const KNOWN_EXTRA = ['acc', 'offers', 'starter', 'offerShuffled', 'hints', 'barkMem', 'carryHintDone', 'touchHintDone'];   // не из DEFAULT_SAVE, но нужные игре
const MAX_UNKNOWN = 20000;   // символов JSON на один неизвестный ключ (дальше — выбрасываем: «раздутый» сейв тормозил бы каждую запись)

export function normalizeSave(s) {
  // --- числа и валюты ---
  s.candies = int(s.candies, 0);
  s.gems = int(s.gems, 0); ensureGems(s);
  s.gemTokens = (Array.isArray(s.gemTokens) ? s.gemTokens : []).filter(t => typeof t === 'string' && t.length < 200).slice(-40);
  s.gemsInit = !!s.gemsInit;
  // --- Косметичка: ранги не выше максимума, неизвестные id отбрасываются ---
  const meta = {}; const rawMeta = isObj(s.meta) ? s.meta : {};
  for (const m of META_POWER) { const r = int(rawMeta[m.id], 0, 0, m.max); if (r) meta[m.id] = r; }
  for (const m of META_VARIETY) if (rawMeta[m.id]) meta[m.id] = 1;
  s.meta = meta;
  // --- достижения и открытое ---
  const ach = {}; const rawAch = isObj(s.ach) ? s.ach : {};
  for (const a of ACHIEVEMENTS) if (rawAch[a.id] === true || rawAch[a.id] === 1) ach[a.id] = true;
  s.ach = ach;
  const unl = {}; if (isObj(s.unlocked)) for (const k of Object.keys(s.unlocked)) if (s.unlocked[k] === true && k.length < 40) unl[k] = true;
  s.unlocked = unl;
  // --- счётчики ---
  const stats = isObj(s.stats) ? s.stats : {}, st = {};
  for (const k of new Set([...Object.keys(DEFAULT_SAVE.stats), ...Object.keys(stats)])) { const v = int(stats[k], 0); if (k in DEFAULT_SAVE.stats || typeof stats[k] === 'number') st[k] = v; }
  s.stats = st;
  const best = isObj(s.best) ? s.best : {}, bt = {};
  for (const k of new Set([...Object.keys(DEFAULT_SAVE.best), ...Object.keys(best)])) { const v = int(best[k], 0); if (k in DEFAULT_SAVE.best || typeof best[k] === 'number') bt[k] = v; }
  s.best = bt;
  // --- настройки ---
  const se = isObj(s.settings) ? s.settings : {};
  s.settings = { ...se, sfx: num(se.sfx, DEFAULT_SAVE.settings.sfx, 0, 1), music: num(se.music, DEFAULT_SAVE.settings.music, 0, 1), shake: num(se.shake, DEFAULT_SAVE.settings.shake, 0, 1), numbers: se.numbers !== false };
  s.seenIntro = !!s.seenIntro; s.firstDeathGift = !!s.firstDeathGift;
  // --- наряд, поза, прогресс ---
  const w = WARDROBE.find(x => x.id === s.outfit);
  s.outfit = w && (!w.unlock || s.ach[w.unlock]) ? w.id : 'lara';
  s.facing = s.facing === 'back' ? 'back' : 'front';
  s.progress = int(s.progress, 0, 0, CHAPTERS.length - 1);
  s.hero = 'new';
  const tu = isObj(s.tutorial) ? s.tutorial : {}; s.tutorial = { move: !!tu.move, jump: !!tu.jump };
  // --- витрина Косметички ---
  if (s.offers !== undefined) {
    const ok = Array.isArray(s.offers) && s.offers.length <= 3 && s.offers.every(id => typeof id === 'string' && metaById(id)) && new Set(s.offers).size === s.offers.length;
    if (!ok) delete s.offers;   // ensureOffers (meta.js) соберёт заново
  }
  if (s.starter != null && !(typeof s.starter === 'string' && metaById(s.starter))) s.starter = null;
  if (s.offerShuffled !== undefined) s.offerShuffled = !!s.offerShuffled;
  if (s.carryHintDone !== undefined) s.carryHintDone = !!s.carryHintDone;
  if (s.hints !== undefined) { const h = {}; if (isObj(s.hints)) for (const k of Object.keys(s.hints)) if (s.hints[k] === true && k.length < 40) h[k] = true; s.hints = h; }
  if (s.barkMem !== undefined && !isObj(s.barkMem)) delete s.barkMem;
  // --- аксессуары: только структура (ensureAcc сам разбирает старые предметы и возвраты) ---
  if (s.acc !== undefined) {
    const a = isObj(s.acc) ? s.acc : {}; s.acc = { owned: isObj(a.owned) ? a.owned : {}, equip: isObj(a.equip) ? a.equip : {}, pity: int(a.pity, 0, 0, 1000) };
    for (const k of Object.keys(s.acc.owned)) if (typeof s.acc.owned[k] !== 'string') delete s.acc.owned[k];
    for (const k of Object.keys(s.acc.equip)) if (typeof s.acc.equip[k] !== 'string') s.acc.equip[k] = null;
  }
  // --- «раздутые» неизвестные ключи ---
  for (const k of Object.keys(s)) {
    if (k in DEFAULT_SAVE || KNOWN_EXTRA.includes(k) || k.startsWith('god')) continue;
    let n = 0; try { n = JSON.stringify(s[k])?.length || 0; } catch { n = Infinity; }
    if (n > MAX_UNKNOWN) delete s[k];
  }
  return s;
}

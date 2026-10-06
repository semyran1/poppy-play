// «Самолечение» боя при смене вида (поворот телефона, адресная строка, нулевые размеры): после перерасчёта и раз в кадр проверяем
// состояние боя и возвращаем в допустимое, вместо того чтобы дать героине/врагам/снарядам «уехать» (NaN, за экран, под пол).
// Вызывается: play.js → onViewChange (сразу после переноса позиций) и main.js (страж, каждый шаг, пока идёт бой).
// Возвращает число исправлений; каждая причина пишется в game.errors (не чаще раза в секунду на причину), игра не падает.
import { view } from '../engine/core.js';
import { ARENA, GROUND } from './player.js';

const fin = Number.isFinite;
const lastLog = new Map();
function note(game, reason) {
  const now = performance.now(), t = lastLog.get(reason) || -1e9;
  if (now - t < 1000) return; lastLog.set(reason, now);
  const m = '[viewguard] ' + reason; console.warn(m);
  if (game?.errors) { game.errors.push(m); if (game.errors.length > 20) game.errors.shift(); }
}

// Допустимые границы
const lim = () => ({ W: view.W, H: view.H, gy: view.ground, left: ARENA.left, right: ARENA.right });

// Героиня: возвращаем на землю по центру/ближайшую допустимую точку
export function sanitizePlayer(p, game, why = '') {
  if (!p) return 0; let n = 0; const L = lim();
  const half = (fin(p.w) ? p.w : 30) / 2;
  for (const k of ['vx', 'vy']) if (!fin(p[k])) { p[k] = 0; n++; }
  for (const k of ['sx', 'sy']) if (!fin(p[k]) || p[k] < 0.2 || p[k] > 3) { p[k] = 1; n++; }
  if (!fin(p.face) || p.face === 0) { p.face = 1; n++; }
  for (const k of ['iframes', 'hurtFlash', 'runT', 'runU', 'coyote', 'jumpBuf']) if (!fin(p[k])) { p[k] = 0; n++; }
  if (!fin(p.x)) { p.x = L.W / 2; p.vx = 0; n++; note(game, `p.x не конечен ${why}`); }
  if (!fin(p.y)) { p.y = L.gy; p.vy = 0; p.onGround = true; n++; note(game, `p.y не конечен ${why}`); }
  const x = Math.max(L.left + half, Math.min(L.right - half, p.x));
  if (x !== p.x) { if (Math.abs(x - p.x) > 2) n++; p.x = x; }
  if (p.y > L.gy) { p.y = L.gy; if (p.vy > 0) p.vy = 0; p.onGround = true; n++; }
  else if (p.y < L.gy - Math.max(900, L.H)) { note(game, `героиня улетела вверх y=${p.y.toFixed(0)} ${why}`); p.y = L.gy; p.vy = 0; p.onGround = true; n++; }
  if (L.right - half < L.left + half) p.x = L.W / 2;   // арена вырождена (крошечный вид)
  return n;
}

// Враг/снаряд/подбираемое/эффект с произвольными координатами: не конечные — в безопасное место; улетевшие далеко — возвращаем/удаляем
function fixThing(o, kind, game, p) {
  const L = lim(); let bad = false;
  const far = !fin(o.x) || !fin(o.y) || o.x < -2500 || o.x > L.W + 2500 || o.y < -3000 || o.y > L.H + 2500;
  if (!far) return 0;
  bad = true;
  if (kind === 'shots' || kind === 'foes' || kind === 'fx') { o.dead = true; if (kind === 'fx') o.t = o.life ?? 1e9; }
  else if (kind === 'pickups') { o.x = fin(p?.x) ? p.x : L.W / 2; o.y = L.gy - 60; o.vx = 0; o.vy = 0; }
  else { o.x = Math.max(L.left, Math.min(L.right, fin(o.x) ? o.x : L.W / 2)); o.y = Math.min(L.gy - (o.r || 20), fin(o.y) ? Math.max(-100, o.y) : L.gy * 0.4); if (fin(o.vx)) o.vx = o.vx; else o.vx = 0; if (!fin(o.vy)) o.vy = 0; }
  return bad ? 1 : 0;
}

export function sanitizeWorld(G, game, why = '') {
  if (!G || !G.p || !G.run) return 0;
  let n = sanitizePlayer(G.p, game, why); const L = lim();
  for (const [name, arr] of [['enemies', G.enemies], ['shots', G.shots], ['foes', G.foes], ['pickups', G.pickups], ['fx', G.fx]]) {
    if (!arr) continue; let c = 0;
    for (const o of arr) if (o && typeof o === 'object') c += fixThing(o, name, game, G.p);
    if (c) { n += c; note(game, `${name}: ${c} улетевших возвращено/убрано ${why}`); }
  }
  const pet = G.pet;
  if (pet && (!fin(pet.x) || !fin(pet.y) || pet.x < -1500 || pet.x > L.W + 1500 || pet.y < -1500 || pet.y > L.H + 1500)) { pet.x = G.p.x; pet.y = G.p.y; pet.placed = false; if ('vx' in pet) pet.vx = 0; if ('vy' in pet) pet.vy = 0; n++; note(game, `питомец улетел ${why}`); }
  const ch = G.chest;
  if (ch && (!fin(ch.x) || !fin(ch.y) || ch.x < 0 || ch.x > L.W || ch.y > L.gy + 2 || ch.y < -200)) {
    ch.x = Math.max(60, Math.min(L.W - 60, fin(ch.x) ? ch.x : L.W / 2));
    if (!fin(ch.y) || ch.y > L.gy + 2 || ch.y < -200) { ch.y = L.gy; if ('vy' in ch) ch.vy = 0; }
    n++; note(game, `сундук вне вида ${why}`);
  }
  const b = G.boss;
  if (b && !b.virtual && (!fin(b.x) || !fin(b.y) || b.x < -600 || b.x > L.W + 600 || b.y < -1500 || b.y > L.H + 300)) {
    b.x = Math.max(80, Math.min(L.W - 80, fin(b.x) ? b.x : L.W / 2)); b.y = Math.max(-100, Math.min(L.gy - 120, fin(b.y) ? b.y : L.gy * 0.4));
    if ('vx' in b && !fin(b.vx)) b.vx = 0; if ('vy' in b && !fin(b.vy)) b.vy = 0; if ('baseX' in b) b.baseX = b.x; if ('hoverY' in b) b.hoverY = b.y;
    n++; note(game, `босс вне вида ${why}`);
  }
  return n;
}

// Страж: «героиня не рисуется». drawPlayer пишет globalThis.__heroDraw.n; если бой идёт, героиня жива, а счётчик не растёт > 1 с — лечим состояние.
const watch = { n: -1, t0: 0 };
export function watchHeroDrawn(G, game, live) {
  const now = game.realTime;
  if (!live || !G?.p || G.p.dead || G.paused || game.hitstop > 0) { watch.t0 = now; return; }
  const n = globalThis.__heroDraw ? globalThis.__heroDraw.n : 0;
  if (n !== watch.n) { watch.n = n; watch.t0 = now; return; }
  if (now - watch.t0 > 1.2) {
    watch.t0 = now; const p = G.p;
    note(game, `героиня не рисуется > 1 с (x=${p.x}, y=${p.y}, sx=${p.sx}, sy=${p.sy}, iframes=${p.iframes}); состояние восстановлено`);
    p.x = view.W / 2; p.y = GROUND; p.vx = p.vy = 0; p.sx = p.sy = 1; p.iframes = 0; p.hurtFlash = 0; p.onGround = true; p.face = p.face || 1;
    game.ctxDirty = true;
  }
}

// Экран смерти в портрете (view.portrait): полный вид 540×H. Сверху арт и заголовок, закреплённая банка «в копилке» и косметичка,
// ниже итоги забега списком, затем витрина «Косметичка» столбиком из широких карточек (раскрытие по центру экрана), внизу «Ещё раз» и «В меню».
// Логику покупок и экономику не трогает: покупки/перетасовка выполняет env.act(res, rv) из play.js. Раскладка считается в каждом кадре.
import { view } from '../engine/core.js';
import { clamp } from '../engine/util.js';
import { text, button, panel } from './ui.js';
import { metrics, fitWrap, artCover, fadeBottom } from './overlays_p.js';
import { ensureOffers, SHUFFLE_PRICE, CARD_W, CARD_H, revealStart, revealTick, revealSkip, revealDone, drawRevealOffersP, drawJarCounterP, drawEarnedRowP, drawGiftLine } from './meta.js';

const NO_INP = { pointer: { x: -9999, y: -9999, down: false, clicked: false } };

// Раскладка по высоте вида: сначала всё в минимальном размере, остаток — на полную панель итогов, карточки повыше, арт сверху, паузы между блоками
export function deathLayout(M, hasGift) {
  const H = M.H, fs = M.minF, plan = tight => {
    const g = tight ? 8 : 10, barH = tight ? Math.max(52, M.btnH - 4) : M.btnH, padB = Math.max(M.sb + (tight ? 10 : 14), tight ? 12 : 16), hdrH = M.btnH2 + 4;
    const cardMin = fs + 11 + (tight ? 96 : 98), cardMax = cardMin + 28, rows = tight ? 2 : 3;
    const panelCmp = rows * 28 + 42 + (hasGift ? 34 : 0) + 14, panelFull = 3 * 32 + 48 + (hasGift ? 40 : 0) + 22;
    const topMin = M.top + (tight ? 128 : 140), fixedMin = padB + barH + g * 2.2 + hdrH + 3 * cardMin + 2 * g + g + panelCmp + g;
    return { g, barH, padB, hdrH, cardMin, cardMax, rows, panelCmp, panelFull, topMin, fixedMin, tight };
  };
  let P = plan(false); if (H - P.topMin - P.fixedMin < 0) P = plan(true);
  const { g, barH, padB, hdrH, cardMin, cardMax, panelCmp, panelFull, topMin, fixedMin } = P;
  let extra = H - topMin - fixedMin, panelH = panelCmp, cardH = cardMin, rows = P.rows;
  if (extra > panelFull - panelCmp) { extra -= panelFull - panelCmp; panelH = panelFull; rows = 3; }
  const cg = Math.min(cardMax - cardMin, Math.max(0, extra / 3)); cardH += cg; extra -= cg * 3;
  const topAdd = Math.min(Math.max(0, extra), 340 - topMin + M.top); extra -= topAdd;
  const sp = Math.max(0, extra) / 4;   // остаток — воздух между блоками
  const topH = topMin + topAdd;
  const panelY = topH + g + sp, hdrY = panelY + panelH + g + sp, cardsY = hdrY + hdrH + g * 0.6 + sp * 0.5;
  const barY = H - padB - barH;
  return { topH, panelY, panelH, hdrY, hdrH, cardsY, cardH, g, barY, barH, padB, full: panelH === panelFull, rows, tight: P.tight };
}

// env: { G, app, chapter(), HURT_NAMES, startRun(ch), act(res, rv) }
export function drawDeathP(ctx, env) {
  const { G, app } = env, inp = app.inp, S = app.save, M = metrics(), W = M.W, H = M.H, fs = M.minF;
  const T = G.phaseT, touch = !!inp.isTouch, gift = G.run.gift && G.run.gift.n > 0;
  const Ly = deathLayout(M, gift);
  // пинованные точки: банка (справа сверху), косметичка под ней, откуда летят конфеты — строка «+N конфет»
  const jar = { x: M.R - 26, y: M.top + 36 }, bag = { x: M.R - 56, y: M.top + (Ly.tight ? 88 : 98) };
  const rowH = Ly.full ? 32 : 28, gy = Ly.panelY + 12, ey = gy + Ly.rows * rowH + (Ly.full ? 30 : 26);
  const fly = { x: M.L + 70, y: ey + 6 };
  if (!G.rv || G.rv.run !== G.run || T < (G.rv.lastT ?? 0)) { ensureOffers(S); G.rv = revealStart(S, { mode: 'death', earned: G.run.candies, gift: G.run.gift, jar, bag, flyFrom: fly, run: G.run, portrait: true }); }
  const rv = G.rv; rv.lastT = T; rv.jar = jar; rv.bag = bag; revealTick(rv, Math.max(0, T - 0.3));
  const k = Math.min(1, T / 0.4), grace = T < 0.6;
  const btnInp = grace ? NO_INP : inp;
  ctx.fillStyle = `rgba(30,0,10,${0.8 * k})`; ctx.fillRect(0, 0, W, H);
  if (T < 0.2) return;
  const a0 = Math.min(1, (T - 0.2) / 0.4);
  ctx.save(); ctx.globalAlpha = a0;
  // фон: ниже арта — тёмный бордо; арт сверху с плавным переходом
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a0a18'); bg.addColorStop(1, '#16040e'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const artH = Ly.topH + 40;
  if (!artCover(ctx, 'dead', 0, 0, W, artH, 470, 250)) { ctx.fillStyle = '#4a1a2a'; ctx.fillRect(0, 0, W, artH); }
  ctx.fillStyle = 'rgba(20,0,8,0.30)'; ctx.fillRect(0, 0, W, artH);
  fadeBottom(ctx, 0, artH * 0.5, W, artH * 0.5, '22,4,14', 1);
  // заголовок
  const ts = fitWrap(ctx, 'не сдавайся!', M.w - 130, 1, 42, 28, 700);
  text(ctx, 'не сдавайся!', M.L, M.top + 36, { size: ts.size, align: 'left', color: '#fff', weight: 700, outline: 'rgba(40,0,10,0.6)', lw: 5 });
  text(ctx, 'попробуй ещё раз', M.L, M.top + 36 + ts.size * 0.5 + 18, { size: 28, align: 'left', color: '#ffe6ef', weight: 700, outline: 'rgba(40,0,10,0.6)', lw: 4 });
  let qy = M.top + 36 + ts.size * 0.5 + 18 + 30;
  if (G.deathLine && Ly.topH >= 190) { const q = fitWrap(ctx, '«' + G.deathLine + '»', M.w - 130, 2, 19, fs, 800); q.lines.forEach((ln, i) => text(ctx, ln, M.L, qy + 10 + i * (q.size + 3), { size: q.size, align: 'left', color: '#ffd0dc', weight: 800, outline: 'rgba(40,0,10,0.6)', lw: 4 })); }
  // «как близко была победа»
  const nw = env.chapter().waves.length, total = nw + 1, done = G.boss ? nw + (1 - Math.max(0, G.boss.hp) / G.boss.maxHp) : G.run.wave + (1 - Math.max(0, G.run.counter) / G.run.counterStart);
  const pct = Math.round(clamp(done / total, 0, 1) * 100), bw = M.w - 130, by = Ly.topH - 14;
  text(ctx, `До конца главы: ${pct}%`, M.L, by - 20, { size: fs, align: 'left', color: '#ffe6ef', weight: 800, outline: 'rgba(40,0,10,0.7)', lw: 4 });
  ctx.fillStyle = 'rgba(40,10,34,0.9)'; ctx.beginPath(); ctx.roundRect(M.L, by - 6, bw, 12, 6); ctx.fill();
  ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.roundRect(M.L, by - 6, Math.max(12, bw * pct / 100), 12, 6); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#2a0a14'; ctx.beginPath(); ctx.roundRect(M.L, by - 6, bw, 12, 6); ctx.stroke();
  // итоги забега списком
  panel(ctx, M.L, Ly.panelY, M.w, Ly.panelH, { fill: 'rgba(30,8,24,0.9)', r: 16 });
  const R0 = G.run, m = Math.floor(R0.time / 60), sec = Math.floor(R0.time % 60);
  const hurt = G.lastHurt ? (G.lastHurt === 'Протечка' ? 'протечка' : (env.HURT_NAMES[G.lastHurt] || G.lastHurt)) : '—';
  const items = [['Время', `${m}:${String(sec).padStart(2, '0')}`], ['Волна', G.boss ? 'босс' : `${R0.wave + 1} из ${nw}`], ['Капель сбито', R0.kills], ['Лучшая серия', R0.bestCombo], ['Уровень', R0.level], ['Подвело', hurt]];
  const cw = (M.w - 36) / 2;
  items.slice(0, Ly.rows * 2).forEach(([a, b], i) => {
    const cx0 = M.L + 18 + (i % 2) * cw, cy0 = gy + (i >> 1) * rowH + rowH / 2;
    const vs = fitWrap(ctx, String(b), cw * 0.5 - 8, 1, fs + 3, fs - 3, 900);
    text(ctx, a, cx0, cy0, { size: fs, align: 'left', weight: 700, outline: false, color: '#ffe6ef' });
    text(ctx, String(b), cx0 + cw - 18, cy0, { size: vs.size, align: 'right', color: '#ffd166', lw: 4 });
  });
  ctx.fillStyle = 'rgba(255,170,200,0.16)'; ctx.fillRect(M.L + 16, ey - 20, M.w - 32, 1.5);
  drawEarnedRowP(ctx, rv, M.L + 14, ey + 6, fs);
  drawGiftLine(ctx, rv, M.L + 18, ey + 6 + (Ly.full ? 40 : 34), 1.25);
  ctx.restore();
  // витрина
  const showShuf = !S.offerShuffled && (S.offers || []).length === 3, shufW = 224;
  const rects = [0, 1, 2].map(i => ({ x: M.L, y: Ly.cardsY + i * (Ly.cardH + Ly.g), w: M.w, h: Ly.cardH }));
  const stSc = Math.min(1.75, (M.w - 16) / CARD_W, (H * 0.52) / CARD_H);
  const ui = {
    M, view, header: 'Награда за смелость!', btnH: M.btnH,
    hdr: { x: M.L, y: Ly.hdrY + Ly.hdrH / 2, w: M.w - (showShuf ? shufW + 14 : 0), size: 29 },
    shuf: showShuf ? { x: M.R - shufW, y: Ly.hdrY, w: shufW, h: Ly.hdrH - 4 } : null,
    rects, stage: { cx: M.cx, cy: H * 0.46, sc: stSc },
    btn: (label, bx, by, bw, bh, o) => button(ctx, o.fake ? NO_INP : btnInp, bx, by, bw, bh, label, { size: o.size, color: o.color || '#7a0d18', disabled: o.disabled, dy: o.dy, after: o.after }),
    shuffleBtn: (bx, by, bw, bh) => button(ctx, btnInp, bx, by, bw, bh, `↻ перетасовать · ${SHUFFLE_PRICE}`, { size: fs, color: '#5a3a8a', disabled: S.candies < SHUFFLE_PRICE }),
  };
  const res = drawRevealOffersP(ctx, rv, S, ui);
  env.act(res, rv);
  drawJarCounterP(ctx, rv, S, jar.x, jar.y, fs);
  const fin = revealDone(rv);
  // кнопки внизу: «Ещё раз» — главная
  const bwA = Math.round(M.w * 0.58) - 6, bwB = M.w - bwA - 12;
  if (button(ctx, btnInp, M.L, Ly.barY, bwA, Ly.barH, 'Ещё раз', { color: '#ff5d8f', size: 30 }) || (fin && inp.uiHit('Enter'))) { env.startRun(G.run.chapter); return; }
  if (button(ctx, btnInp, M.L + bwA + 12, Ly.barY, bwB, Ly.barH, 'В меню', { color: '#8b5cf6', size: 28 })) { app.goMenu(); return; }
  if (!touch && !Ly.tight) text(ctx, 'Enter — ещё раз', M.cx, H - Math.max(M.sb + 6, 10) - 6, { size: 15, color: '#c9b0ff', weight: 700, lw: 3 });
  // касание мимо кнопок или Enter / Пробел — сразу к концу раскрытия
  if (!fin && T > 0.45 && (inp.pointer.clicked || inp.uiHit('Enter') || inp.uiHit('Space'))) { inp.pointer.clicked = false; revealSkip(rv); }
}

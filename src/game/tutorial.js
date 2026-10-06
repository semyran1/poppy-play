// Микро-туториал самого первого забега (глава 1, волны 1–2): ненавязчивая плашка под HUD, без паузы игры.
//   1) «Беги от края до края…» — подсвечены края арены; выполнено, когда героиня побывала в левой и правой третях арены (или таймаут 12 с);
//   2) «Тапни в любом месте или потяни палец вверх: прыжок» (десктоп: «Пробел / ↑ — прыжок») — выполнено после первого прыжка (или таймаут 10 с);
//   3) «Поппи стреляет сама» — короткая строка в конце.
// Прогресс — в сейве: save.tutorial = { move, jump }. Показывается только если на старте забега save.stats.runs === 0 (старые сейвы с забегами
// считаются прошедшими, после первой смерти — тоже не показывается) и обе галочки ещё не стоят. Игру не останавливает, ввод не перехватывает.
import { TAU, clamp } from '../engine/util.js';
import { view } from '../engine/core.js';
import { ARENA } from './player.js';
import { text, wrap } from './ui.js';

const DELAY0 = 2.0;        // сек от начала волны до первой подсказки
const DELAY = 0.7;         // пауза между подсказками
const OK_T = 0.9;          // сколько висит галочка после выполнения
const LIMIT = { move: 12, jump: 10, shoot: 3.4 };

// Вызывать на старте забега ДО увеличения stats.runs. Возвращает состояние туториала или null.
export function tutStart(app, chapter) {
  const sv = app.save, T = sv.tutorial || (sv.tutorial = { move: false, jump: false });
  if (chapter !== 0 || sv.stats.runs !== 0 || (T.move && T.jump)) return null;
  const steps = [];
  if (!T.move) steps.push('move');
  if (!T.jump) steps.push('jump');
  steps.push('shoot');
  return { steps, i: 0, state: 'wait', t: 0, delay: DELAY0, a: 0, seenL: false, seenR: false, jumped: false, lastOk: false, ran: false };
}

const cur = T => T.steps[T.i];
function next(T) { T.i++; T.state = 'wait'; T.t = 0; T.delay = DELAY; T.lastOk = false; }

// Каждый шаг симуляции боя (после inp.poll). dt — игровое время.
export function tutUpdate(app, G, inp, dt) {
  const T = G.tut; if (!T) return;
  if (G.run.chapter !== 0 || G.run.wave >= 2 || ['boss', 'bossIntro', 'bossDead'].includes(G.phase) || T.i >= T.steps.length) { if (T.a < 0.02) { G.tut = null; return; } T.state = 'gone'; }
  const live = G.phase === 'wave' && !G.p.dead;
  T.a += ((live && T.state !== 'wait' && T.state !== 'gone' ? 1 : 0) - T.a) * Math.min(1, dt * 7);
  if (T.state === 'gone') return;
  if (inp.jumpPressed) T.jumped = true;
  if (!live) return;
  const sv = app.save, st = cur(T);
  if (T.state === 'wait') {
    T.delay -= dt;
    if (T.delay <= 0) {
      if (st === 'jump' && T.jumped) { sv.tutorial.jump = true; app.persist(); next(T); }   // уже прыгал сам — подсказка не нужна
      else { T.state = 'show'; T.t = 0; T.ran = true; }
    }
    return;
  }
  if (T.state === 'ok') { T.t += dt; if (T.t > OK_T) next(T); return; }
  T.t += dt;
  const third = (ARENA.right - ARENA.left) / 3, px = G.p.x;
  if (st === 'move') {
    if (px < ARENA.left + third) T.seenL = true;
    if (px > ARENA.right - third) T.seenR = true;
    if (T.seenL && T.seenR) { sv.tutorial.move = true; app.persist(); T.state = 'ok'; T.t = 0; T.lastOk = true; }
    else if (T.t > LIMIT.move) { sv.tutorial.move = true; app.persist(); next(T); }
  } else if (st === 'jump') {
    if (inp.jumpPressed) { sv.tutorial.jump = true; app.persist(); T.state = 'ok'; T.t = 0; T.lastOk = true; }
    else if (T.t > LIMIT.jump) { sv.tutorial.jump = true; app.persist(); next(T); }
  } else if (T.t > LIMIT.shoot) next(T);
}

// ---------- рисование ----------
function chevron(ctx, x, y, dir, k = 1) {   // dir: -1 влево, 1 вправо, 0 вверх
  ctx.beginPath();
  if (dir === 0) { ctx.moveTo(x - 9 * k, y + 5 * k); ctx.lineTo(x, y - 5 * k); ctx.lineTo(x + 9 * k, y + 5 * k); }
  else { ctx.moveTo(x - dir * 5 * k, y - 9 * k); ctx.lineTo(x + dir * 5 * k, y); ctx.lineTo(x - dir * 5 * k, y + 9 * k); }
  ctx.stroke();
}
function finger(ctx, x, y, press = 0) {   // «палец»: кольцо касания и тёплая подушечка
  ctx.save();
  ctx.globalAlpha *= 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 14 + press * 5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#ffd9bf'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a0a14'; ctx.stroke();
  ctx.restore();
}
function keycap(ctx, x, y, w, label, on, size = 17) {
  ctx.save(); ctx.translate(x, y + (on ? 2 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(-w / 2, -11 + 3, w, 26, 6); ctx.fill();
  ctx.fillStyle = on ? '#ffd166' : '#f3e2c0'; ctx.beginPath(); ctx.roundRect(-w / 2, -13, w, 26, 6); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#2a0a14'; ctx.stroke();
  text(ctx, label, 0, 1, { size, color: '#2a0a14', outline: false });
  ctx.restore();
}

// Мини-анимации в рамке iw×ih с центром в (0,0); tm — время в сек
function animMove(ctx, touch, tm, iw) {
  if (!touch) {
    const a = Math.sin(tm * 3.2) > 0;
    keycap(ctx, -22, -15, 34, '←', !a); keycap(ctx, 22, -15, 34, '→', a);
    keycap(ctx, -22, 17, 34, 'A', !a); keycap(ctx, 22, 17, 34, 'D', a);
    return;
  }
  const r = iw / 2 - 14, fx = Math.sin(tm * 2.6) * (r - 12);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(243,226,192,0.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-r + 6, 6); ctx.lineTo(r - 6, 6); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = fx < -r * 0.45 ? '#ffd166' : '#fff'; chevron(ctx, -r, 6, -1);
  ctx.strokeStyle = fx > r * 0.45 ? '#ffd166' : '#fff'; chevron(ctx, r, 6, 1);
  for (let k = 1; k <= 3; k++) { ctx.globalAlpha = 0.18 * (4 - k) / 3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.sin((tm - k * 0.06) * 2.6) * (r - 12), 6, 9, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; finger(ctx, fx, 6, 0);
  ctx.restore();
}
function animJump(ctx, touch, tm) {
  if (!touch) { const on = (tm % 1.4) < 0.5; keycap(ctx, -2, -14, 78, 'Пробел', on, 15); keycap(ctx, -2, 18, 34, '↑', !on && (tm % 1.4) > 0.8); return; }
  const k = (tm % 1.5) / 1.5;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // слева: тап (кольцо расходится от точки касания)
  ctx.save(); ctx.translate(-34, 2);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(0, 0, 8 + k * 20, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  finger(ctx, 0, 0, k < 0.2 ? 1 : 0); ctx.restore();
  // справа: палец тянется вверх
  ctx.save(); ctx.translate(34, 0);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(k * TAU); chevron(ctx, 0, -22, 0); ctx.globalAlpha = 1;
  finger(ctx, 0, 14 - 28 * Math.min(1, k * 1.4), 0); ctx.restore();
  ctx.strokeStyle = 'rgba(243,226,192,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
  ctx.restore();
}
function animShoot(ctx, tm) {
  ctx.save(); ctx.fillStyle = '#ffeb7a'; ctx.strokeStyle = '#2a0a14'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const k = ((tm * 1.6 + i / 3) % 1); ctx.globalAlpha = 1 - k * 0.7; ctx.beginPath(); ctx.roundRect(-4, 20 - k * 44, 8, 14, 4); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function animOk(ctx) {
  ctx.save(); ctx.fillStyle = '#5ee6c8'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a0a14'; ctx.stroke();
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-9, 1); ctx.lineTo(-2, 8); ctx.lineTo(10, -7); ctx.stroke();
  ctx.restore();
}

// Подсветка краёв арены на шаге «беги от края до края»: светящиеся полосы и бегущие шевроны; достигнутый край зеленеет
function drawEdges(ctx, G, T, tm) {
  const sf = view.safe, top = sf.t + 20, bot = view.ground, h = bot - top;
  for (const side of [-1, 1]) {
    const seen = side < 0 ? T.seenL : T.seenR, x0 = side < 0 ? 0 : view.W, w = seen ? 50 : 84;
    const g = ctx.createLinearGradient(x0, 0, x0 - side * w, 0);   // от края вглубь экрана
    const col = seen ? '94,230,200' : '255,209,102', pulse = seen ? 0.14 : 0.26 + 0.14 * Math.sin(tm * 4);
    g.addColorStop(0, `rgba(${col},${pulse * T.a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(side < 0 ? 0 : view.W - w, top, w, h);
    ctx.save(); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = seen ? '#5ee6c8' : '#ffd166';
    const my = bot - (view.portrait ? 190 : 160), k = (tm * 1.3) % 1;
    for (let j = 0; j < 3; j++) {
      const q = (k + j / 3) % 1;   // три шеврона бегут к краю и гаснут
      ctx.globalAlpha = (seen ? 0.45 : 0.9) * T.a * Math.sin(q * Math.PI);
      chevron(ctx, side < 0 ? 58 - q * 36 : view.W - 58 + q * 36, my, side, 1.5);
    }
    ctx.restore();
  }
}

export function drawTutorial(ctx, app, G) {
  const T = G.tut;
  if (!T || T.a < 0.02 || G.phase !== 'wave' || G.paused || G.p.dead || T.state === 'wait' || T.state === 'gone') return;
  const touch = app.inp.isTouch, tm = app.game.realTime, st = cur(T);
  const ui = view.uiScale, sf = view.safe, P = view.portrait;
  const Wd = (view.W - sf.l - sf.r) / ui, compact = P || Wd < 800;
  const msg = st === 'move' ? 'Беги от края до края: капли падают по всей ширине'
    : st === 'jump' ? (touch ? 'Тапни в любом месте или потяни палец вверх: прыжок' : 'Пробел / ↑ — прыжок')
    : 'Поппи стреляет сама';
  const iw = st === 'move' ? (touch ? 118 : 100) : st === 'jump' ? (touch ? 128 : 100) : 50;
  const pw = Math.min(Wd - 20, compact && !P ? 560 : 500), size = 19;
  const lines = wrap(ctx, msg, pw - iw - 40, size, 800);
  const ph = Math.max(!touch && st !== 'shoot' ? 76 : 62, lines.length * 24 + 24);
  const cx = sf.l + (view.W - sf.l - sf.r) / 2, topY = P ? 150 : compact ? 124 : 60;
  ctx.save();
  if (st === 'move') drawEdges(ctx, G, T, tm);
  ctx.translate(cx, sf.t + topY * ui); ctx.scale(ui, ui);
  ctx.globalAlpha = clamp(T.a, 0, 1);
  const ok = T.state === 'ok', y = (1 - clamp(T.a, 0, 1)) * -10;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(-pw / 2, y + 5, pw, ph, 16); ctx.fill();
  ctx.fillStyle = 'rgba(30,8,24,0.86)'; ctx.beginPath(); ctx.roundRect(-pw / 2, y, pw, ph, 16); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ok ? '#5ee6c8' : '#ff7aa8'; ctx.stroke();
  ctx.save(); ctx.translate(-pw / 2 + 14 + iw / 2, y + ph / 2);
  if (ok) animOk(ctx); else if (st === 'move') animMove(ctx, touch, tm, iw); else if (st === 'jump') animJump(ctx, touch, tm); else animShoot(ctx, tm);
  ctx.restore();
  const tx = -pw / 2 + 14 + iw + 14, ty0 = y + ph / 2 - (lines.length - 1) * 12;
  lines.forEach((l, i) => text(ctx, l, tx, ty0 + i * 24, { size, align: 'left', color: ok ? '#bfffe9' : '#fff', weight: 800, lw: 4 }));
  ctx.restore();
}

// Ввод: клавиатура + мышь + тач. Игровые оси: move (-1..1, дробное у тача), jump (держится), jumpPressed (фронт).
// Тач в бою (inp.gameplay = true, ставит сцена боя): ПЛАВАЮЩИЙ ДЖОЙСТИК. Касание в левых ~55 % экрана (по CSS-координатам)
// задаёт центр, смещение по X даёт аналоговое движение (мёртвая зона 8 лог. px, полная скорость при 55 px, плавная кривая),
// отпустил — стоп; если палец ушёл далеко (> 80 px) — центр следует за ним. Свайп вверх (начатый левой рукой) — прыжок.
// Правая часть экрана: любое касание = прыжок (держишь — прыжок выше); крупная кнопка (jumpButton) — только подсказка-цель.
// Мультитач: левая рука двигает, правая прыгает одновременно. Вне боя касание — обычный «клик» (pointer.*), как у мыши.
// Указатель: pointer.x/y — в пространстве текущей сцены (дизайн-рамка или вид, см. setSpace), pointer.rx/ry — всегда в виде.
import { view } from './core.js';

export const STICK = { dead: 8, full: 55, follow: 80, zone: 0.55 };   // лог. px; zone — доля ширины окна под джойстик

export function createInput(game) {
  const keys = new Set(), pressed = new Set(), uiPressed = new Set();
  const mq = typeof matchMedia === 'function' ? matchMedia('(hover: none), (pointer: coarse)') : null;
  const inp = {
    move: 0, jump: false, jumpPressed: false, pausePressed: false,
    // pressed — для логики (живёт один шаг симуляции); clicked — для кнопок, которые проверяются при отрисовке
    // (живёт до конца кадра: шагов логики в кадре может быть несколько, и они стёрли бы клик до отрисовки)
    pointer: { x: 0, y: 0, rx: 0, ry: 0, down: false, pressed: false, released: false, clicked: false },
    touchTargetX: null, touchActive: false,   // устарело (старое управление «к пальцу»), оставлено для совместимости
    isTouch: !!mq?.matches,
    gameplay: false,                 // true — касания работают как джойстик/прыжок (ставит сцена боя каждый шаг)
    stick: { active: false, cx: 0, cy: 0, x: 0, y: 0, v: 0 },   // плавающий джойстик (логические координаты вида)
    jumpButton: { x: 880, y: 455, r: 58 },
    pauseButton: null,               // {x,y,r} в координатах вида — ставит HUD (ui.js), касание по ней = пауза
    anyPressed: false,
    space: null,
  };
  game.inp = inp;
  const touches = new Map();

  addEventListener('keydown', e => {
    if (!keys.has(e.code)) { pressed.add(e.code); uiPressed.add(e.code); }
    keys.add(e.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); for (const t of touches.values()) t.dead = true; touches.clear(); inp.stick.active = false; });

  // пространство указателя: null — полный вид, иначе дизайн-рамка {ox,oy,s}: x = (rx − ox)/s
  inp.setSpace = (fr) => {
    inp.space = fr || null; const p = inp.pointer;
    if (fr) { p.x = (p.rx - fr.ox) / fr.s; p.y = (p.ry - fr.oy) / fr.s; } else { p.x = p.rx; p.y = p.ry; }
  };
  function setPos(x, y) { const p = inp.pointer; p.rx = x; p.ry = y; inp.setSpace(inp.space); }

  const c = game.canvas;
  function onDown(id, cx, cy, isTouch) {
    const p = game.toWorld(cx, cy);
    inp.isTouch = isTouch;
    setPos(p.x, p.y); const P = inp.pointer; P.down = true; P.pressed = true; P.clicked = true;
    if (!isTouch) return;
    const t = { sx: p.x, sy: p.y, x: p.x, y: p.y, t: performance.now(), role: 'ui', armed: true };
    const pb = inp.pauseButton;
    if (inp.gameplay && pb && Math.hypot(p.x - pb.x, p.y - pb.y) < pb.r * 1.5) pressed.add('TouchPause');   // кнопка паузы в HUD — не прыжок
    else if (inp.gameplay) {
      const left = (cx - (c.getBoundingClientRect().left)) < view.vw * STICK.zone;
      if (!left) { t.role = 'jump'; pressed.add('TouchJump'); }
      else if (![...touches.values()].some(q => q.role === 'move')) {
        t.role = 'move'; const s = inp.stick; s.active = true; s.cx = p.x; s.cy = p.y; s.x = p.x; s.y = p.y; s.v = 0;
      }
    }
    touches.set(id, t);
  }
  function onMove(id, cx, cy) {
    const p = game.toWorld(cx, cy);
    setPos(p.x, p.y);
    const t = touches.get(id); if (!t) return;
    t.x = p.x; t.y = p.y;
    if (t.role === 'move') {
      const s = inp.stick; s.x = p.x; s.y = p.y;
      const dx = p.x - s.cx; if (Math.abs(dx) > STICK.follow) s.cx = p.x - Math.sign(dx) * STICK.follow;   // центр тянется за пальцем
      // свайп вверх (преобладает вертикаль) = прыжок; повторный — после возврата пальца вниз
      const up = s.cy - p.y;
      if (t.armed && up > 55 && up > Math.abs(p.x - s.cx) * 0.8) { pressed.add('TouchJump'); t.armed = false; t.jumpHold = 20; }   // свайп = «зажатый» прыжок на ~⅓ с (полная высота)
      else if (!t.armed && up < 20) t.armed = true;
    }
  }
  function onUp(id) {
    const t = touches.get(id);
    if (t?.role === 'move') inp.stick.active = false;
    touches.delete(id);
    inp.pointer.down = touches.size > 0; inp.pointer.released = true;
    if (t && inp.isTouch) inp.pointer.leave = true;   // после клика (конец кадра) убираем «наведение»
  }
  c.addEventListener('pointerdown', e => { c.setPointerCapture?.(e.pointerId); onDown(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' || e.pointerType === 'pen' && inp.isTouch); e.preventDefault(); });
  c.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') inp.isTouch = false; onMove(e.pointerId, e.clientX, e.clientY); });
  c.addEventListener('pointerup', e => onUp(e.pointerId));
  c.addEventListener('pointercancel', e => onUp(e.pointerId));
  c.addEventListener('contextmenu', e => e.preventDefault());
  // жесты системы: масштаб, прокрутка-«резинка», выделение
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart']) document.addEventListener(ev, e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

  inp.down = code => keys.has(code);
  inp.hit = code => pressed.has(code);
  inp.uiHit = code => uiPressed.has(code);   // клавиша для кнопок, проверяемых в draw
  inp.endFrame = () => {
    uiPressed.clear(); inp.pointer.clicked = false;
    if (inp.pointer.leave && touches.size === 0) { inp.pointer.leave = false; setPos(-9999, -9999); }
  };

  // Раскладка тач-элементов (логические координаты вида): кнопка прыжка у правого нижнего угла
  inp.layout = () => {
    const ui = view.uiScale, r = 58 * (1 + (ui - 1) * 0.5), safeR = view.safe.r;
    const jb = inp.jumpButton; jb.r = r; jb.x = view.W - safeR - r - 22;
    jb.y = view.portrait ? view.ground - r - 34 : view.ground - r * 0.5 - 6;
    return jb;
  };

  // Вызывать один раз в начале шага симуляции
  inp.poll = () => {
    let m = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) m -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) m += 1;
    inp.touchTargetX = null; inp.touchActive = false;
    const s = inp.stick, now = performance.now();
    if (s.active && inp.gameplay) {
      const d = s.x - s.cx, a = Math.abs(d);
      let v = a <= STICK.dead ? 0 : Math.min(1, (a - STICK.dead) / (STICK.full - STICK.dead));
      v = 0.5 * v + 0.5 * v * v * (3 - 2 * v);   // линейно + сглаженная ступень: мягкий старт, уверенный разгон
      s.v = Math.sign(d) * v; m += s.v; inp.touchActive = true;
    } else s.v = 0;
    inp.move = Math.max(-1, Math.min(1, m));
    let tj = false;
    if (inp.gameplay) for (const t of touches.values()) { if (t.role === 'jump') tj = true; else if (t.jumpHold > 0) { t.jumpHold--; tj = true; } }
    inp.jump = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space') || tj;
    inp.jumpPressed = pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('Space') || (inp.gameplay && pressed.has('TouchJump'));
    inp.pausePressed = pressed.has('Escape') || pressed.has('KeyP') || pressed.has('TouchPause');
    inp.confirm = pressed.has('Enter') || pressed.has('Space');
    inp.anyPressed = pressed.size > 0 || inp.pointer.pressed;
    inp.layout();
  };
  // Вызывать в конце шага
  inp.endStep = () => { pressed.clear(); inp.pointer.pressed = false; inp.pointer.released = false; };
  return inp;
}

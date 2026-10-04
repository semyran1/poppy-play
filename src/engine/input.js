// Ввод: клавиатура + мышь + тач. Игровые оси: move (-1..1), jump (нажата), jumpPressed (фронт).
// Тач: палец в нижних 2/3 экрана ведёт героиню к своей X; тап по кнопке прыжка или свайп вверх — прыжок.
export function createInput(game) {
  const keys = new Set(), pressed = new Set(), uiPressed = new Set();
  const inp = {
    move: 0, jump: false, jumpPressed: false, pausePressed: false,
    // pressed — для логики (живёт один шаг симуляции); clicked — для кнопок, которые проверяются при отрисовке
    // (живёт до конца кадра: шагов логики в кадре может быть несколько, и они стёрли бы клик до отрисовки)
    pointer: { x: 0, y: 0, down: false, pressed: false, released: false, clicked: false },
    touchTargetX: null, touchActive: false, isTouch: false,
    jumpButton: { x: 880, y: 455, r: 52 },
    anyPressed: false,
  };
  const touches = new Map();

  addEventListener('keydown', e => {
    if (!keys.has(e.code)) { pressed.add(e.code); uiPressed.add(e.code); }
    keys.add(e.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const c = game.canvas;
  function onDown(id, cx, cy, isTouch) {
    const p = game.toWorld(cx, cy);
    inp.isTouch = inp.isTouch || isTouch;
    inp.pointer.x = p.x; inp.pointer.y = p.y; inp.pointer.down = true; inp.pointer.pressed = true; inp.pointer.clicked = true;
    if (!isTouch) return;
    const jb = inp.jumpButton;
    const onJump = Math.hypot(p.x - jb.x, p.y - jb.y) < jb.r * 1.3;
    touches.set(id, { sx: p.x, sy: p.y, x: p.x, y: p.y, t: performance.now(), jump: onJump });
    if (onJump) pressed.add('TouchJump');
  }
  function onMove(id, cx, cy) {
    const p = game.toWorld(cx, cy);
    inp.pointer.x = p.x; inp.pointer.y = p.y;
    const t = touches.get(id); if (!t) return;
    // свайп вверх по полю = прыжок
    if (!t.jump && !t.swiped && t.y - p.y > 0 && (t.sy - p.y) > 60 && performance.now() - t.t < 300) { pressed.add('TouchJump'); t.swiped = true; }
    t.x = p.x; t.y = p.y;
  }
  function onUp(id) {
    touches.delete(id);
    inp.pointer.down = touches.size > 0; inp.pointer.released = true;
  }
  c.addEventListener('pointerdown', e => { c.setPointerCapture?.(e.pointerId); onDown(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch'); e.preventDefault(); });
  c.addEventListener('pointermove', e => onMove(e.pointerId, e.clientX, e.clientY));
  c.addEventListener('pointerup', e => onUp(e.pointerId));
  c.addEventListener('pointercancel', e => onUp(e.pointerId));
  c.addEventListener('contextmenu', e => e.preventDefault());

  inp.down = code => keys.has(code);
  inp.hit = code => pressed.has(code);
  inp.uiHit = code => uiPressed.has(code);   // клавиша для кнопок, проверяемых в draw
  inp.endFrame = () => { uiPressed.clear(); inp.pointer.clicked = false; };

  // Вызывать один раз в начале шага симуляции
  inp.poll = () => {
    let m = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) m -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) m += 1;
    inp.touchTargetX = null; inp.touchActive = false;
    for (const t of touches.values()) if (!t.jump) { inp.touchTargetX = t.x; inp.touchActive = true; }
    inp.move = m;
    inp.jump = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space') || [...touches.values()].some(t => t.jump);
    inp.jumpPressed = pressed.has('ArrowUp') || pressed.has('KeyW') || pressed.has('Space') || pressed.has('TouchJump');
    inp.pausePressed = pressed.has('Escape') || pressed.has('KeyP');
    inp.confirm = pressed.has('Enter') || pressed.has('Space');
    inp.anyPressed = pressed.size > 0 || inp.pointer.pressed;
  };
  // Вызывать в конце шага
  inp.endStep = () => { pressed.clear(); inp.pointer.pressed = false; inp.pointer.released = false; };
  return inp;
}

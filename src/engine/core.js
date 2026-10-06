// Ядро: адаптивный холст (динамический вьюпорт), фиксированный шаг 60 Гц, хитстоп, замедление, стек сцен.
//
// ===== API вьюпорта =====
// Холст всегда занимает окно целиком (CSS width/height = окно). «Логический вид» (VW×VH) подбирается по
// пропорции окна a = innerWidth / innerHeight, высота логической единицы — одна из базовых 540 (ландшафт) / ширина 540 (портрет):
//   ландшафт a ≥ 800/540 (1,48): H = 540, W = clamp(round(540·a), 800, 1296)  (16:9 → ровно 960×540, как раньше; 2,4:1 → 1296×540)
//   ландшафт 1 ≤ a < 1,48 : W = 800, H = clamp(round(800/a), 540, 800)            (планшет 4:3 → 800×600)
//   портрет  a < 1        : W = 540, H = clamp(round(540/a), 840, Hmax)           (Hmax = 1080 на десктопе — пункт модерации Яндекса 1.6.2.2, длинная
//                           сторона ≤ 2× короткой; на тач-устройствах (pointer: coarse) Hmax = 1260, чтобы у телефонов 9:19…9:21 не было полей)
//   портрет  0.64 < a < 1 : H = 840, W = clamp(round(840·a), 540, 840)            (планшет 3:4 → 630×840)
// Область игры Яндекс Игр на телефоне бывает 532×360 (1,48) и 696×304 (2,29): оба вписываются без полей (docs/MOBILE_ORIENTATION.md §2.4, §5.3).
// Живые привязки: `export let W, H` и объект `view` (один и тот же объект, поля меняются на месте):
//   view = { W, H, portrait, orientation ('portrait'|'landscape' — для раздельного хранения рекордов), scale, dx, dy, dpr, vw, vh, uiScale, safe:{l,r,t,b}, frame:{ox,oy,s,w,h}, ground }
//   scale      — CSS-пикселей на логический (view.W·scale ≈ ширина окна);
//   dx, dy     — CSS-смещение начала вида (≠0 только при редком леттербоксе на экзотических пропорциях);
//   safe       — вырезы/жесты (env(safe-area-inset-*)) в ЛОГИЧЕСКИХ единицах: HUD якорится по реальным краям, внутри safe;
//   uiScale    — множитель HUD/кнопок: 1 на десктопе, до 1.8 на маленьких экранах (эффективный шрифт HUD ≥ ~12 CSS px);
//   ground     — y пола боя: H − 58 (в 960×540 = 482; player.js экспортирует его же как живую привязку GROUND);
//   frame      — «дизайн-рамка» 960×540 внутри вида (для сцен, нарисованных строго в 960×540):
//                ландшафт: s = min(1, W/960) (при W < 960 вписывается по ширине), по центру: ox = (W−960·s)/2, oy = (H−540·s)/2;
//                портрет (заглушка): s = W/960 (вписать по ширине), ox = 0, oy = (H − 540·s)/2.
//   game.view / game.W / game.H дублируют те же значения; подписка на смену размеров: onViewChange((view, prev) => …).
// Сцены (см. main.js, корневая сцена): scene.frame (по умолчанию true) — рисуется в дизайн-рамке, вокруг эмбиент
// (зеркально-размытый край кадра, engine/frame.js); scene.frame = false — сцена получает полный вид (play);
// scene.portraitLayout (по умолчанию false) — true означает «сцена сама рисует портретную раскладку на полном виде».
// Смена размера (поворот телефона, адресная строка): события resize/orientationchange/visualViewport/screen.orientation на телефоне приходят
// пачкой и РАНЬШЕ, чем обновятся размеры, поэтому вид не доверяет событию, а перечитывает окно (readViewport): пересчёт не чаще раза в ~40 мс,
// повторы через 150/400/1000 мс после любого события, дешёвый опрос каждый кадр (ловит смену без события); нулевые/крошечные (< 80 px) размеры игнорируются
// (остаётся последний валидный вид). Баг «героиня пропала после поворота» — зависший вид старой ориентации (docs/iter_rotation_fix.md). После пересчёта
// onViewChange переносит позиции, а game/viewguard.js приводит бой в допустимое состояние. Холст пересоздаётся только при смене размера.
// Указатель: inp.pointer.x/y — в пространстве текущей сцены (рамка или вид), inp.pointer.rx/ry — всегда в координатах вида.
export let W = 960, H = 540;
export const DESIGN_W = 960, DESIGN_H = 540, FLOOR_PAD = 58;
export const view = {
  W, H, portrait: false, orientation: 'landscape', scale: 1, dx: 0, dy: 0, dpr: 1, vw: 960, vh: 540, uiScale: 1, ground: H - FLOOR_PAD,
  safe: { l: 0, r: 0, t: 0, b: 0 }, frame: { ox: 0, oy: 0, s: 1, w: DESIGN_W, h: DESIGN_H },
};
const listeners = [];
export function onViewChange(fn) { listeners.push(fn); return fn; }

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
// Чистая функция раскладки (проверяется без DOM): окно vw×vh → логический вид. coarse — тач-устройство (снимает потолок 2:1 в портрете)
export function layoutFor(vw, vh, coarse = false) {
  const a = vw / vh;
  let w, h;
  if (a < 1) {
    const maxH = coarse ? 1260 : 1080;
    if (540 / a >= 840) { w = 540; h = clampN(Math.round(540 / a), 840, maxH); }
    else { h = 840; w = clampN(Math.round(840 * a), 540, 840); }
  } else if (a >= 800 / 540 - 1e-6) { h = 540; w = clampN(Math.round(540 * a), 800, 1296); }
  else { w = 800; h = clampN(Math.round(800 / a), 540, 800); }
  const scale = Math.min(vw / w, vh / h);
  return { W: w, H: h, portrait: a < 1, scale, dx: (vw - w * scale) / 2, dy: (vh - h * scale) / 2 };
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = {
    canvas, ctx, W, H, view,
    scale: 1, offX: 0, offY: 0, dpr: 1,
    time: 0,          // игровое время, сек (стоит во время хитстопа и паузы)
    realTime: 0,      // реальное время, сек
    timeScale: 1,     // замедление (slow-mo)
    hitstop: 0,       // сек заморозки
    scene: null,
    debug: false,
    fixedDt: 1 / 60,
  };

  // зонд безопасных зон: невидимый элемент с padding: env(safe-area-inset-*)
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const insets = () => { const c = getComputedStyle(probe); return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; };

  const coarseMq = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;

  // ---- Чтение размеров окна (одно место) ----
  // На реальном телефоне при повороте размеры приходят пачкой: innerWidth уже новый, innerHeight ещё старый, visualViewport отстаёт,
  // бывают 0×0 и крошечные значения, высота прыгает на 56–110 px от адресной строки. Поэтому: (1) невалидные размеры (не конечные, < MIN_VP) игнорируются —
  // остаётся последний валидный вид; (2) читаем innerWidth/innerHeight, при их невалидности — clientWidth/Height, затем visualViewport;
  // (3) перерасчёт не в каждом событии, а не чаще раза в ~40 мс и всегда по СВЕЖИМ значениям; (4) после любого события ещё несколько перечитываний
  // (150/400/1000 мс), чтобы поймать окончательные размеры; (5) каждый кадр дешёвый опрос — ловит смену размеров без события.
  const MIN_VP = 80;
  const okDim = v => typeof v === 'number' && isFinite(v) && v >= MIN_VP && v <= 20000;
  function readViewport() {
    const vv = window.visualViewport, de = document.documentElement;
    const cands = [[window.innerWidth, window.innerHeight], [de && de.clientWidth, de && de.clientHeight], [vv && vv.width, vv && vv.height]];
    for (const [w, h] of cands) if (okDim(w) && okDim(h)) return { w: Math.round(w), h: Math.round(h) };
    return null;   // ничего валидного: держим предыдущий вид
  }
  let lastRead = { w: 0, h: 0 };
  function resize(force) {
    const rd = readViewport(); if (!rd) return false;
    const dprRaw = window.devicePixelRatio, dpr = Math.min(isFinite(dprRaw) && dprRaw > 0 ? dprRaw : 1, 2);
    lastRead = rd;
    const vw = rd.w, vh = rd.h;
    if (!force && vw === view.vw && vh === view.vh && dpr === view.dpr && canvas.width === Math.round(vw * dpr) && canvas.height === Math.round(vh * dpr)) return false;
    const L = layoutFor(vw, vh, !!coarseMq?.matches);
    const prev = { W: view.W, H: view.H, portrait: view.portrait, ground: view.ground, uiScale: view.uiScale };
    const ins = insets(), sc = L.scale;
    W = L.W; H = L.H;
    Object.assign(view, { W: L.W, H: L.H, portrait: L.portrait, orientation: L.portrait ? 'portrait' : 'landscape', scale: sc, dx: L.dx, dy: L.dy, dpr, vw, vh, ground: L.H - FLOOR_PAD });
    view.uiScale = clampN(1 / sc, 1, 1.8);
    // вырезы считаем от края окна, вид может быть смещён на dx/dy
    view.safe.l = Math.max(0, (ins.l - L.dx) / sc); view.safe.r = Math.max(0, (ins.r - L.dx) / sc);
    view.safe.t = Math.max(0, (ins.t - L.dy) / sc); view.safe.b = Math.max(0, (ins.b - L.dy) / sc);
    if (L.portrait) { const s = L.W / DESIGN_W; view.frame = { ox: 0, oy: (L.H - DESIGN_H * s) / 2, s, w: DESIGN_W, h: DESIGN_H }; }
    else { const s = Math.min(1, L.W / DESIGN_W); view.frame = { ox: (L.W - DESIGN_W * s) / 2, oy: (L.H - DESIGN_H * s) / 2, s, w: DESIGN_W, h: DESIGN_H }; }
    game.W = L.W; game.H = L.H; game.scale = sc; game.dpr = dpr; game.offX = L.dx; game.offY = L.dy;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    const cw = Math.round(vw * dpr), ch = Math.round(vh * dpr);
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    view.epoch = (view.epoch || 0) + 1;
    game.ctxDirty = true;   // размер холста сбрасывает состояние контекста; кадр начнётся с чистого
    const changed = prev.W !== view.W || prev.H !== view.H || prev.uiScale !== view.uiScale;
    if (changed || force === 'notify') for (const fn of listeners) { try { fn(view, prev); } catch (e) { console.error(e); game.errors?.push('onViewChange: ' + String(e && e.stack || e)); } }
    return true;
  }
  // Отложенный перерасчёт: не чаще раза в ~40 мс (серия событий → один пересчёт по свежим значениям)
  let rzTimer = 0;
  function resizeSoon() { if (rzTimer) return; rzTimer = setTimeout(() => { rzTimer = 0; resize(); }, 40); }
  // после события ещё несколько перечитываний: окончательные размеры приходят позже orientationchange
  const settleTimers = [];
  function settle() { for (const t of settleTimers.splice(0)) clearTimeout(t); for (const ms of [150, 400, 1000]) settleTimers.push(setTimeout(() => resize(), ms)); }
  const onAny = () => { resizeSoon(); settle(); };
  window.addEventListener('resize', onAny);
  window.addEventListener('orientationchange', onAny);
  window.addEventListener('pageshow', onAny);
  window.visualViewport?.addEventListener('resize', onAny);
  try { screen.orientation?.addEventListener('change', onAny); } catch { }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onAny(); });
  resize(true);

  // клиентские координаты (CSS px) → логические координаты вида
  game.toWorld = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left - view.dx) / view.scale, y: (cy - r.top - view.dy) / view.scale };
  };

  game.setScene = (scene, ...args) => {
    if (game.scene && game.scene.exit) game.scene.exit();
    game.scene = scene;
    if (scene.enter) scene.enter(game, ...args);
  };

  game.freeze = (sec) => { game.hitstop = Math.max(game.hitstop, sec); };

  // Перед кадром: чистое состояние контекста (после исключения в прошлой отрисовке или смены размера холста могли остаться
  // незакрытые save(), clip, filter, globalAlpha — «невидимая» героиня) + трансформация вида (+ заливка полей, если вид не занимает окно целиком)
  function beginDraw() {
    if (game.ctxDirty) { game.ctxDirty = false; try { if (ctx.reset) ctx.reset(); else { const w = canvas.width; canvas.width = w; } } catch (e) { } }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; if (ctx.filter !== 'none') ctx.filter = 'none';
    const k = view.scale * view.dpr;
    if (view.dx > 0.75 || view.dy > 0.75) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07040a'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(k, 0, 0, k, view.dx * view.dpr, view.dy * view.dpr);
  }
  const logErr = (e, tag) => { console.error(e); game.errors.push(tag + String(e && e.stack || e)); if (game.errors.length > 20) game.errors.shift(); };
  // отрисовка в своём try: ошибка кадра не должна оставлять холст в «грязном» состоянии и не ломает следующий кадр
  function safeDraw(alpha) { try { beginDraw(); game.scene?.draw?.(ctx, alpha); } catch (e) { game.ctxDirty = true; logErr(e, ''); } }

  let acc = 0, last = performance.now();
  game.paused = false;
  game.errors = [];
  // Одна ошибка в кадре не должна останавливать игру навсегда: логируем и продолжаем цикл
  function frame(now) {
    requestAnimationFrame(frame);
    try { tick(now); } catch (e) { logErr(e, ''); }
  }
  function tick(now) {
    let dt = (now - last) / 1000; last = now;
    if (!(dt >= 0)) dt = 0;             // защита от NaN/отрицательного шага
    if (dt > 0.25) dt = 0.25;           // вкладка спала — не догонять
    { const rd = readViewport(); if (rd && (rd.w !== view.vw || rd.h !== view.vh || Math.min(window.devicePixelRatio || 1, 2) !== view.dpr)) resizeSoon(); }   // опрос: смена размера без события (адресная строка)
    game.realTime += dt;
    acc += dt;
    let steps = 0;
    while (acc >= game.fixedDt && steps < 5) {
      acc -= game.fixedDt; steps++;
      if (game.hitstop > 0) { game.hitstop -= game.fixedDt; if (game.scene?.updateFrozen) game.scene.updateFrozen(game.fixedDt); continue; }
      const sdt = game.fixedDt * game.timeScale;
      if (!game.paused) game.time += sdt;
      try { game.scene?.update?.(sdt, game.fixedDt); } catch (e) { logErr(e, ''); }   // ошибка шага не отменяет отрисовку
    }
    safeDraw(acc / game.fixedDt);
  }
  requestAnimationFrame(frame);

  // Ручной шаг для автотестов (headless): window.__step(n)
  game.step = (n = 1) => {
    { const rd = readViewport(); if (rd && (rd.w !== view.vw || rd.h !== view.vh)) resizeSoon(); }   // как в tick: ловим смену размера без события
    for (let i = 0; i < n; i++) {
      if (game.hitstop > 0) { game.hitstop -= game.fixedDt; continue; }
      const sdt = game.fixedDt * game.timeScale;
      game.time += sdt;
      game.scene?.update?.(sdt, game.fixedDt);
    }
    beginDraw();
    game.scene?.draw?.(ctx, 0);
  };
  game.resize = () => resize();          // перечитать окно сейчас (идемпотентно: без изменений ничего не делает)
  game.resizeSoon = resizeSoon;
  return game;
}

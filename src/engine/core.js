// Ядро: холст с леттербоксом, фиксированный шаг 60 Гц, хитстоп, замедление, стек сцен.
export const W = 960, H = 540;

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = {
    canvas, ctx, W, H,
    scale: 1, offX: 0, offY: 0, dpr: 1,
    time: 0,          // игровое время, сек (стоит во время хитстопа и паузы)
    realTime: 0,      // реальное время, сек
    timeScale: 1,     // замедление (slow-mo)
    hitstop: 0,       // сек заморозки
    scene: null,
    debug: false,
    fixedDt: 1 / 60,
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    game.scale = s; game.dpr = dpr;
    canvas.style.width = Math.round(W * s) + 'px';
    canvas.style.height = Math.round(H * s) + 'px';
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    const r = canvas.getBoundingClientRect();
    game.offX = r.left; game.offY = r.top;
  }
  window.addEventListener('resize', resize);
  resize();

  game.toWorld = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / (r.width / W), y: (cy - r.top) / (r.height / H) };
  };

  game.setScene = (scene, ...args) => {
    if (game.scene && game.scene.exit) game.scene.exit();
    game.scene = scene;
    if (scene.enter) scene.enter(game, ...args);
  };

  game.freeze = (sec) => { game.hitstop = Math.max(game.hitstop, sec); };

  let acc = 0, last = performance.now();
  game.paused = false;
  game.errors = [];
  // Одна ошибка в кадре не должна останавливать игру навсегда: логируем и продолжаем цикл
  function frame(now) {
    requestAnimationFrame(frame);
    try { tick(now); } catch (e) { console.error(e); game.errors.push(String(e && e.stack || e)); if (game.errors.length > 20) game.errors.shift(); }
  }
  function tick(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;           // вкладка спала — не догонять
    game.realTime += dt;
    acc += dt;
    let steps = 0;
    while (acc >= game.fixedDt && steps < 5) {
      acc -= game.fixedDt; steps++;
      if (game.hitstop > 0) { game.hitstop -= game.fixedDt; if (game.scene?.updateFrozen) game.scene.updateFrozen(game.fixedDt); continue; }
      const sdt = game.fixedDt * game.timeScale;
      if (!game.paused) game.time += sdt;
      game.scene?.update?.(sdt, game.fixedDt);
    }
    const s = game.scale * game.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    game.scene?.draw?.(ctx, acc / game.fixedDt);
  }
  requestAnimationFrame(frame);

  // Ручной шаг для автотестов (headless): window.__step(n)
  game.step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (game.hitstop > 0) { game.hitstop -= game.fixedDt; continue; }
      const sdt = game.fixedDt * game.timeScale;
      game.time += sdt;
      game.scene?.update?.(sdt, game.fixedDt);
    }
    const s = game.scale * game.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    game.scene?.draw?.(ctx, 0);
  };
  return game;
}

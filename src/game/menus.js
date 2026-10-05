// Меню-касса (ATMOSPHERE P1-4), Косметичка (мета-магазин), Гардероб, список достижений.
// Всё в стиле «хэллоуинский кинотеатр»: табло с бегущими лампочками, кнопки-билеты, жетоны в углах.
import { WARDROBE } from './data.js';
import { META_POWER, META_VARIETY, ensureOffers, buyOffer, shuffleOffers, drawOfferCard, SHUFFLE_PRICE, isPower, isRare } from './meta.js';
import { drawHeroine } from '../art/heroine.js';
import { loadHeroineKey, drawHeroineKey, loadHeroineVec, loadHeroineBack, heroineVecMuzzle } from '../art/heroineVec.js';
import { ACCESSORIES, ACC, SLOTS, RARITY, owns, equipAcc, buyAcc, accHint, ensureAcc, gemsShort } from './accessories.js';
import { gemsOf, gemWord } from './gems.js';
import { drawGem } from '../art/gem.js';
import { drawAccIcon, BLASTER_SKIN, emitTrail, updateTrail, drawTrail, loadAccVec } from '../art/accessories.js';
import { newPet, petTarget, updatePet, petReact, petIdle, drawPet } from './pets.js';
import { drawTampon } from '../art/sprites.js';
import { post } from '../art/post.js';
import { ACHIEVEMENTS, REWARD_NAMES, BACK_POSE_ACH, BACK_POSE_HINT, facingOf } from './achievements.js';
import { text, wrap, FONT } from './ui.js';
import { drawBackground, drawVignette } from '../art/backgrounds.js';
import { drawSceneBg } from '../art/scenes.js';
import { drawStar } from '../art/sprites.js';
import { drawPopcorn } from '../art/icons.js';
import { sfx, playMusic, audioState, applyVolumes } from '../engine/audio.js';
import { clamp, TAU } from '../engine/util.js';
import { view as VIEW } from '../engine/core.js';   // динамический вьюпорт (в menus.js `view` — имя текущего экрана меню)

// Палитра (ATMOSPHERE §2)
const C = {
  night: '#0e0612', shadow: '#1a0b2e', dusk: '#2a1038', velvet: '#7a0d18', velvetD: '#4a0610',
  paper: '#f3e2c0', shade: '#c9a878', ink: '#3a1a10', gold: '#ffd166', lamp: '#ff9a3c', pumpkin: '#ff7a1a',
  mint: '#5ee6c8', pink: '#ff9ab8', lipstick: '#ff3b8a', beam: '#fff1c9',
};
// «Пустой» ввод: пока открыто окно пополнения, всё под ним не реагирует на мышь
const GHOST = { pointer: { x: -999, y: -999, down: false, pressed: false, released: false, clicked: false }, uiHit: () => false, hit: () => false };
const ALL_META = [...META_POWER, ...META_VARIETY];
const easeOut = k => 1 - (1 - k) ** 3;
const BARKS = ['Ну где он?', 'Сеанс уже скоро…', 'Опять опаздывает!'];

export function createMenu(app) {
  let t = 0, drawT = 0, view = 'main', scroll = 0, shopPage = 0;
  let confirmNew = false;               // подтверждение «Новой игры»
  let lockHint = 0;                     // подсказка у закрытой позы «Спиной» (секунды)
  let wtab = 'outfits', accSlot = 'pet';   // Гардероб: вкладка «Наряды | Аксессуары» и выбранный слот
  const demo = { shots: [], trail: [], cd: 0, n: 0 };   // мини-сцена «в бою»
  const pets = { main: newPet(), poster: newPet(), demo: newPet() };   // питомцы в меню (пружина и реакции — pets.js)
  let topup = { open: false, t: 0, busy: null, msg: '', err: '', mt: 0 };   // окно «Пополнить стразы»: busy — id пакета в покупке, msg / err — результат на 3,5 с
  const stamps = {};                    // id предмета -> секунды с покупки (штамп «КУПЛЕНО» на карточке)
  let gemShown = null, gemPulse = 0;    // число на счётчике стразов плавно догоняет настоящее; пульс при пополнении и покупке
  const accSel = {};                    // выбранная карточка по слотам (для касаний: наведения нет)   // мини-сцена «в бою» на вкладке аксессуаров
  let tear = null;                      // { id, k, act } — отрыв корешка перед действием
  let bark = null, barkIn = 6 + Math.random() * 6;   // барк простоя Поппи
  const hov = {};                       // плавность наведения по id билета/жетона
  const leaves = Array.from({ length: 7 }, () => newLeaf(true));
  const fog = Array.from({ length: 6 }, (_, i) => ({ x: i * 190 - 80, y: 470 + (i % 3) * 22, w: 260 + (i % 2) * 120, v: 6 + (i % 3) * 4 }));
  // состояние портретной раскладки (подробно — в разделе «ПОРТРЕТНАЯ РАСКЛАДКА» ниже и в docs/portrait_menus.md)
  const gest = { down: false, sx: 0, sy: 0, x: 0, y: 0, moved: false, scr: null, vy: 0, tap: null };   // жест: тап / перетаскивание списка
  const scr = {};                       // id -> { off, vy, max, r, live } — прокручиваемые списки
  const reg = {};                       // id -> { x, y, w, h } — зарегистрированные кнопки текущего кадра (координаты вида)
  let achRows = null, achKey = '';      // кэш раскладки строк достижений (портрет)
  let blocked = false, curDt = 0, outSel = null, wheelOn = false;   // blocked — поверх открыто окно: нижний слой не получает касаний

  function newLeaf(anywhere) {
    return {
      x: Math.random() * 980 - 10, y: anywhere ? Math.random() * 540 : -20 - Math.random() * 60,
      v: 16 + Math.random() * 14, ph: Math.random() * TAU, rot: Math.random() * TAU, rs: (Math.random() - 0.5) * 2,
      s: 9 + Math.random() * 6, col: ['#ff7a1a', '#c8501a', '#8a3a14', '#e8a040', '#a8321a'][Math.floor(Math.random() * 5)],
    };
  }

  function mainAct() {
    const prog = app.save.progress || 0;
    return prog > 0 ? () => app.continueFrom(prog) : () => app.startStory();
  }
  // билет нажат: корешок отрывается, через ~0,3 с действие
  function tearTicket(id, act) {
    if (tear) return;
    tear = { id, k: 0, act };
    sfx('whoosh', { pitch: 1.5, vol: 0.55 });
  }

  const menu = {
    portraitLayout: true,   // в портрете сцена сама рисует раскладку на полном виде (см. раздел «ПОРТРЕТНАЯ РАСКЛАДКА»)
    enter() { t = 0; drawT = 0; view = 'main'; topup.open = false; confirmNew = false; tear = null; bark = null; resetGesture(); loadHeroineKey(app.save.outfit || 'lara'); playMusic('menu'); initWheel(); },
    setView(v, o = {}) { view = v; confirmNew = false; shopPage = 0; if (o.topup !== undefined) topup.open = !!o.topup; if (o.tab) wtab = o.tab; if (o.slot) accSlot = o.slot; for (const k in scr) scr[k].off = 0; },
    get view() { return view; },
    get hits() { return reg; },          // прямоугольники кнопок портретного кадра (координаты вида) — для автотестов
    get scrollers() { return scr; },
    get topupOpen() { return topup.open; },
    get state() { return { view, wtab, accSlot, accSel: { ...accSel }, outSel, topup: topup.open, confirmNew }; },   // для автотестов
    update(dt) {
      const inp = app.inp; inp.poll(); t += dt;
      if (VIEW.portrait) pollGesture(inp, dt); else resetGesture();
      for (const L of leaves) {
        L.y += L.v * dt; L.x += (Math.sin(t * 0.9 + L.ph) * 22 + 8) * dt; L.rot += L.rs * dt;
        if (L.y > 560 || L.x > 990) Object.assign(L, newLeaf(false));
      }
      for (const f of fog) { f.x += f.v * dt; if (f.x > 1000) f.x = -f.w - 40; }
      // барк простоя: раз в 15–25 с на 2,4 с
      if (view === 'main') {
        if (bark) { bark.k += dt; if (bark.k > 2.4) { bark = null; barkIn = 15 + Math.random() * 10; } }
        else if ((barkIn -= dt) <= 0) bark = { s: BARKS[Math.floor(Math.random() * BARKS.length)], k: 0 };
      }
      if (tear) { tear.k += dt; if (tear.k >= 0.32) { const a = tear.act; tear = null; inp.endStep(); a(); return; } }
      if (view === 'wardrobe' && topup.open && inp.hit('Escape')) topup.open = false;   // Esc закрывает окно пополнения, а не гардероб
      else if (view !== 'main' && inp.hit('Escape')) view = 'main';
      else if (view === 'main' && confirmNew && inp.hit('Escape')) confirmNew = false;
      if (view === 'main' && !tear && inp.hit('Enter')) tearTicket('play', mainAct());
      this._inp = inp;
      inp.endStep();   // иначе нажатая клавиша (Esc) «залипает» до следующей сцены
    },
    draw(ctx) {
      if (VIEW.portrait) return drawPortrait(ctx);
      const inp = app.inp, S = app.save;
      const dt = clamp(t - drawT, 0, 0.1); drawT = t;
      if (view === 'settings') view = 'main';   // «Настройки» есть только в портретной раскладке
      if (topup.open && (view !== 'wardrobe' || wtab !== 'acc')) topup.open = false;   // в ландшафте окно стразов только на вкладке аксессуаров
      // фон: ночной фасад кинотеатра
      // новый фон в стиле героини (тушь, cel-тень); слева — тёмная зона под логотип и билеты, шов панели прячет градиент
      if (drawSceneBg(ctx, 'facade2')) {   // левая часть кадра — продолжение улицы; под билетами и логотипом затемняем виньеткой
        const g = ctx.createLinearGradient(0, 0, 540, 0); g.addColorStop(0, 'rgba(14,6,18,0.78)'); g.addColorStop(0.6, 'rgba(14,6,18,0.5)'); g.addColorStop(1, 'rgba(14,6,18,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 540, 540);
      }
      else if (!drawSceneBg(ctx, 'facade')) drawBackground(ctx, 'facade', t);
      ctx.fillStyle = 'rgba(14,6,18,0.28)'; ctx.fillRect(0, 0, 960, 540);
      drawLeaves(ctx);
      post.calm = view === 'wardrobe';   // в гардеробе плёночные царапины (тонкие вертикальные линии) выключены: их принимали за полосы рядом с героиней
      if (view === 'main') drawMain(ctx, inp, S, dt);
      else {
        drawFog(ctx, 0.8);
        drawVignette(ctx, t);
        ctx.fillStyle = 'rgba(14,6,18,0.8)'; ctx.fillRect(0, 0, 960, 540);
        if (view === 'shop') drawShop(ctx, inp, S, dt);
        else if (view === 'ach') drawAch(ctx, inp, S, dt);
        else if (view === 'wardrobe') drawWardrobe(ctx, inp, S, dt);
      }
    },
  };
  return menu;

  // ---------------- главный экран ----------------
  function drawMain(ctx, inp, S, dt) {
    // левую колонку чуть притемняем, чтобы билеты читались
    const g = ctx.createLinearGradient(0, 0, 560, 0);
    g.addColorStop(0, 'rgba(14,6,18,0.55)'); g.addColorStop(1, 'rgba(14,6,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 560, 540);
    drawFog(ctx, 1);
    // Поппи справа в наряде из гардероба: кадр «шпионский постер» (боком, взгляд через плечо);
    // пока не загружен — обычная стойка
    stagePet(ctx, 'main', ensureAcc(S).equip.pet, 668, 318 + Math.sin(t * 1.1) * 4, 74, dt, true);   // питомец рядом с героиней на постере
    if (!drawHeroineKey(ctx, 800, 522, 450, S.outfit || 'lara', { t }))
      drawHeroine(ctx, 790, 500, 330, { kind: 'aim', t, blink: (t % 3.6) < 0.12 ? 1 : 0 }, S.outfit || 'lara', { flip: true });
    drawFogFront(ctx);
    drawVignette(ctx, t);
    if (bark) drawBark(ctx, bark);

    // табло с логотипом
    drawMarquee(ctx, 26, 14, 448, 186, 18);
    ctx.save(); ctx.translate(250, 74); ctx.rotate(-0.025 + Math.sin(t * 1.3) * 0.008);
    fitText(ctx, 'Поппи:', 0, 0, 380, 76, { color: C.velvet, lw: 9, outline: '#0e0204' });
    fitText(ctx, 'Хэллоуинский кошмар', 0, 66, 390, 34, { color: C.velvet, lw: 6, outline: '#0e0204' });
    ctx.restore();

    // три билета
    const prog = S.progress || 0;
    const busy = !!tear;
    const main = prog > 0
      ? { label: 'ПРОДОЛЖИТЬ', sub: `ГЛАВА ${prog + 1} · РЯД 13 · МЕСТО 31` }
      : { label: 'ИГРАТЬ', sub: 'РЯД 13 · МЕСТО 31' };
    if (ticket(ctx, inp, dt, 'play', 120, 222, 260, 86, { ...main, velvet: true, stub: 'ВХОД' }, busy)) tearTicket('play', mainAct());
    // «Новая игра» — мелкой ссылкой, с подтверждением
    if (prog > 0) {
      if (!confirmNew) {
        if (link(ctx, inp, 'Новая игра', 250, 326, 15, busy)) { confirmNew = true; sfx('select'); }
      } else {
        text(ctx, 'Начать сначала?', 214, 326, { size: 15, color: C.paper, lw: 4, outline: C.night });
        if (link(ctx, inp, 'Да', 300, 326, 15, busy, C.gold)) { confirmNew = false; tearTicket('play', () => app.startStory()); }
        if (link(ctx, inp, 'Нет', 338, 326, 15, busy)) { confirmNew = false; sfx('select'); }
      }
    }
    const y2 = prog > 0 ? 350 : 336;
    if (ticket(ctx, inp, dt, 'wardrobe', 150, y2, 200, 64, { label: 'ГАРДЕРОБ', sub: 'РЯД 13 · МЕСТО 31', icon: 'hanger' }, busy)) tearTicket('wardrobe', () => { view = 'wardrobe'; confirmNew = false; sfx('select'); });
    // Косметичка открывается после первой смерти (до этого — только игра и гардероб)
    if (((S.stats?.deaths || 0) > 0 || Object.keys(S.meta || {}).length) && ticket(ctx, inp, dt, 'shop', 150, y2 + 80, 200, 64, { label: 'КОСМЕТИЧКА', sub: 'РЯД 13 · МЕСТО 31', icon: 'lipstick' }, busy)) tearTicket('shop', () => { view = 'shop'; shopPage = 0; confirmNew = false; sfx('select'); });

    // жетоны в углах: достижения и звук справа сверху, конфеты-попкорн слева снизу
    const got = Object.keys(S.ach).length;
    if (token(ctx, inp, dt, 'ach', 870, 36, (x, y) => drawStar(ctx, x, y, 11, C.gold), { left: `${got}/${ACHIEVEMENTS.length}`, leftColor: C.mint }, busy)) { view = 'ach'; scroll = 0; confirmNew = false; sfx('select'); }
    const on = S.settings.sfx > 0;
    if (token(ctx, inp, dt, 'snd', 922, 36, (x, y) => drawSpeaker(ctx, x, y, on), {}, busy)) { app.toggleSound(); sfx('select'); }
    drawBucket(ctx, 38, 506, S.candies);
  }

  // ---------------- Косметичка ----------------
  // Сверху витрина забега (3 предложения), ниже «Уже в косметичке» — сетка билетиков с полным описанием.
  // Свободные клетки сетки заполняются серыми «можно открыть», чтобы экран не пустовал и система была понятна.
  function drawShop(ctx, inp, S, dt) {
    header(ctx, 'КОСМЕТИЧКА');
    drawBucket(ctx, 852, 40, S.candies);
    fitText(ctx, 'После каждого забега — новая витрина: сила делает Поппи крепче, разнообразие добавляет в забеги новые бонусы и события. Редкие — дороже.',
      480, 84, 900, 13, { weight: 700, color: '#ffe6ef', outline: false });

    // --- витрина ---
    const offers = ensureOffers(S);
    sectionLabel(ctx, 'Витрина этого забега', 40, 108);
    if (offers.length && !S.offerShuffled) {
      if (tbutton(ctx, inp, dt, 'shuffle', 730, 95, 190, 26, `↻ перетасовать · ${SHUFFLE_PRICE}`, { size: 13, disabled: S.candies < SHUFFLE_PRICE })) { if (shuffleOffers(S)) { app.persist(); sfx('whoosh'); } }
    } else if (offers.length) text(ctx, 'уже перетасовано', 920, 108, { size: 12, align: 'right', color: 'rgba(243,226,192,0.55)', outline: false, weight: 700 });
    const oy = 124, oh = 136, ow = 284, gap = 14;
    if (!offers.length) soldOutCard(ctx, 40, oy, 880, oh);
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * (ow + gap), id = offers[i];
      if (!offers.length) break;
      if (!id) { soldSlot(ctx, x, oy, ow, oh); continue; }
      if (drawOfferCard(ctx, S, id, x, oy, ow, oh, (label, bx, by, bw, bh, o) => tbutton(ctx, inp, dt, 'offer' + i, bx, by, bw, bh, label, { size: 14, disabled: o.disabled, velvet: true }), i)) {
        if (buyOffer(S, id)) { app.persist(); sfx('coin', { pitch: 1.3 }); app.emit({ type: 'metaBuy' }); }
      }
    }

    // --- уже в косметичке ---
    const owned = ALL_META.filter(m => S.meta[m.id]);
    const gy = 288, gh = 184;
    const lw = sectionLabel(ctx, 'Уже в косметичке', 40, 276);
    if (!owned.length) {
      text(ctx, 'пока пусто — вот что можно открыть:', 40 + lw + 12, 276, { size: 13, align: 'left', color: '#ffe6ef', outline: false, weight: 700 });
      // 4 примера крупно: две «силы», два «разнообразия» (не из текущей витрины)
      const free = ALL_META.filter(m => !offers.includes(m.id));
      const ex = [...free.filter(m => isPower(m.id)).slice(0, 2), ...free.filter(m => !isPower(m.id)).slice(0, 2)];
      ex.forEach((m, i) => metaTicket(ctx, S, m, 40 + (i % 2) * 446, gy + Math.floor(i / 2) * 94, 434, 88, { locked: true, big: true }));
      if (backButton(ctx, inp, dt, 478)) view = 'main';
      return;
    }
    const per = 9, pages = Math.ceil(owned.length / per);
    shopPage = clamp(shopPage, 0, pages - 1);
    if (pages > 1) {
      if (inp.uiHit('ArrowRight')) shopPage = Math.min(pages - 1, shopPage + 1);
      if (inp.uiHit('ArrowLeft')) shopPage = Math.max(0, shopPage - 1);
    }
    text(ctx, `собрано ${owned.length} из ${ALL_META.length}` + (pages > 1 ? ` · стр. ${shopPage + 1}/${pages}` : ''), 920, 276, { size: 13, align: 'right', color: C.mint, outline: false, weight: 800 });
    const cells = owned.slice(shopPage * per, shopPage * per + per).map(m => ({ m }));
    // пустые клетки — серые «можно открыть» (сначала то, чего нет на витрине)
    if (cells.length < per) {
      const rest = ALL_META.filter(m => !S.meta[m.id]);
      const tease = [...rest.filter(m => !offers.includes(m.id)), ...rest.filter(m => offers.includes(m.id))];
      while (cells.length < per && tease.length) cells.push({ m: tease.shift(), locked: true });
    }
    const cw = (880 - 2 * 10) / 3, ch = 58, rg = (gh - 3 * ch) / 2;
    cells.forEach((c, i) => metaTicket(ctx, S, c.m, 40 + (i % 3) * (cw + 10), gy + Math.floor(i / 3) * (ch + rg), cw, ch, { locked: c.locked }));
    if (pages > 1) {
      if (tbutton(ctx, inp, dt, 'sprev', 322, 482, 56, 40, '‹', { size: 26, disabled: shopPage === 0 })) shopPage--;
      if (tbutton(ctx, inp, dt, 'snext', 582, 482, 56, 40, '›', { size: 26, disabled: shopPage >= pages - 1 })) shopPage++;
    }
    if (backButton(ctx, inp, dt, 478)) view = 'main';
  }

  function sectionLabel(ctx, s, x, y) {
    ctx.save(); ctx.letterSpacing = '1px';
    text(ctx, s.toUpperCase(), x, y, { size: 15, align: 'left', color: C.gold, lw: 4, outline: C.night });
    const w = ctx.measureText(s.toUpperCase()).width;
    ctx.restore(); return w;
  }

  // Вся витрина раскуплена: широкая карточка-заглушка
  function soldOutCard(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 5, w, h, 10); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#3a1648'); g.addColorStop(1, C.shadow);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,209,102,0.55)'; ctx.stroke();
    // перфорация киноплёнки сверху и снизу
    ctx.fillStyle = 'rgba(243,226,192,0.22)';
    for (let px = x + 14; px < x + w - 14; px += 22) { ctx.beginPath(); ctx.roundRect(px, y + 7, 12, 8, 2); ctx.roundRect(px, y + h - 15, 12, 8, 2); ctx.fill(); }
    // значок: хлопушка-нумератор
    const cx = x + 96, cy = y + h / 2 + 4;
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.roundRect(cx - 34, cy - 14, 68, 42, 4); ctx.fill();
    ctx.save(); ctx.translate(cx - 34, cy - 16); ctx.rotate(-0.28 - Math.abs(Math.sin(t * 1.6)) * 0.12);
    ctx.fillStyle = C.ink; ctx.fillRect(0, -12, 68, 12);
    ctx.fillStyle = C.paper; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(6 + k * 17, -12); ctx.lineTo(14 + k * 17, -12); ctx.lineTo(8 + k * 17, 0); ctx.lineTo(0 + k * 17, 0); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = C.ink; ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('СЕАНС', cx, cy + 2); ctx.fillText('№ ' + ((S_runs() % 99) + 1), cx, cy + 18);
    text(ctx, 'Новые предложения — после следующего забега', x + 170, y + h / 2 - 14, { size: 24, align: 'left', color: C.paper, lw: 5, outline: C.night });
    text(ctx, 'Всё с витрины уже в косметичке. Сыграй ещё раз — и появятся три новых.', x + 172, y + h / 2 + 18, { size: 14, align: 'left', color: '#ffe6ef', outline: false, weight: 700 });
    ctx.restore();
  }
  function S_runs() { return app.save.stats?.runs || 0; }
  // Одна клетка витрины уже куплена
  function soldSlot(ctx, x, y, w, h) {
    ctx.save();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(243,226,192,0.3)';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(x + w / 2, y + h / 2 - 12); ctx.rotate(-0.12);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,154,184,0.75)'; ctx.beginPath(); ctx.roundRect(-70, -18, 140, 36, 6); ctx.stroke();
    text(ctx, 'КУПЛЕНО', 0, 1, { size: 22, color: 'rgba(255,154,184,0.85)', outline: false });
    ctx.restore();
    text(ctx, 'новое — после следующего забега', x + w / 2, y + h / 2 + 30, { size: 12, color: 'rgba(243,226,192,0.6)', outline: false, weight: 700 });
  }

  // Билетик предмета: цветной корешок со значком (сила — бархат, разнообразие — фиолет), имя, ранги, полное описание.
  // locked — серый пример «можно открыть».
  function metaTicket(ctx, S, m, x, y, w, h, o = {}) {
    const power = isPower(m.id), big = !!o.big, r = Math.min(m.max || 1, S.meta[m.id] || 0);
    const stub = big ? 64 : 50, cr = 7;
    ctx.save();
    ctx.fillStyle = 'rgba(8,2,10,0.45)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 3, w, h, cr); ctx.fill();
    if (o.locked) { ctx.globalAlpha = big ? 0.82 : 0.7; ctx.filter = big ? 'grayscale(0.7) brightness(0.88)' : 'grayscale(0.85) brightness(0.8)'; }
    const pg = ctx.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, '#f8ead0'); pg.addColorStop(1, '#e6cc9c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(x, y, w, h, cr); ctx.fill();
    ctx.fillStyle = power ? C.velvet : C.dusk; ctx.beginPath(); ctx.roundRect(x, y, stub, h, [cr, 0, 0, cr]); ctx.fill();
    ctx.fillStyle = 'rgba(14,6,18,0.5)';
    for (let yy = y + 6; yy < y + h - 3; yy += 7) { ctx.beginPath(); ctx.arc(x + stub, yy, 1.5, 0, TAU); ctx.fill(); }
    if (o.locked) { ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(58,26,16,0.5)'; }
    else if (m.rare) { ctx.lineWidth = 2.5; ctx.strokeStyle = C.gold; }
    else { ctx.lineWidth = 1.5; ctx.strokeStyle = C.shade; }
    ctx.beginPath(); ctx.roundRect(x, y, w, h, cr); ctx.stroke(); ctx.setLineDash([]);
    metaGlyph(ctx, m, x + stub / 2, y + h / 2 - (big ? 8 : 0), big ? 19 : 16, power);
    if (big) text(ctx, power ? 'СИЛА' : 'РАЗНООБР.', x + stub / 2, y + h - 14, { size: 9, color: power ? C.gold : C.mint, outline: false });
    // справа в строке имени: ранги-пипсы (сила), галочка (разнообразие), замок (пример)
    const bx = x + stub + 10, bw = w - stub - 18, ny = y + (big ? 17 : 13);
    let right = x + w - 9;
    if (o.locked) { lockGlyph(ctx, right - 6, ny, '#5a3020'); right -= 18; }
    else if (power) {
      for (let k = (m.max || 1) - 1; k >= 0; k--) {
        ctx.fillStyle = k < r ? C.gold : 'rgba(58,26,16,0.18)'; ctx.strokeStyle = k < r ? '#a8781a' : 'rgba(58,26,16,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(right - 9, ny - 4, 9, 8, 2); ctx.fill(); ctx.stroke(); right -= 12;
      }
      right -= 2;
    } else { ctx.strokeStyle = '#1f8a72'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(right - 11, ny); ctx.lineTo(right - 7, ny + 4); ctx.lineTo(right, ny - 4); ctx.stroke(); right -= 16; }
    if (m.rare) { drawStar(ctx, right - 6, ny, 6, '#e0a020'); right -= 15; }
    fitText(ctx, m.name, bx, ny + 1, right - bx - 4, big ? 18 : 14, { align: 'left', color: C.ink, outline: false });
    const fs = big ? 14 : 11, lh = big ? 18 : 12;
    const lines = wrap(ctx, m.desc, bw, fs, 700).slice(0, 3);
    ctx.fillStyle = '#5a3020'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((l, k) => ctx.fillText(l, bx, y + (big ? 42 : 27) + k * lh));
    if (big) text(ctx, 'можно открыть', x + w - 10, y + h - 12, { size: 10, align: 'right', color: '#7a4a30', outline: false, weight: 800 });
    ctx.restore();
  }

  // ---------------- Гардероб ----------------
  // Слева крупный «постер» выбранного наряда (наведение на другой открытый наряд — примерка), справа карточки нарядов.
  function drawWardrobe(ctx, real, S, dt) {
    const inp = topup.open && wtab === 'acc' ? GHOST : real;   // пока открыто окно пополнения, всё под ним не реагирует на мышь
    header(ctx, 'ГАРДЕРОБ');
    // вкладки «Наряды | Аксессуары»
    if (tbutton(ctx, inp, dt, 'wtab_o', 24, 20, 116, 36, 'Наряды', { size: 16, velvet: wtab === 'outfits' })) { wtab = 'outfits'; sfx('select'); }
    if (tbutton(ctx, inp, dt, 'wtab_a', 146, 20, 150, 36, 'Аксессуары', { size: 16, velvet: wtab === 'acc' })) { wtab = 'acc'; sfx('select'); }
    if (wtab === 'acc') { drawAccTab(ctx, inp, S, dt); if (backButton(ctx, inp, dt, 482)) view = 'main'; drawTopup(ctx, real, S, dt); return; }
    for (const w of WARDROBE) { loadHeroineKey(w.id); loadHeroineVec(w.id); if (facingOf(S) === 'back') loadHeroineBack(w.id); }
    const cur = S.outfit || 'lara';
    const isOpen = w => !w.unlock || S.ach[w.unlock];
    const CX = i => 494 + i * 222, CY = 80, CW = 206, CH = 390;
    let show = cur;
    WARDROBE.forEach((w, i) => { if (w.id !== cur && isOpen(w) && hitRect(inp, CX(i), CY, CW, CH)) show = w.id; });
    const W = WARDROBE.find(w => w.id === show) || WARDROBE[0], trying = show !== cur;

    // постер
    const px = 30, py = 80, pw = 446, ph = 390;
    cinemaPanel(ctx, px, py, pw, ph, { on: true });
    ctx.save(); ctx.beginPath(); ctx.roundRect(px + 3, py + 3, pw - 6, ph - 6, 11); ctx.clip();
    const fx = px + 150;
    // луч прожектора и пятно света на полу
    const bg = ctx.createLinearGradient(0, py, 0, py + ph); bg.addColorStop(0, 'rgba(255,241,201,0.22)'); bg.addColorStop(1, 'rgba(255,241,201,0.04)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(fx - 26, py); ctx.lineTo(fx + 26, py); ctx.lineTo(fx + 130, py + ph); ctx.lineTo(fx - 130, py + ph); ctx.closePath(); ctx.fill();
    const fl = ctx.createRadialGradient(fx, py + ph - 22, 4, fx, py + ph - 22, 120);
    fl.addColorStop(0, 'rgba(255,209,102,0.35)'); fl.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.save(); ctx.translate(fx, py + ph - 22); ctx.scale(1, 0.22); ctx.translate(-fx, -(py + ph - 22)); ctx.fillStyle = fl; ctx.fillRect(fx - 120, py + ph - 142, 240, 240); ctx.restore();
    stagePet(ctx, 'poster', ensureAcc(S).equip.pet, px + 62, py + ph - 150 + Math.sin(t * 1.3) * 3, 62, dt);
    if (!drawHeroineKey(ctx, fx + 6, py + ph - 18, 352, show, { t }))
      drawHeroine(ctx, fx, py + ph - 18, 300, { kind: 'stand', t }, show);
    ctx.restore();
    // подписи постера
    const tx = px + 268, tw = pw - 268 - 16;
    ctx.save(); ctx.letterSpacing = '2px';
    text(ctx, trying ? 'ПРИМЕРКА' : 'СЕЙЧАС НА ПОППИ', tx, py + 34, { size: 11, align: 'left', color: trying ? C.mint : C.gold, outline: false });
    ctx.restore();
    const nl = wrap(ctx, W.name, tw, 26, 900);
    nl.forEach((l, k) => text(ctx, l, tx, py + 66 + k * 30, { size: 26, align: 'left', color: C.paper, lw: 5, outline: C.night }));
    let yy = py + 66 + nl.length * 30 + 10;
    ctx.fillStyle = 'rgba(255,209,102,0.5)'; ctx.fillRect(tx, yy - 6, 40, 2);
    wrap(ctx, W.desc, tw, 14, 700).forEach((l, k) => text(ctx, l, tx, yy + 12 + k * 19, { size: 14, align: 'left', color: '#ffe6ef', outline: false, weight: 700 }));
    // поза в бою: «Лицом» (вполоборота, бластер вверх) или «Спиной» (спиной к нам, руки вверх) — save.facing;
    // под переключателем мини-сцена «в бою» в выбранной позе и выбранном (или примеряемом) наряде
    const descN = wrap(ctx, W.desc, tw, 14, 700).length;
    let iy = Math.max(yy + 12 + descN * 19 + 4, py + 206);
    // «Спиной» закрыта до достижения «Ледяная королева» (замок; наведение или клик — подсказка в мини-сцене)
    const backOpen = !!S.ach[BACK_POSE_ACH], back = facingOf(S) === 'back';
    ctx.save(); ctx.letterSpacing = '1.5px';
    text(ctx, 'ПОЗА В БОЮ', tx, iy, { size: 10, align: 'left', color: 'rgba(255,209,102,0.85)', outline: false });
    ctx.restore();
    const bw = (tw - 6) / 2, bx2 = tx + bw + 6;
    if (tbutton(ctx, inp, dt, 'face_front', tx, iy + 9, bw, 28, 'Лицом', { size: 13, velvet: !back }) && back) { S.facing = 'front'; app.persist(); sfx('select', { pitch: 1.2 }); }
    if (backOpen) {
      if (tbutton(ctx, inp, dt, 'face_back', bx2, iy + 9, bw, 28, 'Спиной', { size: 13, velvet: back }) && !back) { S.facing = 'back'; app.persist(); loadHeroineBack(show); sfx('select', { pitch: 1.2 }); }
    } else {
      tbutton(ctx, inp, dt, 'face_back', bx2 + 0, iy + 9, bw, 28, '   Спиной', { size: 12, disabled: true });
      lockGlyph(ctx, bx2 + 13, iy + 21, C.ink, 0.85);
      if (hitRect(inp, bx2, iy + 9, bw, 28)) { lockHint = Math.max(lockHint, 0.3); if (consume(inp)) { lockHint = 3; sfx('select', { pitch: 0.6 }); } }
    }
    lockHint = Math.max(0, lockHint - dt);
    const dy = iy + 44;
    drawDemo(ctx, ensureAcc(S).equip, show, tx - 4, dy, tw + 8, py + ph - 10 - dy, dt, { facing: back ? 'back' : 'front', fh: Math.min(92, (py + ph - 10 - dy - 26) / 1.26), label: trying ? 'ПРИМЕРКА · В БОЮ' : 'В БОЮ' });
    if (lockHint > 0) {   // подсказка: как открыть позу «Спиной»
      const hx = tx - 4, hy = dy, hw = tw + 8, hl = wrap(ctx, BACK_POSE_HINT, hw - 20, 12, 800);
      ctx.save(); ctx.globalAlpha = Math.min(1, lockHint * 4);
      ctx.fillStyle = 'rgba(14,4,20,0.9)'; ctx.beginPath(); ctx.roundRect(hx, hy, hw, py + ph - 10 - hy, 10); ctx.fill();
      lockGlyph(ctx, hx + hw / 2, hy + 18, C.gold, 1.2);
      hl.forEach((l, k) => text(ctx, l, hx + hw / 2, hy + 40 + k * 16, { size: 12, color: C.gold, outline: false, weight: 800 }));
      ctx.restore();
    }

    // карточки нарядов
    WARDROBE.forEach((w, i) => {
      const x = CX(i), y = CY, open = isOpen(w), on = cur === w.id;
      cinemaPanel(ctx, x, y, CW, CH, { on, dim: !open });
      ctx.save(); ctx.letterSpacing = '1.5px';
      text(ctx, w.unlock ? 'ЗА ДОСТИЖЕНИЕ' : 'С САМОГО НАЧАЛА', x + CW / 2, y + 22, { size: 10, color: open ? 'rgba(255,209,102,0.8)' : 'rgba(243,226,192,0.4)', outline: false });
      ctx.restore();
      // пятно света под ногами
      const sg = ctx.createRadialGradient(x + CW / 2, y + 262, 2, x + CW / 2, y + 262, 70);
      sg.addColorStop(0, open ? 'rgba(255,209,102,0.28)' : 'rgba(243,226,192,0.08)'); sg.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.save(); ctx.translate(x + CW / 2, y + 262); ctx.scale(1, 0.2); ctx.translate(-(x + CW / 2), -(y + 262)); ctx.fillStyle = sg; ctx.fillRect(x + CW / 2 - 70, y + 192, 140, 140); ctx.restore();
      ctx.save(); if (!open) ctx.filter = 'brightness(0.12)';
      drawHeroine(ctx, x + CW / 2, y + 262, 196, { kind: 'stand', t }, w.id);
      ctx.restore();
      if (!open) { lockGlyph(ctx, x + CW / 2, y + 128, C.gold, 2); text(ctx, 'закрыто', x + CW / 2, y + 168, { size: 20, color: C.gold, outline: C.night }); }
      fitText(ctx, w.name, x + CW / 2, y + 288, CW - 20, 17, { color: C.paper, outline: C.night, lw: 4 });
      wrap(ctx, open ? w.desc : w.hint, CW - 26, 13, 700).slice(0, 3).forEach((l, k) => text(ctx, l, x + CW / 2, y + 311 + k * 17, { size: 13, weight: 700, outline: false, color: open ? '#ffe6ef' : C.gold }));
      if (open && !on && tbutton(ctx, inp, dt, 'outfit' + i, x + 38, y + CH - 46, CW - 76, 34, 'Надеть', { size: 16, velvet: true })) { S.outfit = w.id; app.persist(); loadHeroineKey(w.id); sfx('select', { pitch: 1.3 }); }
      if (on) text(ctx, '★ надето', x + CW / 2, y + CH - 28, { size: 15, color: C.gold, outline: C.night });
    });
    if (backButton(ctx, inp, dt, 482)) view = 'main';
  }


  // ---------- Гардероб: аксессуары ----------
  // Слева — постер с надетым (наведение на карточку — примерка; питомец рядом) и мини-сцена «в бою» в реальном размере;
  // справа — слоты (питомец, бластер, заколка, брелок, след) и карточки с рисунком предмета: надеть / снять, купить за
  // конфеты, замок с подсказкой, цвет редкости; платные наборы закрыты («скоро»).
  function achName(id) { return ACHIEVEMENTS.find(a => a.id === id)?.name || id; }
  // питомец в меню: пружина к точке (x, y), рисунок высотой h; смена питомца — прыжок и сердечки
  function stagePet(ctx, key, id, x, y, h, dt, talk = false) {
    const P = pets[key];
    if (!id) { P.placed = false; P.lastId = null; return; }
    if (P.lastId !== id) { if (P.lastId) petReact(P, id, 'clear'); P.lastId = id; loadAccVec(id); }
    updatePet(P, dt, { x, y, face: 1 }, { big: 1 });
    if (talk) petIdle(P, id, false);
    drawPet(ctx, P, id, h);
  }
  function drawAccTab(ctx, inp, S, dt) {
    const A = ensureAcc(S), outfit = S.outfit || 'lara';
    loadHeroineKey(outfit); loadHeroineVec(outfit);
    const items = ACCESSORIES.filter(a => a.slot === accSlot);
    const CW = 146, CH = 108, CX = i => 494 + (i % 3) * 152, CY = i => 142 + Math.floor(i / 3) * 112;
    let hovered = null;
    items.forEach((it, i) => { if (hitRect(inp, CX(i), CY(i), CW, CH)) hovered = it; });
    const pick = ACC[accSel[accSlot]];
    const show = hovered || (pick && pick.slot === accSlot ? pick : null) || ACC[A.equip[accSlot]] || items[0];
    const tryOn = { ...A.equip }; if (hovered) tryOn[accSlot] = hovered.id; else if (pick === show && pick) tryOn[accSlot] = pick.id;
    const trying = !!tryOn[accSlot] && A.equip[accSlot] !== tryOn[accSlot];

    // постер
    const px = 30, py = 80, pw = 446, ph = 390;
    cinemaPanel(ctx, px, py, pw, ph, { on: true });
    ctx.save(); ctx.beginPath(); ctx.roundRect(px + 3, py + 3, pw - 6, ph - 6, 11); ctx.clip();
    const fx = px + 140;
    const bg = ctx.createLinearGradient(0, py, 0, py + ph); bg.addColorStop(0, 'rgba(255,241,201,0.22)'); bg.addColorStop(1, 'rgba(255,241,201,0.04)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(fx - 26, py); ctx.lineTo(fx + 26, py); ctx.lineTo(fx + 130, py + ph); ctx.lineTo(fx - 130, py + ph); ctx.closePath(); ctx.fill();
    stagePet(ctx, 'poster', tryOn.pet, px + 62, py + ph - 150 + Math.sin(t * 1.3) * 3, 62, dt, true);
    if (!drawHeroineKey(ctx, fx + 6, py + ph - 18, 352, outfit, { t, acc: tryOn }))
      drawHeroine(ctx, fx, py + ph - 18, 300, { kind: 'stand', t }, outfit, { acc: tryOn });
    ctx.restore();
    // подпись предмета
    const tx = px + 262, tw = pw - 262 - 14;
    if (show) {
      const R = RARITY[show.rarity], own = owns(S, show.id), on = A.equip[accSlot] === show.id;
      ctx.save(); ctx.letterSpacing = '2px';
      text(ctx, trying ? 'ПРИМЕРКА' : on ? 'СЕЙЧАС НА ПОППИ' : own ? 'В ГАРДЕРОБЕ' : 'ЕЩЁ НЕ ОТКРЫТО', tx, py + 26, { size: 10, align: 'left', color: trying ? C.mint : on ? C.gold : 'rgba(243,226,192,0.7)', outline: false });
      ctx.restore();
      const nl = wrap(ctx, show.name, tw, 18, 900).slice(0, 3);
      nl.forEach((l, k) => text(ctx, l, tx, py + 50 + k * 21, { size: 18, align: 'left', color: C.paper, lw: 4, outline: C.night }));
      let yy = py + 50 + nl.length * 21 + 2;
      text(ctx, R.name, tx, yy, { size: 12, align: 'left', color: R.color, outline: C.night, lw: 3 });
      yy += 18;
      const fl = wrap(ctx, show.flavor, tw, 12, 700).slice(0, 5);
      fl.forEach((l, k) => text(ctx, l, tx, yy + k * 15, { size: 12, align: 'left', color: '#ffe6ef', outline: false, weight: 700 }));
      if (!own) {   // как открыть — полностью
        const hl = wrap(ctx, accHint(show, achName, true), tw, 11, 800).slice(0, 3);
        hl.forEach((l, k) => text(ctx, l, tx, yy + fl.length * 15 + 8 + k * 14, { size: 11, align: 'left', color: C.gold, outline: false, weight: 800 }));
      }
    }
    drawDemo(ctx, tryOn, outfit, px + 262, py + 218, pw - 262 - 10, ph - 230, dt);

    // слоты
    SLOTS.forEach((sl, i) => {
      const x = 494 + i * 62, y = 80, w = 58, h = 56, on = sl.id === accSlot, over = hitRect(inp, x, y, w, h);
      const hk = hover('slot' + sl.id, over, dt);
      cinemaPanel(ctx, x, y - 2 * hk, w, h, { on, r: 10 });
      const eq = A.equip[sl.id];
      const iconId = eq || ACCESSORIES.find(a => a.slot === sl.id)?.id;
      ctx.save(); if (!eq) ctx.globalAlpha = 0.5; drawAccIcon(ctx, iconId, sl.id, x + w / 2, y + 22 - 2 * hk, 34, t); ctx.restore();
      text(ctx, sl.name, x + w / 2, y + h - 10 - 2 * hk, { size: 11, color: on ? C.gold : C.paper, outline: C.night, lw: 3 });
      const n = ACCESSORIES.filter(a => a.slot === sl.id && owns(S, a.id)).length;
      if (n) { ctx.fillStyle = C.lipstick; ctx.beginPath(); ctx.arc(x + w - 6, y + 6 - 2 * hk, 8, 0, TAU); ctx.fill(); text(ctx, String(n), x + w - 6, y + 7 - 2 * hk, { size: 10, color: '#fff', outline: false }); }
      if (over && consume(inp)) { accSlot = sl.id; sfx('select'); }
    });

    // карточки: слева рисунок предмета, справа название, снизу действие
    items.forEach((it, i) => {
      const x = CX(i), y = CY(i), R = RARITY[it.rarity], own = owns(S, it.id), on = A.equip[accSlot] === it.id;
      const over = hovered === it, hk = hover('acc' + it.id, over, dt), sel = show === it;
      ctx.save(); ctx.translate(0, -2 * hk);
      cinemaPanel(ctx, x, y, CW, CH, { stroke: on ? C.gold : R.color, on: on || sel, dim: !own });
      if (it.rarity === 'legend') {   // бегущий блик по рамке легендарки
        const k = (t * 0.6) % 1, g = ctx.createLinearGradient(x + CW * (k - 0.3), 0, x + CW * (k + 0.1), 0);
        g.addColorStop(0, 'rgba(255,209,102,0)'); g.addColorStop(0.5, 'rgba(255,250,220,0.9)'); g.addColorStop(1, 'rgba(255,209,102,0)');
        ctx.lineWidth = 3; ctx.strokeStyle = g; ctx.beginPath(); ctx.roundRect(x, y, CW, CH, 14); ctx.stroke();
      }
      ctx.save(); ctx.letterSpacing = '1.5px';
      text(ctx, R.name.toUpperCase(), x + 10, y + 12, { size: 8, align: 'left', color: R.color, outline: false });
      ctx.restore();
      if (on) text(ctx, '★', x + CW - 12, y + 12, { size: 11, align: 'right', color: C.gold, outline: C.night, lw: 3 });
      const priced = !own && it.src === 'shop', short = priced ? gemsShort(S, it) : 0;
      if (priced) {   // цена в стразах — в углу карточки
        ctx.font = `900 12px ${FONT}`; const pw = ctx.measureText(String(it.price)).width;
        text(ctx, String(it.price), x + CW - 10, y + 13, { size: 12, align: 'right', color: short ? '#ffb8d8' : C.gold, lw: 3, outline: C.night });
        drawGem(ctx, x + CW - 10 - pw - 8, y + 13, 6.5, { shadow: true });
      }
      // рисунок предмета
      const ix = x + 35, iy = y + 47;
      const ig = ctx.createRadialGradient(ix, iy, 3, ix, iy, 34); ig.addColorStop(0, own ? 'rgba(255,209,102,0.22)' : 'rgba(243,226,192,0.08)'); ig.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, 34, 0, TAU); ctx.fill();
      ctx.save(); if (!own) ctx.globalAlpha = 0.6; drawAccIcon(ctx, it.id, it.slot, ix, iy, 58, t); ctx.restore();
      if (!own && it.src !== 'shop') lockGlyph(ctx, ix + 20, iy + 22, C.gold, 1.1);
      // название
      const nl = wrapName(ctx, it.name, CW - 76, 11).slice(0, priced ? 3 : 4);
      nl.forEach((l, k) => fitText(ctx, l, x + 70, y + 28 + k * 12.5, CW - 76, 11, { align: 'left', color: own ? '#fff' : '#e8d8e0', outline: C.night, lw: 3 }));
      // действие
      const bx = x + 8, by = y + CH - 30, bw = CW - 16, bh = 24;
      if (own) {
        if (tbutton(ctx, inp, dt, 'eq' + it.id, bx, by, bw, bh, on ? 'Снять' : 'Надеть', { size: 13, velvet: !on })) { equipAcc(S, it.id); app.persist(); loadAccVec(it.id); sfx('select', { pitch: on ? 0.9 : 1.3 }); }
      } else if (it.src === 'shop') {
        if (short) {   // не хватает: сколько ещё и ярлык-ссылка в окно пополнения
          fitText(ctx, `нужно ещё ${short}`, x + 70, y + 67, CW - 78, 10.5, { align: 'left', color: '#ffb8d8', lw: 3, outline: C.night });
          if (tbutton(ctx, inp, dt, 'buy' + it.id, bx, by, bw, bh, 'пополнить', { size: 13 })) { openTopup(); sfx('select', { pitch: 1.2 }); }
        } else if (tbutton(ctx, inp, dt, 'buy' + it.id, bx, by, bw, bh, 'Купить', { size: 13, velvet: true })) {
          if (buyAcc(S, it.id)) { app.persist(); loadAccVec(it.id); stamps[it.id] = 0; gemPulse = 1; sfx('coin', { pitch: 1.2 }); sfx('select', { pitch: 1.5 }); }
        }
      } else {
        wrap(ctx, accHint(it, achName), bw, 10, 800).slice(0, 2).forEach((l, k) => text(ctx, l, bx, by + 7 + k * 12, { size: 10, align: 'left', color: C.gold, outline: false, weight: 800 }));
      }
      if (stamps[it.id] !== undefined) {   // штамп «КУПЛЕНО»: прилетает сверху, держится ~1,3 с, гаснет
        const st = stamps[it.id] += dt, k = Math.min(1, st / 0.14), a = st > 1.0 ? Math.max(0, 1 - (st - 1.0) / 0.35) : 1;
        if (st > 1.35) delete stamps[it.id];
        else {
          ctx.save(); ctx.globalAlpha = a; ctx.translate(x + CW / 2, y + CH / 2 + 2); ctx.rotate(-0.16); const sc = 1 + (1 - k) * 1.4; ctx.scale(sc, sc);
          ctx.fillStyle = 'rgba(40,6,20,0.72)'; ctx.beginPath(); ctx.roundRect(-58, -17, 116, 34, 6); ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = '#ff3b8a'; ctx.beginPath(); ctx.roundRect(-58, -17, 116, 34, 6); ctx.stroke();
          ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-54, -13, 108, 26, 4); ctx.stroke();
          text(ctx, 'КУПЛЕНО', 0, 1, { size: 22, color: '#ff3b8a', lw: 4, outline: '#1a0414' });
          ctx.restore();
        }
      }
      ctx.restore();
      if (over && inp.pointer.clicked) { accSel[accSlot] = it.id; loadAccVec(it.id); consume(inp); sfx('select', { pitch: 1.1 }); }
    });
    drawGemCounter(ctx, inp, S, dt);
  }

  // ---------- Стразы: счётчик и окно «Пополнить стразы» ----------
  // Стразы — вторая валюта, только для аксессуаров. Счётчик — в правом верхнем углу вкладки; «+» (и клик по счётчику)
  // открывает окно с 4 пакетами. Кнопки зависят от адаптера платформы (src/platform): none → «скоро», dev → «ТЕСТ +N»,
  // yandex → настоящая покупка («Купить», затем «…», при сбое — строка об ошибке).
  function openTopup() { topup.open = true; topup.t = 0; topup.busy = null; topup.msg = ''; topup.err = ''; }
  function drawGemCounter(ctx, inp, S, dt) {
    const n = gemsOf(S);
    if (gemShown === null) gemShown = n;
    gemShown += (n - gemShown) * Math.min(1, dt * 8); if (Math.abs(n - gemShown) < 0.5) gemShown = n;
    gemPulse = Math.max(0, gemPulse - dt * 2.5);
    const x = 764, y = 20, w = 134, h = 36, over = hitRect(inp, x, y, w, h), hk = hover('gemcount', over, dt);
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); const sc = 1 + 0.1 * gemPulse; ctx.scale(sc, sc); ctx.translate(-x - w / 2, -y - h / 2);
    cinemaPanel(ctx, x, y - hk, w, h, { r: 18, on: over || gemPulse > 0.05, stroke: gemPulse > 0.05 ? '#ff9ad0' : undefined });
    drawGem(ctx, x + 22, y + h / 2 - hk, 11, { t, shadow: true });
    text(ctx, String(Math.round(gemShown)), x + 42, y + h / 2 + 1 - hk, { size: 21, align: 'left', color: gemPulse > 0.05 ? '#ffd2ec' : C.gold, lw: 5, outline: C.night });
    ctx.restore();
    ctx.save(); ctx.letterSpacing = '2px'; text(ctx, 'СТРАЗЫ', x + w / 2, y - 7, { size: 9, color: 'rgba(255,154,184,0.9)', outline: false }); ctx.restore();
    let go = over && consume(inp);
    if (tbutton(ctx, inp, dt, 'gemplus', 902, y, 34, h, '+', { size: 26, velvet: true })) go = true;
    if (go) { openTopup(); sfx('select', { pitch: 1.2 }); }
  }
  // цена пакета: из адаптера (в янах; у Яндекса — из SDK вместе с иконкой валюты)
  function drawPrice(ctx, pr, cx, y) {
    const s = pr.priceText || `${pr.price} ян`;
    ctx.font = `900 17px ${FONT}`; const tw = ctx.measureText(s).width, ic = pr.icon && pr.icon.complete && pr.icon.naturalWidth ? 20 : 0, gap = ic ? 5 : 0;
    const x0 = cx - (tw + ic + gap) / 2;
    text(ctx, s, x0, y, { size: 17, align: 'left', color: C.paper, lw: 4, outline: C.night });
    if (ic) ctx.drawImage(pr.icon, x0 + tw + gap, y - 10, 20, 20);
  }
  function buyPack(pay, pr) {
    topup.busy = pr.id; topup.err = ''; topup.msg = ''; topup.mt = 0;
    const fail = (e) => { topup.busy = null; topup.mt = 0; topup.err = e === 'unavailable' ? 'Покупки пока недоступны' : 'Покупка не завершена. Стразы не списаны'; };
    Promise.resolve().then(() => pay.buy(pr.id)).then(r => {
      if (r?.ok) { topup.busy = null; topup.mt = 0; topup.msg = `Зачислено: +${r.gems} ${gemWord(r.gems)}`; gemPulse = 1; app.persist(); sfx('coin', { pitch: 1.1 }); sfx('select', { pitch: 1.6 }); }
      else fail(r?.error);
    }).catch(() => fail());
  }
  function drawTopup(ctx, inp, S, dt) {
    if (!topup.open) return;
    topup.t += dt; if (topup.msg || topup.err) { topup.mt += dt; if (topup.mt > 3.5) { topup.msg = ''; topup.err = ''; } }
    const plat = app.platform, pay = plat?.payments, name = plat?.name || 'none', can = !!pay?.available;
    let prods = []; try { prods = pay?.products?.() || []; } catch { }
    const ap = easeOut(Math.min(1, topup.t / 0.18));
    ctx.fillStyle = `rgba(8,2,12,${0.78 * ap})`; ctx.fillRect(0, 0, 960, 540);
    const px = 100, py = 60 + (1 - ap) * 14, pw = 760, ph = 420;
    ctx.save(); ctx.globalAlpha = ap;
    cinemaPanel(ctx, px, py, pw, ph, { on: true });
    ctx.save(); ctx.letterSpacing = '3px'; text(ctx, 'ПОПОЛНИТЬ СТРАЗЫ', px + 26, py + 34, { size: 24, align: 'left', color: C.gold, lw: 6, outline: C.night }); ctx.restore();
    const bal = String(gemsOf(S)); ctx.font = `900 20px ${FONT}`; const bw0 = ctx.measureText(bal).width;
    text(ctx, bal, px + pw - 70, py + 35, { size: 20, align: 'right', color: C.paper, lw: 5, outline: C.night });
    drawGem(ctx, px + pw - 70 - bw0 - 16, py + 34, 10, { shadow: true });
    if (tbutton(ctx, inp, dt, 'tclose', px + pw - 52, py + 16, 34, 34, '×', { size: 24 })) { topup.open = false; sfx('select', { pitch: 0.9 }); }
    const n = prods.length || 4, CW = 168, gap = 14, x0 = px + (pw - (n * CW + (n - 1) * gap)) / 2, cy0 = py + 78, CH = 232;
    const tier = ['#d9cfe0', '#6ec8ff', '#c58cff', '#ffd166'], CNT = [1, 3, 5, 8];
    prods.forEach((pr, i) => {
      const x = x0 + i * (CW + gap), cx = x + CW / 2, over = hitRect(inp, x, cy0, CW, CH), hk = hover('pack' + pr.id, over, dt);
      ctx.save(); ctx.translate(0, -3 * hk);
      cinemaPanel(ctx, x, cy0, CW, CH, { stroke: tier[Math.min(i, 3)], on: over });
      // горка камней: чем больше пакет, тем больше горка
      const cnt = CNT[Math.min(i, 3)], bx = cx, by = cy0 + 62;
      const spots = [[0, 0, 22], [-24, 8, 15], [24, 8, 15], [-12, -18, 13], [14, -20, 12], [-36, 18, 10], [36, 18, 10], [0, 22, 12]];
      const order = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, cnt).reverse();
      for (const k of cnt === 1 ? [0] : order) { const [dx, dy, r] = spots[k]; drawGem(ctx, bx + dx * (cnt === 1 ? 1.2 : 1), by + dy + Math.sin(t * 1.6 + k) * 1.5, cnt === 1 ? 28 : r, { shadow: true, t: t + k }); }
      text(ctx, String(pr.gems), cx, cy0 + 116, { size: 36, color: C.gold, lw: 7, outline: C.night });
      text(ctx, gemWord(pr.gems), cx, cy0 + 140, { size: 13, color: '#ffd0dc', lw: 4, outline: C.night });
      drawPrice(ctx, pr, cx, cy0 + 166);
      // кнопка по состоянию адаптера
      const busy = topup.busy === pr.id, lock = !!topup.busy;
      const label = busy ? '.'.repeat(1 + Math.floor(t * 3) % 3) : !can ? 'скоро' : name === 'dev' ? `ТЕСТ +${pr.gems}` : 'Купить';
      if (tbutton(ctx, inp, dt, 'pk' + pr.id, x + 14, cy0 + CH - 48, CW - 28, 34, label, { size: busy ? 20 : 15, velvet: can && !lock, disabled: !can || lock })) buyPack(pay, pr);
      if (name === 'dev') {   // метка тестового режима
        ctx.save(); ctx.translate(x + CW - 30, cy0 + 20); ctx.rotate(0.35); ctx.fillStyle = '#ff3b8a'; ctx.beginPath(); ctx.roundRect(-22, -9, 44, 18, 4); ctx.fill();
        text(ctx, 'ТЕСТ', 0, 1, { size: 12, color: '#fff', outline: false }); ctx.restore();
      }
      ctx.restore();
    });
    if (!prods.length) text(ctx, 'Товары пока недоступны', px + pw / 2, py + 200, { size: 18, color: C.paper });
    // результат покупки / ошибка
    const res = topup.err || topup.msg;
    if (res) text(ctx, res, px + pw / 2, py + 330 + 24, { size: 17, color: topup.err ? '#ff9a9a' : C.mint, lw: 5, outline: C.night });
    // подпись: честно про площадку и про то, что стразы не дают силы
    const f1 = name === 'dev' ? 'ТЕСТОВЫЙ РЕЖИМ (?dev=1): пакеты зачисляются бесплатно, настоящих платежей нет.'
      : can ? 'Покупки совершаются через площадку.' : 'Покупки пока недоступны: стразы можно получить за достижения.';
    text(ctx, f1, px + pw / 2, py + ph - 42, { size: 13, color: name === 'dev' ? '#ff9ad0' : can ? C.paper : C.gold, outline: false, weight: 800 });
    text(ctx, 'Стразы нужны только для аксессуаров и не дают силы в бою.', px + pw / 2, py + ph - 22, { size: 12, color: 'rgba(243,226,192,0.65)', outline: false, weight: 700 });
    ctx.restore();
    if (inp.pointer.clicked && !(inp.pointer.x > px && inp.pointer.x < px + pw && inp.pointer.y > py && inp.pointer.y < py + ph)) { topup.open = false; inp.pointer.clicked = false; }   // клик мимо окна закрывает его
    else if (inp.pointer.clicked) inp.pointer.clicked = false;   // клик по окну не уходит вниз
  }

  // Мини-сцена «в бою»: героиня 100 px (как в игре), стреляет — видно скин бластера, след, питомца и брелок в движении
  function drawDemo(ctx, acc, outfit, x, y, w, h, dt, o = {}) {
    const fh = o.fh || 100, facing = o.facing || facingOf(app.save);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1a0b2e'); g.addColorStop(1, '#3a1638');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const gy = y + h - 16;
    ctx.fillStyle = 'rgba(255,154,184,0.18)'; ctx.fillRect(x, gy, w, 16);
    const cyc = t % 6, run = cyc > 3.4 && cyc < 5.4;
    const pose = run ? { kind: 'run', u: t * 1.6, t, facing } : { kind: 'aim', t, facing };
    const hx = x + w * 0.5 + (run ? Math.sin((cyc - 3.4) / 2 * Math.PI) * w * 0.14 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(hx, gy + 2, 22, 5, 0, 0, TAU); ctx.fill();
    // питомец за героиней (в бою: 50 px при росте 100)
    if (acc.pet) { const k = fh / 100, tg = petTarget(hx, gy, 1, k); stagePet(ctx, 'demo', acc.pet, tg.x, tg.y, 38 * k, dt); } else pets.demo.placed = false;
    // выстрелы
    const mz = heroineVecMuzzle(pose, fh, outfit), mx = hx + mz[0], my = gy + mz[1];
    demo.cd -= dt;
    if (demo.cd <= 0 && dt > 0) { demo.cd = 0.3; demo.shots.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 40, vy: -460, t: 0 }); demo.flash = 0.06; if (acc.pet && demo.n++ % 6 === 0) petReact(pets.demo, acc.pet, 'kill'); }
    for (const s of demo.shots) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (acc.trail) emitTrail(demo.trail, s, acc.trail, dt); }
    demo.shots = demo.shots.filter(s => s.y > y - 30);
    updateTrail(demo.trail, dt); drawTrail(ctx, demo.trail);
    const body = BLASTER_SKIN[acc.blaster]?.shot;
    for (const s of demo.shots) drawTampon(ctx, s.x, s.y, 1, { rot: Math.atan2(s.vy, s.vx) + Math.PI / 2, string: true, body });
    drawHeroine(ctx, hx, gy, fh, pose, outfit, { acc });
    if ((demo.flash = (demo.flash || 0) - dt) > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = BLASTER_SKIN[acc.blaster]?.flash || 'rgba(160,230,255,0.85)';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
    ctx.save(); ctx.letterSpacing = '1.5px'; text(ctx, o.label || 'В БОЮ · КАК В ИГРЕ', x + 8, y + (o.lsize ? o.lsize * 0.9 + 4 : 12), { size: o.lsize || 9, align: 'left', color: 'rgba(255,209,102,0.85)', outline: false }); ctx.restore();
  }

  // ---------------- Достижения ----------------
  function drawAch(ctx, inp, S, dt) {
    header(ctx, 'ДОСТИЖЕНИЯ');
    const n = ACHIEVEMENTS.length, perPage = 12, pages = Math.ceil(n / perPage);
    if (inp.uiHit('ArrowRight')) scroll = Math.min(pages - 1, scroll + 1);
    if (inp.uiHit('ArrowLeft')) scroll = Math.max(0, scroll - 1);
    ACHIEVEMENTS.slice(scroll * perPage, scroll * perPage + perPage).forEach((a, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 40 + col * 450, y = 80 + row * 62;
      const got = S.ach[a.id];
      cinemaPanel(ctx, x, y, 430, 54, { stroke: got ? C.mint : null, dim: !got, r: 10 });
      drawStar(ctx, x + 26, y + 27, 13, got ? C.gold : '#4a3a48');
      const hidden = a.secret && !got;
      text(ctx, hidden ? 'Секрет' : a.name, x + 50, y + 18, { size: 16, align: 'left', color: got ? '#fff' : '#cfb8c8', outline: C.night });
      text(ctx, hidden ? '???' : a.desc, x + 50, y + 38, { size: 12, align: 'left', color: '#ffe6ef', outline: false, weight: 700 });
      const gift = a.unlock?.startsWith('acc_') ? ACC[a.unlock.slice(4)] : null;   // награда-аксессуар
      if (gift && !hidden) text(ctx, `${got ? '✓' : '+'} ${gift.name}`, x + 420, y + 18, { size: 11, align: 'right', color: got ? C.mint : C.pink, outline: false });
      else if (REWARD_NAMES[a.unlock] && !hidden) text(ctx, `${got ? '✓' : '+'} ${REWARD_NAMES[a.unlock]}`, x + 420, y + 18, { size: 11, align: 'right', color: got ? C.mint : C.pink, outline: false });
      else if (a.unlock && !hidden) text(ctx, got ? 'открыто' : 'открывает новое', x + 420, y + 18, { size: 11, align: 'right', color: got ? C.mint : C.gold, outline: false });
      if (a.gems && !hidden) {   // награда стразами: камень и «+N» в правом нижнем углу плашки
        text(ctx, `+${a.gems}`, x + 420, y + 38, { size: 13, align: 'right', color: got ? C.mint : '#ffb8d8', lw: 3, outline: C.night });
        ctx.font = `900 13px ${FONT}`; drawGem(ctx, x + 420 - ctx.measureText(`+${a.gems}`).width - 10, y + 37, 6.5, { alpha: got ? 0.55 : 1 });
      }
    });
    if (pages > 1) {
      if (tbutton(ctx, inp, dt, 'prev', 300, 482, 60, 42, '‹', { size: 26, disabled: scroll === 0 })) scroll--;
      text(ctx, `${scroll + 1} / ${pages}`, 480, 458, { size: 15, color: C.paper, outline: C.night });
      if (tbutton(ctx, inp, dt, 'next', 600, 482, 60, 42, '›', { size: 26, disabled: scroll >= pages - 1 })) scroll++;
    }
    if (backButton(ctx, inp, dt, 478)) view = 'main';
  }

  // =====================================================================================================================
  // ПОРТРЕТНАЯ РАСКЛАДКА (VIEW.portrait). Сцена рисуется на полном виде W = 540…840, H = 840…1260; указатель — в координатах вида.
  // Раскладка считается каждый кадр из VIEW.W / H / safe / scale (PL()), поэтому поворот и ресайз «на лету» перераскладывают её сами.
  // Касание = «тап»: нажал и отпустил, сдвинувшись меньше 8 CSS px (pollGesture); иначе это перетаскивание списка (инерция, колесо мыши).
  // Все кнопки — прямоугольники, зарегистрированные в reg (menu.hits); наведение нужно только мыши, тач работает без него.
  // Кнопки не ниже 44 CSS px (L.bh), текст не мельче ~12 CSS px (L.fs), поля — VIEW.safe + 16. Подробно — docs/portrait_menus.md.
  // =====================================================================================================================
  function resetGesture() { gest.down = false; gest.tap = null; gest.scr = null; gest.moved = false; }
  function initWheel() {   // колесо мыши крутит список под курсором (один обработчик на всю игру)
    if (wheelOn) return; wheelOn = true;
    app.game.canvas.addEventListener('wheel', e => {
      if (!VIEW.portrait || app.cur?.() !== menu) return;
      const p = app.game.toWorld(e.clientX, e.clientY), s = scrollerAt(p.x, p.y); if (!s) return;
      const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
      moveScroll(s, e.deltaY * k / VIEW.scale); s.vy = 0; e.preventDefault();
    }, { passive: false });
  }
  function inR(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function scrollerAt(x, y) { for (const id in scr) { const s = scr[id]; if (s.live && inR(x, y, s.r)) return s; } return null; }
  function moveScroll(s, d) { const n = clamp(s.off + d, 0, s.max); if (n !== s.off + d) s.vy = 0; s.off = n; }
  // Жест: вызывается из update до inp.endStep (там ещё живы pointer.pressed / released)
  function pollGesture(inp, dt) {
    const p = inp.pointer, thr = 8 / VIEW.scale;   // порог тапа — 8 CSS px
    if (p.pressed) { gest.down = true; gest.sx = gest.x = p.rx; gest.sy = gest.y = p.ry; gest.moved = false; gest.vy = 0; gest.scr = scrollerAt(p.rx, p.ry); if (gest.scr) gest.scr.vy = 0; }
    if (gest.down) {
      if (!gest.moved && Math.hypot(p.rx - gest.sx, p.ry - gest.sy) > thr) { gest.moved = true; gest.y = p.ry; }
      if (gest.moved && gest.scr) { const d = gest.y - p.ry; moveScroll(gest.scr, d); gest.vy = gest.vy * 0.55 + (d / Math.max(dt, 1 / 120)) * 0.45; }
      gest.x = p.rx; gest.y = p.ry;
      if (!p.down) {   // отпустили
        if (!gest.moved) gest.tap = { x: gest.sx, y: gest.sy };
        else if (gest.scr) gest.scr.vy = Math.abs(gest.vy) > 120 ? clamp(gest.vy, -3500, 3500) : 0;
        gest.down = false;
      }
    }
    for (const id in scr) {   // инерция после броска
      const s = scr[id]; if (!s.vy || (gest.down && gest.moved && gest.scr === s)) continue;
      moveScroll(s, s.vy * dt); s.vy *= Math.exp(-4.5 * dt); if (Math.abs(s.vy) < 12) s.vy = 0;
    }
  }
  // Тап по прямоугольнику (clip — видимая область списка: за её пределами касание не срабатывает)
  function tapIn(x, y, w, h, clip) {
    const q = gest.tap; if (blocked || !q || q.x < x || q.x > x + w || q.y < y || q.y > y + h || (clip && !inR(q.x, q.y, clip))) return false;
    gest.tap = null; return true;
  }
  function hoverIn(x, y, w, h, clip) {   // наведение — только у мыши
    const inp = app.inp, p = inp.pointer; if (blocked || inp.isTouch || (gest.down && gest.moved)) return false;
    return p.x > x && p.x < x + w && p.y > y && p.y < y + h && (!clip || inR(p.x, p.y, clip));
  }
  function pressIn(x, y, w, h, clip) { return !blocked && gest.down && !gest.moved && gest.sx >= x && gest.sx <= x + w && gest.sy >= y && gest.sy <= y + h && (!clip || inR(gest.sx, gest.sy, clip)); }
  // Прокручиваемая область: scrollBegin → рисуем со сдвигом s.off → scrollEnd(contentH) (длина считается в этом кадре, лимит действует со следующего)
  function scrollBegin(id, r) {
    const s = scr[id] || (scr[id] = { off: 0, vy: 0, max: 0, r, live: false });
    s.r = r; s.live = !blocked; s.off = clamp(s.off, 0, s.max); return s;
  }
  function scrollEnd(ctx, s, contentH) {
    s.max = Math.max(0, Math.ceil(contentH - s.r.h)); s.off = clamp(s.off, 0, s.max);
    if (s.max <= 0) return;
    const r = s.r, bh = Math.max(36, r.h * r.h / contentH), by = r.y + (r.h - bh) * (s.off / s.max);   // полоса прокрутки
    ctx.fillStyle = 'rgba(255,209,102,0.55)'; ctx.beginPath(); ctx.roundRect(r.x + r.w - 5, by, 4, bh, 2); ctx.fill();
    if (s.off > 2) { const g = ctx.createLinearGradient(0, r.y, 0, r.y + 18); g.addColorStop(0, 'rgba(14,6,18,0.85)'); g.addColorStop(1, 'rgba(14,6,18,0)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, 18); }
    if (s.off < s.max - 2) { const g = ctx.createLinearGradient(0, r.y + r.h - 18, 0, r.y + r.h); g.addColorStop(0, 'rgba(14,6,18,0)'); g.addColorStop(1, 'rgba(14,6,18,0.85)'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y + r.h - 18, r.w, 18); }
  }
  // Раскладка кадра: поля = safe + 16, кнопки ≥ 44 CSS px, текст ≥ ~12 CSS px (в логических: делим на VIEW.scale)
  function PL() {
    const V = VIEW, sf = V.safe, M = 16;
    const l = sf.l + M, r = V.W - sf.r - M, t = sf.t + 12, b = V.H - sf.b - 14;
    return { W: V.W, H: V.H, l, r, w: r - l, t, b, bh: Math.max(54, Math.ceil(44 / V.scale)), fs: Math.max(17, Math.ceil(12.5 / V.scale)) };
  }
  // Кнопка-билет, тап по прямоугольнику. o.disabled; o.tapDisabled — вернуть 'dis' при тапе по неактивной; o.chevron — стрелка «назад»; o.clip — видимая область
  function pbtn(ctx, id, x, y, w, h, label, o = {}) {
    reg[id] = { x, y, w, h, disabled: !!o.disabled };
    const over = hoverIn(x, y, w, h, o.clip), press = pressIn(x, y, w, h, o.clip), hk = hover(id, over && !o.disabled, curDt);
    const oo = o.chevron ? { ...o, dx: 12, after: (c, cx, cy, vel) => { c.strokeStyle = vel ? C.gold : C.ink; c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 26, cy - 9); c.lineTo(x + 16, cy); c.lineTo(x + 26, cy + 9); c.stroke(); } } : o;
    tbDraw(ctx, x, y, w, h, label, oo, hk, press && !o.disabled);
    if (!tapIn(x, y, w, h, o.clip)) return false;
    return o.disabled ? (o.tapDisabled ? 'dis' : false) : true;
  }
  // Круглый жетон (R — радиус; тач-цель — квадрат 2R + 8); o.left — подпись слева
  function ptoken(ctx, id, x, y, R, iconFn, o = {}) {
    let lw = 0; if (o.left) { ctx.font = `900 ${o.leftS || 19}px ${FONT}`; lw = ctx.measureText(o.left).width + 12; }
    const hx = x - R - 4 - lw, hy = y - R - 4, hw = R * 2 + 8 + lw, hh = R * 2 + 8;
    reg[id] = { x: hx, y: hy, w: hw, h: hh };
    const over = hoverIn(hx, hy, hw, hh), press = pressIn(hx, hy, hw, hh), hk = hover(id, over, curDt);
    ctx.save(); ctx.translate(x, y - 2 * hk + (press ? 2 : 0)); const k = R / 18;
    ctx.fillStyle = 'rgba(8,2,10,0.5)'; ctx.beginPath(); ctx.arc(0, 3, R, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 2, 0, 0, R); g.addColorStop(0, C.dusk); g.addColorStop(1, C.night);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = hk > 0.01 || press ? C.gold : 'rgba(255,209,102,0.6)'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,209,102,0.2)'; ctx.beginPath(); ctx.arc(0, 0, R - 5, 0, TAU); ctx.stroke();
    ctx.scale(k, k); iconFn(ctx); ctx.restore();
    if (o.left) text(ctx, o.left, x - R - 8, y + 1, { size: o.leftS || 19, align: 'right', color: o.leftColor || C.paper, lw: 4, outline: C.night });
    return tapIn(hx, hy, hw, hh);
  }
  // Билет-кнопка главного меню: рисуется в масштабе k (подписи билета рассчитаны на 260×86; k = 1.5…1.6 даёт ≥ 17 логических), отрыв корешка — как в ландшафте
  function pticket(ctx, id, x, y, w, h, o, k, busy) {
    reg[id] = { x, y, w, h };
    const over = !busy && hoverIn(x, y, w, h), press = !busy && pressIn(x, y, w, h);
    const tk = tear && tear.id === id ? clamp(tear.k / 0.18, 0, 1) : 0, hk = hover(id, over || tk > 0, curDt);
    const lw = w / k, lh = h / k, cx = lw / 2, cy = lh / 2, stub = 24, sx = stub;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.translate(cx, cy - 4 * hk + (press ? 2 : 0)); ctx.rotate(-2 * Math.PI / 180 * hk); ctx.translate(-cx, -cy);
    ctx.save(); ctx.fillStyle = `rgba(8,2,10,${0.4 + 0.15 * hk})`;
    ctx.shadowColor = 'rgba(8,2,10,0.7)'; ctx.shadowBlur = 6 + 6 * hk; ctx.shadowOffsetY = 5 + 4 * hk;
    ctx.beginPath(); ctx.roundRect(2, 2, lw - 4, lh - 4, 5); ctx.fill(); ctx.restore();
    if (tk > 0 || (tear && tear.id === id)) {
      ctx.save(); ctx.beginPath(); ctx.rect(sx, -20, lw, lh + 40); ctx.clip(); ticketFace(ctx, 0, 0, lw, lh, o); ctx.restore();
      const fk = tear.k / 0.32;
      ctx.save(); ctx.globalAlpha = clamp(1.4 - fk * 1.4, 0, 1);
      ctx.translate(sx, lh); ctx.rotate(-0.9 * fk * fk - 0.15 * tk); ctx.translate(-14 * fk, 70 * fk * fk); ctx.translate(-sx, -lh);
      ctx.beginPath(); ctx.rect(-20, -20, stub + 20, lh + 40); ctx.clip(); ticketFace(ctx, 0, 0, lw, lh, o); ctx.restore();
    } else ticketFace(ctx, 0, 0, lw, lh, o);
    ctx.restore();
    return !busy && tapIn(x, y, w, h);
  }
  // Ссылка-текст с тач-целью высотой hh
  function plink(ctx, id, s, cx, cy, size, hh, color) {
    ctx.font = `900 ${size}px ${FONT}`; const w = ctx.measureText(s).width, x = cx - w / 2 - 20, y = cy - hh / 2, ww = w + 40;
    reg[id] = { x, y, w: ww, h: hh };
    const over = hoverIn(x, y, ww, hh), press = pressIn(x, y, ww, hh), col = over || press ? C.gold : (color || '#ffd0dc');
    text(ctx, s, cx, cy, { size, color: col, lw: 4, outline: C.night });
    ctx.fillStyle = col; ctx.globalAlpha = over ? 1 : 0.6; ctx.fillRect(cx - w / 2, cy + size * 0.62, w, 1.5); ctx.globalAlpha = 1;
    return tapIn(x, y, ww, hh);
  }

  // ---------- фон и атмосфера в портрете ----------
  // Фон 960×540 вписан «cover» по высоте вида (s = H/540), по ширине показана полоса вокруг фокуса (доля ширины фона): фасад кинотеатра в центре
  function drawBgP(ctx, focus = 0.6) {
    const V = VIEW, s = Math.max(V.W / 960, V.H / 540), ex = 960 * s - V.W, ey = 540 * s - V.H;
    ctx.save(); ctx.translate(-ex * focus, -ey * 0.5); ctx.scale(s, s);
    if (!drawSceneBg(ctx, 'facade2') && !drawSceneBg(ctx, 'facade')) drawBackground(ctx, 'facade', t);
    ctx.restore();
    ctx.fillStyle = 'rgba(14,6,18,0.28)'; ctx.fillRect(0, 0, V.W, V.H);
  }
  function drawFogP(ctx, a) {
    const V = VIEW, k = V.W / 960, y0 = V.H - 260;
    const g = ctx.createLinearGradient(0, y0, 0, V.H); g.addColorStop(0, 'rgba(26,11,46,0)'); g.addColorStop(1, `rgba(26,11,46,${0.8 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, y0, V.W, 260);
    for (const f of fog) {
      const w = f.w * Math.max(k, 0.8) * 1.3, x = f.x * k, y = V.H - 80 + (f.y - 470) * 1.6;
      const rg = ctx.createRadialGradient(x + w / 2, y, 4, x + w / 2, y, w / 2); rg.addColorStop(0, `rgba(58,30,84,${0.35 * a})`); rg.addColorStop(1, 'rgba(26,11,46,0)');
      ctx.save(); ctx.translate(x + w / 2, y); ctx.scale(1, 0.22); ctx.translate(-(x + w / 2), -y); ctx.fillStyle = rg; ctx.fillRect(x, y - w / 2, w, w); ctx.restore();
    }
  }
  function drawVigP(ctx) {
    const V = VIEW, g = ctx.createRadialGradient(V.W / 2, V.H / 2, V.H * 0.38, V.W / 2, V.H / 2, V.H * 0.82);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, V.W, V.H);
  }

  // ---------- вход в портретный кадр ----------
  function drawPortrait(ctx) {
    const inp = app.inp, S = app.save, V = VIEW;
    const dt = clamp(t - drawT, 0, 0.1); drawT = t; curDt = dt; blocked = false;
    for (const k in reg) delete reg[k];
    for (const k in scr) scr[k].live = false;
    const L = PL();
    drawBgP(ctx);
    drawLeaves(ctx, V.W / 980, V.H / 540, 1.4);
    post.calm = view === 'wardrobe';
    if (view === 'main') drawMainP(ctx, inp, S, dt, L);
    else {
      drawFogP(ctx, 0.8); drawVigP(ctx);
      ctx.fillStyle = 'rgba(14,6,18,0.8)'; ctx.fillRect(0, 0, V.W, V.H);
      if (view === 'shop') drawShopP(ctx, S, dt, L);
      else if (view === 'ach') drawAchP(ctx, S, dt, L);
      else if (view === 'wardrobe') drawWardrobeP(ctx, inp, S, dt, L);
      else if (view === 'settings') drawSettingsP(ctx, S, dt, L);
    }
    gest.tap = null;   // касание, которое никто не принял, сгорает в конце кадра
  }

  // ---------- главное меню ----------
  function drawMainP(ctx, inp, S, dt, L) {
    const V = VIEW, prog = S.progress || 0, busy = !!tear, fs = L.fs;
    const shopOpen = (S.stats?.deaths || 0) > 0 || Object.keys(S.meta || {}).length > 0;
    const tr = Math.max(26, Math.round(L.bh / 2) - 2), ty = L.t + tr;
    // низ экрана (зона большого пальца): билеты столбиком; героиня стоит над ними
    const hp = Math.max(100, L.bh + 36), h2 = Math.max(76, L.bh + 14), gap = 12, linkH = prog > 0 ? L.bh : 0;
    const mqY = ty + tr + 14, mqH = clamp(Math.round(L.w * 0.4), 170, 230), heroTop = mqY + mqH + 6;
    const stackH = row => hp + gap + (shopOpen && !row ? 2 * h2 + gap : h2) + (linkH ? gap + linkH : 0);
    const row = shopOpen && (L.b - stackH(false)) - heroTop < 340;
    const stackTop = L.b - stackH(row);
    const feetY = stackTop + 24, heroH = clamp(feetY - heroTop + 24, 260, 900), hx = V.W * 0.57;
    // героиня и питомец
    const g = ctx.createLinearGradient(0, V.H * 0.45, 0, V.H); g.addColorStop(0, 'rgba(14,6,18,0)'); g.addColorStop(1, 'rgba(14,6,18,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, V.H * 0.45, V.W, V.H * 0.55);
    drawFogP(ctx, 1);
    stagePet(ctx, 'main', ensureAcc(S).equip.pet, hx - heroH * 0.3, feetY - heroH * 0.45 + Math.sin(t * 1.1) * 4, heroH * 0.17, dt, true);
    if (!drawHeroineKey(ctx, hx, feetY, heroH, S.outfit || 'lara', { t }))
      drawHeroine(ctx, hx - 10, feetY - 20, heroH * 0.75, { kind: 'aim', t, blink: (t % 3.6) < 0.12 ? 1 : 0 }, S.outfit || 'lara', { flip: true });
    const fg = ctx.createLinearGradient(0, feetY - 50, 0, feetY + 40); fg.addColorStop(0, 'rgba(26,11,46,0)'); fg.addColorStop(1, 'rgba(26,11,46,0.6)');
    ctx.fillStyle = fg; ctx.fillRect(0, feetY - 50, V.W, 90);
    drawVigP(ctx);
    if (bark) drawBark(ctx, bark, Math.max(L.l + 110, hx - heroH * 0.3), feetY - heroH * 0.9, 1.3);
    // верхняя полоса: конфеты слева; настройки, достижения и звук — жетонами справа
    ctx.save(); ctx.translate(L.l + 22, ty); ctx.scale(1.3, 1.3); drawBucket(ctx, 0, 0, S.candies); ctx.restore();
    const got = Object.keys(S.ach).length, on = S.settings.sfx > 0, lab = `${got}/${ACHIEVEMENTS.length}`;
    ctx.font = `900 ${fs + 1}px ${FONT}`; const labW = ctx.measureText(lab).width + 12;
    const xSnd = L.r - tr, xAch = xSnd - 2 * tr - 14, xSet = xAch - tr - labW - 14 - tr;
    if (ptoken(ctx, 'snd', xSnd, ty, tr, c => drawSpeaker(c, 0, 0, on))) { app.toggleSound(); sfx('select'); }
    if (ptoken(ctx, 'ach', xAch, ty, tr, c => drawStar(c, 0, 0, 11, C.gold), { left: lab, leftS: fs + 1, leftColor: C.mint }) && !busy) { view = 'ach'; if (scr.ach) scr.ach.off = 0; confirmNew = false; sfx('select'); }
    if (ptoken(ctx, 'settings', xSet, ty, tr, c => drawGear(c, 0, 0)) && !busy) { view = 'settings'; confirmNew = false; sfx('select'); }
    // афиша: табло с названием
    drawMarquee(ctx, L.l, mqY, L.w, mqH, 18);
    ctx.save(); ctx.translate(L.l + L.w / 2, mqY + mqH * 0.34); ctx.rotate(-0.025 + Math.sin(t * 1.3) * 0.008);
    fitText(ctx, 'Поппи:', 0, 0, L.w - 90, Math.round(mqH * 0.42), { color: C.velvet, lw: 9, outline: '#0e0204' });
    fitText(ctx, 'Хэллоуинский кошмар', 0, mqH * 0.355, L.w - 80, Math.round(mqH * 0.19), { color: C.velvet, lw: 6, outline: '#0e0204' });
    ctx.restore();
    // билеты
    const main = prog > 0 ? { label: 'ПРОДОЛЖИТЬ', sub: `ГЛАВА ${prog + 1} · РЯД 13 · МЕСТО 31` } : { label: 'ИГРАТЬ', sub: 'РЯД 13 · МЕСТО 31' };
    let y = stackTop;
    if (pticket(ctx, 'play', L.l, y, L.w, hp, { ...main, velvet: true, stub: 'ВХОД', labS: 32, subS: 11.5, stubS: 11.5 }, 1.6, busy)) tearTicket('play', mainAct());
    y += hp + gap;
    const wardO = { label: 'ГАРДЕРОБ', sub: 'РЯД 13 · МЕСТО 31', icon: 'hanger', subS: 11.5 }, shopO = { label: 'КОСМЕТИЧКА', sub: 'РЯД 13 · МЕСТО 31', icon: 'lipstick', subS: 11.5 };
    const goWard = () => { view = 'wardrobe'; confirmNew = false; sfx('select'); }, goShop = () => { view = 'shop'; shopPage = 0; confirmNew = false; if (scr.shop) scr.shop.off = 0; sfx('select'); };
    if (row) {
      const w2 = (L.w - gap) / 2;
      if (pticket(ctx, 'wardrobe', L.l, y, w2, h2, wardO, 1.5, busy)) tearTicket('wardrobe', goWard);
      if (pticket(ctx, 'shop', L.l + w2 + gap, y, w2, h2, shopO, 1.5, busy)) tearTicket('shop', goShop);
      y += h2 + gap;
    } else {
      const w2 = Math.round(L.w * 0.82), x2 = L.l + (L.w - w2) / 2;
      if (pticket(ctx, 'wardrobe', x2, y, w2, h2, wardO, 1.5, busy)) tearTicket('wardrobe', goWard);
      y += h2 + gap;
      if (shopOpen) { if (pticket(ctx, 'shop', x2, y, w2, h2, shopO, 1.5, busy)) tearTicket('shop', goShop); y += h2 + gap; }
    }
    // «Новая игра» — ссылкой, с подтверждением
    if (prog > 0) {
      const cy = y + linkH / 2, cx = L.l + L.w / 2;
      if (!confirmNew) { if (plink(ctx, 'newgame', 'Новая игра', cx, cy, fs + 1, linkH) && !busy) { confirmNew = true; sfx('select'); } }
      else {
        text(ctx, 'Начать сначала?', cx - 100, cy, { size: fs + 1, color: C.paper, lw: 4, outline: C.night });
        if (pbtn(ctx, 'new_yes', cx + 40, y + 2, 84, linkH - 4, 'Да', { size: fs + 1, velvet: true }) && !busy) { confirmNew = false; tearTicket('play', () => app.startStory()); }
        if (pbtn(ctx, 'new_no', cx + 132, y + 2, 84, linkH - 4, 'Нет', { size: fs + 1 })) { confirmNew = false; sfx('select'); }
      }
    }
  }

  // Шапка подэкрана: «Назад» слева сверху, заголовок, подпись справа. Возвращает y начала содержимого.
  // rightFn(ctx, L, measure): при measure = true возвращает занятую справа ширину, иначе рисует.
  function subHeader(ctx, L, title, rightFn) {
    if (pbtn(ctx, 'back', L.l, L.t, 132, L.bh, 'Назад', { size: L.fs + 3, chevron: true })) { view = 'main'; sfx('select'); }
    const x = L.l + 132 + 14, rw = rightFn ? rightFn(ctx, L, true) : 0;
    ctx.save(); ctx.letterSpacing = '1px';
    fitText(ctx, title, x, L.t + L.bh / 2 + 1, L.r - x - rw, L.fs + 11, { align: 'left', color: C.gold, lw: 6, outline: C.night });
    ctx.restore();
    if (rightFn) rightFn(ctx, L, false);
    return L.t + L.bh + 14;
  }

  // ---------- гардероб (портрет) ----------
  // Сверху: шапка («Назад», конфеты, стразы +) и постер ≈ 46 % высоты: героиня крупно слева, справа мини-сцена «в бою» и переключатель «Лицом / Спиной».
  // Снизу: вкладки «Наряды | Аксессуары», ряд слотов (аксессуары), прокручиваемая сетка карточек, закреплённая панель действия (описание + «Надеть / Купить»).
  function drawGemChipP(ctx, S, dt, L, y) {
    const n = gemsOf(S), bh = L.bh;
    if (gemShown === null) gemShown = n;
    gemShown += (n - gemShown) * Math.min(1, dt * 8); if (Math.abs(n - gemShown) < 0.5) gemShown = n;
    gemPulse = Math.max(0, gemPulse - dt * 2.5);
    const px = L.r - bh, cw = 150, cx = px - 6 - cw, kx = cx - 8 - 112;
    // конфеты
    cinemaPanel(ctx, kx, y, 112, bh, { r: bh / 2 });
    ctx.save(); ctx.translate(kx + 26, y + bh / 2 + 1); ctx.scale(0.95, 0.95); drawBucket(ctx, 0, 0, S.candies); ctx.restore();
    // стразы: счётчик и «+»
    reg.gems = { x: cx, y, w: cw, h: bh };
    const over = hoverIn(cx, y, cw, bh), hk = hover('gemcount', over, curDt);
    ctx.save(); ctx.translate(cx + cw / 2, y + bh / 2); const sc = 1 + 0.1 * gemPulse; ctx.scale(sc, sc); ctx.translate(-cx - cw / 2, -y - bh / 2);
    cinemaPanel(ctx, cx, y - hk, cw, bh, { r: bh / 2, on: over || gemPulse > 0.05, stroke: gemPulse > 0.05 ? '#ff9ad0' : undefined });
    drawGem(ctx, cx + 28, y + bh / 2 - hk, 13, { t, shadow: true });
    text(ctx, String(Math.round(gemShown)), cx + 52, y + bh / 2 + 1 - hk, { size: 24, align: 'left', color: gemPulse > 0.05 ? '#ffd2ec' : C.gold, lw: 5, outline: C.night });
    ctx.restore();
    let go = tapIn(cx, y, cw, bh);
    if (pbtn(ctx, 'gemplus', px, y, bh, bh, '+', { size: 34, velvet: true })) go = true;
    if (go) { openTopup(); sfx('select', { pitch: 1.2 }); }
  }
  function drawWardrobeP(ctx, inp, S, dt, L) {
    const V = VIEW, A = ensureAcc(S), cur = S.outfit || 'lara', acc = wtab === 'acc', bh = L.bh, fs = L.fs;
    blocked = topup.open;   // пока открыто окно стразов, всё под ним не реагирует
    for (const w of WARDROBE) { loadHeroineKey(w.id); loadHeroineVec(w.id); if (facingOf(S) === 'back') loadHeroineBack(w.id); }
    const isOpen = w => !w.unlock || S.ach[w.unlock];
    const back = facingOf(S) === 'back', backOpen = !!S.ach[BACK_POSE_ACH];
    // --- шапка
    if (pbtn(ctx, 'back', L.l, L.t, 132, bh, 'Назад', { size: fs + 3, chevron: true })) { view = 'main'; sfx('select'); }
    drawGemChipP(ctx, S, dt, L, L.t);
    // --- что показываем
    const items = acc ? ACCESSORIES.filter(a => a.slot === accSlot) : WARDROBE;
    let showOutfit = cur, trying = false, sel = null;   // sel — предмет в панели действия
    const tryOn = { ...A.equip };
    if (acc) {
      const pick = ACC[accSel[accSlot]];
      sel = (pick && pick.slot === accSlot ? pick : null) || ACC[A.equip[accSlot]] || items[0];
      if (pick && pick === sel) tryOn[accSlot] = pick.id;
      trying = !!tryOn[accSlot] && A.equip[accSlot] !== tryOn[accSlot];
    } else {
      sel = WARDROBE.find(w => w.id === outSel) || WARDROBE.find(w => w.id === cur) || WARDROBE[0];
      if (isOpen(sel)) showOutfit = sel.id;
      trying = showOutfit !== cur;
    }
    loadHeroineKey(showOutfit);
    // --- постер
    const zy = L.t + bh + 10, hb = Math.max(zy + 250, Math.round(V.H * 0.46)), pH = hb - zy, px = L.l, pw = L.w;
    cinemaPanel(ctx, px, zy, pw, pH, { on: true });
    const cw = clamp(Math.round(pw * 0.4), 170, 250), cx0 = px + pw - cw - 10;
    ctx.save(); ctx.beginPath(); ctx.roundRect(px + 3, zy + 3, pw - 6, pH - 6, 11); ctx.clip();
    const heroH = pH - 44, feet = zy + pH - 14, fx = px + (pw - cw - 10) / 2 + 4;
    const bgG = ctx.createLinearGradient(0, zy, 0, zy + pH); bgG.addColorStop(0, 'rgba(255,241,201,0.22)'); bgG.addColorStop(1, 'rgba(255,241,201,0.04)');
    ctx.fillStyle = bgG; ctx.beginPath(); ctx.moveTo(fx - 28, zy); ctx.lineTo(fx + 28, zy); ctx.lineTo(fx + 150, zy + pH); ctx.lineTo(fx - 150, zy + pH); ctx.closePath(); ctx.fill();
    const fl = ctx.createRadialGradient(fx, feet - 8, 4, fx, feet - 8, 130); fl.addColorStop(0, 'rgba(255,209,102,0.35)'); fl.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.save(); ctx.translate(fx, feet - 8); ctx.scale(1, 0.22); ctx.translate(-fx, -(feet - 8)); ctx.fillStyle = fl; ctx.fillRect(fx - 130, feet - 138, 260, 260); ctx.restore();
    stagePet(ctx, 'poster', tryOn.pet, Math.max(px + 40, fx - heroH * 0.25), feet - heroH * 0.37 + Math.sin(t * 1.3) * 3, heroH * 0.18, dt, acc);
    if (!drawHeroineKey(ctx, fx + 6, feet, heroH, showOutfit, acc ? { t, acc: tryOn } : { t }))
      drawHeroine(ctx, fx, feet, heroH * 0.85, { kind: 'stand', t }, showOutfit, acc ? { acc: tryOn } : {});
    ctx.restore();
    ctx.save(); ctx.letterSpacing = '1.5px';
    const eqNow = acc ? A.equip[accSlot] === sel?.id : cur === sel?.id;
    text(ctx, trying ? 'ПРИМЕРКА' : 'СЕЙЧАС НА ПОППИ', px + 16, zy + 22, { size: fs - 1, align: 'left', color: trying ? C.mint : C.gold, lw: 4, outline: C.night });
    ctx.restore();
    // --- справа: мини-сцена «в бою» и переключатель позы
    const tY = zy + pH - 10 - bh, dY = zy + 10, dH = tY - 8 - dY, bw2 = (cw - 6) / 2;
    drawDemo(ctx, tryOn, showOutfit, cx0, dY, cw, dH, dt, { facing: back ? 'back' : 'front', fh: Math.min(150, (dH - 30) / 1.26), label: trying ? 'ПРИМЕРКА' : 'В БОЮ', lsize: fs - 2 });
    if (pbtn(ctx, 'face_front', cx0, tY, bw2, bh, 'Лицом', { size: fs, velvet: !back }) && back) { S.facing = 'front'; app.persist(); sfx('select', { pitch: 1.2 }); }
    if (backOpen) {
      if (pbtn(ctx, 'face_back', cx0 + bw2 + 6, tY, bw2, bh, 'Спиной', { size: fs, velvet: back }) && !back) { S.facing = 'back'; app.persist(); loadHeroineBack(showOutfit); sfx('select', { pitch: 1.2 }); }
    } else {
      const r = pbtn(ctx, 'face_back', cx0 + bw2 + 6, tY, bw2, bh, 'Спиной', { size: fs - 1, disabled: true, tapDisabled: true });
      lockGlyph(ctx, cx0 + bw2 + 6 + bw2 - 14, tY + 17, C.ink, 0.95);
      if (r === 'dis') { lockHint = 3; sfx('select', { pitch: 0.6 }); }
    }
    lockHint = Math.max(0, lockHint - dt);
    if (lockHint > 0) {   // подсказка: как открыть позу «Спиной»
      const hl = wrap(ctx, BACK_POSE_HINT, cw - 24, fs - 1, 800);
      ctx.save(); ctx.globalAlpha = Math.min(1, lockHint * 4);
      ctx.fillStyle = 'rgba(14,4,20,0.92)'; ctx.beginPath(); ctx.roundRect(cx0, dY, cw, dH, 10); ctx.fill();
      lockGlyph(ctx, cx0 + cw / 2, dY + 22, C.gold, 1.4);
      hl.forEach((l, k) => text(ctx, l, cx0 + cw / 2, dY + 52 + k * (fs + 3), { size: fs - 1, color: C.gold, outline: false, weight: 800 }));
      ctx.restore();
    }
    // --- нижняя часть
    let y = hb + 8;
    const tw = (L.w - 8) / 2;
    if (pbtn(ctx, 'wtab_o', L.l, y, tw, bh, 'Наряды', { size: fs + 3, velvet: !acc }) && acc) { wtab = 'outfits'; if (scr.wlist) scr.wlist.off = 0; sfx('select'); }
    if (pbtn(ctx, 'wtab_a', L.l + tw + 8, y, tw, bh, 'Аксессуары', { size: fs + 3, velvet: acc }) && !acc) { wtab = 'acc'; if (scr.wlist) scr.wlist.off = 0; sfx('select'); }
    y += bh + 8;
    if (acc) {   // слоты: питомец, бластер, заколка, брелок, след
      const sw = (L.w - 4 * 6) / 5, sh = Math.max(72, bh + 8);
      SLOTS.forEach((sl, i) => {
        const x = L.l + i * (sw + 6), on = sl.id === accSlot;
        reg['slot_' + sl.id] = { x, y, w: sw, h: sh };
        const hk = hover('slot' + sl.id, hoverIn(x, y, sw, sh), dt), press = pressIn(x, y, sw, sh), dy = -2 * hk + (press ? 2 : 0);
        cinemaPanel(ctx, x, y + dy, sw, sh, { on, r: 10 });
        const eq = A.equip[sl.id], iconId = eq || ACCESSORIES.find(a => a.slot === sl.id)?.id;
        ctx.save(); if (!eq) ctx.globalAlpha = 0.5; drawAccIcon(ctx, iconId, sl.id, x + sw / 2, y + 27 + dy, 38, t); ctx.restore();
        fitText(ctx, sl.name, x + sw / 2, y + sh - 16 + dy, sw - 6, fs, { color: on ? C.gold : C.paper, outline: C.night, lw: 3 });
        const n = ACCESSORIES.filter(a => a.slot === sl.id && owns(S, a.id)).length;
        if (n) { ctx.fillStyle = C.lipstick; ctx.beginPath(); ctx.arc(x + sw - 11, y + 11 + dy, 10, 0, TAU); ctx.fill(); text(ctx, String(n), x + sw - 11, y + 12 + dy, { size: 14, color: '#fff', outline: false }); }
        if (tapIn(x, y, sw, sh)) { accSlot = sl.id; if (scr.wlist) scr.wlist.off = 0; sfx('select'); }
      });
      y += sh + 8;
    }
    // --- закреплённая панель действия
    const abH = Math.max(112, Math.round(V.H * 0.12)), abY = L.b - abH;
    // --- сетка карточек
    const lv = { x: L.l, y, w: L.w, h: Math.max(60, abY - 8 - y) };
    const cols = L.w >= 560 ? 3 : 2, gp = 8, cwd = (lv.w - gp * (cols - 1)) / cols, nr = Math.ceil(items.length / cols);
    const ch = acc ? Math.max(116, Math.round(fs * 6.2)) : clamp(Math.floor((lv.h - gp * (nr - 1) - 4) / nr), 116, 300);   // наряды: мало карточек — растягиваем на всю высоту
    const contentH = nr * ch + (nr - 1) * gp + 4;
    const sc = scrollBegin('wlist', lv);
    ctx.save(); ctx.beginPath(); ctx.rect(lv.x - 4, lv.y, lv.w + 8, lv.h); ctx.clip();
    items.forEach((it, i) => {
      const x = lv.x + (i % cols) * (cwd + gp), cy = lv.y + Math.floor(i / cols) * (ch + gp) - sc.off;
      if (cy > lv.y + lv.h || cy + ch < lv.y) return;
      reg['card_' + (it.id)] = { x, y: cy, w: cwd, h: ch };
      const press = pressIn(x, cy, cwd, ch, lv);
      ctx.save(); if (press) ctx.translate(0, 2);
      if (acc) accCardP(ctx, S, A, it, x, cy, cwd, ch, it === sel, fs, dt);
      else outfitCardP(ctx, S, it, x, cy, cwd, ch, it === sel, cur === it.id, isOpen(it), fs);
      ctx.restore();
      if (tapIn(x, cy, cwd, ch, lv)) { if (acc) { accSel[accSlot] = it.id; loadAccVec(it.id); } else { outSel = it.id; loadHeroineKey(it.id); } sfx('select', { pitch: 1.1 }); }
    });
    ctx.restore();
    scrollEnd(ctx, sc, contentH);
    // --- панель действия
    cinemaPanel(ctx, L.l, abY, L.w, abH, { on: true });
    const bw = clamp(Math.round(L.w * 0.31), 140, 190), bx = L.r - bw - 10, x0 = L.l + 16, w0 = bx - 12 - x0;
    let status = '', stCol = C.paper, body = '', bodyCol = '#ffe6ef', name = sel?.name || '', btn = null;
    if (sel && acc) {
      const R = RARITY[sel.rarity], own = owns(S, sel.id), on = A.equip[accSlot] === sel.id, priced = !own && sel.src === 'shop', short = priced ? gemsShort(S, sel) : 0;
      status = R.name; stCol = R.color;
      if (priced) status += ` · ${sel.price} ${gemWord(sel.price)}`;
      else if (own) status += on ? ' · надето' : ' · в гардеробе';
      body = own || priced ? sel.flavor : accHint(sel, achName, true); bodyCol = own || priced ? '#ffe6ef' : C.gold;
      if (short) body = `Нужно ещё ${short} ${gemWord(short)}. ` + sel.flavor;
      if (own) btn = { label: on ? 'Снять' : 'Надеть', velvet: !on, act: () => { equipAcc(S, sel.id); app.persist(); loadAccVec(sel.id); sfx('select', { pitch: on ? 0.9 : 1.3 }); } };
      else if (sel.src === 'shop') btn = short ? { label: 'Пополнить', act: () => { openTopup(); sfx('select', { pitch: 1.2 }); } }
        : { label: 'Купить', velvet: true, price: sel.price, act: () => { if (buyAcc(S, sel.id)) { app.persist(); loadAccVec(sel.id); stamps[sel.id] = 0; gemPulse = 1; sfx('coin', { pitch: 1.2 }); sfx('select', { pitch: 1.5 }); } } };
      else btn = { label: 'Закрыто', disabled: true, lock: true };
    } else if (sel) {
      const open = isOpen(sel), on = cur === sel.id;
      status = on ? 'сейчас на Поппи' : open ? 'в гардеробе' : 'закрыто'; stCol = on ? C.gold : open ? C.mint : C.gold;
      body = open ? sel.desc : sel.hint; bodyCol = open ? '#ffe6ef' : C.gold;
      btn = !open ? { label: 'Закрыто', disabled: true, lock: true } : on ? { label: '★ Надето', disabled: true } : { label: 'Надеть', velvet: true, act: () => { S.outfit = sel.id; app.persist(); loadHeroineKey(sel.id); sfx('select', { pitch: 1.3 }); } };
    }
    if (sel) {
      let ty = abY + 12;
      fitText(ctx, name, x0, ty + (fs + 4) / 2, w0, fs + 3, { align: 'left', color: C.paper, lw: 4, outline: C.night }); ty += fs + 6;
      fitText(ctx, status, x0, ty + fs / 2, w0, fs - 1, { align: 'left', color: stCol, lw: 3, outline: C.night, weight: 800 }); ty += fs + 3;
      const fl = fitLines(ctx, body, w0, fs - 1, Math.max(1, Math.floor((abY + abH - 8 - ty) / (fs + 2))), 14, 700);
      fl.lines.forEach((l, k) => text(ctx, l, x0, ty + (fs + 2) / 2 + k * (fs + 2), { size: fl.size, align: 'left', color: bodyCol, outline: false, weight: 700 }));
      if (btn) {
        const by2 = abY + (abH - (bh + 8)) / 2, bhh = bh + 8;
        const extra = btn.lock ? (c, cx, cy) => { c.font = `900 ${fs + 3}px ${FONT}`; lockGlyph(c, cx + 14 - c.measureText(btn.label).width / 2 - 14, cy + 4, C.ink, 1.1); }
          : btn.price ? (c, cx, cy) => { c.font = `900 ${fs}px ${FONT}`; const pw = c.measureText(String(btn.price)).width; text(c, String(btn.price), cx + 12, cy + 15, { size: fs, color: C.gold, lw: 3, outline: C.velvetD }); drawGem(c, cx - pw / 2 - 2, cy + 14, 7.5, { shadow: true }); } : undefined;
        const r = pbtn(ctx, 'action', bx, by2, bw, bhh, btn.label, { size: fs + 3, velvet: btn.velvet, disabled: btn.disabled, dy: btn.price ? -9 : 0, dx: btn.lock ? 14 : 0, after: extra });
        if (r === true) btn.act();
      }
    }
    // штампы «КУПЛЕНО» над панелью
    for (const id in stamps) {
      const st = stamps[id] += dt, k = Math.min(1, st / 0.14), a = st > 1.0 ? Math.max(0, 1 - (st - 1.0) / 0.35) : 1;
      if (st > 1.35) { delete stamps[id]; continue; }
      ctx.save(); ctx.globalAlpha = a; ctx.translate(L.l + L.w / 2, abY - 40); ctx.rotate(-0.12); const sc2 = (1 + (1 - k) * 1.4) * 1.3; ctx.scale(sc2, sc2);
      ctx.fillStyle = 'rgba(40,6,20,0.78)'; ctx.beginPath(); ctx.roundRect(-58, -17, 116, 34, 6); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#ff3b8a'; ctx.beginPath(); ctx.roundRect(-58, -17, 116, 34, 6); ctx.stroke();
      text(ctx, 'КУПЛЕНО', 0, 1, { size: 22, color: '#ff3b8a', lw: 4, outline: '#1a0414' });
      ctx.restore();
    }
    drawTopupP(ctx, S, dt, L);
  }
  // карточка аксессуара: рисунок слева, название в 2 строки, снизу цена / состояние
  function accCardP(ctx, S, A, it, x, y, w, h, sel, fs, dt) {
    const R = RARITY[it.rarity], own = owns(S, it.id), on = A.equip[it.slot] === it.id, priced = !own && it.src === 'shop', short = priced ? gemsShort(S, it) : 0;
    cinemaPanel(ctx, x, y, w, h, { stroke: sel ? C.gold : on ? C.gold : R.color, on: on || sel, dim: !own });
    if (sel) { ctx.lineWidth = 3; ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 14); ctx.stroke(); }
    if (it.rarity === 'legend') {   // бегущий блик по рамке легендарки
      const k = (t * 0.6) % 1, g = ctx.createLinearGradient(x + w * (k - 0.3), 0, x + w * (k + 0.1), 0);
      g.addColorStop(0, 'rgba(255,209,102,0)'); g.addColorStop(0.5, 'rgba(255,250,220,0.9)'); g.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.lineWidth = 3; ctx.strokeStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.stroke();
    }
    const isz = Math.min(76, h - 40), ix = x + 12 + isz / 2, iy = y + 12 + isz / 2 + 2;
    const ig = ctx.createRadialGradient(ix, iy, 3, ix, iy, isz * 0.62); ig.addColorStop(0, own ? 'rgba(255,209,102,0.22)' : 'rgba(243,226,192,0.08)'); ig.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, isz * 0.62, 0, TAU); ctx.fill();
    ctx.save(); if (!own) ctx.globalAlpha = 0.6; drawAccIcon(ctx, it.id, it.slot, ix, iy, isz, t); ctx.restore();
    if (!own && it.src !== 'shop') lockGlyph(ctx, ix + isz * 0.34, iy + isz * 0.36, C.gold, 1.2);
    const tx = x + isz + 24, tw = w - isz - 34, nm = nameLines(ctx, it.name, tw, fs + 1, 3, 14);
    nm.lines.forEach((l, k) => fitText(ctx, l, tx, y + 18 + k * (nm.size + 3), tw, nm.size, { align: 'left', color: own ? '#fff' : '#e8d8e0', outline: C.night, lw: 3 }));
    // нижняя строка: состояние / цена
    const sy = y + h - 20;
    if (on) text(ctx, '★ надето', tx, sy, { size: fs - 1, align: 'left', color: C.gold, lw: 3, outline: C.night });
    else if (own) text(ctx, 'в гардеробе', tx, sy, { size: fs - 1, align: 'left', color: C.mint, lw: 3, outline: C.night, weight: 800 });
    else if (priced) {
      ctx.font = `900 ${fs}px ${FONT}`; const pw = ctx.measureText(String(it.price)).width;
      drawGem(ctx, tx + 8, sy, 8, { shadow: true });
      text(ctx, String(it.price), tx + 22, sy, { size: fs, align: 'left', color: short ? '#ffb8d8' : C.gold, lw: 3, outline: C.night });
    } else text(ctx, 'закрыто', tx, sy, { size: fs - 1, align: 'left', color: C.gold, lw: 3, outline: C.night, weight: 800 });
  }
  // карточка наряда: героиня в этом наряде, название, состояние
  function outfitCardP(ctx, S, wd, x, y, w, h, sel, on, open, fs) {
    cinemaPanel(ctx, x, y, w, h, { on: on || sel, dim: !open, stroke: sel ? C.gold : undefined });
    if (h > 170) {   // высокая карточка (мало нарядов): героиня крупно, подпись снизу по центру
      const hh = h - 84, cx = x + w / 2;
      const sg = ctx.createRadialGradient(cx, y + h - 66, 2, cx, y + h - 66, 80); sg.addColorStop(0, open ? 'rgba(255,209,102,0.28)' : 'rgba(243,226,192,0.08)'); sg.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.save(); ctx.translate(cx, y + h - 66); ctx.scale(1, 0.2); ctx.translate(-cx, -(y + h - 66)); ctx.fillStyle = sg; ctx.fillRect(cx - 80, y + h - 146, 160, 160); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 12); ctx.clip(); if (!open) ctx.filter = 'brightness(0.12)';
      drawHeroine(ctx, cx, y + h - 66, hh, { kind: 'stand', t }, wd.id); ctx.restore();
      if (!open) lockGlyph(ctx, cx, y + h * 0.4, C.gold, 2);
      const nm = nameLines(ctx, wd.name, w - 20, fs + 2, 2, 14);
      nm.lines.forEach((l, k) => fitText(ctx, l, cx, y + h - 54 + k * (nm.size + 3), w - 20, nm.size, { color: open ? C.paper : '#cfb8c8', outline: C.night, lw: 4 }));
      text(ctx, on ? '★ надето' : open ? 'в гардеробе' : 'закрыто', cx, y + h - 16, { size: fs - 1, color: on ? C.gold : open ? C.mint : C.gold, lw: 3, outline: C.night, weight: 800 });
      return;
    }
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 12); ctx.clip();
    const sz = h - 14;
    if (!open) ctx.filter = 'brightness(0.12)';
    drawHeroine(ctx, x + 12 + sz * 0.3, y + h - 8, sz, { kind: 'stand', t }, wd.id);
    ctx.restore();
    if (!open) lockGlyph(ctx, x + 12 + sz * 0.3, y + h * 0.5, C.gold, 1.6);
    const tx = x + sz * 0.6 + 26, tw = w - (tx - x) - 10, nm = nameLines(ctx, wd.name, tw, fs + 1, 3, 14);
    nm.lines.forEach((l, k) => fitText(ctx, l, tx, y + 18 + k * (nm.size + 3), tw, nm.size, { align: 'left', color: open ? C.paper : '#cfb8c8', outline: C.night, lw: 3 }));
    const sy = y + h - 20;
    text(ctx, on ? '★ надето' : open ? 'в гардеробе' : 'закрыто', tx, sy, { size: fs - 1, align: 'left', color: on ? C.gold : open ? C.mint : C.gold, lw: 3, outline: C.night, weight: 800 });
  }

  // ---------- окно «Пополнить стразы» (портрет): панель на весь экран, 4 пакета сеткой 2×2 ----------
  function drawTopupP(ctx, S, dt, L) {
    if (!topup.open) return;
    blocked = false;
    topup.t += dt; if (topup.msg || topup.err) { topup.mt += dt; if (topup.mt > 3.5) { topup.msg = ''; topup.err = ''; } }
    const V = VIEW, fs = L.fs, bh = L.bh, plat = app.platform, pay = plat?.payments, name = plat?.name || 'none', can = !!pay?.available;
    let prods = []; try { prods = pay?.products?.() || []; } catch { }
    const ap = easeOut(Math.min(1, topup.t / 0.18));
    ctx.fillStyle = `rgba(8,2,12,${0.82 * ap})`; ctx.fillRect(0, 0, V.W, V.H);
    const n = prods.length || 4, rows = Math.ceil(n / 2), gap = 12;
    const headH = bh + 54, footH = 5 * (fs + 2) + 22;
    const ph = Math.min(L.b - L.t, headH + rows * 300 + (rows - 1) * gap + 40 + footH), px = L.l, pw = L.w, py = Math.max(L.t, Math.round((V.H - ph) / 2)) + (1 - ap) * 14;
    ctx.save(); ctx.globalAlpha = ap;
    cinemaPanel(ctx, px, py, pw, ph, { on: true });
    ctx.save(); ctx.letterSpacing = '2px'; fitText(ctx, 'ПОПОЛНИТЬ СТРАЗЫ', px + 18, py + 12 + bh / 2, pw - bh - 50, fs + 9, { align: 'left', color: C.gold, lw: 6, outline: C.night }); ctx.restore();
    if (pbtn(ctx, 'tclose', px + pw - bh - 10, py + 12, bh, bh, '×', { size: 34 })) { topup.open = false; sfx('select', { pitch: 0.9 }); }
    const bal = String(gemsOf(S)); ctx.font = `900 ${fs + 3}px ${FONT}`; const bw0 = ctx.measureText(bal).width;
    drawGem(ctx, px + 28, py + bh + 36, 11, { shadow: true });
    text(ctx, 'У вас: ' + bal, px + 46, py + bh + 36, { size: fs + 3, align: 'left', color: C.paper, lw: 5, outline: C.night });
    // карточки пакетов
    const gy = py + headH, cwd = (pw - 36 - gap) / 2, chh = clamp((ph - headH - footH - 12 - (rows - 1) * gap) / rows, 240, 310);
    const tier = ['#d9cfe0', '#6ec8ff', '#c58cff', '#ffd166'], CNT = [1, 3, 5, 8];
    prods.forEach((pr, i) => {
      const x = px + 18 + (i % 2) * (cwd + gap), y = gy + Math.floor(i / 2) * (chh + gap), cx = x + cwd / 2;
      reg['pack_' + pr.id] = { x, y, w: cwd, h: chh };
      ctx.save();
      cinemaPanel(ctx, x, y, cwd, chh, { stroke: tier[Math.min(i, 3)] });
      const cnt = CNT[Math.min(i, 3)], bx = cx, by = y + 66, sk = 1.1;
      const spots = [[0, 0, 22], [-24, 8, 15], [24, 8, 15], [-12, -18, 13], [14, -20, 12], [-36, 18, 10], [36, 18, 10], [0, 22, 12]];
      const order = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, cnt).reverse();
      for (const k of cnt === 1 ? [0] : order) { const [dx, dy, r] = spots[k]; drawGem(ctx, bx + dx * sk * (cnt === 1 ? 1.2 : 1), by + dy * sk + Math.sin(t * 1.6 + k) * 1.5, (cnt === 1 ? 28 : r) * sk, { shadow: true, t: t + k }); }
      text(ctx, String(pr.gems), cx, y + 128, { size: 42, color: C.gold, lw: 8, outline: C.night });
      text(ctx, gemWord(pr.gems), cx, y + 158, { size: fs, color: '#ffd0dc', lw: 4, outline: C.night });
      drawPriceP(ctx, pr, cx, y + 190, fs + 3);
      const busy = topup.busy === pr.id, lock = !!topup.busy;
      const label = busy ? '.'.repeat(1 + Math.floor(t * 3) % 3) : !can ? 'скоро' : name === 'dev' ? `ТЕСТ +${pr.gems}` : 'Купить';
      if (pbtn(ctx, 'pk' + pr.id, x + 12, y + chh - bh - 12, cwd - 24, bh, label, { size: busy ? 26 : fs + 2, velvet: can && !lock, disabled: !can || lock })) buyPack(pay, pr);
      if (name === 'dev') { ctx.save(); ctx.translate(x + cwd - 34, y + 24); ctx.rotate(0.35); ctx.fillStyle = '#ff3b8a'; ctx.beginPath(); ctx.roundRect(-26, -11, 52, 22, 4); ctx.fill(); text(ctx, 'ТЕСТ', 0, 1, { size: 15, color: '#fff', outline: false }); ctx.restore(); }
      ctx.restore();
    });
    if (!prods.length) text(ctx, 'Товары пока недоступны', px + pw / 2, gy + 100, { size: fs + 3, color: C.paper });
    // результат покупки / ошибка и подписи
    const fy = py + ph - footH + 4, res = topup.err || topup.msg;
    if (res) text(ctx, res, px + pw / 2, fy + 6, { size: fs + 1, color: topup.err ? '#ff9a9a' : C.mint, lw: 5, outline: C.night });
    const f1 = name === 'dev' ? 'ТЕСТОВЫЙ РЕЖИМ (?dev=1): пакеты зачисляются бесплатно, настоящих платежей нет.'
      : can ? 'Покупки совершаются через площадку.' : 'Покупки пока недоступны: стразы можно получить за достижения.';
    const l1 = fitLines(ctx, f1, pw - 36, fs - 1, 2, 14, 800), l2 = fitLines(ctx, 'Стразы нужны только для аксессуаров и не дают силы в бою.', pw - 36, fs - 1, 2, 14, 700);
    let ly = fy + 32;
    l1.lines.forEach((l, k) => text(ctx, l, px + pw / 2, ly + k * (fs + 1), { size: l1.size, color: name === 'dev' ? '#ff9ad0' : can ? C.paper : C.gold, outline: false, weight: 800 })); ly += l1.lines.length * (fs + 1) + 4;
    l2.lines.forEach((l, k) => text(ctx, l, px + pw / 2, ly + k * (fs + 1), { size: l2.size, color: 'rgba(243,226,192,0.7)', outline: false, weight: 700 }));
    ctx.restore();
    // касание мимо окна закрывает его; остальные касания окно «съедает»
    if (gest.tap) { const q = gest.tap; if (!(q.x > px && q.x < px + pw && q.y > py && q.y < py + ph)) topup.open = false; gest.tap = null; }
  }
  function drawPriceP(ctx, pr, cx, y, size) {
    const s = pr.priceText || `${pr.price} ян`;
    ctx.font = `900 ${size}px ${FONT}`; const tw = ctx.measureText(s).width, ic = pr.icon && pr.icon.complete && pr.icon.naturalWidth ? size + 3 : 0, gap = ic ? 5 : 0;
    const x0 = cx - (tw + ic + gap) / 2;
    text(ctx, s, x0, y, { size, align: 'left', color: C.paper, lw: 4, outline: C.night });
    if (ic) ctx.drawImage(pr.icon, x0 + tw + gap, y - ic / 2, ic, ic);
  }

  // ---------- достижения (портрет): список на весь экран, тянется пальцем / колесом ----------
  function drawAchP(ctx, S, dt, L) {
    const fs = L.fs, got = Object.keys(S.ach).length;
    const y0 = subHeader(ctx, L, 'ДОСТИЖЕНИЯ', (c, LL, measure) => {
      const s = `${got}/${ACHIEVEMENTS.length}`; c.font = `900 ${fs + 3}px ${FONT}`; const w = c.measureText(s).width + 8;
      if (!measure) text(c, s, LL.r, LL.t + LL.bh / 2 + 1, { size: fs + 3, align: 'right', color: C.mint, lw: 4, outline: C.night });
      return w + 10;
    });
    const bottom = VIEW.H - VIEW.safe.b, lv = { x: L.l - 6, y: y0, w: L.w + 12, h: bottom - y0 }, tw = L.w - 68 - 12;
    // раскладка строк (кэш: меняется только при смене размера или числа полученных)
    const key = `${fs}|${Math.round(L.w)}|${got}`;
    if (key !== achKey) {
      achKey = key;
      ctx.font = `700 ${fs}px ${FONT}`;
      achRows = ACHIEVEMENTS.map(a => {
        const hid = a.secret && !S.ach[a.id], gift = a.unlock?.startsWith('acc_') ? ACC[a.unlock.slice(4)] : null;
        const rw = hid ? '' : gift ? gift.name : REWARD_NAMES[a.unlock] || (a.unlock ? (S.ach[a.id] ? 'открыто' : 'открывает новое') : '');
        const gemW = a.gems && !hid ? 74 : 0;
        const desc = wrap(ctx, hid ? '???' : a.desc, tw, fs, 700).slice(0, 2);
        const h = 16 + (fs + 7) + desc.length * (fs + 4) + (rw ? fs + 6 : 0) + 12;
        return { a, hid, gift, rw, gemW, desc, h };
      });
    }
    const sc = scrollBegin('ach', lv);
    ctx.save(); ctx.beginPath(); ctx.rect(lv.x, lv.y, lv.w, lv.h); ctx.clip();
    let y = lv.y - sc.off, total = 0;
    for (const r of achRows) {
      const a = r.a, got1 = !!S.ach[a.id], x = L.l, w = L.w;
      if (y + r.h >= lv.y && y <= lv.y + lv.h) {
        cinemaPanel(ctx, x, y, w, r.h, { stroke: got1 ? C.mint : null, dim: !got1, r: 12 });
        drawStar(ctx, x + 34, y + 16 + (fs + 7) / 2, 16, got1 ? C.gold : '#4a3a48');
        let ty = y + 16;
        fitText(ctx, r.hid ? 'Секрет' : a.name, x + 64, ty + (fs + 7) / 2, w - 64 - r.gemW - 14, fs + 2, { align: 'left', color: got1 ? '#fff' : '#cfb8c8', outline: C.night, lw: 4 });
        if (r.gemW) {
          const s = `+${a.gems}`; ctx.font = `900 ${fs}px ${FONT}`; const gw = ctx.measureText(s).width;
          text(ctx, s, x + w - 14, ty + (fs + 7) / 2, { size: fs, align: 'right', color: got1 ? C.mint : '#ffb8d8', lw: 3, outline: C.night });
          drawGem(ctx, x + w - 14 - gw - 12, ty + (fs + 7) / 2 - 1, 8, { alpha: got1 ? 0.55 : 1 });
        }
        ty += fs + 7;
        r.desc.forEach((l, k) => text(ctx, l, x + 64, ty + (fs + 4) / 2 + k * (fs + 4), { size: fs, align: 'left', color: '#ffe6ef', outline: false, weight: 700 }));
        ty += r.desc.length * (fs + 4);
        if (r.rw) text(ctx, `${got1 ? '✓' : '+'} ${r.rw}`, x + 64, ty + (fs + 6) / 2, { size: fs - 1, align: 'left', color: got1 ? C.mint : r.gift || REWARD_NAMES[a.unlock] ? C.pink : C.gold, outline: false, weight: 800 });
      }
      y += r.h + 8; total += r.h + 8;
    }
    ctx.restore();
    scrollEnd(ctx, sc, total + 6);
  }

  // ---------- настройки (портрет) ----------
  function drawSettingsP(ctx, S, dt, L) {
    const fs = L.fs, st = S.settings, rowH = Math.max(76, L.bh + 14);
    const y0 = subHeader(ctx, L, 'НАСТРОЙКИ');
    const setSnd = (key, on, vol) => { st[key] = on ? vol : 0; audioState[key] = st[key]; applyVolumes(); app.persist(); sfx('select'); };
    const rows = [
      { id: 'sfx', label: 'Звуки', sub: 'выстрелы, монеты, голоса', on: st.sfx > 0, set: () => setSnd('sfx', !(st.sfx > 0), 0.8) },
      { id: 'music', label: 'Музыка', sub: 'фоновая мелодия', on: st.music > 0, set: () => setSnd('music', !(st.music > 0), 0.45) },
      { id: 'shake', label: 'Тряска экрана', sub: 'отдача и удары', on: st.shake > 0, set: () => { st.shake = st.shake > 0 ? 0 : 0.8; app.persist(); sfx('select'); } },
      { id: 'numbers', label: 'Числа урона', sub: 'цифры над врагами', on: st.numbers !== false, set: () => { st.numbers = st.numbers === false; app.persist(); sfx('select'); } },
      { id: 'vibrate', label: 'Вибрация', sub: 'отклик телефона', on: !!st.vibrate, set: () => { st.vibrate = !st.vibrate; app.persist(); sfx('select'); if (st.vibrate) navigator.vibrate?.(40); } },
    ];
    rows.forEach((r, i) => {
      const x = L.l, y = y0 + i * (rowH + 10), w = L.w;
      reg['set_' + r.id] = { x, y, w, h: rowH };
      const over = hoverIn(x, y, w, rowH), press = pressIn(x, y, w, rowH);
      cinemaPanel(ctx, x, y + (press ? 2 : 0), w, rowH, { on: over || press, stroke: r.on ? C.mint : undefined, r: 14 });
      text(ctx, r.label, x + 20, y + rowH / 2 - (fs + 2) / 2 + (press ? 2 : 0), { size: fs + 4, align: 'left', color: C.paper, lw: 4, outline: C.night });
      text(ctx, r.sub, x + 20, y + rowH / 2 + (fs + 2) / 2 + 4 + (press ? 2 : 0), { size: fs - 1, align: 'left', color: 'rgba(255,230,239,0.75)', outline: false, weight: 700 });
      // переключатель
      const sw = 84, sh = 44, sx = x + w - sw - 20, sy = y + (rowH - sh) / 2 + (press ? 2 : 0);
      ctx.fillStyle = r.on ? '#1f8a72' : '#4a3a48'; ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, sh / 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = r.on ? C.mint : 'rgba(243,226,192,0.35)'; ctx.stroke();
      ctx.fillStyle = r.on ? C.paper : '#b8a8b4'; ctx.beginPath(); ctx.arc(r.on ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, sh / 2 - 5, 0, TAU); ctx.fill();
      if (tapIn(x, y, w, rowH)) r.set();
    });
  }

  // ---------- Косметичка (портрет): вся страница прокручивается; карточки витрины и билеты собранного — те же рисунки, в масштабе ----------
  function drawShopP(ctx, S, dt, L) {
    const fs = L.fs, bh = L.bh;
    const y0 = subHeader(ctx, L, 'КОСМЕТИЧКА', (c, LL, measure) => {
      if (!measure) { c.save(); c.translate(LL.r - 70, LL.t + LL.bh / 2); c.scale(1.2, 1.2); drawBucket(c, 0, 0, S.candies); c.restore(); }
      return 120;
    });
    const bottom = VIEW.H - VIEW.safe.b, lv = { x: L.l - 8, y: y0, w: L.w + 16, h: bottom - y0 };
    const sc = scrollBegin('shop', lv);
    ctx.save(); ctx.beginPath(); ctx.rect(lv.x, lv.y, lv.w, lv.h); ctx.clip();
    let y = lv.y - sc.off; const top = y;
    // подсказка
    const hint = fitLines(ctx, 'После каждого забега — новая витрина: сила делает Поппи крепче, разнообразие добавляет в забеги новые бонусы и события. Редкие — дороже.', L.w, fs, 5, fs - 2, 700);
    hint.lines.forEach((l, k) => text(ctx, l, L.l, y + (fs + 5) / 2 + k * (fs + 5), { size: hint.size, align: 'left', color: '#ffe6ef', outline: false, weight: 700 }));
    y += hint.lines.length * (fs + 5) + 14;
    // витрина
    const offers = ensureOffers(S);
    ctx.save(); ctx.letterSpacing = '1px'; text(ctx, 'ВИТРИНА ЭТОГО ЗАБЕГА', L.l, y + 14, { size: fs + 1, align: 'left', color: C.gold, lw: 4, outline: C.night }); ctx.restore();
    y += 32;
    if (offers.length && !S.offerShuffled) {
      if (pbtn(ctx, 'shuffle', L.l, y, L.w, bh, `↻ перетасовать · ${SHUFFLE_PRICE}`, { size: fs + 1, disabled: S.candies < SHUFFLE_PRICE, clip: lv })) { if (shuffleOffers(S)) { app.persist(); sfx('whoosh'); } }
      y += bh + 12;
    } else if (offers.length) { text(ctx, 'уже перетасовано', L.l, y + 8, { size: fs - 1, align: 'left', color: 'rgba(243,226,192,0.6)', outline: false, weight: 700 }); y += 28; }
    const k = 1.7, lw = L.w / k, lh = 206;
    if (!offers.length) {
      cinemaPanel(ctx, L.l, y, L.w, 170, { on: true });
      text(ctx, 'Новые предложения — после следующего забега', L.l + L.w / 2, y + 50, { size: fs + 4, color: C.paper, lw: 5, outline: C.night });
      const sl = fitLines(ctx, 'Всё с витрины уже в косметичке. Сыграй ещё раз — и появятся три новых.', L.w - 40, fs, 3, 14, 700);
      sl.lines.forEach((l, i) => text(ctx, l, L.l + L.w / 2, y + 98 + i * (fs + 4), { size: sl.size, color: '#ffe6ef', outline: false, weight: 700 }));
      y += 182;
    } else {
      for (let i = 0; i < 3; i++) {
        const id = offers[i];
        if (!id) {   // клетка уже куплена
          ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(243,226,192,0.3)'; ctx.beginPath(); ctx.roundRect(L.l + 2, y + 2, L.w - 4, 100, 12); ctx.stroke(); ctx.setLineDash([]);
          ctx.translate(L.l + L.w / 2, y + 42); ctx.rotate(-0.08); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,154,184,0.75)'; ctx.beginPath(); ctx.roundRect(-84, -22, 168, 44, 6); ctx.stroke();
          text(ctx, 'КУПЛЕНО', 0, 1, { size: 28, color: 'rgba(255,154,184,0.85)', outline: false }); ctx.restore();
          text(ctx, 'новое — после следующего забега', L.l + L.w / 2, y + 82, { size: fs - 1, color: 'rgba(243,226,192,0.6)', outline: false, weight: 700 });
          y += 112; continue;
        }
        const cy = y, ci = i;
        ctx.save(); ctx.translate(L.l, cy); ctx.scale(k, k);
        const buy = drawOfferCard(ctx, S, id, 0, 0, lw, lh, (label, bx, by, bw, bh2, o) => {
          const sx = L.l + bx * k, sy = cy + by * k, sw = bw * k, sh = bh2 * k, th = Math.max(sh, bh), ty0 = sy - (th - sh) / 2;   // тач-цель не ниже bh
          reg['offer' + ci] = { x: sx, y: ty0, w: sw, h: th };
          tbDraw(ctx, bx, by, bw, bh2, label, { size: 15, disabled: o.disabled, velvet: true }, 0, pressIn(sx, ty0, sw, th, lv) && !o.disabled);
          return !o.disabled && tapIn(sx, ty0, sw, th, lv);
        }, i);
        ctx.restore();
        if (buy && buyOffer(S, id)) { app.persist(); sfx('coin', { pitch: 1.3 }); app.emit({ type: 'metaBuy' }); }
        y += lh * k + 12;
      }
    }
    y += 6;
    // уже в косметичке
    const owned = ALL_META.filter(m => S.meta[m.id]);
    ctx.save(); ctx.letterSpacing = '1px'; text(ctx, 'УЖЕ В КОСМЕТИЧКЕ', L.l, y + 14, { size: fs + 1, align: 'left', color: C.gold, lw: 4, outline: C.night }); ctx.restore();
    text(ctx, `собрано ${owned.length} из ${ALL_META.length}`, L.r, y + 14, { size: fs - 1, align: 'right', color: C.mint, outline: false, weight: 800 });
    y += 34;
    const tk = 1.55, tlw = L.w / tk, rest = ALL_META.filter(m => !S.meta[m.id]);
    const free = rest.filter(m => !offers.includes(m.id)), tease = [...free, ...rest.filter(m => offers.includes(m.id))];
    const list = [...owned.map(m => ({ m })), ...tease.slice(0, owned.length ? 4 : 4).map(m => ({ m, locked: true }))];
    if (!owned.length) text(ctx, 'пока пусто — вот что можно открыть:', L.l, y + 4, { size: fs - 1, align: 'left', color: '#ffe6ef', outline: false, weight: 700 }), y += 26;
    for (const c of list) {
      const h = (c.locked && !owned.length ? 88 : 62) * tk;
      if (y + h >= lv.y && y <= lv.y + lv.h) { ctx.save(); ctx.translate(L.l, y); ctx.scale(tk, tk); metaTicket(ctx, S, c.m, 0, 0, tlw, c.locked && !owned.length ? 88 : 62, { locked: c.locked, big: c.locked && !owned.length }); ctx.restore(); }
      y += h + 10;
    }
    ctx.restore();
    scrollEnd(ctx, sc, y - top + 12);
  }

  // ---------------- элементы ----------------
  // плавное наведение (120 мс): возвращает 0..1 с easeOutCubic
  function hover(id, over, dt) {
    const v = hov[id] = clamp((hov[id] || 0) + (over ? dt : -dt) / 0.12, 0, 1);
    return easeOut(v);
  }
  function hitRect(inp, x, y, w, h) { const p = inp.pointer; return p.x > x && p.x < x + w && p.y > y && p.y < y + h; }
  function consume(inp) { if (inp.pointer.clicked) { inp.pointer.clicked = false; return true; } return false; }

  // Билет-кнопка. Корешок 24 px слева с перфорацией и полукруглыми вырезами на линии отрыва.
  function ticket(ctx, inp, dt, id, x, y, w, h, o, busy) {
    const over = !busy && hitRect(inp, x, y - 6, w, h + 6);
    const tk = tear && tear.id === id ? clamp(tear.k / 0.18, 0, 1) : 0;   // фаза отрыва
    const hk = hover(id, over || tk > 0, dt);
    const press = over && inp.pointer.down;
    const cx = x + w / 2, cy = y + h / 2, stub = 24, sx = x + stub;
    ctx.save();
    ctx.translate(cx, cy - 4 * hk + (press ? 2 : 0)); ctx.rotate(-2 * Math.PI / 180 * hk); ctx.translate(-cx, -cy);
    // тень растёт при наведении
    ctx.save(); ctx.fillStyle = `rgba(8,2,10,${0.4 + 0.15 * hk})`;
    ctx.shadowColor = 'rgba(8,2,10,0.7)'; ctx.shadowBlur = 6 + 6 * hk; ctx.shadowOffsetY = 5 + 4 * hk;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5); ctx.fill(); ctx.restore();
    if (tk > 0 || (tear && tear.id === id)) {
      // тело остаётся, корешок падает с вращением
      ctx.save(); ctx.beginPath(); ctx.rect(sx, y - 20, w, h + 40); ctx.clip(); ticketFace(ctx, x, y, w, h, o); ctx.restore();
      const fk = tear.k / 0.32;
      ctx.save(); ctx.globalAlpha = clamp(1.4 - fk * 1.4, 0, 1);
      ctx.translate(sx, y + h); ctx.rotate(-0.9 * fk * fk - 0.15 * tk); ctx.translate(-14 * fk, 70 * fk * fk); ctx.translate(-sx, -(y + h));
      ctx.beginPath(); ctx.rect(x - 20, y - 20, stub + 20, h + 40); ctx.clip(); ticketFace(ctx, x, y, w, h, o); ctx.restore();
    } else ticketFace(ctx, x, y, w, h, o);
    ctx.restore();
    if (over && consume(inp)) return true;
    return false;
  }

  // Строка-ссылка («Новая игра», «Да», «Нет»)
  function link(ctx, inp, s, x, y, size, busy, color) {
    ctx.font = `900 ${size}px ${FONT}`; const w = ctx.measureText(s).width;
    const over = !busy && hitRect(inp, x - w / 2 - 6, y - size, w + 12, size * 2);
    const col = over ? C.gold : (color || '#ffd0dc');
    text(ctx, s, x, y, { size, color: col, lw: 4, outline: C.night });
    ctx.fillStyle = col; ctx.globalAlpha = over ? 1 : 0.6; ctx.fillRect(x - w / 2, y + size * 0.62, w, 1.5); ctx.globalAlpha = 1;
    return over && consume(inp);
  }

  // Круглый жетон 36 px в углу
  function token(ctx, inp, dt, id, x, y, drawIconFn, o, busy) {
    const R = 18;
    let lw = 0;
    if (o.left) { ctx.font = `900 17px ${FONT}`; lw = ctx.measureText(o.left).width + 10; }
    const over = !busy && hitRect(inp, x - R - lw, y - R, R * 2 + lw, R * 2);
    const hk = hover(id, over, dt);
    ctx.save(); ctx.translate(x, y - 2 * hk);
    ctx.fillStyle = 'rgba(8,2,10,0.5)'; ctx.beginPath(); ctx.arc(0, 3, R, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, R); g.addColorStop(0, C.dusk); g.addColorStop(1, C.night);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = hk > 0.01 ? C.gold : 'rgba(255,209,102,0.55)'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,209,102,0.2)'; ctx.beginPath(); ctx.arc(0, 0, R - 4, 0, TAU); ctx.stroke();
    ctx.restore();
    drawIconFn(x, y - 2 * hk);
    if (o.left) text(ctx, o.left, x - R - 6, y + 1, { size: 17, align: 'right', color: o.leftColor || C.paper, lw: 4, outline: C.night });
    return over && consume(inp);
  }

  // Маленькая кнопка-билет для подэкранов (без корешка, с вырезами по бокам)
  function tbutton(ctx, inp, dt, id, x, y, w, h, label, o = {}) {
    const over = hitRect(inp, x, y, w, h), hk = hover(id, over && !o.disabled, dt), press = over && inp.pointer.down && !o.disabled;
    tbDraw(ctx, x, y, w, h, label, o, hk, press);
    if (!o.disabled && over && consume(inp)) return true;
    return false;
  }
  // отрисовка кнопки-билета (общая для ландшафта и портрета): hk — наведение 0..1, press — палец/мышь прижаты
  function tbDraw(ctx, x, y, w, h, label, o, hk, press) {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(6, h * 0.22);
    ctx.save();
    ctx.translate(cx, cy - 2 * hk + (press ? 1.5 : 0)); ctx.rotate(-1.5 * Math.PI / 180 * hk); ctx.translate(-cx, -cy);
    const shape = () => {
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + w - 3, y); ctx.arcTo(x + w, y, x + w, y + 3, 3);
      ctx.lineTo(x + w, cy - r); ctx.arc(x + w, cy, r, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(x + w, y + h - 3);
      ctx.arcTo(x + w, y + h, x + w - 3, y + h, 3); ctx.lineTo(x + 3, y + h); ctx.arcTo(x, y + h, x, y + h - 3, 3);
      ctx.lineTo(x, cy + r); ctx.arc(x, cy, r, Math.PI / 2, -Math.PI / 2, true); ctx.lineTo(x, y + 3); ctx.arcTo(x, y, x + 3, y, 3); ctx.closePath();
    };
    ctx.save(); ctx.translate(0, 3 + 2 * hk); ctx.fillStyle = 'rgba(8,2,10,0.5)'; shape(); ctx.fill(); ctx.restore();
    const vel = o.velvet && !o.disabled;
    if (o.disabled) ctx.globalAlpha = 0.55;
    if (vel) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9a1424'); g.addColorStop(1, C.velvetD); ctx.fillStyle = g; }
    else { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.disabled ? '#b8a88c' : C.paper); g.addColorStop(1, o.disabled ? '#9a8a70' : '#e6cc9c'); ctx.fillStyle = g; }
    shape(); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = vel ? C.gold : C.shade; ctx.stroke();
    if (h >= 30) { ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = vel ? 'rgba(255,209,102,0.5)' : 'rgba(58,26,16,0.25)'; ctx.strokeRect(x + r + 4, y + 4, w - 2 * r - 8, h - 8); ctx.setLineDash([]); }
    text(ctx, label, cx + (o.dx || 0), cy + 1 + (o.dy || 0), { size: o.size ?? 18, color: vel ? C.gold : C.ink, outline: vel ? C.velvetD : false, lw: 3 });
    if (o.after) o.after(ctx, cx, cy, vel);
    ctx.restore();
  }
  function backButton(ctx, inp, dt, y) {
    return ticket(ctx, inp, dt, 'back', 396, y, 168, 48, { label: 'НАЗАД', icon: 'arrow', small: true }, false);
  }

  // Шапка подэкрана: маленькое табло
  function header(ctx, title) {
    drawMarquee(ctx, 300, 4, 360, 66, 8);
    fitText(ctx, title, 480, 38, 300, 26, { color: C.velvet, lw: 6, outline: '#0e0204' });
  }

  function cinemaPanel(ctx, x, y, w, h, o = {}) {
    const r = o.r ?? 14;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.dim ? 'rgba(30,14,40,0.88)' : 'rgba(46,18,60,0.92)'); g.addColorStop(1, 'rgba(20,8,28,0.92)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.lineWidth = o.on ? 3 : 2; ctx.strokeStyle = o.stroke || (o.on ? C.gold : o.dim ? 'rgba(243,226,192,0.18)' : 'rgba(255,209,102,0.5)'); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,209,102,0.12)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 4)); ctx.stroke();
  }

  // ---------------- атмосфера ----------------
  // Табло: рама, подсвеченное поле, лампочки Ø 6 px с шагом ~18 px, бегущий огонь 8 сдвигов/с
  function drawMarquee(ctx, x, y, w, h, inset) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,2,10,0.55)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 6, w, h, 14); ctx.fill();
    const fr = ctx.createLinearGradient(0, y, 0, y + h); fr.addColorStop(0, '#3a1648'); fr.addColorStop(1, C.shadow);
    ctx.fillStyle = fr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.night; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 12); ctx.stroke();
    // поле с подсветкой изнутри
    const fx = x + inset + 6, fy = y + inset + 6, fw = w - 2 * inset - 12, fh = h - 2 * inset - 12;
    const face = ctx.createRadialGradient(fx + fw / 2, fy + fh * 0.45, 10, fx + fw / 2, fy + fh / 2, fw * 0.62);
    face.addColorStop(0, C.beam); face.addColorStop(0.6, '#f6d79e'); face.addColorStop(1, '#d9a35e');
    ctx.fillStyle = face; ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#5a2a10'; ctx.stroke();
    // лампочки по контуру
    const bx = x + inset / 2 + 3, by = y + inset / 2 + 3, bw = w - inset - 6, bh = h - inset - 6;
    const per = 2 * (bw + bh), n = Math.round(per / 18), step = per / n, shift = Math.floor(t * 8);
    for (let i = 0; i < n; i++) {
      let d = i * step, px, py;
      if (d < bw) { px = bx + d; py = by; } else if ((d -= bw) < bh) { px = bx + bw; py = by + d; }
      else if ((d -= bh) < bw) { px = bx + bw - d; py = by + bh; } else { d -= bw; px = bx; py = by + bh - d; }
      const lit = (i + shift) % 3 !== 0;
      if (lit) {
        const gl = ctx.createRadialGradient(px, py, 0, px, py, 10); gl.addColorStop(0, 'rgba(255,154,60,0.55)'); gl.addColorStop(1, 'rgba(255,154,60,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = C.lamp; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(px - 0.8, py - 0.8, 1.3, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#4a2410'; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,150,0.25)'; ctx.beginPath(); ctx.arc(px - 0.8, py - 0.8, 1, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawLeaves(ctx, kx = 1, ky = 1, sz = 1) {   // kx, ky — перевод из ландшафтных координат листьев в вид (портрет)
    for (const L of leaves) {
      ctx.save(); ctx.translate(L.x * kx, L.y * ky); ctx.rotate(L.rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * 1.4 + L.ph)));
      ctx.globalAlpha = 0.85; const s = L.s * sz;
      ctx.fillStyle = L.col; ctx.beginPath();
      ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.9, -s * 0.4, s * 0.15, s * 0.9); ctx.lineTo(-s * 0.15, s * 0.9); ctx.quadraticCurveTo(-s * 0.9, -s * 0.4, 0, -s); ctx.fill();
      ctx.strokeStyle = 'rgba(40,10,4,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 1.3); ctx.stroke();
      ctx.restore();
    }
  }

  // Нижний туман #1a0b2e: градиент + медленные клубы
  function drawFog(ctx, a) {
    const g = ctx.createLinearGradient(0, 400, 0, 540); g.addColorStop(0, 'rgba(26,11,46,0)'); g.addColorStop(1, `rgba(26,11,46,${0.8 * a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 400, 960, 140);
    for (const f of fog) {
      const rg = ctx.createRadialGradient(f.x + f.w / 2, f.y, 4, f.x + f.w / 2, f.y, f.w / 2);
      rg.addColorStop(0, `rgba(58,30,84,${0.35 * a})`); rg.addColorStop(1, 'rgba(26,11,46,0)');
      ctx.save(); ctx.translate(f.x + f.w / 2, f.y); ctx.scale(1, 0.22); ctx.translate(-(f.x + f.w / 2), -f.y);
      ctx.fillStyle = rg; ctx.fillRect(f.x, f.y - f.w / 2, f.w, f.w); ctx.restore();
    }
  }
  // тонкая дымка перед ногами героини
  function drawFogFront(ctx) {
    const g = ctx.createLinearGradient(0, 470, 0, 540); g.addColorStop(0, 'rgba(26,11,46,0)'); g.addColorStop(1, 'rgba(26,11,46,0.55)');
    ctx.fillStyle = g; ctx.fillRect(560, 470, 400, 70);
    const x = 640 + Math.sin(t * 0.3) * 40;
    const rg = ctx.createRadialGradient(x + 150, 510, 4, x + 150, 510, 150); rg.addColorStop(0, 'rgba(70,40,100,0.28)'); rg.addColorStop(1, 'rgba(26,11,46,0)');
    ctx.save(); ctx.translate(x + 150, 510); ctx.scale(1, 0.2); ctx.translate(-(x + 150), -510); ctx.fillStyle = rg; ctx.fillRect(x, 360, 300, 300); ctx.restore();
  }

  function drawBark(ctx, b, x = 636, y = 150, kk = 1) {   // (x, y) — слева от головы Поппи; kk — масштаб (портрет)
    const k = b.k, sc = (k < 0.15 ? easeOut(k / 0.15) * 1.1 : k < 0.25 ? 1.1 - (k - 0.15) : 1) * kk;
    const a = k > 2.15 ? clamp((2.4 - k) / 0.25, 0, 1) : 1;
    ctx.font = `900 16px ${FONT}`; const w = ctx.measureText(b.s).width + 28, h = 34;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a0a14'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 14);
    ctx.moveTo(w / 2 - 22, h / 2 - 1); ctx.lineTo(w / 2 + 10, h / 2 + 10); ctx.lineTo(w / 2 - 8, h / 2 - 1);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(w / 2 - 21, h / 2 - 4, 12, 4);
    text(ctx, b.s, 0, 1, { size: 16, color: '#2a0a14', outline: false });
    ctx.restore();
  }
}

// ---------- рисование, без состояния ----------
function ticketPath(ctx, x, y, w, h, stub, nr = 8) {
  const cr = 5, sx = x + stub;
  ctx.beginPath();
  ctx.moveTo(x + cr, y); ctx.lineTo(sx - nr, y); ctx.arc(sx, y, nr, Math.PI, 0, true);
  ctx.lineTo(x + w - cr, y); ctx.arcTo(x + w, y, x + w, y + cr, cr);
  ctx.lineTo(x + w, y + h - cr); ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr);
  ctx.lineTo(sx + nr, y + h); ctx.arc(sx, y + h, nr, 0, Math.PI, true);
  ctx.lineTo(x + cr, y + h); ctx.arcTo(x, y + h, x, y + h - cr, cr);
  ctx.lineTo(x, y + cr); ctx.arcTo(x, y, x + cr, y, cr); ctx.closePath();
  // перфорация: кружки Ø 4 через 8 px
  for (let yy = y + nr + 6; yy <= y + h - nr - 5; yy += 8) { ctx.moveTo(sx + 2, yy); ctx.arc(sx, yy, 2, 0, TAU); }
}

function ticketFace(ctx, x, y, w, h, o) {
  const stub = 24, sx = x + stub;
  const pg = ctx.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, '#f8ead0'); pg.addColorStop(1, '#e6cc9c');
  ctx.fillStyle = pg; ticketPath(ctx, x, y, w, h, stub); ctx.fill('evenodd');
  // корешок чуть темнее
  ctx.save(); ticketPath(ctx, x, y, w, h, stub); ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(201,168,120,0.35)'; ctx.fillRect(x, y, stub - 2, h);
  // волокна бумаги
  ctx.strokeStyle = 'rgba(160,120,70,0.08)'; ctx.lineWidth = 1;
  for (let i = 1; i < h / 6; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * 6 + (i % 3)); ctx.lineTo(x + w, y + i * 6 - (i % 2)); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = C.shade; ticketPath(ctx, x, y, w, h, stub); ctx.stroke();
  // корешок: надпись или значок
  ctx.save(); ctx.translate(x + stub / 2 - 1, y + h / 2);
  if (o.stub) { ctx.rotate(-Math.PI / 2); ctx.letterSpacing = '2px'; text(ctx, o.stub, 0, 1, { size: o.stubS || 11, color: C.ink, outline: false }); ctx.letterSpacing = '0px'; }
  else if (o.icon) stubIcon(ctx, o.icon);
  ctx.restore();
  const bx = sx + 10, bw = x + w - 10 - bx, mid = bx + bw / 2;
  if (o.velvet) {
    // бархатная полоса с золотом
    const by = y + 9, bh = h - 34;
    const vg = ctx.createLinearGradient(0, by, 0, by + bh); vg.addColorStop(0, '#9a1424'); vg.addColorStop(0.5, C.velvet); vg.addColorStop(1, C.velvetD);
    ctx.fillStyle = vg; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.roundRect(bx + 3, by + 3, bw - 6, bh - 6, 3); ctx.stroke();
    for (const ex of [bx + 10, bx + bw - 10]) drawStar(ctx, ex, by + bh / 2, 4, C.gold);
    fitText(ctx, o.label, mid, by + bh / 2 + 1, bw - 44, o.labS || 30, { color: C.gold, lw: 4, outline: '#2a0408' });
    ctx.letterSpacing = '1.5px';
    fitText(ctx, o.sub, mid, y + h - 13, bw, o.subS || 11, { color: C.ink, outline: false });
    ctx.letterSpacing = '0px';
  } else {
    ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(58,26,16,0.3)';
    ctx.strokeRect(bx - 4, y + 6, bw + 8, h - 12); ctx.setLineDash([]);
    if (o.small) fitText(ctx, o.label, mid, y + h / 2 + 1, bw - 6, 20, { color: C.ink, outline: false });
    else {
      fitText(ctx, o.label, mid, y + h / 2 - 5, bw - 10, o.labS || 23, { color: C.ink, outline: false });
      ctx.letterSpacing = '1.5px';
      fitText(ctx, o.sub, mid, y + h - 14, bw - 10, o.subS || 9, { color: 'rgba(58,26,16,0.75)', outline: false });
      ctx.letterSpacing = '0px';
    }
  }
}

function stubIcon(ctx, kind) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'hanger') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath();
    ctx.arc(0, -7, 3, Math.PI, Math.PI * 0.35, false); ctx.lineTo(0, -2);
    ctx.lineTo(-8, 5); ctx.lineTo(8, 5); ctx.closePath(); ctx.stroke();
  } else if (kind === 'lipstick') {
    ctx.scale(1.3, 1.3); ctx.translate(0, 1);
    ctx.fillStyle = C.ink; ctx.fillRect(-4, 0, 8, 9);
    ctx.fillStyle = '#c9a878'; ctx.fillRect(-3, -3, 6, 3);
    ctx.fillStyle = C.lipstick; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-3, -9); ctx.lineTo(3, -12); ctx.lineTo(3, -3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
  } else if (kind === 'arrow') {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(-3, 0); ctx.lineTo(4, 6); ctx.stroke();
  }
}

function drawSpeaker(ctx, x, y, on) {
  ctx.save(); ctx.translate(x - 3, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = on ? C.paper : '#8a7a8a';
  ctx.beginPath(); ctx.moveTo(-7, -3.5); ctx.lineTo(-3, -3.5); ctx.lineTo(3, -8.5); ctx.lineTo(3, 8.5); ctx.lineTo(-3, 3.5); ctx.lineTo(-7, 3.5); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2;
  if (on) { ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.arc(4, 0, 5, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(4, 0, 9, -0.9, 0.9); ctx.stroke(); }
  else { ctx.strokeStyle = C.pink; ctx.beginPath(); ctx.moveTo(7, -4); ctx.lineTo(13, 4); ctx.moveTo(13, -4); ctx.lineTo(7, 4); ctx.stroke(); }
  ctx.restore();
}

// Ведёрко попкорна с числом конфет
function drawBucket(ctx, x, y, n) {
  ctx.save(); ctx.translate(x, y);
  drawPopcorn(ctx, -6, -14, 6, 0.3); drawPopcorn(ctx, 6, -15, 6, -0.4); drawPopcorn(ctx, 0, -19, 6.5, 0.9);
  ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(13, -10); ctx.lineTo(9, 14); ctx.lineTo(-9, 14); ctx.closePath();
  ctx.save(); ctx.clip();
  ctx.fillStyle = C.paper; ctx.fillRect(-14, -11, 28, 26);
  ctx.fillStyle = C.velvet; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 1.6, -11); ctx.lineTo(i * 6 + 1.6, -11); ctx.lineTo(i * 4.3 + 1.3, 15); ctx.lineTo(i * 4.3 - 1.3, 15); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 1.8; ctx.strokeStyle = C.night; ctx.stroke();
  ctx.fillStyle = C.gold; ctx.fillRect(-13.5, -11.5, 27, 3); ctx.strokeRect(-13.5, -11.5, 27, 3);
  ctx.restore();
  text(ctx, String(n), x + 20, y + 2, { size: 22, align: 'left', color: C.gold, lw: 5, outline: C.night });
}

// Текст, ужатый по ширине
// перенос названия предмета: по пробелам и после дефиса («Свинка-» / «Плошка»)
function wrapName(ctx, s, maxW, size) {
  ctx.font = `900 ${size}px ${FONT}`;
  const toks = s.match(/[^\s-]+-|[^\s-]+/g) || [s], lines = []; let cur = '';
  for (const w of toks) {
    const t = cur ? cur + (cur.endsWith('-') ? '' : ' ') + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}
// Текст в maxLines строк: шрифт уменьшается до minSize, дальше — многоточие
function fitLines(ctx, s, maxW, size, maxLines, minSize = 14, weight = 700) {
  let sz = size, lines = wrap(ctx, s, maxW, sz, weight);
  while (lines.length > maxLines && sz > minSize) { sz--; lines = wrap(ctx, s, maxW, sz, weight); }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines); let l = lines[maxLines - 1]; ctx.font = `${weight} ${sz}px ${FONT}`;
    while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = l + '…';
  }
  return { lines, size: sz };
}
// Название предмета в maxLines строк (перенос по пробелам и дефисам, шрифт ужимается до влезания)
function nameLines(ctx, s, maxW, size, maxLines, minSize = 14) {
  for (let sz = size; sz >= minSize; sz--) { const l = wrapName(ctx, s, maxW, sz); if (l.length <= maxLines && l.every(x => ctx.measureText(x).width <= maxW + 1)) return { lines: l, size: sz }; }
  return { lines: wrapName(ctx, s, maxW, minSize).slice(0, maxLines), size: minSize };
}
// Шестерёнка (значок «Настройки»)
function drawGear(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = C.paper; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 8.5 : 11; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = C.night; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.restore();
}
function fitText(ctx, s, x, y, maxW, size, o = {}) {
  ctx.font = `${o.weight ?? 900} ${size}px ${FONT}`;
  const w = ctx.measureText(s).width;
  const sz = w > maxW ? Math.floor(size * maxW / w) : size;
  text(ctx, s, x, y, { ...o, size: sz, lw: o.lw ? Math.max(2, o.lw * sz / size) : undefined });
}

// Значок предмета Косметички: кружок цвета типа и свой рисунок у каждого предмета (R — радиус кружка)
function metaGlyph(ctx, m, cx, cy, R, power) {
  const fg = power ? C.gold : C.mint, bgc = power ? '#4a0610' : '#170822';
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = bgc; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = fg; ctx.stroke();
  const s = R / 18; ctx.scale(s, s);
  ctx.fillStyle = fg; ctx.strokeStyle = fg; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ic = power ? m.id : m.icon;
  const P = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
  switch (ic) {
    case 'might': P([[0, -11], [3, -3], [11, 0], [3, 3], [0, 11], [-3, 3], [-11, 0], [-3, -3]]); ctx.closePath(); ctx.fill(); break;
    case 'hp': ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -7, -13, 0, -5); ctx.bezierCurveTo(7, -13, 14, -1, 0, 9); ctx.fill(); break;
    case 'haste': P([[3, -12], [-6, 1], [0, 1], [-3, 12], [7, -2], [1, -2]]); ctx.closePath(); ctx.fill(); break;
    case 'speed': P([[-2, -8], [6, 0], [-2, 8]]); ctx.stroke(); P([[-9, -8], [-1, 0], [-9, 8]]); ctx.stroke(); break;
    case 'growth': ctx.fillRect(-8, -9, 16, 18); ctx.fillStyle = bgc; ctx.fillRect(-4, -9, 2, 18); ctx.fillRect(1, -5, 5, 1.6); ctx.fillRect(1, -1, 5, 1.6); break;
    case 'magnet': ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -1, 7, Math.PI, 0); ctx.lineTo(7, 7); ctx.moveTo(-7, -1); ctx.lineTo(-7, 7); ctx.stroke(); ctx.fillStyle = '#fff1c9'; ctx.fillRect(-9, 5, 4, 4); ctx.fillRect(5, 5, 4, 4); break;
    case 'luck': for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { ctx.beginPath(); ctx.arc(dx, dy - 1, 4.5, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.moveTo(1, 3); ctx.quadraticCurveTo(3, 8, 7, 11); ctx.stroke(); break;
    case 'reroll': ctx.lineWidth = 2.8; ctx.beginPath(); ctx.arc(0, 0, 8, -0.4, Math.PI * 1.35); ctx.stroke(); P([[8, -9], [8, -2], [1, -3]]); ctx.closePath(); ctx.fill(); break;
    case 'greed': ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 5, 0, 0, TAU); ctx.fill(); P([[-6, 0], [-12, -5], [-12, 5]]); ctx.closePath(); ctx.fill(); P([[6, 0], [12, -5], [12, 5]]); ctx.closePath(); ctx.fill(); ctx.strokeStyle = bgc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(2, 4); ctx.stroke(); break;
    case 'slow': P([[-6, -9], [6, -9], [-6, 9], [6, 9]]); ctx.closePath(); ctx.stroke(); break;
    case 'popper': P([[-8, 8], [-2, -5], [5, 2]]); ctx.closePath(); ctx.fill(); ctx.fillRect(4, -9, 3, 3); ctx.fillRect(8, -3, 3, 3); ctx.fillRect(-1, -11, 3, 3); break;
    case 'double': ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×2', 0, 1); break;
    case 'lipstick': ctx.fillRect(-4, -2, 8, 10); P([[-4, -2], [-4, -8], [4, -11], [4, -2]]); ctx.fill(); break;
    case 'golden': ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(9, 2, 0, 9); ctx.quadraticCurveTo(-9, 2, 0, -11); ctx.fill(); break;
    case 'rain': for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 6, (i % 2) * 5 - 1, 3, 0, TAU); ctx.fill(); } ctx.fillRect(-9, 7, 18, 2); break;
    case 'festival': ctx.fillStyle = C.pumpkin; ctx.beginPath(); ctx.ellipse(0, 2, 10, 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = fg; ctx.fillRect(-1, -9, 2, 5); break;
    default: // 'magnet' у разнообразия — U-магнит с искрой
      ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.stroke(); ctx.fillRect(-10, 0, 4, 7); ctx.fillRect(6, 0, 4, 7);
  }
  ctx.restore();
}
// Замочек (s — масштаб)
function lockGlyph(ctx, x, y, col, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -3, 4, Math.PI, 0); ctx.lineTo(4, 0); ctx.moveTo(-4, -3); ctx.lineTo(-4, 0); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-6, -1, 12, 9, 2); ctx.fill();
  ctx.restore();
}

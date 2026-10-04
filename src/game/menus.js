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
import { sfx, playMusic } from '../engine/audio.js';
import { clamp, TAU } from '../engine/util.js';

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

  return {
    enter() { t = 0; drawT = 0; view = 'main'; topup.open = false; confirmNew = false; tear = null; bark = null; loadHeroineKey(app.save.outfit || 'lara'); playMusic('menu'); },
    setView(v, o = {}) { view = v; confirmNew = false; shopPage = 0; if (o.topup !== undefined) topup.open = !!o.topup; if (o.tab) wtab = o.tab; if (o.slot) accSlot = o.slot; },
    get view() { return view; },
    update(dt) {
      const inp = app.inp; inp.poll(); t += dt;
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
      const inp = app.inp, S = app.save;
      const dt = clamp(t - drawT, 0, 0.1); drawT = t;
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
    ctx.save(); ctx.letterSpacing = '1.5px'; text(ctx, o.label || 'В БОЮ · КАК В ИГРЕ', x + 8, y + 12, { size: 9, align: 'left', color: 'rgba(255,209,102,0.85)', outline: false }); ctx.restore();
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
    text(ctx, label, cx, cy + 1, { size: o.size ?? 18, color: vel ? C.gold : C.ink, outline: vel ? C.velvetD : false, lw: 3 });
    ctx.restore();
    if (!o.disabled && over && consume(inp)) return true;
    return false;
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

  function drawLeaves(ctx) {
    for (const L of leaves) {
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * 1.4 + L.ph)));
      ctx.globalAlpha = 0.85; const s = L.s;
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

  function drawBark(ctx, b) {
    const k = b.k, sc = k < 0.15 ? easeOut(k / 0.15) * 1.1 : k < 0.25 ? 1.1 - (k - 0.15) : 1;
    const a = k > 2.15 ? clamp((2.4 - k) / 0.25, 0, 1) : 1;
    ctx.font = `900 16px ${FONT}`; const w = ctx.measureText(b.s).width + 28, h = 34;
    const x = 636, y = 150;   // слева от головы Поппи
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
  if (o.stub) { ctx.rotate(-Math.PI / 2); ctx.letterSpacing = '2px'; text(ctx, o.stub, 0, 1, { size: 11, color: C.ink, outline: false }); ctx.letterSpacing = '0px'; }
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
    fitText(ctx, o.label, mid, by + bh / 2 + 1, bw - 44, 30, { color: C.gold, lw: 4, outline: '#2a0408' });
    ctx.letterSpacing = '1.5px';
    fitText(ctx, o.sub, mid, y + h - 13, bw, 11, { color: C.ink, outline: false });
    ctx.letterSpacing = '0px';
  } else {
    ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(58,26,16,0.3)';
    ctx.strokeRect(bx - 4, y + 6, bw + 8, h - 12); ctx.setLineDash([]);
    if (o.small) fitText(ctx, o.label, mid, y + h / 2 + 1, bw - 6, 20, { color: C.ink, outline: false });
    else {
      fitText(ctx, o.label, mid, y + h / 2 - 5, bw - 10, 23, { color: C.ink, outline: false });
      ctx.letterSpacing = '1.5px';
      fitText(ctx, o.sub, mid, y + h - 14, bw - 10, 9, { color: 'rgba(58,26,16,0.75)', outline: false });
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

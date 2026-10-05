// Портретная раскладка оверлеев боя (view.portrait): карточки уровня и сундука, пауза, итоги главы, подсказка сундука.
// Рисуется на ПОЛНОМ виде view.W × view.H (540 × 840…1260), а не в дизайн-рамке 960×540: крупные цели касания, текст ≥ ~12 CSS px.
// Экран смерти — в death_p.js. Ландшафт этим файлом не затрагивается. Все размеры считаются в draw (резайз/поворот на лету не ломает).
import { view } from '../engine/core.js';
import { clamp } from '../engine/util.js';
import { text, button, wrap } from './ui.js';
import { drawIcon } from '../art/icons.js';
import { drawSceneBg } from '../art/scenes.js';

// Метрики: view.scale — CSS-пикселей на логический; текст и кнопки задаются в логических единицах с запасом под маленькие экраны
export function metrics() {
  const s = view.scale || 1, sf = view.safe, W = view.W, H = view.H;
  const minF = Math.max(17, 12.5 / s);          // минимальный кегль (эффективно ≥ ~12 CSS px)
  const btnH = Math.max(56, 46 / s);            // высота кнопки (≥ 44 CSS px)
  const btnH2 = Math.max(48, 45 / s);           // высота второстепенной кнопки (≥ 44 CSS px)
  const L = Math.max(16, sf.l + 8), R = W - Math.max(16, sf.r + 8);
  return { W, H, s, minF, btnH, btnH2, L, R, w: R - L, cx: (L + R) / 2, top: sf.t, sb: sf.b, bot: H - sf.b };
}

// Подбор кегля: самый крупный размер из [size … minSize], при котором текст укладывается в maxLines строк
export function fitWrap(ctx, s, maxW, maxLines, size, minSize, weight = 700) {
  for (let f = Math.floor(size); f >= minSize; f--) { const lines = wrap(ctx, s, maxW, f, weight); if (lines.length <= maxLines) return { lines, size: f }; }
  return { lines: wrap(ctx, s, maxW, minSize, weight), size: minSize };
}
// Кроп-«cover» векторного арта в прямоугольник (fx, fy — точка интереса в координатах 960×540)
export function artCover(ctx, name, x, y, w, h, fx = 480, fy = 270) {
  const s = Math.max(w / 960, h / 540), dw = Math.round(960 * s), dh = Math.round(540 * s);
  const ox = clamp(x + w / 2 - fx * s, x + w - dw, x), oy = clamp(y + h / 2 - fy * s, y + h - dh, y);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const ok = drawSceneBg(ctx, name, Math.round(ox), Math.round(oy), dw, dh);
  ctx.restore(); return ok;
}
export function heart(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.4, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
}
// Нижняя кромка арта плавно уходит в тёмный фон
export function fadeBottom(ctx, x, y, w, h, rgb = '20,4,18', k = 0.55) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(1, `rgba(${rgb},${k})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

// ---------- Карточки уровня / сундука ----------
// Столбик карточек на всю ширину: иконка слева, справа метка (новое / ★ редкое / ур. N), название, описание, подсказка пары.
// Возвращает { rects, reroll } в координатах вида; нажатие по карточке выбирает её сразу (без двойного тапа).
export function drawCardsP(ctx, G, cards, sel, appear, inp) {
  const M = metrics(), { W, H } = M, touch = !!inp?.isTouch, p = inp?.pointer;
  ctx.fillStyle = 'rgba(15,4,14,0.76)'; ctx.fillRect(0, 0, W, H);
  const tY = M.top + 52;
  text(ctx, cards.title || 'Новый уровень!', M.cx, tY, { size: 42, color: '#ffeb7a', lw: 8 });
  const sub = fitWrap(ctx, cards.subtitle || 'Выбери одно', M.w, 2, 20, M.minF, 800);
  sub.lines.forEach((l, j) => text(ctx, l, M.cx, tY + 38 + j * (sub.size + 5), { size: sub.size, color: '#ffd0dc', weight: 800, lw: 4 }));
  const y0 = tY + 38 + sub.lines.length * (sub.size + 5) + 8;
  const hasRe = G.run.rerolls > 0 && !cards.title;
  const rerollH = M.btnH, bottomPad = Math.max(M.sb + 26, H * 0.045);
  const y1 = H - bottomPad - (hasRe ? rerollH + 16 : 0);
  const n = cards.list.length, gap = 14, avail = y1 - y0;
  const maxH = n === 1 ? 300 : n <= 3 ? 200 : 190;
  const ch = clamp((avail - gap * (n - 1)) / n, 118, maxH), total = ch * n + gap * (n - 1);
  const top = y0 + Math.max(0, (avail - total) * (n === 1 ? 0.4 : 0.5));
  const rects = [], x = M.L, w = M.w;
  cards.list.forEach((c, i) => {
    const k = clamp((appear - i * 0.07) / 0.25, 0, 1), e = 1 - (1 - k) ** 3;
    const y = top + i * (ch + gap) + (1 - e) * 46, h = ch;
    rects.push({ x, y, w, h });
    const over = !!p && p.x > x && p.x < x + w && p.y > y && p.y < y + h, press = over && p.down;
    const on = (!touch && i === sel) || press;
    ctx.save(); ctx.globalAlpha = e;
    if (on) { ctx.translate(x + w / 2, y + h / 2); const sc = press ? 0.985 : 1.02; ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2)); }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(x, y + 6, w, h, 18); ctx.fill();
    const col = c.evolve || c.rare ? '#ffd166' : c.isNew ? '#5ee6c8' : '#ff7aa8';
    ctx.fillStyle = '#2e0f2a'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    if (c.rare || c.evolve) { ctx.save(); ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 18 + 8 * Math.sin(performance.now() / 200); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd166'; ctx.stroke(); ctx.restore(); }
    ctx.lineWidth = on ? 5 : 3; ctx.strokeStyle = on ? '#fff' : col; ctx.stroke();
    // иконка в тонированной «витрине» слева
    const iz = clamp(h - 24, 76, n === 1 ? 180 : 132), ix = x + 12, iy = y + (h - iz) / 2;
    ctx.fillStyle = col; ctx.globalAlpha = e * 0.18; ctx.beginPath(); ctx.roundRect(ix, iy, iz, iz, 14); ctx.fill(); ctx.globalAlpha = e;
    drawIcon(ctx, c.icon, ix + iz / 2, iy + iz / 2, 2.4 * iz / 110);
    // текст справа: блок «метка — название — описание — пара» центрируется по высоте карточки
    const tx = ix + iz + 16, tw = x + w - 16 - tx, F = M.minF, big = n === 1;
    const nm = fitWrap(ctx, c.name, tw, 2, big ? 34 : h > 170 ? 28 : 25, F + 1, 900);
    const hintH = c.pairHint ? F + 8 : 0, tagH = F + 6, nameH = nm.lines.length * (nm.size + 2) + 4, padV = 14;
    const availT = h - 2 * padV - tagH - nameH - hintH;
    let ds = Math.min(big ? 24 : 21, F + (big ? 6 : 3)), dl = wrap(ctx, c.desc, tw, ds, 700);
    while (ds > F && dl.length * ds * 1.2 > availT) { ds--; dl = wrap(ctx, c.desc, tw, ds, 700); }
    const bodyH = tagH + nameH + dl.length * ds * 1.2 + hintH;
    let yy = y + Math.max(padV, (h - bodyH) / 2);
    text(ctx, c.tag, tx, yy + F * 0.5, { size: F, align: 'left', color: col, lw: 4 });
    if (!touch) text(ctx, String(i + 1), x + w - 18, y + 20, { size: F, align: 'right', color: 'rgba(255,255,255,0.6)', outline: false });
    yy += tagH;
    nm.lines.forEach((l, j) => text(ctx, l, tx, yy + nm.size * 0.55 + j * (nm.size + 2), { size: nm.size, align: 'left' }));
    yy += nameH;
    dl.forEach((l, j) => text(ctx, l, tx, yy + ds * 0.6 + j * ds * 1.2, { size: ds, align: 'left', weight: 700, color: '#ffe6ef', outline: false }));
    yy += dl.length * ds * 1.2;
    if (c.pairHint) text(ctx, '♥ ' + c.pairHint, tx, yy + 8 + F * 0.5, { size: F, align: 'left', color: '#ffd166', lw: 4 });
    ctx.restore(); ctx.globalAlpha = 1;
  });
  let reroll = null;
  if (hasRe) { const bw = Math.min(M.w, 340); reroll = { x: M.cx - bw / 2, y: H - bottomPad - rerollH, w: bw, h: rerollH }; }
  if (!touch) text(ctx, '1–' + n + ' · ← → · Enter' + (hasRe ? ' · R — перебор' : ''), M.cx, H - Math.max(M.sb + 10, 12), { size: 15, color: '#c9b0ff', weight: 700, lw: 3 });
  return { rects, reroll };
}

// ---------- Пауза ----------
// Возвращает 'cont' | 'sound' | 'quit' | null
export function drawPauseP(ctx, inp, soundOn) {
  const M = metrics(), { W, H } = M;
  ctx.fillStyle = 'rgba(15,4,14,0.78)'; ctx.fillRect(0, 0, W, H);
  const bw = Math.min(M.w, 440), bh = Math.max(76, M.btnH + 10), gap = 22, tot = bh * 3 + gap * 2;
  const y0 = clamp(H * 0.52 - tot / 2, M.top + 150, H - M.sb - tot - 70), bx = M.cx - bw / 2;
  text(ctx, 'Пауза', M.cx, y0 - 70, { size: 58, lw: 9 });
  let r = null;
  if (button(ctx, inp, bx, y0, bw, bh, 'Продолжить', { size: 30 })) r = 'cont';
  if (button(ctx, inp, bx, y0 + bh + gap, bw, bh, soundOn ? 'Звук: вкл' : 'Звук: выкл', { color: '#8b5cf6', size: 30 })) r = 'sound';
  if (button(ctx, inp, bx, y0 + 2 * (bh + gap), bw, bh, 'Сдаться', { color: '#5a4a58', size: 30 })) r = 'quit';
  if (!inp.isTouch) text(ctx, 'Esc — продолжить', M.cx, y0 + tot + 36, { size: 16, color: '#c9b0ff', weight: 700, lw: 3 });
  return r;
}

// ---------- Итоги главы ----------
// o: { inp, title, titleColor, line, rows:[[label, value]], next, art } → true, если нажата «Дальше»
export function drawClearP(ctx, o) {
  const M = metrics(), { W, H } = M, inp = o.inp;
  ctx.fillStyle = '#14040f'; ctx.fillRect(0, 0, W, H);
  const bandH = clamp(H * 0.31, 232, 440);
  if (!artCover(ctx, o.art || 'victory', 0, 0, W, bandH, 480, 330)) { ctx.fillStyle = '#2a0c24'; ctx.fillRect(0, 0, W, bandH); }
  ctx.fillStyle = 'rgba(20,4,18,0.28)'; ctx.fillRect(0, 0, W, bandH);
  fadeBottom(ctx, 0, bandH * 0.45, W, bandH * 0.55, '20,4,18', 1);
  let y = bandH - 26;
  const ts = fitWrap(ctx, o.title, M.w, 1, 50, 30, 900);
  text(ctx, o.title, M.cx, y, { size: ts.size, color: o.titleColor || '#5ee6c8', lw: 9 });
  y += ts.size * 0.5 + 8;
  const ql = fitWrap(ctx, o.line, M.w - 10, 3, 21, M.minF, 800);
  ql.lines.forEach((l, j) => text(ctx, l, M.cx, y + ql.size * 0.7 + j * (ql.size + 4), { size: ql.size, color: '#ffd0dc', weight: 800, lw: 4 }));
  y += ql.lines.length * (ql.size + 4) + 16;
  // панель итогов: крупный список «название — значение»
  const bH = M.btnH + 14, byy = H - Math.max(M.sb + 22, H * 0.04) - bH;
  const nl = fitWrap(ctx, o.next || '', M.w - 4, 3, 20, M.minF, 700);
  const nextH = o.next ? nl.lines.length * (nl.size + 5) + 12 : 0;
  const availP = byy - nextH - 18 - y, n = o.rows.length;
  const rh = clamp((availP - 28) / n, 38, 52), ph = rh * n + 22;
  const py = y + Math.max(0, (availP - ph) * 0.35);
  ctx.fillStyle = 'rgba(30,8,24,0.88)'; ctx.beginPath(); ctx.roundRect(M.L, py, M.w, ph, 18); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ff7aa8'; ctx.stroke();
  o.rows.forEach(([a, b], i) => {
    const ry = py + 11 + rh * (i + 0.5);
    text(ctx, a, M.L + 20, ry, { size: Math.min(24, rh * 0.55 + 4), align: 'left', weight: 700, outline: false, color: '#ffe6ef' });
    text(ctx, String(b), M.R - 20, ry, { size: Math.min(26, rh * 0.6 + 4), align: 'right', color: '#ffd166' });
    if (i) { ctx.fillStyle = 'rgba(255,170,200,0.14)'; ctx.fillRect(M.L + 16, py + 11 + rh * i, M.w - 32, 1.5); }
  });
  if (o.next) nl.lines.forEach((l, j) => text(ctx, l, M.cx, py + ph + 20 + nl.size * 0.6 + j * (nl.size + 5), { size: nl.size, color: '#c9b0ff', outline: false, weight: 700 }));
  const go = button(ctx, inp, M.L, byy, M.w, bH, 'Дальше', { size: 32 });
  if (!inp.isTouch) text(ctx, 'Enter', M.cx, byy + bH + 16, { size: 15, color: '#c9b0ff', weight: 700, lw: 3 });
  return go;
}

// ---------- «Подойди к сундуку!» ----------
// Над сундуком: подсказка и качающаяся стрелка (в портрете подпись не на полвысоты экрана, а у самого сундука)
export function drawChestHintP(ctx, G, t) {
  const M = metrics(), c = G.chest; if (!c) return;
  const bob = Math.sin(t * 5) * 8, ay = c.y - 78 + bob;
  const y = clamp(c.y - 150, M.top + 220, c.y - 100);
  const sz = Math.max(26, 14 / M.s);
  ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
  text(ctx, 'Подойди к сундуку!', clamp(M.cx, M.L + 120, M.R - 120), y, { size: sz, color: '#ffd166', lw: 7 });
  ctx.restore();
  ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#2a0a14'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(c.x - 16, ay - 14); ctx.lineTo(c.x + 16, ay - 14); ctx.lineTo(c.x, ay + 8); ctx.closePath(); ctx.stroke(); ctx.fill();
}

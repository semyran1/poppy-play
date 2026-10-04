// Значок страза (вторая валюта): огранённый розовый камень с бликом. Рисуется кодом, r — «радиус» (ширина = 2r).
// o.t — время для мерцания блика (необязательно), o.alpha — прозрачность, o.shadow — тень под камнем.
const OUT = '#2a0a28';
export function drawGem(ctx, x, y, r, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const lw = Math.max(0.07, 1.6 / r);   // толщина линии в «единицах камня»: примерно 1.6 px на экране
  const top = [[-0.55, -0.82], [0.55, -0.82], [1, -0.2], [0, 1], [-1, -0.2]];
  if (o.shadow) { ctx.save(); ctx.translate(0.08, 0.14); ctx.fillStyle = 'rgba(8,2,10,0.45)'; poly(ctx, top); ctx.fill(); ctx.restore(); }
  const g = ctx.createLinearGradient(-1, -1, 1, 1);
  g.addColorStop(0, '#ffd2ec'); g.addColorStop(0.45, '#ff7fc4'); g.addColorStop(1, '#b8247f');
  ctx.fillStyle = g; poly(ctx, top); ctx.fill();
  // грани: светлая верхняя площадка, тёмный низ, перекрёстные рёбра
  ctx.fillStyle = 'rgba(255,255,255,0.42)'; poly(ctx, [[-0.55, -0.82], [0.55, -0.82], [0.32, -0.2], [-0.32, -0.2]]); ctx.fill();
  ctx.fillStyle = 'rgba(122,13,60,0.38)'; poly(ctx, [[0, 1], [1, -0.2], [0.32, -0.2]]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; poly(ctx, [[-1, -0.2], [-0.32, -0.2], [0, 1]]); ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = lw / 2.4; ctx.strokeStyle = 'rgba(255,240,250,0.65)';
  ctx.beginPath(); ctx.moveTo(-1, -0.2); ctx.lineTo(1, -0.2); ctx.moveTo(-0.32, -0.2); ctx.lineTo(0, 1); ctx.moveTo(0.32, -0.2); ctx.lineTo(0, 1);
  ctx.moveTo(-0.55, -0.82); ctx.lineTo(-0.32, -0.2); ctx.moveTo(0.55, -0.82); ctx.lineTo(0.32, -0.2); ctx.stroke();
  ctx.lineWidth = lw / 1.4; ctx.strokeStyle = OUT; poly(ctx, top); ctx.stroke();
  // блик (мерцает, если задано время)
  const k = o.t === undefined ? 1 : 0.55 + 0.45 * Math.sin(o.t * 3.1) ** 2;
  ctx.globalAlpha *= k; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-0.42, -0.55, 0.16, 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); }

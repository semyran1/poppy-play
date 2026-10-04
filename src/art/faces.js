// Лица персонажей — отдельный слой из замеренных фигур (правило скилла vector-cartoon-redraw: глаза, брови, рот
// не оставлять автосегментации, а мерить по сетке оригинала и рисовать окружностями и сплайнами).
// Координаты — в системе вектора персонажа (src/art/vec/*.js), замер: tools/gridzoom.py.
const TAU = Math.PI * 2;

// Заплатка кожи: мягкое пятно под глазом/ртом, чтобы шум автосегментации не просвечивал
function skinPatch(ctx, x, y, rx, ry, col) {
  ctx.save(); ctx.filter = 'blur(1.2px)'; ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// Глаз аниме-стиля: миндаль белка, верхнее веко-тушь, радужка (окружность), зрачок, два блика.
// o: { cx, cy, w, top, bot, ix, iy, ir, iris:[outer,inner], lid, blink 0..1, look }
function eye(ctx, o) {
  const { cx, cy, w, top, bot } = o, b = o.blink || 0;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const t = cy - top * (1 - b), bt = cy + bot * (1 - b * 0.9);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, cy); ctx.bezierCurveTo(x0 + w * 0.2, t, x1 - w * 0.25, t, x1, cy - top * 0.1 * (1 - b));
  ctx.bezierCurveTo(x1 - w * 0.2, bt, x0 + w * 0.25, bt, x0, cy); ctx.closePath();
  ctx.fillStyle = '#ece3d8'; ctx.fill();
  ctx.clip();
  // тень верхнего века на белке
  ctx.fillStyle = 'rgba(70,90,110,0.35)'; ctx.fillRect(x0, t - 2, w, top * 0.55);
  const ix = o.ix + (o.look || 0) * 1.5, iy = o.iy;
  const g = ctx.createRadialGradient(ix + o.ir * 0.2, iy + o.ir * 0.3, o.ir * 0.1, ix, iy, o.ir);
  g.addColorStop(0, o.iris[1]); g.addColorStop(0.75, o.iris[0]); g.addColorStop(1, '#0b3a40');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, o.ir, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0a1a20'; ctx.beginPath(); ctx.arc(ix, iy + 0.2, o.ir * 0.45, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ix + o.ir * 0.45, iy - o.ir * 0.45, o.ir * 0.3, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(ix - o.ir * 0.4, iy + o.ir * 0.45, o.ir * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
  // верхнее веко — тушь, толще к внешнему углу, маленький «хвостик»
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = o.lid; ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(x0 - 0.5, cy + 0.3); ctx.bezierCurveTo(x0 + w * 0.2, t, x1 - w * 0.25, t, x1 + 0.6, cy - top * 0.1 * (1 - b)); ctx.stroke();
  ctx.lineWidth = 0.6; ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.moveTo(x0 + w * 0.15, bt - 0.4); ctx.quadraticCurveTo(cx, bt + 0.6, x1 - w * 0.1, bt - 0.8); ctx.stroke();
  ctx.restore();
}

function brow(ctx, pts, w, col) {
  // бровь — мазок с сужением к концам: верх и низ — квадратичные кривые через середину ± w/2
  const [a, m, c] = pts;
  ctx.save(); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo(m[0], m[1] - w, c[0], c[1]);
  ctx.quadraticCurveTo(m[0], m[1] + w * 0.25, a[0], a[1]);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// ---------- Краш (вектор crush.js 223×420) ----------
export function crushFace(ctx, o = {}) {
  // кожа нижней части лица — одна гладкая форма по замеру контура щёк и подбородка (tools/gridzoom.py),
  // радиальный градиент по сетке цветов оригинала: центр #e7d2b0 → щёки #dea180 → край #b06754
  ctx.save(); ctx.filter = 'blur(0.9px)';
  const sk = ctx.createRadialGradient(92, 114, 3, 93, 117, 31);
  sk.addColorStop(0, '#ead3b3'); sk.addColorStop(0.45, '#e6c6a4'); sk.addColorStop(0.72, '#dda07f'); sk.addColorStop(0.9, '#c87a5c'); sk.addColorStop(1, '#ad6248');
  ctx.fillStyle = sk; ctx.beginPath();
  ctx.moveTo(64.5, 102.5); ctx.bezierCurveTo(64.5, 112, 67, 120, 72, 127); ctx.bezierCurveTo(77, 134, 86, 140.5, 93, 140.5);
  ctx.bezierCurveTo(100, 140.5, 109, 134, 114, 127); ctx.bezierCurveTo(119, 120, 121.5, 112, 121.5, 102.5);
  ctx.quadraticCurveTo(93, 99.5, 64.5, 102.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  const E = { w: 20.5, top: 5.6, bot: 4.4, ir: 5.7, iris: ['#16807a', '#52d6cf'], lid: '#120807', blink: o.blink, look: o.look };
  eye(ctx, { ...E, cx: 76, cy: 108.8, ix: 77.2, iy: 108.6 });
  eye(ctx, { ...E, cx: 110.4, cy: 108.6, ix: 110.8, iy: 108.4 });
  // брови: левая опускается к переносице (хитрый прищур), правая поднята к виску
  brow(ctx, [[62, 99.6], [74, 100.2], [86.5, 104.2]], 4.2, '#1c120c');
  brow(ctx, [[99.5, 101], [109, 98.6], [121, 97.8]], 4.4, '#1c120c');
  // нос: мягкая тень кончика и ноздри
  ctx.save(); ctx.filter = 'blur(0.8px)';
  ctx.fillStyle = 'rgba(205,110,85,0.6)'; ctx.beginPath(); ctx.ellipse(94.5, 121.8, 3.6, 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,120,95,0.35)'; ctx.beginPath(); ctx.ellipse(93.5, 116, 1.6, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(120,50,40,0.6)'; ctx.beginPath(); ctx.ellipse(90.3, 123.6, 1.1, 0.7, 0, 0, TAU); ctx.ellipse(94.9, 123.6, 1.1, 0.7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,210,0.7)'; ctx.beginPath(); ctx.ellipse(92.2, 120.8, 1.4, 0.9, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // улыбка: ухмылка с ямочками
  const sm = o.smile ?? 1;
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#7a3527'; ctx.lineWidth = 1.25;
  ctx.beginPath(); ctx.moveTo(80.5, 126.6); ctx.bezierCurveTo(85, 129.5 + sm, 99, 129.8 + sm, 105.6, 126.4); ctx.stroke();
  ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(79.6, 125.6); ctx.lineTo(80.8, 127.2); ctx.moveTo(106.5, 125.5); ctx.lineTo(105.3, 127); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff1e6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(88, 132.2); ctx.quadraticCurveTo(93, 133.2, 98, 132.2); ctx.stroke();
  ctx.restore();
}

export const FACES = { crush: crushFace };

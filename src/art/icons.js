// Иконки оружия и пассивок (карты прокачки, HUD) и спрайты, которых нет в sprites.js. Всё — векторы.
import { TAU, star } from '../engine/util.js';
import { drawTampon, drawPad, drawPill, drawBottle, drawChoco, drawCup, drawPanties, PAL } from './sprites.js';

const INK = '#2a0a14';
function o(ctx, lw = 2) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }

export function drawBroom(ctx, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.roundRect(-2, -22, 4, 26, 2); ctx.fillStyle = '#8a5a2b'; ctx.fill(); o(ctx, 1.5);
  ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.lineTo(11, 20); ctx.quadraticCurveTo(0, 24, -11, 20); ctx.closePath(); ctx.fillStyle = '#e8b04a'; ctx.fill(); o(ctx, 1.5);
  ctx.strokeStyle = '#b07a20'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 1.5, 4); ctx.lineTo(i * 4, 20); ctx.stroke(); }
  ctx.fillStyle = '#8b5cf6'; ctx.fillRect(-5, 1, 10, 4);
  ctx.restore();
}
export function drawTeaCup(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(11, -6); ctx.quadraticCurveTo(10, 10, 0, 11); ctx.quadraticCurveTo(-10, 10, -11, -6); ctx.fillStyle = '#fff6e6'; ctx.fill(); o(ctx, 1.6);
  ctx.beginPath(); ctx.arc(13, 1, 4.5, -1.3, 1.6); o(ctx, 2);
  ctx.beginPath(); ctx.ellipse(0, -6, 11, 3, 0, 0, TAU); ctx.fillStyle = '#ffd36b'; ctx.fill(); o(ctx, 1.4);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 2.6, -6 + Math.sin(a) * 1, 1.6, 0.8, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(0, -6, 1.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; for (const dx of [-4, 3]) { ctx.beginPath(); ctx.moveTo(dx, -11); ctx.quadraticCurveTo(dx + 3, -15, dx, -19); ctx.stroke(); }
  ctx.restore();
}
export function drawIceBall(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = '#bff3ff'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = '#2b6c8a'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
}
export function drawIceCream(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.lineTo(0, 18); ctx.closePath(); ctx.fillStyle = '#e8a85a'; ctx.fill(); o(ctx, 1.5);
  ctx.strokeStyle = '#b07030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(3, 10); ctx.moveTo(5, 2); ctx.lineTo(-3, 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -7, 9, 0, TAU); ctx.fillStyle = '#e9fbff'; ctx.fill(); o(ctx, 1.5);
  ctx.fillStyle = '#7fd8ff'; ctx.beginPath(); ctx.arc(-3, -9, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}

const ICONS = {
  umbrellaP: (c) => { c.beginPath(); c.arc(0, -1, 12, Math.PI, 0); c.closePath(); c.fillStyle = '#e0233c'; c.fill(); o(c, 1.6); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, 10); c.arc(-3, 10, 3, 0, Math.PI); c.stroke(); },
  boots: (c) => { for (const s of [-1, 1]) { c.save(); c.translate(s * 6, 0); c.beginPath(); c.moveTo(-4, -12); c.lineTo(4, -12); c.lineTo(4, 5); c.lineTo(9, 7); c.lineTo(9, 11); c.lineTo(-5, 11); c.closePath(); c.fillStyle = s < 0 ? '#ffd166' : '#ff9a3c'; c.fill(); o(c, 1.4); c.restore(); } },
  mint: (c) => { c.beginPath(); c.roundRect(-12, -7, 24, 14, 4); c.fillStyle = '#9ff0d8'; c.fill(); o(c, 1.6); c.strokeStyle = '#2a8a6a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -7); c.lineTo(-6, 7); c.moveTo(6, -7); c.lineTo(6, 7); c.stroke(); },
  tampon: (c) => drawTampon(c, 0, 2, 1.6, { rot: 0.5, string: true }),
  pad: (c) => drawPad(c, 0, 0, 0.9, { rot: -0.3 }),
  pill: (c) => { drawPill(c, -4, -5, 1.3, { rot: -0.6 }); drawPill(c, 6, 7, 1.1, { rot: 0.4, color: '#ff7aa8' }); },
  bottle: (c) => drawBottle(c, 0, 3, 1),
  broom: (c) => drawBroom(c, 0, 0, 0.95, 0.6),
  choco: (c) => drawChoco(c, 0, 0, 1.4, { rot: -0.25 }),
  tea: (c) => drawTeaCup(c, -2, 4, 1.1),
  ice: (c) => drawIceCream(c, 0, 0, 1.15),
  cup: (c) => drawCup(c, 0, -2, 1.5, { filled: true }),
  cotton: (c) => { c.fillStyle = '#fff'; for (const [x, y, r] of [[-6, 2, 8], [5, 0, 9], [0, -6, 8], [-1, 6, 8]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.lineWidth = 1.5; c.strokeStyle = '#c9c9da'; c.stroke(); },
  wings: (c) => { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 4); c.quadraticCurveTo(s * 18, -14, s * 16, 6); c.quadraticCurveTo(s * 10, 4, 0, 4); c.fillStyle = '#fff'; c.fill(); o(c, 1.5); } },
  water: (c) => { c.beginPath(); c.moveTo(-9, -12); c.lineTo(9, -12); c.lineTo(7, 13); c.lineTo(-7, 13); c.closePath(); c.fillStyle = 'rgba(190,240,255,0.6)'; c.fill(); o(c, 1.6); c.fillStyle = '#5ec2ff'; c.fillRect(-7.5, -2, 15, 14); },
  blanket: (c) => { c.beginPath(); c.roundRect(-13, -11, 26, 22, 4); c.fillStyle = '#c8507a'; c.fill(); o(c, 1.6); c.strokeStyle = '#ffd1e0'; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-13, i * 7); c.lineTo(13, i * 7); c.stroke(); c.beginPath(); c.moveTo(i * 7, -11); c.lineTo(i * 7, 11); c.stroke(); } },
  sneakers: (c) => { c.beginPath(); c.moveTo(-13, 6); c.lineTo(-11, -6); c.lineTo(-2, -6); c.quadraticCurveTo(2, 0, 13, 2); c.lineTo(13, 8); c.closePath(); c.fillStyle = '#ff7aa8'; c.fill(); o(c, 1.6); c.fillStyle = '#fff'; c.fillRect(-13, 6, 26, 4); c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(-13, 6, 26, 4); },
  sweet: (c) => { c.fillStyle = '#ff7aa8'; c.beginPath(); c.arc(0, -2, 10, 0, TAU); c.fill(); o(c, 1.6); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -2, 5, 0, 5); c.stroke(); c.fillStyle = '#c9a26b'; c.fillRect(-1.5, 8, 3, 9); },
  headphones: (c) => { c.beginPath(); c.arc(0, 2, 11, Math.PI, 0); c.lineWidth = 3.5; c.strokeStyle = '#8b5cf6'; c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * 11 - 4, 0, 8, 12, 3); c.fillStyle = '#ff7aa8'; c.fill(); o(c, 1.4); } },
  mirror: (c) => { c.beginPath(); c.ellipse(0, -3, 10, 12, 0, 0, TAU); c.fillStyle = '#f6c8e0'; c.fill(); o(c, 1.6); c.beginPath(); c.ellipse(0, -3, 7, 9, 0, 0, TAU); c.fillStyle = '#bfe8ff'; c.fill(); c.fillStyle = '#fff'; c.fillRect(-3, -9, 2, 6); },
  glitter: (c) => { c.save(); star(c, 11); c.fillStyle = PAL.gold; c.fill(); o(c, 1.4); c.restore(); c.save(); c.translate(10, -9); star(c, 5); c.fillStyle = '#ff7aa8'; c.fill(); c.restore(); c.save(); c.translate(-10, 9); star(c, 4); c.fillStyle = '#5ee6c8'; c.fill(); c.restore(); },
  calendar: (c) => { c.beginPath(); c.roundRect(-11, -10, 22, 22, 3); c.fillStyle = '#fff'; c.fill(); o(c, 1.5); c.fillStyle = '#e8202a'; c.fillRect(-11, -10, 22, 6); c.fillStyle = INK; c.font = '900 11px sans-serif'; c.textAlign = 'center'; c.fillText('28', 0, 9); },
  cloak: (c) => { c.beginPath(); c.moveTo(-6, -12); c.lineTo(6, -12); c.quadraticCurveTo(14, 4, 12, 13); c.lineTo(-12, 13); c.quadraticCurveTo(-14, 4, -6, -12); c.fillStyle = '#4a6b3a'; c.fill(); o(c, 1.5); c.fillStyle = '#c9a26b'; c.fillRect(-6, -12, 12, 4); },
  socks: (c) => { for (const s of [-1, 1]) { c.save(); c.translate(s * 6, 0); c.beginPath(); c.moveTo(-4, -12); c.lineTo(4, -12); c.lineTo(4, 4); c.quadraticCurveTo(10, 6, 9, 11); c.lineTo(-4, 11); c.closePath(); c.fillStyle = s < 0 ? '#ffd166' : '#ff7aa8'; c.fill(); o(c, 1.4); c.restore(); } },
  thermos: (c) => { c.beginPath(); c.roundRect(-7, -9, 14, 22, 3); c.fillStyle = '#5ec2ff'; c.fill(); o(c, 1.5); c.beginPath(); c.roundRect(-5, -14, 10, 6, 2); c.fillStyle = '#3a4a6a'; c.fill(); o(c, 1.2); },
  luckycat: (c) => { c.beginPath(); c.arc(0, 2, 11, 0, TAU); c.fillStyle = '#fff'; c.fill(); o(c, 1.5); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 9, -4); c.lineTo(s * 7, -13); c.lineTo(s * 2, -8); c.fillStyle = '#fff'; c.fill(); o(c, 1.3); } c.fillStyle = INK; c.beginPath(); c.arc(-4, 1, 1.4, 0, TAU); c.arc(4, 1, 1.4, 0, TAU); c.fill(); c.fillStyle = '#e8202a'; c.fillRect(-6, 8, 12, 3); },
  heart: (c) => drawPanties(c, 0, 0, 0.7),
  candy: (c) => { c.fillStyle = '#ffc53d'; c.beginPath(); c.ellipse(0, 0, 8, 6, 0, 0, TAU); c.fill(); o(c, 1.3); },
};

export function drawIcon(ctx, name, x, y, s = 1) {
  const f = ICONS[name]; if (!f) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(ctx); ctx.restore();
}

// ---------- Мисс Спазм: розово-фиолетовая осьминожка в луче проектора ----------
// t — время, eye — открытие глаза 0..1, hit — вспышка, mood 0 злая..1, phase 1..3
export function drawSpasm(ctx, x, y, s, o2 = {}) {
  const t = o2.t || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // щупальца-ножки снизу (короткие, болтаются)
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.33, sw = Math.sin(t * 3 + i * 1.3) * 10;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * 50, 30);
    ctx.bezierCurveTo(Math.sin(a) * 70 + sw, 60, Math.sin(a) * 50 - sw, 85, Math.sin(a) * 80 + sw * 1.5, 105);
    ctx.lineWidth = 16 - Math.abs(i - 2.5) * 1.5; ctx.strokeStyle = '#4a1240'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth -= 5; ctx.strokeStyle = o2.phase === 3 ? '#e0408a' : '#c85aa0'; ctx.stroke();
  }
  // голова-купол
  ctx.beginPath(); ctx.moveTo(-70, 30); ctx.bezierCurveTo(-82, -70, 82, -70, 70, 30); ctx.quadraticCurveTo(0, 48, -70, 30);
  const g = ctx.createLinearGradient(0, -60, 0, 40); g.addColorStop(0, o2.phase === 3 ? '#ff6aa8' : '#e58ad0'); g.addColorStop(1, '#9a3a8a');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#4a1240'; ctx.stroke();
  // пятнышки
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (const [px, py, pr] of [[-40, -20, 7], [-25, -40, 5], [35, -30, 6], [48, -5, 4]]) { ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-30, -38, 14, 7, -0.5, 0, TAU); ctx.fill();
  // большой глаз (уязвимое место)
  const eo = o2.eye ?? 0.15;
  ctx.save(); ctx.translate(0, -2);
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 26 * Math.max(0.08, eo), 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#4a1240'; ctx.stroke();
  if (eo > 0.2) { ctx.save(); ctx.clip(); ctx.fillStyle = '#2a0f3a'; ctx.beginPath(); ctx.arc((o2.look || 0) * 9, 3, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((o2.look || 0) * 9 + 5, -2, 4.5, 0, TAU); ctx.fill(); ctx.restore(); }
  // брови-«спазм»
  ctx.strokeStyle = '#4a1240'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-34, -32 + (o2.mood || 0) * 8); ctx.quadraticCurveTo(0, -46, 34, -32 + (o2.mood || 0) * 8); ctx.stroke();
  ctx.restore();
  // рот-ухмылка
  ctx.beginPath(); ctx.moveTo(-22, 26); ctx.quadraticCurveTo(0, 38 + Math.sin(t * 6) * 3, 22, 26); ctx.lineWidth = 4; ctx.strokeStyle = '#4a1240'; ctx.stroke();
  // бантик (Хэллоуин)
  ctx.save(); ctx.translate(46, -46); ctx.rotate(0.4);
  ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -10); ctx.lineTo(-16, 10); ctx.closePath(); ctx.moveTo(0, 0); ctx.lineTo(16, -10); ctx.lineTo(16, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff8a1d'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.restore();
  if (o2.hit > 0) { ctx.globalAlpha = o2.hit * 0.7; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-70, 30); ctx.bezierCurveTo(-82, -70, 82, -70, 70, 30); ctx.quadraticCurveTo(0, 48, -70, 30); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}

// Щупальце удара: вертикальное, сверху до низа, с присосками
export function drawTentacle(ctx, x, yTop, yBot, w, k, t) {
  ctx.save();
  const sw = Math.sin(t * 20) * 3 * (1 - k);
  ctx.beginPath(); ctx.moveTo(x - w / 2, yTop);
  ctx.bezierCurveTo(x - w / 2 + sw, (yTop + yBot) / 2, x - w * 0.35, yBot - 30, x, yBot);
  ctx.bezierCurveTo(x + w * 0.35, yBot - 30, x + w / 2 + sw, (yTop + yBot) / 2, x + w / 2, yTop);
  ctx.fillStyle = '#c85aa0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#4a1240'; ctx.stroke();
  ctx.fillStyle = '#ffc2e6';
  for (let y = yTop + 30; y < yBot - 20; y += 34) { ctx.beginPath(); ctx.ellipse(x - w * 0.12, y, w * 0.13, w * 0.1, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawPopcorn(ctx, x, y, r, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#fff6d6'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.4;
  for (const [px, py, pr] of [[0, -r * 0.4, 0.55], [-r * 0.45, 0.1 * r, 0.5], [r * 0.45, 0.1 * r, 0.5], [0, r * 0.35, 0.5]]) { ctx.beginPath(); ctx.arc(px, py, pr * r, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// Сундук босса (коробка конфет с бантом)
export function drawChest(ctx, x, y, s = 1, t = 0, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const glow = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.fillStyle = `rgba(255,210,90,${0.25 + glow * 0.2})`; ctx.beginPath(); ctx.arc(0, -10, 46, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-26, -16, 52, 34, 6); ctx.fillStyle = '#ff5d8f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.fillRect(-5, -16, 10, 34);
  ctx.save(); ctx.translate(0, -16 - open * 20); ctx.rotate(-open * 0.6);
  ctx.beginPath(); ctx.roundRect(-29, -12, 58, 14, 5); ctx.fillStyle = '#ff7aa8'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.fillRect(-5, -12, 10, 14);
  ctx.beginPath(); ctx.ellipse(-9, -16, 9, 6, 0.5, 0, TAU); ctx.ellipse(9, -16, 9, 6, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

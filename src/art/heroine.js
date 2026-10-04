// Новая Поппи v2 — кукла в коде (скилл vector-cartoon-redraw). Облик — с референсов пользователя
// (tools/ref/heroine/h1–h3): небрежный пучок, круглые очки, серо-голубые глаза, зелёная футболка со стойкой,
// персиковые пижамные штаны с персиками; второй костюм — Лара Крофт.
// Вид три четверти лицом по ходу (как h1), ближняя рука и нога — правые (правило скилла).
// Бег, ходьба и прыжок — слепки мокапа CMU (src/art/heroine_clips.js, tools/mocap2d.py): углы бедра/голени/стопы
// и рук по кадрам; опорная стопа ставится на землю. Прицел вверх — руки по IK к рукояти бластера над головой.
// Система координат: ступни на y = 0, рост ≈ 300 ед., ось y вниз, лицом в +x.
import CLIPS from './heroine_clips.js';
import { drawHeroineVec, heroineVecMuzzle, heroineVecReady, loadHeroineVec } from './heroineVec.js';
loadHeroineVec('pajama'); loadHeroineVec('lara');
const TAU = Math.PI * 2;
const INK = '#2a1a14';
export const OUTFITS = {
  pajama: { name: 'Пижама', top: '#5f8a43', topShade: '#4b7134', pants: '#f4c39a', pantsShade: '#e2a47b', dots: '#e07a3c', sleeves: 'short' },
  lara:   { name: 'Лара Крофт', top: '#8fa6a0', topShade: '#748b85', pants: '#5a4634', pantsShade: '#46362a', shorts: true, boots: '#5b3a22', belt: '#3a2618', holsters: true, sleeves: 'none' },
};
const SKIN = '#f1c6a6', SKIN_FAR = '#dfae8e', SKIN_SH = '#e0a583', HAIR = '#4a2a1c', HAIR_DK = '#331c12', HAIR_HI = '#8a5a3c', LIP = '#c4606a', IRIS = '#7d97a6';
const THIGH = 70, SHIN = 64, UPARM = 46, FOREARM = 42, HIP_Y = -146;

function sp(ctx, pts, close = true) { // Catmull-Rom → Безье (splinePath скилла)
  const n = pts.length; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  const N = close ? n : n - 1;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const a = close || i > 0 ? p0 : p1, d = close || i < n - 2 ? p3 : p2;
    ctx.bezierCurveTo(p1[0] + (p2[0] - a[0]) / 6, p1[1] + (p2[1] - a[1]) / 6, p2[0] - (d[0] - p1[0]) / 6, p2[1] - (d[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (close) ctx.closePath();
}
function ink(ctx, fill, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); } }
const add = (p, a, L) => [p[0] + Math.sin(a) * L, p[1] + Math.cos(a) * L];   // угол от вертикали вниз, + вперёд
function ik(S, T, a, b, bend) {
  let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
  const dd = Math.min(Math.max(d, 1), a + b - 0.01); dx *= dd / (d || 1); dy *= dd / (d || 1); d = dd;
  const ca = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
  const ang = Math.atan2(dy, dx) + bend * Math.acos(ca);
  return [S[0] + Math.cos(ang) * a, S[1] + Math.sin(ang) * a];
}
function tube(ctx, A, B, r1, r2) {
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.beginPath(); ctx.moveTo(A[0] + nx * r1, A[1] + ny * r1); ctx.lineTo(B[0] + nx * r2, B[1] + ny * r2);
  ctx.arc(B[0], B[1], r2, ang + Math.PI / 2, ang - Math.PI / 2, true); ctx.lineTo(A[0] - nx * r1, A[1] - ny * r1);
  ctx.arc(A[0], A[1], r1, ang - Math.PI / 2, ang + Math.PI / 2, true); ctx.closePath();
}

// Кадр клипа с интерполяцией; u — фаза 0..1
function clipFrame(name, u) {
  const c = CLIPS[name]; if (!c) return null;
  const n = c.frames.length, cyc = c.kind === 'cycle';
  const x = cyc ? ((u % 1) + 1) % 1 * n : Math.max(0, Math.min(0.999, u)) * (n - 1);
  const i = Math.floor(x), k = x - i, a = c.frames[i], b = c.frames[cyc ? (i + 1) % n : Math.min(n - 1, i + 1)];
  const o = {}; for (const key in a) { let d = b[key] - a[key]; if (key !== 'bob') { while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; } o[key] = a[key] + d * k; }
  return o;
}
const REST = { lt: 0.03, ls: 0.0, lf: 1.45, rt: -0.03, rs: 0.0, rf: 1.45, la: 0.06, lfa: 0.12, ra: -0.04, rfa: 0.1, torso: 0.0, head: 0 };

// ---------- Поза ----------
// pose: { kind: stand|talk|walk|run|jump|aim, u (фаза клипа), t, aim (bool, стрельба вверх при любом движении), blink, mouth, look, brow }
function rig(pose) {
  const t = pose.t || 0, kind = pose.kind || 'stand';
  let F = { ...REST };
  if (kind === 'run' || kind === 'walk') F = clipFrame(kind, pose.u || 0);
  if (kind === 'jump') F = clipFrame('jump', pose.u ?? 0.5);
  const breathe = Math.sin(t * 2.2);
  const R = { F, kind, breathe };
  // ноги: прямая кинематика от тазобедренных суставов по углам слепка
  const hipF = [-5, HIP_Y], hipN = [5, HIP_Y + 2];
  const kneeF = add(hipF, F.lt, THIGH), ankF = add(kneeF, F.ls, SHIN), toeF = add(ankF, F.lf, 16);
  const kneeN = add(hipN, F.rt, THIGH), ankN = add(kneeN, F.rs, SHIN), toeN = add(ankN, F.rf, 16);
  // опорная стопа на полу (на земле), в прыжке — таз на месте
  let lift = 0;
  if (kind !== 'jump') lift = -Math.max(ankF[1] + 4, ankN[1] + 4, toeF[1], toeN[1]);
  else lift = 0;
  R.y = lift; // сдвиг всего тела по вертикали
  Object.assign(R, { hipF, hipN, kneeF, ankF, toeF, kneeN, ankN, toeN });
  R.lean = kind === 'run' ? 0.1 : kind === 'walk' ? 0.03 : 0;
  R.shoulderF = [-6, -238 + breathe * 0.4]; R.shoulderN = [12, -236 + breathe * 0.4];
  R.neck = [5, -242 + breathe * 0.5];
  R.headRot = (pose.headRot || 0) + (kind === 'run' ? -0.05 : 0);
  // руки: по слепку (бег/ходьба) или покой; в прицеле — IK к бластеру
  const armF = add(R.shoulderF, F.la, UPARM), armN = add(R.shoulderN, F.ra, UPARM);
  R.elbowF = armF; R.handF = add(armF, F.lfa, FOREARM); R.elbowN = armN; R.handN = add(armN, F.rfa, FOREARM);
  if (kind === 'talk') { const g = Math.sin(t * 3); R.handN = [44, -182 + g * 6]; R.elbowN = ik(R.shoulderN, R.handN, UPARM, FOREARM, -1); }
  if (pose.aim || kind === 'aim') {
    const sway = Math.sin(t * 3) * 1.5;
    R.gun = { x: 42, y: -300 + sway, ang: -Math.PI / 2 + (pose.aimTilt || 0) };
    R.handN = [42, -286 + sway]; R.handF = [36, -270 + sway];
    R.elbowN = ik(R.shoulderN, R.handN, UPARM, FOREARM, 1); R.elbowF = ik(R.shoulderF, R.handF, UPARM, FOREARM, 1);
    R.headRot -= 0.22; // смотрит вверх, куда стреляет
  }
  return R;
}

// Дуло в единицах куклы-300 (для совместимости с player.js: масштаб h/300)
export function heroineMuzzle(pose, outfit = 'pajama') {
  if (heroineVecReady(outfit)) return heroineVecMuzzle(pose, 300, outfit);
  return heroineMuzzlePuppet(pose);
}
function heroineMuzzlePuppet(pose) {
  const R = rig(pose); if (!R.gun) return [8, -330];
  return [R.gun.x + Math.cos(R.gun.ang) * 58, R.gun.y + Math.sin(R.gun.ang) * 58 + R.y];
}

// ---------- Отрисовка ----------
export function drawHeroine(ctx, x, y, h, pose = {}, outfitKey = 'pajama', o = {}) {
  if (drawHeroineVec(ctx, x, y, h, pose, { ...o, outfit: outfitKey })) return;   // снято с листа персонажа
  const O = OUTFITS[outfitKey] || OUTFITS.pajama, sc = h / 300;
  const lw = Math.min(5.5, Math.max(2.1, 1.4 / sc));
  const R = rig(pose);
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * (o.flip ? -1 : 1), sc);
  ctx.translate(0, R.y);
  ctx.save(); ctx.translate(0, HIP_Y); ctx.rotate(R.lean); ctx.translate(0, -HIP_Y);
  // дальние части — за телом и темнее
  drawBun(ctx, R, lw);
  drawArm(ctx, R.shoulderF, R.elbowF, R.handF, O, lw, true);
  drawLeg(ctx, R.hipF, R.kneeF, R.ankF, R.toeF, O, lw, true);
  drawPelvis(ctx, O, lw);
  drawLeg(ctx, R.hipN, R.kneeN, R.ankN, R.toeN, O, lw, false);
  drawTorso(ctx, R, O, lw);
  drawHead(ctx, R, lw, pose);
  if (R.gun) drawGun(ctx, R.gun, lw);
  drawArm(ctx, R.shoulderN, R.elbowN, R.handN, O, lw, false);
  ctx.restore();
  ctx.restore();
}

function drawLeg(ctx, H, K, A, T, O, lw, far) {
  const pants = far ? O.pantsShade : O.pants;
  if (O.shorts) {
    tube(ctx, H, K, 13, 9.5); ink(ctx, far ? SKIN_FAR : SKIN, lw);
    tube(ctx, K, A, 9.5, 6.5); ink(ctx, far ? SKIN_FAR : SKIN, lw);
    const m = [K[0] + (A[0] - K[0]) * 0.35, K[1] + (A[1] - K[1]) * 0.35];
    tube(ctx, m, A, 9, 8); ink(ctx, far ? '#4a2e1a' : O.boots, lw);
    sp(ctx, [[A[0] - 7, A[1] - 4], [T[0] + 4, T[1] - 6], [T[0] + 6, T[1] + 1], [A[0] - 8, A[1] + 5]]); ink(ctx, far ? '#4a2e1a' : O.boots, lw);
    tube(ctx, H, [H[0] + (K[0] - H[0]) * 0.32, H[1] + (K[1] - H[1]) * 0.32], 16, 15); ink(ctx, far ? O.pantsShade : O.pants, lw);
    return;
  }
  // босая стопа (как на h3)
  sp(ctx, [[A[0] - 6, A[1] - 3], [A[0] + 4, A[1] - 5], [T[0] + 2, T[1] - 2], [T[0] + 3, T[1] + 2], [A[0] - 6, A[1] + 4]]); ink(ctx, far ? SKIN_FAR : SKIN, lw);
  // широкая пижамная штанина: прямые бока бедра и голени, ровный подол чуть выше щиколотки
  const n1 = norm(H, K), n2 = norm(K, A);
  const hem = [A[0] + (K[0] - A[0]) * 0.06, A[1] + (K[1] - A[1]) * 0.06];
  const poly = [[H[0] + n1[0] * 17, H[1] + n1[1] * 17 - 6], [K[0] + n1[0] * 15 + n2[0] * 0, K[1] + n1[1] * 15], [hem[0] + n2[0] * 18, hem[1] + n2[1] * 18],
                [hem[0] - n2[0] * 18, hem[1] - n2[1] * 18], [K[0] - n1[0] * 15, K[1] - n1[1] * 15], [H[0] - n1[0] * 17, H[1] - n1[1] * 17 - 6]];
  const legPath = () => { ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); };
  legPath(); ink(ctx, pants, null);
  ctx.save(); legPath(); ctx.clip(); dots(ctx, H, K, A, O, far);
  ctx.fillStyle = far ? 'rgba(120,60,30,0.18)' : 'rgba(170,90,50,0.16)'; ctx.beginPath(); ctx.moveTo(poly[3][0], poly[3][1]); ctx.lineTo(poly[4][0], poly[4][1]); ctx.lineTo(poly[5][0], poly[5][1]); ctx.lineTo(H[0], H[1]); ctx.lineTo(hem[0], hem[1]); ctx.fill(); ctx.restore();
  legPath(); ctx.lineJoin = 'round'; ink(ctx, null, lw);
  ctx.beginPath(); ctx.moveTo(K[0] - n1[0] * 6, K[1] - n1[1] * 6 - 5); ctx.quadraticCurveTo(K[0] + 2, K[1] + 2, K[0] + n1[0] * 8, K[1] + n1[1] * 8 - 3); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = 'rgba(42,26,20,0.5)'; ctx.stroke();
}
function norm(A, B) { const d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [-(B[1] - A[1]) / d, (B[0] - A[0]) / d]; }
function dots(ctx, H, K, A, O, far) { // персики на штанах
  ctx.strokeStyle = O.dots; ctx.lineWidth = 1.5; ctx.fillStyle = far ? 'rgba(220,120,70,0.3)' : 'rgba(240,140,90,0.35)';
  const pts = [[0.15, -6], [0.35, 7], [0.55, -4], [0.75, 6], [0.95, -6], [1.15, 5], [1.35, -5], [1.6, 6], [1.8, -4]];
  for (const [u, off] of pts) {
    const P = u < 1 ? [H[0] + (K[0] - H[0]) * u, H[1] + (K[1] - H[1]) * u] : [K[0] + (A[0] - K[0]) * (u - 1), K[1] + (A[1] - K[1]) * (u - 1)];
    ctx.beginPath(); ctx.arc(P[0] + off, P[1], 3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(P[0] + off, P[1] - 3); ctx.lineTo(P[0] + off + 1.5, P[1] - 5.5); ctx.stroke();
  }
}

function torsoPath(ctx) {
  // футболка три четверти: грудь вперёд (+x), спина ровная; стойка-воротник
  sp(ctx, [[-14, -240], [-4, -244], [12, -243], [24, -234], [30, -214], [33, -196], [28, -182], [24, -164], [26, -152], [6, -148], [-18, -150], [-21, -164], [-20, -190], [-22, -214], [-20, -232]]);
}
function drawPelvis(ctx, O, lw) {
  // таз и пояс штанов — одна деталь
  if (!O.shorts) {
    ctx.beginPath(); ctx.moveTo(-22, -162); ctx.lineTo(27, -162); ctx.quadraticCurveTo(33, -148, 25, -134); ctx.lineTo(-19, -134); ctx.quadraticCurveTo(-27, -148, -22, -162); ctx.closePath();
    ctx.fillStyle = O.pants; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-19, -134); ctx.quadraticCurveTo(-27, -148, -22, -162); ctx.moveTo(27, -162); ctx.quadraticCurveTo(33, -148, 25, -134); ink(ctx, null, lw);
    ctx.beginPath(); ctx.moveTo(-21, -154); ctx.quadraticCurveTo(4, -150, 28, -154); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = INK; ctx.stroke();
  } else {
    sp(ctx, [[-22, -160], [26, -160], [30, -138], [27, -122], [-20, -122], [-25, -140]]); ink(ctx, O.pants, lw);
    ctx.beginPath(); ctx.rect(-23, -163, 52, 7); ink(ctx, O.belt, lw * 0.8);
    if (O.holsters) { ctx.beginPath(); ctx.roundRect(18, -140, 13, 24, 3); ink(ctx, O.belt, lw * 0.8); }
  }
}
function drawTorso(ctx, R, O, lw) {
  torsoPath(ctx); ink(ctx, O.top, lw);
  ctx.save(); torsoPath(ctx); ctx.clip();
  ctx.fillStyle = O.topShade; ctx.beginPath(); ctx.ellipse(18, -190, 13, 7, -0.2, 0, TAU); ctx.fill();              // тень под грудью
  ctx.fillStyle = O.top; ctx.beginPath(); ctx.ellipse(17, -200, 14, 11, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.ellipse(16, -205, 7, 4, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = O.topShade; ctx.fillRect(-30, -240, 10, 100); ctx.fillRect(-30, -158, 70, 12);                      // спина в тени, низ
  ctx.restore();
  torsoPath(ctx); ink(ctx, null, lw);
  ctx.beginPath(); ctx.moveTo(26, -205); ctx.quadraticCurveTo(31, -196, 26, -186); ctx.lineWidth = lw * 0.55; ctx.strokeStyle = INK; ctx.stroke();
  if (O.sleeves === 'none') { ctx.beginPath(); ctx.moveTo(-6, -243); ctx.quadraticCurveTo(4, -232, 14, -243); ink(ctx, SKIN, lw * 0.8); }
  else { ctx.beginPath(); ctx.moveTo(-6, -243); ctx.quadraticCurveTo(4, -238, 14, -243); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = INK; ctx.stroke(); }
}

function drawArm(ctx, S, E, Hn, O, lw, far) {
  const sk = far ? SKIN_FAR : SKIN;
  tube(ctx, S, E, 8.5, 7); ink(ctx, sk, lw);
  tube(ctx, E, Hn, 7, 5.5); ink(ctx, sk, lw);
  ctx.beginPath(); ctx.ellipse(Hn[0], Hn[1], 6.5, 5.6, Math.atan2(Hn[1] - E[1], Hn[0] - E[0]), 0, TAU); ink(ctx, sk, lw);
  if (O.sleeves === 'short') { const m = [S[0] + (E[0] - S[0]) * 0.5, S[1] + (E[1] - S[1]) * 0.5]; tube(ctx, S, m, 11.5, 10.5); ink(ctx, far ? O.topShade : O.top, lw); }
}

function drawGun(ctx, G, lw) { // голубой бластер, как у Поппи оригинала
  ctx.save(); ctx.translate(G.x, G.y); ctx.rotate(G.ang + Math.PI / 2);
  ctx.beginPath(); ctx.roundRect(-8, -54, 16, 46, 5); ink(ctx, '#2fa8e0', lw);
  ctx.beginPath(); ctx.roundRect(-5, -61, 10, 9, 3); ink(ctx, '#d8e4ee', lw);
  ctx.beginPath(); ctx.roundRect(-11, -32, 22, 16, 4); ink(ctx, '#e8eef5', lw);
  ctx.fillStyle = '#3ad87a'; ctx.fillRect(-4, -28, 8, 4); ctx.fillRect(-4, -22, 8, 3);
  ctx.beginPath(); ctx.roundRect(-5, -10, 10, 22, 3); ink(ctx, '#3a4250', lw);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-6, -50, 3, 18);
  ctx.restore();
}

const HEAD_K = 1.2; // голова чуть крупнее реальной пропорции — читаемость лица в игровом размере
function headSpace(ctx, R) { ctx.translate(R.neck[0], R.neck[1]); ctx.rotate(R.headRot); ctx.scale(HEAD_K, HEAD_K); }
function drawBun(ctx, R, lw) { // пучок и задняя масса волос — за головой
  ctx.save(); headSpace(ctx, R);
  sp(ctx, [[-22, -24], [-25, -44], [-15, -60], [4, -64], [20, -56], [24, -40], [18, -26], [-4, -18]]); ink(ctx, HAIR_DK, lw);
  ctx.beginPath(); ctx.ellipse(-12, -66, 14, 11, -0.4, 0, TAU); ink(ctx, HAIR, lw);
  ctx.lineWidth = lw * 0.65; ctx.strokeStyle = HAIR_DK; ctx.beginPath(); ctx.arc(-12, -66, 7.5, 0.6, 4.6); ctx.stroke(); ctx.beginPath(); ctx.arc(-12, -67, 3, 2.2, 6.2); ctx.stroke();
  ctx.strokeStyle = HAIR_HI; ctx.lineWidth = lw * 0.55; ctx.beginPath(); ctx.moveTo(-22, -69); ctx.quadraticCurveTo(-14, -78, -2, -71); ctx.stroke();
  ctx.strokeStyle = HAIR; ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(-23, -62); ctx.quadraticCurveTo(-30, -60, -28, -52); ctx.moveTo(-4, -76); ctx.quadraticCurveTo(0, -84, 6, -80); ctx.stroke(); // выбившиеся прядки
  ctx.restore();
}

function facePath(ctx) { // лицо три четверти: скула и подбородок со стороны взгляда (+x)
  sp(ctx, [[-14, -44], [-17, -30], [-13, -16], [-4, -9], [6, -6], [14, -10], [19, -19], [21, -30], [19, -42], [4, -50]]);
}
function drawHead(ctx, R, lw, pose) {
  ctx.save(); headSpace(ctx, R);
  ctx.beginPath(); ctx.roundRect(-6, -12, 14, 18, 4); ink(ctx, SKIN_SH, lw);           // шея
  facePath(ctx); ink(ctx, SKIN, lw);
  ctx.save(); facePath(ctx); ctx.clip();
  ctx.fillStyle = 'rgba(230,120,120,0.28)'; ctx.beginPath(); ctx.ellipse(13, -21, 5, 3, 0, 0, TAU); ctx.ellipse(-8, -21, 3.5, 2.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,110,85,0.22)'; ctx.fillRect(-20, -52, 44, 7); ctx.fillRect(-20, -50, 6, 50);
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(-15, -28, 3.6, 5.5, 0, 0, TAU); ink(ctx, SKIN, lw * 0.8);   // ухо (дальняя сторона скрыта)
  // глаза: ближний крупнее, дальний сжат перспективой
  const blink = pose.blink || 0, lk = (pose.look || 0) * 1.1, up = R.gun ? -1.6 : 0;
  const eyes = [[0.5, 1, 0.78], [13.5, 1, 1]];
  for (const [ex, , k] of eyes) {
    const ey = -29;
    ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, 4.8 * k, 3.5 * (1 - blink * 0.92), 0, 0, TAU); ctx.fillStyle = '#fbf6f0'; ctx.fill(); ctx.clip();
    ctx.fillStyle = IRIS; ctx.beginPath(); ctx.arc(ex + 1 * k + lk, ey + up + 0.3, 2.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1e2a33'; ctx.beginPath(); ctx.arc(ex + 1 * k + lk, ey + up + 0.3, 1.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 2 * k + lk, ey + up - 0.8, 0.8, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(ex - 5 * k, ey + 0.4); ctx.quadraticCurveTo(ex, ey - 4.6 * (1 - blink * 0.9), ex + 5.2 * k, ey - 0.4); ctx.lineWidth = lw * 0.9; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + 5 * k, ey - 0.4); ctx.lineTo(ex + 6.6 * k, ey - 2); ctx.stroke();
  }
  // брови
  ctx.lineWidth = lw * 1.05; ctx.strokeStyle = '#3a2016'; const br = pose.brow || 0;
  ctx.beginPath(); ctx.moveTo(-3.5, -35.5 - br); ctx.quadraticCurveTo(0.5, -38 - br, 4.5, -36.2 - br); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8.5, -36 - br); ctx.quadraticCurveTo(13.5, -39 - br, 19, -36.5 - br); ctx.stroke();
  // круглые очки: ближняя линза — круг, дальняя — эллипс (поворот головы)
  ctx.lineWidth = lw * 0.85; ctx.strokeStyle = '#1e1410';
  ctx.beginPath(); ctx.arc(13.5, -28.5, 7.4, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0.5, -28.5, 5.6, 7.2, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6.1, -29.5); ctx.quadraticCurveTo(6.2, -31.2, 6.4, -29.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5.1, -29.5); ctx.lineTo(-14, -30.5); ctx.stroke();                         // дужка к уху
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(10.5, -32, 1.6, 2.6, 0.5, 0, TAU); ctx.ellipse(-1.5, -32, 1.2, 2.2, 0.5, 0, TAU); ctx.fill();
  // нос: профиль чуть выступает вперёд
  ctx.beginPath(); ctx.moveTo(8, -26.5); ctx.quadraticCurveTo(10.2, -20.5, 8.3, -19.4); ctx.quadraticCurveTo(7, -19, 6, -19.8); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = '#a8624a'; ctx.stroke();
  // губы: полные (h1); mouth 0..1 — речь
  const m = pose.mouth || 0, mx = 8;
  ctx.beginPath(); ctx.moveTo(mx - 5, -14.3); ctx.quadraticCurveTo(mx - 1.6, -16.4, mx + 0.4, -15.5); ctx.quadraticCurveTo(mx + 2.6, -16.4, mx + 5.6, -14.4);
  ctx.quadraticCurveTo(mx + 0.4, -11.8 + m * 4.6, mx - 5, -14.3); ink(ctx, LIP, lw * 0.6);
  if (m > 0.05) { ctx.beginPath(); ctx.ellipse(mx + 0.4, -13.8 + m * 1.2, 3.4, m * 2.3, 0, 0, TAU); ctx.fillStyle = '#6a2430'; ctx.fill(); }
  // чёлка: зачёсана набок вперёд, как на h1
  sp(ctx, [[-17, -36], [-19, -48], [-8, -58], [8, -59], [21, -51], [23, -40], [18, -44], [10, -42], [5, -46], [-3, -40], [-10, -43]]); ink(ctx, HAIR, lw);
  ctx.strokeStyle = HAIR_HI; ctx.lineWidth = lw * 0.55; ctx.beginPath(); ctx.moveTo(-10, -52); ctx.quadraticCurveTo(2, -58, 14, -52); ctx.moveTo(-13, -46); ctx.quadraticCurveTo(-5, -50, 1, -48); ctx.stroke();
  ctx.strokeStyle = HAIR; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(21, -40); ctx.quadraticCurveTo(25, -31, 22, -22); ctx.moveTo(-17, -38); ctx.quadraticCurveTo(-21, -30, -18, -22); ctx.stroke();
  ctx.restore();
}

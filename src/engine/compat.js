// Совместимость со старыми браузерами и WebView (Chrome < 99, Safari < 16, часть Android-оболочек): без этих функций игра не рисует ни кадра.
// Подключается первым в main.js. Ничего не делает там, где функции уже есть.
const C2D = globalThis.CanvasRenderingContext2D, P = C2D && C2D.prototype;
// ctx.roundRect(x, y, w, h, radii) — скруглённый прямоугольник (Chrome 99+, Safari 16+, Firefox 112+); радиус: число, DOMPoint или массив из 1–4 значений
if (P && !P.roundRect) {
  P.roundRect = function (x, y, w, h, radii = 0) {
    const r = [].concat(radii).map(v => (typeof v === 'object' && v ? v.x : v) || 0);
    const [tl, tr, br, bl] = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r;
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    const k = Math.min(1, w / ((tl + tr) || 1), w / ((bl + br) || 1), h / ((tl + bl) || 1), h / ((tr + br) || 1));
    const a = Math.max(0, tl) * k, b = Math.max(0, tr) * k, c = Math.max(0, br) * k, d = Math.max(0, bl) * k;
    this.moveTo(x + a, y); this.lineTo(x + w - b, y); this.arcTo(x + w, y, x + w, y + b, b);
    this.lineTo(x + w, y + h - c); this.arcTo(x + w, y + h, x + w - c, y + h, c);
    this.lineTo(x + d, y + h); this.arcTo(x, y + h, x, y + h - d, d);
    this.lineTo(x, y + a); this.arcTo(x, y, x + a, y, a); this.closePath();
  };
}
// structuredClone (Chrome 98+, Safari 15.4+): сейв — обычный JSON-объект, хватит копии через JSON
if (typeof globalThis.structuredClone !== 'function') globalThis.structuredClone = o => JSON.parse(JSON.stringify(o));

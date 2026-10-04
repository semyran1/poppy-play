// Вторая валюта — «стразы» (docs/ACCESSORIES_MONETIZATION.md, «Две валюты»).
// Конфеты — бесплатная валюта забега, тратятся ТОЛЬКО в Косметичке (сила и разнообразие, meta.js).
// Стразы — ТОЛЬКО на аксессуары (косметика, на силу не влияют). Берутся из достижений и за реальные деньги через площадку
// (src/platform). Модуль без зависимостей: его импортируют и каталог, и достижения, и платёжный слой.

// Цена аксессуара в стразах по редкости (предметы с источником 'shop'; ach / find цены не имеют)
export const GEM_PRICE = { common: 40, rare: 90, epic: 180, legend: 350 };

export const gemsOf = (save) => { const n = Math.floor(+save.gems); return Number.isFinite(n) && n > 0 ? n : 0; };
// Нормализует поле после загрузки (старые сейвы без поля, мусор в localStorage)
export function ensureGems(save) {
  save.gems = gemsOf(save);
  if (!Array.isArray(save.gemTokens)) save.gemTokens = [];
  return save.gems;
}
export function addGems(save, n) { n = Math.floor(n); if (!(n > 0)) return false; save.gems = gemsOf(save) + n; return true; }
export function spendGems(save, n) { if (!(n > 0) || gemsOf(save) < n) return false; save.gems = gemsOf(save) - n; return true; }
// Зачисление купленного пакета. token — purchaseToken площадки: один и тот же токен второй раз не зачисляется
// (защита от двойного начисления, если consumePurchase не дошёл до площадки и покупку «досыпают» при следующем старте).
export function grantPurchase(save, n, token) {
  ensureGems(save);
  if (token) { if (save.gemTokens.includes(token)) return false; save.gemTokens.push(token); if (save.gemTokens.length > 40) save.gemTokens.shift(); }
  return addGems(save, n);
}
// «1 страз, 2 страза, 5 стразов»
export function gemWord(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? 'стразов' : b === 1 ? 'страз' : b >= 2 && b <= 4 ? 'страза' : 'стразов';
}

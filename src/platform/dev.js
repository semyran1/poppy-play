// Адаптер для проверки: ?dev=1 на локальном хосте. Пакеты стразов зачисляются сразу и бесплатно, на кнопках «ТЕСТ».
// Реальных платежей нет; на публичных хостах не включается (см. DEV_HOSTS в index.js).
import { PRODUCTS, PRODUCT, CURRENCY } from './products.js';
export function createDev() {
  let host = {};
  return {
    name: 'dev',
    async init(h) { host = h || {}; },
    payments: {
      available: true,
      products: () => PRODUCTS.map(p => ({ ...p, priceText: `${p.price} ${CURRENCY}` })),
      async buy(id) {
        const p = PRODUCT[id]; if (!p) return { ok: false, error: 'unknown product' };
        await new Promise(r => setTimeout(r, 250));   // как настоящее окно оплаты: короткая пауза «Загрузка…»
        host.grant?.(p.gems);
        return { ok: true, gems: p.gems };
      },
      restore: async () => ({ gems: 0 }),
    },
  };
}

// Адаптер по умолчанию (обычный браузер, itch, локальный запуск без ?dev=1): покупок нет, кнопки «скоро».
import { PRODUCTS, CURRENCY } from './products.js';
export function createNone() {
  return {
    name: 'none',
    async init() { },
    payments: {
      available: false,
      products: () => PRODUCTS.map(p => ({ ...p, priceText: `${p.price} ${CURRENCY}` })),   // показать, что будет; купить нельзя
      buy: async () => ({ ok: false, error: 'unavailable' }),
      restore: async () => ({ gems: 0 }),
    },
  };
}

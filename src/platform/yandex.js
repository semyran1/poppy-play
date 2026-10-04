// Яндекс Игры: покупки стразов (расходуемые товары).
//
// !!! UNTESTED !!! Написано по документации, но НЕ запускалось: SDK работает только внутри iframe площадки, а черновика
// с товарами в Консоли пока нет. Перед публикацией проверить на черновике в «Консоли»:
//   1) в Консоли → «Инап-покупки» завести 4 товара с id gems_50 / gems_120 / gems_300 / gems_700 и ценами из products.js;
//   2) подключить SDK: <script src="/sdk.js"></script> в index.html (путь относительный; в локальной сборке файла нет,
//      поэтому тег добавляет сборка для Яндекса, а в index.html он не лежит);
//   3) купить каждый пакет, убедиться, что стразы пришли, а getPurchases() потом пуст (покупка «погашена»);
//   4) закрыть вкладку на окне оплаты / оборвать сеть и проверить, что зависшая покупка дозачисляется при следующем старте.
//
// Документация (проверено 2026-10-04): https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases
//   YaGames.init() → ysdk; ysdk.getPayments({ signed }) → payments;
//   payments.getCatalog() → [{ id, title, description, imageURI, price, priceValue, priceCurrencyCode, getPriceCurrencyImage(size) }];
//   payments.purchase({ id, developerPayload }) → { productID, purchaseToken, developerPayload };
//   payments.getPurchases() → [{ productID, purchaseToken, ... }];  payments.consumePurchase(purchaseToken).
// Расходуемый товар: purchase → СНАЧАЛА выдать, ПОТОМ consumePurchase; при старте обработать getPurchases() (п. 1.13.1, обязательно).
// Требование 1.13.2: название и иконка валюты — из SDK (priceCurrencyCode, getPriceCurrencyImage), поэтому для Яндекса
// products() берёт цену из каталога, а таблица products.js даёт только id и количество стразов.
//
// signed: false. Режим { signed: true } возвращает не объекты, а подпись «<base64_sign>.<base64_json>», которую нужно проверять
// на сервере секретным ключом; своего сервера нет, поэтому клиентский режим. Подделка клиента даст только стразы (косметика,
// на силу не влияют): для этой игры приемлемо. Если появится сервер, переключить на signed и проверять подпись там.
import { PRODUCTS, PRODUCT } from './products.js';

export function createYandex(g = globalThis) {
  let ysdk = null, pay = null, host = {}, catalog = null, busy = false;
  const icons = {};   // id -> HTMLImageElement иконки валюты из SDK
  const A = {
    name: 'yandex',
    get sdk() { return ysdk; },
    async init(h) {
      host = h || {};
      ysdk = await g.YaGames.init();
      pay = await ysdk.getPayments({ signed: false });   // бросает, если покупки не подключены в Консоли → available остаётся false
      try { catalog = await pay.getCatalog(); } catch (e) { catalog = []; console.warn('[yandex] getCatalog:', e); }
      for (const c of catalog) {
        if (!PRODUCT[c.id] || typeof c.getPriceCurrencyImage !== 'function') continue;
        const img = new Image(); img.src = c.getPriceCurrencyImage('small'); icons[c.id] = img;
      }
      A.payments.available = catalog.some(c => PRODUCT[c.id]);
      await A.payments.restore();   // дозачесть прошлые покупки при каждом запуске
    },
    payments: {
      available: false,
      // только товары, которые есть и у нас, и в Консоли (список в игре = вкладка «Инап-покупки», п. 1.13.4)
      products: () => PRODUCTS.filter(p => catalog?.some(c => c.id === p.id)).map(p => {
        const c = catalog.find(x => x.id === p.id), img = icons[p.id];
        return { ...p, price: +c.priceValue || p.price, priceText: img ? String(c.priceValue) : c.price, icon: img || null };
      }),
      async buy(id) {
        const p = PRODUCT[id]; if (!pay || !p) return { ok: false, error: 'unavailable' };
        if (busy) return { ok: false, error: 'busy' };
        busy = true;
        try {
          const purchase = await pay.purchase({ id });
          host.grant?.(p.gems, purchase.purchaseToken);             // 1) выдать (и записать в сохранение)
          await pay.consumePurchase(purchase.purchaseToken);        // 2) погасить; если упало — дозачисление отсечёт токен
          return { ok: true, gems: p.gems };
        } catch (e) {
          return { ok: false, error: String(e?.message || e || 'purchase failed') };   // отмена игроком тоже сюда
        } finally { busy = false; }
      },
      // Незавершённые покупки (оплата прошла, а игра закрылась до выдачи или до consume)
      async restore() {
        if (!pay) return { gems: 0 };
        let gems = 0;
        try {
          for (const pu of await pay.getPurchases()) {
            const p = PRODUCT[pu.productID]; if (!p) continue;
            if (host.grant?.(p.gems, pu.purchaseToken)) gems += p.gems;
            try { await pay.consumePurchase(pu.purchaseToken); } catch (e) { console.warn('[yandex] consume:', e); }
          }
        } catch (e) { console.warn('[yandex] restore:', e); }
        return { gems };
      },
    },
  };
  return A;
}

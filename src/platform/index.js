// Слой платформы: игра знает только этот интерфейс, а не конкретный SDK.
//   platform.name                          'none' | 'dev' | 'yandex'
//   platform.init(host)                    один раз при старте (main.js); падение адаптера игру не ломает
//   platform.payments.available            можно ли покупать (в 'none' — нет: кнопки «скоро»)
//   platform.payments.products()           [{ id, gems, price, priceText, icon? }] — что показывать в окне «Пополнить стразы»
//   platform.payments.buy(id)              Promise<{ ok, gems?, error? }>; зачисление делает host.grant (см. ниже)
//   platform.payments.restore?()           Promise<{ gems }>: донести незавершённые покупки (Яндекс: обязательно при старте)
//   platform.onGameplayStart() / Stop()    пока пустые (позже GameplayAPI: старт и пауза геймплея)
// host = { grant(gems, token?) → bool } — зачисляет стразы в сохранение и пишет его; адаптер зовёт grant ДО
// consumePurchase (сначала выдать, потом «погасить» покупку — так требует Яндекс), а игра дальше только рисует эффект.
// Выбор адаптера (selectAdapter): Яндекс Игры (есть window.YaGames) → 'yandex'; иначе ?dev=1 на локальном хосте → 'dev';
// иначе 'none'. Платёжный код не вызывается, пока игрок не нажал кнопку, кроме одного init (и restore в нём) при старте.
import { createNone } from './none.js';
import { createDev } from './dev.js';
import { createYandex } from './yandex.js';

// 'dev' раздаёт стразы бесплатно, поэтому только на локальных хостах (иначе ?dev=1 на публичной странице = читы)
const DEV_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/;

export function selectAdapter(g = globalThis) {
  if (g.YaGames) return createYandex(g);
  const loc = g.location;
  if (loc && new URLSearchParams(loc.search).get('dev') === '1' && DEV_HOSTS.test(loc.hostname || '')) return createDev();
  return createNone();
}

export const platform = {
  name: 'none',
  payments: { available: false, products: () => [], buy: async () => ({ ok: false, error: 'unavailable' }) },
  sdk: null,
  async init(host = {}) {
    try {
      const a = selectAdapter();
      this.name = a.name; this.payments = a.payments;
      await a.init?.(host);
      this.sdk = a.sdk || null;
    } catch (e) {
      console.warn('[platform] init failed:', e);   // игра идёт дальше; если покупки не поднялись — available остаётся false
    }
    return this;
  },
  onGameplayStart() { }, onGameplayStop() { },
};

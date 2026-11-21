import { getCfg } from './bridge.ts';

class CurrencyStore {
  curIndex = $state<number>(0);
  revision = $state<number>(0);

  get currencies(): SteamToolsCurrency[] {
    return typeof window !== 'undefined' && window.STEAMTOOLS_CONFIG
      ? window.STEAMTOOLS_CONFIG.CURRENCY_DATA
      : [{ name: 'USD', symbolFormat: '$', right: false, ratio: 1.0 }];
  }

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.curIndex = getCfg().getSavedCurIndex();
      void getCfg()
        .loadCurrencyRates(null)
        .then((res) => {
          if (res && res.updated > 0) {
            this.revision += 1;
          }
        })
        .catch(() => {});
    } catch {
      this.curIndex = 0;
    }

    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === 'curIndex') {
        try {
          this.curIndex = getCfg().getSavedCurIndex();
        } catch {
          this.curIndex = 0;
        }
      }
    });
  }

  setCurrency(idx: number): void {
    const list = this.currencies;
    const safeIdx = Number.isInteger(idx) && idx >= 0 && idx < list.length ? idx : 0;
    this.curIndex = safeIdx;
    try {
      window.localStorage.setItem('curIndex', String(safeIdx));
    } catch {
      // Ignore storage quota / privacy errors
    }
  }

  formatUsd(
    usdValue: number | string | null | undefined,
    opts?: { noCurrency?: boolean; noApprox?: boolean },
  ): string {
    // Depend on revision so views re-format once live rates arrive
    void this.revision;
    if (typeof window !== 'undefined' && window.STEAMTOOLS_CONFIG) {
      return window.STEAMTOOLS_CONFIG.formatPriceUsd(usdValue, this.curIndex, opts);
    }
    const n = Number(usdValue);
    if (!Number.isFinite(n)) return 'N/A';
    return opts?.noCurrency ? n.toFixed(2) : `$${n.toFixed(2)}`;
  }
}

export const currencyStore = new CurrencyStore();

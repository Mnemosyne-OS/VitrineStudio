/**
 * The site's currency, and other currencies shown beside a price as an
 * approximation (Tony: « prévois le change de devise dans les settings,
 * accepte plusieurs devises, si possible un connecteur de change »).
 *
 * Prices are typed in the site's currency and never converted on disk. The
 * others are shown only with a rate the person fetched (the European Central
 * Bank's, through Frankfurter: free, no key) or typed, and always as « ≈ ».
 * Rates are fetched on her click, never on their own.
 */

/** The currencies the ECB publishes a rate for (Frankfurter serves these). */
export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const ALSO_MAX = 3;

export interface CurrencySettings {
  /** The currency prices are typed in. */
  main: Currency;
  /** Shown beside a price, approximated with `rates`. */
  also: Currency[];
  /** One unit of `main` in each other currency, and the day the rates are from. */
  rates?: { date: string; values: Partial<Record<Currency, number>> };
}

export const DEFAULT_CURRENCY: CurrencySettings = { main: 'EUR', also: [] };

const isCurrency = (v: unknown): v is Currency => CURRENCIES.includes(v as Currency);

export function normalizeCurrency(raw: unknown): CurrencySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const main = isCurrency(r.main) ? r.main : 'EUR';
  const also = [...new Set((Array.isArray(r.also) ? r.also : []).filter(isCurrency))].filter((c) => c !== main).slice(0, ALSO_MAX);
  const out: CurrencySettings = { main, also };
  const rates = r.rates as Record<string, unknown> | undefined;
  if (rates && typeof rates.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rates.date) && rates.values && typeof rates.values === 'object') {
    const values: Partial<Record<Currency, number>> = {};
    for (const [k, v] of Object.entries(rates.values as Record<string, unknown>)) {
      if (isCurrency(k) && k !== main && typeof v === 'number' && Number.isFinite(v) && v > 0) values[k] = v;
    }
    if (Object.keys(values).length) out.rates = { date: rates.date, values };
  }
  return out;
}

/** A price as the site writes it, in the page's language. */
export function formatMoney(amount: number, lang: string, currency: Currency): string {
  return new Intl.NumberFormat(lang, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

/** The price in each other currency that has a rate, rounded to a whole unit, always marked approximate. */
export function approximations(amount: number, lang: string, c: CurrencySettings): string[] {
  return c.also.flatMap((code) => {
    const rate = c.rates?.values[code];
    return rate ? [`≈ ${formatMoney(Math.round(amount * rate), lang, code)}`] : [];
  });
}

/** The symbol of a currency in a language ("€", "CHF", "$"), for a field's hint. */
export function currencySymbol(currency: Currency, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

export const RATES_URL = 'https://api.frankfurter.dev/v1/latest';

/**
 * Today's rates from `main` to the other currencies (ECB, through
 * Frankfurter). Throws a named error: no network, a refusal, an answer that
 * is not rates. 15 s at most.
 */
export async function fetchRates(main: Currency, also: Currency[], fetchImpl: typeof fetch = fetch): Promise<NonNullable<CurrencySettings['rates']>> {
  if (!also.length) throw new Error('RATES_NONE_ASKED');
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 15_000);
  try {
    const res = await fetchImpl(`${RATES_URL}?from=${main}&to=${also.join(',')}`, { signal: stop.signal });
    if (!res.ok) throw new Error(`RATES_REFUSED: HTTP ${res.status}`);
    const body = (await res.json()) as { date?: unknown; rates?: unknown };
    const out = normalizeCurrency({ main, also, rates: { date: body.date, values: body.rates } }).rates;
    if (!out) throw new Error('RATES_UNREADABLE');
    return out;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('RATES_TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

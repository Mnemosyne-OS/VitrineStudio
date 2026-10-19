import { approximations, currencySymbol, fetchRates, formatMoney, normalizeCurrency, RATES_URL } from './currency';
import { buildSiteData, type Brand } from '../site/buildSite';
import type { Piece, Scene } from './types';

describe('the site currency', () => {
  it('writes a price in the site currency and language', () => {
    expect(formatMoney(45, 'fr', 'EUR')).toBe(new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(45));
    expect(formatMoney(45, 'fr', 'CHF')).toContain('CHF');
    expect(currencySymbol('EUR', 'fr')).toBe('€');
  });

  it('shows another currency only with a rate, rounded, always marked approximate', () => {
    const c = normalizeCurrency({ main: 'EUR', also: ['CHF', 'USD'], rates: { date: '2026-10-09', values: { CHF: 0.9313 } } });
    const out = approximations(45, 'fr', c);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^≈ /);
    expect(out[0]).toContain('42');
  });

  it('reads back only known currencies, never the site currency as another, at most three, sane rates', () => {
    const c = normalizeCurrency({ main: 'CHF', also: ['CHF', 'EUR', 'XXX', 'USD', 'GBP', 'JPY'], rates: { date: '2026-10-09', values: { EUR: 1.07, USD: -1, CHF: 1, BAD: 2 } } });
    expect(c.main).toBe('CHF');
    expect(c.also).toEqual(['EUR', 'USD', 'GBP']);
    expect(c.rates).toEqual({ date: '2026-10-09', values: { EUR: 1.07 } });
    expect(normalizeCurrency({ main: 'ZZZ' }).main).toBe('EUR');
    expect(normalizeCurrency({ rates: { date: 'yesterday', values: { CHF: 1 } } }).rates).toBeUndefined();
  });

  it('fetches the ECB rates from the site currency, and names a failure', async () => {
    const calls: string[] = [];
    const ok = (async (url: string) => { calls.push(url); return new Response(JSON.stringify({ date: '2026-10-09', rates: { CHF: 0.93 } })); }) as unknown as typeof fetch;
    expect(await fetchRates('EUR', ['CHF'], ok)).toEqual({ date: '2026-10-09', values: { CHF: 0.93 } });
    expect(calls[0]).toBe(`${RATES_URL}?from=EUR&to=CHF`);
    // From the site's own currency: a Swiss site asks for francs to euros.
    await fetchRates('CHF', ['EUR', 'USD'], (async (url: string) => { calls.push(url); return new Response(JSON.stringify({ date: '2026-10-09', rates: { EUR: 1.07 } })); }) as unknown as typeof fetch);
    expect(calls[1]).toBe(`${RATES_URL}?from=CHF&to=EUR,USD`);
    const refused = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchRates('EUR', ['CHF'], refused)).rejects.toThrow(/RATES_REFUSED/);
    const garbage = (async () => new Response(JSON.stringify({ hello: 1 }))) as unknown as typeof fetch;
    await expect(fetchRates('EUR', ['CHF'], garbage)).rejects.toThrow(/RATES_UNREADABLE/);
    await expect(fetchRates('EUR', [], ok)).rejects.toThrow(/RATES_NONE_ASKED/);
  });

  it('puts the price and its approximations on the Creations page, only where the price is shown', () => {
    const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'A', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
    const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/p.jpg', price: 100 };
    const scene: Scene = { schema: 1, id: 's1', pieceId: 'p1', universe: 'Salon', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9', images: { place: 'C:/a.png' }, validated: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '' };
    const currency = normalizeCurrency({ main: 'CHF', also: ['EUR'], rates: { date: '2026-10-09', values: { EUR: 1.07 } } });
    const make = (price: boolean) => buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [scene], pieces: [piece], currency, showcase: { p1: { photos: [], show: { name: true, description: true, dimensions: false, weight: false, price, photos: false } } } }).creations[0]!;
    expect(make(true).price).toContain('CHF');
    expect(make(true).priceAlso).toEqual([`≈ ${formatMoney(107, 'fr', 'EUR')}`]);
    expect(make(false).priceAlso).toBeUndefined();
  });
});

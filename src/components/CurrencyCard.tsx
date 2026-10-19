import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { ALSO_MAX, CURRENCIES, fetchRates, type Currency, type CurrencySettings } from '../model/currency';
import { describeError, errorText } from './errors';

/**
 * The site's currency, other currencies shown beside a price as « ≈ », and
 * the rates for them, fetched on a click from the European Central Bank.
 */
export function CurrencyCard({ currency, onChange }: { currency: CurrencySettings; onChange: (next: CurrencySettings) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);

  // A new site currency: the rates were from the old one, so they go.
  const setMain = (main: Currency) => onChange({ main, also: currency.also.filter((c) => c !== main) });
  const toggleAlso = (c: Currency) => {
    const also = currency.also.includes(c) ? currency.also.filter((x) => x !== c) : [...currency.also, c].slice(0, ALSO_MAX);
    onChange({ ...currency, also });
  };
  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange({ ...currency, rates: await fetchRates(currency.main, currency.also) });
    } catch (err) {
      console.warn('[vitrine-studio] the exchange rates were not fetched:', err);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const missing = currency.also.filter((c) => !currency.rates?.values[c]);

  return (
    <div className="glass card-pad">
      <h3>{t('currency.title')}</h3>
      <span className="small muted">{t('currency.main')}</span>
      <div className="idea-row compact">
        {CURRENCIES.map((c) => (
          <button key={c} className={`chip-tile glass ${currency.main === c ? 'chosen' : ''}`} onClick={() => setMain(c)}><strong>{c}</strong></button>
        ))}
      </div>
      <span className="small muted">{t('currency.also')}</span>
      <div className="idea-row compact">
        {CURRENCIES.filter((c) => c !== currency.main).map((c) => (
          <button key={c} className={`chip-tile glass ${currency.also.includes(c) ? 'chosen' : ''}`} aria-pressed={currency.also.includes(c)}
            disabled={!currency.also.includes(c) && currency.also.length >= ALSO_MAX} onClick={() => toggleAlso(c)}><strong>{c}</strong></button>
        ))}
      </div>
      {currency.also.length > 0 && (
        <div className="row spaced">
          <button onClick={() => void update()} disabled={busy}>
            {busy ? <span className="spinner small-spin" aria-hidden /> : <RefreshCw className="ico" aria-hidden />}{t('currency.update')}
          </button>
          <span className="small muted">
            {currency.rates ? t('currency.ratesFrom', { date: new Date(`${currency.rates.date}T12:00:00`).toLocaleDateString() }) : t('currency.noRates')}
            {currency.rates && missing.length > 0 && ` · ${t('currency.missing', { codes: missing.join(', ') })}`}
          </span>
        </div>
      )}
      {error && <p className="error small">{errorText(error)}</p>}
    </div>
  );
}

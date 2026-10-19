import { getLanguage, translate } from './i18n';

/**
 * A weight as people read it: megabytes from 1 MB, kilobytes under it (a
 * rounded "0 MB" would say nothing). Decimal units, like the weight limits
 * the person picks.
 */
export function formatWeight(bytes: number): string {
  const lang = getLanguage();
  if (bytes >= 1_000_000) return translate('weight.mb', { n: (bytes / 1_000_000).toLocaleString(lang, { maximumFractionDigits: 1 }) });
  // A measured zero (a site with no clip) is said as zero; a few bytes round up to 1, never down to nothing.
  return translate('weight.kb', { n: (bytes === 0 ? 0 : Math.max(1, Math.round(bytes / 1_000))).toLocaleString(lang) });
}

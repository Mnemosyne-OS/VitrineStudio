import { setLangMode } from './i18n';
import { formatWeight } from './format';

describe('formatWeight', () => {
  it('says a measured zero as zero, a few bytes as 1 KB, and megabytes from 1 MB', () => {
    setLangMode('fr');
    expect(formatWeight(0)).toBe('0 Ko');
    expect(formatWeight(400)).toBe('1 Ko');
    expect(formatWeight(250_000)).toBe('250 Ko');
    expect(formatWeight(1_500_000)).toBe('1,5 Mo');
  });
});

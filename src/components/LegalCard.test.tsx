import { fireEvent, render } from '@testing-library/react';
import { RichText } from './RichText';
import { legalMarkdown, sameAsFields } from '../site/legalPages';
import { EMPTY_LEGAL, VERCEL_HOST } from '../model/legal';

const full = { ...EMPTY_LEGAL, owner: 'Claire L.', status: 'Micro-entrepreneur (EI)', siret: '123 456 789 00012', address: '3 rue des Potiers\n13000 Marseille', ...VERCEL_HOST };
const site = { name: 'Atelier', email: 'deb-ora@ex.fr', formspree: true, form: true, socials: true, lang: 'fr' as const, staged: true };

describe('a legal page opened in the editor and left untouched', () => {
  it.each(['notice', 'privacy'] as const)('reads as the fields’ %s page once left untouched: it keeps following them', (page) => {
    const onChange = vi.fn();
    const { container } = render(<RichText value={legalMarkdown(full, site)[page]} onChange={onChange} label="x" />);
    const editable = container.querySelector('[contenteditable]')!;
    fireEvent.focus(editable);
    fireEvent.blur(editable);
    // The editor may write it back in its own way; it must still read as the fields' page.
    const back = onChange.mock.calls[0]?.[0] as string | undefined;
    if (back !== undefined) expect(sameAsFields(back, legalMarkdown(full, site)[page])).toBe(true);
  });
  it('tells a real change apart', () => {
    const made = legalMarkdown(full, site).notice;
    expect(sameAsFields(`${made}

Une ligne de plus.`, made)).toBe(false);
  });
});

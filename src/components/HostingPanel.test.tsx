import { fireEvent, render, screen } from '@testing-library/react';
import { HostingPanel } from './HostingPanel';
import { normalizeSiteSettings } from '../model/records';
import type { useHosting } from '../hooks/useHosting';
import type { SiteSettings } from '../site/buildSite';

type Hosting = ReturnType<typeof useHosting>;

const connected: SiteSettings = { ...normalizeSiteSettings({ siteId: 's1', siteName: 'site', projectName: 'atelier', brand: { name: 'Atelier' } }, ''), lastPublish: { url: 'https://x.vercel.app', aliases: [], readyState: 'READY', at: '2026-10-11T10:00:00Z' } };
const token = { present: true, savedAt: 1, seal: 'sealed' };

function host(over: Partial<Hosting> = {}): Hosting {
  return {
    hosting: { kind: 'ready', data: { project: 'atelier', analytics: true, analyticsUrl: 'https://vercel.com/d?to=x', domains: [] } },
    traffic: { kind: 'idle' }, span: 30, setSpan: vi.fn(), refresh: vi.fn(), busyDomain: null, domainError: null,
    addDomain: vi.fn().mockResolvedValue(true), removeDomain: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

function panel(settings = connected, h = host(), onSave = vi.fn(), onOpen = vi.fn()) {
  render(<HostingPanel settings={settings} token={token} work={{ kind: 'idle' }} canExport host={h}
    onSave={onSave} onChooseFolder={vi.fn()} onSetToken={vi.fn()} onRemoveToken={vi.fn()} onExport={vi.fn()} onPublish={vi.fn()} onOpen={onOpen} />);
  return { onSave, onOpen };
}

describe('the Hosting tab', () => {
  it('shows a domain that does not point at Vercel yet with the records to write, as Vercel gave them', () => {
    panel(connected, host({ hosting: { kind: 'ready', data: { project: 'atelier', analytics: true, analyticsUrl: 'u', domains: [
      { name: 'atelier.fr', verified: true, configured: false, records: [{ type: 'A', host: '@', value: '76.76.21.99' }] },
      { name: 'www.atelier.fr', verified: true, configured: true, records: [] },
    ] } } }));
    expect(screen.getByText('76.76.21.99')).toBeTruthy();
    expect(screen.getByText('To set at your registrar')).toBeTruthy();
    // Exactly the own address and the configured domain read as online.
    expect(screen.getAllByText(/Online/)).toHaveLength(2);
  });

  it('removes a domain only on the second press', () => {
    const h = host({ hosting: { kind: 'ready', data: { project: 'atelier', analytics: true, analyticsUrl: 'u', domains: [{ name: 'atelier.fr', verified: true, configured: true, records: [] }] } } });
    panel(connected, h);
    fireEvent.click(screen.getByLabelText('Remove'));
    expect(h.removeDomain).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Remove? Click again'));
    expect(h.removeDomain).toHaveBeenCalledWith('atelier.fr');
  });

  it('turns the counter on as a site setting, then asks for an update while the site online does not carry it', () => {
    const { onSave } = panel();
    fireEvent.click(screen.getByText('Count visits'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ analytics: true }));
    expect(screen.queryByText('The site needs an update to apply this choice.')).toBeNull();
  });

  it('says what is still to do once counting: the update, and Vercel’s own switch', () => {
    panel({ ...connected, analytics: true }, host({ hosting: { kind: 'ready', data: { project: 'atelier', analytics: false, analyticsUrl: 'https://vercel.com/d?to=x', domains: [] } } }));
    expect(screen.getByText('The site needs an update to apply this choice.')).toBeTruthy();
    expect(screen.getByText('Turn it on in Vercel too')).toBeTruthy();
  });

  it('asks for an update when the counter is turned off too: the site online still carries it', () => {
    panel({ ...connected, analytics: false, lastPublish: { ...connected.lastPublish!, analytics: true } });
    expect(screen.getByText('The site needs an update to apply this choice.')).toBeTruthy();
  });

  it('does not print Vercel’s refusal under the switch Vercel says is off', () => {
    panel({ ...connected, analytics: true }, host({
      hosting: { kind: 'ready', data: { project: 'atelier', analytics: null, analyticsUrl: 'u', domains: [] } },
      traffic: { kind: 'error', error: { key: 'error.TOKEN_REFUSED' } },
    }));
    expect(screen.getByText('Turn it on in Vercel too')).toBeTruthy();
    expect(screen.queryByText(/refused/i)).toBeNull();
  });

  it('keeps a part of the visits not read apart from a part read empty', () => {
    panel({ ...connected, analytics: true, lastPublish: { ...connected.lastPublish!, analytics: true } }, host({ traffic: { kind: 'ready', data: {
      days: 30, since: '2026-09-12', until: '2026-10-11', daily: [{ day: '2026-10-11', visitors: 3, pageviews: 5 }], referrers: null, countries: [], errors: ['referrerHostname: TOKEN_REFUSED'],
    } } }));
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Not read')).toBeTruthy();
    expect(screen.getByText('Nothing yet')).toBeTruthy();
  });
});

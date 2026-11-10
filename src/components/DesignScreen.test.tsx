import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DesignScreen } from './DesignScreen';
import type { DesignDraft } from '../model/design';
import { normalizeSiteSettings } from '../model/records';
import type { DesignPart } from '../model/spaces';
import { DESIGN_PICKED, withDesignPicking } from '../site/preview';

// The logo's panel reads a picture through the host: not what is tested here.
vi.mock('../data/host', async (orig) => ({ ...(await orig<typeof import('../data/host')>()), readImage: async () => '', readMedia: async () => '' }));

// jsdom measures nothing: the stage's size watcher has nothing to tell.
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
// Nor does it scroll, or hold a page in memory.
Element.prototype.scrollIntoView = () => {};
URL.revokeObjectURL = () => {};

const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' } }, '');

function Harness({ onKeep, make }: { onKeep: (draft: DesignDraft) => Promise<boolean>; make?: () => Promise<string> }) {
  const [draft, setDraft] = useState<DesignDraft>({});
  const [part, setPart] = useState<DesignPart>('details');
  return (
    <DesignScreen stepWords={{ place: "Place", piece: "Piece", alive: "Alive" }} site={site} draft={draft} onDraft={setDraft} onKeep={() => onKeep(draft)} onMeasured={() => {}} part={part} onPart={setPart}
      make={make ?? (() => new Promise<string>(() => {}))} demoPhotos={[]} themeSample={{ name: 'Atelier Rosalie', menu: ['Créations', 'À propos', 'Contact'], title: 'Créations', photos: [] }} onlineCount={1} enlarged={0} busy={false} onCheck={() => {}} checking={false} />
  );
}

const tick = () => act(async () => { await Promise.resolve(); });

describe('the Design screen', () => {
  it('a setting changed is tried, not written: the bar counts it and offers to keep or drop it', async () => {
    const onKeep = vi.fn(async () => true);
    render(<Harness onKeep={onKeep} />);
    expect(screen.queryByRole('button', { name: /keep|garder|guardar/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /device|appareil|dispositivo/i }));
    expect(onKeep).not.toHaveBeenCalled();
    expect(document.querySelector('.design-trial.on')?.textContent).toMatch(/^1 /);
    // The same setting put back: nothing is tried any more.
    fireEvent.click(screen.getByRole('button', { name: /always light|toujours clair|siempre claro/i }));
    expect(document.querySelector('.design-trial.on')).toBeNull();
  });

  it('« Keep » writes the trial and empties it; a refused write keeps the trial', async () => {
    const onKeep = vi.fn(async (_tried: DesignDraft) => false);
    render(<Harness onKeep={onKeep} />);
    fireEvent.click(screen.getByRole('button', { name: /device|appareil|dispositivo/i }));
    fireEvent.click(screen.getByRole('button', { name: /^(keep|garder|guardar)$/i }));
    await tick();
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onKeep.mock.calls[0]![0]).toMatchObject({ look: { dark: 'auto' } });
    // Refused: still tried, still offered.
    expect(document.querySelector('.design-trial.on')).not.toBeNull();
    onKeep.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: /^(keep|garder|guardar)$/i }));
    await tick();
    expect(document.querySelector('.design-trial.on')).toBeNull();
  });

  it('« Drop » brings the site back as it is kept', () => {
    render(<Harness onKeep={async () => true} />);
    fireEvent.click(screen.getByRole('button', { name: /device|appareil|dispositivo/i }));
    fireEvent.click(screen.getByRole('button', { name: /drop|annuler|descartar/i }));
    expect(document.querySelector('.design-trial.on')).toBeNull();
    expect(screen.getByRole('button', { name: /always light|toujours clair|siempre claro/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a click on a part of the site opens the part of the panel that sets it', async () => {
    vi.useFakeTimers();
    try {
      render(<Harness onKeep={async () => true} make={async () => 'blob:site'} />);
      // The page is made a moment after the screen opens.
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      const frame = document.querySelector<HTMLIFrameElement>('.design-stage iframe')!;
      expect(frame).not.toBeNull();
      const said = (data: unknown, source: unknown) => act(() => { window.dispatchEvent(new MessageEvent('message', { data, source: source as MessageEventSource })); });
      // Another window's message is not heard.
      said({ type: DESIGN_PICKED, target: 'logo' }, window);
      expect(document.querySelector('.design-parts .on')?.textContent).toMatch(/details|détails|detalles/i);
      said({ type: DESIGN_PICKED, target: 'logo' }, frame.contentWindow);
      expect(document.querySelector('.design-parts .on')?.textContent).toMatch(/identi/i);
      expect(document.querySelector('[data-card="logo"]')).toHaveClass('picked');
      // A part nobody knows changes nothing.
      said({ type: DESIGN_PICKED, target: 'nope' }, frame.contentWindow);
      expect(document.querySelector('.design-parts .on')?.textContent).toMatch(/identi/i);
    } finally { vi.useRealTimers(); }
  });
});

describe('the preview of the Design screen, when it cannot be made', () => {
  it('says so, with a way to ask again, and shows the page once it comes', async () => {
    vi.useFakeTimers();
    try {
      const make = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('READ_FAILED: C:/g/1a.png')).mockResolvedValue('blob:site');
      render(<Harness onKeep={async () => true} make={make} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(document.querySelector('.design-stage iframe')).toBeNull();
      fireEvent.click(screen.getByRole('alert').querySelector('button')!);
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(document.querySelector('.design-stage iframe')).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('a page that is not made after half a minute is given up on, and said', async () => {
    vi.useFakeTimers();
    try {
      render(<Harness onKeep={async () => true} make={() => new Promise<string>(() => {})} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(29_000); });
      expect(screen.queryByRole('alert')).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});

describe('the click-to-set layer of the preview', () => {
  it('is added before the page ends, names only the parts it was given words for, and escapes them', () => {
    const html = withDesignPicking('<html><body><p>site</p></body></html>', { logo: 'Logo </script><b>' }, '#3fa66a');
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('<p>site</p>'));
    expect(html.endsWith('</body></html>')).toBe(true);
    expect(html).toContain(DESIGN_PICKED);
    // Her words can never close the script they are written in.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('a colour that is not one never reaches the page\'s style', () => {
    expect(withDesignPicking('<body></body>', {}, 'red;}body{display:none')).not.toContain('display:none');
    expect(withDesignPicking('<body></body>', {}, ' rgb(63, 166, 106) ')).toContain('rgb(63, 166, 106)');
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TextPagePanel } from './TextPagePanel';
import { AboutPanel } from './AboutPanel';
import type { PageLayout } from '../model/pages';
import type { PageLook } from '../model/pageLook';
import { EMPTY_BRAND, type Brand } from '../site/buildSite';

// Pictures come through the host: not what is tested here.
vi.mock('../data/host', async (orig) => ({ ...(await orig<typeof import('../data/host')>()), readImage: async () => '', readMedia: async () => '', pickImage: async () => null }));

// jsdom measures nothing, and holds no page in memory.
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
URL.revokeObjectURL = () => {};

/** A text page whose layout is kept in state, as App keeps it in the site. */
function Page({ make, withStage = true, start = 'Bonjour' }: { make: () => Promise<string>; withStage?: boolean; start?: string }) {
  const [layout, setLayout] = useState<PageLayout>('right');
  const [look, setLook] = useState<PageLook | undefined>(undefined);
  const [text, setText] = useState(start);
  return (
    <TextPagePanel text={text} onText={setText} onPhoto={() => {}} layout={layout} look={look}
      onLayout={(l, k) => { setLayout(l); setLook(k); }} photoLabel="Photo"
      stage={withStage ? { make, page: 'p-atelier' } : undefined} />
  );
}

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const frame = () => document.querySelector<HTMLIFrameElement>('.design-stage iframe');

describe('a text page edited beside the real page', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the page as the site makes it, opened on the page being edited', async () => {
    const make = vi.fn(async () => 'blob:page');
    render(<Page make={make} />);
    await settle();
    expect(make).toHaveBeenCalledTimes(1);
    expect(frame()?.getAttribute('src')).toBe('blob:page#p-atelier');
  });

  it('a layout tile clicked makes the page again, a moment later, still on that page', async () => {
    let n = 0;
    const make = vi.fn(async () => `blob:page-${++n}`);
    render(<Page make={make} />);
    await settle();
    fireEvent.click(document.querySelectorAll('.look-tile')[0]!);
    // Not at once: a moment after the last change.
    expect(make).toHaveBeenCalledTimes(1);
    await settle();
    expect(make).toHaveBeenCalledTimes(2);
    expect(frame()?.getAttribute('src')).toBe('blob:page-2#p-atelier');
    // Its margin changed: made again.
    fireEvent.click(screen.getAllByRole('button', { pressed: false }).find((b) => b.closest('.look-fine'))!);
    await settle();
    expect(make).toHaveBeenCalledTimes(3);
  });

  it('a page that cannot be made says so, with a way to ask again', async () => {
    const make = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('READ_FAILED: C:/p.png')).mockResolvedValue('blob:page');
    render(<Page make={make} />);
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(frame()).toBeNull();
    fireEvent.click(screen.getByRole('alert').querySelector('button')!);
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(frame()?.getAttribute('src')).toBe('blob:page#p-atelier');
  });

  it('a page with no words yet says where it will show, and opens on itself once it has some', async () => {
    const make = vi.fn(async () => 'blob:page');
    render(<Page make={make} start="" />);
    await settle();
    // The site has no such page yet: the home is not shown under « your page ».
    expect(make).not.toHaveBeenCalled();
    expect(frame()).toBeNull();
    expect(document.querySelector('.page-edit-empty')?.textContent).toMatch(/few words|quelques mots|unas palabras/i);
  });

  it('without a stage, the editor stands alone and draws the arrangement itself', async () => {
    const make = vi.fn(async () => 'blob:page');
    render(<Page make={make} withStage={false} />);
    await settle();
    expect(make).not.toHaveBeenCalled();
    expect(document.querySelector('.design-stage')).toBeNull();
    expect(document.querySelector('.info-cols')).toHaveClass('about-right');
  });

  it('the About page opens on its own address on the site', async () => {
    const make = vi.fn(async () => 'blob:about');
    function About() {
      const [brand, setBrand] = useState<Brand>({ ...EMPTY_BRAND, about: 'Bonjour' });
      return <AboutPanel brand={brand} onBrand={(next) => setBrand((b) => ({ ...b, ...next }))} preview={make} />;
    }
    render(<About />);
    await settle();
    expect(frame()?.getAttribute('src')).toBe('blob:about#a-propos');
    // Its caption is on the page: changed, the page is made again.
    const caption = screen.getByRole('textbox', { name: /under the portrait|sous le portrait|bajo el retrato/i });
    fireEvent.change(caption, { target: { value: 'Moi' } });
    fireEvent.blur(caption);
    await settle();
    expect(make).toHaveBeenCalledTimes(2);
  });
});

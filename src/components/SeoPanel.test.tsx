import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SeoPanel } from './SeoPanel';
import { buildSiteData, type Brand, type SiteData } from '../site/buildSite';
import { withSeo } from '../site/seo';
import { defaultShow } from '../model/showcase';
import type { SeoSettings } from '../model/seo';
import type { Piece, Scene } from '../model/types';
import en from '../locales/en.json';

/** The interface's own English words: the tests read the screen as a person does. */
const L = (key: string) => (en as Record<string, string>)[key]!;

vi.mock('./Thumb', () => ({ Thumb: ({ alt }: { alt: string }) => <span>{alt}</span> }));

const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `V ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier', tagline: 'Grès', about: 'Dix ans de grès.', email: 'a@b.ch', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
const pieces = [piece('p1', { name: 'Vase cône', description: 'Haut.' }), piece('p2', { name: 'Bol' })];
const scenes = [scene('1'), scene('2', { pieceId: 'p2' })];
const show = { ...defaultShow(), show: { ...defaultShow().show, name: true, description: true } };
const dataOf = (seo: SeoSettings): SiteData => withSeo(buildSiteData({ brand, lang: 'fr', today: '', untitled: 'x', scenes, pieces, showcase: { p1: show, p2: show }, seo }), 'fr', seo, { address: '1 rue du Four' });

/** The panel on a site whose settings it really changes, as the studio mounts it. */
function Mounted({ start = {}, published = true, load, onSeo, onDescribe = async () => true }: { start?: SeoSettings; published?: boolean; load?: (seo: SeoSettings) => Promise<SiteData>; onSeo?: (s: SeoSettings) => void; onDescribe?: (p: Piece, text: string) => Promise<boolean> }) {
  const [seo, setSeo] = useState<SeoSettings>(start);
  return <SeoPanel seo={seo} lang="fr" published={published} hasSecondLanguage={false} pieces={pieces} onOpen={() => {}} onGo={() => {}} onDescribe={onDescribe}
    load={() => (load ? load(seo) : Promise.resolve(dataOf(seo)))}
    onChange={(update) => setSeo((cur) => { const next = update(cur); onSeo?.(next); return next; })} />;
}
const type = (el: HTMLElement, value: string) => { fireEvent.change(el, { target: { value } }); fireEvent.blur(el); };
const last = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.at(-1)![0] as SeoSettings;

describe('Site › Search', () => {
  it('says the site is being read, then shows each address as a search engine would', async () => {
    render(<Mounted start={{ origin: 'https://atelier.example' }} />);
    expect(screen.getAllByText(L('seo.loading')).length).toBeGreaterThan(0);
    await screen.findByText('Vase cône · Atelier');
    expect(screen.getByText(/atelier\.example\/creations\/vase-cone\//)).toBeInTheDocument();
    expect(screen.queryByText(L('seo.loading'))).toBeNull();
  });
  it('says it when the site cannot be read, and reads it again on demand', async () => {
    let fail = true;
    render(<Mounted load={(seo) => (fail ? Promise.reject(new Error('NO_FOLDER')) : Promise.resolve(dataOf(seo)))} />);
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    fail = false;
    fireEvent.click(screen.getByText(L('seo.retry')));
    await screen.findByText('Vase cône · Atelier');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('lists what is still missing and nothing else', async () => {
    render(<Mounted />);
    await screen.findByText('Vase cône · Atelier');
    expect(screen.getByText(L('seo.todo.origin'))).toBeInTheDocument();
    expect(screen.getByText(L('seo.todo.bare.one'), { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(L('seo.todo.tagline'), { exact: false })).toBeNull();
    expect(screen.queryByText(L('seo.todo.address'), { exact: false })).toBeNull();
  });
  it('keeps a choice sparse: the starting value removes the key', async () => {
    const onSeo = vi.fn();
    render(<Mounted onSeo={onSeo} />);
    const closed = screen.getAllByText(L('seo.closed'));
    fireEvent.click(closed[1]!);
    expect(last(onSeo)).toEqual({ aiBots: 'closed' });
    fireEvent.click(screen.getAllByText(L('seo.open'))[1]!);
    expect(last(onSeo)).toEqual({});
  });
  it('leaves the old addresses behind when a word of a sent site changes, the page and what is under it', async () => {
    const onSeo = vi.fn();
    render(<Mounted onSeo={onSeo} />);
    await screen.findByText('Vase cône · Atelier');
    type(screen.getByLabelText(`${L('seo.words.label')} · ${L('seo.words.creations')}`), 'Céramiques !');
    expect(last(onSeo).words).toEqual({ creations: 'ceramiques' });
    expect(last(onSeo).redirects).toEqual([{ from: 'creations/', id: 'creations' }, { from: 'creations/vase-cone/', id: 'c:p1' }, { from: 'creations/bol/', id: 'c:p2' }]);
  });
  it('leaves no redirect behind on a site never sent, and none for the language’s own word', async () => {
    const onSeo = vi.fn();
    render(<Mounted published={false} onSeo={onSeo} />);
    await screen.findByText('Vase cône · Atelier');
    type(screen.getByLabelText(`${L('seo.words.label')} · ${L('seo.words.about')}`), 'atelier');
    expect(last(onSeo)).toEqual({ words: { about: 'atelier' } });
    type(screen.getByLabelText(`${L('seo.words.label')} · ${L('seo.words.about')}`), 'a-propos');
    expect(last(onSeo)).toEqual({});
  });
  it('refuses an address or a code that is not one, and says so', async () => {
    const onSeo = vi.fn();
    render(<Mounted onSeo={onSeo} />);
    type(screen.getByLabelText(L('seo.address.field')), 'pas une adresse');
    expect(screen.getByText(L('seo.address.bad'))).toBeInTheDocument();
    expect(onSeo).not.toHaveBeenCalled();
    type(screen.getByLabelText(L('seo.address.field')), 'atelier.example/x');
    expect(last(onSeo)).toEqual({ origin: 'https://atelier.example', originOwn: true });
    // Emptied, hers goes whole: the host's reading comes back by itself, never hers shown as the host's.
    type(screen.getByLabelText(L('seo.address.field')), '');
    expect(last(onSeo)).toEqual({});
    type(screen.getByLabelText(L('seo.google.field')), '<b>');
    expect(screen.getByText(L('seo.google.bad'))).toBeInTheDocument();
    expect(last(onSeo).verification).toBeUndefined();
  });
  it('writes her own title for one page, and takes it back when emptied', async () => {
    const onSeo = vi.fn();
    render(<Mounted onSeo={onSeo} />);
    await screen.findByText('Bol · Atelier');
    fireEvent.click(screen.getAllByText(L('seo.pages.edit')).at(-1)!);
    type(screen.getByLabelText(L('seo.pages.pageTitle')), '  Bol à thé  en grès ');
    expect(last(onSeo).meta).toEqual({ 'c:p2': { title: 'Bol à thé en grès' } });
    type(screen.getByLabelText(L('seo.pages.pageTitle')), '');
    expect(last(onSeo).meta).toBeUndefined();
  });
  it('refuses the address word another creation already has, and says so', async () => {
    const onSeo = vi.fn();
    render(<Mounted onSeo={onSeo} />);
    await screen.findByText('Bol · Atelier');
    fireEvent.click(screen.getAllByText(L('seo.pages.edit')).at(-1)!);
    type(screen.getByLabelText(L('seo.pages.slug')), 'Vase cône');
    expect(screen.getByText(L('seo.pages.slugTaken'))).toBeInTheDocument();
    expect(onSeo).not.toHaveBeenCalled();
    type(screen.getByLabelText(L('seo.pages.slug')), 'Bol à thé');
    expect(last(onSeo)).toEqual({ slugs: { 'c:p2': 'bol-a-the' }, redirects: [{ from: 'creations/bol/', id: 'c:p2' }] });
    expect(screen.queryByText(L('seo.pages.slugTaken'))).toBeNull();
  });
  it('lets no address word be changed before the addresses are read: the redirect is made from the old one', () => {
    render(<Mounted load={() => new Promise(() => {})} />);
    expect(screen.getByLabelText(`${L('seo.words.label')} · ${L('seo.words.creations')}`)).toBeDisabled();
  });
  it('describes a creation from the list of the bare ones', async () => {
    const onDescribe = vi.fn().mockResolvedValue(true);
    render(<Mounted onDescribe={onDescribe} />);
    await screen.findByText('Bol · Atelier');
    fireEvent.click(screen.getByText(L('seo.describe.title')));
    await act(async () => { type(screen.getByLabelText(`${L('seo.describe.placeholder')} · Bol`), ' Un bol à thé. '); });
    expect(onDescribe).toHaveBeenCalledWith(pieces[1], 'Un bol à thé.');
    expect(await screen.findByText(L('seo.describe.saved'))).toBeInTheDocument();
  });
});

import { fireEvent, render } from '@testing-library/react';
import { EffectsCatalogue } from './EffectsCatalogue';
import { designOf } from '../model/design';
import { normalizeSiteSettings } from '../model/records';
import { EFFECTS } from '../site/effects';
import en from '../locales/en.json';

const WAIT = (en as Record<string, string>)['effects.demoWait']!;
const design = designOf(normalizeSiteSettings({ brand: { name: 'Atelier' } }, ''));

/** jsdom measures every box at 0: the demonstration needs a width to be drawn at all. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterAll(() => {
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  vi.unstubAllGlobals();
});

describe('an effect’s demonstration while it loads', () => {
  it('says it is loading while her photos are still read, and draws no frame for nothing', () => {
    const { container, getAllByText } = render(<EffectsCatalogue design={design} photos={[]} pending onTry={() => {}} lit={null} />);
    expect(getAllByText(WAIT)).toHaveLength(EFFECTS.length);
    expect(container.querySelectorAll('.fx-demo[aria-busy="true"]')).toHaveLength(EFFECTS.length);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
  });
  it('keeps saying so until the frame has drawn, then stops', () => {
    const { container, queryAllByText } = render(<EffectsCatalogue design={design} photos={[]} onTry={() => {}} lit={null} />);
    const frames = container.querySelectorAll('iframe');
    expect(frames).toHaveLength(EFFECTS.length);
    expect(queryAllByText(WAIT)).toHaveLength(EFFECTS.length);
    fireEvent.load(frames[0]!);
    expect(queryAllByText(WAIT)).toHaveLength(EFFECTS.length - 1);
    expect(container.querySelectorAll('.fx-demo[aria-busy="false"]')).toHaveLength(1);
  });
});

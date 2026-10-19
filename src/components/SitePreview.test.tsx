import { act, fireEvent, render, screen } from '@testing-library/react';
import { SitePreview } from './SitePreview';

const preview = { html: '', pageUrl: 'about:blank', size: { bytes: 0, imageBytes: 0, clipBytes: 0 }, urls: [] } as never;
const colours = { ink: '#000', paper: '#fff', accent: '#0a0' };

describe('the site preview', () => {
  it('says what stopped the page and offers to reload, instead of a white page', () => {
    vi.useFakeTimers();
    const { container } = render(<SitePreview preview={preview} standalone={false} onClose={vi.fn()} onOpenWindow={vi.fn()} colours={colours} onColours={vi.fn()} />);
    const frame = container.querySelector('iframe')!;
    (frame.contentWindow as Window & { __previewErrors?: string[] }).__previewErrors = ['siteTemplate is not defined'];
    fireEvent.load(frame);
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByRole('alert')).toHaveTextContent('siteTemplate is not defined');
    expect(screen.getByRole('button', { name: /Recharger|Reload|Recargar/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('says nothing while the page runs well', () => {
    vi.useFakeTimers();
    const { container } = render(<SitePreview preview={preview} standalone={false} onClose={vi.fn()} onOpenWindow={vi.fn()} colours={colours} onColours={vi.fn()} />);
    fireEvent.load(container.querySelector('iframe')!);
    act(() => { vi.advanceTimersByTime(3500); });
    expect(screen.queryByRole('alert')).toBeNull();
    vi.useRealTimers();
  });
});

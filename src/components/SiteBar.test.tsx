import { act, fireEvent, render, screen } from '@testing-library/react';
import { SiteBar } from './SiteBar';
import type { PublishStage } from '../model/publish';
import type { SiteWork } from './SitePanel';

function bar(stage: PublishStage, over: Partial<Parameters<typeof SiteBar>[0]> = {}) {
  const props = {
    stage, missing: [], link: 'https://atelier.vercel.app', work: { kind: 'idle' } as SiteWork, staleLiving: 0, see: 'page' as const,
    seeing: null, seeError: null, onSee: vi.fn(), onPublish: vi.fn(), onOpen: vi.fn(), onConnect: vi.fn(), onFix: vi.fn(), ...over,
  };
  render(<SiteBar {...props} />);
  return props;
}

describe('the site bar', () => {
  it('offers the connection, not a publish, while the hosting is not set', () => {
    const p = bar('unconnected', { link: null });
    expect(screen.getByText('Hosting to connect')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
    fireEvent.click(screen.getByText('Connect'));
    expect(p.onConnect).toHaveBeenCalled();
  });

  it('names only what is missing, each a way to it, and keeps the publish shut', () => {
    const p = bar('incomplete', { missing: ['name'], link: null });
    fireEvent.click(screen.getByText('a name'));
    expect(p.onFix).toHaveBeenCalledWith('name');
    expect(screen.queryByText('a scene online')).toBeNull();
    expect((screen.getByText('Publish').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('makes the update the green button once the studio changed since the site was sent', () => {
    const p = bar('behind');
    expect(screen.getByText('Changes not online yet')).toBeTruthy();
    const send = screen.getByText('Update the site').closest('button')!;
    expect(send.className).toContain('primary');
    fireEvent.click(send);
    expect(p.onPublish).toHaveBeenCalled();
  });

  it('keeps « publish again » quiet when what is online is what the studio holds', () => {
    bar('current');
    expect(screen.getByText('Online, up to date')).toBeTruthy();
    expect(screen.getByText('Publish again').closest('button')!.className).not.toContain('primary');
  });

  it('opens and copies the one address, shown without its scheme', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    const p = bar('current');
    fireEvent.click(screen.getByText('atelier.vercel.app'));
    expect(p.onOpen).toHaveBeenCalledWith('https://atelier.vercel.app');
    await act(async () => { fireEvent.click(screen.getByLabelText('Copy the address')); });
    expect(write).toHaveBeenCalledWith('https://atelier.vercel.app');
  });

  it('counts the files made, then shows the time Vercel takes, and shuts the button meanwhile', () => {
    vi.useFakeTimers();
    try {
      const exporting = bar('behind', { work: { kind: 'exporting', done: 3, total: 10 } });
      expect(screen.getByText('Preparing 3 / 10')).toBeTruthy();
      expect((screen.getByText('Update the site').closest('button') as HTMLButtonElement).disabled).toBe(true);
      expect(exporting.onPublish).not.toHaveBeenCalled();
      document.body.innerHTML = '';
      bar('behind', { work: { kind: 'publishing', since: Date.now() } });
      expect(screen.getByText('Sending to Vercel')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(65_000); });
      expect(screen.getByText('1:05')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says the token is being read, never « to connect », and offers to read it again when it could not be', () => {
    bar('checking', { link: 'https://atelier.vercel.app' });
    expect(screen.getByText('Reading the hosting…')).toBeTruthy();
    expect(screen.queryByText('Connect')).toBeNull();
    expect((screen.getByText('Update the site').closest('button') as HTMLButtonElement).disabled).toBe(true);
    document.body.innerHTML = '';
    const onRetryToken = vi.fn();
    bar('checking', { tokenUnread: true, onRetryToken });
    expect(screen.getByText('The hosting could not be read')).toBeTruthy();
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetryToken).toHaveBeenCalled();
  });

  it('makes sending again the green button after Vercel refused the last send', () => {
    bar('failed');
    expect(screen.getByText('Vercel refused the last update')).toBeTruthy();
    expect(screen.getByText('Update the site').closest('button')!.className).toContain('primary');
  });

  it('says a refused copy, never only in the log', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Write permission denied')) } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bar('current');
    await act(async () => { fireEvent.click(screen.getByLabelText('Copy the address')); });
    expect(screen.getAllByText('Copy refused').length).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('puts away an error under the address', () => {
    const onDismissError = vi.fn();
    bar('current', { seeError: { key: 'error.unknown' }, onDismissError });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onDismissError).toHaveBeenCalled();
  });

  it('says it is online once Vercel said READY, and a refusal in words', () => {
    bar('current', { work: { kind: 'published' } });
    expect(screen.getByText('It’s online')).toBeTruthy();
    document.body.innerHTML = '';
    // Changed while it was being sent: what changed is not online.
    bar('behind', { work: { kind: 'published' } });
    expect(screen.queryByText('It’s online')).toBeNull();
    expect(screen.getByText('Changes not online yet')).toBeTruthy();
    document.body.innerHTML = '';
    bar('behind', { work: { kind: 'error', key: 'error.TOKEN_REFUSED' } });
    expect(screen.queryByText('Changes not online yet')).toBeNull();
  });
});

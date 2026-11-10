import { fireEvent, render, screen } from '@testing-library/react';
import { PagesList } from './PagesList';
import { SpaceRail } from './SpaceRail';

describe('her pages, one list', () => {
  it('lists About, Contact, the legal pages, then the pages she added, and marks the one open', () => {
    const onOpen = vi.fn();
    render(<PagesList current="page:atelier" pages={[{ id: 'atelier', type: 'text', name: 'Mon atelier' }, { id: 'stages', type: 'form', name: 'Stages' }]} onOpen={onOpen} onAdd={() => {}} />);
    const names = screen.getAllByRole('button').map((b) => b.querySelector('span')?.textContent);
    expect(names.slice(2)).toEqual([expect.any(String), 'Mon atelier', 'Stages', expect.any(String)]);
    expect(names).toHaveLength(6);
    expect(screen.getByRole('button', { name: /Mon atelier/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: /Stages/ }));
    expect(onOpen).toHaveBeenCalledWith('page:stages');
  });

  it('adding a page is the list\'s last entry', () => {
    const onAdd = vi.fn();
    render(<PagesList current="about" pages={[]} onOpen={() => {}} onAdd={onAdd} />);
    const all = screen.getAllByRole('button');
    fireEvent.click(all[all.length - 1]!);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe('the rail of the three spaces', () => {
  it('names each space, marks the one in sight, and none on a tool\'s screen', () => {
    const onSpace = vi.fn();
    const { rerender } = render(<SpaceRail space="design" tool={null} onSpace={onSpace} onTool={() => {}} onlineDot={false} />);
    const current = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(current()).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button')[2]!);
    expect(onSpace).toHaveBeenCalledWith('online');
    rerender(<SpaceRail space={null} tool="settings" onSpace={onSpace} onTool={() => {}} onlineDot />);
    expect(current()).toEqual([screen.getAllByRole('button')[4]]);
    // The hosting waits for her: said on the Online space, from any screen.
    expect(screen.getAllByRole('button')[2]!.querySelector('.sb-dot.warn')).not.toBeNull();
  });
});

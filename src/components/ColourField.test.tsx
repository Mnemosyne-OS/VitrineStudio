import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ColourField } from './ColourField';
import { parseHex } from '../model/colour';

function Host({ start, seen }: { start: string; seen: string[] }) {
  const [v, setV] = useState(start);
  return <ColourField value={v} label="Encre" onChange={(hex) => { seen.push(hex); setV(hex); }} />;
}

describe('a HEX code typed under a swatch', () => {
  it('can be typed digit by digit: nothing changes before the sixth, then the colour is the code', () => {
    const seen: string[] = [];
    render(<Host start="#eeece7" seen={seen} />);
    const hex = screen.getByLabelText('Encre HEX') as HTMLInputElement;
    for (const partial of ['', '2', '2b', '2b2', '2b29', '2b292']) {
      act(() => { fireEvent.change(hex, { target: { value: partial } }); });
      expect(hex.value).toBe(partial);
    }
    expect(seen).toEqual([]);
    act(() => { fireEvent.change(hex, { target: { value: '2b2926' } }); });
    expect(seen).toEqual(['#2b2926']);
  });
  it('takes a short code only once the field is left', () => {
    const seen: string[] = [];
    render(<Host start="#eeece7" seen={seen} />);
    const hex = screen.getByLabelText('Encre HEX') as HTMLInputElement;
    act(() => { fireEvent.change(hex, { target: { value: '1f1' } }); });
    expect(seen).toEqual([]);
    act(() => { fireEvent.blur(hex); });
    expect(seen).toEqual(['#11ff11']);
    expect(parseHex('1f1')).toBeNull();
    expect(parseHex('#1F1', true)).toBe('#11ff11');
  });
});

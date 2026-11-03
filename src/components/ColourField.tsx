import { useEffect, useState } from 'react';
import { parseHex } from '../model/colour';

/**
 * A colour: the round swatch (the system picker), its name, and its HEX code
 * written under it, editable. The code comes first because it is what people
 * copy from a brand sheet; the system picker opens on RGB.
 * A code being typed changes nothing until it has its six digits; a short
 * one (#1f1) is taken when the field is left.
 */
export function ColourField({ value, label, onChange, onCommit }: { value: string; label: string; onChange: (hex: string) => void; onCommit?: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="colour-pick">
      <label>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} onBlur={onCommit} aria-label={label} />
      </label>
      <span>{label}</span>
      <input className="colour-hex" value={text} spellCheck={false} maxLength={7} aria-label={`${label} HEX`}
        onChange={(e) => { setText(e.target.value); const hex = parseHex(e.target.value); if (hex) onChange(hex); }}
        onBlur={() => { const hex = parseHex(text, true); if (hex && hex !== value) onChange(hex); else setText(value); onCommit?.(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

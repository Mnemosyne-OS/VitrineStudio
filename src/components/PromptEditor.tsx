import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { PROMPT_MAX } from '../model/types';

export interface PromptItem {
  key: string;
  label: string;
  /** The trade's own instruction, rebuilt from the person's words. */
  auto: string;
  /** The person's own text, when they rewrote it. */
  own?: string;
}

/**
 * Advanced mode: every instruction the studio will send, shown as it is and
 * editable. A field equal to the trade's instruction (or emptied) is not an
 * override: it goes back to automatic, so a later change of words still
 * reaches it. A rewritten one says so, with a way back.
 */
export function PromptEditor({ items, disabled, onChange }: {
  items: PromptItem[];
  disabled?: boolean;
  /** `undefined` = back to the trade's instruction. */
  onChange: (key: string, own: string | undefined) => void;
}) {
  const { t } = useI18n();
  return (
    <details className="prompt-editor">
      <summary><Pencil className="ico" aria-hidden />{t('prompt.title')}</summary>
      {items.map((it) => <PromptField key={it.key} item={it} disabled={disabled} onChange={onChange} />)}
    </details>
  );
}

function PromptField({ item, disabled, onChange }: { item: PromptItem; disabled?: boolean; onChange: (key: string, own: string | undefined) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(item.own ?? item.auto);
  // The trade's instruction follows the scene's words until the person writes their own.
  useEffect(() => setDraft(item.own ?? item.auto), [item.own, item.auto]);
  const commit = () => {
    const text = draft.trim();
    const own = !text || text === item.auto.trim() ? undefined : text;
    if (own !== item.own) onChange(item.key, own);
  };
  return (
    <label className="prompt-field">
      <span className="small">
        <strong>{item.label}</strong>
        {item.own ? <span className="warn"> · {t('prompt.own')}</span> : <span className="muted"> · {t('prompt.auto')}</span>}
      </span>
      <textarea rows={5} value={draft} disabled={disabled} maxLength={PROMPT_MAX} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
      {item.own && <button className="link small" disabled={disabled} onClick={(e) => { e.preventDefault(); onChange(item.key, undefined); }}>{t('prompt.reset')}</button>}
    </label>
  );
}

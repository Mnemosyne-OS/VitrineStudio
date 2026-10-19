import { Archive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorText } from './errors';
import { useI18n } from '../i18n';

export type RemoveMode = 'archive' | 'delete';
/** What happened: `left` = files that could not be deleted (told by path, never hidden). */
export type RemoveOutcome = { ok: true; left: string[] } | { ok: false; error: { key: string; raw?: string } };

/**
 * The question asked before a scene (or a film) leaves the studio: keep its pictures in
 * the archive, or delete them for good. Archive is the main action (glass
 * tinted green); nothing happens until one of the two is pressed. Escape and
 * "Cancel" close; a click outside does not (a choice this heavy is never made
 * by a stray click).
 */
export function RemoveSceneDialog({ name, lead, files, onRemove, onClose }: {
  /** What is removed, as the person calls it. */
  name: string;
  /** The line under the title; absent = a scene's (it leaves the studio and the site). */
  lead?: string;
  /** The files "delete for good" would remove (filesOwnedBy). */
  files: string[];
  onRemove: (mode: RemoveMode) => Promise<RemoveOutcome>;
  onClose: () => void;
}) {
  const { t, tc } = useI18n();
  const [busy, setBusy] = useState<RemoveMode | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [left, setLeft] = useState<string[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async (mode: RemoveMode) => {
    setBusy(mode);
    setError(null);
    const out = await onRemove(mode);
    setBusy(null);
    if (!out.ok) setError(out.error);
    else if (out.left.length) setLeft(out.left);
    else onClose();
  };

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('remove.title', { name })}>
      <div className="remove-dialog glass">
        <h2>{t('remove.title', { name })}</h2>
        {left ? (
          <>
            <p className="warn">{tc('remove.left', left.length)}</p>
            <ul className="small muted remove-left">{left.map((f) => <li key={f}>{f}</li>)}</ul>
            <div className="remove-foot"><button className="primary" onClick={onClose}>{t('remove.close')}</button></div>
          </>
        ) : (
          <>
            <p className="muted">{lead ?? t('remove.lead')}</p>
            <div className="remove-choices">
              <button className="chip-tile glass remove-archive" disabled={!!busy} onClick={() => void run('archive')}>
                <strong>{busy === 'archive' ? <span className="spinner small-spin" aria-hidden /> : <Archive className="ico" aria-hidden />} {t('remove.archive')}</strong>
                <span className="small muted">{t('remove.archiveHint')}</span>
              </button>
              <button className="chip-tile glass remove-delete" disabled={!!busy} onClick={() => void run('delete')}>
                <strong>{busy === 'delete' ? <span className="spinner small-spin" aria-hidden /> : <Trash2 className="ico" aria-hidden />} {t('remove.delete')}</strong>
                <span className="small muted">{files.length ? tc('remove.deleteHint', files.length) : t('remove.deleteNone')}</span>
              </button>
            </div>
            {error && <p className="error small">{errorText(error)}</p>}
            <div className="remove-foot"><button disabled={!!busy} onClick={onClose}>{t('remove.cancel')}</button></div>
          </>
        )}
      </div>
    </div>
  );
}

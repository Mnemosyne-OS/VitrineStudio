import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Piece } from '../model/types';

/**
 * Removing a creation asks first, in a dialog (Tony: « t'as oublié la
 * confirmation »): its name, and how many scenes use it. The piece goes to the
 * archive folder; its photos and scenes stay.
 */
export function RemovePieceDialog({ piece, scenes, onRemove, onClose }: {
  piece: Piece;
  /** Scenes made with this piece: they keep their pictures. */
  scenes: number;
  /** Resolves true once archived; false when it failed (the studio tells why). */
  onRemove: () => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, tc } = useI18n();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async () => {
    setBusy(true);
    const ok = await onRemove();
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('pieces.removeTitle', { name: piece.name })}>
      <div className="remove-dialog glass">
        <h2>{t('pieces.removeTitle', { name: piece.name })}</h2>
        <p className="muted">{t('pieces.removeLead')}{scenes > 0 ? ` ${tc('pieces.removeScenes', scenes)}` : ''}</p>
        <div className="remove-foot">
          <button disabled={busy} onClick={onClose}>{t('remove.cancel')}</button>
          <button className="remove-delete" disabled={busy} onClick={() => void run()}>
            {busy ? <span className="spinner small-spin" aria-hidden /> : <Trash2 className="ico" aria-hidden />} {t('pieces.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}

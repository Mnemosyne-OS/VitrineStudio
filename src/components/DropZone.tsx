import { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Upload } from '../data/photos';
import { formatWeight } from '../format';

/**
 * The upload zone, the way people know it from the web: an icon, "drag and
 * drop here", "or browse your files", the accepted formats and size. The
 * whole zone is a button: a click opens the system's own picker, so a person
 * who does not drag is never stuck.
 */
export function DropZone({ onFiles, onPick, busy, compact, title, formats, uploads }: {
  onFiles: (files: File[]) => void;
  onPick: () => void;
  busy?: boolean;
  compact?: boolean;
  /** Overrides the default "drop your photos here". */
  title?: string;
  /** Overrides the default formats line. */
  formats?: string;
  /** The files being sent, shown under the zone. */
  uploads?: Upload[];
}) {
  const { t } = useI18n();
  const [over, setOver] = useState(false);
  // dragenter/dragleave fire for every child: count them, or the glow flickers.
  const depth = useRef(0);

  return (
    <div className={`upload-block ${compact ? 'compact' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        aria-busy={busy || undefined}
        aria-label={title ?? t('upload.title')}
        className={`upload glass ${over ? 'over' : ''} ${busy ? 'busy' : ''}`}
        onClick={() => !busy && onPick()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
            e.preventDefault();
            onPick();
          }
        }}
        onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length && !busy) onFiles(files);
        }}
      >
        <svg className="upload-icon" viewBox="0 0 48 48" aria-hidden>
          <path d="M14 34h-2a9 9 0 0 1-1.6-17.9A12 12 0 0 1 33.6 13 9.5 9.5 0 0 1 36 34h-2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 40V22m0 0-6.5 6.5M24 22l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="upload-title">{over ? t('upload.release') : title ?? t('upload.title')}</p>
        <p className="upload-or">{t('upload.or')} <span className="upload-browse">{t('upload.browse')}</span></p>
        <p className="upload-formats">{formats ?? t('upload.formats')}</p>
      </div>
      {uploads && uploads.length > 0 && <UploadList uploads={uploads} />}
    </div>
  );
}

function UploadList({ uploads }: { uploads: Upload[] }) {
  const { t } = useI18n();
  return (
    <ul className="upload-list">
      {uploads.map((u) => (
        <li key={u.id} className={`upload-row glass ${u.status}`}>
          {u.preview ? <img src={u.preview} alt="" /> : <span className="upload-file" aria-hidden />}
          <span className="upload-name">{u.name}<span className="muted small"> · {formatWeight(u.size)}</span></span>
          <span className="upload-status">
            {u.status === 'saving' && <><span className="spinner small-spin" aria-hidden />{t('upload.saving')}</>}
            {u.status === 'done' && <span className="ok">✓ {t('upload.done')}</span>}
            {u.status === 'refused' && <span className="error">{t(u.reasonKey ?? 'error.unknown')}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

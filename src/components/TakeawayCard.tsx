import { useState, type ReactNode } from 'react';
import { ArchiveRestore, FolderArchive, Globe, HardDriveDownload, Table } from 'lucide-react';
import { getLanguage, useI18n } from '../i18n';
import { describeError, errorText } from './errors';
import type { Progress } from '../data/takeaway';

/** One of the copies she can carry away; each opens the system's folder dialog first. */
export type TakeawayKind = 'all' | 'table' | 'site';
/** What one press did: what was written where, and what could not be, by path. */
export interface TakeawayResult { folder: string; written: number; failed: string[]; kept?: string[]; added?: number }

const ICON = { all: FolderArchive, table: Table, site: Globe } as const;

/**
 * The studio carried away and brought back (Tony: « une console de boutons
 * pour exporter une copie sur USB, la base produit… si quelqu'un veut prendre
 * et partir avec, il doit pouvoir facilement, et même réimporter »): one tile
 * per copy, each asking WHERE in the system's own dialog (a USB key, another
 * disk), and « bring back a copy » that never replaces anything of hers. The
 * work is measured (files written out of the total), never a made-up bar.
 */
export function TakeawayCard({ run, restore, children }: {
  /** Picks the folder, writes the copy, reports. Rejects with CANCELED when the dialog was closed. */
  run: (kind: TakeawayKind, onProgress: (p: Progress) => void) => Promise<TakeawayResult>;
  restore: (onProgress: (p: Progress) => void) => Promise<TakeawayResult>;
  /** The site kit's card, the fourth way to carry the site. */
  children?: ReactNode;
}) {
  const { t, tc } = useI18n();
  const [busy, setBusy] = useState<TakeawayKind | 'restore' | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<{ kind: TakeawayKind | 'restore'; r: TakeawayResult } | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);

  const go = async (kind: TakeawayKind | 'restore') => {
    setBusy(kind);
    setProgress(null);
    setResult(null);
    setError(null);
    try {
      const r = kind === 'restore' ? await restore(setProgress) : await run(kind, setProgress);
      setResult({ kind, r });
    } catch (err) {
      // Closing the dialog is a choice, not a failure.
      if (!String(err).includes('CANCELED')) {
        console.warn('[vitrine-studio] the copy stopped:', err);
        setError(describeError(err));
      }
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="glass card-pad takeaway-card">
      <h3><HardDriveDownload className="ico" aria-hidden /> {t('takeaway.title')}</h3>
      <div className="takeaway-tiles">
        {(['all', 'table', 'site'] as const).map((k) => {
          const Icon = ICON[k];
          return (
            <button key={k} className="chip-tile glass takeaway-tile" disabled={!!busy} onClick={() => void go(k)}>
              {busy === k ? <span className="spinner small-spin" aria-hidden /> : <Icon className="ico" aria-hidden />}
              <strong>{t(`takeaway.${k}`)}</strong>
              <span className="small muted">{t(`takeaway.${k}Hint`)}</span>
            </button>
          );
        })}
        <button className="chip-tile glass takeaway-tile" disabled={!!busy} onClick={() => void go('restore')}>
          {busy === 'restore' ? <span className="spinner small-spin" aria-hidden /> : <ArchiveRestore className="ico" aria-hidden />}
          <strong>{t('takeaway.restore')}</strong>
          <span className="small muted">{t('takeaway.restoreHint')}</span>
        </button>
      </div>
      {progress && progress.total > 0 && (
        <div className="progress"><span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /><em>{t('takeaway.progress', { done: progress.done.toLocaleString(getLanguage()), total: progress.total.toLocaleString(getLanguage()) })}</em></div>
      )}
      {error && <p className="error small">{errorText(error)}</p>}
      {result && (
        <div className="takeaway-result">
          {result.kind === 'restore'
            ? <p className="ok small">✓ {tc('takeaway.restored', result.r.added ?? 0, { folder: result.r.folder })}{result.r.kept?.length ? ` · ${tc('takeaway.kept', result.r.kept.length)}` : ''}</p>
            : <p className="ok small">✓ {tc('takeaway.done', result.r.written, { folder: result.r.folder })}</p>}
          {result.r.failed.length > 0 && (
            <>
              <p className="warn small">{tc('takeaway.failed', result.r.failed.length)}</p>
              <ul className="small muted takeaway-failed">{result.r.failed.map((f) => <li key={f}>{f}</li>)}</ul>
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { readImage } from '../data/host';
import { useI18n } from '../i18n';

/**
 * A picture on disk, read through the host. Three states, never two: loading,
 * the picture, or the host's reason it could not be read (a moved file must
 * not look like an empty frame).
 */
export function Thumb({ path, alt, empty }: { path?: string; alt: string; empty?: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ src?: string; error?: string }>({});
  useEffect(() => {
    if (!path) {
      setState({});
      return;
    }
    let alive = true;
    setState({});
    readImage(path).then(
      (src) => alive && setState({ src }),
      (err: unknown) => alive && setState({ error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return <div className="thumb thumb-empty">{empty ?? '—'}</div>;
  if (state.error) return <div className="thumb thumb-error" title={state.error}>{t('thumb.unreadable')}</div>;
  if (!state.src) return <div className="thumb thumb-loading" aria-busy="true" />;
  return <img className="thumb" src={state.src} alt={alt} />;
}

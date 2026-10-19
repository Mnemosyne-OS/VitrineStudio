import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * A running clock, for work with no measurable progress (a clip, an
 * enlargement): it shows its time, never a frozen bar. Its own one-second
 * tick, because the host is asked far less often.
 */
export function ClipClock({ startedAt, label = 'clip.making', values = {} }: { startedAt: string; label?: string; values?: Record<string, string | number> }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
  return <p className="small"><span className="spinner small-spin" aria-hidden /> {t(label, { ...values, time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })}</p>;
}

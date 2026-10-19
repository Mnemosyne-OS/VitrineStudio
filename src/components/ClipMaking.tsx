import { useEffect, useState } from 'react';
import { Camera, Clapperboard, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Over a scene's picture while its clip is being made (Tony: « fais-moi une
 * jolie animation pendant qu'elle la crée »): film perforations running along
 * the edges, a light sweeping across, the clapperboard breathing, and the
 * time it has taken. A clip takes 11 s to 6 min and says nothing of its
 * progress, so the clock is the only honest number shown.
 *
 * The same film runs while a PICTURE is made (Tony: « mets-moi ça dans la
 * création de scène »): another icon, another line, and the clock counts from
 * when it appeared, the host saying nothing of a picture's progress either.
 */
export function ClipMaking({ startedAt, compact = false, title, icon: Icon = Clapperboard }: { startedAt?: string; compact?: boolean; title?: string; icon?: LucideIcon }) {
  const { t } = useI18n();
  const [shownAt] = useState(() => new Date().toISOString());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const from = Date.parse(startedAt ?? shownAt);
  const s = Number.isFinite(from) ? Math.max(0, Math.round((now - from) / 1000)) : null;
  return (
    <div className={`clip-making ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <span className="cm-film top" aria-hidden />
      <span className="cm-film bottom" aria-hidden />
      <span className="cm-sweep" aria-hidden />
      <span className="cm-core">
        <span className="cm-icon"><span className="cm-ring" aria-hidden /><span className="cm-ring late" aria-hidden /><Icon className="ico" aria-hidden /></span>
        <strong>{title ?? t('clip.makingTitle')}</strong>
        {s !== null && <span className="cm-time">{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</span>}
      </span>
    </div>
  );
}

/** The same film over a picture being made. */
export function PictureMaking({ beat, compact = false }: { beat: string; compact?: boolean }) {
  const { t } = useI18n();
  return <ClipMaking compact={compact} icon={Camera} title={t('scenes.pictureMaking', { beat })} />;
}

import { useCallback, useEffect, useState } from 'react';
import { Languages, Maximize2 } from 'lucide-react';
import { getLanguage, useI18n } from '../i18n';
import type { Lang } from '../model/profiles';
import { lineCounts, roomLines, type HerWord, type SiteTranslation } from '../model/translation';
import { describeError, errorText } from './errors';
import { TranslationRoom } from './TranslationRoom';

const LANGS: Lang[] = ['fr', 'en', 'es'];
const NAME: Record<Lang, string> = { fr: 'Français', en: 'English', es: 'Español' };

/**
 * The site's second language (Site › Look): which one, where she stands, and
 * the door to the translation room where the work is done (TranslationRoom).
 *
 * 🪤 Every change is a function of the site's CURRENT translation (patchSite
 * re-reads the file and queues): built from the copy this card holds, a run
 * of translations wrote each over the one before and kept one in two.
 */
export function TranslationCard({ translation, words, onChange }: {
  translation: SiteTranslation | undefined;
  /** Her strings as the second version would carry them, with their place on the site. */
  words: (lang: Lang) => Promise<HerWord[]>;
  onChange: (update: (current: SiteTranslation | undefined) => SiteTranslation | undefined) => void;
}) {
  const { t } = useI18n();
  const main = getLanguage();
  const [list, setList] = useState<HerWord[] | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const lang = translation?.lang;

  const load = async (l: Lang) => {
    setError(null);
    try {
      setList(await words(l));
      return true;
    } catch (err) {
      console.error('[vitrine-studio] her words not read for the translation:', err);
      setError(describeError(err));
      return false;
    }
  };
  useEffect(() => { setList(null); if (lang) void load(lang); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (l: Lang | null) => onChange((cur) => (l ? { lang: l, entries: cur?.lang === l ? cur.entries : {} } : undefined));
  // The room opens on her words read now (she may have written since), never over an error left behind it.
  const [opening, setOpening] = useState(false);
  const openRoom = async () => {
    if (!lang) return;
    setOpening(true);
    const ok = await load(lang);
    setOpening(false);
    if (ok) setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);

  const c = lineCounts(roomLines(list ?? [], translation));
  return (
    <div className="glass card-pad">
      <h3><Languages className="ico" aria-hidden /> {t('tr.title')}</h3>
      <p className="small muted">{t('tr.hint')}</p>
      <div className="idea-row">
        <button className={`chip-tile glass ${!lang ? 'chosen' : ''}`} aria-pressed={!lang} onClick={() => pick(null)}>{t('tr.none')}</button>
        {LANGS.filter((l) => l !== main).map((l) => (
          <button key={l} className={`chip-tile glass ${lang === l ? 'chosen' : ''}`} aria-pressed={lang === l} onClick={() => pick(l)}>{NAME[l]}</button>
        ))}
      </div>
      {error && <p className="error small">{t('tr.failed', { error: errorText(error) })}</p>}
      {lang && list && list.length === 0 && <p className="small muted">{t('tr.empty')}</p>}
      {lang && list && list.length > 0 && translation && (
        <div className="idea-row">
          <button className="primary" disabled={opening} onClick={() => void openRoom()}><Maximize2 className="ico" aria-hidden />{t('room.open')}</button>
          <span className="small muted">{t('room.summary', { read: c.read + c.edited, proposed: c.proposed, todo: c.missing + c.stale, total: c.total })}</span>
        </div>
      )}
      {open && lang && translation && list && (
        <TranslationRoom lang={lang} main={main} translation={translation} words={list} onChange={onChange} onClose={close} />
      )}
    </div>
  );
}

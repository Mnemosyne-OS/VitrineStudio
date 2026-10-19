import { FolderOpen, Package, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { baseName } from '../data/folderStore';
import type { KitActions } from '../hooks/useKit';
import type { KitApplied } from '../model/kit';
import { DropZone } from './DropZone';
import { errorText } from './errors';

/**
 * The site kit: the one in place and a zone to drop a newer one; on the
 * maker's side, the folder of pages it carries and the button that writes it.
 * `welcome` is the first-launch form: the zone alone, large, with "later".
 */
export function KitCard({ kit, installed, pagesFolder, onLater, welcome }: {
  kit: KitActions;
  installed: KitApplied | undefined;
  pagesFolder: string | undefined;
  onLater?: () => void;
  welcome?: boolean;
}) {
  const { t, tc } = useI18n();
  const r = kit.result;
  const lines = (
    <>
      {r?.kind === 'installed' && (
        <p className="small ok-line">
          ✓ {t('kit.installedNow', { name: r.name })}{r.added > 0 && <> · {tc('kit.added', r.added)}</>} · {tc('kit.pages', r.pages)}
          {r.kept.length > 0 && <> · {t('kit.kept', { fields: r.kept.map((f) => t(`kit.field.${f}`)).join(', ') })}</>}
        </p>
      )}
      {r?.kind === 'made' && <p className="small ok-line">✓ {t('kit.made', { file: r.file })} · {tc('kit.pages', r.pages)}</p>}
      {kit.error && <p className="error small">{errorText(kit.error)}</p>}
    </>
  );

  if (welcome) {
    return (
      <div className="glass card-pad kit-welcome">
        <div className="row card-head">
          <h3><Package className="ico" aria-hidden />{t('kit.welcomeTitle')}</h3>
          {onLater && <button className="link" onClick={onLater}>{t('kit.later')}</button>}
        </div>
        <DropZone title={t('kit.drop')} formats={t('kit.accepts')} busy={kit.busy === 'install'}
          onFiles={(files) => files[0] && kit.installFile(files[0])} onPick={() => kit.installPicked()} />
        {lines}
      </div>
    );
  }

  return (
    <div className="glass card-pad kit-card">
      <h3><Package className="ico" aria-hidden />{t('kit.title')}</h3>
      {installed && (
        <div className="row">
          <span className="small">✓ {t('kit.inPlace', { name: installed.name, date: new Date(installed.version).toLocaleDateString() })}</span>
          <button className="link" onClick={kit.removeKit}>{t('kit.remove')}</button>
        </div>
      )}
      <DropZone compact title={t(installed ? 'kit.dropNewer' : 'kit.drop')} formats={t('kit.accepts')} busy={kit.busy === 'install'}
        onFiles={(files) => files[0] && kit.installFile(files[0])} onPick={() => kit.installPicked()} />
      <div className="row spaced kit-make">
        <span className="small muted">{t('kit.pagesFolder')}</span>
        {pagesFolder
          ? <><span className="small">{baseName(pagesFolder)}</span><button className="link" onClick={kit.forgetPages} aria-label={t('kit.noPages')}><X className="ico solo" aria-hidden /></button></>
          : <span className="small muted">{t('kit.noPages')}</span>}
        <button onClick={() => void kit.choosePages()}><FolderOpen className="ico" aria-hidden />{t('kit.choosePages')}</button>
        <button className="primary" disabled={kit.busy !== null} onClick={() => void kit.make()}>{kit.busy === 'make' ? <span className="spinner small-spin" aria-hidden /> : <Package className="ico" aria-hidden />}{t('kit.make')}</button>
      </div>
      {lines}
    </div>
  );
}

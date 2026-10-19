import { getLanguage, useI18n } from '../i18n';
import { isFilmRecord } from '../model/filmRecord';
import { estimateClip, estimateImage, formatUsd, PRICES_READ_ON, totalOf, type CostEntry, type CostTotal } from '../model/costs';
import { nextBeat } from '../model/records';
import { BEATS, type Piece, type Scene, type StudioSettings } from '../model/types';
import { MODEL_FOR_QUALITY } from '../data/host';
import { CLIP_SECONDS } from '../data/makeClip';

/**
 * The project's money, in one place: what was spent (the gate's debits), what
 * finishing the open work would cost (estimates, dated), and the switch that
 * puts each scene's cost on its card. A sum that misses calls whose debit was
 * not reported says "at least"; a scene with no recorded line says "—".
 */
export function CostsPanel({ costs, readable, scenes, pieces, settings, onShowCosts }: {
  costs: CostEntry[];
  /** False when studio/costs.json exists but cannot be read: nothing is added to it. */
  readable: boolean;
  scenes: Scene[];
  pieces: Piece[];
  settings: StudioSettings;
  onShowCosts: (show: boolean) => void;
}) {
  const { t, tc } = useI18n();
  const lang = getLanguage();
  // "At least" only over a measured amount: with nothing measured it is the dash alone.
  const money = (total: CostTotal) => (total.count === total.unmeasured ? formatUsd(null, lang) : `${total.unmeasured > 0 ? '≥ ' : ''}${formatUsd(total.usd, lang)}`);

  const all = totalOf(costs);
  const images = totalOf(costs, (e) => e.kind === 'image');
  const clips = totalOf(costs, (e) => e.kind === 'clip');
  const film = totalOf(costs, (e) => isFilmRecord(e.record));

  // Finishing what is open: every missing picture of every scene, at the chosen quality.
  const missing = scenes.reduce((n, s) => n + (nextBeat(s) ? BEATS.filter((b) => !s.images[b]).length : 0), 0);
  const imagePrice = estimateImage(MODEL_FOR_QUALITY[settings.quality]);
  const clipPrice = estimateClip(CLIP_SECONDS);
  const withoutClip = scenes.filter((s) => s.validated && !s.clipPath && !s.clipJob).length;

  const rows = scenes
    .map((s) => ({ scene: s, total: totalOf(costs, (e) => e.record === s.id) }))
    .sort((a, b) => b.total.usd - a.total.usd);
  const pieceName = (id: string) => pieces.find((p) => p.id === id)?.name ?? t('scenes.unknownPiece');

  return (
    <section className="settings costs">
      <div className="glass card-pad full costs-head">
        <div>
          <h3>{t('costs.total')}</h3>
          <p className="costs-big">{all.count ? money(all) : formatUsd(null, lang)}</p>
          {all.count > 0 && <p className="muted small">{tc('costs.calls', all.count)}{all.unmeasured > 0 ? ` · ${tc('costs.unmeasured', all.unmeasured)}` : ''}</p>}
          {!readable && <p className="error small">{t('costs.unreadable')}</p>}
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.showCosts} onChange={(e) => onShowCosts(e.target.checked)} />
          <span><strong>{t('costs.show')}</strong></span>
        </label>
      </div>

      <div className="glass card-pad">
        <h3>{t('costs.byKind')}</h3>
        <dl className="costs-list">
          <dt>{t('costs.images')}</dt><dd>{images.count ? `${money(images)} · ${tc('costs.calls', images.count)}` : '—'}</dd>
          <dt>{t('costs.clips')}</dt><dd>{clips.count ? `${money(clips)} · ${tc('costs.calls', clips.count)}` : '—'}</dd>
          <dt>{t('costs.film')}</dt><dd>{film.count ? money(film) : '—'}</dd>
          <dt>{t('costs.upscale')}</dt><dd>{t('costs.upscaleFree')}</dd>
        </dl>
      </div>

      <div className="glass card-pad">
        <h3>{t('costs.ahead')}</h3>
        <dl className="costs-list">
          <dt>{tc('costs.aheadImages', missing)}</dt>
          <dd>{missing ? `≈ ${formatUsd(imagePrice === null ? null : missing * imagePrice, lang)}` : '—'}</dd>
          <dt>{tc('costs.aheadClips', withoutClip)}</dt>
          <dd>{withoutClip ? `≈ ${formatUsd(withoutClip * clipPrice, lang)}` : '—'}</dd>
          <dt>{t('costs.perImage')}</dt><dd>≈ {formatUsd(imagePrice, lang)}</dd>
          <dt>{t('costs.perClip', { seconds: CLIP_SECONDS })}</dt><dd>≈ {formatUsd(clipPrice, lang)}</dd>
        </dl>
        <p className="muted small">{t('costs.estimateNote', { date: new Date(`${PRICES_READ_ON}T12:00:00`).toLocaleDateString(lang) /* midday: a bare date is UTC midnight, the day before west of Greenwich */ })}</p>
      </div>

      {rows.length > 0 && <div className="glass card-pad costs-scenes">
        <h3>{t('costs.byScene')}</h3>
        {(
          <table className="costs-table">
            <tbody>
              {rows.map(({ scene, total }) => (
                <tr key={scene.id}>
                  <td><strong>{scene.universe || t('scenes.noUniverse')}</strong> · {scene.variant || t('scenes.noVariant')}<span className="muted"> · {pieceName(scene.pieceId)}</span></td>
                  <td className="muted small">{total.count ? tc('costs.calls', total.count) : t('costs.noLine')}</td>
                  <td className="num">{total.count ? money(total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>}
    </section>
  );
}

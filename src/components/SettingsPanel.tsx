import { useI18n, getLanguage, type LangMode } from '../i18n';
import { PROFILES } from '../model/profiles';
import type { ReactNode } from 'react';
import type { StudioSettings } from '../model/types';

const ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4'];

export function SettingsPanel({ settings, folder, onChange, onChangeFolder, children }: {
  settings: StudioSettings;
  /** Cards that need more than the settings (the pictures' quality). */
  children?: ReactNode;
  folder: string;
  onChange: (next: StudioSettings) => void;
  onChangeFolder: () => void;
}) {
  const { t, langMode, setLangMode } = useI18n();
  const lang = getLanguage();
  return (
    <section className="settings">
      <div className="glass card-pad full">
        <h3>{t('settings.profile')}</h3>
        <div className="idea-row">
          {PROFILES.map((p) => (
            <button key={p.id} className={`chip-tile glass ${settings.profileId === p.id ? 'chosen' : ''}`} onClick={() => onChange({ ...settings, profileId: p.id })}>
              <strong>{p.label[lang]}</strong>
              <span className="muted small">{p.beats.place[lang]} → {p.beats.piece[lang]} → {p.beats.alive[lang]}</span>
            </button>
          ))}
        </div>
      </div>
      {children}
      <div className="glass card-pad two-col">
        <label>{t('settings.quality')}
          <select value={settings.quality} onChange={(e) => onChange({ ...settings, quality: e.target.value === 'fast' ? 'fast' : 'quality' })}>
            <option value="quality">{t('settings.quality.quality')}</option>
            <option value="fast">{t('settings.quality.fast')}</option>
          </select>
        </label>
        <label>{t('settings.aspect')}
          <select value={settings.aspectRatio} onChange={(e) => onChange({ ...settings, aspectRatio: e.target.value })}>
            {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>{t('settings.language')}
          <select value={langMode} onChange={(e) => setLangMode(e.target.value as LangMode)}>
            <option value="auto">{t('settings.language.auto')}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>
      <div className="glass card-pad">
        <label className="toggle-row">
          <input type="checkbox" checked={settings.advanced} onChange={(e) => onChange({ ...settings, advanced: e.target.checked })} />
          <span><strong>{t('settings.advanced')}</strong></span>
        </label>
      </div>
      <div className="glass card-pad">
        <p className="muted small">{t('settings.folder')} <code>{folder}</code></p>
        <button onClick={onChangeFolder}>{t('settings.changeFolder')}</button>
      </div>
    </section>
  );
}

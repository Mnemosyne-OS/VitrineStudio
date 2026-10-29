import { useEffect, useState } from 'react';
import {
  AlignLeft, ArrowDown, ArrowUp, Asterisk, AtSign, Calendar, CheckSquare, Hash, ListChecks, PanelLeft, PanelRight, Phone, Plus, Trash2, Type, type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { newId } from '../model/records';
import { FIELD_KINDS, FORM_FIELDS_MAX, type FieldKind, type FormField, type PageLayout } from '../model/pages';
import { RichText } from './RichText';

const FIELD_ICON: Record<FieldKind, LucideIcon> = { text: Type, email: AtSign, tel: Phone, textarea: AlignLeft, date: Calendar, number: Hash, choice: ListChecks, check: CheckSquare };
const SIDES: Array<[PageLayout, LucideIcon]> = [['left', PanelLeft], ['right', PanelRight]];

/** One field, its label and its options edited in place, saved when left. */
function FieldRow({ field, first, last, onChange, onMove, onRemove }: {
  field: FormField;
  first: boolean;
  last: boolean;
  onChange: (next: FormField) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState((field.options ?? []).join(', '));
  useEffect(() => setLabel(field.label), [field.label]);
  useEffect(() => setOptions((field.options ?? []).join(', ')), [field.options]);
  const Icon = FIELD_ICON[field.kind];
  return (
    <div className="form-field glass">
      <Icon className="ico" aria-hidden data-tip={t(`form.kind.${field.kind}`)} />
      <input className="ff-label" value={label} maxLength={80} aria-label={t('form.label')}
        onChange={(e) => setLabel(e.target.value)} onBlur={() => { const v = label.trim(); if (v && v !== field.label) onChange({ ...field, label: v }); else setLabel(field.label); }} />
      <button className={`icon-btn ${field.required ? 'chosen' : ''}`} aria-pressed={field.required} aria-label={t('form.required')} data-tip={t('form.required')}
        onClick={() => onChange({ ...field, required: !field.required })}><Asterisk className="ico solo" aria-hidden /></button>
      <button className="icon-btn" disabled={first} aria-label={t('form.up')} data-tip={t('form.up')} onClick={() => onMove(-1)}><ArrowUp className="ico solo" aria-hidden /></button>
      <button className="icon-btn" disabled={last} aria-label={t('form.down')} data-tip={t('form.down')} onClick={() => onMove(1)}><ArrowDown className="ico solo" aria-hidden /></button>
      <button className="icon-btn ff-trash" aria-label={t('form.remove')} data-tip={t('form.remove')} onClick={onRemove}><Trash2 className="ico solo" aria-hidden /></button>
      {field.kind === 'choice' && (
        <input className="ff-options" value={options} placeholder={t('form.options')} aria-label={t('form.options')}
          onChange={(e) => setOptions(e.target.value)}
          onBlur={() => { const list = options.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 20); if (list.length && list.join(',') !== (field.options ?? []).join(',')) onChange({ ...field, options: list }); }} />
      )}
    </div>
  );
}

/**
 * A form page she added (a sign-up, an order, any request): her words
 * beside the form, what it asks, field by
 * field, and which side it stands. It sends where the Contact form sends.
 */
export function FormPagePanel({ text, onText, fields, onFields, layout, onLayout, sendsTo }: {
  text: string;
  onText: (markdown: string) => void;
  fields: FormField[];
  onFields: (next: FormField[]) => void;
  layout: PageLayout;
  onLayout: (layout: PageLayout) => void;
  /** Where the answers go: her Formspree form, her e-mail, or nowhere yet. */
  sendsTo: 'formspree' | 'email' | 'none';
}) {
  const { t } = useI18n();
  const side = layout === 'right' ? 'right' : 'left';
  const add = (kind: FieldKind) => onFields([...fields, {
    id: newId('f'), label: t(`form.kind.${kind}`), kind, required: false,
    ...(kind === 'choice' ? { options: [t('form.option', { n: 1 }), t('form.option', { n: 2 })] } : {}),
  }]);
  const move = (i: number, by: -1 | 1) => { const next = [...fields]; const [f] = next.splice(i, 1); next.splice(i + by, 0, f!); onFields(next); };

  return (
    <section className="info-page">
      <div className="info-bar glass">
        <div className="segmented glass" role="group" aria-label={t('contact.layout')}>
          {SIDES.map(([l, Icon]) => (
            <button key={l} className={`icon-btn ${side === l ? 'on' : ''}`} aria-pressed={side === l} aria-label={t(`contact.layouts.${l}`)} data-tip={t(`contact.layouts.${l}`)} onClick={() => onLayout(l)}><Icon className="ico solo" aria-hidden /></button>
          ))}
        </div>
        <span className={`small ${sendsTo === 'none' ? 'error' : 'muted'}`}>{t(`form.sendsTo.${sendsTo}`)}</span>
      </div>
      <div className={`info-cols contact-${side}`}>
        <div className="info-side glass card-pad">
          <div className="form-fields">
            {fields.map((f, i) => (
              <FieldRow key={f.id} field={f} first={i === 0} last={i === fields.length - 1}
                onChange={(next) => onFields(fields.map((x) => (x.id === f.id ? next : x)))}
                onMove={(by) => move(i, by)} onRemove={() => onFields(fields.filter((x) => x.id !== f.id))} />
            ))}
          </div>
          {fields.length < FORM_FIELDS_MAX && (
            <div className="form-add" role="group" aria-label={t('form.add')}>
              <Plus className="ico" aria-hidden />
              {FIELD_KINDS.map((k) => {
                const Icon = FIELD_ICON[k];
                return <button key={k} className="icon-btn glass" aria-label={t(`form.kind.${k}`)} data-tip={t(`form.kind.${k}`)} onClick={() => add(k)}><Icon className="ico solo" aria-hidden /></button>;
              })}
            </div>
          )}
        </div>
        <RichText value={text} onChange={onText} label={t('page.text')} placeholder={t('form.textHint')} />
      </div>
    </section>
  );
}

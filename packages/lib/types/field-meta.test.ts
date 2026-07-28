import { describe, expect, it } from 'vitest';

import { RVHOOP_FIELD_BY_TOKEN, RVHOOP_FIELDS, rvhoopPlaceholder } from '../constants/rvhoop-fields';
import { ZFieldMetaSchema, ZTextFieldMeta } from './field-meta';

/**
 * RVHOOP FORK ADDITION.
 *
 * These pin the one thing an upstream merge can break silently. The RVHoop field
 * binding lives in `fieldMeta.rvhoop`, and Zod strips unknown keys: if a merge
 * rewrites ZTextFieldMeta without carrying the `rvhoop` extension across, nothing
 * throws — the key is quietly dropped on the next save, and every template a park
 * has built loses its bindings while still looking correct in the editor. The
 * damage only surfaces later, as blank rent figures on signed leases.
 *
 * So: assert the binding survives a parse. A failure here means "re-apply the
 * fork's field-meta extension", not "fix the test".
 */
describe('rvhoop field binding', () => {
  const placedField = (token: string, label: string) => ({
    type: 'text' as const,
    label,
    text: rvhoopPlaceholder(label),
    readOnly: true,
    required: false,
    fontSize: 12,
    textAlign: 'left' as const,
    rvhoop: { token },
  });

  it('survives a ZFieldMetaSchema round-trip', () => {
    const meta = placedField('start_date', 'Start Date');

    const parsed = ZFieldMetaSchema.parse(meta);

    expect(parsed).toMatchObject({ type: 'text', rvhoop: { token: 'start_date' } });
  });

  it('survives a ZTextFieldMeta round-trip', () => {
    const parsed = ZTextFieldMeta.parse(placedField('monthly_rate', 'Monthly Rate'));

    expect(parsed.rvhoop?.token).toBe('monthly_rate');
  });

  it('survives the JSON trip through the database column', () => {
    // fieldMeta is a Json column, so what comes back is a plain object that has
    // been through JSON.stringify/parse — not the object that was placed.
    const meta = placedField('due_today_breakdown', 'Due Today Breakdown');

    const parsed = ZFieldMetaSchema.parse(JSON.parse(JSON.stringify(meta)));

    expect(parsed).toMatchObject({ rvhoop: { token: 'due_today_breakdown' } });
  });

  it('leaves fields without a binding alone', () => {
    const parsed = ZTextFieldMeta.parse({ type: 'text', text: 'Hand-typed' });

    expect(parsed.rvhoop).toBeUndefined();
  });

  it('rejects an empty token', () => {
    expect(() => ZTextFieldMeta.parse({ type: 'text', rvhoop: { token: '' } })).toThrow();
  });

  it('accepts every token in the catalog', () => {
    for (const field of RVHOOP_FIELDS) {
      expect(() => ZTextFieldMeta.parse(placedField(field.token, field.label))).not.toThrow();
    }
  });
});

describe('the editor forms must not strip the binding', () => {
  // `EditorFieldTextForm` (apps/remix/app/components/forms/editor) validates
  // against a PICK of the text meta and emits `{ type: 'text', ...picked }`. Any
  // key not in the pick is dropped — and that effect runs on MOUNT, so selecting
  // a bound field in the editor was enough to destroy its binding without the
  // manager touching a control. It now carries `rvhoop` through explicitly.
  //
  // This test guards the reason: it asserts `rvhoop` is NOT reachable through the
  // pick, which is what makes the explicit carry-through necessary. If a future
  // change adds `rvhoop: true` to the pick, this fails and whoever did it can
  // drop the carry-through deliberately rather than leaving both.
  const EDITOR_FORM_PICK = {
    label: true,
    placeholder: true,
    text: true,
    characterLimit: true,
    fontSize: true,
    textAlign: true,
    lineHeight: true,
    letterSpacing: true,
    verticalAlign: true,
    required: true,
    readOnly: true,
  } as const;

  it('drops rvhoop when the meta goes through the form pick alone', () => {
    const picked = ZTextFieldMeta.pick(EDITOR_FORM_PICK).parse({
      type: 'text',
      text: '«Monthly Rate»',
      readOnly: true,
      rvhoop: { token: 'monthly_rate' },
    });

    expect(
      'rvhoop' in picked,
      'the pick now carries rvhoop — remove the explicit carry-through in editor-field-text-form.tsx',
    ).toBe(false);
  });

  it('keeps the binding once carried through, as the form now does', () => {
    const stored = { type: 'text' as const, text: '«Monthly Rate»', readOnly: true, rvhoop: { token: 'monthly_rate' } };
    const picked = ZTextFieldMeta.pick(EDITOR_FORM_PICK).parse(stored);

    const emitted = ZTextFieldMeta.parse({
      type: 'text',
      ...picked,
      ...(stored.rvhoop ? { rvhoop: stored.rvhoop } : {}),
    });

    expect(emitted.rvhoop?.token).toBe('monthly_rate');
    expect(emitted.readOnly).toBe(true);
  });
});

describe('rvhoop field catalog', () => {
  it('has unique tokens', () => {
    const tokens = RVHOOP_FIELDS.map((field) => field.token);

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('indexes every field by token', () => {
    expect(Object.keys(RVHOOP_FIELD_BY_TOKEN)).toHaveLength(RVHOOP_FIELDS.length);
  });

  it('gives every field a label, a description and an example', () => {
    for (const field of RVHOOP_FIELDS) {
      expect(field.label.length, field.token).toBeGreaterThan(0);
      expect(field.description.length, field.token).toBeGreaterThan(0);
      expect(field.example.length, field.token).toBeGreaterThan(0);
    }
  });

  it('marks a placed field as visibly unfilled', () => {
    // A document raised outside RVHoop must not print an empty box where a rent
    // figure belongs — and Documenso refuses to save a read-only field with no
    // text at all, so the placeholder is load-bearing in both directions.
    expect(rvhoopPlaceholder('Monthly Rate')).toBe('«Monthly Rate»');
    expect(rvhoopPlaceholder('Monthly Rate').length).toBeGreaterThan(0);
  });
});

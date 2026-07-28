/**
 * RVHOOP FORK ADDITION — the selected field's settings, as a standalone panel.
 *
 * These controls used to live at the bottom of the editor's right-hand sidebar,
 * under the field-type buttons. That worked until the RVHoop palette moved in
 * above them: a hundred-odd pre-populated fields is a long list, and the settings
 * for the field you just placed ended up somewhere off the bottom of it, so
 * changing a font size meant scrolling past the whole catalog to find the box.
 *
 * They are now rendered in the floating panel that hangs off the selected field
 * itself (see envelope-editor-fields-page-renderer.tsx), which is where the
 * author is already looking. This component is just the form switch; the panel
 * owns where it sits and how tall it may get.
 */
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import type {
  TCheckboxFieldMeta,
  TDateFieldMeta,
  TDropdownFieldMeta,
  TEmailFieldMeta,
  TFieldMetaSchema,
  TInitialsFieldMeta,
  TNameFieldMeta,
  TNumberFieldMeta,
  TRadioFieldMeta,
  TSignatureFieldMeta,
  TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { isDeepEqual } from 'remeda';
import { match } from 'ts-pattern';

import { EditorFieldCheckboxForm } from '~/components/forms/editor/editor-field-checkbox-form';
import { EditorFieldDateForm } from '~/components/forms/editor/editor-field-date-form';
import { EditorFieldDropdownForm } from '~/components/forms/editor/editor-field-dropdown-form';
import { EditorFieldEmailForm } from '~/components/forms/editor/editor-field-email-form';
import { EditorFieldInitialsForm } from '~/components/forms/editor/editor-field-initials-form';
import { EditorFieldNameForm } from '~/components/forms/editor/editor-field-name-form';
import { EditorFieldNumberForm } from '~/components/forms/editor/editor-field-number-form';
import { EditorFieldRadioForm } from '~/components/forms/editor/editor-field-radio-form';
import { EditorFieldSignatureForm } from '~/components/forms/editor/editor-field-signature-form';
import { EditorFieldTextForm } from '~/components/forms/editor/editor-field-text-form';

export const FieldSettingsTypeTranslations: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature Settings`,
  [FieldType.FREE_SIGNATURE]: msg`Free Signature Settings`,
  [FieldType.TEXT]: msg`Text Settings`,
  [FieldType.DATE]: msg`Date Settings`,
  [FieldType.EMAIL]: msg`Email Settings`,
  [FieldType.NAME]: msg`Name Settings`,
  [FieldType.INITIALS]: msg`Initials Settings`,
  [FieldType.NUMBER]: msg`Number Settings`,
  [FieldType.RADIO]: msg`Radio Settings`,
  [FieldType.CHECKBOX]: msg`Checkbox Settings`,
  [FieldType.DROPDOWN]: msg`Dropdown Settings`,
};

/**
 * The settings form for whichever single field is selected. Renders nothing when
 * there is no selection, or when several fields are selected at once.
 */
export const EnvelopeEditorFieldSettings = () => {
  const [searchParams] = useSearchParams();

  const { editorFields } = useCurrentEnvelopeEditor();

  // Cloned so a form editing it can't reach back into the editor's own state.
  const selectedField = useMemo(() => structuredClone(editorFields.selectedField), [editorFields.selectedField]);

  if (!selectedField) {
    return null;
  }

  const updateSelectedFieldMeta = (fieldMeta: TFieldMetaSchema) => {
    if (isDeepEqual(selectedField.fieldMeta, fieldMeta)) {
      return;
    }

    editorFields.updateFieldByFormId(selectedField.formId, { fieldMeta });
  };

  return (
    <div className="[&_label]:text-foreground/70 [&_label]:text-xs">
      {searchParams.get('devmode') && (
        <div className="mb-3 space-y-1 rounded-md border border-border bg-muted/50 p-2 text-foreground text-xs">
          {selectedField.id && (
            <p>
              <span className="text-muted-foreground">
                <Trans>Field ID:</Trans>
              </span>{' '}
              {selectedField.id}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">
              <Trans>Recipient ID:</Trans>
            </span>{' '}
            {selectedField.recipientId}
          </p>
          <p>
            <span className="text-muted-foreground">
              <Trans>Pos X:</Trans>
            </span>{' '}
            {selectedField.positionX.toFixed(2)}
            <span className="ml-2 text-muted-foreground">
              <Trans>Pos Y:</Trans>
            </span>{' '}
            {selectedField.positionY.toFixed(2)}
          </p>
          <p>
            <span className="text-muted-foreground">
              <Trans>Width:</Trans>
            </span>{' '}
            {selectedField.width.toFixed(2)}
            <span className="ml-2 text-muted-foreground">
              <Trans>Height:</Trans>
            </span>{' '}
            {selectedField.height.toFixed(2)}
          </p>
        </div>
      )}

      {match(selectedField.type)
        .with(FieldType.SIGNATURE, () => (
          <EditorFieldSignatureForm
            value={selectedField.fieldMeta as TSignatureFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.CHECKBOX, () => (
          <EditorFieldCheckboxForm
            value={selectedField.fieldMeta as TCheckboxFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.DATE, () => (
          <EditorFieldDateForm
            value={selectedField.fieldMeta as TDateFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.DROPDOWN, () => (
          <EditorFieldDropdownForm
            value={selectedField.fieldMeta as TDropdownFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.EMAIL, () => (
          <EditorFieldEmailForm
            value={selectedField.fieldMeta as TEmailFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.INITIALS, () => (
          <EditorFieldInitialsForm
            value={selectedField.fieldMeta as TInitialsFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.NAME, () => (
          <EditorFieldNameForm
            value={selectedField.fieldMeta as TNameFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.NUMBER, () => (
          <EditorFieldNumberForm
            value={selectedField.fieldMeta as TNumberFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.RADIO, () => (
          <EditorFieldRadioForm
            value={selectedField.fieldMeta as TRadioFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .with(FieldType.TEXT, () => (
          <EditorFieldTextForm
            value={selectedField.fieldMeta as TTextFieldMeta | undefined}
            onValueChange={updateSelectedFieldMeta}
          />
        ))
        .otherwise(() => null)}
    </div>
  );
};

/**
 * The heading for the panel the settings sit in — kept here so the label and the
 * form it labels can't drift apart.
 */
export const useFieldSettingsTitle = (type: FieldType | undefined) => {
  const { _ } = useLingui();

  return type ? _(FieldSettingsTypeTranslations[type]) : '';
};

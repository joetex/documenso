import { RVHOOP_FIELD_BY_TOKEN } from '@documenso/lib/constants/rvhoop-fields';
import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  type TTextFieldMeta as TextFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { DatabaseIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorGenericFontSizeField,
  EditorGenericLetterSpacingField,
  EditorGenericLineHeightField,
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from './editor-field-generic-field-forms';

const ZTextFieldFormSchema = ZTextFieldMeta.pick({
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
}).refine(
  (data) => {
    // A read-only field must have text
    return !data.readOnly || (data.text && data.text.length > 0);
  },
  {
    message: 'A read-only field must have text',
    path: ['text'],
  },
);

type TTextFieldFormSchema = z.infer<typeof ZTextFieldFormSchema>;

type EditorFieldTextFormProps = {
  value: TextFieldMeta | undefined;
  onValueChange: (value: TextFieldMeta) => void;
};

export const EditorFieldTextForm = ({
  value = {
    type: 'text',
  },
  onValueChange,
}: EditorFieldTextFormProps) => {
  const { t } = useLingui();

  const form = useForm<TTextFieldFormSchema>({
    resolver: zodResolver(ZTextFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      placeholder: value.placeholder || '',
      text: value.text || '',
      characterLimit: value.characterLimit || 0,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      lineHeight: value.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT,
      letterSpacing: value.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING,
      verticalAlign: value.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
      required: value.required || false,
      readOnly: value.readOnly || false,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZTextFieldFormSchema.safeParse(formValues);

    if (formValues.readOnly && !formValues.text) {
      void form.trigger('text');
    }

    if (validatedFormValues.success) {
      onValueChange({
        type: 'text',
        ...validatedFormValues.data,
        // RVHOOP FORK ADDITION. The form schema is a `pick` of the text meta, so
        // anything it does not list is dropped from the object emitted here — and
        // this effect runs on MOUNT, meaning merely selecting a field would strip
        // its RVHoop binding without the manager touching a single control.
        // Carried through explicitly rather than added to the pick: the binding is
        // placed by the palette and is not a control on this form.
        ...(value.rvhoop ? { rvhoop: value.rvhoop } : {}),
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          {/*
            RVHOOP FORK ADDITION. Without this the panel looks like any other
            text field, and the obvious thing to do with "Add text" is to type
            the value in — which RVHoop then overwrites at send time. Say so.
          */}
          {value.rvhoop && (
            <div className="mb-1 rounded-md border border-border bg-muted/50 p-2.5">
              <p className="flex items-center gap-x-1.5 font-medium text-foreground text-xs">
                <DatabaseIcon className="h-3.5 w-3.5 shrink-0" />
                <Trans>Filled by RVHoop</Trans>
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                {RVHOOP_FIELD_BY_TOKEN[value.rvhoop.token]?.description ?? (
                  <Trans>This field is filled from the booking when the document is sent.</Trans>
                )}
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                <Trans>
                  The text below is only a placeholder — it is replaced with the real value, so there is no need to type
                  one.
                </Trans>
              </p>
            </div>
          )}

          <EditorGenericFontSizeField className="w-full" formControl={form.control} />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericTextAlignField className="w-full" formControl={form.control} />

            <EditorGenericVerticalAlignField className="w-full" formControl={form.control} />
          </div>

          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Label</Trans>
                </FormLabel>
                <FormControl>
                  <Input data-testid="field-form-label" placeholder={t`Field label`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Placeholder</Trans>
                </FormLabel>
                <FormControl>
                  <Input data-testid="field-form-placeholder" placeholder={t`Field placeholder`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Add text</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="field-form-text"
                    className="h-auto"
                    placeholder={t`Add text to the field`}
                    {...field}
                    onChange={(e) => {
                      const values = form.getValues();
                      const characterLimit = values.characterLimit || 0;
                      let textValue = e.target.value;

                      if (characterLimit > 0 && textValue.length > characterLimit) {
                        textValue = textValue.slice(0, characterLimit);
                      }

                      e.target.value = textValue;
                      field.onChange(e);
                    }}
                    rows={1}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="characterLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Character Limit</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-form-characterLimit"
                    className="bg-background"
                    placeholder={t`Character limit`}
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => {
                      const values = form.getValues();
                      const characterLimit = parseInt(e.target.value, 10) || 0;

                      field.onChange(characterLimit || '');

                      const textValue = values.text || '';

                      if (characterLimit > 0 && textValue.length > characterLimit) {
                        form.setValue('text', textValue.slice(0, characterLimit));
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericLineHeightField className="w-full" formControl={form.control} />

            <EditorGenericLetterSpacingField className="w-full" formControl={form.control} />
          </div>

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>

          <EditorGenericReadOnlyField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};

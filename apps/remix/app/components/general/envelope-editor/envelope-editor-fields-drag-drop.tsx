import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { type RvhoopFieldDef, rvhoopPlaceholder } from '@documenso/lib/constants/rvhoop-fields';
import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_META_DEFAULT_VALUES,
  type TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { RvhoopFieldPalette } from '@documenso/ui/primitives/document-flow/rvhoop-field-palette';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import {
  CalendarIcon,
  CheckSquareIcon,
  ContactIcon,
  DiscIcon,
  HashIcon,
  ListIcon,
  MailIcon,
  TextIcon,
  UserIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

// RVHOOP FORK ADDITION. An RVHoop field arrives already holding its value, so it
// drops at a size that value fits in rather than at the blank-field default — a
// park address or an itemized breakdown landing in a 90×30 box means the manager
// resizes every single field they place.
const RVHOOP_WIDTH_PX = 150;
const RVHOOP_BLOCK_WIDTH_PX = 260;
const RVHOOP_BLOCK_HEIGHT_PX = 92;

/**
 * RVHOOP FORK ADDITION. The fieldMeta a palette field is placed with.
 *
 * Read-only because every catalogued field restates a term RVHoop's billing
 * engine already froze — there is nothing for a signer to enter, and one who
 * could edit "Monthly Rate" on the way past would be agreeing to a figure that
 * will never be charged. Never `required`, because Documenso treats read-only
 * and required as a contradiction and refuses to save it. And the placeholder
 * text is load-bearing in both directions: Documenso rejects a read-only field
 * with no text, and a document raised outside RVHoop should read as visibly
 * unfilled rather than print an empty box where the rent belongs.
 */
export const rvhoopFieldMeta = (field: RvhoopFieldDef): TTextFieldMeta => ({
  type: 'text',
  label: field.label,
  text: rvhoopPlaceholder(field.label),
  readOnly: true,
  required: false,
  fontSize: DEFAULT_FIELD_FONT_SIZE,
  textAlign: 'left',
  rvhoop: { token: field.token },
});

export const fieldButtonList = [
  {
    type: FieldType.SIGNATURE,
    icon: SignatureIcon,
    name: msg`Signature`,
    className: 'font-signature text-lg',
  },
  {
    type: FieldType.EMAIL,
    icon: MailIcon,
    name: msg`Email`,
  },
  {
    type: FieldType.NAME,
    icon: UserIcon,
    name: msg`Name`,
  },
  {
    type: FieldType.INITIALS,
    icon: ContactIcon,
    name: msg`Initials`,
  },
  {
    type: FieldType.DATE,
    icon: CalendarIcon,
    name: msg`Date`,
  },
  {
    type: FieldType.TEXT,
    icon: TextIcon,
    name: msg`Text`,
  },
  {
    type: FieldType.NUMBER,
    icon: HashIcon,
    name: msg`Number`,
  },
  {
    type: FieldType.RADIO,
    icon: DiscIcon,
    name: msg`Radio`,
  },
  {
    type: FieldType.CHECKBOX,
    icon: CheckSquareIcon,
    name: msg`Checkbox`,
  },
  {
    type: FieldType.DROPDOWN,
    icon: ListIcon,
    name: msg`Dropdown`,
  },
];

type EnvelopeEditorFieldDragDropProps = {
  selectedRecipientId: number | null;
  selectedEnvelopeItemId: string | null;
};

export const EnvelopeEditorFieldDragDrop = ({
  selectedRecipientId,
  selectedEnvelopeItemId,
}: EnvelopeEditorFieldDragDropProps) => {
  const { envelope, editorFields, isTemplate, getRecipientColorKey } = useCurrentEnvelopeEditor();

  const { t } = useLingui();

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  // RVHOOP FORK ADDITION. Set alongside selectedField when the armed field came
  // from the RVHoop palette; it is what turns a plain TEXT drop into a bound,
  // read-only one. Cleared wherever the selection is (see clearSelectedField).
  const [selectedRvhoopField, setSelectedRvhoopField] = useState<RvhoopFieldDef | null>(null);

  const { isWithinPageBounds, getPage } = useDocumentElement();

  const isFieldsDisabled = useMemo(() => {
    const selectedSigner = envelope.recipients.find((recipient) => recipient.id === selectedRecipientId);
    const fields = envelope.fields;

    if (!selectedSigner) {
      return true;
    }

    // Allow fields to be modified for templates regardless of anything.
    if (isTemplate) {
      return false;
    }

    return !canRecipientFieldsBeModified(selectedSigner, fields);
  }, [selectedRecipientId, envelope.recipients, envelope.fields]);

  const [isFieldWithinBounds, setIsFieldWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: 0,
    width: 0,
  });

  // RVHOOP FORK ADDITION. The size the armed field should drop at, when it isn't
  // the default. It lives in a ref rather than in fieldBounds directly because
  // the MutationObserver below rewrites fieldBounds on every DOM mutation — a
  // size written straight into fieldBounds is gone by the next render.
  const pendingFieldBounds = useRef<{ height: number; width: number } | null>(null);

  const defaultFieldBounds = () => ({ height: DEFAULT_HEIGHT_PX, width: DEFAULT_WIDTH_PX });

  // RVHOOP FORK ADDITION. Arming a field type drops the current selection, which
  // takes the floating settings panel down with it. Without this the panel sits
  // over the page while the author is trying to click a spot on it, and swallows
  // the placement click.
  const clearFieldSelection = useCallback(() => editorFields.setSelectedField(null), [editorFields]);

  const onRvhoopFieldSelect = useCallback(
    (field: RvhoopFieldDef) => {
      pendingFieldBounds.current = field.block
        ? { height: RVHOOP_BLOCK_HEIGHT_PX, width: RVHOOP_BLOCK_WIDTH_PX }
        : { height: DEFAULT_HEIGHT_PX, width: RVHOOP_WIDTH_PX };
      fieldBounds.current = pendingFieldBounds.current;

      clearFieldSelection();
      setSelectedRvhoopField(field);
      setSelectedField(FieldType.TEXT);
    },
    [clearFieldSelection],
  );

  // Every path that drops or abandons the armed field goes through here, so an
  // RVHoop selection can never leak into the next plain field the manager places.
  const clearSelectedField = useCallback(() => {
    pendingFieldBounds.current = null;
    fieldBounds.current = defaultFieldBounds();
    setSelectedRvhoopField(null);
    setSelectedField(null);
  }, []);

  const onFieldTypeSelect = useCallback(
    (type: FieldType) => {
      pendingFieldBounds.current = null;
      fieldBounds.current = defaultFieldBounds();
      clearFieldSelection();
      setSelectedRvhoopField(null);
      setSelectedField(type);
    },
    [clearFieldSelection],
  );

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsFieldWithinBounds(
        isWithinPageBounds(event, PDF_VIEWER_PAGE_SELECTOR, fieldBounds.current.width, fieldBounds.current.height),
      );

      setCoords({
        x: event.clientX - fieldBounds.current.width / 2,
        y: event.clientY - fieldBounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedField || !selectedRecipientId || !selectedEnvelopeItemId) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(event, PDF_VIEWER_PAGE_SELECTOR, fieldBounds.current.width, fieldBounds.current.height)
      ) {
        clearSelectedField();
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);

      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      // Calculate x and y as a percentage of the page width and height
      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      // Get the bounds as a percentage of the page width and height
      const fieldPageWidth = (fieldBounds.current.width / width) * 100;
      const fieldPageHeight = (fieldBounds.current.height / height) * 100;

      // And center it based on the bounds
      pageX -= fieldPageWidth / 2;
      pageY -= fieldPageHeight / 2;

      const field = {
        formId: nanoid(12),
        envelopeItemId: selectedEnvelopeItemId,
        type: selectedField,
        page: pageNumber,
        positionX: pageX,
        positionY: pageY,
        width: fieldPageWidth,
        height: fieldPageHeight,
        recipientId: selectedRecipientId,
        // RVHOOP FORK ADDITION: a palette field is fully configured at drop time.
        fieldMeta: selectedRvhoopField
          ? rvhoopFieldMeta(selectedRvhoopField)
          : structuredClone(FIELD_META_DEFAULT_VALUES[selectedField]),
      };

      editorFields.addField(field);

      setIsFieldWithinBounds(false);
      clearSelectedField();
    },
    [
      isWithinPageBounds,
      selectedField,
      selectedRvhoopField,
      selectedRecipientId,
      selectedEnvelopeItemId,
      getPage,
      editorFields,
      clearSelectedField,
    ],
  );

  useEffect(() => {
    const observer = new MutationObserver((_mutations) => {
      const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

      if (!$page) {
        return;
      }

      // RVHOOP FORK ADDITION: honour the armed field's own size instead of
      // stamping the default back over it on the next DOM mutation.
      fieldBounds.current = pendingFieldBounds.current ?? {
        height: Math.max(DEFAULT_HEIGHT_PX),
        width: Math.max(DEFAULT_WIDTH_PX),
      };
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedField) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedField]);

  const selectedRecipientStyles = useMemo(
    () => getRecipientColorStyles(getRecipientColorKey(selectedRecipientId ?? -1)),
    [selectedRecipientId, getRecipientColorKey],
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        {fieldButtonList.map((field) => (
          <button
            disabled={isFieldsDisabled}
            key={field.type}
            type="button"
            onClick={() => onFieldTypeSelect(field.type)}
            onMouseDown={() => onFieldTypeSelect(field.type)}
            data-selected={selectedField === field.type && !selectedRvhoopField ? true : undefined}
            className={cn(
              'group flex h-12 cursor-pointer items-center justify-center rounded-lg border border-border px-4 transition-colors',
              selectedRecipientStyles.fieldButton,
            )}
          >
            <p
              className={cn(
                'flex items-center justify-center gap-x-1.5 font-normal font-noto text-muted-foreground text-sm group-data-[selected]:text-foreground',
                field.className,
                selectedRecipientStyles.fieldButtonText,
              )}
            >
              {field.type !== FieldType.SIGNATURE && <field.icon className="h-4 w-4" />}
              {t(field.name)}
            </p>
          </button>
        ))}
      </div>

      {/*
        RVHOOP FORK ADDITION. Below the generic field types deliberately: a
        manager reaching for a signature or a date still finds those first, and
        the pre-populated fields then read as what they are — a shortcut past
        retyping data RVHoop already holds — rather than as a competing set of
        primitives.
      */}
      <RvhoopFieldPalette
        disabled={isFieldsDisabled}
        selectedToken={selectedRvhoopField?.token ?? null}
        onSelect={onRvhoopFieldSelect}
      />

      {selectedField && (
        <div
          className={cn(
            'pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center rounded-[2px] bg-white font-noto text-muted-foreground ring-2 transition duration-200 [container-type:size] dark:text-muted',
            selectedRecipientStyles.base,
            selectedField === FieldType.SIGNATURE && 'font-signature',
            {
              '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isFieldWithinBounds,
              'dark:text-black/60': isFieldWithinBounds,
            },
          )}
          style={{
            top: coords.y,
            left: coords.x,
            height: fieldBounds.current.height,
            width: fieldBounds.current.width,
          }}
        >
          <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
            {/* An RVHoop field reads as what it holds, not as "Text". */}
            {selectedRvhoopField?.label ?? t(FRIENDLY_FIELD_TYPE[selectedField])}
          </span>
        </div>
      )}
    </>
  );
};

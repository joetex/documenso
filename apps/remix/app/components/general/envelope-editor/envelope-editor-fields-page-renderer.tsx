import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import {
  RVHOOP_FIELD_GROUPS,
  RVHOOP_FIELDS,
  type RvhoopFieldDef,
} from '@documenso/lib/constants/rvhoop-fields';
import {
  FIELD_DEFAULT_LINE_HEIGHT,
  FIELD_META_DEFAULT_VALUES,
  FIELD_MIN_LINE_HEIGHT,
  MIN_FIELD_FONT_SIZE,
  type TFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
import { MIN_FIELD_HEIGHT_PX } from '@documenso/lib/universal/field-renderer/field-renderer';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { getOverlappingFieldPairs } from '@documenso/lib/utils/fields-overlap';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { cn } from '@documenso/ui/lib/utils';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyPlusIcon,
  DatabaseIcon,
  ShapesIcon,
  SquareStackIcon,
  TrashIcon,
  UserCircleIcon,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { EnvelopeEditorFieldSettings, useFieldSettingsTitle } from './envelope-editor-field-settings';
import { fieldButtonList, rvhoopFieldMeta } from './envelope-editor-fields-drag-drop';
import { EnvelopeRecipientSelectorCommand } from './envelope-recipient-selector';

/**
 * RVHOOP FORK ADDITION. The pre-populated field catalog, grouped once for the
 * "Change Field Type" list rather than filtered on every keystroke.
 */
const RVHOOP_FIELDS_BY_GROUP = RVHOOP_FIELD_GROUPS.map((group) => ({
  group,
  fields: RVHOOP_FIELDS.filter((field) => field.group === group),
})).filter((entry) => entry.fields.length > 0);

/**
 * RVHOOP FORK ADDITION. Geometry for the floating panel that hangs off the
 * selected field: the gap between it and the field, how close to the edge of the
 * window it may come, and the band its settings box is allowed to grow within
 * before it starts scrolling inside itself.
 */
const HUD_GAP_PX = 8;
const HUD_VIEWPORT_MARGIN_PX = 8;
const HUD_MIN_SETTINGS_HEIGHT_PX = 220;
const HUD_MAX_HEIGHT_PX = 520;

/**
 * RVHOOP FORK ADDITION. Where the floating panel is on screen, in viewport
 * pixels: the horizontal centre of the field, and its top and bottom edges.
 */
type FieldHudAnchor = {
  centerX: number;
  top: number;
  bottom: number;
};

/**
 * RVHOOP FORK ADDITION. Whether a pointer event landed on something the canvas
 * owns — a field, or one of the transformer's resize handles.
 *
 * Dragging the page now pans it, and the one thing that must not do is pan while
 * the author is trying to drag a field across the paper. The DOM can't answer
 * this (every field on a page is the same one canvas element), so ask Konva: the
 * hit canvas already knows what is under that pixel.
 */
export const isPointerOverEditorField = (event: MouseEvent): boolean => {
  const container = (event.target as HTMLElement | null)?.closest?.('.konva-container');

  if (!container) {
    return false;
  }

  const stage = Konva.stages.find((candidate) => candidate.container() === container);

  if (!stage) {
    return false;
  }

  const rect = stage.content.getBoundingClientRect();

  return Boolean(stage.getIntersection({ x: event.clientX - rect.left, y: event.clientY - rect.top }));
};

/**
 * RVHOOP FORK ADDITION. The largest font size that still fits a field this tall,
 * or null when the field's own size already fits.
 *
 * Templates are laid over documents that were typeset by somebody else, and the
 * lines an author drops a field onto are frequently set smaller than the 12pt a
 * field is born with. Before this, every one of those fields had to be resized
 * *and* then have a font size typed into it — twice the work, once per field,
 * and the number is a guess until you look at the result.
 *
 * Only ever downwards. Growing a field back would overwrite a size the author
 * chose on purpose, and a deliberately small font in a tall box is exactly how a
 * multi-line text field is built.
 *
 * `fieldHeightPx` is in unscaled page units, which are the same units the font
 * size is in — both are PDF points — so the comparison holds at any zoom.
 */
const fitFontSizeToHeight = (fieldMeta: TFieldMetaSchema | null | undefined, fieldHeightPx: number): number | null => {
  if (!fieldMeta || typeof fieldMeta.fontSize !== 'number') {
    return null;
  }

  const lineHeight = 'lineHeight' in fieldMeta ? fieldMeta.lineHeight || FIELD_DEFAULT_LINE_HEIGHT : undefined;

  const fitted = Math.floor(fieldHeightPx / Math.max(lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT, FIELD_MIN_LINE_HEIGHT));

  const next = Math.max(MIN_FIELD_FONT_SIZE, Math.min(fieldMeta.fontSize, fitted));

  return next < fieldMeta.fontSize ? next : null;
};

export const EnvelopeEditorFieldsPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { i18n } = useLingui();
  const { envelope, editorFields, getRecipientColorKey } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();

  const interactiveTransformer = useRef<Transformer | null>(null);

  const [selectedKonvaFieldGroups, setSelectedKonvaFieldGroups] = useState<Konva.Group[]>([]);

  const [isFieldChanging, setIsFieldChanging] = useState(false);

  /**
   * Whether the field was automatically selected on creation (drag-drop or marquee).
   *
   * We purposefully supress the floating toolbar for newly created fields.
   */
  const [isAutoSelectedField, setIsAutoSelectedField] = useState(false);

  const { stage, pageLayer, konvaContainer, scaledViewport, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => createPageCanvas(stage, pageLayer),
    pageData,
  );

  const { scale, pageNumber } = pageData;

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageNumber, currentEnvelopeItem?.id],
  );

  /**
   * Debounce the fields used for overlap highlighting so we don't recompute on every
   * small drag/resize tick. Overlaps only occur within the same page and envelope
   * item, so computing from this page's fields alone is sufficient.
   */
  const debouncedPageFields = useDebouncedValue(localPageFields, 300);

  const overlappingFieldFormIds = useMemo(() => {
    const formIds = new Set<string>();

    const pairs = getOverlappingFieldPairs(
      debouncedPageFields.map((field) => ({
        id: field.formId,
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
      })),
    );

    for (const pair of pairs) {
      formIds.add(pair.fieldA.id);
      formIds.add(pair.fieldB.id);
    }

    return formIds;
  }, [debouncedPageFields]);

  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    const isDragEvent = event.type === 'dragend';

    const fieldGroup = event.target as Konva.Group;
    const fieldFormId = fieldGroup.id();

    // Note: This values are scaled.
    const {
      width: fieldPixelWidth,
      height: fieldPixelHeight,
      x: fieldX,
      y: fieldY,
    } = fieldGroup.getClientRect({
      skipStroke: true,
      skipShadow: true,
    });

    const pageHeight = scaledViewport.height;
    const pageWidth = scaledViewport.width;

    // Calculate x and y as a percentage of the page width and height
    const positionPercentX = (fieldX / pageWidth) * 100;
    const positionPercentY = (fieldY / pageHeight) * 100;

    // Get the bounds as a percentage of the page width and height
    const fieldPageWidth = (fieldPixelWidth / pageWidth) * 100;
    const fieldPageHeight = (fieldPixelHeight / pageHeight) * 100;

    const fieldUpdates: Partial<TLocalField> = {
      positionX: positionPercentX,
      positionY: positionPercentY,
    };

    // Do not update the width/height unless the field has actually been resized.
    // This is because our calculations will shift the width/height slightly
    // due to the way we convert between pixel and percentage.
    if (!isDragEvent) {
      fieldUpdates.width = fieldPageWidth;
      fieldUpdates.height = fieldPageHeight;

      // RVHOOP FORK ADDITION: a field dragged down to fit a line of small print
      // takes its type size with it.
      const existingMeta = editorFields.getFieldByFormId(fieldFormId)?.fieldMeta;
      const fittedFontSize = fitFontSizeToHeight(existingMeta, (fieldPageHeight / 100) * unscaledViewport.height);

      if (existingMeta && fittedFontSize !== null) {
        fieldUpdates.fieldMeta = { ...existingMeta, fontSize: fittedFontSize };
      }
    }

    editorFields.updateFieldByFormId(fieldFormId, fieldUpdates);

    // Select the field if it is not already selected.
    if (isDragEvent && interactiveTransformer.current?.nodes().length === 0) {
      setSelectedFields([fieldGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  /**
   * Draws (or removes) a dashed warning outline over a field that significantly
   * overlaps another field. The highlight is a child of the field group so it moves
   * and resizes with the field, and sits on top of the field's own rect (which is
   * re-styled on every render and would otherwise clobber a direct stroke change).
   */
  const syncOverlapHighlight = (fieldGroup: Konva.Group, isOverlapping: boolean) => {
    const existingHighlight = fieldGroup.findOne('.field-overlap-highlight');

    // Skip while a field is actively being dragged/resized. The highlight is driven
    // by debounced field data, so it would lag behind and distort during the gesture.
    // It is repainted once the gesture settles (the effect re-runs on isFieldChanging).
    if (isFieldChanging) {
      existingHighlight?.destroy();
      return;
    }

    if (!isOverlapping) {
      existingHighlight?.destroy();
      return;
    }

    const fieldRect = fieldGroup.findOne('.field-rect');

    if (!fieldRect) {
      return;
    }

    const highlightAttrs = {
      x: 0,
      y: 0,
      width: fieldRect.width(),
      height: fieldRect.height(),
      stroke: '#f59e0b',
      strokeWidth: 2,
      dash: [6, 4],
      cornerRadius: 2,
      strokeScaleEnabled: false,
      listening: false,
    } satisfies Partial<Konva.RectConfig>;

    if (existingHighlight instanceof Konva.Rect) {
      existingHighlight.setAttrs(highlightAttrs);
      existingHighlight.moveToTop();
      return;
    }

    const highlight = new Konva.Rect({
      name: 'field-overlap-highlight',
      ...highlightAttrs,
    });

    fieldGroup.add(highlight);
    highlight.moveToTop();
  };

  const unsafeRenderFieldOnLayer = (field: TLocalField) => {
    if (!pageLayer.current) {
      return;
    }

    const recipient = envelope.recipients.find((r) => r.id === field.recipientId);
    const isFieldEditable = recipient !== undefined && canRecipientFieldsBeModified(recipient, envelope.fields);

    const { fieldGroup } = renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: field.formId,
        ...field,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color: getRecipientColorKey(field.recipientId),
      editable: isFieldEditable,
      mode: 'edit',
    });

    syncOverlapHighlight(fieldGroup, overlappingFieldFormIds.has(field.formId));

    if (!isFieldEditable) {
      return;
    }

    fieldGroup.off('click');
    fieldGroup.off('transformend');
    fieldGroup.off('dragend');

    // Set up field selection. Shift + click toggles this field in/out of the current
    // multi-selection, so fields can be added to a group by clicking them -- which
    // is now the only way to build one, the marquee having made way for panning.
    // A plain click (no modifier) selects just this field.
    fieldGroup.on('click', (event) => {
      const isMultiSelectModifier = event.evt.shiftKey;

      if (isMultiSelectModifier) {
        const currentNodes = interactiveTransformer.current?.nodes() ?? [];
        const isAlreadySelected = currentNodes.includes(fieldGroup);

        setSelectedFields(
          isAlreadySelected ? currentNodes.filter((node) => node !== fieldGroup) : [...currentNodes, fieldGroup],
        );
      } else {
        setSelectedFields([fieldGroup]);
      }

      pageLayer.current?.batchDraw();
    });

    fieldGroup.on('transformend', handleResizeOrMove);
    fieldGroup.on('dragend', handleResizeOrMove);
  };

  const renderFieldOnLayer = (field: TLocalField) => {
    try {
      unsafeRenderFieldOnLayer(field);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    // Initialize snap guides layer
    // snapGuideLayer.current = initializeSnapGuides(stage.current);

    // Add transformer for resizing and rotating.
    interactiveTransformer.current = createInteractiveTransformer(currentStage, currentPageLayer);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Handle stage click to deselect.
    currentStage.on('mousedown', (e) => {
      if (e.target === stage.current) {
        setSelectedFields([]);
        currentPageLayer.batchDraw();
      }
    });

    // When an item is dragged, select it automatically.
    const onDragStartOrEnd = (e: KonvaEventObject<Event>) => {
      if (!e.target.hasName('field-group')) {
        return;
      }

      setIsFieldChanging(e.type === 'dragstart');

      const itemAlreadySelected = (interactiveTransformer.current?.nodes() || []).includes(e.target);

      // Do nothing and allow the transformer to handle it.
      // Required so when multiple items are selected, this won't deselect them.
      if (itemAlreadySelected) {
        return;
      }

      setSelectedFields([e.target]);
    };

    currentStage.on('dragstart', onDragStartOrEnd);
    currentStage.on('dragend', onDragStartOrEnd);
    currentStage.on('transformstart', () => setIsFieldChanging(true));
    currentStage.on('transformend', () => setIsFieldChanging(false));

    currentPageLayer.batchDraw();
  };

  /**
   * Creates an interactive transformer for the fields.
   *
   * Allows:
   * - Resizing
   * - Moving
   *
   * RVHOOP FORK ADDITION. It no longer draws a marquee rectangle across the
   * page, which used to do two things: select every field it touched, and — on
   * empty paper — offer to create a field the size of the box just drawn. Both
   * are gone, because dragging across the page is now how you move a zoomed-in
   * page around, and panning a document you cannot otherwise reach is worth more
   * than either. Nothing is lost outright: shift+click still adds a field to the
   * selection, and the palette still places fields.
   */
  const createInteractiveTransformer = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: false,
      shouldOverdrawWholeArea: true,
      ignoreStroke: true,
      flipEnabled: false,
      boundBoxFunc: (oldBox, newBox) => {
        // Enforce minimum size.
        //
        // RVHOOP FORK ADDITION: the height floor is now a floor on the FIELD, not
        // on the screen. It was a flat 20 screen pixels, which on a page drawn at
        // the usual scale is around 15pt of document — taller than the type on the
        // lines these fields are being sized onto, so a field could not be made to
        // fit one however hard you tried. Expressed in page units it also gets
        // finer as you zoom in, which is the right way round: that is exactly when
        // an author is working on something small.
        if (newBox.width < 30 || newBox.height < MIN_FIELD_HEIGHT_PX * scale) {
          return oldBox;
        }

        return newBox;
      },
    });

    currentPageLayer.add(transformer);

    // Clicking empty stage area clears the selection. Field clicks -- including
    // Shift+click multi-select -- are handled by each field group's own click
    // handler in `unsafeRenderFieldOnLayer`.
    currentStage.on('click tap', (e) => {
      if (e.target === stage.current) {
        setSelectedFields([]);
      }
    });

    return transformer;
  };

  /**
   * Render fields when they are added or removed from the localFields.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // If doesn't exist in localFields, destroy it since it's been deleted.
    pageLayer.current.find('Group').forEach((group) => {
      if (group.name() === 'field-group' && !localPageFields.some((field) => field.formId === group.id())) {
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      renderFieldOnLayer(field);
    });

    // Reconcile selection state with live field nodes after flush/sync updates.
    const liveSelectedFieldGroups = selectedKonvaFieldGroups.filter((fieldGroup) => {
      if (!fieldGroup.getStage() || !fieldGroup.getParent()) {
        return false;
      }

      return localPageFields.some((field) => field.formId === fieldGroup.id());
    });

    if (liveSelectedFieldGroups.length !== selectedKonvaFieldGroups.length) {
      setSelectedFields(liveSelectedFieldGroups);
    }

    // Mirror the editor's single selected field onto the canvas (Konva) selection.
    //
    // `addField` already marks a newly created field as the selected field, so this
    // makes a field placed via the palette (drag-drop) or marquee creation show its
    // resize handles immediately -- no second click needed. It also clears the canvas
    // selection when the selected field is cleared (e.g. when the author starts
    // placing another field), so the floating action toolbar can't intercept the next
    // placement click. Runs after the render loop above so the field's group exists.
    const selectedFormId = editorFields.selectedField?.formId ?? null;
    const isSingleCanvasSelection = selectedKonvaFieldGroups.length === 1;

    if (selectedFormId && localPageFields.some((field) => field.formId === selectedFormId)) {
      const isAlreadySelected = isSingleCanvasSelection && selectedKonvaFieldGroups[0].id() === selectedFormId;

      if (!isAlreadySelected) {
        const fieldGroupToSelect = pageLayer.current.findOne(`#${selectedFormId}`);

        if (fieldGroupToSelect instanceof Konva.Group) {
          setSelectedFields([fieldGroupToSelect], { isAutoSelect: true });
        }
      }
    } else if (selectedFormId === null && isSingleCanvasSelection) {
      setSelectedFields([]);
    }

    // Rerender the transformer
    interactiveTransformer.current?.forceUpdate();

    pageLayer.current.batchDraw();
  }, [
    localPageFields,
    selectedKonvaFieldGroups,
    overlappingFieldFormIds,
    isFieldChanging,
    editorFields.selectedField?.formId,
  ]);

  const setSelectedFields = (nodes: Konva.Node[], options?: { isAutoSelect?: boolean }) => {
    // Any explicit (user-driven) selection shows the action toolbar; only auto-selection
    // on field creation suppresses it.
    setIsAutoSelectedField(Boolean(options?.isAutoSelect));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fieldGroups = nodes.filter(
      (node) => node.hasName('field-group') && Boolean(node.getStage()) && Boolean(node.getParent()),
    ) as Konva.Group[];

    interactiveTransformer.current?.nodes(fieldGroups);
    setSelectedKonvaFieldGroups(fieldGroups);

    if (fieldGroups.length === 0 || fieldGroups.length > 1) {
      editorFields.setSelectedField(null);
    }

    // Handle single field selection.
    if (fieldGroups.length === 1) {
      const fieldGroup = fieldGroups[0];

      editorFields.setSelectedField(fieldGroup.id());
      fieldGroup.moveToTop();
    }
  };

  const deletedSelectedFields = () => {
    const fieldFormids = selectedKonvaFieldGroups.map((field) => field.id()).filter((field) => field !== undefined);

    editorFields.removeFieldsByFormId(fieldFormids);

    setSelectedFields([]);
  };

  const changeSelectedFieldsRecipients = (recipientId: number) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      if (field.recipientId !== recipientId) {
        editorFields.updateFieldByFormId(field.formId, { recipientId, id: undefined });
      }
    }
  };

  const changeSelectedFieldsType = (type: FieldType) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      if (field.type !== type) {
        editorFields.updateFieldByFormId(field.formId, {
          type,
          fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
          id: undefined,
        });
      }
    }
  };

  /**
   * RVHOOP FORK ADDITION. Turn the selected fields into pre-populated RVHoop
   * fields — the same thing the palette places, applied to a box that is already
   * on the page and already the right size and shape.
   *
   * The type size and alignment are carried over rather than reset. Fitting a
   * field to a line of someone else's small print is work, and swapping which
   * value prints in it is no reason to throw that work away.
   */
  const changeSelectedFieldsToRvhoopField = (rvhoopField: RvhoopFieldDef) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      const existing = field.fieldMeta;
      const meta = rvhoopFieldMeta(rvhoopField);

      editorFields.updateFieldByFormId(field.formId, {
        type: FieldType.TEXT,
        fieldMeta: {
          ...meta,
          fontSize: typeof existing?.fontSize === 'number' ? existing.fontSize : meta.fontSize,
          textAlign: existing && 'textAlign' in existing && existing.textAlign ? existing.textAlign : meta.textAlign,
        },
        id: undefined,
      });
    }
  };

  const duplicatedSelectedFields = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateField(field);
    }
  };

  const duplicatedSelectedFieldsOnAllPages = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateFieldToAllPages(field);
    }

    setSelectedFields([]);
  };

  /**
   * RVHOOP FORK ADDITION. Where the floating panel should sit, in viewport
   * pixels, or null when there is nothing to hang it off.
   *
   * Read live rather than held in state: it is called again on every scroll and
   * resize, and re-rendering the settings form sixty times a second to move a box
   * eight pixels is not a trade worth making.
   *
   * The transformer's client rect is already in the stage's scaled pixels, which
   * are the container's own CSS pixels — so the container's position on screen
   * plus that box is the field's position on screen, at any zoom.
   */
  const getFieldHudAnchor = useCallback((): FieldHudAnchor | null => {
    const container = konvaContainer.current;
    const transformer = interactiveTransformer.current;

    if (!container || !transformer || transformer.nodes().length === 0) {
      return null;
    }

    const box = transformer.getClientRect();
    const containerRect = container.getBoundingClientRect();

    const top = containerRect.top + box.y;
    const bottom = top + box.height;

    // The field has been scrolled out of the window; so has its panel.
    if (bottom < 0 || top > window.innerHeight) {
      return null;
    }

    return {
      centerX: containerRect.left + box.x + box.width / 2,
      top,
      bottom,
    };
  }, [konvaContainer]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <>
      {/*
        RVHOOP FORK ADDITION. Rendered into the body and positioned against the
        window rather than absolutely inside the page. A panel tall enough to hold
        a field's settings, hung off a field near the bottom of the last page,
        would otherwise run off the end of the scrollable area and be unreachable
        — and a zoomed-in page now scrolls sideways inside a box that would clip
        it too.
      */}
      {selectedKonvaFieldGroups.length > 0 &&
        interactiveTransformer.current &&
        !isFieldChanging &&
        !isAutoSelectedField &&
        createPortal(
          <FieldActionHud
            getAnchor={getFieldHudAnchor}
            handleDuplicateSelectedFields={duplicatedSelectedFields}
            handleDuplicateSelectedFieldsOnAllPages={duplicatedSelectedFieldsOnAllPages}
            handleDeleteSelectedFields={deletedSelectedFields}
            handleChangeRecipient={changeSelectedFieldsRecipients}
            handleChangeFieldType={changeSelectedFieldsType}
            handleChangeToRvhoopField={changeSelectedFieldsToRvhoopField}
            selectedFieldFormId={selectedKonvaFieldGroups.map((field) => field.id())}
          />,
          document.body,
        )}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};

type FieldActionHudProps = {
  /** RVHOOP FORK ADDITION. Where to hang the panel; see getFieldHudAnchor. */
  getAnchor: () => FieldHudAnchor | null;
  handleDuplicateSelectedFields: () => void;
  handleDuplicateSelectedFieldsOnAllPages: () => void;
  handleDeleteSelectedFields: () => void;
  handleChangeRecipient: (recipientId: number) => void;
  handleChangeFieldType: (type: FieldType) => void;
  /** RVHOOP FORK ADDITION. Swap the selection to a pre-populated RVHoop field. */
  handleChangeToRvhoopField: (field: RvhoopFieldDef) => void;
  selectedFieldFormId: string[];
};

const FieldActionHud = ({
  getAnchor,
  handleDuplicateSelectedFields,
  handleDuplicateSelectedFieldsOnAllPages,
  handleDeleteSelectedFields,
  handleChangeRecipient,
  handleChangeFieldType,
  handleChangeToRvhoopField,
  selectedFieldFormId,
}: FieldActionHudProps) => {
  const { t } = useLingui();

  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [showFieldTypeSelector, setShowFieldTypeSelector] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  const { editorFields, envelope, isTemplate } = useCurrentEnvelopeEditor();

  const hudRef = useRef<HTMLDivElement>(null);

  /**
   * RVHOOP FORK ADDITION. The settings only make sense for one field at a time —
   * with several selected the toolbar's bulk actions are the whole story.
   */
  const settingsField = selectedFieldFormId.length === 1 ? editorFields.selectedField : null;
  const settingsTitle = useFieldSettingsTitle(settingsField?.type);

  /**
   * Keep the panel pinned to its field, and no taller than the room it has.
   *
   * Written straight onto the node instead of through state: this runs on every
   * scroll frame, and the settings form underneath has no business re-rendering
   * because the window moved.
   */
  useLayoutEffect(() => {
    const el = hudRef.current;

    if (!el) {
      return;
    }

    const apply = (property: 'top' | 'bottom' | 'left' | 'maxHeight' | 'visibility', value: string) => {
      if (el.style[property] !== value) {
        el.style[property] = value;
      }
    };

    const position = () => {
      const anchor = getAnchor();

      if (!anchor) {
        apply('visibility', 'hidden');
        return;
      }

      apply('visibility', 'visible');

      const spaceBelow = window.innerHeight - anchor.bottom - HUD_GAP_PX - HUD_VIEWPORT_MARGIN_PX;
      const spaceAbove = anchor.top - HUD_GAP_PX - HUD_VIEWPORT_MARGIN_PX;

      // Flip above the field only when below genuinely can't hold the settings
      // and above can do better — a panel that jumps sides on every scroll tick
      // is harder to use than one that scrolls internally.
      const placeAbove = spaceBelow < HUD_MIN_SETTINGS_HEIGHT_PX && spaceAbove > spaceBelow;
      const available = Math.max(placeAbove ? spaceAbove : spaceBelow, 96);

      apply('maxHeight', `${Math.min(HUD_MAX_HEIGHT_PX, available)}px`);

      if (placeAbove) {
        apply('top', 'auto');
        apply('bottom', `${Math.round(window.innerHeight - anchor.top + HUD_GAP_PX)}px`);
      } else {
        apply('bottom', 'auto');
        apply('top', `${Math.round(anchor.bottom + HUD_GAP_PX)}px`);
      }

      // Centred on the field, then held inside the window so a field near either
      // margin doesn't push its own settings off the screen.
      const halfWidth = el.offsetWidth / 2;
      const left = Math.min(
        Math.max(anchor.centerX, HUD_VIEWPORT_MARGIN_PX + halfWidth),
        window.innerWidth - HUD_VIEWPORT_MARGIN_PX - halfWidth,
      );

      apply('left', `${Math.round(left)}px`);
    };

    position();

    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);

    // The panel changes width when it opens, collapses, or swaps field type.
    const observer = new ResizeObserver(position);
    observer.observe(el);

    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      observer.disconnect();
    };
  }, [getAnchor]);

  /**
   * Decide the preselected field type in the command input.
   *
   * If all fields share the same type, use that as the default selection.
   * Otherwise show no preselection.
   */
  const preselectedFieldType = useMemo(() => {
    if (selectedFieldFormId.length === 0) {
      return null;
    }

    const fields = editorFields.localFields.filter((field) => selectedFieldFormId.includes(field.formId));

    if (fields.length === 0) {
      return null;
    }

    const firstType = fields[0].type;
    const isTypesSame = fields.every((field) => field.type === firstType);

    return isTypesSame ? firstType : null;
  }, [editorFields.localFields, selectedFieldFormId]);

  /**
   * Decide the preselected recipient in the command input.
   *
   * If all fields belong to the same recipient then use that recipient as the default.
   *
   * Otherwise show the placeholder.
   */
  const preselectedRecipient = useMemo(() => {
    if (selectedFieldFormId.length === 0) {
      return null;
    }

    const fields = editorFields.localFields.filter((field) => selectedFieldFormId.includes(field.formId));

    if (fields.length === 0) {
      return null;
    }

    const recipient = envelope.recipients.find((recipient) => recipient.id === fields[0].recipientId);

    if (!recipient) {
      return null;
    }

    const isRecipientsSame = fields.every((field) => field.recipientId === recipient.id);

    if (isRecipientsSame) {
      return recipient;
    }

    return null;
  }, [editorFields.localFields, envelope.recipients, selectedFieldFormId]);

  // RVHOOP FORK ADDITION. The bar was 24px buttons around 12px icons, which is
  // under every touch-target guideline going and fiddly with a mouse besides.
  const toolbarButtonClassName =
    'flex h-9 w-9 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-white/10 hover:text-white';

  return (
    <div ref={hudRef} className="fixed z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center">
      <div className="group flex w-fit flex-shrink-0 items-center justify-evenly gap-x-1 rounded-lg border bg-gray-900 p-1 shadow-lg">
        <button
          type="button"
          title={t`Change Recipient`}
          className={toolbarButtonClassName}
          onClick={() => setShowRecipientSelector(true)}
          onTouchEnd={() => setShowRecipientSelector(true)}
        >
          <UserCircleIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          title={t`Change Field Type`}
          className={toolbarButtonClassName}
          onClick={() => setShowFieldTypeSelector(true)}
          onTouchEnd={() => setShowFieldTypeSelector(true)}
        >
          <ShapesIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          title={t`Duplicate`}
          className={toolbarButtonClassName}
          onClick={handleDuplicateSelectedFields}
          onTouchEnd={handleDuplicateSelectedFields}
        >
          <CopyPlusIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          title={t`Duplicate on all pages`}
          className={toolbarButtonClassName}
          onClick={handleDuplicateSelectedFieldsOnAllPages}
          onTouchEnd={handleDuplicateSelectedFieldsOnAllPages}
        >
          <SquareStackIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          title={t`Remove`}
          className={toolbarButtonClassName}
          onClick={handleDeleteSelectedFields}
          onTouchEnd={handleDeleteSelectedFields}
        >
          <TrashIcon className="h-5 w-5" />
        </button>

        {settingsField && (
          <button
            type="button"
            title={isSettingsOpen ? t`Hide field settings` : t`Show field settings`}
            className={cn(toolbarButtonClassName, 'ml-0.5 border-white/10 border-l')}
            // Click only, unlike its neighbours: a toggle wired to both handlers
            // fires twice on a touch device and lands back where it started.
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            {isSettingsOpen ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/*
        RVHOOP FORK ADDITION. The settings, compacted onto the page beside the
        field they belong to. It scrolls inside itself once it runs out of the
        room the panel was given, so the last control is always reachable.
      */}
      {settingsField && isSettingsOpen && (
        <div className="mt-1.5 flex min-h-0 w-72 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <h3 className="flex-shrink-0 border-border border-b px-3 py-2 font-semibold text-foreground text-xs">
            {settingsTitle}
          </h3>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 [&_.h-10]:h-8 [&_fieldset]:gap-2 [&_input]:text-xs [&_label]:text-[11px] [&_textarea]:text-xs">
            <EnvelopeEditorFieldSettings key={settingsField.formId} />
          </div>
        </div>
      )}

      <CommandDialog position="start" open={showRecipientSelector} onOpenChange={setShowRecipientSelector}>
        <EnvelopeRecipientSelectorCommand
          placeholder={t`Select a recipient`}
          selectedRecipient={preselectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            editorFields.setSelectedRecipient(recipient.id);
            handleChangeRecipient(recipient.id);
            setShowRecipientSelector(false);
          }}
          recipients={envelope.recipients}
          fields={envelope.fields}
          // RVHOOP FORK ADDITION: a template's recipients are numbered slots.
          usePlaceholderLabels={isTemplate}
        />
      </CommandDialog>

      <CommandDialog position="start" open={showFieldTypeSelector} onOpenChange={setShowFieldTypeSelector}>
        <Command defaultValue={preselectedFieldType ? t(FRIENDLY_FIELD_TYPE[preselectedFieldType]) : undefined}>
          <CommandInput placeholder={t`Select a field type`} />

          <CommandList>
            <CommandEmpty>
              <span className="inline-block px-4 text-muted-foreground">
                {t`No field type matching this description was found.`}
              </span>
            </CommandEmpty>

            <CommandGroup>
              {fieldButtonList.map((field) => {
                const FieldIcon = field.icon;
                const label = t(FRIENDLY_FIELD_TYPE[field.type]);

                return (
                  <CommandItem
                    key={field.type}
                    className="px-2"
                    onSelect={() => {
                      handleChangeFieldType(field.type);
                      setShowFieldTypeSelector(false);
                    }}
                  >
                    <FieldIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/*
              RVHOOP FORK ADDITION. The pre-populated fields, offered here as
              well as in the palette. Retyping a field's position and size just
              to change which value prints in it is the kind of work this palette
              exists to avoid — and "what is this box actually going to say?" is
              the question an author asks with the box already in front of them.

              Searched by group and token as well as label, so "rate", "monthly"
              and "lease.monthlyRate" all reach the same field.
            */}
            {RVHOOP_FIELDS_BY_GROUP.map(({ group, fields }) => (
              <CommandGroup key={group}>
                <div className="mt-2 mb-1 ml-2 font-medium text-muted-foreground text-xs">
                  {group} <span className="opacity-60">({t`RVHoop`})</span>
                </div>

                {fields.map((field) => (
                  <CommandItem
                    key={field.token}
                    className="px-2"
                    value={`${group} ${field.label} ${field.token}`}
                    onSelect={() => {
                      handleChangeToRvhoopField(field);
                      setShowFieldTypeSelector(false);
                    }}
                  >
                    <DatabaseIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{field.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
};

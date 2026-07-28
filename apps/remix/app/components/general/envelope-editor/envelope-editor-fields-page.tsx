import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_ERROR_MESSAGES } from '@documenso/lib/constants/pdf-viewer-i18n';
import type { NormalizedFieldWithContext } from '@documenso/lib/server-only/ai/envelope/detect-fields/types';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { getEnvelopeItemPermissions } from '@documenso/lib/utils/envelope';
import { getOverlappingFieldPairs } from '@documenso/lib/utils/fields-overlap';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentStatus, RecipientRole } from '@prisma/client';
import { AlertTriangleIcon, FileTextIcon, PencilIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRevalidator } from 'react-router';

import { AiFeaturesEnableDialog } from '~/components/dialogs/ai-features-enable-dialog';
import { AiFieldDetectionDialog } from '~/components/dialogs/ai-field-detection-dialog';
import { EnvelopeItemEditDialog } from '~/components/dialogs/envelope-item-edit-dialog';
import { EnvelopePdfViewer } from '~/components/general/pdf-viewer/envelope-pdf-viewer';
import { PdfViewerOverlay } from '~/components/general/pdf-viewer/pdf-viewer-overlay';
import { PdfZoomControl, usePdfZoom } from '~/components/general/pdf-viewer/pdf-zoom-control';
import { useDragToPan } from '~/components/general/pdf-viewer/use-drag-to-pan';
import { useCurrentTeam } from '~/providers/team';

import { EnvelopeEditorFieldDragDrop } from './envelope-editor-fields-drag-drop';
import { EnvelopeEditorFieldsPageRenderer, isPointerOverEditorField } from './envelope-editor-fields-page-renderer';
import { EnvelopeEditorInvalidDirectTemplateAlert } from './envelope-editor-invalid-direct-template-alert';
import { EnvelopeRendererFileSelector } from './envelope-file-selector';
import { EnvelopeRecipientSelector } from './envelope-recipient-selector';

export const EnvelopeEditorFieldsPage = () => {
  const team = useCurrentTeam();

  const scrollableContainerRef = useRef<HTMLDivElement>(null);

  const { envelope, editorFields, navigateToStep, editorConfig, isTemplate } = useCurrentEnvelopeEditor();

  const { currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  const { _ } = useLingui();

  const [isAiFieldDialogOpen, setIsAiFieldDialogOpen] = useState(false);
  const [isAiEnableDialogOpen, setIsAiEnableDialogOpen] = useState(false);
  const { revalidate } = useRevalidator();

  // RVHOOP FORK ADDITION. Placing a field on a page of small print means reading
  // the small print first, and the page only ever got the width the editor had
  // left over after the sidebar.
  const { zoom, zoomIn, zoomOut, resetZoom, canZoomIn, canZoomOut } = usePdfZoom();

  // RVHOOP FORK ADDITION. Drag anywhere to move around a zoomed page — across
  // the paper included, now that the marquee is gone. The one exception is a
  // drag that starts on a field or a resize handle, which is the author moving
  // or resizing it and has nothing to do with the page underneath.
  useDragToPan(scrollableContainerRef, {
    shouldStartPrimaryPan: (event) => !isPointerOverEditorField(event),
  });

  const envelopeItemPermissions = useMemo(
    () => getEnvelopeItemPermissions(envelope, envelope.recipients),
    [envelope, envelope.recipients],
  );

  /**
   * Debounce the fields used for overlap detection so we don't recompute on every
   * small drag/resize movement, which is expensive on large field counts and can
   * bog down lower-end devices.
   */
  const debouncedLocalFields = useDebouncedValue(editorFields.localFields, 300);

  /**
   * Fields that significantly overlap each other. Overlapping fields render poorly in
   * the editor and can behave unexpectedly during signing, so we warn the author here.
   */
  const overlappingFieldPairs = useMemo(
    () =>
      getOverlappingFieldPairs(
        debouncedLocalFields.map((field) => ({
          id: field.formId,
          envelopeItemId: field.envelopeItemId,
          page: field.page,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
        })),
      ),
    [debouncedLocalFields],
  );

  const handleReviewOverlappingField = () => {
    const firstPair = overlappingFieldPairs[0];

    if (!firstPair) {
      return;
    }

    const targetField = editorFields.localFields.find((field) => field.formId === firstPair.fieldA.id);

    if (!targetField) {
      return;
    }

    if (targetField.envelopeItemId !== currentEnvelopeItem?.id) {
      setCurrentEnvelopeItem(targetField.envelopeItemId);
    }

    editorFields.setSelectedField(targetField.formId);
  };

  const onFieldDetectionComplete =(fields: NormalizedFieldWithContext[]) => {
    for (const field of fields) {
      editorFields.addField({
        height: field.height,
        width: field.width,
        positionX: field.positionX,
        positionY: field.positionY,
        type: field.type,
        envelopeItemId: field.envelopeItemId,
        recipientId: field.recipientId,
        page: field.pageNumber,
        fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[field.type]),
      });
    }

    setIsAiFieldDialogOpen(false);
  };

  /**
   * Set the selected recipient to the first recipient in the envelope.
   */
  useEffect(() => {
    const firstSelectableRecipient = envelope.recipients.find(
      (recipient) => recipient.role === RecipientRole.SIGNER || recipient.role === RecipientRole.APPROVER,
    );

    editorFields.setSelectedRecipient(firstSelectableRecipient?.id ?? null);
  }, []);

  const onDetectClick = () => {
    if (!team.preferences.aiFeaturesEnabled) {
      setIsAiEnableDialogOpen(true);
      return;
    }

    setIsAiFieldDialogOpen(true);
  };

  const onAiFeaturesEnabled = () => {
    void revalidate().then(() => {
      setIsAiEnableDialogOpen(false);
      setIsAiFieldDialogOpen(true);
    });
  };

  return (
    <div className="relative flex h-full">
      {/* RVHOOP FORK ADDITION: overflow-x, so a zoomed-in page has somewhere to scroll to. */}
      <div className="flex h-full w-full flex-col overflow-x-auto overflow-y-auto px-2" ref={scrollableContainerRef}>
        {/* Horizontal envelope item selector */}
        <EnvelopeRendererFileSelector
          className="px-0"
          fields={editorFields.localFields}
          renderItemAction={
            editorConfig.envelopeItems !== null &&
            editorConfig.envelopeItems.allowReplace &&
            envelopeItemPermissions.canFileBeChanged
              ? (item) => (
                  <div className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                    <div
                      className={cn('h-2 w-2 rounded-full transition-opacity duration-150 group-hover:opacity-0', {
                        'bg-green-500': currentEnvelopeItem?.id === item.id,
                      })}
                    />
                    <EnvelopeItemEditDialog
                      envelopeItem={item}
                      allowConfigureTitle={editorConfig.envelopeItems?.allowConfigureTitle ?? false}
                      trigger={
                        <span
                          className="absolute inset-0 flex cursor-pointer items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`envelope-item-edit-button-${item.id}`}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </span>
                      }
                    />
                  </div>
                )
              : undefined
          }
        />

        <EnvelopeEditorInvalidDirectTemplateAlert />

        {/* Document View */}
        <div className="mt-4 flex h-full flex-col items-center justify-center">
          {envelope.recipients.length === 0 && (
            <Alert
              variant="neutral"
              className="mb-4 flex max-w-[800px] flex-row items-center justify-between space-y-0 rounded-sm border border-border bg-background"
            >
              <div className="flex flex-col gap-1">
                <AlertTitle>
                  <Trans>Missing Recipients</Trans>
                </AlertTitle>
                <AlertDescription>
                  <Trans>You need at least one recipient to add fields</Trans>
                </AlertDescription>
              </div>

              <Button variant="outline" onClick={() => void navigateToStep('upload')}>
                <Trans>Add Recipients</Trans>
              </Button>
            </Alert>
          )}

          {overlappingFieldPairs.length > 0 && (
            <Alert
              variant="warning"
              className="mt-20 mb-4 flex w-full max-w-[800px] flex-row items-center justify-between space-y-0 rounded-sm"
            >
              <div className="flex flex-row items-start gap-3">
                <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />

                <div className="flex flex-col gap-1">
                  <AlertTitle>
                    <Trans>Overlapping fields detected</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      Some fields are placed on top of each other. This may complicate the signing process or cause
                      fields to not work as expected.
                    </Trans>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {currentEnvelopeItem !== null ? (
            <EnvelopePdfViewer
              customPageRenderer={EnvelopeEditorFieldsPageRenderer}
              scrollParentRef={scrollableContainerRef}
              errorMessage={PDF_VIEWER_ERROR_MESSAGES.editor}
              zoom={zoom}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-32">
              <FileTextIcon className="h-10 w-10 text-muted-foreground" />
              <p className="mt-1 text-foreground text-sm">
                <Trans>No documents found</Trans>
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                <Trans>Please upload a document to continue</Trans>
              </p>
            </div>
          )}
        </div>

        {/*
          RVHOOP FORK ADDITION. Run-off at the end of the document, so the zoom
          control — which hangs over this corner permanently — isn't sitting on
          top of the last page once you reach the bottom.
        */}
        {currentEnvelopeItem !== null && <div className="h-20 flex-shrink-0" aria-hidden="true" />}
      </div>

      {/*
        RVHOOP FORK ADDITION. Anchored to the viewer's bottom-right corner and
        left there: still reachable on page nine, and still in the corner after
        the page has been zoomed in and dragged sideways.
      */}
      {currentEnvelopeItem !== null && (
        <PdfViewerOverlay containerRef={scrollableContainerRef}>
          <PdfZoomControl
            className="pointer-events-auto"
            zoom={zoom}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
          />
        </PdfViewerOverlay>
      )}

      {/* Right Section - Form Fields Panel */}
      {currentEnvelopeItem && envelope.recipients.length > 0 && (
        <div className="sticky top-0 h-full w-80 flex-shrink-0 overflow-y-auto border-border border-l bg-background py-4">
          {/* Recipient selector section. */}
          <section className="px-4">
            <h3 className="mb-2 font-semibold text-foreground text-sm">
              <Trans>Selected Recipient</Trans>
            </h3>

            <EnvelopeRecipientSelector
              selectedRecipient={editorFields.selectedRecipient}
              onSelectedRecipientChange={(recipient) => editorFields.setSelectedRecipient(recipient.id)}
              recipients={envelope.recipients}
              fields={envelope.fields}
              className="w-full"
              align="end"
              // RVHOOP FORK ADDITION: a template's recipients are numbered slots.
              usePlaceholderLabels={isTemplate}
            />

            {editorFields.selectedRecipient &&
              !canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields) && (
                <Alert className="mt-4" variant="warning">
                  <AlertDescription>
                    <Trans>
                      This recipient can no longer be modified as they have signed a field, or completed the document.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}
          </section>

          <Separator className="my-4" />

          {/* Add fields section. */}
          <section className="px-4">
            <h3 className="mb-2 font-semibold text-foreground text-sm">
              <Trans>Add Fields</Trans>
            </h3>

            <EnvelopeEditorFieldDragDrop
              selectedRecipientId={editorFields.selectedRecipient?.id ?? null}
              selectedEnvelopeItemId={currentEnvelopeItem?.id ?? null}
            />

            {editorConfig.fields?.allowAIDetection && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={onDetectClick}
                  disabled={envelope.status !== DocumentStatus.DRAFT}
                  title={
                    envelope.status !== DocumentStatus.DRAFT
                      ? _(msg`You can only detect fields in draft envelopes`)
                      : undefined
                  }
                >
                  <SparklesIcon className="mr-2 -ml-1 h-4 w-4" />
                  <Trans>Detect with AI</Trans>
                </Button>

                <AiFieldDetectionDialog
                  open={isAiFieldDialogOpen}
                  onOpenChange={setIsAiFieldDialogOpen}
                  onComplete={onFieldDetectionComplete}
                  envelopeId={envelope.id}
                  teamId={envelope.teamId}
                />

                <AiFeaturesEnableDialog
                  open={isAiEnableDialogOpen}
                  onOpenChange={setIsAiEnableDialogOpen}
                  onEnabled={onAiFeaturesEnabled}
                />
              </>
            )}
          </section>

          {/*
            RVHOOP FORK ADDITION. The selected field's settings used to sit here,
            below the field buttons and the RVHoop palette — which is a long way
            down once the palette is in the way. They now hang off the field
            itself; see envelope-editor-fields-page-renderer.tsx.
          */}
        </div>
      )}
    </div>
  );
};

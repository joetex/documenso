/**
 * RVHOOP FORK ADDITION — zoom for the PDF viewer.
 *
 * The viewer draws a page at whatever width it is given, which on a phone, in a
 * booking page's signing frame, or in the field editor beside a 320px sidebar is
 * often too small to read a lease's small print. Zoom re-rasterises the page at
 * the larger scale rather than stretching the bitmap, so the text gets sharper
 * as it gets bigger.
 *
 * `usePdfZoom` holds the level and `PdfZoomControl` is the widget; they are
 * separate because the level belongs to the screen (which also has to hand it to
 * the viewer) while the widget belongs wherever that screen has room for it.
 */
import { cn } from '@documenso/ui/lib/utils';
import { useLingui } from '@lingui/react/macro';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

/**
 * The levels the buttons step through. 1 is "fit the viewer", which is what the
 * viewer did before zoom existed and is therefore where everything starts.
 */
export const PDF_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;

export const usePdfZoom = (initialZoom = 1) => {
  const [zoom, setZoom] = useState(initialZoom);

  const step = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = PDF_ZOOM_LEVELS.findIndex((level) => level >= current - 0.001);
      const nextIndex = Math.min(
        PDF_ZOOM_LEVELS.length - 1,
        Math.max(0, (index === -1 ? PDF_ZOOM_LEVELS.length - 1 : index) + direction),
      );

      return PDF_ZOOM_LEVELS[nextIndex];
    });
  }, []);

  return useMemo(
    () => ({
      zoom,
      setZoom,
      zoomIn: () => step(1),
      zoomOut: () => step(-1),
      resetZoom: () => setZoom(1),
      canZoomIn: zoom < PDF_ZOOM_LEVELS[PDF_ZOOM_LEVELS.length - 1],
      canZoomOut: zoom > PDF_ZOOM_LEVELS[0],
    }),
    [zoom, step],
  );
};

export type PdfZoomControlProps = {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
};

export const PdfZoomControl = ({
  zoom,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}: PdfZoomControlProps) => {
  const { t } = useLingui();

  const buttonClassName =
    'flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      className={cn(
        'flex items-center gap-x-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-md backdrop-blur',
        className,
      )}
    >
      <button type="button" className={buttonClassName} onClick={onZoomOut} disabled={!canZoomOut} title={t`Zoom out`}>
        <MinusIcon className="h-4 w-4" />
        <span className="sr-only">{t`Zoom out`}</span>
      </button>

      <button
        type="button"
        // Doubles as the readout, so the widget stays three controls wide.
        className="min-w-[3.25rem] rounded-md px-1 py-1 text-center font-medium text-foreground text-xs tabular-nums transition-colors hover:bg-muted"
        onClick={onReset}
        title={t`Reset zoom`}
      >
        {Math.round(zoom * 100)}%
      </button>

      <button type="button" className={buttonClassName} onClick={onZoomIn} disabled={!canZoomIn} title={t`Zoom in`}>
        <PlusIcon className="h-4 w-4" />
        <span className="sr-only">{t`Zoom in`}</span>
      </button>
    </div>
  );
};

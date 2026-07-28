/**
 * RVHOOP FORK ADDITION — a control parked over the bottom-right of a PDF viewer.
 *
 * This exists because `position: sticky` cannot do it. A sticky box is only ever
 * shifted *within its containing block*, and here that block is the scroll
 * container's content box — which is the width of the visible area, not the
 * width of a zoomed-in page. So the moment the page is panned sideways the
 * sticky box runs out of room to be shifted into and slides away with the
 * content, which is exactly what the zoom bar was doing.
 *
 * Anchoring to the viewport instead: the overlay is `position: fixed`, portalled
 * out to the body so no transformed or clipping ancestor can catch it, and its
 * box is written from the scroll container's own rectangle on every scroll,
 * resize and layout change. It therefore sits over the container's bottom-right
 * corner and stays there, whatever is happening inside.
 */
import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { cn } from '@documenso/ui/lib/utils';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Gap between the overlay and the container's bottom-right corner. */
const OVERLAY_INSET_PX = 16;

export type PdfViewerOverlayProps = {
  /** The scrolling element the overlay should hug. */
  containerRef: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
};

export const PdfViewerOverlay = ({ containerRef, className, children }: PdfViewerOverlayProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  /**
   * There is no `document` to portal into on the server, and the signing page —
   * unlike the editor, which waits on a query before it renders anything — is
   * server-rendered. Reaching for `document.body` during that render throws, and
   * the embed's error boundary turns any throw at all into a bare "Not Found",
   * which is a long way from "a zoom button failed to mount".
   */
  const isMounted = useIsMounted();

  useEffect(() => {
    const overlay = overlayRef.current;
    const container = containerRef.current;

    if (!overlay || !container) {
      return;
    }

    const apply = (property: 'left' | 'bottom' | 'width' | 'visibility', value: string) => {
      if (overlay.style[property] !== value) {
        overlay.style[property] = value;
      }
    };

    const position = () => {
      const rect = container.getBoundingClientRect();

      // The step isn't on screen — neither is anything it would sit over.
      if (rect.width === 0 || rect.height === 0) {
        apply('visibility', 'hidden');
        return;
      }

      apply('visibility', 'visible');
      apply('left', `${Math.round(rect.left)}px`);
      apply('width', `${Math.round(rect.width)}px`);
      apply('bottom', `${Math.round(Math.max(window.innerHeight - rect.bottom, 0) + OVERLAY_INSET_PX)}px`);
    };

    position();

    // Capture, so a scroll in any ancestor counts — the container moves with the
    // page even when it is not the thing being scrolled.
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);

    // Catches the sidebar being collapsed, which changes what the viewer is wide.
    const observer = new ResizeObserver(position);
    observer.observe(container);

    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      observer.disconnect();
    };
  }, [containerRef, isMounted]);

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      // Nothing here should intercept a click meant for the page; the control
      // inside turns pointer events back on for itself.
      className={cn('pointer-events-none fixed z-40 flex justify-end px-4', className)}
      style={{ visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
};

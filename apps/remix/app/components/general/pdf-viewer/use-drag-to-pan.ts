/**
 * RVHOOP FORK ADDITION — drag the page to move around it.
 *
 * Once a page is zoomed past the width of its viewer, the only ways left to
 * reach the right-hand side of it are a scrollbar pinned to the bottom of a
 * window-height box and shift+wheel. Neither is what anyone reaches for: the
 * gesture people expect from a zoomed document is to grab it and pull.
 *
 * Two ways in, because the left button is already spoken for in the editor
 * (where dragging across the page draws a marquee selection) but free in the
 * signing view:
 *
 *   - Middle button, anywhere. Nothing else in either view uses it, so this is
 *     swallowed outright — the canvas underneath never hears about it.
 *   - Left button, where the caller says it's allowed (`shouldStartPrimaryPan`).
 *     This one is deliberately NOT swallowed: in the signing view a click on a
 *     field is how a signer signs it, and a canvas that never sees the mousedown
 *     never fires the click that follows.
 *
 * Panning only arms itself when the container actually overflows, so at the
 * default zoom — where nothing overflows — neither button behaves any
 * differently than it did before.
 */
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/** How far the pointer must travel before a click becomes a pan. */
const PAN_THRESHOLD_PX = 4;

const MIDDLE_BUTTON = 1;
const PRIMARY_BUTTON = 0;

export type DragToPanOptions = {
  /**
   * Whether the left button may start a pan, and from where.
   *
   * Omitted, the left button is left alone entirely and only the middle button
   * pans. Return false for targets that own their own drag gesture.
   */
  shouldStartPrimaryPan?: (event: MouseEvent) => boolean;
};

export const useDragToPan = (scrollRef: RefObject<HTMLElement | null>, options: DragToPanOptions = {}) => {
  // Held in a ref so callers can pass an inline predicate without the listeners
  // being torn down and rebuilt on every render — which, mid-drag, would drop
  // the pan on the floor.
  const shouldStartPrimaryPanRef = useRef(options.shouldStartPrimaryPan);
  shouldStartPrimaryPanRef.current = options.shouldStartPrimaryPan;

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    let origin: {
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
      isPanning: boolean;
    } | null = null;

    const previousCursor = element.style.cursor;
    const previousUserSelect = element.style.userSelect;

    const canPan = () => element.scrollWidth > element.clientWidth + 1;

    const stopPanning = () => {
      element.style.cursor = previousCursor;
      element.style.userSelect = previousUserSelect;

      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!origin) {
        return;
      }

      const deltaX = event.clientX - origin.x;
      const deltaY = event.clientY - origin.y;

      if (!origin.isPanning) {
        if (Math.abs(deltaX) < PAN_THRESHOLD_PX && Math.abs(deltaY) < PAN_THRESHOLD_PX) {
          return;
        }

        origin.isPanning = true;
        element.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
      }

      element.scrollLeft = origin.scrollLeft - deltaX;
      element.scrollTop = origin.scrollTop - deltaY;

      event.preventDefault();
    };

    const onMouseUp = () => {
      const didPan = origin?.isPanning ?? false;

      origin = null;
      stopPanning();

      if (!didPan) {
        return;
      }

      // The click that closes a real drag is not a click on anything. Swallow
      // exactly one, and only if it arrives immediately.
      const swallowClick = (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
      };

      window.addEventListener('click', swallowClick, { capture: true, once: true });

      setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (origin || !canPan()) {
        return;
      }

      const shouldStartPrimaryPan = shouldStartPrimaryPanRef.current;

      const isMiddleButton = event.button === MIDDLE_BUTTON;
      const isPrimaryPan =
        event.button === PRIMARY_BUTTON && shouldStartPrimaryPan !== undefined && shouldStartPrimaryPan(event);

      if (!isMiddleButton && !isPrimaryPan) {
        return;
      }

      origin = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        isPanning: false,
      };

      if (isMiddleButton) {
        // Keeps the browser's own middle-click autoscroll out of it, and stops
        // the canvas below from treating it as a gesture of its own.
        event.preventDefault();
        event.stopPropagation();
      }

      window.addEventListener('mousemove', onMouseMove, true);
      window.addEventListener('mouseup', onMouseUp, true);
    };

    element.addEventListener('mousedown', onMouseDown, true);

    return () => {
      element.removeEventListener('mousedown', onMouseDown, true);

      origin = null;
      stopPanning();
    };
  }, [scrollRef]);
};

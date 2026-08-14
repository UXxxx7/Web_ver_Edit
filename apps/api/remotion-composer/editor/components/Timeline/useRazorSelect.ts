import { useCallback, useRef } from "react";
import { normalizeCuts, outputToSource, type VideoCut } from "../../../src/cuts";

/**
 * Click-drag range selection for the razor tool — press on the Video/Audio
 * lane, drag across the section to remove, release to cut it immediately.
 * Mirrors usePlayheadScrub.ts's coordinate math exactly (same anchor: the
 * .timeline__scroll container, same `clientX -> OUTPUT frame` formula) but
 * drives a visual selection rectangle instead of the playhead, and commits
 * a cut to the existing (ripple-delete) cuts model on release instead of a
 * seek. The overlay is written straight to the DOM via a ref during the
 * drag, not React state — same reasoning as usePlayheadScrub avoiding
 * state: this can fire every pointermove, and re-rendering the whole
 * timeline that often would be wasteful.
 */
export function useRazorSelect({
  scrollRef,
  labelWidth,
  pxPerFrameRef,
  durationInFrames,
  sourceDurationFrames,
  cuts,
  onCutsChange,
  overlayRef,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  labelWidth: number;
  /** Read via a ref for the same reason usePlayheadScrub's is — an rAF
   *  callback can fire after several re-renders already happened this
   *  gesture, and a stale closure would use a stale zoom level. */
  pxPerFrameRef: React.RefObject<number>;
  /** OUTPUT-space timeline length, for clamping a click position. */
  durationInFrames: number;
  /** SOURCE-space (pre-cut) video length — normalizeCuts needs this, not
   *  the OUTPUT length above. */
  sourceDurationFrames: number;
  cuts: VideoCut[];
  onCutsChange: (next: VideoCut[]) => void;
  overlayRef: React.RefObject<HTMLElement | null>;
}) {
  const dragging = useRef(false);
  const startFrame = useRef(0);
  const rafPending = useRef(false);
  const lastClientX = useRef(0);

  const frameFromClientX = useCallback((clientX: number): number => {
    const scrollEl = scrollRef.current;
    const pxPerFrame = pxPerFrameRef.current || 1;
    if (!scrollEl) return 0;
    const rect = scrollEl.getBoundingClientRect();
    const x = clientX - rect.left + scrollEl.scrollLeft - labelWidth;
    const frame = Math.round(x / pxPerFrame);
    return Math.max(0, Math.min(frame, Math.max(0, durationInFrames - 1)));
  }, [scrollRef, labelWidth, pxPerFrameRef, durationInFrames]);

  const paintOverlay = useCallback((a: number, b: number) => {
    const el = overlayRef.current;
    if (!el) return;
    const pxPerFrame = pxPerFrameRef.current || 1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    el.style.display = "block";
    el.style.left = `${labelWidth + lo * pxPerFrame}px`;
    el.style.width = `${Math.max(1, (hi - lo) * pxPerFrame)}px`;
  }, [overlayRef, labelWidth, pxPerFrameRef]);

  const hideOverlay = useCallback(() => {
    const el = overlayRef.current;
    if (el) el.style.display = "none";
  }, [overlayRef]);

  const scheduleApply = useCallback(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      if (dragging.current) paintOverlay(startFrame.current, frameFromClientX(lastClientX.current));
    });
  }, [paintOverlay, frameFromClientX]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    dragging.current = true;
    startFrame.current = frameFromClientX(e.clientX);
    lastClientX.current = e.clientX;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not critical */ }
    paintOverlay(startFrame.current, startFrame.current);
  }, [frameFromClientX, paintOverlay]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    e.preventDefault();
    lastClientX.current = e.clientX;
    scheduleApply();
  }, [scheduleApply]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    hideOverlay();
    const endFrame = frameFromClientX(e.clientX);
    const loOut = Math.min(startFrame.current, endFrame);
    const hiOut = Math.max(startFrame.current, endFrame);
    // A plain click (no meaningful drag) shouldn't create a zero-length cut.
    if (hiOut - loOut < 1) return;
    const fromSource = outputToSource(loOut, cuts);
    const toSource = outputToSource(hiOut, cuts);
    onCutsChange(normalizeCuts([...cuts, { fromFrame: fromSource, toFrame: toSource }], sourceDurationFrames));
  }, [frameFromClientX, hideOverlay, cuts, onCutsChange, sourceDurationFrames]);

  // Same reasoning as usePlayheadScrub's cancelScrub — a second finger
  // promoting to a pinch mid-drag must drop the in-flight selection instead
  // of committing a half-finished one.
  const cancelDrag = useCallback(() => {
    dragging.current = false;
    hideOverlay();
  }, [hideOverlay]);

  return {
    /** Spread onto the Video/Audio lane tracks only when razor mode is on. */
    razorHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    cancelDrag,
  };
}

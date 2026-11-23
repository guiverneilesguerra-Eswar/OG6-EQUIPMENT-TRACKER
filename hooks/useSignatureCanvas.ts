import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, PanResponder, Platform } from 'react-native';
import type { GestureResponderEvent, View } from 'react-native';
import type { Signature } from '@/services/tracker';
import { beginSignatureStroke, containedSignaturePoint, copySignature, createSignatureSession, endSignatureStroke, moveSignatureStroke, signatureSpace } from '@/services/signatureCanvas';
interface Options {
  value: Signature; onChange: (value: Signature) => void; unlocked: boolean; readOnly: boolean; disabled: boolean;
  onInteractionChange?: (locked: boolean) => void;
}
export function useSignatureCanvas(input: Options) {
  const [expanded, setExpanded] = useState(false); const [isDrawing, setIsDrawing] = useState(false);
  const [drawing, setDrawing] = useState<Signature>(() => copySignature(input.value));
  const session = useRef(createSignatureSession(input.value));
  const bounds = useRef({ ...signatureSpace }); const surface = useRef<View | null>(null);
  const ownUpdates = useRef(new WeakSet<Signature>()); const options = useRef(input); options.current = input;
  const expandedRef = useRef(false); const frame = useRef<number | null>(null);
  const renderInk = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; setDrawing(copySignature(session.current.strokes)); });
  }, []);
  const publish = useCallback(() => {
    const snapshot = copySignature(session.current.strokes);
    ownUpdates.current.add(snapshot); setDrawing(snapshot); options.current.onChange(snapshot);
  }, []);
  // Ignore delayed echoes of our own updates: a stale grant/update must never
  // overwrite the final multi-stroke ink after the pen has been lifted.
  useEffect(() => {
    if (!ownUpdates.current.has(input.value) && session.current.pointerId === null) {
      session.current.strokes = copySignature(input.value); setDrawing(copySignature(input.value));
    }
  }, [input.value]);
  const canDraw = () => options.current.unlocked && !options.current.readOnly && !options.current.disabled;
  const start = useCallback((id: number, x: number, y: number) => {
    if (!canDraw() || !beginSignatureStroke(session.current, id, containedSignaturePoint(x, y, bounds.current.width, bounds.current.height))) return;
    Keyboard.dismiss(); setIsDrawing(true); options.current.onInteractionChange?.(true); renderInk();
  }, [renderInk]);
  const move = useCallback((id: number, x: number, y: number) => {
    if (moveSignatureStroke(session.current, id, containedSignaturePoint(x, y, bounds.current.width, bounds.current.height))) renderInk();
  }, [renderInk]);
  const finishStroke = useCallback((id: number = session.current.pointerId ?? -1) => {
    if (!endSignatureStroke(session.current, id)) return;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    publish(); setIsDrawing(false); options.current.onInteractionChange?.(expandedRef.current);
  }, [publish]);
  const nativePoint = (event: GestureResponderEvent) => ({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: canDraw,
    onStartShouldSetPanResponderCapture: canDraw,
    onMoveShouldSetPanResponder: canDraw,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: event => { const p = nativePoint(event); start(0, p.x, p.y); },
    onPanResponderMove: event => { if ((event.nativeEvent.touches?.length ?? 1) > 1) return; const p = nativePoint(event); move(0, p.x, p.y); },
    onPanResponderRelease: event => { const p = nativePoint(event); move(0, p.x, p.y); finishStroke(0); },
    onPanResponderTerminate: () => finishStroke(0),
  })).current;
  // Native uses the responder system (touch + stylus). Web uses independent
  // browser pointer events and pointer capture for mouse, finger and pen.
  useEffect(() => {
    if (Platform.OS !== 'web' || input.readOnly) return;
    const node = surface.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const previousTouchAction = node.style.touchAction; node.style.touchAction = 'none';
    const locate = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect(); bounds.current = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const down = (event: PointerEvent) => {
      if (!canDraw() || event.button !== 0 || !event.isPrimary || session.current.pointerId !== null) return;
      event.preventDefault(); event.stopPropagation(); const p = locate(event); start(event.pointerId, p.x, p.y);
      try { node.setPointerCapture(event.pointerId); } catch { /* Document listeners retain input when capture is unavailable. */ }
    };
    const moving = (event: PointerEvent) => {
      if (session.current.pointerId !== event.pointerId) return;
      event.preventDefault();
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event]) { const p = locate(sample); move(event.pointerId, p.x, p.y); }
    };
    const up = (event: PointerEvent) => {
      if (session.current.pointerId !== event.pointerId) return;
      event.preventDefault(); const p = locate(event); move(event.pointerId, p.x, p.y); finishStroke(event.pointerId);
      try { if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId); } catch { /* Ink is already committed. */ }
    };
    const cancelled = (event: PointerEvent) => finishStroke(event.pointerId);
    const preventMenu = (event: Event) => { if (canDraw()) event.preventDefault(); };
    node.addEventListener('pointerdown', down, { passive: false });
    document.addEventListener('pointermove', moving, { passive: false });
    document.addEventListener('pointerup', up, { passive: false });
    document.addEventListener('pointercancel', cancelled);
    node.addEventListener('lostpointercapture', cancelled); node.addEventListener('contextmenu', preventMenu);
    // No pointerleave handler: leaving the surface does not erase ink or close it.
    return () => {
      node.style.touchAction = previousTouchAction;
      node.removeEventListener('pointerdown', down); document.removeEventListener('pointermove', moving);
      document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancelled);
      node.removeEventListener('lostpointercapture', cancelled); node.removeEventListener('contextmenu', preventMenu);
    };
  }, [expanded, input.readOnly, start, move, finishStroke]);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Form/navigation interruption preserves ink; it cannot silently discard it.
    if (session.current.pointerId !== null) { session.current.pointerId = null; options.current.onChange(copySignature(session.current.strokes)); }
    options.current.onInteractionChange?.(false);
  }, []);
  const measure = useCallback((width: number, height: number) => { bounds.current = { width: Math.max(1, width), height: Math.max(1, height) }; }, []);
  const toggleExpanded = useCallback(() => {
    if (options.current.disabled || session.current.pointerId !== null) return;
    Keyboard.dismiss(); const next = !expandedRef.current; expandedRef.current = next;
    setExpanded(next); options.current.onInteractionChange?.(next);
  }, []);
  const clear = useCallback(() => {
    if (!canDraw() || session.current.pointerId !== null) return;
    session.current.strokes = []; publish();
  }, [publish]);
  const save = useCallback((onSave: () => void) => {
    if (!canDraw() || session.current.pointerId !== null || !session.current.strokes.some(s => s.length > 2)) return;
    // Completed strokes have already transferred atomically to the parent.
    onSave();
    if (expandedRef.current) { expandedRef.current = false; setExpanded(false); options.current.onInteractionChange?.(false); }
  }, []);
  return { expanded, toggleExpanded, measure, clear, save, surface, responder, isDrawing, shown: input.readOnly ? input.value : drawing };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, PanResponder } from 'react-native';
import type { Signature } from '@/services/tracker';
import { signaturePoint, signatureSpace } from '@/services/signatureCanvas';
interface Options { value: Signature; onChange: (value: Signature) => void; unlocked: boolean; readOnly: boolean; disabled: boolean }
export function useSignatureCanvas({ value, onChange, unlocked, readOnly, disabled }: Options) {
  const [expanded, setExpanded] = useState(false);
  const [drawing, setDrawing] = useState<Signature>(value);
  const strokes = useRef(value); const active = useRef(false);
  const bounds = useRef(signatureSpace);
  const options = useRef({ unlocked, readOnly, onChange }); options.current = { unlocked, readOnly, onChange };
  useEffect(() => { if (!active.current) { strokes.current = value; setDrawing(value); } }, [value]);
  const finishStroke = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    options.current.onChange(strokes.current);
  }, []);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => options.current.unlocked && !options.current.readOnly,
    onMoveShouldSetPanResponder: () => options.current.unlocked && !options.current.readOnly,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: event => {
      if (!options.current.unlocked || options.current.readOnly) return;
      active.current = true;
      const p = signaturePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, bounds.current.width, bounds.current.height);
      strokes.current = [...strokes.current, [p]]; setDrawing(strokes.current);
      // Invalidate the parent's saved state as soon as actual ink changes, not on resize.
      options.current.onChange(strokes.current);
    },
    onPanResponderMove: event => {
      if (!active.current || !options.current.unlocked || options.current.readOnly) return;
      const p = signaturePoint(event.nativeEvent.locationX, event.nativeEvent.locationY, bounds.current.width, bounds.current.height);
      const next = [...strokes.current]; next[next.length - 1] = [...next[next.length - 1], p];
      strokes.current = next; setDrawing(next);
    },
    onPanResponderRelease: finishStroke,
    onPanResponderTerminate: finishStroke,
  })).current;
  const measure = useCallback((width: number, height: number) => { bounds.current = { width: Math.max(1, width), height: Math.max(1, height) }; }, []);
  const toggleExpanded = useCallback(() => {
    if (disabled) return;
    finishStroke(); Keyboard.dismiss(); setExpanded(current => !current);
  }, [disabled, finishStroke]);
  const clear = useCallback(() => {
    if (!options.current.unlocked || options.current.readOnly) return;
    active.current = false; strokes.current = []; setDrawing([]); options.current.onChange([]);
  }, []);
  return { expanded, toggleExpanded, measure, clear, responder, shown: readOnly ? value : drawing };
}

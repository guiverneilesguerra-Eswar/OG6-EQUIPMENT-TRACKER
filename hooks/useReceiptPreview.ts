import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { nextReceiptZoom, receiptPreviewGeometry } from '@/services/receiptPreview';
import type { ReceiptPreviewDocument } from '@/services/receiptPreview';
import { receiptPreviewLayout } from '@/constants/theme';
import { useResponsive } from './useResponsive';

export function useReceiptPreview(document: ReceiptPreviewDocument) {
  const responsive = useResponsive();
  const [viewportWidth, setViewportWidth] = useState(receiptPreviewLayout.initialWidth);
  const [zoom, setZoom] = useState(receiptPreviewLayout.minZoom);
  const [reset, setReset] = useState(0);
  const verticalScroll = useRef<ScrollView | null>(null);
  const horizontalScroll = useRef<ScrollView | null>(null);
  const geometry = useMemo(() => receiptPreviewGeometry(document, viewportWidth, responsive.height, zoom), [document, viewportWidth, responsive.height, zoom]);
  const resetPan = useCallback(() => {
    horizontalScroll.current?.scrollTo({ x: 0, y: 0, animated: false });
    verticalScroll.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, []);
  useEffect(() => { setZoom(receiptPreviewLayout.minZoom); resetPan(); }, [document, resetPan]);
  useEffect(() => { resetPan(); }, [reset, resetPan]);
  const measure = useCallback((width: number) => {
    if (Number.isFinite(width) && width > 0) setViewportWidth(Math.max(1, width));
  }, []);
  const zoomIn = useCallback(() => setZoom(value => nextReceiptZoom(value, 'in')), []);
  const zoomOut = useCallback(() => setZoom(value => nextReceiptZoom(value, 'out')), []);
  const fit = useCallback(() => { setZoom(receiptPreviewLayout.minZoom); setReset(value => value + 1); }, []);
  return {
    geometry, zoom, zoomLabel: `${Math.round(zoom * 100)}%`, measure, zoomIn, zoomOut, fit,
    canZoomIn: zoom < receiptPreviewLayout.maxZoom, canZoomOut: zoom > receiptPreviewLayout.minZoom,
    verticalScroll, horizontalScroll,
  };
}

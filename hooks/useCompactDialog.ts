import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCompactDialogHeight } from '@/services/compactLayout';
import { useResponsive } from './useResponsive';

// Short forms fit their content; longer forms keep a bounded, scrollable body.
export function useCompactDialog(visible: boolean, scrollBody: boolean, requestedHeight?: number) {
  const { height } = useResponsive();
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(64);
  useEffect(() => { if (!visible) setContentHeight(0); }, [visible]);
  const measureContent = useCallback((_width: number, nextHeight: number) => {
    setContentHeight(Math.max(1, Math.ceil(nextHeight)));
  }, []);
  const measureHeader = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(Math.max(1, Math.ceil(event.nativeEvent.layout.height)));
  }, []);
  const panelHeight = getCompactDialogHeight({ viewportHeight: height, insetTop: insets.top, insetBottom: insets.bottom, contentHeight, headerHeight, scrollBody, requestedHeight });
  return { panelHeight, measureContent, measureHeader };
}

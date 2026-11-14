import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import { layout, spacing } from '@/constants/theme';

export function useResponsive() {
  const [dimensions, setDimensions] = useState({ width: 375, height: 667 });
  useEffect(() => {
    const update = () => {
      const next = Dimensions.get('window');
      setDimensions({ width: Math.max(1, next.width || 375), height: Math.max(1, next.height || 667) });
    };
    update();
    const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, []);
  const { width, height } = dimensions;
  const landscape = width > height;
  const portrait = !landscape;
  // Portrait keeps full-width content and all five bottom tabs; landscape
  // uses the reference-style sidebar only when there is enough horizontal space.
  const commandLayout = landscape && width >= 600;
  // Size components, never stretch or transform the whole application/canvas.
  const consoleScale = commandLayout ? Math.max(0.75, Math.min(1, width / layout.referenceWidth)) : 1;
  const compactLandscape = commandLayout && (width < 1100 || height < 540);
  const sidebarWidth = !commandLayout ? 0 : width >= 1100 ? Math.round(layout.sidebarWidth * consoleScale) : width >= 900 ? layout.mediumSidebarWidth : layout.compactSidebarWidth;
  const pagePadding = commandLayout ? Math.round(layout.pageInset * consoleScale) : spacing.md;
  const contentWidth = Math.max(1, Math.min(layout.contentWidth, width - sidebarWidth) - pagePadding * 2);
  const dashboardRail = commandLayout && contentWidth >= 780;
  const fourMetrics = commandLayout && contentWidth >= 760;
  const tableActivities = dashboardRail && contentWidth >= 1080;
  return { width, height, landscape, portrait, commandLayout, compactLandscape, consoleScale, sidebarWidth, pagePadding, contentWidth, dashboardRail, fourMetrics, tableActivities, desktop: width >= 1024, tablet: width >= 600, columns: fourMetrics ? 4 : 2 };
}

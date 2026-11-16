import { density, layout, spacing } from '../constants/theme';

// Presentation calculations only; no records, permissions, routing or alarm timing.
export function getCompactLayout(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 375;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 667;
  const landscape = safeWidth > safeHeight;
  const commandLayout = landscape && safeWidth >= 600;
  const consoleScale = commandLayout ? Math.max(0.9, Math.min(1.15, safeWidth / layout.referenceWidth)) : 1;
  const compactLandscape = commandLayout && safeWidth < 900;
  const sidebarWidth = !commandLayout ? 0 : compactLandscape ? layout.compactSidebarWidth : Math.round(layout.sidebarWidth * consoleScale);
  const pagePadding = commandLayout ? Math.max(density.cardPadding, Math.round(layout.pageInset * consoleScale)) : spacing.md;
  const contentWidth = Math.max(1, Math.min(layout.contentWidth, safeWidth - sidebarWidth) - pagePadding * 2);
  const dashboardRail = commandLayout && contentWidth >= 820;
  const fourMetrics = commandLayout && contentWidth >= 760;
  // At 1024px the reference table fits a 539px panel, not an 800px panel.
  const activityPanelWidth = dashboardRail ? (contentWidth - layout.panelGap) * (1 - layout.railFraction) - density.cardPadding * 2 : contentWidth - density.cardPadding * 2;
  const tableActivities = dashboardRail && activityPanelWidth >= layout.activityTableMinWidth;
  return { width: safeWidth, height: safeHeight, landscape, portrait: !landscape, commandLayout, compactLandscape, consoleScale, sidebarWidth, pagePadding, contentWidth, dashboardRail, fourMetrics, tableActivities, desktop: safeWidth >= 1024, tablet: safeWidth >= 600, columns: fourMetrics ? 4 : 2 };
}

interface DialogSizeInput { viewportHeight: number; insetTop: number; insetBottom: number; contentHeight: number; headerHeight: number; scrollBody: boolean; requestedHeight?: number }
export function getCompactDialogHeight({ viewportHeight, insetTop, insetBottom, contentHeight, headerHeight, scrollBody, requestedHeight }: DialogSizeInput) {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 667;
  const available = Math.max(1, Math.min(height * 0.9, height - insetTop - insetBottom - spacing.md * 2));
  const measured = scrollBody && contentHeight > 0 ? contentHeight + headerHeight + 2 : available;
  return Math.max(1, Math.min(available, requestedHeight && requestedHeight > 0 ? requestedHeight : measured));
}

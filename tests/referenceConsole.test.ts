import { density, layout } from '../constants/theme.ts';
import { getCompactLayout } from '../services/compactLayout.ts';
function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
Deno.test('the 1024x576 reference uses the narrow sidebar, four metrics and compact activity table', () => {
  const frame = getCompactLayout(1024, 576);
  check(frame.sidebarWidth === 140, 'Reference sidebar should be 140px');
  check(frame.pagePadding === 18, 'Keep reference edge spacing');
  check(frame.fourMetrics && frame.dashboardRail && frame.tableActivities, 'Reference must show four metrics and list plus monitoring rail');
  check(layout.heroHeight === 108 && layout.overviewHeight === 188 && layout.metricHeight === 88, 'Reference block proportions changed');
  const activityInner = (frame.contentWidth - layout.panelGap) * (1 - layout.railFraction) - density.cardPadding * 2;
  const fixedColumns = layout.activityIconWidth + layout.activityKindWidth + layout.activityDateWidth + layout.activityStatusWidth + density.iconGap * 4;
  check(activityInner - fixedColumns >= 150, 'Equipment names must retain a readable table column');
  check(layout.heroHeight + layout.overviewHeight + density.sectionGap + layout.lowerHeight <= 552, 'Overview should fit the reference viewport before contextual audio status');
});
Deno.test('narrow layouts stack panels without forcing a wide data table', () => {
  for (const [width, height] of [[320, 667], [375, 667], [414, 896], [600, 375], [768, 1024]]) {
    const frame = getCompactLayout(width, height);
    check(!frame.tableActivities, 'Small screens must not use the wide activity table');
    check(frame.contentWidth > 0 && frame.contentWidth + frame.sidebarWidth + frame.pagePadding * 2 <= width, 'No horizontal overflow');
  }
});
Deno.test('all runtime palettes render artwork and receipts use independent paper colors', async () => {
  const [screen, nav, modal, receipts, transactionReceipts, settings] = await Promise.all([
    source('../components/layout/Screen.tsx'), source('../components/layout/TabNavigation.tsx'),
    source('../components/ui/FormModal.tsx'), source('../services/receipts.ts'),
    source('../services/transactionReceipts.ts'), source('../app/(tabs)/settings.tsx'),
  ]);
  check(!screen.includes("resolvedTheme === 'dark'") && !nav.includes("resolvedTheme === 'dark'"), 'Artwork must remain visible in both dark variants');
  check(screen.includes('command-network.webp') && nav.includes('command-sidebar.webp'), 'Preserve context-specific tactical artwork');
  check(modal.includes('backgroundColor: c.surfaceGlass') && modal.includes('backgroundColor: c.headerSurface'), 'Popups must use command-center surfaces');
  check(receipts.includes('documentPalette') && transactionReceipts.includes('documentPalette') && !transactionReceipts.includes('palettes.light'), 'Dark UI must not make PDF text invisible');
  check(settings.includes("['NAVY', 'MIDNIGHT', 'SYSTEM DEFAULT']") && settings.includes("value === 'NAVY' ? 'light' : 'dark'"), 'Preserve saved appearance preference keys');
});

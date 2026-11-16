import { density, leading, type } from '../constants/theme.ts';
import { getCompactDialogHeight, getCompactLayout } from '../services/compactLayout.ts';

function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`); }

Deno.test('shared card rhythm meets requested ranges while body text remains readable', () => {
  check(density.cardGap >= 8 && density.cardGap <= 12, 'Card gaps must be 8–12px');
  check(density.cardPadding >= 12 && density.cardPadding <= 16, 'Card padding must be 12–16px');
  equal(density.headerGap, 4);
  equal(density.valueGap, 2);
  check(leading.body >= type.body * 1.6, 'Long body text keeps readable line spacing');
});

Deno.test('normal phone, tablet and desktop layouts keep content within the viewport', () => {
  const sizes = [[320, 667], [375, 667], [414, 896], [600, 375], [768, 1024], [1024, 768], [1024, 1366], [1440, 900], [1920, 1080]];
  for (const [width, height] of sizes) {
    const frame = getCompactLayout(width, height);
    check(frame.contentWidth > 0, 'Content width must be positive');
    check(frame.contentWidth + frame.pagePadding * 2 + frame.sidebarWidth <= width, `Overflow at ${width}x${height}`);
    if (!frame.landscape) equal(frame.commandLayout, false);
    if (frame.tableActivities) {
      const panelWidth = frame.contentWidth * (1 - 0.349) - density.cardGap - density.cardPadding * 2;
      check(panelWidth >= 800, 'Activity table must fit its own card');
    }
  }
});

Deno.test('landscape sidebar behavior is preserved without forcing narrow activity tables', () => {
  equal(getCompactLayout(375, 667).commandLayout, false);
  equal(getCompactLayout(600, 375).commandLayout, true);
  equal(getCompactLayout(1024, 768).dashboardRail, true);
  equal(getCompactLayout(1280, 800).tableActivities, false);
  equal(getCompactLayout(1920, 1080).tableActivities, true);
  equal(getCompactLayout(1024, 1366).commandLayout, false);
});

Deno.test('invalid dimensions use safe defaults', () => {
  const frame = getCompactLayout(Number.NaN, Number.POSITIVE_INFINITY);
  equal(frame.width, 375);
  equal(frame.height, 667);
  check(Number.isFinite(frame.contentWidth) && frame.contentWidth > 0, 'Finite positive width required');
});

const dialog = { viewportHeight: 667, insetTop: 44, insetBottom: 34, contentHeight: 80, headerHeight: 64, scrollBody: true };
Deno.test('short dialogs fit content; long forms retain a bounded scroll area', () => {
  equal(getCompactDialogHeight(dialog), 146);
  equal(getCompactDialogHeight({ ...dialog, contentHeight: 3000 }), 557);
  equal(getCompactDialogHeight({ ...dialog, requestedHeight: 440 }), 440);
  equal(getCompactDialogHeight({ ...dialog, requestedHeight: 1000 }), 557);
  equal(getCompactDialogHeight({ ...dialog, scrollBody: false }), 557);
  const tiny = getCompactDialogHeight({ ...dialog, viewportHeight: 40 });
  check(Number.isFinite(tiny) && tiny >= 1, 'Dialogs never calculate a negative height');
});

Deno.test('presentation calculations do not mutate shared sizing input', () => {
  const before = JSON.stringify(dialog);
  getCompactDialogHeight(dialog);
  equal(JSON.stringify(dialog), before);
});

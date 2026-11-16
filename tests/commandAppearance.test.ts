import { restoreCommandTheme } from '../services/commandAppearance.ts';
import { palettes } from '../constants/theme.ts';
import type { TrackerData } from '../services/tracker.ts';

function fixture(): TrackerData {
  return {
    version: 1,
    assets: [{ id: 'AST-existing', name: 'Radio', serial: '000123', notes: 'Existing equipment', createdAt: '2026-11-15T10:00:00Z', updatedAt: '2026-11-15T10:00:00Z' }],
    withdrawals: [], activities: [], notices: [], batches: [], returnRecords: [],
    settings: { theme: 'light', notificationVolume: 73, alarmVolume: 81, enabled: true, warningHours: 48, role: 'operator' },
  };
}
Deno.test('restoring the reference theme changes appearance only', () => {
  const before = fixture(); const serialized = JSON.stringify(before);
  const after = restoreCommandTheme(before, false);
  if (after.settings.theme !== 'dark') throw new Error('Reference dark theme was not activated');
  for (const key of ['assets', 'withdrawals', 'activities', 'notices', 'batches', 'returnRecords'] as const) {
    if (after[key] !== before[key]) throw new Error(`Records were changed: ${key}`);
  }
  if (JSON.stringify(before) !== serialized) throw new Error('Original dataset was mutated');
  if (after.settings.alarmVolume !== 81 || after.settings.notificationVolume !== 73 || after.settings.warningHours !== 48) throw new Error('Non-theme preferences were changed');
});
Deno.test('subsequent light and system selections are not overridden', () => {
  for (const theme of ['light', 'dark', 'system'] as const) {
    const data = fixture(); data.settings.theme = theme;
    if (restoreCommandTheme(data, true) !== data) throw new Error('Saved appearance preference was overridden');
  }
});
Deno.test('command identity preserves black-and-yellow with independent semantic indicators', () => {
  const c = palettes.dark;
  if (c.primary !== c.gold || c.headerAccent !== c.gold) throw new Error('OG6 yellow accents missing');
  if (new Set([c.signalBlue, c.signalGreen, c.signalRed]).size !== 3) throw new Error('Equipment states need distinct signals');
  if (c.onAction === c.white) throw new Error('Yellow actions need dark accessible labels');
});

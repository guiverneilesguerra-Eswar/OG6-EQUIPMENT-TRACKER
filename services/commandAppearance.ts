import type { TrackerData } from './tracker';

// Device-local appearance marker; not part of transaction data or portable backups.
export const commandAppearanceKey = 'og6.commandAppearance.blue.v1';

/** Apply the requested dark command theme once, without changing any records. */
export function restoreCommandTheme(data: TrackerData, alreadyApplied: boolean): TrackerData {
  if (alreadyApplied) return data;
  return { ...data, settings: { ...data.settings, theme: 'dark' } };
}

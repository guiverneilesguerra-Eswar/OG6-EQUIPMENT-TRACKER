import { alarmRepeatMilliseconds, clampVolume, soundChannel, soundPriority } from '../services/soundClips.ts';
import { normalizeAudioPreferences } from '../services/audioPreferences.ts';
import { overdueIds, pendingOverdueIds } from '../services/alarmPolicy.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const now = Date.parse('2026-11-14T10:00:00Z');
const withdrawals = [
  { id: 'overdue', dueAt: '2026-11-14T09:00:00Z' },
  { id: 'soon', dueAt: '2026-11-14T11:00:00Z' },
  { id: 'returned', dueAt: '2026-11-14T09:00:00Z', returnedAt: '2026-11-14T09:30:00Z' },
  { id: 'archived', dueAt: '2026-11-14T09:00:00Z', deletedAt: '2026-11-14T09:30:00Z' },
  { id: 'acknowledged', dueAt: '2026-11-14T09:00:00Z', alarmAcknowledgedAt: '2026-11-14T09:30:00Z' },
  { id: 'invalid', dueAt: 'not-a-date' },
];
Deno.test('overdue alarms persist independently of notification deletion', () => {
  const before = JSON.stringify(withdrawals);
  equal(pendingOverdueIds(withdrawals, [], now), ['overdue']);
  equal(pendingOverdueIds(withdrawals, [{ type: 'overdue', withdrawalId: 'overdue', acknowledged: false }], now), ['overdue']);
  equal(pendingOverdueIds(withdrawals, [{ type: 'overdue', withdrawalId: 'overdue', acknowledged: true }], now), []);
  equal(pendingOverdueIds(withdrawals, [{ type: 'due', withdrawalId: 'overdue', acknowledged: true }], now), ['overdue']);
  equal(JSON.stringify(withdrawals), before);
});
Deno.test('return/archive/acknowledgement removes targets, new overdue checkouts still alert', () => {
  equal(pendingOverdueIds([{ ...withdrawals[0], returnedAt: '2026-11-14T10:00:00Z' }], [], now), []);
  equal(pendingOverdueIds([{ ...withdrawals[0], deletedAt: '2026-11-14T10:00:00Z' }], [], now), []);
  equal(pendingOverdueIds([{ ...withdrawals[0], alarmAcknowledgedAt: '2026-11-14T10:00:00Z' }], [], now), []);
  equal(pendingOverdueIds([...withdrawals, { id: 'new', dueAt: '2026-11-14T09:59:00Z' }], [], now), ['overdue', 'new']);
  equal(overdueIds(withdrawals, now), ['overdue', 'acknowledged']);
});
Deno.test('new preferences and one-time upgrade default both volumes to 100%', () => {
  equal(normalizeAudioPreferences({}), { notificationVolume: 100, alarmVolume: 100, alarmEnabled: true, audioPreferencesVersion: 2 });
  equal(normalizeAudioPreferences({ notificationVolume: 70, alarmVolume: 80 }), { notificationVolume: 100, alarmVolume: 100, alarmEnabled: true, audioPreferencesVersion: 2 });
});
Deno.test('subsequent saved preferences and disabled alarm survive normalization', () => {
  equal(normalizeAudioPreferences({ audioPreferencesVersion: 2, notificationVolume: 15, alarmVolume: 0, alarmEnabled: false }), { notificationVolume: 15, alarmVolume: 0, alarmEnabled: false, audioPreferencesVersion: 2 });
  equal(clampVolume(-1), 0); equal(clampVolume(125), 100); equal(clampVolume(Number.NaN), 100);
  equal(normalizeAudioPreferences({ audioPreferencesVersion: 2, notificationVolume: -50, alarmVolume: 500 }), { notificationVolume: 0, alarmVolume: 100, alarmEnabled: true, audioPreferencesVersion: 2 });
});
Deno.test('a target becomes overdue only after its actual due timestamp', () => {
  const record = [{ id: 'boundary', dueAt: new Date(now).toISOString() }];
  equal(pendingOverdueIds(record, [], now), []);
  equal(pendingOverdueIds(record, [], now + 1), ['boundary']);
});
Deno.test('uploaded audio routing keeps alarm priorities and original repeat interval', () => {
  equal(alarmRepeatMilliseconds, 20000);
  check(soundPriority('alarm') > soundPriority('due'), 'Overdue must have highest queue priority');
  check(soundPriority('due') > soundPriority('notification'), 'Due-soon must be high priority');
  equal(soundPriority('withdrawal'), soundPriority('return'));
});
Deno.test('regular events use only notification audio; urgent events use only alarm audio', () => {
  for (const kind of ['notification', 'withdrawal', 'return', 'system'] as const) equal(soundChannel(kind), 'notification');
  for (const kind of ['alarm', 'critical', 'due'] as const) equal(soundChannel(kind), 'alarm');
  equal(soundPriority('critical'), soundPriority('alarm'));
});

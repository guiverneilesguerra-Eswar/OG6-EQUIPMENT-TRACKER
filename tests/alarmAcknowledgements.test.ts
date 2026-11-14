import { recordAlarmAcknowledgement } from '../services/alarmAcknowledgements.ts';
import { alarmCountdown, AlarmCountdownInput } from '../services/alarmCountdown.ts';
function equal(actual: unknown, expected: unknown) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`); }
const at = '2026-11-14T10:00:00.123Z';
interface TestWithdrawal { id: string; assetId: string; dueAt: string; receiver?: string; signature?: { x: number; y: number }[][]; returnedAt?: string; deletedAt?: string; alarmAcknowledgedAt?: string }
const data = {
  withdrawals: [
    { id: 'WD-001', assetId: 'AST-001', dueAt: '2026-11-14T09:00:00Z', receiver: 'Personnel A', signature: [[{ x: 1, y: 2 }]] },
    { id: 'WD-002', assetId: 'AST-002', dueAt: '2026-11-14T09:30:00Z', receiver: 'Personnel B', signature: [] },
    { id: 'returned', assetId: 'AST-003', dueAt: '2026-11-14T09:00:00Z', returnedAt: '2026-11-14T09:50:00Z' },
    { id: 'future', assetId: 'AST-004', dueAt: '2026-11-14T12:00:00Z' },
    { id: 'legacy-ack', assetId: 'AST-005', dueAt: '2026-11-14T09:00:00Z' },
    { id: 'archived', assetId: 'AST-006', dueAt: '2026-11-14T09:00:00Z', deletedAt: '2026-11-14T09:50:00Z' },
  ] as TestWithdrawal[],
  notices: [
    { id: 'n1', type: 'overdue', withdrawalId: 'WD-001', acknowledged: false, read: false },
    { id: 'n2', type: 'overdue', withdrawalId: 'WD-002', acknowledged: false, read: false },
    { id: 'n3', type: 'overdue', withdrawalId: 'legacy-ack', acknowledged: true, read: true },
  ],
  activities: [{ id: 'old', assetId: 'AST-001', type: 'withdrawal', person: 'Personnel A', at: '2026-11-14T09:00:00Z', description: 'Existing transaction' }],
};
Deno.test('batch acknowledgement appends one exact-timestamp event without changing existing transactions', () => {
  const before = JSON.stringify(data);
  const result = recordAlarmAcknowledgement(data, ['WD-001', 'WD-002', 'WD-001', 'returned', 'future', 'legacy-ack', 'archived', 'unknown'], at, 'ACT-NEW', 'alarm-control');
  equal(result.event?.withdrawalIds, ['WD-001', 'WD-002']); equal(result.event?.at, at);
  equal(result.activities[1], data.activities[0]); equal(result.withdrawals[0].alarmAcknowledgedAt, at);
  equal(result.withdrawals[0].signature, data.withdrawals[0].signature); equal(result.withdrawals[0].receiver, 'Personnel A');
  equal(result.withdrawals[2], data.withdrawals[2]); equal(result.notices[0].acknowledged, true);
  equal(JSON.stringify(data), before);
  equal(Object.keys(result.event || {}).sort(), ['acknowledgementSource', 'assetId', 'at', 'description', 'id', 'person', 'type', 'withdrawalIds'].sort());
});
Deno.test('retry/already acknowledged targets do not duplicate history; per-notice actions are independent', () => {
  const first = recordAlarmAcknowledgement(data, ['WD-001'], at, 'ACT-1', 'notification-acknowledge');
  const retry = recordAlarmAcknowledgement(first, ['WD-001'], at, 'ACT-2', 'alarm-control');
  equal(retry.event, null); equal(retry.activities.length, first.activities.length);
  equal(first.withdrawals[1].alarmAcknowledgedAt, undefined);
  const second = recordAlarmAcknowledgement(first, ['WD-002'], at, 'ACT-3', 'notification-dismiss');
  equal(second.event?.withdrawalIds, ['WD-002']); equal(second.event?.acknowledgementSource, 'notification-dismiss');
  equal(second.activities.length, 3);
});
const base: AlarmCountdownInput = { now: Date.parse(at), lastAlarmAt: Date.parse(at), pendingCount: 2, enabled: true, volume: 100, foreground: true, browser: false, unlocked: true, ready: true, requiresUpload: false, error: '', halted: false, testing: false, playing: false };
Deno.test('countdown is display-only and uses the same existing 20-second schedule', () => {
  const before = JSON.stringify(base);
  equal(alarmCountdown(base).seconds, 20);
  equal(alarmCountdown({ ...base, now: base.now + 1250 }).label, 'NEXT ALARM IN 00:19');
  equal(alarmCountdown({ ...base, now: base.now + 20000 }).seconds, 0);
  equal(alarmCountdown({ ...base, lastAlarmAt: 0 }).seconds, 0);
  equal(alarmCountdown({ ...base, playing: true }).label, 'ALARM PLAYING · NEXT IN 00:20');
  equal(JSON.stringify(base), before);
});
Deno.test('muted, disabled and browser-blocked states never show a misleading countdown', () => {
  equal(alarmCountdown({ ...base, volume: 0 }), { mode: 'muted', label: 'ALARM MUTED · 0%', seconds: null });
  equal(alarmCountdown({ ...base, enabled: false }), { mode: 'disabled', label: 'ALARM DISABLED', seconds: null });
  equal(alarmCountdown({ ...base, browser: true, unlocked: false }), { mode: 'browser-blocked', label: 'BROWSER AUDIO BLOCKED', seconds: null });
  equal(alarmCountdown({ ...base, requiresUpload: true }).mode, 'upload-required');
  equal(alarmCountdown({ ...base, halted: true }).mode, 'halted');
  equal(alarmCountdown({ ...base, pendingCount: 0 }).mode, 'idle');
});

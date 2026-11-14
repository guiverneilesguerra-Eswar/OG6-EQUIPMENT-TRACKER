import { pendingOverdueIds } from './alarmPolicy';

interface WithdrawalRecord { id: string; assetId: string; dueAt: string; returnedAt?: string; deletedAt?: string; alarmAcknowledgedAt?: string }
interface NoticeRecord { type: string; withdrawalId?: string; acknowledged: boolean; read: boolean }
export type AcknowledgementSource = 'alarm-control' | 'notification-acknowledge' | 'notification-dismiss';
export interface AlarmAcknowledgementActivity {
  id: string; assetId: string; type: 'alarm-acknowledgement'; person: string; at: string;
  description: string; withdrawalIds: string[]; acknowledgementSource: AcknowledgementSource;
}

// Whitelisted audit fields only: no record snapshots, signatures, passwords or credentials.
// One event per successful action; repeated acknowledgement of the same targets is a no-op.
export function recordAlarmAcknowledgement<W extends WithdrawalRecord, N extends NoticeRecord, A>(
  data: { withdrawals: W[]; notices: N[]; activities: A[] },
  requestedIds: string[], at: string, eventId: string, source: AcknowledgementSource,
) {
  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) throw new Error('A valid acknowledgement timestamp is required.');
  const pending = new Set(pendingOverdueIds(data.withdrawals, data.notices, timestamp));
  const ids = [...new Set(requestedIds)].filter(id => pending.has(id));
  if (!ids.length) return { ...data, event: null };
  const selected = new Set(ids);
  const first = data.withdrawals.find(w => selected.has(w.id));
  const event: AlarmAcknowledgementActivity = {
    id: eventId, assetId: first?.assetId || '', type: 'alarm-acknowledgement',
    person: 'Local operator (device workspace)', at,
    description: `Overdue alarm acknowledged for ${ids.length} withdrawal${ids.length === 1 ? '' : 's'}.`,
    withdrawalIds: ids, acknowledgementSource: source,
  };
  return {
    withdrawals: data.withdrawals.map(w => selected.has(w.id) ? { ...w, alarmAcknowledgedAt: at } : w),
    notices: data.notices.map(n => n.type === 'overdue' && n.withdrawalId && selected.has(n.withdrawalId) ? { ...n, read: true, acknowledged: true } : n),
    activities: [event, ...data.activities], event,
  };
}

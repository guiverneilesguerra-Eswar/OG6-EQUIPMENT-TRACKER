import { TrackerData, Withdrawal } from './tracker';

export interface DashboardActivity {
  id: string; assetId: string; name: string; serial: string; person: string;
  at: string; kind: 'WITHDRAWAL' | 'RETURN' | 'DUE ITEM' | 'ACKNOWLEDGEMENT'; withdrawalIds?: string[];
  status: 'OUT' | 'RETURNED' | 'DUE SOON' | 'OVERDUE' | 'ACKNOWLEDGED';
}
export function dashboardActivities(data: TrackerData, active: Withdrawal[], now: number): DashboardActivity[] {
  const assets = new Map(data.assets.map(asset => [asset.id, asset]));
  const events: DashboardActivity[] = data.activities
    .filter(event => event.type === 'withdrawal' || event.type === 'return' || event.type === 'alarm-acknowledgement')
    .map<DashboardActivity>(event => ({ id: event.id, assetId: event.assetId,
      name: event.type === 'alarm-acknowledgement' ? `Overdue alarm acknowledged · ${event.withdrawalIds?.length || 0} withdrawal(s)` : assets.get(event.assetId)?.name || 'Equipment record',
      serial: assets.get(event.assetId)?.serial || '', person: event.person, at: event.at,
      withdrawalIds: event.withdrawalIds,
      kind: event.type === 'alarm-acknowledgement' ? 'ACKNOWLEDGEMENT' : event.type === 'return' ? 'RETURN' : 'WITHDRAWAL',
      status: event.type === 'alarm-acknowledgement' ? 'ACKNOWLEDGED' : event.type === 'return' ? 'RETURNED' : 'OUT' }));
  const due: DashboardActivity[] = active.filter(withdrawal => Date.parse(withdrawal.dueAt) - now <= data.settings.warningHours * 3600000)
    .map<DashboardActivity>(withdrawal => ({ id: `due-${withdrawal.id}`, assetId: withdrawal.assetId,
      name: assets.get(withdrawal.assetId)?.name || 'Equipment record', serial: assets.get(withdrawal.assetId)?.serial || '',
      person: withdrawal.receiver, at: withdrawal.dueAt, kind: 'DUE ITEM',
      status: Date.parse(withdrawal.dueAt) < now ? 'OVERDUE' : 'DUE SOON' }));
  // Due dates are reminders, not completed future transactions. Keep event ordering
  // chronological while placing any future reminder at the current monitoring time.
  return [...events, ...due].sort((a, b) => Math.min(Date.parse(b.at), now) - Math.min(Date.parse(a.at), now));
}
export function dueSoonCount(active: Withdrawal[], now: number, hours: number): number {
  return new Set(active.filter(withdrawal => {
    const remaining = Date.parse(withdrawal.dueAt) - now;
    return remaining >= 0 && remaining <= hours * 3600000;
  }).map(withdrawal => withdrawal.assetId)).size;
}

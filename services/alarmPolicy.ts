interface AlarmWithdrawal { id: string; dueAt: string; returnedAt?: string; deletedAt?: string; alarmAcknowledgedAt?: string }
interface AlarmNotice { type: string; withdrawalId?: string; acknowledged: boolean }
export function pendingOverdueIds(withdrawals: AlarmWithdrawal[], notices: AlarmNotice[], now: number): string[] {
  const acknowledged = new Set(notices.filter(n => n.type === 'overdue' && n.acknowledged && n.withdrawalId).map(n => n.withdrawalId));
  return withdrawals.filter(w => !w.returnedAt && !w.deletedAt && !w.alarmAcknowledgedAt && !acknowledged.has(w.id)
    && Number.isFinite(Date.parse(w.dueAt)) && Date.parse(w.dueAt) < now).map(w => w.id);
}
export function overdueIds(withdrawals: AlarmWithdrawal[], now: number): string[] {
  return withdrawals.filter(w => !w.returnedAt && !w.deletedAt && Number.isFinite(Date.parse(w.dueAt)) && Date.parse(w.dueAt) < now).map(w => w.id);
}

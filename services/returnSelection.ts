import type { TrackerData, Withdrawal } from './tracker';
import { remainingQuantity } from './movements';

export const equipmentConditions = ['Serviceable', 'Unserviceable', 'Damage'];
export function validateEquipmentCondition(value: string): void {
  if (!equipmentConditions.includes(value)) throw new Error('Choose equipment condition: Serviceable, Unserviceable, or Damage.');
}
export function getOutstandingWithdrawals(data: TrackerData): Withdrawal[] {
  return data.withdrawals.filter(w => remainingQuantity(w) > 0);
}
export function filterReturnItems(data: TrackerData, items: Withdrawal[], query: string): Withdrawal[] {
  const key = query.trim().toLowerCase();
  return items.filter(w => {
    const a = data.assets.find(a => a.id === w.assetId);
    return `${w.equipmentSnapshot?.name || a?.name || ''} ${w.equipmentSnapshot?.serial || a?.serial || ''} ${w.assetId} ${w.id} ${w.reference || ''} ${w.receiver}`.toLowerCase().includes(key);
  });
}
export function selectedReturnLines(quantities: Record<string, string>): { withdrawalId: string; quantity: number }[] {
  return Object.entries(quantities).filter(([, value]) => value.trim() !== '' && Number(value) !== 0).map(([withdrawalId, value]) => ({ withdrawalId, quantity: Number(value) }));
}

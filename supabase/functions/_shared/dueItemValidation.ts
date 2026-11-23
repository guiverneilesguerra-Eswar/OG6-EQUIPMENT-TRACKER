// Shared, pure validation: only explicitly editable details cross the authorization boundary.
export interface DueItemSnapshot {
  withdrawalId: string; assetId: string; name: string; serial: string; description: string;
  receiver: string; releaser: string; dueAt: string; notes: string; withdrawalAt: string;
  createdAt: string; assetUpdatedAt: string; recordUpdatedAt: string;
  quantity: number; returnedQuantity: number; dueRevision: number;
}
export interface DueItemChanges { name: string; serial: string; description: string; receiver: string; releaser: string; dueAt: string; notes: string }
export function dueText(value: unknown, label: string, maximum = 200, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\u0000') || (!allowEmpty && !value.trim())) throw new Error(`Invalid ${label}.`);
  return value.trim();
}
export function dueTimestamp(value: unknown, label: string, allowEmpty = false): string {
  if (allowEmpty && value === '') return '';
  const result = dueText(value, label, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Invalid ${label}.`);
  return result;
}
export function parseDueChanges(value: unknown, withdrawalAt: string): DueItemChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid due item changes.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['name', 'serial', 'description', 'receiver', 'releaser', 'dueAt', 'notes'].includes(k))) throw new Error('This edit contains protected transaction fields.');
  const dueAt = dueTimestamp(v.dueAt, 'due date', true);
  if (dueAt && Date.parse(dueAt) <= Date.parse(withdrawalAt)) throw new Error('Due date must be later than the withdrawal date.');
  return { name: dueText(v.name, 'equipment name'), serial: dueText(v.serial, 'Serial/Product ID'), description: dueText(v.description, 'equipment description', 10000, true), receiver: dueText(v.receiver, 'receiver'), releaser: dueText(v.releaser, 'releaser'), dueAt, notes: dueText(v.notes, 'remarks', 10000, true) };
}
export function parseDueSnapshot(value: unknown): DueItemSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid due item snapshot.');
  const v = value as Record<string, unknown>;
  const number = (key: string, minimum: number) => { const n = v[key]; if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < minimum || n > 1000000) throw new Error(`Invalid ${key}.`); return n; };
  const quantity = number('quantity', 1); const returnedQuantity = number('returnedQuantity', 0);
  if (returnedQuantity >= quantity) throw new Error('Only outstanding withdrawal records can be edited.');
  const withdrawalAt = dueTimestamp(v.withdrawalAt, 'withdrawal date');
  const changes = parseDueChanges(Object.fromEntries(['name', 'serial', 'description', 'receiver', 'releaser', 'dueAt', 'notes'].map(k => [k, v[k]])), withdrawalAt);
  return { withdrawalId: dueText(v.withdrawalId, 'withdrawal ID', 500), assetId: dueText(v.assetId, 'asset ID', 500), ...changes, withdrawalAt, createdAt: dueTimestamp(v.createdAt, 'creation date'), assetUpdatedAt: dueTimestamp(v.assetUpdatedAt, 'equipment modification date'), recordUpdatedAt: dueTimestamp(v.recordUpdatedAt, 'record modification date'), quantity, returnedQuantity, dueRevision: number('dueRevision', 0) };
}
export function dueSnapshotKey(value: DueItemSnapshot): string {
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

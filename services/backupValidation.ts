import { z } from 'zod';
import type { TrackerData } from './tracker';
import { getNameDirectory, nameKey, remainingQuantity, assetCapacity } from './movements';
const id = z.string().min(1).max(500);
const text = z.string().max(100000);
const date = z.string().refine(v => Number.isFinite(Date.parse(v)), 'Invalid timestamp');
const qty = z.number().int().min(1).max(1000000);
const signature = z.array(z.array(z.object({ x: z.number().finite(), y: z.number().finite() }))).max(10000);
const sound = z.object({ id: z.string().uuid(), filename: z.string().min(1).max(180), extension: z.enum(['mp3', 'wav']), mimeType: z.enum(['audio/mpeg', 'audio/wav']), sizeBytes: z.number().int().min(1).max(10485760), durationMillis: z.number().min(100).max(19000), uploadedAt: date, authorized: z.literal(true), referenceUrl: z.string().optional() });
const asset = z.object({ id, name: text, serial: text, notes: text, createdAt: date, updatedAt: date, archivedAt: date.optional(), quantity: qty.optional(), category: text.optional(), condition: z.enum(['Serviceable', 'Unserviceable', 'Damage']).optional() });
const withdrawal = z.object({ id, assetId: id, releaser: text, receiver: text, signature, withdrawalAt: date, dueAt: date, createdAt: date, returnedAt: date.optional(), returning: text.optional(), receiving: text.optional(), condition: text.optional(), remarks: text.optional(), returnSignature: signature.optional(), receivingSignature: signature.optional(), notes: text, deletedAt: date.optional(), alarmAcknowledgedAt: date.optional(), batchId: id.optional(), reference: id.optional(), quantity: qty.optional(), returnedQuantity: z.number().int().min(0).optional(), equipmentSnapshot: z.object({ name: text, serial: text, description: text }).optional() });
const activity = z.object({ id, assetId: z.string(), transactionId: id.optional(), type: z.enum(['added', 'withdrawal', 'return', 'edit', 'archive', 'alarm-acknowledgement', 'maintenance']), person: text, at: date, description: text, authorizationId: id.optional(), withdrawalIds: z.array(id).optional(), acknowledgementSource: z.enum(['alarm-control', 'notification-dismiss', 'notification-acknowledge']).optional() });
const notice = z.object({ id, assetId: id.optional(), withdrawalId: id.optional(), type: z.enum(['success', 'due', 'overdue', 'error']), priority: z.literal('critical').optional(), title: text, message: text, at: date, read: z.boolean(), acknowledged: z.boolean() });
const names = z.array(z.object({ id, name: z.string().min(1).max(200), createdAt: date }));
const schema = z.object({ version: z.literal(1), assets: z.array(asset), withdrawals: z.array(withdrawal), activities: z.array(activity), notices: z.array(notice), alertKeys: z.array(z.string()).optional(),
  settings: z.object({ theme: z.enum(['light', 'dark', 'system']), notificationVolume: z.number().min(0).max(100), alarmVolume: z.number().min(0).max(100), alarmEnabled: z.boolean().optional(), audioPreferencesVersion: z.number().optional(), notificationSound: sound.nullable().optional(), alarmSound: sound.nullable().optional(), alertSound: sound.optional(), enabled: z.boolean(), warningHours: z.number().min(1).max(8760), role: z.enum(['operator', 'viewer']), backgroundNotifications: z.boolean().optional(), advanceReminders: z.boolean().optional(), dailyReminders: z.boolean().optional(), pushSound: z.enum(['default', 'silent']).optional() }),
  batches: z.array(z.object({ id, reference: id, withdrawalIds: z.array(id).min(1), createdAt: date })).optional(),
  returnRecords: z.array(z.object({ id, reference: id, withdrawalId: id, assetId: id, quantity: qty, at: date, returning: text, receiving: text, condition: text, remarks: text, returnSignature: signature.optional(), receivingSignature: signature.optional() })).optional(),
  nameDirectory: z.object({ version: z.literal(1), releasers: names, receivers: names }).optional(),
  inventoryImports: z.array(z.object({ id, filename: text, at: date, importedAssetIds: z.array(id), duplicatesSkipped: z.number().int().min(0), invalidRows: z.number().int().min(0), totalProcessed: z.number().int().min(0) })).optional(),
});
function unique<T>(list: T[], key: (item: T) => string, label: string) { const seen = new Set<string>(); for (const item of list) { const value = key(item); if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}.`); seen.add(value); } }
export function validateDatabase(value: unknown): TrackerData {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid or incompatible records: ${parsed.error.issues[0]?.path.join('.')} · ${parsed.error.issues[0]?.message}`);
  const d = parsed.data as TrackerData;
  unique(d.assets, a => a.id, 'Asset ID'); unique(d.assets, a => a.serial.trim().toLowerCase(), 'Serial/Product ID');
  unique(d.withdrawals, w => w.id, 'withdrawal ID'); unique(d.activities, a => a.id, 'activity ID'); unique(d.notices, n => n.id, 'notice ID');
  unique(d.batches || [], b => b.id, 'batch ID'); unique(d.returnRecords || [], r => r.id, 'return ID'); unique(d.inventoryImports || [], i => i.id, 'import ID');
  const assets = new Map(d.assets.map(a => [a.id, a])); const withdrawals = new Map(d.withdrawals.map(w => [w.id, w])); const active = new Set<string>();
  for (const w of d.withdrawals) {
    const a = assets.get(w.assetId); if (!a) throw new Error('Withdrawal refers to missing equipment.');
    if (Date.parse(w.dueAt) <= Date.parse(w.withdrawalAt) || w.returnedAt && Date.parse(w.returnedAt) < Date.parse(w.withdrawalAt)) throw new Error('Transaction dates are inconsistent.');
    if ((w.quantity ?? 1) > assetCapacity(a) || (w.returnedQuantity ?? 0) > (w.quantity ?? 1)) throw new Error('Invalid equipment/return quantities.');
    if (w.returnedQuantity !== undefined && Boolean(w.returnedAt) !== (w.returnedQuantity === (w.quantity ?? 1))) throw new Error('Return totals do not match transaction status.');
    if (remainingQuantity(w) > 0) { if (a.archivedAt || active.has(a.id)) throw new Error('Unavailable equipment or duplicate active withdrawal.'); active.add(a.id); }
    if (w.batchId && !(d.batches || []).some(b => b.id === w.batchId && b.withdrawalIds.includes(w.id) && w.reference === b.reference)) throw new Error('Withdrawal batch reference is missing or inconsistent.');
  }
  for (const b of d.batches || []) { unique(b.withdrawalIds, id => id, 'batch item'); for (const id of b.withdrawalIds) if (withdrawals.get(id)?.batchId !== b.id) throw new Error('Batch refers to missing or mismatched withdrawal.'); }
  const returned = new Map<string, number>();
  for (const r of d.returnRecords || []) { const w = withdrawals.get(r.withdrawalId); if (!w || w.assetId !== r.assetId || Date.parse(r.at) < Date.parse(w.withdrawalAt)) throw new Error('Return refers to invalid equipment or withdrawal date.'); returned.set(w.id, (returned.get(w.id) || 0) + r.quantity); }
  for (const [id, total] of returned) if (total !== withdrawals.get(id)?.returnedQuantity) throw new Error('Individual return history does not match returned quantities.');
  for (const w of d.withdrawals) if (w.returnedQuantity && !returned.has(w.id)) throw new Error('Return quantity has no individual return history.');
  for (const a of d.activities) { if (a.assetId && !assets.has(a.assetId)) throw new Error('Activity refers to missing equipment.'); if (a.transactionId && !withdrawals.has(a.transactionId)) throw new Error('Activity refers to missing transaction.'); if (a.withdrawalIds?.some(id => !withdrawals.has(id))) throw new Error('Acknowledgement refers to missing transactions.'); }
  if (d.notices.some(n => n.assetId && !assets.has(n.assetId) || n.withdrawalId && !withdrawals.has(n.withdrawalId))) throw new Error('Notice refers to missing records.');
  if (d.inventoryImports?.some(i => i.importedAssetIds.some(id => !assets.has(id)))) throw new Error('Import audit refers to missing equipment.');
  const directory = getNameDirectory(d);
  for (const list of [directory.releasers, directory.receivers]) { unique(list, n => n.id, 'name ID'); unique(list, n => nameKey(n.name), 'name'); }
  return { ...d, nameDirectory: directory };
}
export const canonical = (value: unknown): string => JSON.stringify(sortValue(value));
function sortValue(value: unknown): unknown { if (Array.isArray(value)) return value.map(sortValue); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v !== undefined).map(([k, v]) => [k, sortValue(v)])); return value; }
export function mergeDatabase(current: TrackerData, incoming: TrackerData): TrackerData {
  const merge = <T extends { id: string }>(a: T[], b: T[], label: string): T[] => { const map = new Map(a.map(item => [item.id, item])); for (const item of b) { const existing = map.get(item.id); if (existing && canonical(existing) !== canonical(item)) throw new Error(`Merge conflict in ${label} ${item.id}. Existing records were not changed. Use a reviewed full restore instead.`); if (!existing) map.set(item.id, item); } return [...map.values()]; };
  const namesA = getNameDirectory(current); const namesB = getNameDirectory(incoming);
  const mergeNames = (role: 'releasers' | 'receivers') => { const result = [...namesA[role]]; for (const n of namesB[role]) { if (result.some(a => nameKey(a.name) === nameKey(n.name))) continue; if (result.some(a => a.id === n.id)) throw new Error('Name directory ID conflict.'); result.push(n); } return result; };
  return validateDatabase({ ...current, assets: merge(current.assets, incoming.assets, 'equipment'), withdrawals: merge(current.withdrawals, incoming.withdrawals, 'withdrawal'), activities: merge(current.activities, incoming.activities, 'activity'), notices: merge(current.notices, incoming.notices, 'notice'), batches: merge(current.batches || [], incoming.batches || [], 'batch'), returnRecords: merge(current.returnRecords || [], incoming.returnRecords || [], 'return'), inventoryImports: merge(current.inventoryImports || [], incoming.inventoryImports || [], 'inventory import'), alertKeys: Array.from(new Set([...(current.alertKeys || []), ...(incoming.alertKeys || [])])), nameDirectory: { version: 1, releasers: mergeNames('releasers'), receivers: mergeNames('receivers') } });
}
export function backupSummary(data: TrackerData) { return `${data.assets.length} equipment · ${data.withdrawals.length} withdrawals · ${(data.returnRecords?.length || 0) + data.withdrawals.filter(w => w.returnedAt && w.returnedQuantity === undefined).length} return events · ${data.batches?.length || 0} grouped transactions · ${data.activities.length} activity entries · ${getNameDirectory(data).releasers.length + getNameDirectory(data).receivers.length} saved names`; }

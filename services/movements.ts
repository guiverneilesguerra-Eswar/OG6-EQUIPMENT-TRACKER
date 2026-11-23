import type { Activity, Asset, Signature, TrackerData, Withdrawal } from './tracker';
import { copyReturnSignature, validateReturnSignature } from './returnSignatures';
import { validateEquipmentCondition } from './returnSelection';

export interface NameEntry { id: string; name: string; createdAt: string }
export interface NameDirectory { version: 1; releasers: NameEntry[]; receivers: NameEntry[] }
export type NameRole = 'releasers' | 'receivers';
export interface BatchRecord { id: string; reference: string; withdrawalIds: string[]; createdAt: string }
export interface ReturnRecord { id: string; reference: string; withdrawalId: string; assetId: string; quantity: number; at: string; returning: string; receiving: string; condition: string; remarks: string; returnSignature?: Signature; receivingSignature?: Signature; releasingSignature?: Signature }
export interface BatchLine { assetId: string; manual?: boolean; name?: string; serial?: string; description?: string; quantity: number }
export interface BatchInput { requestId: string; items: BatchLine[]; releaser: string; receiver: string; signature: Signature; withdrawalAt: string; dueAt: string; remarks: string }
export interface ReturnMovementInput { requestId: string; items: { withdrawalId: string; quantity: number }[]; returning: string; receiving: string; condition: string; remarks: string; receivingSignature: Signature; releasingSignature?: Signature }
export const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');
export const nameKey = (name: string) => cleanName(name).toLocaleLowerCase();
export const remainingQuantity = (w: Withdrawal) => w.returnedAt || w.deletedAt ? 0 : (w.quantity ?? 1) - (w.returnedQuantity ?? 0);
export const assetCapacity = (a: Asset) => a.quantity ?? 1;
export function addNames(directory: NameDirectory, releaser: string, receiver: string, at: string, makeId: (prefix: string) => string): NameDirectory {
  const add = (list: NameEntry[], value: string) => !cleanName(value) || list.some(n => nameKey(n.name) === nameKey(value)) ? list : [...list, { id: makeId('NAM'), name: cleanName(value), createdAt: at }];
  return { version: 1, releasers: add(directory.releasers, releaser), receivers: add(directory.receivers, receiver) };
}
export function getNameDirectory(data: TrackerData): NameDirectory {
  if (data.nameDirectory) return data.nameDirectory;
  let result: NameDirectory = { version: 1, releasers: [], receivers: [] };
  for (const w of data.withdrawals) {
    result = addNames(result, w.releaser, w.receiver, w.createdAt, p => `${p}-${nameKey(w.releaser)}-${nameKey(w.receiver)}-${result.releasers.length + result.receivers.length}`);
    if (w.returnedAt) result = addNames(result, w.returning || '', w.receiving || '', w.returnedAt, p => `${p}-legacy-${result.releasers.length + result.receivers.length}`);
  }
  for (const r of data.returnRecords || []) result = addNames(result, r.returning, r.receiving, r.at, p => `${p}-return-${result.releasers.length + result.receivers.length}`);
  return result;
}
function requireName(value: string, label: string) { if (!cleanName(value) || cleanName(value).length > 200) throw new Error(`${label} must be 1–200 characters.`); }
function quantity(value: number) { if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new Error('Quantity must be a whole number from 1 to 1,000,000.'); }
function uniqueFactory(data: TrackerData, generator: (prefix: string) => string) {
  const used = new Set([...data.assets, ...data.withdrawals, ...data.activities, ...(data.batches || []), ...(data.returnRecords || [])].map(r => r.id));
  return (prefix: string) => { const id = generator(prefix); if (!id || used.has(id)) throw new Error('Unable to generate a unique record ID. No records were changed.'); used.add(id); return id; };
}
export function buildBatch(data: TrackerData, input: BatchInput, at: string, makeId: (prefix: string) => string): { next: TrackerData; batch: BatchRecord } {
  const done = (data.batches || []).find(b => b.id === input.requestId);
  if (done) return { next: data, batch: done };
  if (!input.requestId || input.items.length < 1 || input.items.length > 200) throw new Error('Select between 1 and 200 equipment items.');
  requireName(input.releaser, 'Releaser'); requireName(input.receiver, 'Receiver');
  if (!Number.isFinite(Date.parse(at)) || input.remarks.length > 10000) throw new Error('Invalid timestamp or remarks longer than 10,000 characters.');
  makeId = uniqueFactory(data, makeId);
  if (input.signature.length > 10000 || input.signature.some(s => s.length > 100000 || s.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))) throw new Error('Signature data is invalid or too large.');
  if (!input.signature.some(s => s.length > 2)) throw new Error('Save the receiver signature before confirmation.');
  if (!Number.isFinite(Date.parse(input.withdrawalAt)) || Date.parse(input.withdrawalAt) > Date.parse(at) + 60000) throw new Error('Withdrawal date must be valid and cannot be in the future.');
  if (!Number.isFinite(Date.parse(input.dueAt)) || Date.parse(input.dueAt) <= Date.parse(input.withdrawalAt)) throw new Error('Expected return must be later than withdrawal.');
  let assets = [...data.assets]; const records: Withdrawal[] = []; const events: Activity[] = []; const seen = new Set<string>();
  const reference = input.requestId;
  for (const line of input.items) {
    quantity(line.quantity); let asset = assets.find(a => a.id === line.assetId);
    if (line.manual) {
      if (!line.name?.trim() || !line.serial?.trim() || !line.description?.trim()) throw new Error('Manual equipment needs a name, unique Serial/Product ID and description.');
      if (line.name.length > 200 || line.serial.length > 200 || line.description.length > 10000) throw new Error('Manual equipment name/serial must be at most 200 characters; description at most 10,000.');
      asset = assets.find(a => a.serial.trim().toLowerCase() === line.serial!.trim().toLowerCase());
      if (asset && asset.name.trim().toLowerCase() !== line.name.trim().toLowerCase()) throw new Error('Manual Serial/Product ID belongs to a different equipment name.');
      if (!asset) {
        asset = { id: makeId('AST'), name: line.name.trim(), serial: line.serial.trim(), notes: line.description.trim(), quantity: line.quantity, createdAt: at, updatedAt: at };
        assets.unshift(asset);
        events.push({ id: makeId('ACT'), assetId: asset.id, type: 'added', person: cleanName(input.releaser), at, description: 'Equipment registered during withdrawal' });
      }
    }
    if (!asset || asset.archivedAt) throw new Error('A selected equipment record is unavailable.');
    if (seen.has(asset.id)) throw new Error('The same equipment cannot appear twice in a withdrawal transaction.');
    seen.add(asset.id);
    if (data.withdrawals.some(w => w.assetId === asset!.id && remainingQuantity(w) > 0)) throw new Error(`${asset.name} is already OUT or overdue. Return it first.`);
    if (line.quantity > assetCapacity(asset)) throw new Error(`${asset.name} has only ${assetCapacity(asset)} unit(s). Serialized legacy equipment has quantity 1.`);
    const w: Withdrawal = { id: makeId('WD'), assetId: asset.id, batchId: input.requestId, reference, quantity: line.quantity, returnedQuantity: 0, releaser: cleanName(input.releaser), receiver: cleanName(input.receiver), signature: copyReturnSignature(input.signature), withdrawalAt: input.withdrawalAt, dueAt: input.dueAt, notes: input.remarks.trim(), createdAt: at,
      equipmentSnapshot: { name: asset.name, serial: asset.serial, description: asset.notes } };
    records.push(w); events.push({ id: makeId('ACT'), assetId: asset.id, transactionId: w.id, type: 'withdrawal', person: w.receiver, at, description: `${reference} · ${line.quantity} unit(s) released` });
  }
  const batch: BatchRecord = { id: input.requestId, reference, withdrawalIds: records.map(w => w.id), createdAt: at };
  return { batch, next: { ...data, assets, batches: [batch, ...(data.batches || [])], withdrawals: [...records, ...data.withdrawals], activities: [...events, ...data.activities], nameDirectory: addNames(getNameDirectory(data), input.releaser, input.receiver, at, makeId) } };
}
export function buildReturns(data: TrackerData, input: ReturnMovementInput, at: string, makeId: (prefix: string) => string): TrackerData {
  if ((data.returnRecords || []).some(r => r.reference === input.requestId)) return data;
  requireName(input.returning, 'Returning personnel'); requireName(input.receiving, 'Receiving personnel');
  validateReturnSignature(input.receivingSignature); validateEquipmentCondition(input.condition);
  if (input.releasingSignature !== undefined) validateReturnSignature(input.releasingSignature, 'Releaser');
  if (!Number.isFinite(Date.parse(at)) || input.remarks.length > 10000) throw new Error('Invalid return timestamp or overly long remarks.');
  makeId = uniqueFactory(data, makeId);
  if (!input.requestId || !input.items.length) throw new Error('Select at least one item to return.');
  const seen = new Set<string>(); const records: ReturnRecord[] = []; const events: Activity[] = [];
  const replacements = new Map<string, Withdrawal>();
  for (const line of input.items) {
    quantity(line.quantity);
    if (seen.has(line.withdrawalId)) throw new Error('Duplicate return item.'); seen.add(line.withdrawalId);
    const w = data.withdrawals.find(w => w.id === line.withdrawalId);
    if (!w || remainingQuantity(w) < line.quantity) throw new Error('Return quantity exceeds the outstanding quantity, or the transaction is no longer active.');
    if (Date.parse(at) < Date.parse(w.withdrawalAt)) throw new Error('Return time cannot precede withdrawal.');
    const total = (w.returnedQuantity ?? 0) + line.quantity; const complete = total === (w.quantity ?? 1);
    // Historical signatures remain in their original field and immutable events.
    // An unsigned subsequent releaser cannot inherit someone else's prior ink.
    replacements.set(w.id, { ...w, returnedQuantity: total, ...(complete ? { returnedAt: at, alarmAcknowledgedAt: at } : {}), returning: cleanName(input.returning), receiving: cleanName(input.receiving), condition: input.condition, remarks: input.remarks.trim(), receivingSignature: copyReturnSignature(input.receivingSignature), releasingSignature: input.releasingSignature ? copyReturnSignature(input.releasingSignature) : undefined });
    records.push({ id: makeId('RTN'), reference: input.requestId, withdrawalId: w.id, assetId: w.assetId, quantity: line.quantity, at, returning: cleanName(input.returning), receiving: cleanName(input.receiving), condition: input.condition, remarks: input.remarks.trim(), receivingSignature: copyReturnSignature(input.receivingSignature), ...(input.releasingSignature ? { releasingSignature: copyReturnSignature(input.releasingSignature) } : {}) });
    events.push({ id: makeId('ACT'), assetId: w.assetId, transactionId: w.id, type: 'return', person: cleanName(input.returning), at, description: `${input.requestId} · ${line.quantity} returned · ${(w.quantity ?? 1) - total} outstanding` });
  }
  return { ...data, withdrawals: data.withdrawals.map(w => replacements.get(w.id) || w), returnRecords: [...records, ...(data.returnRecords || [])], activities: [...events, ...data.activities], nameDirectory: addNames(getNameDirectory(data), input.returning, input.receiving, at, makeId), notices: data.notices.map(n => n.withdrawalId && replacements.get(n.withdrawalId)?.returnedAt && ['due', 'overdue'].includes(n.type) ? { ...n, acknowledged: true } : n) };
}
export function manageName(data: TrackerData, role: NameRole, id: string, value: string | null): TrackerData {
  const directory = getNameDirectory(data); const list = directory[role];
  if (!list.some(n => n.id === id)) throw new Error('The saved name no longer exists.');
  if (value !== null) {
    requireName(value, 'Name');
    if (list.some(n => n.id !== id && nameKey(n.name) === nameKey(value))) throw new Error('That name already exists in this directory.');
  }
  return { ...data, nameDirectory: { ...directory, [role]: value === null ? list.filter(n => n.id !== id) : list.map(n => n.id === id ? { ...n, name: cleanName(value) } : n) } };
}

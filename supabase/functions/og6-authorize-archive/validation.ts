export class RequestError extends Error {}
export type ArchiveKind = 'asset' | 'withdrawal';
type JsonRecord = Record<string, unknown>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): JsonRecord { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('Invalid archival request.'); return value as JsonRecord; }
function text(value: unknown, label: string, max = 200): string { if (typeof value !== 'string' || !value.trim() || value.length > max || /\u0000/.test(value)) throw new RequestError(`Invalid ${label}.`); return value; }
function date(value: unknown, label: string): string { const result = text(value, label, 64); if (!Number.isFinite(Date.parse(result))) throw new RequestError(`Invalid ${label}.`); return result; }
function optionalDate(value: unknown, label: string) { return value == null ? undefined : date(value, label); }
function optionalText(value: unknown, label: string, max = 10000) { return value == null || value === '' ? undefined : text(value, label, max); }
export function parseArchiveRequest(value: unknown) {
  const body = record(value);
  const authorizationId = text(body.authorizationId, 'authorization reference', 36);
  const installationId = text(body.installationId, 'installation reference', 36);
  if (!uuidPattern.test(authorizationId) || !uuidPattern.test(installationId)) throw new RequestError('Invalid authorization reference.');
  if (body.phase === 'confirm') {
    const token = text(body.token, 'authorization token', 64);
    if (!/^[a-f0-9]{64}$/.test(token)) throw new RequestError('Invalid administrator authorization. No records were archived.');
    return { phase: 'confirm' as const, authorizationId, installationId, token };
  }
  if (body.phase !== 'authorize') throw new RequestError('Invalid authorization phase.');
  const password = text(body.password, 'administrator password', 1024);
  const input = record(body.snapshot);
  if (input.kind !== 'asset' && input.kind !== 'withdrawal') throw new RequestError('Invalid record type.');
  const kind = input.kind as ArchiveKind;
  const recordId = text(input.recordId, 'record reference');
  const source = record(input.asset);
  const archivedAt = optionalDate(source.archivedAt, 'asset archive date');
  const asset = { id: text(source.id, 'asset reference'), name: text(source.name, 'equipment name'), serial: text(source.serial, 'serial/product ID'), notes: text(source.notes, 'equipment notes', 10000), createdAt: date(source.createdAt, 'asset creation date'), updatedAt: date(source.updatedAt, 'asset update date'), ...(archivedAt ? { archivedAt } : {}) };
  if (!Array.isArray(input.activeWithdrawalIds) || input.activeWithdrawalIds.length > 100 || input.activeWithdrawalIds.some(id => typeof id !== 'string' || !id || id.length > 200)) throw new RequestError('Invalid withdrawal state.');
  const activeWithdrawalIds = input.activeWithdrawalIds as string[];
  let withdrawal: JsonRecord | null = null;
  if (kind === 'asset') {
    if (recordId !== asset.id || archivedAt || input.withdrawal != null) throw new RequestError('This equipment is unavailable for archival.');
    if (activeWithdrawalIds.length) throw new RequestError('This equipment is currently withdrawn and cannot be deleted until it is returned or the transaction is properly resolved.');
  } else {
    const original = record(input.withdrawal);
    if (original.deletedAt) throw new RequestError('This withdrawal is already archived.');
    const id = text(original.id, 'withdrawal reference');
    if (id !== recordId || original.assetId !== asset.id) throw new RequestError('Withdrawal does not match the equipment record.');
    const signature = original.signature;
    if (!Array.isArray(signature) || signature.length > 300 || !signature.length) throw new RequestError('Invalid receiver signature.');
    let points = 0;
    for (const stroke of signature) {
      if (!Array.isArray(stroke) || !stroke.length) throw new RequestError('Invalid receiver signature.');
      points += stroke.length;
      for (const value of stroke) { const point = record(value); if (typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 500 || point.y < 0 || point.y > 180 || Object.keys(point).some(key => !['x', 'y'].includes(key))) throw new RequestError('Invalid receiver signature.'); }
    }
    if (points > 15000) throw new RequestError('Signature is too large for secure archival.');
    const withdrawalAt = date(original.withdrawalAt, 'withdrawal date');
    const dueAt = date(original.dueAt, 'due date');
    if (Date.parse(dueAt) <= Date.parse(withdrawalAt)) throw new RequestError('Invalid withdrawal dates.');
    const returnedAt = optionalDate(original.returnedAt, 'return date');
    const returning = optionalText(original.returning, 'returning personnel', 200);
    const receiving = optionalText(original.receiving, 'receiving personnel', 200);
    const condition = optionalText(original.condition, 'return condition', 200);
    const remarks = optionalText(original.remarks, 'return remarks');
    const receivingSignatureAt = optionalDate(original.receivingSignatureAt, 'return signature date');
    const receivingSignature = original.receivingSignature;
    if (receivingSignature != null) {
      if (!returnedAt || !receiving || !receivingSignatureAt || !Array.isArray(receivingSignature) || !receivingSignature.length || receivingSignature.length > 300) throw new RequestError('Invalid receiving personnel signature.');
      let returnPoints = 0;
      let usable = false;
      for (const stroke of receivingSignature) {
        if (!Array.isArray(stroke) || !stroke.length) throw new RequestError('Invalid receiving personnel signature.');
        returnPoints += stroke.length;
        if (stroke.length > 2) usable = true;
        for (const value of stroke) {
          const point = record(value);
          if (typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 500 || point.y < 0 || point.y > 180 || Object.keys(point).some(key => !['x', 'y'].includes(key))) throw new RequestError('Invalid receiving personnel signature.');
        }
      }
      if (!usable || returnPoints > 15000) throw new RequestError('Return signature is invalid or too large for secure archival.');
      if (Date.parse(receivingSignatureAt) !== Date.parse(returnedAt)) throw new RequestError('Return signature timestamp does not match the return event.');
    } else if (receivingSignatureAt) throw new RequestError('Return signature is missing.');
    if (!returnedAt && !activeWithdrawalIds.includes(id)) throw new RequestError('Active withdrawal state is inconsistent.');
    withdrawal = { id, assetId: asset.id, releaser: text(original.releaser, 'releaser'), receiver: text(original.receiver, 'receiver'), signature, withdrawalAt, dueAt, createdAt: date(original.createdAt, 'transaction creation date'), notes: typeof original.notes === 'string' && original.notes.length <= 10000 ? original.notes : '', ...(returnedAt ? { returnedAt } : {}), ...(returning ? { returning } : {}), ...(receiving ? { receiving } : {}), ...(condition ? { condition } : {}), ...(remarks ? { remarks } : {}), ...(receivingSignature != null ? { receivingSignature, receivingSignatureAt } : {}) };
  }
  // Whitelist the audit snapshot; credentials and tokens are never part of it.
  return { phase: 'authorize' as const, authorizationId, installationId, password, snapshot: { kind, recordId, asset, withdrawal, activeWithdrawalIds } };
}

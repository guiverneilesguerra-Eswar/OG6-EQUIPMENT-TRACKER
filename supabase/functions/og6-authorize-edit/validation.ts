export interface EditAsset {
  id: string; name: string; serial: string; notes: string;
  createdAt: string; updatedAt: string; archivedAt?: string;
}
export interface EditRequest {
  requestId: string; installationId: string; password: string;
  before: EditAsset; changes: { name: string; serial: string; notes: string };
}
export class RequestError extends Error {}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('Invalid edit request.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, limit: number, trim = false) {
  if (typeof value !== 'string') throw new RequestError(`${label} is required.`);
  const result = trim ? value.trim() : value;
  if (!result.trim()) throw new RequestError(`${label} is required.`);
  if (result.length > limit || /\u0000/.test(result)) throw new RequestError(`${label} is too long or contains unsupported characters.`);
  return result;
}
function timestamp(value: unknown) {
  const result = text(value, 'Asset timestamp', 64);
  if (!Number.isFinite(Date.parse(result))) throw new RequestError('The equipment record has an invalid timestamp.');
  return result;
}
export function parseEditRequest(value: unknown): EditRequest {
  const body = record(value);
  if (typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.installationId !== 'string' || !uuidPattern.test(body.installationId)) {
    throw new RequestError('Invalid edit request reference.');
  }
  if (typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
    throw new RequestError('Edit password is required.');
  }
  const original = record(body.before);
  if (original.archivedAt) throw new RequestError('Archived equipment cannot be edited.');
  const changes = record(body.changes);
  const before: EditAsset = {
    id: text(original.id, 'Equipment ID', 200),
    name: text(original.name, 'Existing equipment name', 2000),
    serial: text(original.serial, 'Existing Serial/Product ID', 2000),
    notes: text(original.notes, 'Existing notes', 50000),
    createdAt: timestamp(original.createdAt), updatedAt: timestamp(original.updatedAt),
  };
  return {
    requestId: body.requestId, installationId: body.installationId, password: body.password, before,
    changes: {
      name: text(changes.name, 'Equipment name', 200, true),
      serial: text(changes.serial, 'Serial/Product ID', 200, true),
      notes: text(changes.notes, 'Notes', 10000, true),
    },
  };
}

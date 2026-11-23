import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { Signature } from './tracker';
import type { BatchLine } from './movements';
export interface WithdrawalSignatureDraft {
  requestId: string; source: string; items: BatchLine[]; quantityDrafts: Record<string, string>;
  name: string; serial: string; manualNotes: string; manualQuantity: string;
  releaser: string; receiver: string; signature: Signature; saved: boolean;
  withdrawalAt: string; dueAt: string; notes: string;
}
export interface ReturnSignatureDraft {
  target: string; requestId: string; quantities: Record<string, string>; returning: string; receiving: string;
  condition: string; remarks: string; receivingSignature: Signature; receivingSignatureSaved: boolean;
  releasingSignature: Signature; releasingSignatureSaved: boolean;
}
export interface SignatureFormDrafts { version: 1; withdrawal: WithdrawalSignatureDraft | null; equipmentReturn: ReturnSignatureDraft | null }
export const emptySignatureFormDrafts = (): SignatureFormDrafts => ({ version: 1, withdrawal: null, equipmentReturn: null });
const text = z.string().max(10000);
const ink = z.array(z.array(z.object({ x: z.number().finite().min(0).max(500), y: z.number().finite().min(0).max(180) }))).max(10000);
const schema = z.object({ version: z.literal(1), withdrawal: z.object({
  requestId: text, source: text, items: z.array(z.object({ assetId: text, quantity: z.number(), manual: z.boolean().optional(), name: text.optional(), serial: text.optional(), description: text.optional() })),
  quantityDrafts: z.record(z.string()), name: text, serial: text, manualNotes: text, manualQuantity: text,
  releaser: text, receiver: text, signature: ink, saved: z.boolean(), withdrawalAt: text, dueAt: text, notes: text,
}).nullable(), equipmentReturn: z.object({
  target: text, requestId: text, quantities: z.record(z.string()), returning: text, receiving: text, condition: text, remarks: text,
  receivingSignature: ink, receivingSignatureSaved: z.boolean(), releasingSignature: ink, releasingSignatureSaved: z.boolean(),
}).nullable() });
const draftKey = 'og6.signatureFormDrafts.v1';
let pendingWrite: Promise<void> = Promise.resolve();
export function parseSignatureFormDrafts(value: unknown): SignatureFormDrafts {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('The saved signature draft cannot be read. Existing draft data has not been overwritten.');
  return parsed.data as SignatureFormDrafts;
}
export async function loadSignatureFormDrafts(): Promise<SignatureFormDrafts> {
  const raw = await AsyncStorage.getItem(draftKey);
  return raw ? parseSignatureFormDrafts(JSON.parse(raw)) : emptySignatureFormDrafts();
}
export function saveSignatureFormDrafts(value: SignatureFormDrafts): Promise<void> {
  // Serialize writes: an earlier slow write can never replace newer ink/save state.
  const raw = JSON.stringify(value);
  const next = pendingWrite.catch(() => {}).then(() => AsyncStorage.setItem(draftKey, raw));
  pendingWrite = next; return next;
}

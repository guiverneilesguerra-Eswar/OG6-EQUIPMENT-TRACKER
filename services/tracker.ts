import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeAudioPreferences } from './audioPreferences';
import { normalizeAudioSelections } from './audioConfiguration';
import type { AuthorizedAlertSound } from './alertSoundValidation';
import type { AcknowledgementSource } from './alarmAcknowledgements';

export interface Asset { id: string; name: string; serial: string; notes: string; createdAt: string; updatedAt: string; archivedAt?: string }
export interface Point { x: number; y: number }
export type Signature = Point[][];
export interface Withdrawal {
  id: string; assetId: string; releaser: string; receiver: string; signature: Signature;
  withdrawalAt: string; dueAt: string; createdAt: string; returnedAt?: string;
  returning?: string; receiving?: string; condition?: string; remarks?: string; notes: string;
  deletedAt?: string; alarmAcknowledgedAt?: string;
}
export interface Activity { id: string; assetId: string; transactionId?: string; type: 'added' | 'withdrawal' | 'return' | 'edit' | 'archive' | 'alarm-acknowledgement'; person: string; at: string; description: string; authorizationId?: string; withdrawalIds?: string[]; acknowledgementSource?: AcknowledgementSource }
export interface Notice { id: string; assetId?: string; withdrawalId?: string; type: 'success' | 'due' | 'overdue' | 'error'; priority?: 'critical'; title: string; message: string; at: string; read: boolean; acknowledged: boolean }
export interface Settings {
  theme: 'light' | 'dark'; notificationVolume: number; alarmVolume: number;
  alarmEnabled?: boolean; audioPreferencesVersion?: number;
  notificationSound?: AuthorizedAlertSound | null; alarmSound?: AuthorizedAlertSound | null;
  /** Legacy shared selection, preserved for migration only. */
  alertSound?: AuthorizedAlertSound; enabled: boolean;
  warningHours: number; role: 'operator' | 'viewer';
}
export interface InventoryImportAudit { id: string; filename: string; at: string; importedAssetIds: string[]; duplicatesSkipped: number; invalidRows: number; totalProcessed: number }
export interface TrackerData { inventoryImports?: InventoryImportAudit[]; version: number; assets: Asset[]; withdrawals: Withdrawal[]; activities: Activity[]; notices: Notice[]; settings: Settings; alertKeys?: string[] }
const key = 'og6.tracker.v1';
export const emptyData = (): TrackerData => ({
  version: 1, assets: [], withdrawals: [], activities: [], notices: [],
  settings: { theme: 'dark', notificationVolume: 100, alarmVolume: 100, alarmEnabled: true,
    audioPreferencesVersion: 2, notificationSound: null, alarmSound: null, enabled: true, warningHours: 24, role: 'operator' },
});
export async function loadData(): Promise<TrackerData> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return emptyData();
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.assets) || !Array.isArray(parsed.withdrawals) || !Array.isArray(parsed.activities) || !Array.isArray(parsed.notices)) {
    throw new Error('Local records could not be loaded. Existing data has not been changed.');
  }
  // Preserve legacy acknowledgement decisions independently of later notice clearing.
  const acknowledged = new Set(parsed.notices.filter((n: Notice) => n.type === 'overdue' && n.acknowledged).map((n: Notice) => n.withdrawalId));
  return {
    ...parsed,
    withdrawals: parsed.withdrawals.map((w: Withdrawal) => acknowledged.has(w.id) && !w.alarmAcknowledgedAt ? { ...w, alarmAcknowledgedAt: new Date().toISOString() } : w),
    settings: { ...emptyData().settings, ...parsed.settings, ...normalizeAudioPreferences(parsed.settings || {}), ...normalizeAudioSelections(parsed.settings || {}) },
  };
}
export async function saveData(data: TrackerData) { await AsyncStorage.setItem(key, JSON.stringify(data)); }
export function uid(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
export function isActive(w: Withdrawal) { return !w.returnedAt && !w.deletedAt; }
export function assetStatus(assetId: string, withdrawals: Withdrawal[], now = Date.now()): 'IN' | 'OUT' | 'OVERDUE' {
  const w = withdrawals.find(x => x.assetId === assetId && isActive(x));
  return w ? (new Date(w.dueAt).getTime() < now ? 'OVERDUE' : 'OUT') : 'IN';
}
export function formatDate(value: string | number | Date, full = false) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '—';
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', ...(full ? { weekday: 'long' as const } : {}), day: '2-digit', month: full ? 'long' : 'short', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  return `${day} | ${time}`;
}
export function manilaParts(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
export function notice(type: Notice['type'], title: string, message: string, assetId?: string, withdrawalId?: string): Notice {
  return { id: uid('NTF'), type, title, message, assetId, withdrawalId, at: new Date().toISOString(), read: false, acknowledged: false };
}
export function alerts(data: TrackerData, now: number): Notice[] {
  if (!data.settings.enabled) return [];
  return data.withdrawals.filter(isActive).flatMap(w => {
    const remaining = new Date(w.dueAt).getTime() - now;
    const type = remaining < 0 ? 'overdue' : remaining <= data.settings.warningHours * 3600000 ? 'due' : null;
    // Acknowledging directly from the alarm banner can precede notice creation by a few seconds.
    if (!type || (type === 'overdue' && w.alarmAcknowledgedAt) || data.alertKeys?.includes(`${w.id}:${type}`) || data.notices.some(n => n.withdrawalId === w.id && n.type === type)) return [];
    const name = data.assets.find(a => a.id === w.assetId)?.name || 'Equipment';
    return [notice(type, type === 'overdue' ? 'Overdue equipment' : 'Equipment return reminder',
      type === 'overdue' ? `${name} has not been returned. Please coordinate its immediate return.` : `${name} is due on ${formatDate(w.dueAt)}.`, w.assetId, w.id)];
  });
}
export function validateAsset(data: TrackerData, name: string, serial: string, notes: string, editingId?: string) {
  if (!name.trim()) throw new Error('Equipment name is required.');
  if (!serial.trim()) throw new Error('Serial/Product ID is required.');
  if (!notes.trim()) throw new Error('Notes are required.');
  if (data.assets.some(a => a.id !== editingId && a.serial.trim().toLowerCase() === serial.trim().toLowerCase())) throw new Error('An equipment record with this Serial/Product ID already exists.');
}

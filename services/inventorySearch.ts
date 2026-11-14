// Read-only inventory lookup. Never coerce serials to numbers or interpret QR payloads.
export interface SearchableInventoryAsset { name: string; serial: string; notes: string; archivedAt?: string }
export function readScannedInventorySerial(value: unknown): string {
  if (typeof value !== 'string') throw new Error('This code does not contain a text Serial/Product ID. Try another label.');
  const serial = value.trim();
  if (!serial || serial.length > 4096 || /[\u0000-\u001f\u007f]/.test(serial)) {
    throw new Error('This code does not contain a supported Serial/Product ID. Try another label or use manual search.');
  }
  return serial;
}
export function inventorySerialMatches(serial: string, query: string): boolean {
  return serial.trim().toLowerCase() === query.trim().toLowerCase();
}
export function searchInventoryAssets<T extends SearchableInventoryAsset>(assets: readonly T[], query: string, exactSerial = false): T[] {
  return assets.filter(asset => !asset.archivedAt && (exactSerial
    ? inventorySerialMatches(asset.serial, query)
    : `${asset.name} ${asset.serial} ${asset.notes}`.toLowerCase().includes(query.toLowerCase())));
}

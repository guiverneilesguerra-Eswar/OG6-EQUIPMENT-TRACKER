import { Camera } from 'expo-camera';
import { Linking, Platform } from 'react-native';

export interface InventoryCameraPermission { granted: boolean; canAskAgain: boolean }
export const inventoryCameraSupported = Platform.OS === 'ios' || Platform.OS === 'android';
export async function getInventoryCameraPermission(ask: boolean): Promise<InventoryCameraPermission> {
  if (!inventoryCameraSupported) throw new Error('Camera label scanning requires an iOS or Android device. Use manual inventory search in Live Preview.');
  let permission = await Camera.getCameraPermissionsAsync();
  if (ask && !permission.granted && permission.canAskAgain) permission = await Camera.requestCameraPermissionsAsync();
  return { granted: permission.granted, canAskAgain: permission.canAskAgain };
}
export async function openInventoryCameraSettings(): Promise<void> {
  await Linking.openSettings();
}

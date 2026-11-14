import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BarcodeScanningResult } from 'expo-camera';
import { getInventoryCameraPermission, inventoryCameraSupported, InventoryCameraPermission, openInventoryCameraSettings } from '@/services/inventoryCamera';
import { readScannedInventorySerial } from '@/services/inventorySearch';

export function useInventoryScanner(onScanned: (serial: string) => void) {
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<InventoryCameraPermission | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [appActive, setAppActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [scanError, setScanError] = useState('');
  const [torch, setTorch] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const mounted = useRef(true);
  const open = useRef(false);
  const active = useRef(false);
  const ready = useRef(false);
  const accepted = useRef(false);
  const permissionBusy = useRef(false);
  const session = useRef(0);
  const callback = useRef(onScanned);
  callback.current = onScanned;

  const close = useCallback(() => {
    session.current += 1; open.current = false; ready.current = false; accepted.current = true;
    if (mounted.current) { setVisible(false); setCameraReady(false); setTorch(false); setScanError(''); }
  }, []);

  const checkPermission = useCallback(async (ask: boolean) => {
    if (!inventoryCameraSupported || permissionBusy.current || !open.current) return;
    permissionBusy.current = true;
    const generation = session.current;
    ready.current = false; setCameraReady(false);
    setRequesting(true); setPermissionError('');
    try {
      const result = await getInventoryCameraPermission(ask);
      if (mounted.current && open.current && generation === session.current) setPermission(result);
    } catch {
      if (mounted.current && open.current && generation === session.current) {
        setPermission(null);
        setPermissionError('Unable to check camera access. Try again or use manual inventory search.');
      }
    } finally {
      permissionBusy.current = false;
      if (mounted.current) setRequesting(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const update = (state: string) => {
      const foreground = state === 'active';
      active.current = foreground; setAppActive(foreground);
      if (!foreground) {
        ready.current = false; setCameraReady(false); setTorch(false);
      } else if (open.current) {
        // Refresh after returning from device settings; never prompt on app resume.
        void checkPermission(false);
      }
    };
    update(AppState.currentState || 'active');
    const subscription = AppState.addEventListener('change', update);
    return () => {
      mounted.current = false; open.current = false; ready.current = false; session.current += 1;
      subscription.remove();
    };
  }, [checkPermission]);

  useFocusEffect(useCallback(() => () => close(), [close]));

  const start = useCallback(() => {
    if (open.current) return;
    Keyboard.dismiss(); session.current += 1; open.current = true; ready.current = false; accepted.current = false;
    setVisible(true); setCameraReady(false); setCameraError(''); setPermissionError(''); setScanError(''); setTorch(false);
    setCameraKey(value => value + 1);
    if (inventoryCameraSupported) void checkPermission(true);
  }, [checkPermission]);

  const onCameraReady = useCallback(() => {
    if (!open.current || !active.current) return;
    ready.current = true; setCameraReady(true);
  }, []);
  const onMountError = useCallback(() => {
    if (!open.current) return;
    ready.current = false; setCameraReady(false); setTorch(false);
    setCameraError('Unable to start the camera. Close other camera apps, check camera permission, and try again.');
  }, []);
  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!open.current || !active.current || !ready.current || accepted.current) return;
    // Latch synchronously: repeated native events cannot apply a scan twice.
    accepted.current = true;
    try {
      const serial = readScannedInventorySerial(result.data);
      close(); callback.current(serial);
    } catch (error) {
      if (open.current) setScanError(error instanceof Error ? error.message : 'Unable to read this label. Use manual inventory search.');
    }
  }, [close]);
  const scanAgain = useCallback(() => { accepted.current = false; setScanError(''); }, []);
  const retryCamera = useCallback(() => {
    ready.current = false; accepted.current = false;
    setCameraReady(false); setCameraError(''); setScanError(''); setTorch(false); setCameraKey(value => value + 1);
    void checkPermission(false);
  }, [checkPermission]);
  const requestAccess = useCallback(() => { void checkPermission(true); }, [checkPermission]);
  const openSettings = useCallback(async () => {
    try { await openInventoryCameraSettings(); }
    catch { if (mounted.current && open.current) setPermissionError('Unable to open device settings. Enable camera access in your device settings manually.'); }
  }, []);
  const toggleTorch = useCallback(() => { if (ready.current && open.current && active.current) setTorch(value => !value); }, []);
  const cameraActive = visible && appActive && Boolean(permission?.granted) && !requesting && !cameraError && inventoryCameraSupported;

  return { visible, start, close, supported: inventoryCameraSupported, permission, requesting, appActive,
    cameraActive, cameraReady, cameraKey, cameraError, permissionError, scanError, torch,
    onCameraReady, onMountError, onBarcodeScanned, scanAgain, retryCamera, requestAccess, openSettings, toggleTorch };
}
export type InventoryScannerModel = ReturnType<typeof useInventoryScanner>;

import { memo } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import type { BarcodeType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { InventoryScannerModel } from '@/hooks/useInventoryScanner';
import { useTracker } from '@/hooks/useTracker';
import { useResponsive } from '@/hooks/useResponsive';
import { Button, ErrorText } from '@/components/ui/Controls';
import { density, leading, radius, spacing, type } from '@/constants/theme';

interface InventoryScannerProps { model: InventoryScannerModel }
const barcodeScannerSettings: { barcodeTypes: BarcodeType[] } = {
  barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'pdf417', 'datamatrix', 'aztec'],
};

export const InventoryScanner = memo(function InventoryScanner({ model: m }: InventoryScannerProps) {
  const { colors: c } = useTracker();
  const { landscape } = useResponsive();
  const blocked = m.permission?.canAskAgain === false && !m.permission.granted;
  const title = !m.supported ? 'DEVICE CAMERA REQUIRED' : m.requesting ? 'CHECKING CAMERA ACCESS'
    : m.cameraError ? 'CAMERA UNAVAILABLE' : !m.permission?.granted ? 'CAMERA PERMISSION REQUIRED'
      : !m.appActive ? 'SCANNER PAUSED' : 'ALIGN A BARCODE OR QR CODE';

  return <Modal visible={m.visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={m.close} supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.headerBg, borderColor: c.borderBright }]}>
        <View style={[styles.headerIcon, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}><Ionicons name="scan-outline" size={26} color={c.primary} /></View>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: c.text }]}>SCAN INVENTORY LABEL</Text><Text style={[styles.caption, { color: c.subtle }]}>READ-ONLY SERIAL LOOKUP</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel inventory scan" onPress={m.close} style={({ pressed }) => [styles.close, { backgroundColor: c.surfaceAlt, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="close-outline" size={26} color={c.text} /></Pressable>
      </View>
      <View style={[styles.body, landscape ? styles.landscapeBody : null]}>
        <View accessibilityLabel="Inventory label camera preview" style={[styles.preview, { backgroundColor: c.surfaceAlt, borderColor: c.borderBright, shadowColor: c.shadow }]}>
          {m.cameraActive ? <>
            <CameraView key={m.cameraKey} style={StyleSheet.absoluteFill} facing="back" mode="picture" autofocus="on" enableTorch={m.torch} barcodeScannerSettings={barcodeScannerSettings} onCameraReady={m.onCameraReady} onMountError={m.onMountError} onBarcodeScanned={!m.scanError ? m.onBarcodeScanned : undefined} />
            <View pointerEvents="none" style={styles.cameraOverlay}>
              <View style={styles.frame}>
                <View style={[styles.corner, styles.topLeft, { borderColor: c.primary }]} /><View style={[styles.corner, styles.topRight, { borderColor: c.primary }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: c.primary }]} /><View style={[styles.corner, styles.bottomRight, { borderColor: c.primary }]} />
                <View style={[styles.scanLine, { backgroundColor: c.primary }]} />
              </View>
              <View style={[styles.cameraStatus, { backgroundColor: c.headerSurface, borderColor: c.borderBright }]}>
                {!m.cameraReady ? <ActivityIndicator size="small" color={c.primary} /> : <Ionicons name="scan-outline" size={18} color={c.primary} />}
                <Text style={[styles.caption, { color: c.text }]}>{m.cameraReady ? 'READY · ONE LABEL AT A TIME' : 'STARTING CAMERA…'}</Text>
              </View>
            </View>
          </> : <View style={styles.placeholder}>
            {m.requesting ? <ActivityIndicator size="large" color={c.primary} /> : <Ionicons name={!m.supported ? 'phone-portrait-outline' : m.cameraError ? 'alert-circle-outline' : !m.permission?.granted ? 'lock-closed-outline' : 'pause-circle-outline'} size={48} color={c.primary} />}
            <Text style={[styles.placeholderTitle, { color: c.text }]}>{title}</Text>
          </View>}
        </View>
        <View style={[styles.instructions, { backgroundColor: c.surfaceGlass, borderColor: c.border }, landscape ? styles.landscapeInstructions : null]}>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.instructionsContent}>
            <View style={styles.sectionHeading}><Ionicons name="barcode-outline" size={24} color={c.primary} /><Text style={[styles.sectionTitle, { color: c.text }]}>FIND EXISTING EQUIPMENT</Text></View>
            <Text style={[styles.description, { color: c.subtle }]}>{!m.supported
              ? 'Barcode and QR camera scanning is available in installed iOS and Android builds. Use manual inventory search in Live Preview.'
              : blocked ? 'Camera access is disabled. Enable camera permission for this app in device settings, then return here.'
                : !m.permission?.granted ? 'Allow camera access to read equipment barcodes and QR labels. No photos, videos, or audio are recorded or uploaded.'
                  : 'Hold one label steady and fill the guide. The code must contain the Serial/Product ID itself; URLs and QR text are not opened or interpreted.'}</Text>
            <ErrorText message={m.permissionError || m.cameraError || m.scanError} />
            {m.supported && !m.permission?.granted ? <Button title={blocked ? 'Open device settings' : 'Allow camera'} icon={blocked ? 'settings-outline' : 'camera-outline'} onPress={blocked ? () => void m.openSettings() : m.requestAccess} loading={m.requesting} /> : null}
            {m.cameraError ? <Button title="Retry camera" icon="refresh-outline" onPress={m.retryCamera} loading={m.requesting} /> : null}
            {m.permissionError && m.permission?.granted ? <Button title="Retry camera access" icon="refresh-outline" onPress={m.requestAccess} loading={m.requesting} /> : null}
            {m.scanError ? <Button title="Try another code" icon="scan-outline" onPress={m.scanAgain} /> : null}
            {m.cameraActive ? <Button title={m.torch ? 'Turn flashlight off' : 'Turn flashlight on'} icon="flashlight-outline" secondary onPress={m.toggleTorch} disabled={!m.cameraReady} /> : null}
            <Button title="Use manual search" icon="search-outline" secondary onPress={m.close} />
            <View style={[styles.privacy, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}><Ionicons name="shield-checkmark-outline" size={20} color={c.primary} /><Text style={[styles.caption, { color: c.subtle }]}>Exact serial matching keeps leading zeros. Scanning never adds, edits, withdraws, or deletes equipment.</Text></View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
});

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, padding: density.cardPadding, borderBottomWidth: 1 },
  headerIcon: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' }, headerCopy: { flex: 1, minWidth: 1 },
  title: { fontSize: type.label, lineHeight: leading.label, fontWeight: '700', includeFontPadding: false }, caption: { fontSize: type.caption, lineHeight: leading.caption, flexShrink: 1, includeFontPadding: false },
  close: { width: 48, height: 48, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, minHeight: 1, gap: density.cardGap, padding: density.cardPadding, width: '100%', maxWidth: 960, alignSelf: 'center' }, landscapeBody: { flexDirection: 'row' },
  preview: { flex: 1, minWidth: 1, minHeight: 1, borderWidth: 1.5, borderRadius: radius.lg, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 2 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' }, frame: { width: '84%', height: '64%', maxWidth: 360, maxHeight: 240 },
  corner: { position: 'absolute', width: spacing.xl, height: spacing.xl }, topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }, topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }, bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }, bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: { position: 'absolute', top: '50%', left: spacing.sm, right: spacing.sm, height: 1, opacity: 0.65 },
  cameraStatus: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm, padding: density.cardPadding, borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: density.iconGap },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: density.sectionGap, padding: spacing.md }, placeholderTitle: { fontSize: type.small, lineHeight: leading.small, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  instructions: { flex: 0.85, minHeight: 1, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' }, landscapeInstructions: { flex: 0, width: '40%', maxWidth: 360 },
  scroll: { flex: 1 }, instructionsContent: { padding: density.cardPadding, gap: density.cardGap }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, sectionTitle: { flex: 1, fontSize: type.meta, lineHeight: leading.small, fontWeight: '700', includeFontPadding: false },
  description: { fontSize: type.body, lineHeight: leading.body, includeFontPadding: false }, privacy: { flexDirection: 'row', alignItems: 'flex-start', padding: density.cardPadding, borderWidth: 1, borderRadius: radius.sm, gap: density.iconGap },
});

import { memo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset, Withdrawal } from '@/services/tracker';
import { ReceiptKind } from '@/services/receipts';
import { useReceipt } from '@/hooks/useReceipt';
import { useTracker } from '@/hooks/useTracker';
import { useReceiptViewMode } from '@/hooks/useReceiptViewMode';
import { Button, ErrorText } from '@/components/ui/Controls';
import { ReceiptPreview } from './ReceiptPreview';
import { ReceiptTextView } from './ReceiptTextView';
import { ReceiptViewSelector } from './ReceiptViewSelector';
import { leading, spacing, type, density } from '@/constants/theme';

interface ActionsProps { asset: Asset; withdrawal: Withdrawal; kind: ReceiptKind; returnReference?: string }
export const ReceiptActions = memo(function ReceiptActions({ asset, withdrawal, kind, returnReference }: ActionsProps) {
  const m = useReceipt(asset, withdrawal, kind, returnReference); const { colors: c } = useTracker();
  const view = useReceiptViewMode(m.file);
  return <View style={styles.actions}>
    <View style={styles.fileRow}><Ionicons name="document-text-outline" size={24} color={c.primary} /><Text style={[styles.filename, { color: c.text }]} selectable>{m.file?.filename || 'PDF RECEIPT'}</Text></View>
    {m.preparing ? <View style={styles.progress}><ActivityIndicator color={c.primary} /><Text style={[styles.message, { color: c.subtle }]}>Preparing PDF…</Text></View> : null}
    <ErrorText message={m.error} />
    {!m.file && !m.preparing ? <Button title="Retry PDF generation" secondary onPress={m.retry} /> : null}
    {m.file?.readable ? <ReceiptViewSelector mode={view.mode} onChange={view.selectMode} /> : null}
    {/* Keep A4 mounted when hidden so its zoom and pan survive view switching. */}
    <View style={view.mode === 'text' ? styles.hidden : null} accessibilityElementsHidden={view.mode === 'text'} importantForAccessibility={view.mode === 'text' ? 'no-hide-descendants' : 'auto'}>
      {m.file?.preview ? <ReceiptPreview document={m.file.preview} filename={m.file.filename} /> : null}
    </View>
    {view.mode === 'text' && m.file?.readable ? <ReceiptTextView document={m.file.readable} filename={m.file.filename} /> : null}
    <Button title="Share / send PDF" icon="share-outline" disabled={!m.file || m.printing} loading={m.delivering} onPress={() => void m.deliver(true)} />
    <Button title={Platform.OS === 'web' ? 'Download PDF' : 'Save PDF on device'} secondary icon="download-outline" disabled={!m.file || m.delivering || m.printing} onPress={() => void m.deliver(false)} />
    <Button title="Print complete receipt" secondary icon="print-outline" disabled={!m.file || m.delivering} loading={m.printing} onPress={() => void m.print()} />
    {m.message ? <Text accessibilityRole="alert" style={[styles.message, { color: c.primary }]}>{m.message}</Text> : null}
    <Text style={[styles.privacy, { color: c.subtle }]}>One A4 sheet. All items and signatures are retained; large batches or long remarks use smaller text. For easier reading, use the preview zoom controls or export the Excel report.</Text>
    <Text style={[styles.privacy, { color: c.subtle }]}>Contains personnel details and a signature. Share only with authorized recipients.</Text>
  </View>;
});

const styles = StyleSheet.create({ hidden: { display: 'none' }, actions: { gap: density.iconGap, marginTop: density.sectionGap }, fileRow: { flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, filename: { flex: 1, fontSize: type.small, lineHeight: leading.small }, progress: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, message: { fontSize: type.label, lineHeight: leading.label }, privacy: { fontSize: type.caption, lineHeight: leading.caption } });

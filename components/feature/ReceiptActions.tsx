import { memo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset, Withdrawal } from '@/services/tracker';
import { ReceiptKind } from '@/services/receipts';
import { useReceipt } from '@/hooks/useReceipt';
import { useTracker } from '@/hooks/useTracker';
import { Button, ErrorText } from '@/components/ui/Controls';
import { leading, spacing, type, density } from '@/constants/theme';

interface ActionsProps { asset: Asset; withdrawal: Withdrawal; kind: ReceiptKind }
export const ReceiptActions = memo(function ReceiptActions({ asset, withdrawal, kind }: ActionsProps) {
  const m = useReceipt(asset, withdrawal, kind); const { colors: c } = useTracker();
  return <View style={styles.actions}>
    <View style={styles.fileRow}><Ionicons name="document-text-outline" size={24} color={c.primary} /><Text style={[styles.filename, { color: c.text }]} selectable>{m.file?.filename || 'PDF RECEIPT'}</Text></View>
    <Text style={[styles.privacy, { color: c.subtle }]}>A4 portrait · one page · 12-point text. Helvetica retained until a licensed Arial font is supplied.</Text>
    {m.preparing ? <View style={styles.progress}><ActivityIndicator color={c.primary} /><Text style={[styles.message, { color: c.subtle }]}>Preparing PDF…</Text></View> : null}
    <ErrorText message={m.error} />
    {!m.file && !m.preparing ? <Button title="Retry PDF generation" secondary onPress={m.retry} /> : null}
    <Button title="Share / send PDF" icon="share-outline" disabled={!m.file} loading={m.delivering} onPress={() => void m.deliver(true)} />
    <Button title={Platform.OS === 'web' ? 'Download PDF' : 'Save PDF on device'} secondary icon="download-outline" disabled={!m.file || m.delivering} onPress={() => void m.deliver(false)} />
    {m.message ? <Text accessibilityRole="alert" style={[styles.message, { color: c.primary }]}>{m.message}</Text> : null}
    <Text style={[styles.privacy, { color: c.subtle }]}>Contains personnel details and a signature. Share only with authorized recipients.</Text>
  </View>;
});

const styles = StyleSheet.create({ actions: { gap: density.iconGap, marginTop: density.sectionGap }, fileRow: { flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, filename: { flex: 1, fontSize: type.small, lineHeight: leading.small }, progress: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, message: { fontSize: type.label, lineHeight: leading.label }, privacy: { fontSize: type.caption, lineHeight: leading.caption } });

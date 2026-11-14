import { memo, useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormModal } from '@/components/ui/FormModal';
import { Button, ErrorText } from '@/components/ui/Controls';
import { useInventoryImport } from '@/hooks/useInventoryImport';
import { useResponsive } from '@/hooks/useResponsive';
import type { InventoryPreviewRow } from '@/services/inventoryImportValidation';
import { formatDate } from '@/services/tracker';
import { Colors, density, leading, radius, spacing, type } from '@/constants/theme';

interface ProgressProps { progress: number; label: string; colors: Colors }
const InventoryProgress = memo(function InventoryProgress({ progress, label, colors: c }: ProgressProps) {
  const animated = useRef(new Animated.Value(0)).current;
  useEffect(() => { const animation = Animated.timing(animated, { toValue: Math.max(0, Math.min(1, progress)), duration: 220, useNativeDriver: false }); animation.start(); return () => animation.stop(); }, [animated, progress]);
  return <View style={styles.progressBlock} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
    <View style={styles.heading}><ActivityIndicator color={c.primary} /><Text style={[styles.body, { color: c.text }]}>{label}</Text></View>
    <View style={[styles.progressTrack, { backgroundColor: c.surfaceAlt }]}><Animated.View style={[styles.progressFill, { backgroundColor: c.primary, width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
  </View>;
});
interface MetricProps { label: string; value: number; tone: string; colors: Colors; wide: boolean }
const ImportMetric = memo(function ImportMetric({ label, value, tone, colors: c, wide }: MetricProps) {
  return <View style={[styles.metric, wide ? styles.metricWide : null, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}><Text style={[styles.metricValue, { color: tone }]}>{value.toLocaleString('en-US')}</Text><Text style={[styles.metricLabel, { color: c.subtle }]}>{label}</Text></View>;
});
interface RowProps { row: InventoryPreviewRow; colors: Colors; wide: boolean }
const ImportPreviewRow = memo(function ImportPreviewRow({ row, colors: c, wide }: RowProps) {
  const valid = row.status === 'valid'; const tone = valid ? c.success : c.danger;
  return <View style={[styles.row, wide ? styles.tableRow : null, { borderColor: tone, backgroundColor: valid ? c.successBg : c.dangerBg }]}>
    <View style={[styles.cell, wide ? styles.itemColumn : null]}>{!wide ? <Text style={[styles.cellLabel, { color: c.subtle }]}>ROW {row.rowNumber} · ITEM</Text> : null}<Text selectable style={[styles.item, { color: c.text }]}>{row.item || '—'}</Text>{wide ? <Text style={[styles.cellLabel, { color: c.subtle }]}>Row {row.rowNumber}</Text> : null}</View>
    <View style={[styles.cell, wide ? styles.serialColumn : null]}>{!wide ? <Text style={[styles.cellLabel, { color: c.subtle }]}>SERIAL/PRODUCT ID</Text> : null}<Text selectable style={[styles.body, { color: c.text }]}>{row.serial || '—'}</Text></View>
    <View style={[styles.cell, wide ? styles.notesColumn : null]}>{!wide ? <Text style={[styles.cellLabel, { color: c.subtle }]}>NOTES</Text> : null}<Text selectable numberOfLines={4} style={[styles.body, { color: c.subtle }]}>{row.notes || '—'}</Text></View>
    <View style={[styles.cell, wide ? styles.resultColumn : null]}><View style={styles.heading}><Ionicons name={valid ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={18} color={tone} /><Text style={[styles.validation, { color: tone }]}>{valid ? 'VALID · IN' : row.status.toUpperCase()}</Text></View>{row.reasons.length ? <Text selectable style={[styles.reason, { color: tone }]}>{row.reasons.join(' ')}</Text> : null}</View>
  </View>;
});
interface Props { model: ReturnType<typeof useInventoryImport> }
export function InventoryImportDialog({ model: m }: Props) {
  const c = m.colors; const { width } = useResponsive(); const wide = Math.min(650, Math.max(1, width - spacing.md * 2)) - density.cardPadding * 2 >= 540;
  const working = ['selecting', 'reading', 'saving'].includes(m.stage);
  const result = m.result;
  const rows = m.stage === 'preview' ? m.preview?.rows || [] : m.stage === 'completed' ? result?.rows.filter(row => row.status !== 'valid') || [] : [];
  const renderRow = useCallback(({ item }: { item: InventoryPreviewRow }) => <ImportPreviewRow row={item} colors={c} wide={wide} />, [c, wide]);
  const metrics = m.stage === 'completed' && result ? [
    { label: 'Successfully Imported', value: result.imported, tone: c.success }, { label: 'Duplicates Skipped', value: result.duplicatesSkipped, tone: c.danger }, { label: 'Invalid Rows', value: result.invalidRows, tone: c.danger }, { label: 'Total Processed', value: result.totalProcessed, tone: c.primary },
  ] : [
    { label: 'Total Rows', value: m.counts.total, tone: c.primary }, { label: 'Valid Records', value: m.counts.valid, tone: c.success }, { label: 'Duplicate Records', value: m.counts.duplicate, tone: c.danger }, { label: 'Invalid Records', value: m.counts.invalid, tone: c.danger },
  ];
  const tableHeader = rows.length && wide ? <View style={[styles.tableHeader, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}><Text style={[styles.tableLabel, styles.itemColumn, { color: c.subtle }]}>ITEM</Text><Text style={[styles.tableLabel, styles.serialColumn, { color: c.subtle }]}>SERIAL/PRODUCT ID</Text><Text style={[styles.tableLabel, styles.notesColumn, { color: c.subtle }]}>NOTES</Text><Text style={[styles.tableLabel, styles.resultColumn, { color: c.subtle }]}>VALIDATION RESULT</Text></View> : null;
  const header = <View style={styles.headerContent}>
    {working ? <><InventoryProgress progress={m.progress} label={m.progressLabel} colors={c} /><Text style={[styles.body, { color: c.subtle }]}>{m.stage === 'saving' ? 'One locked batch is being saved. Keep the app open until confirmation.' : 'The workbook is read on this device. No inventory records have been changed.'}</Text></> : null}
    {m.stage === 'failed' ? <View style={[styles.notice, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}><Ionicons name="document-text-outline" size={32} color={c.primary} /><Text style={[styles.body, { color: c.subtle }]}>Use the official .xlsx template with an Inventory Import worksheet and the three mandatory columns. No inventory records were changed.</Text></View> : null}
    {m.stage === 'completed' && result ? <><View accessibilityRole="alert" style={[styles.notice, { borderColor: c.success, backgroundColor: c.successBg }]}><Ionicons name="checkmark-circle-outline" size={28} color={c.success} /><Text style={[styles.success, { color: c.success }]}>Inventory Import Completed Successfully.</Text></View><Text selectable style={[styles.body, { color: c.subtle }]}>{result.filename}</Text><Text style={[styles.body, { color: c.subtle }]}>Imported {formatDate(result.at)} · New equipment is IN and available for withdrawal.</Text></> : null}
    {m.stage === 'preview' ? <><View style={styles.heading}><Ionicons name="document-text-outline" size={24} color={c.primary} /><Text selectable style={[styles.item, { color: c.text }]}>{m.preview?.filename}</Text></View><Text style={[styles.body, { color: c.subtle }]}>Review all rows before confirming. Only green records will be added; existing equipment is never overwritten.</Text></> : null}
    {m.stage === 'preview' || m.stage === 'completed' ? <View style={styles.metrics}>{metrics.map(metric => <ImportMetric key={metric.label} {...metric} colors={c} wide={wide} />)}</View> : null}
    {m.stage === 'preview' ? <><View style={[styles.notice, { borderColor: c.borderBright, backgroundColor: c.blueBg }]}><Ionicons name="shield-checkmark-outline" size={20} color={c.primary} /><Text style={[styles.body, { color: c.subtle, flex: 1 }]}>Serial IDs are checked against all inventory, including archived equipment, and checked again when saving. Data stays in the existing device-local workspace.</Text></View>{!m.counts.valid ? <Text style={[styles.reason, { color: c.danger }]}>No valid records to import. Correct the rejected rows and select the file again.</Text> : null}{m.counts.duplicate + m.counts.invalid > 0 ? <Button title="Download validation error report" secondary icon="download-outline" onPress={() => void m.downloadPreviewErrors()} loading={m.exporting === 'errors'} disabled={m.isWorking} /> : null}</> : null}
    {m.stage === 'completed' && result ? <><Text selectable style={[styles.reason, { color: c.subtle }]}>BATCH {result.batchId}</Text>{result.duplicatesSkipped + result.invalidRows > 0 ? <><Button title="Download Excel error report" secondary icon="download-outline" onPress={() => void m.downloadErrors()} loading={m.exporting === 'errors'} disabled={m.isWorking} /><Text style={[styles.item, { color: c.text }]}>REJECTED ROWS</Text></> : <Text style={[styles.body, { color: c.success }]}>All processed rows were imported. No rejected records.</Text>}</> : null}
    <ErrorText message={m.error} />{tableHeader}
  </View>;
  return <FormModal visible={m.visible} title={m.stage === 'completed' ? 'INVENTORY IMPORT RESULTS' : 'IMPORT EXCEL INVENTORY'} subtitle={m.stage === 'preview' ? 'VALIDATE · REVIEW · CONFIRM' : '.XLSX · INVENTORY IMPORT'} onClose={m.close} busyOverride={m.isWorking} scrollBody={false}>
    <FlatList style={styles.list} data={rows} keyExtractor={row => String(row.rowNumber)} renderItem={renderRow} ListHeaderComponent={header} showsVerticalScrollIndicator={false} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent} />
    {!working ? <View style={[styles.footer, { borderColor: c.border }]}>{m.stage === 'preview' ? <><View style={styles.footerButton}><Button title="Cancel import" secondary onPress={m.close} disabled={m.isWorking || m.trackerBusy} /></View><View style={styles.footerButton}><Button title={`Import ${m.counts.valid} valid records`} icon="checkmark-circle-outline" onPress={() => void m.confirm()} disabled={!m.canImport || !m.counts.valid} /></View></> : m.stage === 'completed' ? <View style={styles.fullFooterButton}><Button title="Done · View inventory" onPress={m.close} disabled={m.isWorking || m.trackerBusy} /></View> : <><View style={styles.footerButton}><Button title="Cancel" secondary onPress={m.close} disabled={m.isWorking} /></View><View style={styles.footerButton}><Button title="Select another file" icon="folder-open-outline" onPress={() => void m.start()} disabled={!m.canImport} /></View></>}</View> : null}
  </FormModal>;
}
const styles = StyleSheet.create({
  list: { flex: 1, minHeight: 1 }, listContent: { paddingBottom: density.sectionGap }, headerContent: { gap: density.cardGap, paddingBottom: density.cardGap },
  heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, body: { fontSize: type.small, lineHeight: leading.small, flexShrink: 1, includeFontPadding: false }, item: { fontSize: type.small, lineHeight: leading.small, fontWeight: '700', flexShrink: 1, includeFontPadding: false },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: density.iconGap, borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding }, success: { flex: 1, fontSize: type.label, lineHeight: leading.label, fontWeight: '700', includeFontPadding: false },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap }, metric: { flexBasis: '48%', flexGrow: 1, minWidth: 1, borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.valueGap }, metricWide: { flexBasis: '23%' }, metricValue: { fontSize: type.section, lineHeight: type.section + density.headerGap, fontWeight: '700', includeFontPadding: false }, metricLabel: { fontSize: type.caption, lineHeight: leading.caption, includeFontPadding: false },
  tableHeader: { flexDirection: 'row', gap: density.iconGap, padding: density.cardPadding, borderRadius: radius.sm, borderWidth: 1 }, tableLabel: { fontSize: type.micro, lineHeight: leading.caption, fontWeight: '700', includeFontPadding: false },
  row: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.headerGap, marginBottom: density.cardGap }, tableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: density.iconGap }, cell: { minWidth: 1, gap: density.valueGap }, itemColumn: { flex: 1.05, minWidth: 1 }, serialColumn: { flex: 1, minWidth: 1 }, notesColumn: { flex: 1.1, minWidth: 1 }, resultColumn: { flex: 1.2, minWidth: 1 }, cellLabel: { fontSize: type.micro, lineHeight: leading.caption, fontWeight: '600', includeFontPadding: false }, validation: { fontSize: type.micro, lineHeight: leading.caption, fontWeight: '700', flexShrink: 1, includeFontPadding: false }, reason: { fontSize: type.caption, lineHeight: leading.caption, includeFontPadding: false },
  progressBlock: { gap: density.sectionGap, paddingVertical: density.cardPadding }, progressTrack: { height: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: radius.pill },
  footer: { borderTopWidth: 1, paddingTop: density.sectionGap, gap: density.cardGap, flexDirection: 'row', flexWrap: 'wrap' }, footerButton: { flex: 1, minWidth: 1 }, fullFooterButton: { width: '100%' },
});

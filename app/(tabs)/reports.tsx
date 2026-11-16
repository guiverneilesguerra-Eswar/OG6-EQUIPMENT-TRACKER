import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import { Badge, Button, Card, Chips, Empty, ErrorText, Field } from '@/components/ui/Controls';
import { DateField } from '@/components/ui/DateField';
import { useReports } from '@/hooks/useReports';
import { AnalyticsDashboard } from '@/components/feature/AnalyticsDashboard';
import { formatDate } from '@/services/tracker';
import { spacing, radius, type, leading, density } from '@/constants/theme';
export default function ReportsPage() {
  const m = useReports(); const c = m.colors;
  return <Screen title="EQUIPMENT REPORTS" icon="stats-chart-outline">
    <AnalyticsDashboard />
    <Card>
      <View style={styles.header}><View style={styles.heading}><View style={styles.titleRow}><Ionicons name="stats-chart-outline" size={24} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>EQUIPMENT STATUS REPORT</Text></View><Text style={[styles.subtitle, { color: c.subtle }]}>Current inventory snapshot · Philippine time</Text></View><Button title="Refresh" secondary compact icon="refresh-outline" onPress={m.refresh} /></View>
      <Field label="Search equipment" value={m.query} onChangeText={m.setQuery} placeholder="Equipment name" />
      <Chips options={['ALL', 'IN', 'OUT', 'OVERDUE']} selected={m.statusFilter} onSelect={m.setStatusFilter} />
      <View style={[styles.tableHeader, { backgroundColor: c.blueBg, borderColor: c.border }]}><Text style={[styles.column, { color: c.subtle }]}>ITEM NAME</Text><Text style={[styles.statusColumn, { color: c.subtle }]}>STATUS</Text></View>
      <FlatList scrollEnabled={false} data={m.rows} keyExtractor={asset => asset.id} ListEmptyComponent={<Empty icon="stats-chart-outline" title="No equipment to report" message="" />} renderItem={({ item }) => <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.item, { color: c.text }]}>{item.name}</Text><View style={styles.badgeBox}><Badge status={m.status(item.id)} /></View></View>} />
      <Text style={[styles.updated, { color: c.subtle }]}>{m.rows.length} assets · Refreshed {formatDate(m.refreshed)}</Text>
    </Card>
    <Card style={styles.exportCard}>
      <View style={styles.exportHeader}><View style={[styles.exportIcon, { backgroundColor: c.successBg, borderColor: c.success }]}><Ionicons name="document-text-outline" size={28} color={c.success} /></View><View style={styles.heading}><Text style={[styles.title, { color: c.text }]}>EXCEL ACCOUNTABILITY WORKBOOK</Text><Text style={[styles.subtitle, { color: c.subtle }]}>.XLSX · 4 WORKSHEETS</Text></View></View>
      {m.canOperate ? <>
        <Text style={[styles.subtitle, { color: c.subtle }]}>Date range filters withdrawal history only. Inventory status is a current snapshot.</Text>
        <View style={styles.range}><View style={styles.date}><DateField label="History start date" dateOnly value={m.from} onChange={m.setFrom} /></View><View style={styles.date}><DateField label="History end date" dateOnly value={m.to} onChange={m.setTo} /></View></View>
        {m.from || m.to ? <Button title="Clear date range" secondary compact onPress={() => { m.setFrom(''); m.setTo(''); }} /> : null}
        <ErrorText message={m.error} />{m.downloaded ? <Text accessibilityRole="alert" style={[styles.success, { color: c.success }]}>Report ready: {m.downloaded}</Text> : null}
        <View style={styles.download}><Button title="Download Excel report" icon="download-outline" loading={m.generating} onPress={() => void m.download()} /></View>
      </> : <Text style={[styles.subtitle, { color: c.subtle }]}>The workbook contains personnel records. Export is available in the local operator workspace only.</Text>}
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: density.iconGap, marginBottom: density.headerGap }, heading: { flex: 1, minWidth: 1 }, titleRow: { flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, title: { flexShrink: 1, fontSize: type.label, lineHeight: leading.label, fontWeight: '700', includeFontPadding: false }, subtitle: { fontSize: type.caption, lineHeight: leading.caption, marginTop: density.valueGap }, tableHeader: { flexDirection: 'row', padding: density.cardPadding, borderWidth: 1, borderRadius: radius.sm, marginTop: density.headerGap, gap: density.iconGap }, column: { flex: 1, fontSize: type.micro, letterSpacing: 1, fontWeight: '700' }, statusColumn: { width: 112, fontSize: type.micro, letterSpacing: 1, fontWeight: '700' }, row: { flexDirection: 'row', minHeight: 48, paddingVertical: density.headerGap, paddingHorizontal: density.cardPadding, borderBottomWidth: 1, alignItems: 'center', gap: density.iconGap }, item: { flex: 1, fontSize: type.small, fontWeight: '600', lineHeight: leading.small, textTransform: 'uppercase' }, badgeBox: { width: 112, alignItems: 'flex-start' }, updated: { fontSize: type.micro, lineHeight: leading.caption, marginTop: spacing.sm }, exportCard: { marginTop: density.cardGap }, exportHeader: { flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, exportIcon: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, range: { flexDirection: 'row', flexWrap: 'wrap', gap: density.sectionGap, marginTop: density.sectionGap }, date: { flexBasis: 210, flexGrow: 1, flexShrink: 1, minWidth: 1 }, download: { marginTop: density.sectionGap }, success: { fontSize: type.small, lineHeight: leading.small, marginTop: spacing.sm } });

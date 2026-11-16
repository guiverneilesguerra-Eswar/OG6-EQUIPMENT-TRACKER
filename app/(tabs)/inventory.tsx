import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Chips, Empty, ErrorText, Field } from '@/components/ui/Controls';
import { FormModal } from '@/components/ui/FormModal';
import { AssetRow } from '@/components/feature/EquipmentRows';
import { ProtectedDeletion } from '@/components/feature/ProtectedDeletion';
import { RecordDetails } from '@/components/feature/RecordDetails';
import { useInventory } from '@/hooks/useInventory';
import { useInventoryImport } from '@/hooks/useInventoryImport';
import { InventoryImportDialog } from '@/components/feature/InventoryImportDialog';
import { InventoryScanner } from '@/components/feature/InventoryScanner';
import { useInventoryScanner } from '@/hooks/useInventoryScanner';
import { formatDate } from '@/services/tracker';
import { spacing, type, leading, radius, density } from '@/constants/theme';
export default function InventoryPage() {
  const m = useInventory(); const excel = useInventoryImport(); const c = m.colors;
  const scanner = useInventoryScanner(m.applyScannedSerial);
  const lastImport = m.data.inventoryImports?.[0];
  return <>
    <Screen title="EQUIPMENT INVENTORY" icon="cube-outline" action={m.canOperate ? <View style={styles.toolbar}><View style={styles.toolbarButton}><Button title="Add equipment" icon="add-outline" onPress={() => m.begin()} disabled={m.busy || excel.isWorking || !m.loaded} /></View><View style={styles.toolbarButton}><Button title="Import Excel" secondary icon="cloud-upload-outline" onPress={() => void excel.start()} disabled={!excel.canImport} /></View><View style={styles.toolbarButton}><Button title="Download template" secondary icon="download-outline" onPress={() => void excel.downloadTemplate()} loading={excel.exporting === 'template'} disabled={excel.isWorking} /></View></View> : undefined}>
      <Card>
        <ErrorText message={excel.toolbarError} />
        {excel.feedback ? <Text accessibilityRole="alert" style={[styles.importFeedback, { color: c.success }]}>{excel.feedback}</Text> : null}
        {lastImport ? <View style={[styles.importBanner, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}><Ionicons name="documents-outline" size={20} color={c.primary} /><Text style={[styles.importFeedback, { color: c.subtle, flex: 1 }]}>LAST EXCEL IMPORT · {lastImport.importedAssetIds.length} assets · {formatDate(lastImport.at)}</Text></View> : null}
        <View style={styles.header}><View style={styles.heading}><Ionicons name="radio-outline" size={24} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>ASSET REGISTRY</Text></View><View style={[styles.availability, { backgroundColor: c.successBg, borderColor: c.success }]}><Text style={[styles.availableText, { color: c.success }]}>{m.stats.in} AVAILABLE / {m.assets.length} TOTAL</Text></View></View>
        <View style={styles.searchControls}>
          <View style={styles.searchField}><Field label="Search inventory" value={m.query} onChangeText={m.setQuery} placeholder="Item, serial number, or notes" /></View>
          <View style={styles.scanButton}><Button title="Scan barcode / QR" secondary icon="scan-outline" onPress={scanner.start} disabled={!m.loaded || Boolean(m.error) || scanner.visible} /></View>
        </View>
        {m.scannedSerial !== null ? <View accessibilityRole="alert" style={[styles.scanFeedback, { backgroundColor: m.rows.length ? c.successBg : c.warningBg, borderColor: m.rows.length ? c.success : c.warning }]}>
          <View style={styles.scanResult}><Ionicons name={m.rows.length ? 'checkmark-circle-outline' : 'search-outline'} size={24} color={m.rows.length ? c.success : c.warning} /><View style={styles.scanCopy}>
            <Text selectable numberOfLines={2} style={[styles.scanSerial, { color: c.text }]}>SCANNED SERIAL · {m.scannedSerial}</Text>
            <Text style={[styles.scanDescription, { color: c.subtle }]}>{m.rows.length ? `${m.rows.length} matching equipment record${m.rows.length === 1 ? '' : 's'} · Exact Serial/Product ID lookup.` : 'No active equipment matches this serial. No equipment was registered.'}</Text>
          </View></View>
          <Button title="Clear scan" secondary compact icon="close-outline" onPress={() => m.setQuery('')} />
        </View> : null}
        <Chips options={['ALL', 'IN', 'OUT', 'OVERDUE', 'UNSERVICEABLE', 'DAMAGE']} selected={m.statusFilter} onSelect={m.setStatusFilter} />
        <View style={styles.sortRow}><Text style={[styles.sortLabel, { color: c.subtle }]}>SORT BY</Text><Chips options={['NAME', 'NEWEST', 'STATUS']} selected={m.sort} onSelect={m.setSort} /></View>
        <FlatList scrollEnabled={false} data={m.rows} keyExtractor={asset => asset.id} ListEmptyComponent={<Empty title={m.scannedSerial !== null ? 'No equipment matches this scanned serial' : m.query ? 'No matching equipment' : 'No registered equipment yet'} message="" />} renderItem={({ item }) => <AssetRow asset={item} onView={() => m.setDetail(item)} onEdit={() => m.begin(item)} onDelete={() => m.setDeleting(item)} />} />
      </Card>
    </Screen>
    <FormModal visible={m.formOpen} onClose={() => m.setFormOpen(false)} title={m.editingId ? 'EDIT EQUIPMENT' : 'ADD NEW EQUIPMENT'}>
      <Field label="Item / equipment name *" value={m.name} onChangeText={m.setName} editable={!m.busy && !m.submitting} placeholder="e.g. Harris Handheld Radio" />
      <Field label="Serial / Product ID *" value={m.serial} onChangeText={m.setSerial} editable={!m.busy && !m.submitting} placeholder="Unique serial or product identification" />
      <Field label="Notes *" value={m.notes} onChangeText={m.setNotes} editable={!m.busy && !m.submitting} multiline placeholder="Equipment details, condition, or location" />
      {m.editingId ? <View style={[styles.authorization, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}>
        <View style={styles.heading}><Ionicons name="lock-closed-outline" size={20} color={c.primary} /><Text style={[styles.authorizationTitle, { color: c.text }]}>EDIT AUTHORIZATION REQUIRED</Text></View>
        <Text style={[styles.authorizationText, { color: c.subtle }]}>Enter the edit password to save changes. Verification requires an internet connection; the password is not stored on this device.</Text>
        <Field label="Edit password *" secure value={m.editPassword} onChangeText={m.setEditPassword} editable={!m.busy && !m.submitting} placeholder="Enter edit password" />
      </View> : null}
      <ErrorText message={m.error} /><Button title={m.editingId ? 'Authorize & save changes' : 'Add equipment'} icon={m.editingId ? 'lock-closed-outline' : 'add-outline'} onPress={() => void m.submit()} loading={m.busy || m.submitting} disabled={Boolean(m.editingId) && !m.editPassword} />
    </FormModal>
    <InventoryImportDialog model={excel} />
    {scanner.visible ? <InventoryScanner model={scanner} /> : null}
    <RecordDetails asset={m.detail ? m.data.assets.find(asset => asset.id === m.detail?.id) : null} onClose={() => m.setDetail(null)} />
    <ProtectedDeletion visible={Boolean(m.deleting)} kind="asset" recordId={m.deleting?.id || ''} name={m.deleting?.name || ''} active={m.deleting ? m.active.some(w => w.assetId === m.deleting?.id) : false} onClose={() => m.setDeleting(null)} />
  </>;
}
const styles = StyleSheet.create({ searchControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: density.cardGap }, searchField: { flexGrow: 1, flexBasis: 220, minWidth: 1 }, scanButton: { flexGrow: 1, flexBasis: 160, minWidth: 1, marginBottom: density.sectionGap }, scanFeedback: { padding: density.cardPadding, borderRadius: radius.md, borderWidth: 1, gap: density.cardGap, marginBottom: density.sectionGap }, scanResult: { flexDirection: 'row', alignItems: 'flex-start', gap: density.iconGap }, scanCopy: { flex: 1, minWidth: 1 }, scanSerial: { fontSize: type.meta, lineHeight: leading.small, fontWeight: '700', includeFontPadding: false }, scanDescription: { fontSize: type.body, lineHeight: leading.body, includeFontPadding: false }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap, maxWidth: '100%' }, toolbarButton: { flexGrow: 1, flexBasis: 140, minWidth: 1 }, importFeedback: { fontSize: type.caption, lineHeight: leading.caption }, importBanner: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, padding: density.cardPadding, borderWidth: 1, borderRadius: radius.sm, marginBottom: density.headerGap }, authorization: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, marginBottom: density.sectionGap, gap: density.iconGap }, authorizationTitle: { fontSize: type.meta, fontWeight: '700', flexShrink: 1 }, authorizationText: { fontSize: type.small, lineHeight: leading.small }, header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: density.iconGap, marginBottom: density.headerGap }, heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, flexShrink: 1 }, title: { fontSize: type.label, lineHeight: leading.label, fontWeight: '700', flexShrink: 1, includeFontPadding: false }, availability: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: density.cardPadding, paddingVertical: spacing.xs }, availableText: { fontSize: type.micro, lineHeight: leading.caption, fontWeight: '700', includeFontPadding: false }, sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: density.iconGap, marginBottom: density.headerGap }, sortLabel: { fontSize: type.micro, letterSpacing: 1, fontWeight: '700' } });

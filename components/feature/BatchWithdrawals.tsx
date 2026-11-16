import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBatchWithdrawals } from '@/hooks/useBatchWithdrawals';
import { Card, Button, Field, ErrorText, Empty, Badge } from '@/components/ui/Controls';
import { NameField } from '@/components/ui/NameField';
import { DateField } from '@/components/ui/DateField';
import { FormModal } from '@/components/ui/FormModal';
import { SignaturePad } from './SignaturePad';
import { formatDate } from '@/services/tracker';
import { density, leading, radius, type } from '@/constants/theme';
interface Props {}
export function BatchWithdrawals(_props: Props) {
  const m = useBatchWithdrawals(); const c = m.colors; const busy = m.busy || m.working;
  const title = m.mode === 'return' || m.mode === 'return-review' ? 'BATCH RETURN' : m.mode === 'receipt' ? 'BATCH TRANSACTION & RECEIPTS' : m.mode === 'review' ? 'CONFIRM BATCH WITHDRAWAL' : 'NEW BATCH WITHDRAWAL';
  return <>
    <Card style={styles.section}><View style={styles.heading}><Ionicons name="layers-outline" size={26} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>BATCH TRANSACTIONS</Text></View>
      <Text style={[styles.copy, { color: c.subtle }]}>One reference, individual equipment histories. Partial returns retain the remaining balance OUT. Serialized equipment has quantity 1.</Text>
      <Button title="New batch withdrawal" icon="layers-outline" onPress={m.begin} disabled={busy || !m.loaded} />
      <FlatList data={m.batches} scrollEnabled={false} keyExtractor={b => b.id} ListEmptyComponent={<Empty title="No batch transactions yet" message="" />} renderItem={({ item: b }) => {
        const records = m.data.withdrawals.filter(w => b.withdrawalIds.includes(w.id)); const outstanding = records.reduce((sum, w) => sum + m.remainingQuantity(w), 0);
        return <View style={[styles.row, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}><Text selectable style={[styles.item, { color: c.text }]}>{b.reference}</Text><Text style={[styles.copy, { color: c.subtle }]}>{b.withdrawalIds.length} equipment · {outstanding} units outstanding · {formatDate(b.createdAt)}</Text><View style={styles.actions}><Button title="View / PDF receipt" secondary compact icon="document-text-outline" onPress={() => m.viewBatch(b.id)} disabled={busy} />{outstanding ? <Button title="Batch / partial return" secondary compact icon="return-down-back-outline" onPress={() => m.beginReturn(b.id)} disabled={busy} /> : <Badge status="RETURNED" />}</View></View>;
      }} />
    </Card>
    <FormModal visible={m.mode !== 'closed'} title={title} onClose={m.close} busyOverride={m.working}>
      <ErrorText message={m.error} />{m.statusMessage ? <Text accessibilityRole="alert" style={[styles.copy, { color: c.success }]}>{m.statusMessage}</Text> : null}
      {m.mode === 'create' ? <>
        <Text selectable style={[styles.item, { color: c.primary }]}>REFERENCE · {m.requestId}</Text>
        <Field label="Search inventory" value={m.query} onChangeText={m.setQuery} placeholder="Name, serial or description" />
        <View style={[styles.inventory, { borderColor: c.border }]}><FlatList nestedScrollEnabled keyboardShouldPersistTaps="handled" data={m.available} keyExtractor={a => a.id} style={styles.list} ListEmptyComponent={<Empty title="No matching inventory" message="" />} renderItem={({ item: a }) => {
          const selected = m.items.some(i => i.assetId === a.id); const unavailable = m.status(a.id) !== 'IN';
          return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: unavailable }} accessibilityLabel={`Select ${a.name}, ${a.serial}`} disabled={unavailable || busy} onPress={() => m.toggle(a.id)} style={({ pressed }) => [styles.selection, { borderColor: c.border, backgroundColor: selected ? c.blueBg : c.surfaceAlt, opacity: unavailable ? 0.5 : pressed ? 0.65 : 1 }]}><Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={24} color={c.primary} /><View style={styles.flex}><Text style={[styles.item, { color: c.text }]}>{a.name}</Text><Text style={[styles.copy, { color: c.subtle }]}>{a.serial} · {m.assetCapacity(a)} unit(s)</Text></View><Badge status={m.status(a.id)} /></Pressable>;
        }} /></View>
        <Text style={[styles.title, { color: c.text }]}>MANUAL EQUIPMENT</Text><Text style={[styles.copy, { color: c.subtle }]}>A new manual item is registered only after final confirmation. A quantity greater than 1 represents a single inventory lot.</Text>
        <Field label="Equipment name" value={m.manualName} onChangeText={m.setManualName} />
        <Field label="Serial / Product ID" value={m.manualSerial} onChangeText={m.setManualSerial} />
        <Field label="Description / notes" value={m.manualDescription} onChangeText={m.setManualDescription} multiline />
        <Field label="Manual quantity" value={m.manualQuantity} onChangeText={m.setManualQuantity} keyboardType="numeric" />
        <Button title="Add manual item to batch" secondary icon="add-outline" onPress={m.addManual} disabled={busy} />
        <Text style={[styles.title, { color: c.text }]}>SELECTED EQUIPMENT · {m.items.length}</Text>
        <FlatList data={m.items} scrollEnabled={false} keyExtractor={i => i.assetId} renderItem={({ item: i }) => { const a = m.data.assets.find(a => a.id === i.assetId); return <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.item, { color: c.text }]}>{i.name || a?.name}</Text><Text selectable style={[styles.copy, { color: c.subtle }]}>{i.serial || a?.serial} · {i.manual ? 'Manual item' : `Asset ${i.assetId}`}</Text><Text style={[styles.copy, { color: c.subtle }]}>{i.description || a?.notes}</Text><Field label="Quantity to withdraw" keyboardType="numeric" value={Number.isFinite(i.quantity) ? String(i.quantity) : ''} onChangeText={q => m.changeQuantity(i.assetId, q)} /><Button title="Remove item" secondary compact onPress={() => m.toggle(i.assetId)} disabled={busy} /></View>; }} />
        <NameField label="Releaser *" role="releasers" value={m.releaser} onChangeText={m.setReleaser} />
        <NameField label="Receiver *" role="receivers" value={m.receiver} onChangeText={m.setReceiver} />
        <SignaturePad receiver={m.receiver} value={m.signature} onChange={m.setSignature} saved={m.saved} onSave={() => m.setSaved(true)} />
        <DateField label="Withdrawal date & time *" value={m.withdrawalAt} onChange={m.setWithdrawalAt} /><DateField label="Expected return date *" value={m.dueAt} onChange={m.setDueAt} />
        <Field label="Batch remarks" value={m.remarks} onChangeText={m.setRemarks} multiline />
        <Button title="Review batch withdrawal" icon="checkmark-circle-outline" onPress={m.review} disabled={busy} />
      </> : m.mode === 'review' ? <>
        <Text selectable style={[styles.item, { color: c.primary }]}>{m.requestId}</Text><Text style={[styles.copy, { color: c.text }]}>Releaser: {m.releaser}{'\n'}Receiver: {m.receiver}{'\n'}Withdrawn: {formatDate(m.withdrawalAt)}{'\n'}Expected return: {formatDate(m.dueAt)}{'\n'}Remarks: {m.remarks || '—'}</Text>
        <FlatList data={m.items} scrollEnabled={false} keyExtractor={i => i.assetId} renderItem={({ item: i }) => { const a = m.data.assets.find(a => a.id === i.assetId); return <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.item, { color: c.text }]}>{i.name || a?.name} · QTY {i.quantity}</Text><Text selectable style={[styles.copy, { color: c.subtle }]}>{i.serial || a?.serial} · {i.manual ? 'New/manual equipment' : i.assetId}</Text><Text style={[styles.copy, { color: c.subtle }]}>{i.description || a?.notes}</Text></View>; }} />
        <Text style={[styles.copy, { color: c.warning }]}>Confirming records all items together and marks them OUT. Availability is rechecked before saving.</Text><Button title="Confirm & save batch" icon="save-outline" onPress={() => void m.submit()} loading={busy} /><Button title="Back to edit" secondary onPress={() => m.setMode('create')} disabled={busy} />
      </> : m.mode === 'return' || m.mode === 'return-review' ? <>
        <Text selectable style={[styles.item, { color: c.primary }]}>{m.batch?.reference}{'\n'}RETURN · {m.requestId}</Text>
        {m.mode === 'return' ? <Button title="Return all outstanding quantities" secondary onPress={m.selectAllReturns} disabled={busy} /> : null}
        <FlatList data={m.batchItems.filter(w => m.remainingQuantity(w) > 0)} scrollEnabled={false} keyExtractor={w => w.id} renderItem={({ item: w }) => <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.item, { color: c.text }]}>{w.equipmentSnapshot?.name || m.data.assets.find(a => a.id === w.assetId)?.name}</Text><Text selectable style={[styles.copy, { color: c.subtle }]}>{w.id} · {m.remainingQuantity(w)} outstanding</Text>{m.mode === 'return' ? <Field label="Quantity to return (0 = skip)" value={m.returnQuantities[w.id] || ''} onChangeText={q => m.changeReturn(w.id, q)} keyboardType="numeric" /> : <Text style={[styles.copy, { color: c.text }]}>Return now: {m.returnQuantities[w.id] || '0'}</Text>}</View>} />
        {m.mode === 'return' ? <><NameField label="Returning personnel *" role="releasers" value={m.returning} onChangeText={m.setReturning} /><NameField label="Receiving personnel *" role="receivers" value={m.receiving} onChangeText={m.setReceiving} /><Field label="Equipment condition *" value={m.condition} onChangeText={m.setCondition} /><Field label="Return remarks" value={m.returnRemarks} onChangeText={m.setReturnRemarks} multiline /><Button title="Review return" onPress={m.reviewReturn} disabled={busy} /></> : <><Text style={[styles.copy, { color: c.text }]}>Returning: {m.returning}{'\n'}Receiving: {m.receiving}{'\n'}Condition: {m.condition}{'\n'}Remarks: {m.returnRemarks || '—'}</Text><Button title="Confirm batch / partial return" icon="return-down-back-outline" onPress={() => void m.confirmReturn()} loading={busy} /><Button title="Back to edit" secondary onPress={() => m.setMode('return')} disabled={busy} /></>}
      </> : m.mode === 'receipt' ? <>
        <Text selectable style={[styles.item, { color: c.primary }]}>{m.batch?.reference}</Text><Text style={[styles.copy, { color: c.subtle }]}>Each equipment line retains its own transaction ID and history. Export the PDF and print it from your PDF viewer.</Text>
        <FlatList data={m.batchItems} scrollEnabled={false} keyExtractor={w => w.id} renderItem={({ item: w }) => <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.item, { color: c.text }]}>{w.equipmentSnapshot?.name || m.data.assets.find(a => a.id === w.assetId)?.name}</Text><Text selectable style={[styles.copy, { color: c.subtle }]}>{w.id} · {w.quantity ?? 1} withdrawn · {m.remainingQuantity(w)} outstanding</Text><Badge status={w.deletedAt ? 'ARCHIVED' : w.returnedAt ? 'RETURNED' : m.status(w.assetId)} /></View>} />
        <FlatList data={Array.from(new Set((m.data.returnRecords || []).filter(r => m.batch?.withdrawalIds.includes(r.withdrawalId)).map(r => r.reference)))} scrollEnabled={false} keyExtractor={r => r} renderItem={({ item: ref }) => <Button title={`Return receipt ${ref}`} secondary compact onPress={() => m.setReturnReference(ref)} disabled={busy} />} />
        {m.returnReference ? <><Text selectable style={[styles.copy, { color: c.text }]}>Selected return: {m.returnReference}</Text><Button title="Use withdrawal receipt" secondary onPress={() => m.setReturnReference('')} disabled={busy} /></> : null}
        <Button title={m.returnReference ? 'Export return PDF receipt' : 'Export batch PDF receipt'} icon="download-outline" onPress={() => void m.exportReceipt()} loading={busy} />
        {m.batchItems.some(w => m.remainingQuantity(w) > 0) ? <Button title="Record batch / partial return" secondary onPress={() => m.beginReturn(m.batchId)} disabled={busy} /> : null}
      </> : null}
    </FormModal>
  </>;
}
const styles = StyleSheet.create({ section: { marginTop: density.cardGap, gap: density.cardGap }, heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, title: { flex: 1, fontSize: type.label, lineHeight: leading.label, fontWeight: '700', marginTop: density.headerGap }, copy: { fontSize: type.body, lineHeight: leading.small, marginBottom: density.headerGap }, item: { fontSize: type.body, fontWeight: '700', lineHeight: leading.small }, row: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.headerGap, marginTop: density.cardGap }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.iconGap }, inventory: { height: 240, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: density.sectionGap }, list: { flex: 1 }, selection: { minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: density.cardPadding, borderBottomWidth: 1, gap: density.iconGap }, flex: { flex: 1, minWidth: 1 } });

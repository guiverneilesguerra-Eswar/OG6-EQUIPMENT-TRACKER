import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWithdrawals } from '@/hooks/useWithdrawals';
import { FormModal } from '@/components/ui/FormModal';
import { Badge, Button, Chips, Empty, ErrorText, Field } from '@/components/ui/Controls';
import { DateField } from '@/components/ui/DateField';
import { SignaturePad } from './SignaturePad';
import { ReceiptActions } from './ReceiptActions';
import { formatDate } from '@/services/tracker';
import { spacing, radius, type, leading, density } from '@/constants/theme';
interface Props { model: ReturnType<typeof useWithdrawals> }
export function WithdrawalForms({ model: m }: Props) {
  const c = m.colors; const w = m.returningWithdrawal; const receipt = m.receiptWithdrawal;
  const receiptAsset = receipt ? m.asset(receipt.assetId) : undefined;
  const title = receipt ? m.receiptKind === 'return' ? 'Return recorded · PDF receipt' : 'Withdrawal recorded · PDF receipt' : w ? 'Return equipment' : 'New equipment withdrawal';
  // One native modal switches from the confirmed form to its receipt, avoiding
  // overlapping native modal presentations when an operation completes.
  return <FormModal visible={m.open || Boolean(w) || Boolean(receipt)} onClose={m.closeDialog} title={title}>
    {receipt ? <>
      {receipt.returnedAt ? <Chips options={['WITHDRAWAL RECEIPT', 'RETURN RECEIPT']} selected={m.receiptKind === 'return' ? 'RETURN RECEIPT' : 'WITHDRAWAL RECEIPT'} onSelect={value => m.setReceiptKind(value === 'RETURN RECEIPT' ? 'return' : 'withdrawal')} /> : null}
      {receiptAsset ? <ReceiptActions key={`${receipt.id}-${m.receiptKind}`} asset={receiptAsset} withdrawal={receipt} kind={m.receiptKind} /> : <ErrorText message="The equipment record for this receipt could not be found." />}
    </> : w ? <>
      <View style={[styles.returnSummary, { borderColor: c.border }]}>
        <Text style={[styles.item, { color: c.text }]}>{m.asset(w.assetId)?.name}</Text>
        <Text style={[styles.helper, { color: c.subtle }]}>{m.asset(w.assetId)?.serial}</Text>
        <Text style={[styles.helper, { color: c.subtle }]}>Original receiver: {w.receiver}</Text>
        <Text style={[styles.helper, { color: c.subtle }]}>Withdrawn: {formatDate(w.withdrawalAt)}</Text>
        <Text style={[styles.helper, { color: c.subtle }]}>Due: {formatDate(w.dueAt)}</Text>
        <Badge status={m.status(w.assetId)} />
      </View>
      <Field label="Returning personnel *" value={m.returning} onChangeText={m.setReturning} placeholder="Full name" />
      <Field label="Receiving personnel *" value={m.receiving} onChangeText={m.setReceiving} placeholder="Full name" />
      <SignaturePad label="Receiving personnel signature on return *" receiver={m.receiving} value={m.receivingSignature} onChange={m.setReceivingSignature} saved={m.returnSignatureSaved} onSave={() => m.setReturnSignatureSaved(true)} readOnly={m.busy} />
      <Field label="Equipment condition *" value={m.condition} onChangeText={m.setCondition} placeholder="e.g. Good, complete, operational" />
      <Field label="Remarks" value={m.remarks} onChangeText={m.setRemarks} multiline placeholder="Additional observations" />
      <ErrorText message={m.returnError} />
      <Button title="Confirm return" icon="return-down-back-outline" loading={m.busy} onPress={() => void m.confirmReturn()} />
    </> : <>
      <Text style={[styles.label, { color: c.text }]}>Equipment source</Text>
      <Chips options={['INVENTORY', 'MANUAL ENTRY']} selected={m.source} onSelect={m.setSource} />
      {m.source === 'INVENTORY' ? <>
        <Field label="Search equipment" value={m.assetQuery} onChangeText={m.setAssetQuery} placeholder="Equipment name or serial number" />
        <View style={[styles.equipmentList, { borderColor: c.border }]}><FlatList style={styles.list} nestedScrollEnabled data={m.available} keyExtractor={a => a.id} ListEmptyComponent={<Empty title="No equipment found" message="Register equipment in Inventory, or choose Manual Entry." />} renderItem={({ item: a }) => <Pressable accessibilityLabel={`Select ${a.name}, ${a.serial}`} disabled={m.status(a.id) !== 'IN'} onPress={() => m.setAssetId(a.id)} style={({ pressed }) => [styles.equipment, { borderBottomColor: c.border, backgroundColor: m.assetId === a.id ? c.blueBg : c.surface, opacity: m.status(a.id) !== 'IN' ? 0.5 : pressed ? 0.7 : 1 }]}><Ionicons name={m.assetId === a.id ? 'radio-button-on-outline' : 'radio-button-off-outline'} size={20} color={c.primary} /><View style={styles.equipmentName}><Text style={[styles.item, { color: c.text }]}>{a.name}</Text><Text style={[styles.serial, { color: c.subtle }]}>{a.serial}</Text></View><Badge status={m.status(a.id)} /></Pressable>} /></View>
        {m.assetId ? <Text style={[styles.selected, { color: c.primary }]}>Selected: {m.asset(m.assetId)?.name} · {m.asset(m.assetId)?.serial}</Text> : null}
      </> : <>
        <Field label="Equipment name *" value={m.name} onChangeText={m.setName} placeholder="e.g. Harris Handheld Radio" />
        <Field label="Serial / Product ID *" value={m.serial} onChangeText={m.setSerial} placeholder="Unique serialized asset ID" />
        <Field label="Equipment notes / purpose *" value={m.manualNotes} onChangeText={m.setManualNotes} multiline placeholder="Condition, location, or purpose" />
      </>}
      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <Field label="Releaser *" value={m.releaser} onChangeText={m.setReleaser} placeholder="Full name of releasing personnel" />
      <Field label="Receiver *" value={m.receiver} onChangeText={m.setReceiver} placeholder="Full name of responsible receiver" />
      <SignaturePad receiver={m.receiver} value={m.signature} onChange={m.setSignature} saved={m.saved} onSave={() => m.setSaved(true)} />
      <DateField label="Date of withdrawal *" value={m.withdrawalAt} onChange={m.setWithdrawalAt} />
      <DateField label="Due date for return *" value={m.dueAt} onChange={m.setDueAt} />
      <Field label="Additional notes" value={m.notes} onChangeText={m.setNotes} multiline placeholder="Condition, intended location, or special instructions" />
      <ErrorText message={m.error} />
      <Button title="Confirm withdrawal" icon="swap-horizontal-outline" loading={m.busy} onPress={() => void m.submit()} />
    </>}
  </FormModal>;
}
const styles = StyleSheet.create({ label: { fontSize: type.meta, fontWeight: '700', textTransform: 'uppercase' }, helper: { fontSize: type.caption, lineHeight: leading.caption }, equipmentList: { height: 240, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: density.sectionGap }, list: { flex: 1 }, equipment: { flexDirection: 'row', padding: density.cardPadding, borderBottomWidth: 1, alignItems: 'center', gap: density.iconGap }, equipmentName: { flex: 1, minWidth: 1 }, item: { fontSize: type.small, fontWeight: '700', textTransform: 'uppercase' }, serial: { fontSize: type.caption, lineHeight: leading.caption }, selected: { fontSize: type.caption, lineHeight: leading.caption, marginBottom: density.headerGap }, divider: { height: 1, marginVertical: density.sectionGap }, returnSummary: { paddingBottom: density.sectionGap, borderBottomWidth: 1, marginBottom: density.sectionGap, gap: density.valueGap } });

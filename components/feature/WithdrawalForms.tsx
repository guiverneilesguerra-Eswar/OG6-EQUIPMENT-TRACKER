import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWithdrawals } from '@/hooks/useWithdrawals';
import { FormModal } from '@/components/ui/FormModal';
import { Badge, Button, Chips, Empty, ErrorText, Field } from '@/components/ui/Controls';
import { DateField } from '@/components/ui/DateField';
import { NameField } from '@/components/ui/NameField';
import { SignaturePad } from './SignaturePad';
import { ReceiptActions } from './ReceiptActions';
import { ReturnSignatureView } from './ReturnSignatureView';
import { ReturnEquipmentPicker } from './ReturnEquipmentPicker';
import { formatDate } from '@/services/tracker';
import { radius, type, leading, density } from '@/constants/theme';
interface Props { model: ReturnType<typeof useWithdrawals> }
export function WithdrawalForms({ model: m }: Props) {
  const c = m.colors; const w = m.returningWithdrawal; const receipt = m.receiptWithdrawal; const busy = m.busy || m.working;
  const receiptAsset = receipt ? m.asset(receipt.assetId) : undefined;
  const returningOpen = Boolean(w) || m.batchReturn;
  const title = receipt ? 'TRANSACTION & RECEIPTS' : returningOpen ? m.returnReviewing ? 'CONFIRM EQUIPMENT RETURN' : m.batchReturn ? 'BATCH RETURN' : 'RETURN EQUIPMENT' : m.reviewing ? 'CONFIRM WITHDRAWAL' : 'NEW EQUIPMENT WITHDRAWAL';
  return <FormModal visible={m.open || returningOpen || Boolean(receipt)} onClose={m.closeDialog} title={title} busyOverride={m.working} interactionLocked={m.signatureInteraction}>
    <ErrorText message={m.draftPersistenceError} />
    {receipt ? <>
      <Text selectable style={[styles.label, { color: c.primary }]}>{m.receiptIsBatchReturn ? 'BATCH RETURN' : 'REFERENCE'} · {m.receiptIsBatchReturn ? m.receiptReturnReference : receipt.reference || receipt.id}</Text>
      {m.receiptIsBatchReturn ? <Text style={[styles.helper, { color: c.subtle }]}>Returned items from multiple withdrawal transactions. Original personnel and dates are shown with each item.</Text> : <Text style={[styles.helper, { color: c.text }]}>Releaser: {receipt.releaser}{'\n'}Receiver: {receipt.receiver}{'\n'}Withdrawn: {formatDate(receipt.withdrawalAt)}{'\n'}Expected return: {receipt.dueAt ? formatDate(receipt.dueAt) : 'No due date'}{'\n'}Remarks: {receipt.notes || '—'}</Text>}
      {receipt.originalDetails ? <Text style={[styles.helper, { color: c.subtle }]}>Authorized correction recorded. Original receiver: {receipt.originalDetails.receiver} · Original due date: {receipt.originalDetails.dueAt ? formatDate(receipt.originalDetails.dueAt) : 'No due date'}. Original signatures and detailed edit history remain in View details and the receipt.</Text> : null}
      <Text style={[styles.section, { color: c.text }]}>{m.receiptItems.length} EQUIPMENT · {m.receiptItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0)} UNITS WITHDRAWN</Text>
      <FlatList scrollEnabled={false} data={m.receiptItems} keyExtractor={item => item.id} renderItem={({ item }) => <View style={[styles.row, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
        <Text style={[styles.item, { color: c.text }]}>{item.equipmentSnapshot?.name || m.asset(item.assetId)?.name}</Text>
        <Text selectable style={[styles.helper, { color: c.subtle }]}>Asset ID: {item.assetId}{'\n'}{item.equipmentSnapshot?.serial || m.asset(item.assetId)?.serial}{'\n'}Individual record: {item.id}</Text>
        {m.receiptIsBatchReturn ? <Text style={[styles.helper, { color: c.text }]}>Source: {item.reference || item.id}{'\n'}Releaser: {item.releaser} · Receiver: {item.receiver}{'\n'}Withdrawn: {formatDate(item.withdrawalAt)} · Due: {item.dueAt ? formatDate(item.dueAt) : 'No due date'}</Text> : null}
        <Text style={[styles.helper, { color: c.text }]}>{item.quantity ?? 1} withdrawn · {m.remainingQuantity(item)} outstanding</Text>
        <Badge status={item.deletedAt ? 'ARCHIVED' : item.returnedAt ? 'RETURNED' : m.getEquipmentStatus(item.assetId)} />
        {m.receiptKind === 'return' ? <FlatList scrollEnabled={false} data={m.receiptReturns.filter(r => r.withdrawalId === item.id && r.reference === m.receiptReturnReference)} keyExtractor={r => r.id} renderItem={({ item: r }) => <Text style={[styles.helper, { color: c.success }]}>{r.quantity} returned · {formatDate(r.at)}{'\n'}Returning: {r.returning} · Receiving: {r.receiving}{'\n'}{r.condition} · {r.remarks || 'No remarks'}</Text>} /> : null}
        {m.canOperate && m.remainingQuantity(item) > 0 ? <Button title="Return this equipment" secondary compact onPress={() => m.beginReturn(item)} disabled={busy} /> : null}
      </View>} />
      {receipt.returnedAt || m.receiptReturnOptions.length ? <Chips options={['WITHDRAWAL RECEIPT', 'RETURN RECEIPT']} selected={m.receiptKind === 'return' ? 'RETURN RECEIPT' : 'WITHDRAWAL RECEIPT'} onSelect={value => { m.setReceiptKind(value === 'RETURN RECEIPT' ? 'return' : 'withdrawal'); if (value === 'RETURN RECEIPT' && !m.receiptReturnReference) m.setReceiptReturnReference(m.receiptReturnOptions[0]?.reference || ''); }} /> : null}
      {m.receiptKind === 'return' && m.receiptReturnOptions.length ? <>
        <Text style={[styles.section, { color: c.text }]}>SELECT RETURN EVENT</Text>
        <FlatList scrollEnabled={false} data={m.receiptReturnOptions} keyExtractor={r => r.reference} renderItem={({ item: r }) => <Button title={`${m.receiptReturnReference === r.reference ? 'Selected · ' : ''}${r.reference} · ${formatDate(r.at)}`} secondary compact onPress={() => m.setReceiptReturnReference(r.reference)} disabled={busy} />} />
      </> : null}
      {m.receiptKind === 'return' ? <FlatList scrollEnabled={false} data={m.receiptReturnSigners} keyExtractor={event => event.id} renderItem={({ item: event }) => <View>
        <Text style={[styles.helper, { color: c.text }]}>Returning: {event.returning} · Receiving: {event.receiving}{'\n'}{formatDate(event.at)}</Text><ReturnSignatureView record={event} />
      </View>} /> : null}
      {receiptAsset ? <ReceiptActions key={`${receipt.id}-${m.receiptKind}-${m.receiptReturnReference}`} asset={receiptAsset} withdrawal={receipt} kind={m.receiptKind} returnReference={m.receiptReturnReference || undefined} /> : <ErrorText message="The equipment record for this receipt could not be found." />}
      <Text style={[styles.helper, { color: c.subtle }]}>The complete receipt includes every item under this reference. Each return event records only its returned quantities; other items remain unchanged.</Text>
    </> : returningOpen ? <>
      <Text selectable style={[styles.label, { color: c.primary }]}>{m.batchReturn ? 'ALL OUTSTANDING WITHDRAWALS' : w?.reference || w?.id}{'\n'}RETURN · {m.returnRequestId}</Text>
      <Text style={[styles.helper, { color: c.subtle }]}>{m.batchReturn ? 'Select withdrawn equipment just like the withdrawal picker. Includes every outstanding transaction, overdue item and partial return.' : `Receiver: ${w?.receiver || ''} · Due: ${w?.dueAt ? formatDate(w.dueAt) : 'No due date'}. `} Adjust quantities in the selected list below.</Text>
      <ReturnEquipmentPicker model={m} />
      {m.returnReviewing ? <>
        <Text style={[styles.helper, { color: c.text }]}>Returning: {m.returning}{'\n'}Receiving: {m.receiving}{'\n'}Condition: {m.condition}{'\n'}Remarks: {m.remarks || '—'}</Text>
        <SignaturePad receiver={m.receiving} label="Receiving personnel signature" nameLabel="receiving personnel" value={m.receivingSignature} onChange={() => {}} onSave={() => {}} saved readOnly />
        {m.releasingSignature.length ? <SignaturePad receiver={m.returning} label="Releaser signature at return" nameLabel="returning personnel" value={m.releasingSignature} onChange={() => {}} onSave={() => {}} saved readOnly /> : null}
        <Text style={[styles.helper, { color: c.subtle }]}>This signature will be saved with this return event and its selected quantities only.</Text>
        <ErrorText message={m.returnError} />
        <Button title="Confirm return" icon="return-down-back-outline" loading={busy} onPress={() => void m.confirmReturn()} />
        <Button title="Back to edit return" secondary disabled={busy} onPress={() => m.setReturnReviewing(false)} />
      </> : <>
        <NameField label="Returning personnel / releaser *" role="releasers" value={m.returning} onChangeText={m.setReturning} />
        <SignaturePad receiver={m.returning} label="Releaser signature at return (optional)" nameLabel="returning personnel" value={m.releasingSignature} onChange={m.setReleasingSignature} saved={m.releasingSignatureSaved} onSave={() => m.setReleasingSignatureSaved(true)} disabled={busy} expandable onInteractionChange={m.setSignatureInteractionLocked} />
        <NameField label="Receiving personnel *" role="receivers" value={m.receiving} onChangeText={m.setReceiving} />
        <SignaturePad receiver={m.receiving} label="Receiving personnel signature *" nameLabel="receiving personnel" value={m.receivingSignature} onChange={m.setReceivingSignature} saved={m.receivingSignatureSaved} onSave={() => m.setReceivingSignatureSaved(true)} disabled={busy} expandable onInteractionChange={m.setSignatureInteractionLocked} />
        <Text style={[styles.section, { color: c.text }]}>EQUIPMENT CONDITION *</Text>
        <View style={styles.returnActions}>{m.equipmentConditions.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityLabel={`Equipment condition: ${option}`} accessibilityState={{ selected: m.condition === option, disabled: busy }} disabled={busy} onPress={() => m.setCondition(option)} style={({ pressed }) => [styles.conditionChoice, { borderColor: m.condition === option ? c.borderBright : c.border, backgroundColor: m.condition === option ? c.action : c.surfaceAlt, opacity: busy ? 0.45 : pressed ? 0.65 : 1 }]}><Text style={[styles.helper, styles.conditionText, { color: m.condition === option ? c.onAction : c.text }]}>{option}</Text></Pressable>)}</View>
        <Text style={[styles.helper, { color: c.subtle }]}>Selected condition: {m.condition || 'Choose an option'}. Applies to all items in this return; record separate returns for different conditions.</Text>
        <Field label="Remarks" value={m.remarks} onChangeText={m.setRemarks} multiline placeholder="Additional observations" editable={!busy} />
        <ErrorText message={m.returnError} />
        <Button title="Review return" disabled={busy || !m.selectedReturnItems.length} onPress={m.reviewReturn} />
      </>}
    </> : m.reviewing ? <>
      <Text selectable style={[styles.label, { color: c.primary }]}>REFERENCE · {m.requestId}</Text>
      <Text style={[styles.helper, { color: c.text }]}>Releaser: {m.releaser}{'\n'}Receiver: {m.receiver}{'\n'}Withdrawn: {formatDate(m.withdrawalAt)}{'\n'}Expected return: {formatDate(m.dueAt)}{'\n'}Remarks: {m.notes || '—'}</Text>
      <Text style={[styles.section, { color: c.text }]}>SELECTED EQUIPMENT · {m.items.length} ITEMS · {m.totalUnits} UNITS</Text>
      <FlatList scrollEnabled={false} data={m.items} keyExtractor={item => item.assetId} renderItem={({ item }) => <View style={[styles.row, { borderColor: c.border }]}>
        <Text style={[styles.item, { color: c.text }]}>{item.name || m.asset(item.assetId)?.name} · QTY {item.quantity}</Text>
        <Text selectable style={[styles.helper, { color: c.subtle }]}>Asset ID: {item.manual ? 'Assigned on save (new manual equipment)' : item.assetId}{'\n'}{item.serial || m.asset(item.assetId)?.serial}{'\n'}{item.description || m.asset(item.assetId)?.notes}</Text>
      </View>} />
      <SignaturePad receiver={m.receiver} value={m.signature} onChange={() => {}} onSave={() => {}} saved readOnly />
      <Text style={[styles.helper, { color: c.warning }]}>Confirming saves all items under one reference and marks them OUT. Quantities and availability are checked again before saving.</Text>
      <ErrorText message={m.error} />
      <Button title="Confirm & save withdrawal" icon="save-outline" loading={busy} onPress={() => void m.submit()} />
      <Button title="Back to edit withdrawal" secondary disabled={busy} onPress={() => m.setReviewing(false)} />
    </> : <>
      <Text selectable style={[styles.label, { color: c.primary }]}>REFERENCE · {m.requestId}</Text>
      <Text style={[styles.helper, { color: c.subtle }]}>Select one or more inventory items. Each item keeps its own withdrawal and return history.</Text>
      <Text style={[styles.section, { color: c.text }]}>EQUIPMENT SOURCE</Text>
      <Chips options={['INVENTORY', 'MANUAL ENTRY']} selected={m.source} onSelect={m.setSource} />
      {m.source === 'INVENTORY' ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Open searchable equipment multi-select" accessibilityState={{ expanded: m.equipmentDropdownOpen, disabled: busy }} disabled={busy} onPress={() => m.setEquipmentDropdownOpen(!m.equipmentDropdownOpen)} style={({ pressed }) => [styles.dropdown, { backgroundColor: c.surfaceAlt, borderColor: c.borderBright, opacity: pressed ? 0.65 : 1 }]}>
          <Ionicons name="cube-outline" size={22} color={c.primary} /><Text style={[styles.dropdownText, { color: c.text }]}>{m.items.length} equipment selected · Add / remove equipment</Text><Ionicons name={m.equipmentDropdownOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={c.primary} />
        </Pressable>
        {m.equipmentDropdownOpen ? <>
          <Field label="Search equipment" value={m.assetQuery} onChangeText={m.setAssetQuery} placeholder="Asset ID, name, serial or description" editable={!busy} />
          <View style={[styles.equipmentList, { borderColor: c.border }]}><FlatList style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled" data={m.available} keyExtractor={a => a.id} extraData={m.items} ListEmptyComponent={<Empty title="No matching inventory" message="" />} renderItem={({ item: a }) => {
            const selected = m.items.some(item => item.assetId === a.id); const status = m.getEquipmentStatus(a.id); const unavailable = status !== 'IN' || m.assetCapacity(a) < 1;
            return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy || unavailable }} accessibilityLabel={`Select ${a.name}, ${a.serial}`} disabled={busy || unavailable} onPress={() => m.toggleEquipment(a.id)} style={({ pressed }) => [styles.equipment, { borderBottomColor: c.border, backgroundColor: selected ? c.blueBg : c.surfaceAlt, opacity: unavailable ? 0.5 : pressed ? 0.65 : 1 }]}>
              <Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={24} color={c.primary} /><View style={styles.equipmentName}><Text style={[styles.item, { color: c.text }]}>{a.name}</Text><Text selectable style={[styles.helper, { color: c.subtle }]}>{a.id}{'\n'}{a.serial} · {m.assetCapacity(a)} unit(s)</Text></View><Badge status={status} />
            </Pressable>;
          }} /></View>
        </> : null}
      </> : <>
        <Text style={[styles.helper, { color: c.subtle }]}>Manual equipment is registered only after final confirmation. Add it to the same selected list below.</Text>
        <Field label="Equipment name *" value={m.name} onChangeText={m.setName} placeholder="e.g. Harris Handheld Radio" editable={!busy} />
        <Field label="Serial / Product ID *" value={m.serial} onChangeText={m.setSerial} placeholder="Unique serialized asset ID" editable={!busy} />
        <Field label="Equipment notes / purpose *" value={m.manualNotes} onChangeText={m.setManualNotes} multiline placeholder="Condition, location, or purpose" editable={!busy} />
        <Field label="Manual equipment quantity *" value={m.manualQuantity} onChangeText={m.setManualQuantity} keyboardType="numeric" editable={!busy} />
        <Button title="Add manual equipment" secondary icon="add-outline" onPress={m.addManual} disabled={busy} />
      </>}
      <Text style={[styles.section, { color: c.text }]}>SELECTED EQUIPMENT · {m.items.length} ITEMS · {m.totalUnits} UNITS</Text>
      <FlatList scrollEnabled={false} data={m.items} keyExtractor={item => item.assetId} ListEmptyComponent={<Text style={[styles.helper, { color: c.subtle }]}>No equipment selected. Choose inventory items or add manual equipment.</Text>} renderItem={({ item }) => {
        const a = m.asset(item.assetId); const capacity = item.manual ? null : a ? m.assetCapacity(a) : 0;
        return <View style={[styles.row, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
          <Text style={[styles.item, { color: c.text }]}>{item.name || a?.name}</Text>
          <Text selectable style={[styles.helper, { color: c.subtle }]}>Asset ID: {item.manual ? 'Assigned on save' : item.assetId}{'\n'}{item.serial || a?.serial}{'\n'}{item.description || a?.notes}</Text>
          <Text style={[styles.helper, { color: c.primary }]}>{capacity === null ? 'New manual inventory lot' : `${capacity} unit(s) available; serialized equipment has quantity 1`}</Text>
          {!item.manual && m.getEquipmentStatus(item.assetId) !== 'IN' ? <ErrorText message="This item has become unavailable. Remove it before submitting." /> : null}
          <Field label="Quantity to withdraw *" keyboardType="numeric" value={m.quantityDrafts[item.assetId] ?? '1'} onChangeText={value => m.changeQuantity(item.assetId, value)} editable={!busy} />
          <Button title="Remove equipment" secondary compact icon="close-outline" onPress={() => m.removeItem(item.assetId)} disabled={busy} />
        </View>;
      }} />
      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <NameField label="Releaser *" role="releasers" value={m.releaser} onChangeText={m.setReleaser} />
      <NameField label="Receiver *" role="receivers" value={m.receiver} onChangeText={m.setReceiver} />
      <SignaturePad receiver={m.receiver} value={m.signature} onChange={m.setSignature} saved={m.saved} onSave={() => m.setSaved(true)} disabled={busy} expandable onInteractionChange={m.setSignatureInteractionLocked} />
      <DateField label="Withdrawal date & time *" value={m.withdrawalAt} onChange={m.setWithdrawalAt} />
      <DateField label="Expected return date *" value={m.dueAt} onChange={m.setDueAt} />
      <Field label="Remarks / additional notes" value={m.notes} onChangeText={m.setNotes} multiline placeholder="Condition, intended location, or special instructions" editable={!busy} />
      <ErrorText message={m.error} />
      <Button title="Review withdrawal" icon="checkmark-circle-outline" disabled={busy || !m.items.length || !m.loaded} onPress={m.reviewWithdrawal} />
    </>}
  </FormModal>;
}
const styles = StyleSheet.create({ returnActions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.iconGap, marginBottom: density.sectionGap }, conditionChoice: { minHeight: 48, borderWidth: 1, borderRadius: radius.sm + 4, paddingHorizontal: density.cardPadding, justifyContent: 'center' }, conditionText: { marginBottom: 0, fontWeight: '600' }, label: { fontSize: type.meta, fontWeight: '700', lineHeight: leading.small, includeFontPadding: false }, section: { fontSize: type.meta, fontWeight: '700', lineHeight: leading.small, marginTop: density.sectionGap, marginBottom: density.headerGap, includeFontPadding: false }, helper: { fontSize: type.caption, lineHeight: leading.body, marginBottom: density.headerGap, includeFontPadding: false }, equipmentList: { height: 240, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: density.sectionGap }, list: { flex: 1 }, equipment: { minHeight: 64, flexDirection: 'row', padding: density.cardPadding, borderBottomWidth: 1, alignItems: 'center', gap: density.iconGap }, equipmentName: { flex: 1, minWidth: 1 }, item: { fontSize: type.small, lineHeight: leading.small, includeFontPadding: false, fontWeight: '700', textTransform: 'uppercase' }, row: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.headerGap, marginBottom: density.cardGap }, divider: { height: 1, marginVertical: density.sectionGap }, dropdown: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, borderWidth: 1, borderRadius: radius.sm + 4, padding: density.cardPadding, marginBottom: density.sectionGap }, dropdownText: { flex: 1, minWidth: 1, fontSize: type.body, lineHeight: leading.body, includeFontPadding: false } });

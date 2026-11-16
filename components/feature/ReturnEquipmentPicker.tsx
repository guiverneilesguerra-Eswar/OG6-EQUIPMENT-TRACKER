import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useWithdrawals } from '@/hooks/useWithdrawals';
import { Button, Empty, Field } from '@/components/ui/Controls';
import { formatDate } from '@/services/tracker';
import { density, leading, radius, type } from '@/constants/theme';
interface Props { model: ReturnType<typeof useWithdrawals> }
export const ReturnEquipmentPicker = memo(function ReturnEquipmentPicker({ model: m }: Props) {
  const c = m.colors; const busy = m.busy || m.working;
  return <>
    {!m.returnReviewing ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Open searchable return equipment multi-select" accessibilityState={{ expanded: m.returnDropdownOpen, disabled: busy }} disabled={busy} onPress={() => m.setReturnDropdownOpen(!m.returnDropdownOpen)} style={({ pressed }) => [styles.dropdown, { backgroundColor: c.surfaceAlt, borderColor: c.borderBright, opacity: busy ? 0.45 : pressed ? 0.65 : 1 }]}>
        <Ionicons name="cube-outline" size={22} color={c.primary} /><Text style={[styles.dropdownText, { color: c.text }]}>{m.selectedReturnItems.length} equipment selected · Add / remove equipment</Text><Ionicons name={m.returnDropdownOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={c.primary} />
      </Pressable>
      {m.returnDropdownOpen ? <>
        <Field label="Search outstanding equipment" value={m.returnQuery} onChangeText={m.setReturnQuery} placeholder="Equipment, serial, reference, or original receiver" editable={!busy} />
        <View style={styles.actions}><Button title="Return all outstanding quantities" secondary onPress={m.selectAllReturns} disabled={busy || !m.returnItems.length} /><Button title="Clear selection" secondary onPress={m.clearReturnSelection} disabled={busy || !m.selectedReturnItems.length} /></View>
        <Text style={[styles.helper, { color: c.subtle }]}>Select all includes search-hidden items. Only selected equipment appears in the quantity list.</Text>
        <View style={[styles.pickerList, { borderColor: c.border }]}><FlatList style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled" data={m.visibleReturnItems} keyExtractor={item => item.id} extraData={m.returnQuantities} ListEmptyComponent={<Empty title={m.returnQuery ? 'No matching outstanding equipment' : 'No outstanding equipment'} message="" />} renderItem={({ item }) => {
          const selected = Object.prototype.hasOwnProperty.call(m.returnQuantities, item.id);
          return <Pressable accessibilityRole="checkbox" accessibilityLabel={`Return ${item.equipmentSnapshot?.name || m.asset(item.assetId)?.name || item.assetId}, withdrawal ${item.id}`} accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={() => m.toggleReturnItem(item.id)} style={({ pressed }) => [styles.equipment, { borderBottomColor: c.border, backgroundColor: selected ? c.blueBg : c.surfaceAlt, opacity: busy ? 0.45 : pressed ? 0.65 : 1 }]}>
            <Ionicons name={selected ? 'checkbox-outline' : 'square-outline'} size={24} color={c.primary} /><View style={styles.name}><Text style={[styles.item, { color: c.text }]}>{item.equipmentSnapshot?.name || m.asset(item.assetId)?.name}</Text><Text style={[styles.helper, { color: c.subtle }]}>{item.equipmentSnapshot?.serial || m.asset(item.assetId)?.serial} · {m.remainingQuantity(item)} outstanding{'\n'}{item.reference || item.id}{'\n'}Original receiver: {item.receiver}</Text></View>
          </Pressable>;
        }} /></View>
      </> : null}
    </> : null}
    <Text style={[styles.section, { color: c.primary }]}>{m.selectedReturnItems.length} ITEMS SELECTED · {m.returnUnits} UNITS TO RETURN</Text>
    <FlatList scrollEnabled={false} data={m.selectedReturnItems} keyExtractor={item => item.id} extraData={m.returnQuantities} ListEmptyComponent={<Text style={[styles.helper, { color: c.subtle }]}>No equipment selected. Open the picker to choose withdrawn items.</Text>} renderItem={({ item }) => <View style={[styles.row, { borderColor: c.borderBright, backgroundColor: c.surfaceAlt }]}>
      <Text style={[styles.item, { color: c.text }]}>{item.equipmentSnapshot?.name || m.asset(item.assetId)?.name}</Text>
      <Text selectable style={[styles.helper, { color: c.subtle }]}>{item.assetId} · {item.equipmentSnapshot?.serial || m.asset(item.assetId)?.serial}{'\n'}Source: {item.reference || item.id} · {item.id}{'\n'}Original receiver: {item.receiver} · Due: {formatDate(item.dueAt)}{'\n'}{m.remainingQuantity(item)} unit(s) outstanding</Text>
      {!m.returnReviewing ? <><Field label="Quantity to return *" value={m.returnQuantities[item.id] || ''} onChangeText={value => m.changeReturnQuantity(item.id, value)} keyboardType="numeric" editable={!busy} /><Button title="Remove equipment" secondary compact icon="close-outline" onPress={() => m.toggleReturnItem(item.id)} disabled={busy} /></> : <Text style={[styles.helper, { color: c.text }]}>Return now: {m.returnQuantities[item.id] || '0'}</Text>}
    </View>} />
  </>;
});
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.iconGap, marginBottom: density.sectionGap },
  dropdown: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, borderWidth: 1, borderRadius: radius.sm + 4, padding: density.cardPadding, marginBottom: density.sectionGap }, dropdownText: { flex: 1, minWidth: 1, fontSize: type.body, lineHeight: leading.body, includeFontPadding: false },
  pickerList: { height: 240, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: density.sectionGap }, list: { flex: 1 }, equipment: { minHeight: 64, flexDirection: 'row', padding: density.cardPadding, borderBottomWidth: 1, alignItems: 'center', gap: density.iconGap }, name: { flex: 1, minWidth: 1 },
  section: { fontSize: type.meta, fontWeight: '700', lineHeight: leading.small, marginTop: density.sectionGap, marginBottom: density.headerGap, includeFontPadding: false }, helper: { fontSize: type.caption, lineHeight: leading.body, marginBottom: density.headerGap, includeFontPadding: false }, item: { fontSize: type.small, lineHeight: leading.small, includeFontPadding: false, fontWeight: '700', textTransform: 'uppercase' }, row: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.headerGap, marginBottom: density.cardGap },
});

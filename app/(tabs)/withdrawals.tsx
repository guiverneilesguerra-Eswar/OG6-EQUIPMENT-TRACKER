import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Chips, Empty, Field } from '@/components/ui/Controls';
import { WithdrawalRow } from '@/components/feature/EquipmentRows';
import { WithdrawalForms } from '@/components/feature/WithdrawalForms';
import { ProtectedDeletion } from '@/components/feature/ProtectedDeletion';
import { RecordDetails } from '@/components/feature/RecordDetails';
import { useWithdrawals } from '@/hooks/useWithdrawals';
import { spacing, type, leading, radius, density } from '@/constants/theme';
export default function WithdrawalsPage() {
  const m = useWithdrawals(); const c = m.colors; const router = useRouter();
  return <>
    <Screen title="WITHDRAWALS & RETURNS" icon="swap-horizontal-outline" action={m.canOperate ? <Button title="New equipment withdrawal" icon="swap-horizontal-outline" onPress={m.beginWithdrawal} disabled={m.busy || !m.loaded || m.working} /> : undefined}>
      <Card>
        <View style={styles.titleRow}><Ionicons name="swap-horizontal-outline" size={24} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>{m.filter === 'RETURNED' ? 'RETURN HISTORY' : m.filter === 'ALL' ? 'ALL WITHDRAWALS' : m.filter === 'OVERDUE' ? 'OVERDUE EQUIPMENT' : m.filter === 'DUE SOON' ? 'DUE SOON' : 'ACTIVE WITHDRAWALS'}</Text><View style={[styles.countBox, { backgroundColor: c.blueBg, borderColor: c.borderBright }]}><Text style={[styles.count, { color: c.primary }]}>{m.rows.length}</Text></View></View>
        <Field label="Search withdrawals" value={m.query} onChangeText={m.setQuery} placeholder={m.canOperate ? 'Equipment, serial, receiver, or YYYY-MM-DD' : 'Equipment or serial number'} />
        <Chips options={['ACTIVE', 'OVERDUE', 'DUE SOON', 'RETURNED', 'ALL']} selected={m.filter} onSelect={value => { m.setFilter(value); router.setParams({ status: '' }); }} />
        <FlatList scrollEnabled={false} data={m.rows} keyExtractor={withdrawal => withdrawal.id} ListEmptyComponent={<Empty icon="swap-horizontal-outline" title={m.query ? 'No matching transactions' : m.filter === 'RETURNED' ? 'No returns recorded yet' : 'No transactions in this view'} message="" />} renderItem={({ item }) => <WithdrawalRow withdrawal={item} onView={() => m.setDetail(item)} onReturn={() => m.beginReturn(item)} onDelete={() => m.setDeleting(item)} onReceipt={() => m.showReceipt(item)} />} />
      </Card>
    </Screen>
    {m.canOperate ? <WithdrawalForms model={m} /> : null}
    <RecordDetails withdrawal={m.detail ? m.data.withdrawals.find(withdrawal => withdrawal.id === m.detail?.id) : null} onClose={() => m.setDetail(null)} />
    <ProtectedDeletion visible={Boolean(m.deleting)} kind="withdrawal" recordId={m.deleting?.id || ''} name={m.deleting ? `${m.asset(m.deleting.assetId)?.name} · ${m.deleting.id}` : ''} activeWithdrawal={Boolean(m.deleting && !m.deleting.returnedAt && !m.deleting.deletedAt)} onClose={() => m.setDeleting(null)} />
  </>;
}
const styles = StyleSheet.create({ titleRow: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.headerGap }, title: { fontSize: type.label, lineHeight: leading.label, fontWeight: '700', flex: 1, minWidth: 1, includeFontPadding: false }, countBox: { minWidth: 42, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, count: { fontSize: type.small, lineHeight: leading.small, fontWeight: '700', fontVariant: ['tabular-nums'], includeFontPadding: false } });

import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTracker } from '@/hooks/useTracker';
import { Asset, Withdrawal, formatDate } from '@/services/tracker';
import { FormModal } from '@/components/ui/FormModal';
import { Badge, Chips, Empty } from '@/components/ui/Controls';
import { ReceiptActions } from './ReceiptActions';
import { ReceiptKind } from '@/services/receipts';
import { SignaturePad } from './SignaturePad';
import { type, leading, density } from '@/constants/theme';

interface DetailProps { asset?: Asset | null; withdrawal?: Withdrawal | null; onClose: () => void }
export function RecordDetails({ asset, withdrawal: w, onClose }: DetailProps) {
  const [receiptKind, setReceiptKind] = useState<ReceiptKind>('withdrawal');
  const { data, status, colors: c, canOperate } = useTracker();
  const a = asset || data.assets.find(item => item.id === w?.assetId);
  const history = useMemo(() => asset ? data.withdrawals.filter(item => item.assetId === asset.id) : [], [asset, data.withdrawals]);
  const acknowledgements = useMemo(() => data.activities.filter(event => event.type === 'alarm-acknowledgement' && event.withdrawalIds?.some(id => w ? id === w.id : data.withdrawals.some(record => record.id === id && record.assetId === a?.id))), [data.activities, data.withdrawals, w?.id, a?.id]);
  const archiveEvent = data.activities.find(item => item.type === 'archive' && (w ? item.transactionId === w.id : item.assetId === a?.id && !item.transactionId));
  const line = (label: string, value?: string) => value ? <View style={[styles.line, { borderColor: c.border }]}><Text style={[styles.label, { color: c.subtle }]}>{label}</Text><Text selectable style={[styles.value, { color: c.text }]}>{value}</Text></View> : null;
  return <FormModal visible={Boolean(asset || w)} onClose={onClose} title={a?.name || 'Equipment details'} subtitle={a?.serial}>
    {a ? <>
      <Badge status={w?.deletedAt ? 'ARCHIVED' : w?.returnedAt ? 'RETURNED' : a.archivedAt ? 'ARCHIVED' : status(a.id)} />
      {line('Asset ID', a.id)}{line('Notes', a.notes)}{line('Date added', formatDate(a.createdAt))}
      {a.archivedAt ? line('Equipment archived', formatDate(a.archivedAt)) : null}
      {canOperate && (a.archivedAt || w?.deletedAt) ? line('Administrator authorization reference', archiveEvent?.authorizationId) : null}
      {w && canOperate ? <>
        {line('Transaction reference', w.id)}{line('Releaser', w.releaser)}{line('Receiver', w.receiver)}
        {line('Withdrawal date', formatDate(w.withdrawalAt))}{line('Due date', formatDate(w.dueAt))}
        {line('Recorded at', formatDate(w.createdAt))}{line('Purpose / notes', w.notes)}
        {w.deletedAt ? line('Withdrawal archived', formatDate(w.deletedAt)) : null}
        <SignaturePad receiver={w.receiver} value={w.signature} onChange={() => {}} onSave={() => {}} saved readOnly />
        <Text style={[styles.section, { color: c.text }]}>PDF RECEIPT</Text>
        {w.returnedAt ? <Chips options={['WITHDRAWAL RECEIPT', 'RETURN RECEIPT']} selected={receiptKind === 'return' ? 'RETURN RECEIPT' : 'WITHDRAWAL RECEIPT'} onSelect={value => setReceiptKind(value === 'RETURN RECEIPT' ? 'return' : 'withdrawal')} /> : null}
        <ReceiptActions key={`${w.id}-${w.returnedAt ? receiptKind : 'withdrawal'}`} asset={a} withdrawal={w} kind={w.returnedAt ? receiptKind : 'withdrawal'} />
        {w.returnedAt ? <>{line('Returned at', formatDate(w.returnedAt))}{line('Returning personnel', w.returning)}{line('Receiving personnel', w.receiving)}{line('Return condition', w.condition)}{line('Return remarks', w.remarks)}</> : null}
      </> : null}
      {acknowledgements.length ? <>
        <Text style={[styles.section, { color: c.text }]}>ALARM ACKNOWLEDGEMENT HISTORY</Text>
        <FlatList scrollEnabled={false} data={acknowledgements} keyExtractor={event => event.id} renderItem={({ item: event }) => <View style={[styles.history, { borderColor: c.border }]}>
          <Text selectable style={[styles.value, { color: c.text }]}>{formatDate(event.at)}</Text>
          <Text selectable style={[styles.label, { color: c.subtle }]}>ACTUAL TIMESTAMP: {event.at}</Text>
          <Text selectable style={[styles.value, { color: c.text }]}>Withdrawal IDs: {event.withdrawalIds?.join(', ')}</Text>
          <Text style={[styles.label, { color: c.subtle }]}>{event.acknowledgementSource} · {event.person}</Text>
        </View>} />
      </> : null}
      {asset && canOperate ? <>
        <Text style={[styles.section, { color: c.text }]}>TRANSACTION HISTORY</Text>
        <FlatList scrollEnabled={false} data={history} keyExtractor={item => item.id} ListEmptyComponent={<Empty title="No equipment movements" message="" />} renderItem={({ item }) => <View style={[styles.history, { borderColor: c.border }]}>
          <Text selectable style={[styles.value, { color: c.text }]}>{item.receiver}</Text>
          <Text selectable style={[styles.label, { color: c.subtle }]}>{item.id}</Text>
          <Text style={[styles.label, { color: c.subtle }]}>{formatDate(item.withdrawalAt)}</Text>
          <Badge status={item.deletedAt ? 'ARCHIVED' : item.returnedAt ? 'RETURNED' : status(item.assetId)} />
          {item.returnedAt ? <Text style={[styles.label, { color: c.subtle }]}>Returned {formatDate(item.returnedAt)}</Text> : null}
          {item.deletedAt ? <Text style={[styles.label, { color: c.subtle }]}>Archived {formatDate(item.deletedAt)} · Original withdrawal retained</Text> : null}
        </View>} />
      </> : null}
    </> : null}
  </FormModal>;
}
const styles = StyleSheet.create({ line: { paddingVertical: density.headerGap, borderBottomWidth: 1, gap: density.valueGap }, label: { fontSize: type.caption, lineHeight: leading.caption, textTransform: 'uppercase' }, value: { fontSize: type.small, fontWeight: '500', lineHeight: leading.small }, section: { fontSize: type.label, fontWeight: '600', textTransform: 'uppercase', marginTop: density.sectionGap, marginBottom: density.headerGap }, history: { paddingVertical: density.headerGap, borderBottomWidth: 1, gap: density.valueGap } });

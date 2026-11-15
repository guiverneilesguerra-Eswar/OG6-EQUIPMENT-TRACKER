import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNameDirectory } from '@/hooks/useNameDirectory';
import { Card, Chips, Button, Field, ErrorText, Empty } from '@/components/ui/Controls';
import { FormModal } from '@/components/ui/FormModal';
import { density, type, leading } from '@/constants/theme';
interface Props {}
export function NameDirectory(_props: Props) {
  const m = useNameDirectory(); const c = m.colors;
  return <><Card style={styles.card}><View style={styles.heading}><Ionicons name="people-outline" size={26} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>PERSONNEL NAME HISTORY</Text></View><Text style={[styles.copy, { color: c.subtle }]}>Names are saved only after successful movements. Case and extra spaces are ignored for duplicates. Editing or removing a suggestion never changes historical transaction names.</Text>
    <Chips options={['RELEASERS', 'RECEIVERS']} selected={m.role.toUpperCase()} onSelect={v => { m.setRole(v === 'RELEASERS' ? 'releasers' : 'receivers'); m.setQuery(''); }} />
    <Field label="Search saved names" value={m.query} onChangeText={m.setQuery} />
    {m.status ? <Text accessibilityRole="alert" style={[styles.copy, { color: c.success }]}>{m.status}</Text> : null}
    <View style={styles.directory}><FlatList data={m.entries} keyExtractor={n => n.id} style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled" ListEmptyComponent={<Empty title="No saved names in this view" message="" />} renderItem={({ item }) => <View style={[styles.row, { borderColor: c.border }]}><Text style={[styles.name, { color: c.text }]}>{item.name}</Text>{m.canOperate ? <Button title="Manage" secondary compact onPress={() => m.begin(item)} disabled={m.busy || m.working} /> : null}</View>} /></View>
    <Text style={[styles.copy, { color: c.subtle }]}>Management requires the server-verified administrator password. Returning personnel populate the releaser directory; receiving personnel populate the receiver directory.</Text>
  </Card><FormModal visible={Boolean(m.selected)} title="ADMINISTRATOR NAME MANAGEMENT" onClose={m.close} busyOverride={m.working}>
    <Text style={[styles.copy, { color: c.text }]}>Selected: {m.selected?.name}</Text><Chips options={['EDIT NAME', 'REMOVE SUGGESTION']} selected={m.remove ? 'REMOVE SUGGESTION' : 'EDIT NAME'} onSelect={v => m.setRemove(v === 'REMOVE SUGGESTION')} />
    {!m.remove ? <Field label="Saved name" value={m.draft} onChangeText={m.setDraft} editable={!m.working} /> : <Text style={[styles.copy, { color: c.warning }]}>Confirm removal from future suggestions only. All historical records are retained.</Text>}
    <Field label="Administrator password *" value={m.password} onChangeText={m.setPassword} secure editable={!m.working} /><ErrorText message={m.error} /><Button title={m.remove ? 'Authorize & remove suggestion' : 'Authorize & save name'} onPress={() => void m.save()} loading={m.working || m.busy} disabled={!m.password} icon="shield-checkmark-outline" />
  </FormModal></>;
}
const styles = StyleSheet.create({ card: { marginTop: density.cardGap, gap: density.cardGap }, heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, title: { flex: 1, minWidth: 1, fontSize: type.label, fontWeight: '700', lineHeight: leading.label }, copy: { fontSize: type.body, lineHeight: leading.body }, directory: { height: 240 }, list: { flex: 1 }, row: { borderBottomWidth: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, paddingVertical: density.headerGap }, name: { flex: 1, minWidth: 1, fontSize: type.body, lineHeight: leading.small } });

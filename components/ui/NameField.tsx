import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Field, Button } from './Controls';
import { useNameSuggestions } from '@/hooks/useNameSuggestions';
import { useTracker } from '@/hooks/useTracker';
import type { NameRole } from '@/services/movements';
import { density, radius, type, leading } from '@/constants/theme';
interface Props { label: string; role: NameRole; value: string; onChangeText: (value: string) => void }
export const NameField = memo(function NameField({ label, role, value, onChangeText }: Props) {
  const m = useNameSuggestions(role, value, onChangeText); const { colors: c } = useTracker();
  return <View style={styles.root}><Field label={label} value={value} onChangeText={m.change} placeholder="Choose a saved name or enter a new name" editable={!m.disabled} /><Button title={m.open ? 'Hide saved names' : 'Saved names'} secondary compact icon="people-outline" onPress={m.toggle} disabled={m.disabled} />
    {m.open ? <View style={[styles.directory, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}><FlatList data={m.entries} keyExtractor={n => n.id} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.list} ListEmptyComponent={<Text style={[styles.hint, { color: c.subtle }]}>No matching saved names. New names are saved after a successful transaction.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Use ${item.name}`} onPress={() => m.choose(item.name)} style={({ pressed }) => [styles.row, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}><Ionicons name="person-outline" size={20} color={c.primary} /><Text style={[styles.name, { color: c.text }]}>{item.name}</Text></Pressable>} /></View> : null}
  </View>;
});
const styles = StyleSheet.create({ root: { marginBottom: density.sectionGap }, directory: { marginTop: density.headerGap, borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' }, list: { maxHeight: 240, minHeight: 48 }, row: { minHeight: 48, padding: density.cardPadding, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, borderBottomWidth: 1 }, name: { flex: 1, fontSize: type.body, lineHeight: leading.small }, hint: { fontSize: type.body, lineHeight: leading.small, padding: density.cardPadding } });

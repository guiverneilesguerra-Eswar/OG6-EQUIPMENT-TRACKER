import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptTextDocument, ReceiptTextEntry } from '@/services/receiptText';
import { useReceiptTextView } from '@/hooks/useReceiptTextView';
import { useTracker } from '@/hooks/useTracker';
import { density, leading, radius, receiptTextLayout, spacing, type } from '@/constants/theme';
import { SignaturePad } from './SignaturePad';

interface ReceiptTextViewProps { document: ReceiptTextDocument; filename: string }
interface ReceiptTextEntryProps { entry: ReceiptTextEntry }
const readOnlyAction = () => {};
const entryKey = (entry: ReceiptTextEntry) => entry.id;

const ReceiptTextEntryCard = memo(function ReceiptTextEntryCard({ entry }: ReceiptTextEntryProps) {
  const { colors: c } = useTracker();
  if (entry.kind === 'text') return <Text selectable style={[entry.heading ? styles.heading : styles.body, { color: entry.heading ? c.primary : c.text }]}>{entry.text}</Text>;
  if (entry.kind === 'equipment') return <View style={[styles.entry, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text selectable style={[styles.heading, { color: c.primary }]}>{entry.title}</Text>
    {entry.fields.map((field, index) => <View key={`${entry.id}-field-${index}`} style={styles.field}>
      <Text selectable style={[styles.fieldLabel, { color: c.subtle }]}>{field.label}</Text>
      <Text selectable style={[styles.body, { color: c.text }]}>{field.value}</Text>
    </View>)}
  </View>;
  return <View style={[styles.entry, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text selectable style={[styles.heading, { color: c.primary }]}>{entry.label}</Text>
    <Text selectable style={[styles.body, { color: c.text }]}>{entry.person}</Text>
    {entry.note ? <Text selectable style={[styles.body, { color: c.text }]}>{entry.note}</Text> : null}
    <SignaturePad receiver={entry.person} value={entry.signature} onChange={readOnlyAction} onSave={readOnlyAction} saved readOnly label="Recorded signature" />
  </View>;
});

// Bounded, virtualized reading surface: no reduced PDF fonts, horizontal table or truncation.
export const ReceiptTextView = memo(function ReceiptTextView({ document, filename }: ReceiptTextViewProps) {
  const { colors: c } = useTracker(); const m = useReceiptTextView(document);
  const renderEntry = useCallback(({ item }: { item: ReceiptTextEntry }) => <ReceiptTextEntryCard entry={item} />, []);
  return <View style={[styles.card, { backgroundColor: c.surfaceAlt, borderColor: c.borderBright }]}>
    <View style={styles.header}><Ionicons name="reader-outline" size={20} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>LARGE-TEXT RECEIPT</Text></View>
    <Text style={[styles.help, { color: c.subtle }]}>Long-press text to select and copy. Scroll for equipment, personnel and recorded signatures. This view does not change the PDF.</Text>
    <FlatList data={m.entries} renderItem={renderEntry} keyExtractor={entryKey} style={{ height: m.viewportHeight }} contentContainerStyle={styles.content} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityLabel={`Readable receipt ${filename}`} ListHeaderComponent={<Text selectable style={[styles.heading, { color: c.primary }]}>{document.title}</Text>} />
  </View>;
});

const styles = StyleSheet.create({
  card: { padding: spacing.sm, gap: density.iconGap, borderWidth: 1, borderRadius: radius.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap },
  title: { flex: 1, fontSize: type.body, fontWeight: '700', includeFontPadding: false },
  help: { fontSize: type.body, lineHeight: leading.body, includeFontPadding: false },
  content: { paddingVertical: spacing.sm, gap: spacing.md },
  entry: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm },
  field: { gap: density.fieldGap },
  fieldLabel: { fontSize: receiptTextLayout.fontSize, lineHeight: receiptTextLayout.lineHeight, fontWeight: '600', includeFontPadding: false },
  body: { fontSize: receiptTextLayout.fontSize, lineHeight: receiptTextLayout.lineHeight, includeFontPadding: false },
  heading: { fontSize: receiptTextLayout.headingSize, lineHeight: receiptTextLayout.headingLineHeight, fontWeight: '700', includeFontPadding: false },
});

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptViewMode } from '@/services/receiptText';
import { useTracker } from '@/hooks/useTracker';
import { density, radius, receiptPreviewLayout, spacing, type } from '@/constants/theme';

interface ReceiptViewSelectorProps { mode: ReceiptViewMode; onChange: (mode: ReceiptViewMode) => void }
export const ReceiptViewSelector = memo(function ReceiptViewSelector({ mode, onChange }: ReceiptViewSelectorProps) {
  const { colors: c } = useTracker();
  const option = (value: ReceiptViewMode, label: string, icon: 'document-text-outline' | 'reader-outline') => {
    const selected = mode === value;
    return <Pressable accessibilityRole="button" accessibilityLabel={`Show receipt ${label.toLowerCase()}`} accessibilityState={{ selected }} onPress={() => onChange(value)} style={({ pressed }) => [styles.option, { backgroundColor: selected ? c.action : c.surfaceAlt, borderColor: selected ? c.action : c.borderBright, opacity: pressed ? 0.65 : 1 }]}>
      <Ionicons name={icon} color={selected ? c.onAction : c.primary} size={20} />
      <Text style={[styles.label, { color: selected ? c.onAction : c.text }]}>{label}</Text>
    </Pressable>;
  };
  return <View style={styles.bar} accessibilityLabel="Receipt viewing mode">{option('a4', 'A4 preview', 'document-text-outline')}{option('text', 'Large text', 'reader-outline')}</View>;
});

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: density.iconGap },
  option: { flex: 1, minWidth: 1, minHeight: receiptPreviewLayout.controlHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: density.fieldGap, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  label: { flexShrink: 1, fontSize: type.body, fontWeight: '600', includeFontPadding: false },
});

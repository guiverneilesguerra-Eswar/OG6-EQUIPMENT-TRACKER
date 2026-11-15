import { memo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/hooks/useTracker';
import type { CommandAlertButton, CommandAlertData } from '@/services/alerts';
import { useResponsive } from '@/hooks/useResponsive';
import { leading, radius, spacing, type, density } from '@/constants/theme';

interface Props { alert: CommandAlertData | null; onChoose: (button?: CommandAlertButton) => void }
export const CommandAlert = memo(function CommandAlert({ alert, onChoose }: Props) {
  const { colors: c } = useTracker();
  const { width, height } = useResponsive();
  const panelWidth = Math.max(1, Math.min(460, width - spacing.md * 2));
  const charactersPerLine = Math.max(20, Math.floor((panelWidth - spacing.xl) / (type.body * 0.55)));
  const contentLines = Math.ceil((alert?.message?.length || 0) / charactersPerLine);
  const panelHeight = Math.max(1, Math.min(height * 0.85, Math.max(220, contentLines * leading.body + 170)));
  return <Modal visible={Boolean(alert)} transparent animationType="fade" onRequestClose={() => onChoose(alert?.buttons.find(button => button.style === 'cancel'))}>
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.overlay, { backgroundColor: c.overlay }]}>
      <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: c.surface, borderColor: c.borderBright, shadowColor: c.shadow, height: panelHeight }]}>
        <View style={[styles.header, { borderColor: c.border }]}><Ionicons name="information-circle-outline" size={26} color={c.primary} /><Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{alert?.title}</Text></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>{alert?.message ? <Text style={[styles.message, { color: c.subtle }]}>{alert.message}</Text> : null}</ScrollView>
        <View style={[styles.actions, { borderColor: c.border }]}>{alert?.buttons.map((button, index) => <Pressable key={`${button.text}-${index}`} accessibilityRole="button" onPress={() => onChoose(button)} style={({ pressed }) => [styles.button, { backgroundColor: button.style === 'cancel' ? c.surfaceAlt : button.style === 'destructive' ? c.dangerBg : c.action, borderColor: button.style === 'destructive' ? c.danger : c.borderBright, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.buttonText, { color: button.style === 'destructive' ? c.danger : button.style === 'cancel' ? c.text : c.onAction }]}>{button.text}</Text></Pressable>)}</View>
      </View>
    </SafeAreaView>
  </Modal>;
});
const styles = StyleSheet.create({ overlay: { flex: 1, padding: spacing.md, alignItems: 'center', justifyContent: 'center' }, panel: { width: '100%', maxWidth: 460, borderRadius: radius.lg, borderWidth: 1.5, maxHeight: '85%', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 8 }, header: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, padding: density.cardPadding, borderBottomWidth: 1 }, title: { flex: 1, fontSize: type.label, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false }, scroll: { flex: 1 }, body: { padding: density.cardPadding }, message: { fontSize: type.body, lineHeight: leading.body }, actions: { borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', padding: density.cardPadding, gap: density.iconGap }, button: { flexGrow: 1, minHeight: 48, borderWidth: 1, borderRadius: radius.sm + 4, paddingHorizontal: density.cardPadding, justifyContent: 'center', alignItems: 'center' }, buttonText: { fontSize: type.small, fontWeight: '700', textTransform: 'uppercase' } });

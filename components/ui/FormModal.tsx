import { ReactNode } from 'react';
import { Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/hooks/useTracker';
import { radius, spacing, type, leading, density } from '@/constants/theme';
import { useCompactDialog } from '@/hooks/useCompactDialog';

interface Props { visible: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; busyOverride?: boolean; dialogHeight?: number; scrollBody?: boolean }
export function FormModal({ visible, title, subtitle, onClose, children, busyOverride = false, dialogHeight, scrollBody = true }: Props) {
  const { colors: c, busy: trackerBusy } = useTracker();
  const busy = trackerBusy || busyOverride;
  const dialog = useCompactDialog(visible, scrollBody, dialogHeight);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy ? onClose() : undefined}>
    <SafeAreaView style={[styles.overlay, { backgroundColor: c.overlay }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: c.surfaceGlass, borderColor: c.borderBright, shadowColor: c.shadow, height: dialog.panelHeight }]}>
          <View onLayout={dialog.measureHeader} style={[styles.header, { borderBottomColor: c.borderBright, backgroundColor: c.headerSurface }]}>
            <View style={styles.titleBox}><Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{title}</Text>{subtitle ? <Text style={[styles.subtitle, { color: c.subtle }]}>{subtitle}</Text> : null}</View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onClose} style={({ pressed }) => [styles.close, { backgroundColor: c.blueBg, borderColor: c.borderBright, opacity: pressed ? 0.6 : 1 }]}><Ionicons name="close-outline" size={24} color={c.headerText} /></Pressable>
          </View>
          {scrollBody ? <ScrollView style={styles.scroll} onContentSizeChange={dialog.measureContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>{children}</ScrollView> : <View style={[styles.body, styles.fixedBody]}>{children}</View>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, padding: spacing.md, justifyContent: 'center', alignItems: 'center' }, keyboard: { width: '100%', maxWidth: 650, flex: 1, justifyContent: 'center' },
  panel: { maxHeight: '95%', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'center', padding: density.cardPadding, gap: density.iconGap, borderBottomWidth: 1 }, titleBox: { flex: 1, minWidth: 1 }, title: { fontSize: type.label, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false }, subtitle: { fontSize: type.small, marginTop: density.valueGap, lineHeight: leading.small },
  close: { width: 48, height: 48, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, scroll: { flex: 1 }, body: { padding: density.cardPadding }, fixedBody: { flex: 1, minHeight: 1 },
});

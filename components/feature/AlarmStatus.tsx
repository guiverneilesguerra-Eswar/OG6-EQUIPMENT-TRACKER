import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '@/hooks/useAudio';
import { useTracker } from '@/hooks/useTracker';
import { Button, ErrorText } from '@/components/ui/Controls';
import { density, leading, radius, type } from '@/constants/theme';

interface AlarmStatusProps {}
export const AlarmStatus = memo(function AlarmStatus(_props: AlarmStatusProps) {
  const m = useAudio(); const { colors: c, loaded, busy } = useTracker();
  const overdue = m.pendingCount > 0; const relevant = m.audio.alarm;
  // Shared across tabs: operational overdue status only. Configuration, browser
  // activation, uploads, reference links, previews and tests stay in SETTINGS.
  if (!loaded || !overdue) return null;
  const title = `${m.pendingCount} OVERDUE · ACKNOWLEDGEMENT REQUIRED`;
  const description = 'The alarm sound repeats every 20 seconds until returned or acknowledged. Acknowledgement is saved in local activity history.';
  const statusColor = ['muted', 'disabled', 'browser-blocked', 'upload-required', 'halted', 'audio-error'].includes(m.countdown.mode) ? c.warning : c.primary;
  return <View style={[styles.root, { backgroundColor: overdue ? c.dangerBg : c.blueBg, borderColor: overdue ? c.danger : c.borderBright }]}>
    <View style={styles.copy}><Ionicons name={overdue ? 'alarm-outline' : 'volume-high-outline'} size={24} color={overdue ? c.danger : c.primary} /><View style={styles.textBox}><Text accessibilityRole="alert" style={[styles.title, { color: c.text }]}>{title}</Text><Text style={[styles.description, { color: c.subtle }]}>{description}</Text></View></View>
    {overdue ? <View style={[styles.countdown, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}><Ionicons name={m.countdown.mode === 'muted' ? 'volume-mute-outline' : m.countdown.mode === 'disabled' ? 'pause-circle-outline' : m.countdown.mode === 'browser-blocked' ? 'lock-closed-outline' : 'timer-outline'} size={18} color={statusColor} /><Text style={[styles.countdownText, { color: statusColor }]}>{m.countdown.label}</Text></View> : null}
    <ErrorText message={m.actionError || relevant.error} />
    <View style={styles.actions}>
      {overdue ? <Button title="Stop alarm / Acknowledge" danger icon="volume-mute-outline" onPress={() => void m.acknowledge()} loading={m.acknowledging} disabled={busy || m.testing} /> : null}
    </View>
  </View>;
});
const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: radius.md, padding: density.cardPadding, gap: density.iconGap, marginBottom: density.sectionGap },
  copy: { flexDirection: 'row', alignItems: 'flex-start', gap: density.iconGap }, textBox: { flex: 1, minWidth: 1 },
  title: { fontSize: type.meta, lineHeight: leading.small, fontWeight: '700', includeFontPadding: false }, description: { fontSize: type.body, lineHeight: leading.body, includeFontPadding: false },
  countdown: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: density.iconGap, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: density.cardPadding, paddingVertical: density.valueGap },
  countdownText: { flexShrink: 1, fontSize: type.micro, lineHeight: leading.caption, fontWeight: '700', fontVariant: ['tabular-nums'], includeFontPadding: false },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap },
});

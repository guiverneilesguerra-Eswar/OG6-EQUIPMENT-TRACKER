import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTracker } from '@/hooks/useTracker';
import { useAlertSoundUpload } from '@/hooks/useAlertSoundUpload';
import type { AudioChannel } from '@/services/soundClips';
import { Button, ErrorText } from '@/components/ui/Controls';
import { FormModal } from '@/components/ui/FormModal';
import { VolumeControl } from './VolumeControl';
import { density, leading, radius, type } from '@/constants/theme';

interface AlertSoundSettingsProps { channel: AudioChannel }
// Mounted exclusively by the SETTINGS route. Each instance owns only its channel actions.
export const AlertSoundSettings = memo(function AlertSoundSettings({ channel }: AlertSoundSettingsProps) {
  const { colors: c } = useTracker(); const m = useAlertSoundUpload(channel); const alarm = channel === 'alarm';
  return <>
    <View style={[styles.panel, { backgroundColor: c.surfaceAlt, borderColor: alarm ? c.warning : c.borderBright }]}>
      <View style={styles.heading}><Ionicons name={alarm ? 'alarm-outline' : 'notifications-outline'} size={24} color={alarm ? c.warning : c.primary} /><Text style={[styles.label, { color: c.text }]}>{alarm ? 'B. ALARM SOUND' : 'A. NOTIFICATION SOUND'}</Text></View>
      <Text style={[styles.helper, { color: c.subtle }]}>{alarm ? 'Overdue equipment, repeated overdue reminders, critical alerts and high-priority due-soon reminders.' : 'Equipment withdrawals, returns and general system notifications.'}</Text>
      <Text selectable style={[styles.filename, { color: m.selected ? c.text : c.warning }]}>{m.selected ? `${m.selected.filename} · ${(m.selected.durationMillis / 1000).toFixed(2)}s` : `NO ${m.label.toUpperCase()} SOUND SELECTED`}</Text>
      <Button title={`Upload ${m.label} sound`} icon="cloud-upload-outline" secondary onPress={m.open} disabled={m.disabled} />
      <View style={styles.actions}>
        <Button title={`Preview ${m.label}`} secondary icon="play-circle-outline" onPress={m.preview} disabled={m.testDisabled} />
        <Button title={`Test ${m.label}`} secondary icon={alarm ? 'alarm-outline' : 'volume-medium-outline'} onPress={m.test} disabled={m.testDisabled} />
      </View>
      {m.selected ? <View style={styles.actions}><Button title={`Replace ${m.label} sound`} secondary icon="swap-horizontal-outline" onPress={m.open} disabled={m.disabled} /><Button title={`Remove ${m.label} sound`} danger icon="trash-outline" onPress={m.requestRemove} disabled={m.disabled} loading={m.removing} /></View> : null}
      {m.previewPlaying ? <Button title={`Stop ${m.label} preview`} secondary icon="stop-circle-outline" onPress={() => void m.stop()} disabled={m.removing} /> : null}
      <VolumeControl label={`${m.label} volume`} value={m.volume} onChange={m.changeVolume} onSave={value => void m.saveVolume(value)} disabled={m.disabled} />
      {m.playback.ready && m.playback.backend === 'MediaPlayer' ? <Text selectable style={[styles.helper, { color: c.primary }]}>VERIFIED ANDROID ENGINE · MediaPlayer</Text> : null}
      {m.selected && m.playback.configuring ? <Text style={[styles.helper, { color: c.primary }]}>Loading {channel} sound…</Text> : null}
      {m.selected && m.browser ? <Text style={[styles.helper, { color: m.playback.unlocked ? c.primary : c.warning }]}>{m.playback.unlocked ? `${m.label.toUpperCase()} BROWSER AUDIO ENABLED` : `${m.label.toUpperCase()} BROWSER AUDIO BLOCKED · USE PREVIEW OR TEST`}</Text> : null}
      {!m.visible ? <ErrorText message={m.error || m.playback.error} /> : null}
      {m.status ? <Text accessibilityRole="alert" style={[styles.helper, { color: c.primary }]}>{m.status}</Text> : null}
    </View>
    {m.visible ? <FormModal visible onClose={m.close} busyOverride={m.uploading} title={`Upload ${m.label} sound`} subtitle={`Saved independently on this device/browser. The other sound stays unchanged.`}>
      <Text style={[styles.helper, { color: c.subtle }]}>Select an MP3 or PCM WAV you own or have permission to use. Maximum 10 MB and 19 seconds. Files are validated and decoded without playback before saving; no trimming or substitute sound is used.</Text>
      <Text style={[styles.helper, { color: c.subtle }]}>This changes only your {channel} sound. A failed or cancelled upload leaves both saved sounds and all equipment records intact. The 20-second overdue alarm interval is unchanged.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`I have permission to use this ${channel} sound`} accessibilityState={{ checked: m.authorized, disabled: m.uploading }} disabled={m.uploading} onPress={() => m.setAuthorized(!m.authorized)} style={({ pressed }) => [styles.consent, { borderColor: m.authorized ? c.primary : c.border, backgroundColor: c.surfaceAlt, opacity: pressed ? 0.65 : 1 }]}><Ionicons name={m.authorized ? 'checkbox-outline' : 'square-outline'} size={24} color={c.primary} /><Text style={[styles.consentText, { color: c.text }]}>I own this audio file or have permission to use it.</Text></Pressable>
      <ErrorText message={m.error} />
      <Button title={`Select ${m.label} MP3/WAV`} icon="document-attach-outline" onPress={() => void m.upload()} loading={m.uploading} disabled={!m.authorized || m.disabled} />
      {m.uploading ? <Text style={[styles.helper, { color: c.primary }]}>Reading, validating and saving {channel} audio…</Text> : null}
    </FormModal> : null}
  </>;
});
const styles = StyleSheet.create({
  panel: { padding: density.cardPadding, borderWidth: 1, borderRadius: radius.md, gap: density.headerGap, marginTop: density.cardGap },
  heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, label: { flex: 1, fontSize: type.label, lineHeight: leading.label, fontWeight: '700', includeFontPadding: false },
  filename: { fontSize: type.body, lineHeight: leading.body, fontWeight: '600', includeFontPadding: false }, helper: { fontSize: type.caption, lineHeight: leading.caption, includeFontPadding: false },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap, maxWidth: '100%' }, consent: { minHeight: 48, padding: density.cardPadding, marginVertical: density.sectionGap, flexDirection: 'row', gap: density.iconGap, alignItems: 'center', borderRadius: radius.sm, borderWidth: 1 },
  consentText: { flex: 1, fontSize: type.body, lineHeight: leading.body, includeFontPadding: false },
});

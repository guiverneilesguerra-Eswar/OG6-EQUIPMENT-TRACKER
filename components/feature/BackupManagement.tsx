import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBackupManagement } from '@/hooks/useBackupManagement';
import { Card, Button, Chips, Field, ErrorText } from '@/components/ui/Controls';
import { FormModal } from '@/components/ui/FormModal';
import { density, leading, type } from '@/constants/theme';
interface Props {}
export function BackupManagement(_props: Props) {
  const m = useBackupManagement(); const c = m.colors; const disabled = m.busy || m.working || !m.loaded || !m.canOperate;
  return <><Card style={styles.card}><View style={styles.heading}><Ionicons name="save-outline" size={26} color={c.primary} /><Text style={[styles.title, { color: c.text }]}>COMPLETE BACKUP & RESTORE</Text></View>
    <Text style={[styles.copy, { color: c.subtle }]}>Portable JSON captures the entire device database, including archived records, grouped withdrawals, individual returns, names, timestamps, settings and selected audio files—not just the visible list. Backups are not encrypted; share only with authorized recipients.</Text>
    <ErrorText message={m.preview ? '' : m.error} />{m.status ? <Text accessibilityRole="alert" style={[styles.copy, { color: c.success }]}>{m.status}</Text> : null}
    <Button title="Export complete backup" icon="download-outline" onPress={() => void m.exportAll()} loading={m.working} disabled={disabled} /><Button title="Import backup" secondary icon="cloud-upload-outline" onPress={() => void m.importFile()} disabled={disabled} /><Button title="Export pre-restore recovery snapshot" secondary icon="refresh-outline" onPress={() => void m.exportRecovery()} disabled={disabled} />
    <Text style={[styles.copy, { color: c.subtle }]}>Full restore replaces records only after administrator authorization and final confirmation. Merge retains current settings and rejects conflicting records instead of overwriting them. A pre-restore snapshot is saved automatically; its audio files are retained.</Text>
  </Card>
  <FormModal visible={Boolean(m.preview)} title="REVIEW BACKUP RESTORATION" onClose={m.close} busyOverride={m.working}>
    {m.preview ? <><Text selectable style={[styles.title, { color: c.text }]}>{m.preview.filename}</Text><Text style={[styles.copy, { color: c.subtle }]}>Exported: {m.preview.exportedAt}{'\n'}{m.preview.summary}{'\n'}SHA-256 integrity check passed · {m.preview.payload.audio.length} audio file(s)</Text>
      <Chips options={['MERGE BACKUP', 'FULL RESTORE']} selected={m.mode === 'merge' ? 'MERGE BACKUP' : 'FULL RESTORE'} onSelect={v => m.changeMode(v === 'FULL RESTORE' ? 'full' : 'merge')} />
      <Text style={[styles.copy, { color: m.mode === 'full' ? c.warning : c.subtle }]}>{m.mode === 'full' ? 'FULL RESTORE replaces this device’s inventory, all transactions, names and settings with the selected backup. Export your current backup first. Current audio files are not deleted.' : 'MERGE preserves existing records and settings, skips identical IDs and combines new records. Conflicting IDs, serial numbers or active withdrawals stop the entire merge.'}</Text>
      <ErrorText message={m.error} />
      {m.confirmed ? <><Text style={[styles.copy, { color: c.text }]}>RESULTING DATABASE{'\n'}{m.plan}</Text><Field label="Administrator password *" value={m.password} onChangeText={m.setPassword} secure editable={!m.working} /><Text style={[styles.copy, { color: c.warning }]}>Confirm below to apply the reviewed restoration. Original IDs and timestamps are preserved. An internet connection is required for administrator authorization.</Text><Button title={m.mode === 'full' ? 'Confirm replacement & full restore' : 'Confirm merge backup'} onPress={() => void m.restore()} icon="shield-checkmark-outline" loading={m.working || m.busy} disabled={!m.password} /></> : <Button title="Validate restoration plan" icon="checkmark-circle-outline" onPress={m.reviewPlan} disabled={m.working || m.busy} />}
    </> : null}
  </FormModal></>;
}
const styles = StyleSheet.create({ card: { gap: density.cardGap, marginTop: density.cardGap }, heading: { flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, title: { flex: 1, minWidth: 1, fontSize: type.label, lineHeight: leading.label, fontWeight: '700' }, copy: { fontSize: type.body, lineHeight: leading.body, marginBottom: density.headerGap } });

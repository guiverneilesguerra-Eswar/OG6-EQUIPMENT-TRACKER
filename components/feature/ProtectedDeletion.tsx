import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArchiveKind } from '@/services/archival';
import { useProtectedDeletion } from '@/hooks/useProtectedDeletion';
import { useResponsive } from '@/hooks/useResponsive';
import { FormModal } from '@/components/ui/FormModal';
import { Button, ErrorText, Field } from '@/components/ui/Controls';
import { density, leading, type } from '@/constants/theme';

interface Props { visible: boolean; onClose: () => void; name: string; kind: ArchiveKind; recordId: string; active?: boolean; activeWithdrawal?: boolean }
export function ProtectedDeletion({ visible, onClose, name, kind, recordId, active = false, activeWithdrawal = false }: Props) {
  const m = useProtectedDeletion({ visible, onClose, kind, recordId }); const c = m.colors;
  const { height } = useResponsive();
  const blocked = kind === 'asset' && active;
  const dialogHeight = Math.max(1, Math.min(m.phase === 'done' ? 300 : m.phase === 'confirm' ? 440 : 400, height - 64));
  return <FormModal visible={visible} onClose={m.close} title={m.phase === 'done' ? 'RECORD ARCHIVED' : m.phase === 'confirm' ? 'FINAL DELETION CONFIRMATION' : 'ADMINISTRATOR AUTHORIZATION REQUIRED'} subtitle={name} busyOverride={m.busy} dialogHeight={dialogHeight}>
    <View style={styles.heading}><Ionicons name={m.phase === 'done' ? 'checkmark-circle-outline' : 'shield-checkmark-outline'} size={28} color={m.phase === 'done' ? c.success : c.primary} /><Text style={[styles.title, { color: c.text }]}>{m.phase === 'done' ? 'ARCHIVAL COMPLETED' : blocked ? 'ACTIVE EQUIPMENT IS PROTECTED' : m.phase === 'confirm' ? 'AUTHORIZE THIS ARCHIVAL?' : 'PASSWORD-PROTECTED DELETION'}</Text></View>
    {m.phase === 'done' ? <><Text accessibilityRole="alert" style={[styles.body, { color: c.success }]}>Record archived successfully. Lists and dashboard counts have been updated.</Text><Text style={[styles.body, { color: c.subtle }]}>The original record and transaction history remain available for accountability.</Text><Button title="Close" onPress={m.close} /></> : blocked ? <><Text style={[styles.body, { color: c.subtle }]}>This equipment is currently withdrawn and cannot be deleted until it is returned or the transaction is properly resolved.</Text><Button title="Keep record" secondary onPress={m.close} /></> : !m.canOperate ? <><Text style={[styles.body, { color: c.subtle }]}>The viewer workspace cannot archive records. Administrator password verification is also required in the operator workspace.</Text><Button title="Keep record" secondary onPress={m.close} /></> : m.phase === 'password' ? <>
      <Text style={[styles.body, { color: c.subtle }]}>Enter the administrator password to authorize this action. Verification requires an internet connection.</Text>
      <Field label="Administrator password *" secure value={m.password} onChangeText={m.setPassword} editable={!m.busy} placeholder="Enter administrator password" />
      <ErrorText message={m.error} />
      <View style={styles.actions}><Button title="Cancel" secondary onPress={m.close} disabled={m.busy} /><Button title="Verify password" icon="lock-closed-outline" onPress={() => void m.authorize()} disabled={!m.password} loading={m.busy} /></View>
    </> : <>
      <Text style={[styles.body, { color: c.subtle }]}>The administrator password was verified. Confirm to remove this {kind === 'asset' ? 'equipment' : 'withdrawal'} from active lists using soft archival. Original records and the server authorization audit will be retained.</Text>
      {kind === 'withdrawal' && activeWithdrawal ? <Text style={[styles.body, { color: c.warning }]}>This cancels this checkout. Equipment becomes available only if no other active checkout remains. No return is recorded; the original withdrawal stays in history.</Text> : null}
      <ErrorText message={m.error} />
      <View style={styles.actions}><Button title="Cancel" secondary onPress={m.close} disabled={m.busy} /><Button title="Confirm delete" danger icon="trash-outline" loading={m.busy} onPress={() => void m.confirm()} /></View>
      <Button title="Verify password again" secondary compact disabled={m.busy} onPress={m.reset} />
    </>}
  </FormModal>;
}
const styles = StyleSheet.create({ heading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.headerGap }, title: { flex: 1, fontSize: type.small, lineHeight: leading.small, fontWeight: '700' }, body: { fontSize: type.small, lineHeight: leading.small, marginBottom: density.sectionGap }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap, marginBottom: density.cardGap } });

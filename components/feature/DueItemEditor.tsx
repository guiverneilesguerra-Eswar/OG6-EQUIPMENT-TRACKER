import { StyleSheet, Text, View } from 'react-native';
import { FormModal } from '@/components/ui/FormModal';
import { Button, ErrorText, Field } from '@/components/ui/Controls';
import { DateField } from '@/components/ui/DateField';
import type { useDueItemEditor } from '@/hooks/useDueItemEditor';
import { formatDate } from '@/services/tracker';
import { density, leading, type } from '@/constants/theme';
interface Props { model: ReturnType<typeof useDueItemEditor> }
export function DueItemEditor({ model: m }: Props) {
  const c = m.colors; const disabled = m.working || m.busy;
  return <FormModal visible={Boolean(m.recordId)} title={m.approval ? 'EDIT DUE ITEM' : 'DUE ITEM EDIT AUTHORIZATION'} onClose={m.close} busyOverride={m.working}>
    <Text selectable style={[styles.copy, { color: c.primary }]}>WITHDRAWAL ID · {m.recordId}</Text>
    <ErrorText message={m.error} />
    {!m.approval ? <>
      <Text style={[styles.copy, { color: c.subtle }]}>Due date: {m.changes.dueAt ? formatDate(m.changes.dueAt) : 'No due date'}{ '\n' }Verify the existing equipment edit password before changing any details, extending the due date, or removing it. An internet connection is required.</Text>
      <Field label="Authorizing operator name *" value={m.actor} onChangeText={m.setActor} editable={!disabled} />
      <Text style={[styles.copy, { color: c.subtle }]}>The name is recorded as password-authorized attribution, not a verified account identity.</Text>
      <Field label="Equipment / due-date edit password *" value={m.password} onChangeText={m.setPassword} secure editable={!disabled} />
      <Button title="Verify password & unlock edit" icon="lock-closed-outline" onPress={() => void m.verify()} loading={disabled} disabled={!m.password || !m.actor.trim()} />
    </> : <>
      <Text style={[styles.copy, { color: c.subtle }]}>Authorized for this item only · {m.approval.actor}. Approval expires after 10 minutes. Equipment corrections update the same inventory record. Quantities, original signatures, references and return events remain unchanged.</Text>
      <Field label="Equipment name *" value={m.changes.name} onChangeText={v => m.change('name', v)} editable={!disabled} />
      <Field label="Serial / Product ID *" value={m.changes.serial} onChangeText={v => m.change('serial', v)} editable={!disabled} />
      <Field label="Equipment information" value={m.changes.description} onChangeText={v => m.change('description', v)} multiline editable={!disabled} />
      <Field label="Receiver details *" value={m.changes.receiver} onChangeText={v => m.change('receiver', v)} editable={!disabled} />
      <Field label="Releaser details *" value={m.changes.releaser} onChangeText={v => m.change('releaser', v)} editable={!disabled} />
      <View pointerEvents={disabled ? 'none' : 'auto'}>
        <DateField label="Due date (password authorized)" value={m.changes.dueAt} onChange={v => m.change('dueAt', v)} />
        <Button title="Remove due date" secondary compact icon="calendar-clear-outline" disabled={disabled || !m.changes.dueAt} onPress={() => m.change('dueAt', '')} />
      </View>
      <Text style={[styles.copy, { color: c.warning }]}>Previous due date: {m.approval.before.dueAt ? formatDate(m.approval.before.dueAt) : 'No due date'}{ '\n' }New due date: {m.changes.dueAt ? formatDate(m.changes.dueAt) : 'No due date (reminders disabled for this item)'}</Text>
      <Field label="Transaction remarks" value={m.changes.notes} onChangeText={v => m.change('notes', v)} multiline editable={!disabled} />
      <Text style={[styles.copy, { color: c.subtle }]}>Changing a receiver does not reassign their original signature. Original transaction details and each correction remain in history.</Text>
      <Button title="Save authorized changes" icon="save-outline" onPress={() => void m.save()} loading={disabled} />
    </>}
    <Button title="Cancel" secondary onPress={m.close} disabled={disabled} />
  </FormModal>;
}
const styles = StyleSheet.create({ copy: { fontSize: type.body, lineHeight: leading.body, marginBottom: density.sectionGap, includeFontPadding: false } });

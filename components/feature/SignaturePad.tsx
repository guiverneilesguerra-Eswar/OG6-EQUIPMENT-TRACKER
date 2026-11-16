import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { Signature } from '@/services/tracker';
import { useTracker } from '@/hooks/useTracker';
import { useSignatureCanvas } from '@/hooks/useSignatureCanvas';
import { useResponsive } from '@/hooks/useResponsive';
import { Button } from '@/components/ui/Controls';
import { radius, spacing, type, leading, density, signatureLayout } from '@/constants/theme';
interface Props {
  receiver: string; value: Signature; onChange: (value: Signature) => void;
  saved: boolean; onSave: () => void; readOnly?: boolean;
  label?: string; nameLabel?: string; disabled?: boolean; expandable?: boolean;
}
export const SignaturePad = memo(function SignaturePad({ receiver, value, onChange, saved, onSave, readOnly = false, label = 'Receiver’s signature', nameLabel = 'receiver', disabled = false, expandable = false }: Props) {
  const { colors: c } = useTracker(); const unlocked = Boolean(receiver.trim()) && !disabled;
  const responsive = useResponsive(); const compactExpanded = responsive.height < 450;
  const m = useSignatureCanvas({ value, onChange, unlocked, readOnly, disabled });
  const canvas = (large: boolean) => <View accessibilityLabel={`${label} for ${receiver || nameLabel}`} onLayout={e => m.measure(e.nativeEvent.layout.width, e.nativeEvent.layout.height)} {...(!readOnly ? m.responder.panHandlers : {})} style={[styles.pad, large ? styles.largePad : styles.compactPad, { backgroundColor: c.surfaceAlt, borderColor: saved ? c.success : unlocked ? c.borderBright : c.border }]}>
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none">{m.shown.map((stroke, i) => <Path key={i} d={stroke.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map((p, j) => `${j ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} stroke={c.text} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</Svg>
    <View pointerEvents="none" style={[styles.baseline, { borderColor: c.border }]} />
    {!unlocked && !readOnly ? <View style={[styles.locked, { backgroundColor: c.surfaceAlt }]}><Ionicons name="lock-closed-outline" color={c.subtle} size={24} /><Text style={[styles.lockText, { color: c.subtle }]}>{disabled ? 'Signature controls are disabled while saving.' : `Please enter the ${nameLabel} name to unlock the signature field.`}</Text></View> : !m.shown.length ? <View pointerEvents="none" style={styles.hint}><Ionicons name="pencil-outline" size={20} color={c.subtle} /><Text style={[styles.hintText, { color: c.subtle }]}>{readOnly ? 'No signature recorded for this historical event.' : 'Sign here using your finger, pen, or mouse'}</Text></View> : null}
  </View>;
  const controls = () => !readOnly ? <View style={styles.controls}>
    <Button title="Clear signature" secondary compact disabled={!unlocked} onPress={m.clear} />
    <Button title={saved ? 'Signature saved' : 'Save signature'} icon={saved ? 'checkmark-outline' : 'save-outline'} secondary compact disabled={!unlocked || !value.some(s => s.length > 2)} onPress={onSave} />
  </View> : null;
  return <View style={styles.container}>
    <View style={styles.labelRow}><Text style={[styles.label, styles.labelFlex, { color: c.text }]}>{label}</Text>{expandable && !readOnly ? <Pressable accessibilityRole="button" accessibilityLabel="Expand receiving personnel signature canvas" accessibilityState={{ expanded: m.expanded, disabled }} disabled={disabled} onPress={m.toggleExpanded} style={({ pressed }) => [styles.expand, { backgroundColor: c.surfaceAlt, opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }]}><Ionicons name="expand-outline" size={20} color={c.primary} /><Text style={[styles.expandText, { color: c.primary }]}>Expand</Text></Pressable> : null}</View>
    {!m.expanded ? <>{canvas(false)}{controls()}</> : null}
    {expandable ? <Modal visible={m.expanded} animationType="fade" presentationStyle="fullScreen" onRequestClose={m.toggleExpanded}>
      <SafeAreaView style={[styles.fullScreen, { backgroundColor: c.surface }]} edges={['top', 'bottom', 'left', 'right']}>
        {m.expanded ? <View style={[styles.expandedContent, compactExpanded ? styles.shortContent : null]}>
          <View style={styles.expandedHeader}><View style={styles.labelFlex}><Text style={[compactExpanded ? styles.shortTitle : styles.title, { color: c.text }]}>RECEIVING SIGNATURE</Text><Text numberOfLines={1} style={[styles.hintText, { color: saved ? c.success : c.subtle }]}>{saved ? 'Saved · ' : ''}{receiver || 'Enter receiving personnel in the return form'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Return to compact signature canvas" disabled={disabled} onPress={m.toggleExpanded} style={({ pressed }) => [styles.close, { backgroundColor: c.surfaceAlt, opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }]}><Ionicons name="contract-outline" size={24} color={c.primary} /></Pressable></View>
          {!compactExpanded ? <Text accessibilityLiveRegion="polite" style={[styles.state, { color: saved ? c.success : c.subtle }]}>{saved ? 'Signature saved' : 'Save the signature after signing.'} Switching views keeps your ink and save state.</Text> : null}
          {canvas(true)}
          {controls()}
          {!compactExpanded ? <Button title="Back to return form" secondary icon="contract-outline" disabled={disabled} onPress={m.toggleExpanded} /> : null}
        </View> : null}
      </SafeAreaView>
    </Modal> : null}
  </View>;
});
const styles = StyleSheet.create({
  container: { marginBottom: density.sectionGap }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.fieldGap }, labelFlex: { flex: 1, minWidth: 1 },
  label: { fontSize: type.meta, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false },
  expand: { minHeight: signatureLayout.controlHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: density.fieldGap, borderRadius: radius.sm }, expandText: { fontSize: type.body, fontWeight: '600', includeFontPadding: false },
  pad: { borderWidth: 1, borderRadius: signatureLayout.canvasRadius, overflow: 'hidden' }, compactPad: { height: signatureLayout.compactHeight }, largePad: { flex: 1, minHeight: signatureLayout.expandedMinHeight },
  baseline: { position: 'absolute', bottom: signatureLayout.baselineInset, left: spacing.lg, right: spacing.lg, borderBottomWidth: 1 },
  locked: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: density.cardPadding, gap: density.iconGap }, lockText: { fontSize: type.small, lineHeight: leading.small, textAlign: 'center' },
  hint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: density.cardPadding, gap: density.iconGap }, hintText: { fontSize: type.small, lineHeight: leading.small, textAlign: 'center' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: density.iconGap, marginTop: density.headerGap },
  fullScreen: { flex: 1 }, expandedContent: { flex: 1, width: '100%', maxWidth: signatureLayout.expandedMaxWidth, alignSelf: 'center', padding: spacing.md, gap: density.iconGap }, shortContent: { padding: spacing.sm, gap: density.fieldGap }, expandedHeader: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap },
  title: { fontSize: type.label, fontWeight: '700', includeFontPadding: false }, shortTitle: { fontSize: type.body, fontWeight: '700', includeFontPadding: false }, close: { width: signatureLayout.controlHeight, height: signatureLayout.controlHeight, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, state: { fontSize: type.body, lineHeight: leading.small, includeFontPadding: false },
});

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTracker } from '@/hooks/useTracker';
import { density, leading, type } from '@/constants/theme';
interface VolumeControlProps { label: string; value: number; onChange: (volume: number) => void; onSave: (volume: number) => void; disabled?: boolean }
export const VolumeControl = memo(function VolumeControl({ label, value, onChange, onSave, disabled = false }: VolumeControlProps) {
  const { colors: c } = useTracker();
  return <View style={styles.root}>
    <View style={styles.labelRow}><Text style={[styles.label, { color: c.text }]}>{label}</Text><Text style={[styles.number, { color: c.primary }]}>{Math.round(value)}%</Text></View>
    <Slider accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value), text: `${Math.round(value)} percent` }} minimumValue={0} maximumValue={100} step={1} value={value} onValueChange={onChange} onSlidingComplete={onSave} disabled={disabled} minimumTrackTintColor={c.primary} maximumTrackTintColor={c.border} thumbTintColor={c.primary} style={styles.slider} />
    <Text style={[styles.hint, { color: c.subtle }]}>0% mute · 100% maximum · changes apply immediately</Text>
  </View>;
});
const styles = StyleSheet.create({
  root: { marginTop: density.sectionGap }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap },
  label: { fontSize: type.meta, lineHeight: leading.small, fontWeight: '600', textTransform: 'uppercase', flex: 1, includeFontPadding: false },
  number: { fontSize: type.label, fontWeight: '700', includeFontPadding: false }, slider: { width: '100%', height: 48, marginTop: density.valueGap },
  hint: { fontSize: type.caption, lineHeight: leading.caption, includeFontPadding: false },
});

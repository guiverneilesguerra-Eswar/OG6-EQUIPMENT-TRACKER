import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTracker } from '@/hooks/useTracker';
import { getReturnSignatureDetails } from '@/services/returnSignatures';
import type { ReturnSignatureSource } from '@/services/returnSignatures';
import { type, leading, density } from '@/constants/theme';
import { SignaturePad } from './SignaturePad';
interface Props { record: ReturnSignatureSource }
export const ReturnSignatureView = memo(function ReturnSignatureView({ record }: Props) {
  const { colors: c } = useTracker(); const details = getReturnSignatureDetails(record);
  return details.signature.some(stroke => stroke.length > 2) ? <SignaturePad receiver={details.person} label={details.label} nameLabel={details.nameLabel} value={details.signature} onChange={() => {}} onSave={() => {}} saved readOnly /> : <Text style={[styles.helper, { color: c.subtle }]}>{details.missing}</Text>;
});
const styles = StyleSheet.create({ helper: { fontSize: type.caption, lineHeight: leading.body, marginBottom: density.headerGap, includeFontPadding: false } });

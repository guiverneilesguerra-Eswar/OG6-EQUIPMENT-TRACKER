import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTracker } from '@/hooks/useTracker';
import { getReturnSignatureBlocks } from '@/services/returnSignatures';
import type { ReturnSignatureSource } from '@/services/returnSignatures';
import { type, leading, density } from '@/constants/theme';
import { SignaturePad } from './SignaturePad';
interface Props { record: ReturnSignatureSource }
export const ReturnSignatureView = memo(function ReturnSignatureView({ record }: Props) {
  const { colors: c } = useTracker();
  return <View>{getReturnSignatureBlocks(record).map(details => details.signature.some(stroke => stroke.length > 2) ? <SignaturePad key={details.label} receiver={details.person} label={details.label} nameLabel={details.nameLabel} value={details.signature} onChange={() => {}} onSave={() => {}} saved readOnly /> : <Text key={details.label} style={[styles.helper, { color: c.subtle }]}>{details.missing}</Text>)}</View>;
});
const styles = StyleSheet.create({ helper: { fontSize: type.caption, lineHeight: leading.body, marginBottom: density.headerGap, includeFontPadding: false } });

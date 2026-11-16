import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTracker } from '@/hooks/useTracker';
import { returnSigner } from '@/services/returnSignatures';
import type { ReturnRecord } from '@/services/movements';
import { SignaturePad } from './SignaturePad';
import { type, leading, density } from '@/constants/theme';
interface Props { record: Pick<ReturnRecord,'receiving'|'returning'|'returnSignature'|'receivingSignature'> }
export const ReturnSignatureView=memo(function ReturnSignatureView({record}:Props){const{colors:c}=useTracker();const signer=returnSigner(record);return <View>{signer.signature?.some(s=>s.length>2)?<SignaturePad receiver={signer.person} label={signer.label} nameLabel={record.receivingSignature?'receiving personnel':'historical returning personnel'} value={signer.signature} onChange={()=>{}} onSave={()=>{}} saved readOnly/>:<Text style={[styles.text,{color:c.subtle}]}>No receiving personnel signature recorded for this historical return. Existing returning signatures are preserved, not relabeled.</Text>}</View>;});
const styles=StyleSheet.create({text:{fontSize:type.caption,lineHeight:leading.body,marginVertical:density.headerGap}});

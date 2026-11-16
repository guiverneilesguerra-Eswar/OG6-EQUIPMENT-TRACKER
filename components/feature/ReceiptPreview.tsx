import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptPreviewDocument } from '@/services/receiptPreview';
import { useReceiptPreview } from '@/hooks/useReceiptPreview';
import { useTracker } from '@/hooks/useTracker';
import { density, leading, radius, receiptPreviewLayout, spacing, type } from '@/constants/theme';

interface ReceiptPreviewProps { document: ReceiptPreviewDocument; filename: string }
// Reuses the vectors created with the exported PDF; no WebView, URL or second generation.
export const ReceiptPreview = memo(function ReceiptPreview({ document, filename }: ReceiptPreviewProps) {
  const { colors: c } = useTracker();
  const m = useReceiptPreview(document);
  return <View style={[styles.card, { backgroundColor: c.surfaceAlt, borderColor: c.borderBright }]}>
    <View style={styles.heading}>
      <Ionicons name="document-text-outline" size={20} color={c.primary} />
      <Text style={[styles.title, { color: c.text }]}>RECEIPT PREVIEW</Text>
      <Text style={[styles.pageCount, { color: c.subtle }]}>A4 · 1 / 1</Text>
    </View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out receipt" accessibilityState={{ disabled: !m.canZoomOut }} disabled={!m.canZoomOut} onPress={m.zoomOut} style={({ pressed }) => [styles.control, { backgroundColor: c.surface, borderColor: c.borderBright, opacity: !m.canZoomOut ? 0.45 : pressed ? 0.6 : 1 }]}>
        <Ionicons name="remove-outline" size={24} color={c.primary} />
      </Pressable>
      <Text accessibilityLabel={`Receipt zoom ${m.zoomLabel} relative to fit width`} accessibilityLiveRegion="polite" style={[styles.zoom, { color: c.text }]}>{m.zoomLabel}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in receipt" accessibilityState={{ disabled: !m.canZoomIn }} disabled={!m.canZoomIn} onPress={m.zoomIn} style={({ pressed }) => [styles.control, { backgroundColor: c.surface, borderColor: c.borderBright, opacity: !m.canZoomIn ? 0.45 : pressed ? 0.6 : 1 }]}>
        <Ionicons name="add-outline" size={24} color={c.primary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Fit receipt to width and return to top" onPress={m.fit} style={({ pressed }) => [styles.control, styles.fit, { backgroundColor: c.surface, borderColor: c.borderBright, opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="scan-outline" size={20} color={c.primary} />
        <Text style={[styles.fitText, { color: c.primary }]}>Fit</Text>
      </Pressable>
    </View>
    <View style={[styles.stage, { height: m.geometry.viewportHeight, borderColor: c.border, backgroundColor: c.white }]}>
      <View style={styles.viewport} onLayout={event => m.measure(event.nativeEvent.layout.width)}>
        <ScrollView ref={m.verticalScroll} style={styles.vertical} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" accessibilityLabel="Receipt vertical scroll area">
          <ScrollView ref={m.horizontalScroll} horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={m.canZoomOut} keyboardShouldPersistTaps="handled" style={{ width: m.geometry.viewportWidth }} accessibilityLabel="Receipt horizontal scroll area">
            <View style={{ width: m.geometry.pageWidth, height: m.geometry.pageHeight }} accessible accessibilityRole="image" accessibilityLabel={`One-page A4 preview of ${filename}, zoom ${m.zoomLabel}. Use the zoom buttons and scroll to inspect text and signatures.`}>
              <SvgXml xml={document.svg} width={m.geometry.pageWidth} height={m.geometry.pageHeight} pointerEvents="none" accessible={false} />
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
    <Text style={[styles.help, { color: c.subtle }]}>Scroll down to inspect the page. Zoom up to 800% and swipe sideways to read small text or check signatures. Fit returns to the top.</Text>
    {document.bodyScale < 1 ? <Text style={[styles.help, { color: c.subtle }]}>This receipt was reduced to fit one A4 sheet. Preview zoom does not change the exported PDF.</Text> : null}
  </View>;
});

const styles = StyleSheet.create({
  card: { padding: spacing.sm, gap: density.iconGap, borderRadius: radius.md, borderWidth: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: density.fieldGap, flexWrap: 'wrap' },
  title: { flex: 1, fontSize: type.body, fontWeight: '700', includeFontPadding: false },
  pageCount: { fontSize: type.body, lineHeight: leading.small, includeFontPadding: false },
  controls: { flexDirection: 'row', alignItems: 'center', gap: density.fieldGap, flexWrap: 'wrap' },
  control: { minWidth: receiptPreviewLayout.controlHeight, height: receiptPreviewLayout.controlHeight, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1 },
  zoom: { flex: 1, minWidth: receiptPreviewLayout.controlHeight, textAlign: 'center', fontSize: type.body, fontWeight: '700', includeFontPadding: false },
  fit: { flexDirection: 'row', gap: density.fieldGap, paddingHorizontal: spacing.sm },
  fitText: { fontSize: type.body, fontWeight: '600', includeFontPadding: false },
  stage: { borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' },
  viewport: { flex: 1 }, vertical: { flex: 1 },
  help: { fontSize: type.body, lineHeight: leading.body, includeFontPadding: false },
});

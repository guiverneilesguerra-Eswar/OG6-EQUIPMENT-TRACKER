import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

interface EmblemProps { compact?: boolean; scale?: number }
export const CommandEmblem = memo(function CommandEmblem({ compact = false, scale = 1 }: EmblemProps) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const size = compact ? 64 : Math.max(1, 132 * safeScale);
  return <View accessible accessibilityRole="image" accessibilityLabel="Philippine Army 4ID G6 communications crest" style={[styles.emblem, { width: size, height: size }]}>
    <Image source={require('@/assets/og6-logo.png')} style={styles.image} contentFit="contain" transition={200} />
  </View>;
});
const styles = StyleSheet.create({
  emblem: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  image: { width: '100%', height: '100%' },
});

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { type } from '@/constants/theme';
import { useTracker } from '@/hooks/useTracker';

interface EmblemProps { compact?: boolean; scale?: number }
export const CommandEmblem = memo(function CommandEmblem({ compact = false, scale = 1 }: EmblemProps) {
  const { colors: c } = useTracker();
  return <View accessibilityLabel="OG6 communications command emblem" style={[styles.emblem, compact ? styles.compact : { width: 132 * scale, height: 148 * scale }]}>
    <Svg width="100%" height="100%" viewBox="0 0 132 148" style={StyleSheet.absoluteFill}>
      <Path d="M66 5 L119 20 L116 82 Q113 119 66 140 Q19 119 16 82 L13 20 Z" fill={c.headerSurface} stroke={c.gold} strokeWidth="2.5" />
      <Path d="M66 12 L111 25 L109 81 Q106 112 66 131 Q26 112 23 81 L21 25 Z" fill="none" stroke={c.headerBorder} strokeWidth="1" />
      <Path d="M12 40 Q-2 102 47 131 M120 40 Q134 102 85 131 M9 53 L3 45 M7 66 L1 57 M8 79 L2 71 M12 91 L5 85 M18 103 L10 98 M27 114 L19 111 M38 124 L30 121 M123 53 L129 45 M125 66 L131 57 M124 79 L130 71 M120 91 L127 85 M114 103 L122 98 M105 114 L113 111 M94 124 L102 121" stroke={c.gold} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d="M66 34 L66 80 M66 44 L54 81 L78 81 Z M61 59 L73 70 M71 59 L59 70 M58 76 L75 76 M50 36 Q38 49 50 62 M44 31 Q26 49 44 68 M82 36 Q94 49 82 62 M88 31 Q106 49 88 68" stroke={c.headerAccent} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Circle cx="66" cy="40" r="3" fill={c.headerAccent} />
      <Path d="M66 17 L68 22 L74 22 L70 26 L71 32 L66 29 L61 32 L62 26 L58 22 L64 22 Z M33 57 L35 61 L40 61 L36 65 L37 70 L33 67 L29 70 L30 65 L26 61 L31 61 Z M99 57 L101 61 L106 61 L102 65 L103 70 L99 67 L95 70 L96 65 L92 61 L97 61 Z M66 113 L68 117 L73 117 L69 121 L70 126 L66 123 L62 126 L63 121 L59 117 L64 117 Z" fill={c.gold} />
    </Svg>
    <Text style={[styles.name, { color: c.text }, compact ? styles.compactName : { top: 82 * scale, fontSize: type.section * scale }]}>OG6</Text>
  </View>;
});
const styles = StyleSheet.create({ emblem: { width: 132, height: 148, alignItems: 'center', justifyContent: 'center', gap: 4 }, compact: { width: 56, height: 64, gap: 0 }, name: { position: 'absolute', top: 82, fontSize: type.section, fontWeight: '800', letterSpacing: 1 }, compactName: { top: 35, fontSize: type.micro } });

import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { useTracker } from '@/hooks/useTracker';
import { CommandEmblem } from './CommandEmblem';
import { radius, spacing, type, density } from '@/constants/theme';

const tabs: Record<string, { label: string; compactLabel?: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'HOME', icon: 'home-outline' },
  withdrawals: { label: 'WITHDRAWALS', compactLabel: 'WITH\nDRAWALS', icon: 'swap-horizontal-outline' },
  inventory: { label: 'INVENTORY', icon: 'cube-outline' },
  reports: { label: 'REPORTS', icon: 'stats-chart-outline' },
  settings: { label: 'SETTINGS', icon: 'settings-outline' },
};
export function TabNavigation({ state, navigation }: BottomTabBarProps) {
  const { commandLayout, compactLandscape, consoleScale: scale, sidebarWidth, width } = useResponsive();
  const { colors: c } = useTracker();
  const insets = useSafeAreaInsets();
  const items = state.routes.map((route, index) => {
    const tab = tabs[route.name];
    if (!tab) return null;
    const selected = state.index === index;
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label}
      onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name); }}
      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      style={({ pressed }) => [commandLayout ? styles.sideTab : styles.bottomTab, commandLayout ? { minHeight: Math.max(48, 56 * scale), paddingHorizontal: compactLandscape ? spacing.sm : density.cardPadding, gap: density.iconGap } : null, { backgroundColor: selected ? commandLayout ? c.action : c.blueBg : c.transparent, borderColor: selected ? commandLayout ? c.borderBright : c.primary : c.transparent, opacity: pressed ? 0.65 : 1, transform: [{ scale: pressed ? 0.985 : 1 }], shadowColor: c.shadow, shadowOpacity: selected && commandLayout ? 0.25 : 0 }]}>
      <Ionicons name={tab.icon} size={commandLayout ? Math.max(22, 32 * scale) : 20} color={selected ? commandLayout ? c.white : c.primary : commandLayout ? c.headerText : c.subtle} />
      <Text numberOfLines={commandLayout ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.85} style={[commandLayout ? styles.sideText : styles.bottomText, { fontSize: commandLayout ? compactLandscape ? type.micro : 20 * scale : type.tiny, color: selected ? commandLayout ? c.white : c.primary : commandLayout ? c.headerText : c.subtle }]}>{!commandLayout && width < 480 ? tab.compactLabel || tab.label : tab.label}</Text>
    </Pressable>;
  });
  if (commandLayout) return <View style={[styles.sidebar, { width: sidebarWidth + insets.left, paddingLeft: spacing.sm + insets.left, backgroundColor: c.headerBg, borderColor: c.headerBorder, paddingTop: insets.top + (compactLandscape ? spacing.sm : 20 * scale), paddingBottom: insets.bottom + spacing.sm }]}>
    <View pointerEvents="none" style={styles.wallpaper}><Image source={require('@/assets/command-sidebar.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center bottom" transition={200} /><LinearGradient colors={[c.headerBg, c.transparent, c.heroOverlay]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} /></View>
    <ScrollView style={styles.sideScroll} contentContainerStyle={styles.sideContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.sideBrand, { paddingBottom: compactLandscape ? spacing.sm : density.sectionGap }]}><CommandEmblem compact={compactLandscape} scale={scale} /></View>
      {items}
    </ScrollView>
  </View>;
  return <View style={[styles.bottom, { backgroundColor: c.surface, borderColor: c.border, height: Platform.OS === 'web' ? 70 : insets.bottom + 60, paddingBottom: Platform.OS === 'web' ? spacing.sm : insets.bottom + spacing.sm }]}>{items}</View>;
}
const styles = StyleSheet.create({
  sidebar: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: 1.5, paddingHorizontal: spacing.sm, overflow: 'hidden' }, wallpaper: { position: 'absolute', bottom: 0, top: '47%', left: 0, right: 0 }, sideScroll: { flex: 1 }, sideContent: { paddingBottom: spacing.sm }, sideBrand: { alignItems: 'center' },
  sideTab: { borderRadius: radius.sm + 4, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: density.headerGap, marginBottom: density.valueGap, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12 }, sideText: { fontWeight: '700', flex: 1, includeFontPadding: false },
  bottom: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm }, bottomTab: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: 2 }, bottomText: { lineHeight: type.micro, fontWeight: '700', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false },
});

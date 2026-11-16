import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { useTracker } from '@/hooks/useTracker';
import { CommandEmblem } from './CommandEmblem';
import { radius, spacing, type, density, layout, consoleType } from '@/constants/theme';

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
    return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} hitSlop={commandLayout ? { top: 4, bottom: 4 } : undefined}
      onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name); }}
      onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      style={({ pressed }) => [commandLayout ? styles.sideTab : styles.bottomTab, commandLayout ? { minHeight: Platform.OS === 'web' ? layout.navHeight * scale : 48, paddingHorizontal: compactLandscape ? spacing.xs : density.iconGap } : null, { backgroundColor: selected ? commandLayout ? c.action : c.blueBg : c.transparent, borderColor: selected ? c.borderBright : c.transparent, opacity: pressed ? 0.65 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      {selected && commandLayout ? <LinearGradient pointerEvents="none" colors={[c.signalBlue, c.action]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} /> : null}
      <Ionicons name={tab.icon} size={commandLayout ? 22 * scale : 20} color={selected ? commandLayout ? c.onAction : c.primary : c.headerText} />
      <Text numberOfLines={commandLayout ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.85} style={[commandLayout ? styles.sideText : styles.bottomText, { fontSize: commandLayout ? consoleType.nav * scale : type.tiny, color: selected ? commandLayout ? c.onAction : c.primary : c.headerText }]}>{!commandLayout && width < 480 ? tab.compactLabel || tab.label : tab.label}</Text>
    </Pressable>;
  });
  if (commandLayout) return <View style={[styles.sidebar, { width: sidebarWidth + insets.left, paddingLeft: spacing.xs + density.valueGap + insets.left, backgroundColor: c.headerBg, borderColor: c.headerBorder, paddingTop: insets.top + density.cardPadding, paddingBottom: insets.bottom + spacing.sm }]}>
    <View pointerEvents="none" style={styles.wallpaper}>
      <Image source={require('@/assets/command-sidebar.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center bottom" transition={200} />
      <LinearGradient colors={[c.headerBg, c.transparent, c.heroOverlay]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
    </View>
    <ScrollView style={styles.sideScroll} contentContainerStyle={styles.sideContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.sideBrand, { height: layout.sidebarBrandHeight * scale }]}><CommandEmblem scale={layout.emblemSize * scale / 132} /></View>
      {items}
    </ScrollView>
  </View>;
  return <View style={[styles.bottom, { backgroundColor: c.headerBg, borderColor: c.headerBorder, height: Platform.OS === 'web' ? 70 : insets.bottom + 60, paddingBottom: Platform.OS === 'web' ? spacing.sm : insets.bottom + spacing.sm }]}>{items}</View>;
}
const styles = StyleSheet.create({
  sidebar: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: 1, paddingHorizontal: spacing.xs + density.valueGap, overflow: 'hidden' }, wallpaper: { position: 'absolute', bottom: 0, top: '48%', left: 0, right: 0 }, sideScroll: { flex: 1 }, sideContent: { paddingBottom: spacing.sm }, sideBrand: { alignItems: 'center', justifyContent: 'flex-start' },
  sideTab: { borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: density.headerGap, marginBottom: density.valueGap, overflow: 'hidden' }, sideText: { fontWeight: '700', flex: 1, minWidth: 1, includeFontPadding: false },
  bottom: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm }, bottomTab: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: density.valueGap, paddingHorizontal: density.valueGap }, bottomText: { lineHeight: type.micro, fontWeight: '700', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false },
});

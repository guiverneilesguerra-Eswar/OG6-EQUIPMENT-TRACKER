import { ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useTracker } from '@/hooks/useTracker';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDate } from '@/services/tracker';
import { NotificationCenter } from '@/components/feature/NotificationCenter';
import { AlarmStatus } from '@/components/feature/AlarmStatus';
import { Button, ErrorText } from '@/components/ui/Controls';
import { CommandEmblem } from './CommandEmblem';
import { spacing, radius, type, leading, layout, consoleType, density } from '@/constants/theme';

interface Props { title: string; icon?: keyof typeof Ionicons.glyphMap; action?: ReactNode; children: ReactNode; dashboard?: boolean }
export function Screen({ title, icon = 'radio-outline', action, children, dashboard = false }: Props) {
  const { colors: c, data, now, loaded, error, retry } = useTracker();
  const { commandLayout, compactLandscape, consoleScale: scale, sidebarWidth, pagePadding } = useResponsive();
  const router = useRouter();
  const [notifications, setNotifications] = useState(false);
  const openNotifications = useCallback(() => setNotifications(true), []);
  const closeNotifications = useCallback(() => setNotifications(false), []);
  const openSettings = useCallback(() => router.push('/(tabs)/settings'), [router]);
  const unread = data.notices.filter(item => !item.read).length;
  const wideHeader = commandLayout && !compactLandscape;
  const heroHeight = wideHeader ? Math.round(layout.heroHeight * scale) : layout.compactHeroHeight;
  const brandSize = commandLayout ? consoleType.brand * scale : consoleType.brandCompact;
  return <SafeAreaView edges={commandLayout ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.headerBg, paddingLeft: sidebarWidth }]}>
    <StatusBar style="light" />
    <View style={[styles.workspace, { backgroundColor: c.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require('@/assets/tactical-wallpaper.webp')} style={[StyleSheet.absoluteFill, styles.wallpaper]} contentFit="cover" contentPosition="center bottom" transition={200} />
        <LinearGradient colors={[c.wallpaperOverlay, c.background]} style={StyleSheet.absoluteFill} />
      </View>
      <FlatList style={styles.scroll} data={[]} renderItem={() => null} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" ListHeaderComponent={<>
        <View style={[styles.hero, { backgroundColor: c.headerBg, minHeight: heroHeight }]}>
          <Image source={require('@/assets/command-network.webp')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right center" transition={200} />
          <LinearGradient pointerEvents="none" colors={[c.headerBg, c.heroOverlay, c.heroOverlay]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroContent, { paddingHorizontal: pagePadding, minHeight: heroHeight }]}>
            <View style={styles.brandRow}>
              {!commandLayout ? <CommandEmblem compact /> : null}
              <View style={styles.brandCopy}>
                <Text numberOfLines={commandLayout ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.brandTitle, { color: c.text, fontSize: brandSize, lineHeight: brandSize * 1.2 }]}><Text>OG6 </Text><Text style={{ color: c.headerAccent }}>EQUIPMENT TRACKER</Text></Text>
                <Text numberOfLines={wideHeader ? 1 : 2} style={[styles.brandSubtitle, wideHeader ? styles.wideSubtitle : null, { color: c.headerText, fontSize: consoleType.subtitle }]}>{'C4S Inventory and Equipment Monitoring System'}</Text>
              </View>
            </View>
            <View style={[styles.consoleRow, wideHeader ? [styles.desktopConsole, { right: pagePadding, bottom: density.cardPadding }] : styles.mobileConsole]}>
              <View style={[styles.clock, { backgroundColor: c.headerSurface, borderColor: c.headerBorder }, wideHeader ? { width: layout.clockWidth * scale } : styles.mobileClock]}>
                <Ionicons name="calendar-outline" size={20} color={c.headerText} />
                <View style={styles.clockCopy}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.time, { color: c.text }]}>{formatDate(now, wideHeader)}</Text>
                  <Text style={[styles.timezone, { color: c.headerText }]}>Asia/Manila (UTC+08:00)</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} hitSlop={4} onPress={openNotifications} style={({ pressed }) => [styles.bell, { backgroundColor: c.headerSurface, borderColor: c.headerBorder, opacity: pressed ? 0.65 : 1 }]}>
                <Ionicons name="notifications-outline" size={24} color={c.headerText} />
                {unread > 0 ? <View style={[styles.bellBadge, { backgroundColor: c.badgeDanger }]}><Text style={[styles.badgeText, { color: c.white }]}>{unread > 99 ? '99+' : unread}</Text></View> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open workspace settings" hitSlop={4} onPress={openSettings} style={({ pressed }) => [styles.profile, { backgroundColor: c.headerSurface, borderColor: c.headerBorder, opacity: pressed ? 0.65 : 1 }, !wideHeader ? styles.profileCompact : null]}>
                <View><Ionicons name="person-circle-outline" size={30} color={c.headerText} /><View style={[styles.profileDot, { backgroundColor: c.signalGreen, borderColor: c.headerBg }]} /></View>
                {wideHeader ? <Text style={[styles.profileTitle, { color: c.text }]}>{data.settings.role === 'operator' ? 'Operator' : 'Viewer'}</Text> : null}
                {wideHeader ? <Ionicons name="chevron-down-outline" size={12} color={c.headerText} /> : null}
              </Pressable>
            </View>
          </View>
        </View>
        <View style={[styles.content, { paddingHorizontal: pagePadding, paddingTop: dashboard ? 0 : density.sectionGap }]}>
          {!dashboard ? <View style={styles.pageHeading}><Ionicons name={icon} size={26} color={c.headerText} /><Text style={[styles.pageTitle, { color: c.text }]}>{title}</Text>{commandLayout && action ? <View style={styles.headingAction}>{action}</View> : null}</View> : null}
          {!commandLayout && action ? <View style={styles.action}>{action}</View> : null}
          {!dashboard ? <AlarmStatus /> : null}
          {error ? <View><ErrorText message={error} /><Button title="Retry loading records" onPress={() => void retry()} /></View> : !loaded ? <View style={styles.loading}><ActivityIndicator color={c.primary} /><Text style={[styles.loadingText, { color: c.subtle }]}>Loading equipment records…</Text></View> : children}
          {dashboard ? <View style={styles.dashboardStatus}><AlarmStatus /></View> : null}
          {!dashboard ? <View style={[styles.footer, { borderColor: c.border }]}><View style={styles.systemStatus}><View style={[styles.statusDot, { backgroundColor: c.signalGreen }]} /><Text style={[styles.footerText, { color: c.subtle }]}>OG6 · C4S ACCOUNTABILITY</Text></View><Text style={[styles.footerText, { color: c.subtle }]}>DEVICE-LOCAL WORKSPACE</Text></View> : null}
        </View>
      </>} />
    </View>
    <NotificationCenter visible={notifications} onClose={closeNotifications} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, workspace: { flex: 1, overflow: 'hidden' }, scroll: { flex: 1 }, wallpaper: { opacity: 0.3 }, hero: { overflow: 'hidden' },
  heroContent: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', paddingTop: density.cardPadding, paddingBottom: density.cardPadding, gap: density.iconGap },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, brandCopy: { flex: 1, minWidth: 1 },
  brandTitle: { fontWeight: '800', letterSpacing: -0.4, includeFontPadding: false }, brandSubtitle: { lineHeight: leading.caption, marginTop: density.valueGap, includeFontPadding: false }, wideSubtitle: { maxWidth: '48%' },
  consoleRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: density.iconGap }, desktopConsole: { position: 'absolute' }, mobileConsole: { marginTop: density.headerGap },
  clock: { minHeight: layout.headerControlHeight, minWidth: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderRadius: radius.pill }, mobileClock: { flex: 1 }, clockCopy: { flex: 1, minWidth: 1 },
  time: { fontSize: consoleType.clock, fontWeight: '600', lineHeight: consoleType.clock + spacing.xs, includeFontPadding: false }, timezone: { fontSize: consoleType.timezone, lineHeight: consoleType.timezone + spacing.xs, includeFontPadding: false },
  bell: { width: layout.headerControlHeight, height: layout.headerControlHeight, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, bellBadge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, paddingHorizontal: density.valueGap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, badgeText: { fontSize: consoleType.clock, fontWeight: '700', includeFontPadding: false },
  profile: { minHeight: layout.headerControlHeight, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.pill, borderWidth: 1 }, profileCompact: { paddingHorizontal: spacing.xs }, profileDot: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1, position: 'absolute', bottom: 1, right: 1 }, profileTitle: { fontSize: consoleType.clock, fontWeight: '700', includeFontPadding: false },
  systemStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  content: { paddingBottom: spacing.md, maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }, pageHeading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.sectionGap, flexWrap: 'wrap' }, pageTitle: { flex: 1, minWidth: 1, fontSize: type.section, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false }, headingAction: { maxWidth: '100%', flexBasis: 280, flexGrow: 1, flexShrink: 1, minWidth: 1 }, action: { marginBottom: density.sectionGap },
  dashboardStatus: { marginTop: density.sectionGap }, loading: { padding: density.cardPadding, gap: density.sectionGap, alignItems: 'center' }, loadingText: { fontSize: type.body }, footer: { borderTopWidth: 1, paddingTop: spacing.sm, marginTop: density.sectionGap, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: density.iconGap }, footerText: { fontSize: type.tiny, letterSpacing: 1 },
});

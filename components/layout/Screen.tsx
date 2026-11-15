import { ReactNode, useState } from 'react';
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
  const { colors: c, resolvedTheme, data, now, loaded, error, retry } = useTracker();
  const { tablet, commandLayout, compactLandscape, consoleScale: scale, sidebarWidth, pagePadding } = useResponsive();
  const router = useRouter();
  const [notifications, setNotifications] = useState(false);
  const unread = data.notices.filter(item => !item.read).length;
  const heroHeight = compactLandscape ? layout.compactHeroHeight : Math.round(layout.heroHeight * scale);
  const brandSize = commandLayout ? compactLandscape ? consoleType.brandCompact : consoleType.brand * scale : tablet ? consoleType.brandMedium : consoleType.brandCompact;
  return <SafeAreaView edges={commandLayout ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.headerBg, paddingLeft: sidebarWidth }]}>
    <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    <FlatList style={[styles.scroll, { backgroundColor: c.background }]} data={[]} renderItem={() => null} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" ListHeaderComponent={<>
      <View style={[styles.hero, { backgroundColor: c.headerBg }, commandLayout ? { minHeight: heroHeight } : null]}>
        {resolvedTheme === 'dark' ? <Image source={require('@/assets/command-network.webp')} style={[StyleSheet.absoluteFill, { opacity: 0.12 }]} contentFit="cover" contentPosition="right center" transition={200} /> : null}
        <LinearGradient pointerEvents="none" colors={[c.headerSurface, c.heroOverlay, c.headerBg]} locations={[0, 0.62, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.heroContent, { paddingHorizontal: pagePadding, paddingTop: density.cardPadding }, commandLayout ? { minHeight: heroHeight } : null]}>
          <View style={styles.brandRow}>
            {!commandLayout ? <CommandEmblem compact /> : null}
            <View style={styles.brandCopy}>
              <Text numberOfLines={commandLayout ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.brandTitle, { color: c.text, fontSize: brandSize }]}><Text>OG6 </Text><Text style={{ color: c.headerAccent }}>EQUIPMENT TRACKER</Text></Text>
              <Text numberOfLines={commandLayout ? 1 : 3} style={[styles.brandSubtitle, { color: c.headerText, fontSize: compactLandscape ? type.micro : commandLayout ? consoleType.metricLabel * scale : type.caption }]}>C4S Inventory and Equipment Monitoring System</Text>
            </View>
          </View>
          <View style={[styles.consoleRow, styles.mobileConsole]}>
            <View style={[styles.clock, { backgroundColor: c.headerSurface, borderColor: c.headerBorder }, commandLayout && !compactLandscape ? { width: 304 * scale, minHeight: 48, paddingHorizontal: density.cardPadding } : styles.mobileClock]}>
              <Ionicons name="calendar-outline" size={compactLandscape || !commandLayout ? 20 : 28 * scale} color={c.headerText} />
              <View style={styles.clockCopy}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.time, { color: c.text }]}>{formatDate(now, commandLayout && !compactLandscape)}</Text><Text style={[styles.timezone, { color: c.headerText }]}>Asia/Manila (UTC+08:00)</Text></View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} onPress={() => setNotifications(true)} style={({ pressed }) => [styles.bell, { backgroundColor: c.headerSurface, borderColor: c.headerBorder, width: 48, height: 48, opacity: pressed ? 0.65 : 1 }]}>
              <Ionicons name="notifications-outline" size={compactLandscape || !commandLayout ? 24 : 30 * scale} color={c.headerText} />
              {unread > 0 ? <View style={[styles.bellBadge, { backgroundColor: c.badgeDanger }]}><Text style={[styles.badgeText, { color: c.white }]}>{unread > 99 ? '99+' : unread}</Text></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open workspace settings" onPress={() => router.push('/(tabs)/settings')} style={({ pressed }) => [styles.profile, { backgroundColor: c.headerSurface, borderColor: c.headerBorder, minHeight: 48, opacity: pressed ? 0.65 : 1 }, compactLandscape || !commandLayout ? styles.profileCompact : null]}>
              <View><Ionicons name="person-circle-outline" size={compactLandscape || !commandLayout ? 30 : 36 * scale} color={c.headerText} /><View style={[styles.profileDot, { backgroundColor: c.signalGreen, borderColor: c.headerBg }]} /></View>
              {commandLayout && !compactLandscape ? <View><Text style={[styles.profileTitle, { color: c.text }]}>{data.settings.role.toUpperCase()}</Text><Text style={[styles.systemText, { color: c.headerText }]}>DEVICE LOCAL</Text></View> : null}
              {commandLayout && !compactLandscape ? <Ionicons name="chevron-down-outline" size={16} color={c.headerText} /> : null}
            </Pressable>
          </View>
        </View>
      </View>
      <View style={[styles.content, { paddingHorizontal: pagePadding, paddingTop: dashboard ? 0 : density.sectionGap }]}>
        {!dashboard ? <View style={styles.pageHeading}><Ionicons name={icon} size={compactLandscape ? 26 : 32} color={c.primary} /><Text style={[styles.pageTitle, { color: c.text, fontSize: compactLandscape ? consoleType.pageCompact : tablet ? consoleType.page * scale : type.section }]}>{title}</Text>{commandLayout && action ? <View style={styles.headingAction}>{action}</View> : null}</View> : null}
        {!commandLayout && action ? <View style={styles.action}>{action}</View> : null}
        <AlarmStatus />
        {error ? <View><ErrorText message={error} /><Button title="Retry loading records" onPress={() => void retry()} /></View> : !loaded ? <View style={styles.loading}><ActivityIndicator color={c.primary} /><Text style={[styles.loadingText, { color: c.subtle }]}>Loading equipment records…</Text></View> : children}
        {!dashboard ? <View style={[styles.footer, { borderColor: c.border }]}><View style={styles.systemStatus}><View style={[styles.statusDot, { backgroundColor: c.signalGreen }]} /><Text style={[styles.footerText, { color: c.subtle }]}>OG6 · C4S ACCOUNTABILITY</Text></View><Text style={[styles.footerText, { color: c.subtle }]}>DEVICE-LOCAL WORKSPACE</Text></View> : null}
      </View>
    </>} />
    <NotificationCenter visible={notifications} onClose={() => setNotifications(false)} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, scroll: { flex: 1 }, hero: { overflow: 'hidden' },
  heroContent: { width: '100%', maxWidth: layout.contentWidth, alignSelf: 'center', paddingBottom: density.cardPadding, gap: density.iconGap },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, brandCopy: { flex: 1, minWidth: 1 }, brandTitle: { fontWeight: '800', letterSpacing: -0.6, includeFontPadding: false },
  brandSubtitle: { lineHeight: leading.small, includeFontPadding: false }, consoleRow: { maxWidth: '100%', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end', gap: density.iconGap },
  mobileConsole: { marginTop: density.headerGap }, mobileClock: { flex: 1, minWidth: 1, minHeight: 48, paddingHorizontal: spacing.sm, gap: density.iconGap },
  clock: { flexShrink: 1, minWidth: 1, maxWidth: 420, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, padding: spacing.sm, borderWidth: 1.5, borderRadius: radius.lg + 4 }, clockCopy: { flex: 1, minWidth: 1 }, time: { fontSize: type.micro, fontWeight: '700', lineHeight: leading.caption }, timezone: { fontSize: type.tiny, lineHeight: type.meta, includeFontPadding: false },
  bell: { minWidth: 48, minHeight: 48, borderRadius: radius.lg + 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, bellBadge: { position: 'absolute', top: 0, right: -2, minWidth: 26, height: 26, paddingHorizontal: spacing.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, badgeText: { fontSize: type.micro, fontWeight: '700' },
  profile: { paddingHorizontal: spacing.md, paddingVertical: density.headerGap, flexDirection: 'row', alignItems: 'center', gap: density.iconGap, borderRadius: radius.lg + 4, borderWidth: 1.5 }, profileCompact: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, profileDot: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2, position: 'absolute', bottom: 1, right: 1 }, profileTitle: { fontSize: type.micro, fontWeight: '700' }, systemText: { fontSize: type.tiny, marginTop: spacing.xs },
  systemStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  content: { paddingBottom: spacing.md, maxWidth: layout.contentWidth, width: '100%', alignSelf: 'center' }, pageHeading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.headerGap, flexWrap: 'wrap' }, pageTitle: { flex: 1, minWidth: 1, fontWeight: '700', textTransform: 'uppercase', includeFontPadding: false }, headingAction: { maxWidth: '100%', flexBasis: 280, flexGrow: 1, flexShrink: 1, minWidth: 1 }, action: { marginBottom: density.sectionGap },
  loading: { padding: density.cardPadding, gap: density.sectionGap, alignItems: 'center' }, loadingText: { fontSize: type.label }, footer: { borderTopWidth: 1, paddingTop: spacing.sm, marginTop: density.sectionGap, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: density.iconGap }, footerText: { fontSize: type.tiny, letterSpacing: 1 },
});

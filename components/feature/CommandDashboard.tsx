import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDashboard } from '@/hooks/useDashboard';
import { useResponsive } from '@/hooks/useResponsive';
import { DashboardActivity } from '@/services/dashboard';
import { formatDate } from '@/services/tracker';
import { Button, Card, Empty } from '@/components/ui/Controls';
import { Colors, leading, radius, spacing, type, layout, consoleType, density } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
interface MetricProps { title: string; value: number; icon: IconName; accent: string; background: string; colors: Colors; fourColumns: boolean; scale: number }
const StatusMetric = memo(function StatusMetric({ title, value, icon, accent, background, colors: c, fourColumns, scale }: MetricProps) {
  const iconSize = fourColumns ? layout.metricIcon * scale : layout.compactMetricIcon;
  return <LinearGradient colors={[background, c.metricEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.metric, fourColumns ? styles.metricQuarter : styles.metricHalf, { borderColor: accent, shadowColor: accent, minHeight: fourColumns ? layout.metricHeight * scale : layout.compactMetricHeight, padding: density.cardPadding, gap: fourColumns ? density.iconGap : density.headerGap }]}>
    {fourColumns ? <>
      <View style={[styles.metricIcon, { backgroundColor: accent, width: iconSize, height: iconSize, borderRadius: radius.md * scale }]}><Ionicons name={icon} size={40 * scale} color={c.onAccent} /></View>
      <View style={styles.metricCopy}><Text style={[styles.metricLabel, { color: c.text, fontSize: Math.max(type.meta, consoleType.metricLabel * scale), lineHeight: Math.max(type.small, spacing.lg * scale) }]}>{title}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, { color: c.text, fontSize: consoleType.metric * scale, lineHeight: consoleType.metric * scale }]}>{value}</Text></View>
    </> : <>
      <View style={styles.compactMetricTop}><View style={[styles.metricIcon, { backgroundColor: accent, width: iconSize, height: iconSize, borderRadius: radius.sm }]}><Ionicons name={icon} size={28} color={c.onAccent} /></View><Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={[styles.metricValue, styles.compactMetricValue, { color: c.text }]}>{value}</Text></View>
      <Text style={[styles.metricLabel, styles.compactMetricLabel, { color: c.text }]}>{title.replace('\n', ' ')}</Text>
    </>}
  </LinearGradient>;
});
interface PillProps { status: string; colors: Colors; scale: number; table: boolean }
const StatusPill = memo(function StatusPill({ status, colors: c, scale, table }: PillProps) {
  const success = status === 'RETURNED' || status === 'ACKNOWLEDGED';
  const color = success ? c.success : status === 'OVERDUE' ? c.danger : status === 'DUE SOON' ? c.warning : c.primary;
  const background = success ? c.successBg : status === 'OVERDUE' ? c.dangerBg : status === 'DUE SOON' ? c.warningBg : c.blueBg;
  return <View style={[styles.statusPill, { minWidth: table ? Math.max(112, 116 * scale) : 86, borderColor: color, backgroundColor: background }]}><Text style={[styles.statusText, { color, fontSize: table ? Math.max(type.micro, consoleType.status * scale) : type.tiny }]}>{status}</Text></View>;
});
interface ActivityProps { activity: DashboardActivity; colors: Colors; showPersonnel: boolean; table: boolean; scale: number }
const ActivityRow = memo(function ActivityRow({ activity: item, colors: c, showPersonnel, table, scale }: ActivityProps) {
  const acknowledgement = item.kind === 'ACKNOWLEDGEMENT';
  const success = item.status === 'RETURNED' || item.status === 'ACKNOWLEDGED';
  const color = item.status === 'OVERDUE' ? c.danger : item.status === 'DUE SOON' ? c.warning : success ? c.success : c.primary;
  const background = item.status === 'OVERDUE' ? c.dangerBg : item.status === 'DUE SOON' ? c.warningBg : success ? c.successBg : c.blueBg;
  const icon: IconName = acknowledgement ? 'volume-mute-outline' : item.kind === 'RETURN' ? 'return-down-back-outline' : item.kind === 'WITHDRAWAL' ? 'swap-horizontal-outline' : item.status === 'OVERDUE' ? 'warning-outline' : 'calendar-outline';
  return <View style={[styles.activity, !table ? styles.compactActivity : null, { borderColor: c.border, minHeight: Math.max(48, layout.activityHeight * scale), gap: density.iconGap, paddingVertical: density.headerGap }]}>
    <View style={[styles.activityIcon, { backgroundColor: background, width: table ? 52 * scale : 36, height: table ? 52 * scale : 40 }]}><Ionicons name={icon} size={table ? 32 * scale : 22} color={color} /></View>
    {table ? <View style={[styles.kindChip, { width: 112 * scale, backgroundColor: background }]}><Text style={[styles.kindText, { color }]}>{acknowledgement ? 'ALARM ACK' : item.kind}</Text></View> : null}
    <View style={[styles.activityCopy, !table ? styles.compactActivityCopy : null]}>
      {!table ? <Text style={[styles.activityKind, { color }]}>{item.kind}</Text> : null}
      <Text numberOfLines={table ? 1 : 2} style={[styles.activityName, { color: c.text, fontSize: Math.max(type.small, consoleType.activity * scale) }]}>{item.name}</Text>
      {showPersonnel ? <Text numberOfLines={1} style={[styles.activityPerson, { color: c.subtle }]}>{acknowledgement ? 'Workspace' : item.kind === 'RETURN' ? 'Returned by' : 'Receiver'}: {item.person}</Text> : null}
      {item.withdrawalIds?.length ? <Text selectable style={[styles.activityDate, { color: c.subtle }]}>WITHDRAWAL IDS: {item.withdrawalIds.join(', ')}</Text> : null}
      {acknowledgement ? <Text selectable style={[styles.activityDate, { color: c.subtle }]}>{item.at}</Text> : null}
      {!table ? <Text style={[styles.activityDate, { color: c.subtle }]}>{item.kind === 'DUE ITEM' ? 'Due: ' : ''}{formatDate(item.at)}</Text> : null}
    </View>
    {table ? <View style={[styles.tableDate, { width: 230 * scale }]}><Ionicons name="calendar-outline" size={20} color={c.subtle} /><Text style={[styles.tableDateText, { color: c.subtle }]}>{item.kind === 'DUE ITEM' ? 'Due: ' : ''}{formatDate(item.at)}</Text></View> : null}
    <StatusPill status={item.status} colors={c} scale={scale} table={table} />
  </View>;
});
interface MonitorProps { overdue?: boolean; count: number; hours: number; colors: Colors; scale: number; compact: boolean; onView: () => void; onSilence?: () => void; silenced: boolean; busy: boolean }
const MonitoringPanel = memo(function MonitoringPanel({ overdue = false, count, hours, colors: c, scale, compact, onView, onSilence, silenced, busy }: MonitorProps) {
  const color = overdue ? c.danger : c.primary;
  const showBeacon = overdue && !compact;
  return <LinearGradient colors={[overdue ? c.dangerBg : c.blueBg, c.metricEnd]} style={[styles.monitor, { borderColor: overdue ? c.signalRed : c.borderBright, shadowColor: color, padding: density.cardPadding }]}>
    <View style={styles.panelHeader}><View style={[styles.monitorIcon, { backgroundColor: overdue ? c.dangerBg : c.blueBg }]}><Ionicons name={overdue ? 'alarm-outline' : 'calendar-outline'} size={26} color={color} /></View><Text style={[styles.panelTitle, { color: c.text, fontSize: Math.max(type.small, consoleType.metricLabel * scale) }]}>{overdue ? 'OVERDUE ALERT' : 'DUE SOON'}</Text>{overdue && count > 0 && onSilence ? <Pressable accessibilityRole="button" accessibilityLabel={silenced ? 'Overdue alarms acknowledged' : 'Acknowledge and silence overdue alarms'} disabled={busy || silenced} onPress={onSilence} style={({ pressed }) => [styles.silence, { opacity: pressed || busy ? 0.6 : 1 }]}><Ionicons name={silenced ? 'checkmark-circle-outline' : 'volume-mute-outline'} size={22} color={color} /></Pressable> : null}</View>
    <View style={styles.monitorBody}>
      <View style={styles.monitorCopy}>
        <Text style={[styles.monitorSummary, { color: c.text, fontSize: Math.max(type.small, consoleType.metricLabel * scale) }]}>{count} EQUIPMENT ITEM{count === 1 ? '' : 'S'} {overdue ? 'OVERDUE' : 'DUE SOON'}</Text>
        <Text style={[styles.monitorMessage, { color: c.subtle }]}>{overdue ? count > 0 ? 'There are equipment items that have exceeded their due date for return.' : 'All equipment is within its return schedule.' : `Within the next ${hours} hours.`}</Text>
      </View>
      {showBeacon ? <View pointerEvents="none" style={[styles.siren, { backgroundColor: c.dangerBg, borderColor: c.signalRed, shadowColor: c.signalRed, opacity: count > 0 ? 1 : 0.5 }]}><Ionicons name="alarm-outline" size={38} color={c.signalRed} /><View style={[styles.beaconBase, { backgroundColor: c.signalRed }]} /></View> : null}
      {!overdue ? <Pressable accessibilityRole="button" accessibilityLabel="View due-soon items" onPress={onView} style={({ pressed }) => [styles.dueAction, { backgroundColor: c.blueBg, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="arrow-forward-outline" size={28} color={c.primary} /></Pressable> : null}
    </View>
    {overdue ? <Pressable accessibilityRole="button" accessibilityLabel="View overdue items" onPress={onView} style={({ pressed }) => [styles.alertAction, { backgroundColor: c.dangerBg, borderColor: c.signalRed, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}><Text style={[styles.alertActionText, { color }]}>VIEW OVERDUE ITEMS</Text><Ionicons name="arrow-forward-outline" size={20} color={color} /></Pressable> : null}
  </LinearGradient>;
});
interface DashboardProps {}
export function CommandDashboard(_props: DashboardProps) {
  const m = useDashboard(); const c = m.colors;
  const { consoleScale: scale, dashboardRail: rail, fourMetrics, tableActivities: table } = useResponsive();
  const silenced = m.alarmsSilenced;
  return <>
    <Card style={[styles.overview, { padding: density.cardPadding }]}>
      <View style={[styles.dashboardHeading, { gap: density.iconGap, marginBottom: density.headerGap }]}><Ionicons name="home-outline" size={consoleType.brandMedium * scale} color={c.headerText} /><View style={styles.headingCopy}><Text style={[styles.dashboardTitle, { color: c.text, fontSize: fourMetrics ? consoleType.page * scale : consoleType.pageCompact }]}>HOME DASHBOARD</Text><Text style={[styles.dashboardDescription, { color: c.subtle }]}>Quick overview of equipment status, transactions, and due items.</Text></View></View>
      <View style={[styles.sectionHeader, { marginBottom: density.headerGap }]}><View style={styles.headingGroup}><Ionicons name="stats-chart-outline" size={28 * scale} color={c.headerText} /><Text style={[styles.sectionTitle, { color: c.text, fontSize: consoleType.section * scale }]}>QUICK LOOK</Text></View></View>
      <View style={[styles.metrics, { gap: density.cardGap }]}>
        <StatusMetric title={'TOTAL\nEQUIPMENT'} value={m.stats.total} icon="cube-outline" accent={c.signalBlue} background={c.blueBg} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'EQUIPMENT\nIN'} value={m.stats.in} icon="checkmark-circle-outline" accent={c.signalGreen} background={c.successBg} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'EQUIPMENT\nOUT'} value={m.stats.out} icon="arrow-up-outline" accent={c.signalBlue} background={c.blueBg} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'OVERDUE\nITEMS'} value={m.stats.overdue} icon="warning-outline" accent={c.signalRed} background={c.dangerBg} colors={c} fourColumns={fourMetrics} scale={scale} />
      </View>
    </Card>
    <View style={[styles.lower, { marginTop: density.cardGap, gap: density.cardGap }, rail ? styles.lowerWide : null]}>
      <Card style={[styles.activitiesCard, { padding: density.cardPadding }, rail ? styles.activityRail : null]}>
        <View style={[styles.sectionHeader, { marginBottom: density.headerGap }]}><View style={styles.headingGroup}><Ionicons name="time-outline" size={30 * scale} color={c.headerText} /><Text style={[styles.sectionTitle, { color: c.text, fontSize: Math.max(type.label, consoleType.section * scale) }]}>RECENT ACTIVITIES</Text></View><Pressable accessibilityRole="button" accessibilityLabel={m.expanded ? 'Show recent activities' : 'View all activities'} onPress={m.toggleActivities} style={({ pressed }) => [styles.viewAll, { opacity: pressed ? 0.6 : 1 }]}><Text style={[styles.viewAllText, { color: c.primary }]}>{m.expanded ? 'SHOW LESS' : table ? 'VIEW ALL ACTIVITIES' : 'VIEW ALL'}</Text><Ionicons name="arrow-forward-outline" size={22} color={c.primary} /></Pressable></View>
        <FlatList data={m.expanded ? m.activities : m.activities.slice(0, 4)} scrollEnabled={false} keyExtractor={item => item.id} ListEmptyComponent={<Empty icon="pulse-outline" title="No equipment movements yet" message="" />} renderItem={({ item }) => <ActivityRow activity={item} colors={c} showPersonnel={m.canOperate} table={table} scale={scale} />} />
        {m.assets.length === 0 && m.canOperate ? <Button title="Register first equipment" secondary icon="add-outline" onPress={m.viewInventory} /> : null}
      </Card>
      <View style={[styles.monitors, { gap: density.cardGap }, rail ? { width: `${layout.railFraction * 100}%` } : null]}>
        <MonitoringPanel overdue count={m.stats.overdue} hours={m.data.settings.warningHours} colors={c} scale={scale} compact={!table} onView={m.viewOverdue} onSilence={() => void m.silenceOverdue()} silenced={silenced} busy={m.busy} />
        <MonitoringPanel count={m.dueSoon} hours={m.data.settings.warningHours} colors={c} scale={scale} compact={!table} onView={m.viewDueSoon} silenced={false} busy={m.busy} />
      </View>
    </View>
  </>;
}
const styles = StyleSheet.create({
  overview: { borderRadius: radius.lg }, dashboardHeading: { flexDirection: 'row', alignItems: 'center' }, headingCopy: { flex: 1, minWidth: 1 }, dashboardTitle: { fontWeight: '700', includeFontPadding: false }, dashboardDescription: { fontSize: type.small, lineHeight: leading.caption },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: density.iconGap }, headingGroup: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, flexShrink: 1 }, sectionTitle: { fontWeight: '700', flexShrink: 1, includeFontPadding: false },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' }, metric: { borderRadius: radius.md, borderWidth: 2, flexDirection: 'row', alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 2 }, metricQuarter: { flex: 1, minWidth: 1 }, metricHalf: { width: '46%', flexGrow: 1, flexDirection: 'column', alignItems: 'flex-start' }, compactMetricTop: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, compactMetricValue: { flex: 1, fontSize: consoleType.metricCompact, lineHeight: consoleType.metricCompact + density.valueGap }, compactMetricLabel: { width: '100%', fontSize: type.micro, lineHeight: leading.caption }, metricIcon: { alignItems: 'center', justifyContent: 'center' }, metricCopy: { flex: 1, minWidth: 1, gap: density.valueGap }, metricLabel: { fontWeight: '700', includeFontPadding: false }, metricValue: { fontWeight: '800', includeFontPadding: false },
  lower: { }, lowerWide: { flexDirection: 'row', alignItems: 'flex-start' }, activitiesCard: { minWidth: 1 }, activityRail: { flex: 1 }, activity: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 }, compactActivity: { flexWrap: 'wrap' }, compactActivityCopy: { flexBasis: 120, flexGrow: 1 }, activityIcon: { borderRadius: radius.sm + 4, alignItems: 'center', justifyContent: 'center' }, kindChip: { borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: density.headerGap }, kindText: { fontSize: type.micro, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, activityCopy: { flex: 1, minWidth: 1, gap: density.valueGap }, activityKind: { fontSize: type.tiny, fontWeight: '700' }, activityName: { lineHeight: leading.caption, fontWeight: '700', includeFontPadding: false }, activityPerson: { fontSize: type.micro, lineHeight: leading.caption, includeFontPadding: false }, activityDate: { fontSize: type.tiny, lineHeight: type.meta + spacing.xs }, tableDate: { flexShrink: 1, flexDirection: 'row', gap: density.iconGap, alignItems: 'center' }, tableDateText: { flex: 1, fontSize: type.micro, lineHeight: leading.caption },
  statusPill: { maxWidth: '100%', minHeight: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1.5 }, statusText: { fontWeight: '700', textAlign: 'center', includeFontPadding: false }, viewAll: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, viewAllText: { fontSize: type.micro, fontWeight: '700' },
  monitors: { minWidth: 1 }, monitor: { borderRadius: radius.lg, borderWidth: 1.5, gap: density.iconGap, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 }, panelHeader: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, monitorIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, panelTitle: { flex: 1, fontWeight: '700' }, monitorBody: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, monitorCopy: { flex: 1, minWidth: 1, gap: density.valueGap }, monitorSummary: { fontWeight: '700', lineHeight: leading.small, includeFontPadding: false }, monitorMessage: { fontSize: type.small, lineHeight: leading.small, includeFontPadding: false },
  siren: { position: 'relative', flexShrink: 0, width: 52, height: 64, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16 }, beaconBase: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md }, alertAction: { minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: 1.5, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: density.iconGap, marginTop: density.valueGap, maxWidth: '100%'  }, alertActionText: { fontSize: type.meta, fontWeight: '700', flexShrink: 1, textAlign: 'center' }, dueAction: { flexShrink: 0, width: 48, height: 48, borderRadius: radius.sm + 4, alignItems: 'center', justifyContent: 'center' }, silence: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});

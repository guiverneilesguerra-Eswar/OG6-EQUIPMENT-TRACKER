import { memo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDashboard } from '@/hooks/useDashboard';
import { useResponsive } from '@/hooks/useResponsive';
import type { DashboardActivity } from '@/services/dashboard';
import { formatDate } from '@/services/tracker';
import { Button, Card, Empty } from '@/components/ui/Controls';
import { Colors, leading, radius, spacing, type, layout, consoleType, density } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
interface MetricProps { title: string; value: number; icon: IconName; accent: string; background: string; colors: Colors; fourColumns: boolean; scale: number; diagonal?: boolean }
const StatusMetric = memo(function StatusMetric({ title, value, icon, accent, background, colors: c, fourColumns, scale, diagonal = false }: MetricProps) {
  const iconSize = fourColumns ? layout.metricIcon * scale : layout.compactMetricIcon;
  const copy = <View style={styles.metricCopy}>
    <Text style={[styles.metricLabel, { color: c.text, fontSize: consoleType.metricLabel * (fourColumns ? scale : 1), lineHeight: (consoleType.metricLabel + density.valueGap) * (fourColumns ? scale : 1) }]}>{fourColumns ? title : title.replace('\n', ' ')}</Text>
    {fourColumns ? <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[styles.metricValue, { color: c.text, fontSize: consoleType.metric * scale, lineHeight: consoleType.metric * scale }]}>{value}</Text> : null}
  </View>;
  return <LinearGradient colors={[background, c.metricEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.metric, fourColumns ? styles.metricQuarter : styles.metricHalf, { borderColor: accent, shadowColor: accent, minHeight: fourColumns ? layout.metricHeight * scale : layout.compactMetricHeight }]}>
    <View style={!fourColumns ? styles.compactMetricTop : null}>
      <LinearGradient colors={[accent, accent === c.signalGreen ? c.signalGreen : accent === c.signalRed ? c.badgeDanger : c.action]} style={[styles.metricIcon, { width: iconSize, height: iconSize }]}>
        <Ionicons name={icon} size={fourColumns ? 34 * scale : 26} color={c.onAccent} style={diagonal ? styles.diagonalArrow : undefined} />
      </LinearGradient>
      {!fourColumns ? <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, styles.compactMetricValue, { color: c.text }]}>{value}</Text> : null}
    </View>
    {copy}
  </LinearGradient>;
});
interface PillProps { status: string; colors: Colors; table: boolean }
const StatusPill = memo(function StatusPill({ status, colors: c, table }: PillProps) {
  const success = status === 'RETURNED' || status === 'ACKNOWLEDGED';
  const color = success ? c.success : status === 'OVERDUE' ? c.danger : status === 'DUE SOON' ? c.warning : c.primary;
  const background = success ? c.successBg : status === 'OVERDUE' ? c.dangerBg : status === 'DUE SOON' ? c.warningBg : c.blueBg;
  return <View style={[styles.statusPill, { width: table ? layout.activityStatusWidth : 94, borderColor: color, backgroundColor: background }]}><Text adjustsFontSizeToFit numberOfLines={1} style={[styles.statusText, { color, fontSize: table ? consoleType.status : type.tiny }]}>{status}</Text></View>;
});
interface ActivityProps { activity: DashboardActivity; colors: Colors; showPersonnel: boolean; table: boolean; scale: number }
const ActivityRow = memo(function ActivityRow({ activity: item, colors: c, showPersonnel, table, scale }: ActivityProps) {
  const acknowledgement = item.kind === 'ACKNOWLEDGEMENT';
  const success = item.status === 'RETURNED' || item.status === 'ACKNOWLEDGED';
  const color = item.status === 'OVERDUE' ? c.danger : item.status === 'DUE SOON' ? c.warning : success ? c.success : c.primary;
  const background = item.status === 'OVERDUE' ? c.dangerBg : item.status === 'DUE SOON' ? c.warningBg : success ? c.successBg : c.blueBg;
  const icon: IconName = acknowledgement ? 'volume-mute-outline' : item.kind === 'RETURN' ? 'return-down-back-outline' : item.kind === 'WITHDRAWAL' ? 'swap-horizontal-outline' : item.status === 'OVERDUE' ? 'warning-outline' : 'calendar-outline';
  return <View style={[styles.activity, !table ? styles.compactActivity : null, { borderColor: c.border, minHeight: layout.activityHeight * scale }]}>
    <View style={[styles.activityIcon, { backgroundColor: background }]}><Ionicons name={icon} size={22} color={color} /></View>
    {table ? <View style={[styles.kindChip, { backgroundColor: background }]}><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kindText, { color }]}>{acknowledgement ? 'ALARM ACK' : item.kind}</Text></View> : null}
    <View style={styles.activityCopy}>
      {!table ? <Text style={[styles.activityKind, { color }]}>{item.kind}</Text> : null}
      <Text numberOfLines={table ? 1 : 2} style={[styles.activityName, { color: c.text, fontSize: table ? consoleType.activity : type.small, lineHeight: table ? consoleType.activity + spacing.xs : leading.small }]}>{item.name}</Text>
      {showPersonnel ? <Text numberOfLines={1} style={[styles.activityPerson, { color: c.subtle, fontSize: table ? consoleType.activityMeta : type.micro, lineHeight: table ? consoleType.activityMeta + spacing.xs : leading.caption }]}>{acknowledgement ? 'Workspace' : item.kind === 'RETURN' ? 'Returned by' : 'Receiver'}: {item.person}</Text> : null}
      {item.withdrawalIds?.length ? <Text selectable style={[styles.activityDate, { color: c.subtle }]}>WITHDRAWAL IDS: {item.withdrawalIds.join(', ')}</Text> : null}
      {acknowledgement ? <Text selectable style={[styles.activityDate, { color: c.subtle }]}>{item.at}</Text> : null}
      {!table ? <Text style={[styles.activityDate, { color: c.subtle }]}>{item.kind === 'DUE ITEM' ? 'Due: ' : ''}{formatDate(item.at)}</Text> : null}
    </View>
    {table ? <View style={styles.tableDate}><Ionicons name="calendar-outline" size={14} color={c.subtle} /><Text numberOfLines={2} style={[styles.tableDateText, { color: c.subtle }]}>{item.kind === 'DUE ITEM' ? 'Due: ' : ''}{formatDate(item.at)}</Text></View> : null}
    <StatusPill status={item.status} colors={c} table={table} />
  </View>;
});
interface BeaconProps { colors: Colors; active: boolean }
const AlarmBeacon = memo(function AlarmBeacon({ colors: c, active }: BeaconProps) {
  return <View pointerEvents="none" style={[styles.beacon, { opacity: active ? 1 : 0.45 }]}>
    <View style={[styles.beaconHalo, { backgroundColor: c.signalRed, shadowColor: c.signalRed }]} />
    <LinearGradient colors={[c.danger, c.signalRed, c.badgeDanger]} style={[styles.beaconDome, { borderColor: c.danger }]}><View style={[styles.beaconBulb, { backgroundColor: c.white }]} /><View style={[styles.beaconStem, { backgroundColor: c.danger }]} /></LinearGradient>
    <View style={[styles.beaconFoot, { borderColor: c.danger, backgroundColor: c.dangerBg }]} />
  </View>;
});
interface MonitorProps { overdue?: boolean; count: number; hours: number; colors: Colors; dense: boolean; onView: () => void; onSilence?: () => void; silenced: boolean; busy: boolean }
const MonitoringPanel = memo(function MonitoringPanel({ overdue = false, count, hours, colors: c, dense, onView, onSilence, silenced, busy }: MonitorProps) {
  const color = overdue ? c.danger : c.primary;
  return <LinearGradient colors={[overdue ? c.dangerBg : c.metricStart, c.metricEnd]} style={[styles.monitor, dense ? { minHeight: overdue ? layout.monitorOverdueHeight : layout.monitorDueHeight } : null, { borderColor: overdue ? c.badgeDanger : c.borderBright, shadowColor: color }]}>
    <View style={styles.panelHeader}>
      <View style={[styles.monitorIcon, { backgroundColor: overdue ? c.dangerBg : c.blueBg }]}><Ionicons name={overdue ? 'alarm-outline' : 'calendar-outline'} size={20} color={color} /></View>
      <Text style={[styles.panelTitle, { color: c.text, fontSize: dense ? type.micro : type.small }]}>{overdue ? 'Overdue Alert' : 'Due Soon'}</Text>
      {overdue && count > 0 && onSilence ? <Pressable accessibilityRole="button" accessibilityLabel={silenced ? 'Overdue alarms acknowledged' : 'Acknowledge and silence overdue alarms'} disabled={busy || silenced} hitSlop={12} onPress={onSilence} style={({ pressed }) => [styles.silence, { opacity: pressed || busy ? 0.6 : 1 }]}><Ionicons name={silenced ? 'checkmark-circle-outline' : 'volume-mute-outline'} size={20} color={color} /></Pressable> : null}
    </View>
    <View style={styles.monitorBody}>
      <View style={styles.monitorCopy}>
        <Text style={[styles.monitorSummary, { color: c.text, fontSize: dense ? type.micro : type.small, lineHeight: dense ? consoleType.section : leading.small }]}>{count} Equipment Item(s) {overdue ? 'Overdue' : 'Due Soon'}</Text>
        <Text style={[styles.monitorMessage, { color: c.subtle, fontSize: dense ? consoleType.description : type.body, lineHeight: dense ? type.small : leading.body }]}>{overdue ? count > 0 ? 'There are equipment items that have exceeded their due date for return.' : 'All equipment is within its return schedule.' : `Within the next ${hours} hours.`}</Text>
      </View>
      {overdue && dense ? <AlarmBeacon colors={c} active={count > 0} /> : null}
      {!overdue ? <Pressable accessibilityRole="button" accessibilityLabel="View due-soon items" hitSlop={8} onPress={onView} style={({ pressed }) => [styles.dueAction, { backgroundColor: c.blueBg, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="arrow-forward-outline" size={22} color={c.primary} /></Pressable> : null}
    </View>
    {overdue ? <Pressable accessibilityRole="button" accessibilityLabel="View overdue items" hitSlop={8} onPress={onView} style={({ pressed }) => [styles.alertAction, dense && Platform.OS === 'web' ? styles.denseAlertAction : null, { backgroundColor: c.dangerBg, borderColor: c.badgeDanger, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}><Text style={[styles.alertActionText, { color, fontSize: dense ? consoleType.link : type.body }]}>View Overdue Items</Text><Ionicons name="arrow-forward-outline" size={16} color={color} /></Pressable> : null}
  </LinearGradient>;
});
interface DashboardProps {}
export function CommandDashboard(_props: DashboardProps) {
  const m = useDashboard(); const c = m.colors;
  const { consoleScale: scale, dashboardRail: rail, fourMetrics, tableActivities: table } = useResponsive();
  return <>
    <Card style={[styles.overview, fourMetrics ? { minHeight: layout.overviewHeight * scale } : null]}>
      <View style={styles.dashboardHeading}>
        <Ionicons name="home-outline" size={30} color={c.headerText} />
        <View style={styles.headingCopy}><Text style={[styles.dashboardTitle, { color: c.text }]}>HOME DASHBOARD</Text><Text style={[styles.dashboardDescription, { color: c.subtle }]}>Quick overview of equipment status, transactions, and due items.</Text></View>
      </View>
      <View style={styles.quickHeader}><Ionicons name="stats-chart-outline" size={18} color={c.headerText} /><Text style={[styles.sectionTitle, { color: c.text }]}>Quick Look</Text></View>
      <View style={styles.metrics}>
        <StatusMetric title={'TOTAL\nEQUIPMENT'} value={m.stats.total} icon="cube-outline" accent={c.signalBlue} background={c.metricStart} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'EQUIPMENT\nIN'} value={m.stats.in} icon="checkmark-circle-outline" accent={c.signalGreen} background={c.successBg} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'EQUIPMENT\nOUT'} value={m.stats.out} icon="arrow-forward-outline" diagonal accent={c.signalBlue} background={c.metricStart} colors={c} fourColumns={fourMetrics} scale={scale} />
        <StatusMetric title={'OVERDUE\nITEMS'} value={m.stats.overdue} icon="warning-outline" accent={c.signalRed} background={c.dangerBg} colors={c} fourColumns={fourMetrics} scale={scale} />
      </View>
    </Card>
    <View style={[styles.lower, rail ? styles.lowerWide : null]}>
      <Card style={[styles.activitiesCard, rail ? [styles.activityRail, { minHeight: layout.lowerHeight }] : null]}>
        <View style={styles.sectionHeader}>
          <View style={styles.headingGroup}><Ionicons name="time-outline" size={20} color={c.headerText} /><Text style={[styles.sectionTitle, { color: c.text }]}>Recent Activities</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={m.expanded ? 'Show recent activities' : 'View all activities'} hitSlop={8} onPress={m.toggleActivities} style={({ pressed }) => [styles.viewAll, { opacity: pressed ? 0.6 : 1 }]}><Text style={[styles.viewAllText, { color: c.primary }]}>{m.expanded ? 'Show Less' : table ? 'View All Activities' : 'View All'}</Text><Ionicons name="arrow-forward-outline" size={16} color={c.primary} /></Pressable>
        </View>
        <FlatList data={m.expanded ? m.activities : m.activities.slice(0, 4)} scrollEnabled={false} keyExtractor={item => item.id} ListEmptyComponent={<Empty icon="pulse-outline" title="No equipment movements yet" message="" />} renderItem={({ item }) => <ActivityRow activity={item} colors={c} showPersonnel={m.canOperate} table={table} scale={scale} />} />
        <View style={[styles.activityBaseline, { borderColor: c.border }]} />
        {m.assets.length === 0 && m.canOperate ? <Button title="Register first equipment" secondary icon="add-outline" onPress={m.viewInventory} /> : null}
      </Card>
      <View style={[styles.monitors, rail ? styles.monitorRail : null]}>
        <MonitoringPanel overdue count={m.stats.overdue} hours={m.data.settings.warningHours} colors={c} dense={rail} onView={m.viewOverdue} onSilence={() => void m.silenceOverdue()} silenced={m.alarmsSilenced} busy={m.busy} />
        <MonitoringPanel count={m.dueSoon} hours={m.data.settings.warningHours} colors={c} dense={rail} onView={m.viewDueSoon} silenced={false} busy={m.busy} />
      </View>
    </View>
  </>;
}
const styles = StyleSheet.create({
  overview: { padding: density.cardPadding }, dashboardHeading: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, marginBottom: density.headerGap + density.valueGap }, headingCopy: { flex: 1, minWidth: 1 }, dashboardTitle: { fontSize: consoleType.page, lineHeight: leading.label, fontWeight: '700', includeFontPadding: false }, dashboardDescription: { fontSize: consoleType.description, lineHeight: type.small, includeFontPadding: false },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, minHeight: leading.small, marginBottom: density.headerGap + density.valueGap }, sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: density.iconGap, marginBottom: density.headerGap }, headingGroup: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap, flexShrink: 1 }, sectionTitle: { fontSize: consoleType.section, fontWeight: '700', flexShrink: 1, includeFontPadding: false },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: density.cardGap }, metric: { borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: density.cardPadding, paddingVertical: spacing.sm + density.valueGap, gap: spacing.md, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 1 }, metricQuarter: { flex: 1, minWidth: 1 }, metricHalf: { width: '46%', flexGrow: 1, flexDirection: 'column', alignItems: 'flex-start', gap: density.iconGap }, compactMetricTop: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, compactMetricValue: { flex: 1, fontSize: consoleType.metricCompact, lineHeight: consoleType.metricCompact + density.valueGap }, metricIcon: { borderRadius: radius.sm + density.valueGap, alignItems: 'center', justifyContent: 'center' }, metricCopy: { flex: 1, minWidth: 1, gap: density.valueGap }, metricLabel: { fontWeight: '700', includeFontPadding: false }, metricValue: { fontWeight: '800', includeFontPadding: false }, diagonalArrow: { transform: [{ rotate: '-45deg' }] },
  lower: { marginTop: density.sectionGap, gap: layout.panelGap }, lowerWide: { flexDirection: 'row', alignItems: 'stretch' }, activitiesCard: { minWidth: 1, padding: density.cardPadding }, activityRail: { flex: 1 - layout.railFraction }, monitorRail: { flex: layout.railFraction }, activity: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, gap: density.iconGap, paddingVertical: spacing.xs + density.valueGap }, compactActivity: { flexWrap: 'wrap', paddingVertical: spacing.sm }, activityIcon: { borderRadius: radius.sm, width: layout.activityIconWidth, height: layout.activityIconWidth, alignItems: 'center', justifyContent: 'center' }, kindChip: { width: layout.activityKindWidth, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: density.headerGap }, kindText: { fontSize: consoleType.timezone, fontWeight: '700', textAlign: 'center', includeFontPadding: false }, activityCopy: { flex: 1, minWidth: 1 }, activityKind: { fontSize: type.tiny, fontWeight: '700', marginBottom: density.valueGap }, activityName: { fontWeight: '700', includeFontPadding: false }, activityPerson: { includeFontPadding: false }, activityDate: { fontSize: type.tiny, lineHeight: leading.caption }, tableDate: { width: layout.activityDateWidth, flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }, tableDateText: { flex: 1, fontSize: consoleType.activityMeta, lineHeight: 14, includeFontPadding: false }, activityBaseline: { borderTopWidth: 1, marginBottom: density.headerGap },
  statusPill: { maxWidth: '100%', minHeight: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, paddingVertical: density.valueGap, borderRadius: radius.pill, borderWidth: 1 }, statusText: { fontWeight: '700', textAlign: 'center', includeFontPadding: false }, viewAll: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, viewAllText: { fontSize: consoleType.link, fontWeight: '600', includeFontPadding: false },
  monitors: { minWidth: 1, gap: density.cardGap - density.valueGap }, monitor: { borderRadius: radius.md, borderWidth: 1, padding: density.cardPadding, gap: density.headerGap, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 1 }, panelHeader: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, monitorIcon: { width: 24, height: 24, borderRadius: radius.sm - density.valueGap, alignItems: 'center', justifyContent: 'center' }, panelTitle: { flex: 1, fontWeight: '700', includeFontPadding: false }, monitorBody: { flexDirection: 'row', alignItems: 'center', gap: density.iconGap }, monitorCopy: { flex: 1, minWidth: 1, gap: density.headerGap }, monitorSummary: { fontWeight: '700', includeFontPadding: false }, monitorMessage: { includeFontPadding: false },
  beacon: { position: 'relative', width: 46, height: 54, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-end' }, beaconHalo: { position: 'absolute', width: 44, height: 44, borderRadius: radius.pill, top: 0, opacity: 0.15, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 18 }, beaconDome: { width: 32, height: 42, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, beaconBulb: { width: 12, height: 16, borderRadius: radius.pill, opacity: 0.45 }, beaconStem: { width: 4, height: 12 }, beaconFoot: { width: 44, height: 7, borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  alertAction: { minHeight: 48, width: '100%', maxWidth: '100%', paddingHorizontal: spacing.sm, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: density.iconGap }, denseAlertAction: { minHeight: 26, width: '70%' }, alertActionText: { fontWeight: '600', flexShrink: 1, textAlign: 'center', includeFontPadding: false }, dueAction: { flexShrink: 0, width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, silence: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});

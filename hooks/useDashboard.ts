import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAlert } from '@/hooks/useCommandAlert';
import { useTracker } from './useTracker';
import { useAudio } from './useAudio';
import { dashboardActivities, dueSoonCount } from '@/services/dashboard';

export function useDashboard() {
  const tracker = useTracker(); const audio = useAudio();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [expanded, setExpanded] = useState(false);
  const activities = useMemo(() => dashboardActivities(tracker.data, tracker.active, tracker.now), [tracker.data, tracker.active, tracker.now]);
  const dueSoon = useMemo(() => dueSoonCount(tracker.active, tracker.now, tracker.data.settings.warningHours), [tracker.active, tracker.now, tracker.data.settings.warningHours]);
  const toggleActivities = useCallback(() => setExpanded(value => !value), []);
  const viewOverdue = useCallback(() => router.push({ pathname: '/(tabs)/withdrawals', params: { status: 'OVERDUE' } }), [router]);
  const viewDueSoon = useCallback(() => router.push({ pathname: '/(tabs)/withdrawals', params: { status: 'DUE SOON' } }), [router]);
  const viewInventory = useCallback(() => router.push('/(tabs)/inventory'), [router]);
  const silenceOverdue = audio.acknowledge;
  return { ...tracker, activities, dueSoon, alarmsSilenced: audio.pendingCount === 0, expanded, toggleActivities, viewOverdue, viewDueSoon, viewInventory, silenceOverdue };
}

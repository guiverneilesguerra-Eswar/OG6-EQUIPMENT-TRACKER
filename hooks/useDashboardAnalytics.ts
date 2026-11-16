import { useCallback,useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTracker } from './useTracker';
import { calculateAnalytics,defaultAnalyticsFilters } from '@/services/analytics';
export function useDashboardAnalytics(){const tracker=useTracker();const router=useRouter();const model=useMemo(()=>calculateAnalytics(tracker.data,defaultAnalyticsFilters(tracker.now),tracker.now),[tracker.data.assets,tracker.data.withdrawals,tracker.data.returnRecords,tracker.now]);const open=useCallback((status:string,period=false,returned=false,events=false)=>router.push({pathname:'/(tabs)/withdrawals',params:{status,...(status==='DUE SOON'?{warningHours:'24'}:{}),...(period?{from:model.filters.from,to:model.filters.to}:{}),...(returned?{returned:events?'events':'true'}:{})}}),[router,model.filters.from,model.filters.to]);return{...tracker,model,open};}

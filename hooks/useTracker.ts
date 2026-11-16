import { useContext,useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { TrackerContext } from '@/contexts/TrackerContext';
import { palettes } from '@/constants/theme';
import { assetStatus,isActive } from '@/services/tracker';
export function useTracker(){
 const value=useContext(TrackerContext);if(!value)throw new Error('useTracker must be used within TrackerProvider');const systemTheme=useColorScheme();const resolvedTheme=value.data.settings.theme==='system'?systemTheme==='light'?'light':'dark':value.data.settings.theme;const colors=palettes[resolvedTheme];
 const assets=useMemo(()=>value.data.assets.filter(a=>!a.archivedAt),[value.data.assets]);const active=useMemo(()=>value.data.withdrawals.filter(isActive),[value.data.withdrawals]);
 const stats=useMemo(()=>{const out=new Set(active.map(w=>w.assetId));return{total:assets.length,in:assets.filter(a=>!out.has(a.id)&&a.condition!=='Unserviceable'&&a.condition!=='Damage').length,out:assets.filter(a=>out.has(a.id)).length,overdue:assets.filter(a=>assetStatus(a.id,active,value.now)==='OVERDUE').length};},[assets,active,value.now]);
 return{...value,resolvedTheme,colors,assets,active,stats,canOperate:value.data.settings.role==='operator',status:(id:string)=>{const condition=value.data.assets.find(a=>a.id===id)?.condition;return condition==='Unserviceable'||condition==='Damage'?condition.toUpperCase():assetStatus(id,value.data.withdrawals,value.now);}};
}

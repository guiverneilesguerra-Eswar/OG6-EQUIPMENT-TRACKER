import { useCallback,useMemo,useRef,useState,useEffect } from 'react';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useTracker } from './useTracker';
import { calculateAnalytics,defaultAnalyticsFilters,periodRange } from '@/services/analytics';
import type { AnalyticsFilters,AnalyticsPeriod,ChartDatum } from '@/services/analytics';
import { analyticsPdf,exportAnalytics } from '@/services/analyticsExport';
import type { PdfOptions } from '@/constants/pdf';
export function useAnalytics(){const tracker=useTracker();const router=useRouter();const params=useLocalSearchParams<{from?:string;to?:string;status?:string}>();const[filters,setFilters]=useState<AnalyticsFilters>(()=>defaultAnalyticsFilters());const[filtersOpen,setFiltersOpen]=useState(false);const[reportKind,setReportKind]=useState('Analytics');const[exporting,setExporting]=useState(false);const[exportError,setExportError]=useState('');const[message,setMessage]=useState('');const lock=useRef(false);
 useEffect(()=>{if(params.from || params.to || params.status)setFilters(f=>({...f,period:params.from||params.to?'Custom':f.period,from:params.from||f.from,to:params.to||f.to,status:params.status||f.status}));},[params.from,params.to,params.status]);
 const result=useMemo(()=>{try{return{model:calculateAnalytics(tracker.data,filters,tracker.now),error:''};}catch(e){return{model:null,error:e instanceof Error?e.message:'Invalid reporting filters.'};}},[tracker.data.assets,tracker.data.withdrawals,tracker.data.returnRecords,tracker.now,filters]);
 const change=useCallback((patch:Partial<AnalyticsFilters>)=>setFilters(f=>({...f,...patch})),[]);
 const period=useCallback((value:string)=>{const p=value as AnalyticsPeriod;setFilters(f=>({...f,period:p,...(p==='Custom'?{}:periodRange(p,Date.now()))}));},[]);
 const openList=useCallback((status='ALL',extra:Record<string,string>={})=>{router.push({pathname:'/(tabs)/withdrawals',params:{status,...extra}});},[router]);
 const openInventory=useCallback((status='ALL')=>router.push({pathname:'/(tabs)/inventory',params:{status}}),[router]);
 const createPdf=useCallback(async(o:PdfOptions)=>{if(!tracker.canOperate)throw new Error('Personnel report export requires the operator workspace.');if(!result.model)throw new Error(result.error);const options={...o, ...(reportKind==='Inventory'?{transactions:false,charts:false}:{})};
  let model=result.model;
  if(reportKind==='Overdue') model=calculateAnalytics(tracker.data,{...filters,status:'OVERDUE'},tracker.now);
  if(reportKind==='Return') model={...model,withdrawals:[]};
  if(reportKind==='Withdrawal') model={...model,returns:[]};
  const file=await analyticsPdf(tracker.data,model,options);
  if(reportKind!=='Analytics') file.filename=`OG6_${reportKind==='Inventory'?'Equipment_Inventory':reportKind+'_Report'}_${new Date(tracker.now+8*3600000).toISOString().slice(0,10)}.pdf`;
  return file;},[tracker.canOperate,tracker.data,result,filters,tracker.now,reportKind]);
 const exportFile=useCallback(async(kind:'xlsx'|'csv')=>{if(lock.current)return;lock.current=true;setExporting(true);setExportError('');setMessage('');try{if(!tracker.canOperate)throw new Error('Personnel report export requires the operator workspace.');if(!result.model)throw new Error(result.error);setMessage(await exportAnalytics(tracker.data,result.model,kind));}catch(e){setExportError(e instanceof Error?e.message:'Export failed.');}finally{lock.current=false;setExporting(false);}},[tracker.data,tracker.canOperate,result]);
 const categories=useMemo(()=>Array.from(new Set(tracker.assets.map(a=>a.category||'Uncategorized'))).sort(),[tracker.assets]);
 return{...tracker,model:result.model,calculationError:result.error,filters,change,period,filtersOpen,setFiltersOpen,openList,openInventory,reportKind,setReportKind,createPdf,exportFile,exporting,exportError,message,categories};}
export function useChartSelection(data:ChartDatum[]){const[selected,setSelected]=useState('');const item=data.find(d=>(d.id||d.label)===selected)||null;return{selected,item,select:useCallback((d:ChartDatum)=>setSelected(d.id||d.label),[])};}

// These specifications are added for the project test runner; not executed by this editing session.
const source=(path:string)=>Deno.readTextFile(new URL(path,import.meta.url));
const check=(value:boolean,message:string)=>{if(!value)throw new Error(message);};
Deno.test('all receipt exports use save-location controls and analytics is integrated into existing tabs',async()=>{
 const[actions,reports,settings,dashboard,layout]=await Promise.all([source('../components/feature/ReceiptActions.tsx'),source('../app/(tabs)/reports.tsx'),source('../app/(tabs)/settings.tsx'),source('../components/feature/CommandDashboard.tsx'),source('../app/_layout.tsx')]);
 check(actions.includes('<PdfExportPanel'),'Existing receipts must offer location selection');
 check(reports.includes('<AnalyticsDashboard'),'Enhance existing Reports, not a separate app');
 check(settings.includes('<PushNotificationSettings'),'Push authorization belongs in existing Settings');
 check(dashboard.includes('<DashboardAnalytics'),'Integrate summaries in existing Home');
 check(layout.includes('<AlertProvider><SafeAreaProvider>'),'Retain mandatory outer alert provider');
});
Deno.test('PDF generation is prepared before picker clicks and not restarted by clock ticks',async()=>{
 const hook=await source('../hooks/usePdfExport.ts');
 check(hook.includes('factory.current(options)'),'Prepare actual PDF data');
 check(hook.includes('},[open,options])'),'Do not continuously reset PDF export on dashboard ticks');
 check(hook.includes('await savePdf(selected,location)'),'Use shared platform delivery service');
});
Deno.test('monthly return navigation includes partial events and due counters use the displayed window',async()=>{
 const[dashboard,filter,hook]=await Promise.all([source('../hooks/useDashboardAnalytics.ts'),source('../services/transactionFilters.ts'),source('../hooks/useMovementList.ts')]);
 check(dashboard.includes("returned:events?'events':'true'"),'Monthly returns need actual return event dates');
 check(filter.includes("filters.returned==='events'"),'Include partial return events in filtered lists');
 check(dashboard.includes("warningHours:'24'")&&hook.includes('params.warningHours'),'A 24-hour counter must open a 24-hour list');
});

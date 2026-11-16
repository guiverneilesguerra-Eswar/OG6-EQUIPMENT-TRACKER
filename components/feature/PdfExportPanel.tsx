import { memo } from 'react';
import { Platform,StyleSheet,Text,View } from 'react-native';
import { FormModal } from '@/components/ui/FormModal';
import { Button,Chips,ErrorText,Field } from '@/components/ui/Controls';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useTracker } from '@/hooks/useTracker';
import type { ReceiptFile } from '@/services/receipts';
import type { PdfOptions } from '@/constants/pdf';
import { density,type,leading } from '@/constants/theme';
interface Props{createFile:(options:PdfOptions)=>Promise<ReceiptFile>;title:string;report?:boolean;disabled?:boolean}
export const PdfExportPanel=memo(function PdfExportPanel({createFile,title,report=false,disabled=false}:Props){const m=usePdfExport(createFile,title);const{colors:c}=useTracker();const o=m.options;return <View style={styles.panel}>
 <Button title="Export PDF – save location" secondary icon="download-outline" onPress={()=>m.setOpen(true)} disabled={disabled}/>
 <FormModal visible={m.open} title="PDF EXPORT & SAVE LOCATION" onClose={()=>{if(!m.busy)m.setOpen(false);}} busyOverride={m.busy}>
 <Field label="Report title" value={o.title} onChangeText={v=>m.change({title:v})} editable={!m.busy}/><Field label="Filename (optional – generated if blank)" value={m.filename} onChangeText={m.setFilename} editable={!m.busy}/>
 <Text style={[styles.label,{color:c.subtle}]}>PAPER & ORIENTATION</Text><Chips options={['A4','Letter']} selected={o.paper} onSelect={v=>m.change({paper:v as PdfOptions['paper']})}/><Chips options={['Portrait','Landscape']} selected={o.orientation} onSelect={v=>m.change({orientation:v as PdfOptions['orientation']})}/>
 <Chips options={['LOGO ON','LOGO OFF']} selected={o.logo?'LOGO ON':'LOGO OFF'} onSelect={v=>m.change({logo:v==='LOGO ON'})}/><Chips options={['TIMESTAMP ON','TIMESTAMP OFF']} selected={o.generated?'TIMESTAMP ON':'TIMESTAMP OFF'} onSelect={v=>m.change({generated:v==='TIMESTAMP ON'})}/><Chips options={['PAGE NUMBERS ON','PAGE NUMBERS OFF']} selected={o.pageNumbers?'PAGE NUMBERS ON':'PAGE NUMBERS OFF'} onSelect={v=>m.change({pageNumbers:v==='PAGE NUMBERS ON'})}/>
 <Chips options={['SIGNATURES ON','SIGNATURES OFF']} selected={o.signatures?'SIGNATURES ON':'SIGNATURES OFF'} onSelect={v=>m.change({signatures:v==='SIGNATURES ON'})}/>
 {report?<><Text style={[styles.label,{color:c.subtle}]}>INCLUDED REPORT SECTIONS</Text><Chips options={['SUMMARY ON','SUMMARY OFF']} selected={o.summary?'SUMMARY ON':'SUMMARY OFF'} onSelect={v=>m.change({summary:v==='SUMMARY ON'})}/><Chips options={['INVENTORY ON','INVENTORY OFF']} selected={o.inventory?'INVENTORY ON':'INVENTORY OFF'} onSelect={v=>m.change({inventory:v==='INVENTORY ON'})}/><Chips options={['TRANSACTIONS ON','TRANSACTIONS OFF']} selected={o.transactions?'TRANSACTIONS ON':'TRANSACTIONS OFF'} onSelect={v=>m.change({transactions:v==='TRANSACTIONS ON'})}/><Chips options={['CHARTS ON','CHARTS OFF']} selected={o.charts?'CHARTS ON':'CHARTS OFF'} onSelect={v=>m.change({charts:v==='CHARTS ON'})}/></>:null}
 <Button title="Preview PDF before saving" secondary icon="eye-outline" onPress={()=>void m.run('preview')} disabled={m.busy}/><Button title="Choose save location" icon="folder-open-outline" onPress={()=>void m.run('choose')} loading={m.busy}/><Button title="Device Downloads" secondary icon="download-outline" onPress={()=>void m.run('downloads')} disabled={m.busy}/>
 <Text style={[styles.help,{color:c.subtle}]}>{Platform.OS==='ios'?'iOS opens Files/share. Select Save to Files; final save completion cannot be observed.':Platform.OS==='android'?'Android asks for folder authorization. Downloads preselects Download where supported; select the destination you want.':'Supported browsers offer a folder/filename picker. Others request a browser download; folder and completion are controlled by the browser.'}</Text>
 {m.preparing?<Text style={[styles.help,{color:c.subtle}]}>Preparing the selected PDF layout…</Text>:null}<ErrorText message={m.error}/>{m.message?<Text accessibilityRole="alert" style={[styles.help,{color:c.primary}]}>{m.message}</Text>:null}
 </FormModal></View>;});
const styles=StyleSheet.create({panel:{marginTop:density.sectionGap},label:{fontSize:type.body,fontWeight:'700',lineHeight:leading.body},help:{fontSize:type.body,lineHeight:leading.body,marginTop:density.sectionGap}});

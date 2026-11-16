import { useCallback,useEffect,useState,useRef } from 'react';
import { defaultPdfOptions } from '@/constants/pdf';
import type { PdfOptions } from '@/constants/pdf';
import type { ReceiptFile } from '@/services/receipts';
import { previewPdf,savePdf } from '@/services/pdfFiles';
import type { PdfSaveLocation } from '@/services/pdfFiles';
export function usePdfExport(createFile:(options:PdfOptions)=>Promise<ReceiptFile>,title:string){
 const[open,setOpen]=useState(false);const[options,setOptions]=useState<PdfOptions>({...defaultPdfOptions,title});const[filename,setFilename]=useState('');const[busy,setBusy]=useState(false);const[preparing,setPreparing]=useState(false);const[readyFile,setReadyFile]=useState<ReceiptFile|null>(null);const[error,setError]=useState('');const[message,setMessage]=useState('');const lock=useRef(false);const factory=useRef(createFile);
 useEffect(()=>{factory.current=createFile;},[createFile]);
 useEffect(()=>{setOptions(o=>o.title===title?o:{...o,title});},[title]);
 // Freeze an export snapshot on opening/options changes, not every dashboard clock tick.
 useEffect(()=>{if(!open)return;let active=true;setPreparing(true);setReadyFile(null);setError('');void factory.current(options).then(file=>{if(active)setReadyFile(file);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'PDF generation failed.');}).finally(()=>{if(active)setPreparing(false);});return()=>{active=false;};},[open,options]);
 const change=useCallback((patch:Partial<PdfOptions>)=>{if(!lock.current){setOptions(o=>({...o,...patch}));setMessage('');}},[]);
 const run=useCallback(async(location:PdfSaveLocation|'preview')=>{if(lock.current||!readyFile)return;lock.current=true;setBusy(true);setError('');setMessage('');try{if(filename.trim().length>180)throw new Error('Filename must be at most 180 characters.');const safeName=filename.trim()?filename.trim().replace(/[^a-zA-Z0-9_.-]/g,'_').replace(/\.pdf$/i,'')+'.pdf':readyFile.filename;const selected={...readyFile,filename:safeName};setMessage(location==='preview'?await previewPdf(selected):await savePdf(selected,location));}catch(e){setError(e instanceof Error?e.message:'Unable to save PDF.');}finally{lock.current=false;setBusy(false);}},[readyFile,filename]);
 return{open,setOpen,options,change,filename,setFilename,busy:busy||preparing,preparing,error,message,run};
}

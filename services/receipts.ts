import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import type { Asset,Withdrawal,TrackerData } from './tracker';
import { emptyData } from './tracker';
import { createTransactionReceipt } from './transactionReceipts';
import { cachePdf,savePdf } from './pdfFiles';
import type { PdfOptions } from '@/constants/pdf';
export type ReceiptKind='withdrawal'|'return';
export interface ReceiptFile{filename:string;bytes:Uint8Array;base64:string}
export type ReceiptDelivery='downloaded'|'saved'|'share-sheet'|'shared'|'cancelled'|'download-fallback';
export async function createReceipt(asset:Asset,withdrawal:Withdrawal,kind:ReceiptKind,data?:TrackerData,returnReference?:string,options?:PdfOptions):Promise<ReceiptFile>{
 if(withdrawal.assetId!==asset.id)throw new Error('Receipt equipment does not match this transaction.');
 const model=data || {...emptyData(),assets:[asset],withdrawals:[{...withdrawal,batchId:undefined}]};
 return createTransactionReceipt(model,withdrawal,kind,returnReference,options);
}
// Retained API now routes through platform file controls, not inaccessible app-private documents.
export async function downloadReceipt(file:ReceiptFile):Promise<ReceiptDelivery>{const outcome=await savePdf(file,'downloads');if(outcome.toLowerCase().includes('cancelled'))return'cancelled';return Platform.OS==='ios'?'share-sheet':Platform.OS==='web'?'downloaded':'saved';}
export async function shareReceipt(file:ReceiptFile):Promise<ReceiptDelivery>{
 if(Platform.OS==='web'){
  if(typeof navigator==='undefined')throw new Error('Sharing unavailable.');
  const browser=navigator as Navigator & {canShare?:(data:{files:File[]})=>boolean;share?:(data:{files:File[];title:string})=>Promise<void>};
  const pdf=new File([new Uint8Array(file.bytes).buffer],file.filename,{type:'application/pdf'});
  if(browser.share && browser.canShare?.({files:[pdf]})){try{await browser.share({files:[pdf],title:'OG6 Equipment Receipt'});return'shared';}catch(e){if(e instanceof Error && e.name==='AbortError')return'cancelled';throw new Error('Unable to share PDF. Use Export PDF to save first.');}}
  await savePdf(file,'downloads');return'download-fallback';
 }
 if(!await Sharing.isAvailableAsync())throw new Error('File sharing unavailable on this device.');
 await Sharing.shareAsync(await cachePdf(file),{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Share OG6 PDF'});return'share-sheet';
}

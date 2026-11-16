import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getRandomBytesAsync, randomUUID } from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { remainingQuantity } from './movements';
import type { TrackerData } from './tracker';
import type { ReminderLoan, ReminderPreferences } from '../supabase/functions/_shared/reminderPolicy';
export interface PushPreferences { enabled: boolean; advance: boolean; daily: boolean; sound: 'default' | 'silent' }
export interface PushRegistration { deviceId: string; deviceToken: string; platform: 'web' | 'native' }
const registrationKey='og6.push.capability.v1';
const pendingKey='og6.push.pending.v1';
export async function pushCall(body: object) {
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 let result;
 try { result=await getSupabaseClient().functions.invoke('og6-push-device',{body,signal:controller.signal}); }
 finally { clearTimeout(timeout); }
 const {data,error}=result;
 if(error) { let message='Notification server unavailable. Retry when connected.';if(error instanceof FunctionsHttpError)try{const b=JSON.parse(await error.context.text());if(typeof b.error==='string')message=b.error;}catch{}throw new Error(message); }
 if(data?.error)throw new Error(data.error);return data;
}
export async function loadPushRegistration():Promise<PushRegistration|null> {
 let raw:string|null;
 if(Platform.OS==='web')raw=await AsyncStorage.getItem(registrationKey);
 else {const secure=await import('expo-secure-store');raw=await secure.getItemAsync(registrationKey);}
 if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}
}
async function storeRegistration(reg:PushRegistration) {
 if(Platform.OS==='web')await AsyncStorage.setItem(registrationKey,JSON.stringify(reg));
 else {const secure=await import('expo-secure-store');await secure.setItemAsync(registrationKey,JSON.stringify(reg));}
}
export function reminderSnapshot(data:TrackerData):ReminderLoan[] {
 const assets=new Map(data.assets.map(a=>[a.id,a]));
 return data.withdrawals.filter(w=>remainingQuantity(w)>0 && !assets.get(w.assetId)?.archivedAt).map(w=>({id:w.id,assetId:w.assetId,name:w.equipmentSnapshot?.name || assets.get(w.assetId)?.name || 'Equipment',receiver:w.receiver,releaser:w.releaser,withdrawalAt:w.withdrawalAt,dueAt:w.dueAt,reference:w.reference || w.id,quantity:remainingQuantity(w)}));
}
export function pushPreferences(data:TrackerData):ReminderPreferences {
 return {enabled:data.settings.enabled && data.settings.backgroundNotifications===true,advance:data.settings.advanceReminders!==false,daily:data.settings.dailyReminders!==false,warningHours:data.settings.warningHours,sound:data.settings.pushSound || 'default'};
}
export async function requestPushDestination() {
 if(Platform.OS==='web') {
  if(typeof navigator==='undefined' || typeof window==='undefined' || !window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window))throw new Error('Desktop push requires a supported secure published browser. Live Preview may block service workers.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Browser notification permission was not granted.');
  const config=await pushCall({action:'public-config'});if(!config.publicKey)throw new Error('Web Push VAPID configuration is unavailable.');
  const registration=await navigator.serviceWorker.register('/og6-push-sw.js',{scope:'/'});
  await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();
  const key=String(config.publicKey).replace(/-/g,'+').replace(/_/g,'/');const binary=atob(key+'='.repeat((4-key.length%4)%4));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const subscription=existing || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  return {platform:'web' as const,subscription:subscription.toJSON()};
 }
 const Constants=(await import('expo-constants')).default;
 if(Constants.appOwnership==='expo')throw new Error('Mobile remote push requires an installed development or release build, not Expo Go.');
 const n=await import('expo-notifications');
 if(Platform.OS==='android') {
  await n.setNotificationChannelAsync('og6-reminders',{name:'OG6 reminders',importance:n.AndroidImportance.HIGH,sound:'default'});
  await n.setNotificationChannelAsync('og6-silent',{name:'OG6 silent reminders',importance:n.AndroidImportance.DEFAULT,sound:null});
 }
 const permission=await n.requestPermissionsAsync();if(permission.status!=='granted')throw new Error('Mobile notification permission was not granted.');
 const projectId=Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
 if(!projectId)throw new Error('Set the Expo EAS project ID and configure FCM/APNs credentials in the build before mobile push registration.');
 const token=(await n.getExpoPushTokenAsync({projectId})).data;
 return {platform:'native' as const,token};
}
export async function registerPush(data:TrackerData,password:string) {
 const destination=await requestPushDestination();
 const existing=await loadPushRegistration();const bytes=await getRandomBytesAsync(32);
 const registration:PushRegistration=existing || {deviceId:randomUUID(),deviceToken:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),platform:destination.platform};
 await pushCall({action:'register',...registration,destination,password,snapshot:reminderSnapshot(data),preferences:pushPreferences(data),revision:Date.now()});
 await storeRegistration(registration);return registration;
}
let sequence:Promise<void>=Promise.resolve();let lastRevision=0;
export function synchronizePush(data:TrackerData):Promise<void> {
 const snapshot=reminderSnapshot(data);const preferences=pushPreferences(data);const revision=Math.max(Date.now(),lastRevision+1);lastRevision=revision;
 const task=async()=>{
  const registration=await loadPushRegistration();if(!registration)return;
  await AsyncStorage.setItem(pendingKey,'1');
  await pushCall({action:'sync',...registration,snapshot,preferences,revision});
  await AsyncStorage.removeItem(pendingKey);
 };
 const result=sequence.catch(()=>{}).then(task);sequence=result;return result;
}
export async function pushHasPendingSync(){return await AsyncStorage.getItem(pendingKey)==='1';}
export async function testPush(){const reg=await loadPushRegistration();if(!reg)throw new Error('Authorize and register this device first.');await pushCall({action:'test',...reg});return 'Push provider accepted the test. Confirm receipt on this device; delivery is not yet verified.';}
export async function pushStatus(){const reg=await loadPushRegistration();return reg?pushCall({action:'status',...reg}):null;}

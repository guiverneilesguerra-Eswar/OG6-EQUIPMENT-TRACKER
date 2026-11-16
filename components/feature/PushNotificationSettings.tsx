import { memo } from 'react';
import { Platform,StyleSheet,Text,View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button,Card,Chips,ErrorText,Field } from '@/components/ui/Controls';
import { density,type,leading } from '@/constants/theme';
interface Props{}
export const PushNotificationSettings=memo(function PushNotificationSettings(_props:Props){const m=usePushNotifications();const c=m.colors;const s=m.data.settings;return <Card style={styles.card}>
 <View style={styles.heading}><Ionicons name="notifications-outline" size={24} color={c.primary}/><Text style={[styles.title,{color:c.text}]}>BACKGROUND NOTIFICATIONS</Text></View>
 <Text style={[styles.body,{color:c.subtle}]}>Opt-in server reminders: upcoming due, due today, overdue, and daily overdue until a completed return reaches the server. Only active loan details and delivery registration are synchronized; signatures and backups never leave this device.</Text>
 <Text style={[styles.body,{color:c.warning}]}>External scheduler required (every minute). Delivery timing depends on the OS, connectivity and notification permissions. Android force-stop prevents delivery until reopened. Mobile push needs an installed EAS build with FCM/APNs. Desktop push requires a supported published secure browser, not the preview iframe.</Text>
 {m.canOperate?<>
 <Field label="Administrator password – authorize device" secure value={m.password} onChangeText={m.setPassword} editable={!m.busy}/>
 <Button title={Platform.OS==='web'?'Authorize desktop push':'Authorize mobile push'} icon="shield-checkmark-outline" onPress={()=>void m.register()} loading={m.busy}/>
 <Text style={[styles.body,{color:c.subtle}]}>Registration: {m.registered?'AUTHORIZED DEVICE':'NOT REGISTERED'} · API private keys remain server-side. Browser registration receives only the non-secret VAPID public key.</Text>
 <Chips options={['BACKGROUND ON','BACKGROUND OFF']} selected={s.backgroundNotifications?'BACKGROUND ON':'BACKGROUND OFF'} onSelect={v=>{if(!m.busy)void m.save({backgroundNotifications:v==='BACKGROUND ON'});}}/>
 <Text style={[styles.body,{color:c.subtle}]}>Advance reminders</Text><Chips options={['ADVANCE ON','ADVANCE OFF']} selected={s.advanceReminders!==false?'ADVANCE ON':'ADVANCE OFF'} onSelect={v=>{if(!m.busy)void m.save({advanceReminders:v==='ADVANCE ON'});}}/>
 <Chips options={['12 HOURS','24 HOURS','48 HOURS']} selected={`${s.warningHours} HOURS`} onSelect={v=>{if(!m.busy)void m.save({warningHours:parseInt(v,10)});}}/>
 <Chips options={['DAILY ON','DAILY OFF']} selected={s.dailyReminders!==false?'DAILY ON':'DAILY OFF'} onSelect={v=>{if(!m.busy)void m.save({dailyReminders:v==='DAILY ON'});}}/>
 <Chips options={['SYSTEM SOUND','SILENT']} selected={s.pushSound==='silent'?'SILENT':'SYSTEM SOUND'} onSelect={v=>{if(!m.busy)void m.save({pushSound:v==='SILENT'?'silent':'default'});}}/>
 <Text style={[styles.body,{color:c.subtle}]}>Uploaded in-app audio remains separate. Background push uses OS sound or silent mode; custom uploaded files cannot be played by a closed app.</Text>
 <Button title="Test server push delivery" secondary onPress={()=>void m.test()} disabled={!m.registered || m.busy}/><Button title="Sync & check dispatcher" secondary onPress={()=>void m.check()} disabled={!m.registered || m.busy}/>
 </>:<Text style={[styles.body,{color:c.subtle}]}>Background notification configuration requires the operator workspace and administrator-authorized registration.</Text>}
 <ErrorText message={m.error}/><ErrorText message={m.pushSyncError}/>{m.message?<Text accessibilityRole="alert" style={[styles.body,{color:c.primary}]}>{m.message}</Text>:null}
 </Card>;});
const styles=StyleSheet.create({card:{marginTop:density.cardGap,gap:density.sectionGap},heading:{flexDirection:'row',alignItems:'center',gap:density.iconGap},title:{flex:1,fontSize:type.label,fontWeight:'700',lineHeight:leading.label},body:{fontSize:type.body,lineHeight:leading.body}});

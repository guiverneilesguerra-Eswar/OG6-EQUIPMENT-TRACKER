import webpush from 'npm:web-push@3.6.7';
export interface Destination { platform: 'web' | 'native'; token?: string; subscription?: { endpoint: string; keys: { p256dh: string; auth: string } } }
export function validDestination(value: Destination): boolean {
 if (value?.platform === 'native') return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(value.token || '');
 try {
  const url = new URL(value.subscription?.endpoint || '');
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-par02p.notify.windows.com'];
  const trusted = allowed.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.push.apple.com');
  return value.platform === 'web' && url.protocol === 'https:' && !url.port && !url.username && !url.password && trusted && /^[A-Za-z0-9_-]{80,120}$/.test(value.subscription?.keys?.p256dh || '') && /^[A-Za-z0-9_-]{20,32}$/.test(value.subscription?.keys?.auth || '');
 } catch { return false; }
}
export async function sendPush(destination: Destination, payload: { title: string; body: string; data: object }, sound: 'default' | 'silent') {
 if (!validDestination(destination)) throw new Error('Invalid notification destination.');
 if (destination.platform === 'native') {
  const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) }, body: JSON.stringify({ to: destination.token, ...payload, sound: sound === 'silent' ? null : 'default', channelId: sound === 'silent' ? 'og6-silent' : 'og6-reminders', priority: 'high', ttl: 60 }) });
  const body = await res.json(); const ticket = body.data;
  if (!res.ok || ticket?.status !== 'ok') throw new Error(ticket?.details?.error || 'Expo push submission failed.');
  return { state: 'accepted', detail: ticket.id || 'Expo accepted' };
 }
 const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY'); const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
 if (!publicKey || !privateKey) throw new Error('Web Push is not configured.');
 await webpush.sendNotification(destination.subscription, JSON.stringify({ ...payload, silent: sound === 'silent', tag: (payload.data as { eventKey?: string }).eventKey }), { vapidDetails: { publicKey, privateKey, subject: 'mailto:contact@onspace.ai' }, TTL: 60, urgency: 'high', timeout: 10000 });
 return { state: 'accepted', detail: 'Web push service accepted' };
}

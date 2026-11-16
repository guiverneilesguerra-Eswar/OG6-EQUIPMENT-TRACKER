export interface ReminderLoan { id: string; assetId: string; name: string; receiver: string; releaser: string; withdrawalAt: string; dueAt: string; reference: string; quantity: number }
export interface ReminderPreferences { enabled: boolean; advance: boolean; warningHours: number; daily: boolean; sound: 'default' | 'silent' }
export interface ReminderEvent { key: string; kind: string; at: number; loan: ReminderLoan; overdueDays: number }
export const dayMillis = 86400000;
export function phtDate(at: number) { return new Date(at + 8 * 3600000).toISOString().slice(0, 10); }
export function reminderEvents(loans: ReminderLoan[], p: ReminderPreferences, now: number): ReminderEvent[] {
 if (!p.enabled) return [];
 const result: ReminderEvent[] = [];
 for (const loan of loans) {
  const due = Date.parse(loan.dueAt); if (!Number.isFinite(due) || loan.quantity <= 0) continue;
  const todayStart = Date.parse(`${phtDate(due)}T00:00:00+08:00`);
  const days = Math.max(0, Math.floor((now - due) / dayMillis));
  let kind = ''; let at = due; let suffix = '';
  if (now >= due) {
   result.push({ key: `${loan.id}:${loan.dueAt}:OVERDUE:`, kind: 'OVERDUE', at: due, loan, overdueDays: days });
   if (days >= 1 && p.daily) { kind = 'DAILY OVERDUE'; at = due + days * dayMillis; suffix = String(days); }
  }
  else if (now >= todayStart) { kind = 'DUE TODAY'; at = todayStart; }
  else if (p.advance && now >= due - p.warningHours * 3600000) { kind = 'UPCOMING DUE'; at = due - p.warningHours * 3600000; }
  if (kind) result.push({ key: `${loan.id}:${loan.dueAt}:${kind}:${suffix}`, kind, at, loan, overdueDays: days });
 }
 return result;
}
export function reminderContent(event: ReminderEvent) {
 const w = event.loan;
 const formatted = (at: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at)) + ' PHT';
 return { title: `OG6 EQUIPMENT TRACKER – ${event.kind} ALERT`, body: `Equipment: ${w.name}\nAsset ID: ${w.assetId}\nReceiver: ${w.receiver}\nReleaser: ${w.releaser}\nWithdrawal: ${formatted(w.withdrawalAt)}\nExpected return: ${formatted(w.dueAt)}\nOverdue days: ${event.overdueDays}\nReference: ${w.reference}\nOutstanding units: ${w.quantity}\n${event.kind.includes('OVERDUE') ? 'Please coordinate the immediate return of this equipment.' : 'Please coordinate the scheduled return.'}`, data: { status: event.kind.includes('OVERDUE') ? 'OVERDUE' : event.kind === 'DUE TODAY' ? 'DUE TODAY' : 'DUE SOON', withdrawalId: w.id, eventKey: event.key } };
}

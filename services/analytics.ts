
import type { Asset, TrackerData, Withdrawal } from './tracker';
import { isActive, manilaParts } from './recordDates';
import { remainingQuantity, assetCapacity } from './movements';
import type { ReturnRecord } from './movements';
export type AnalyticsPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom';
export interface AnalyticsFilters {
    period: AnalyticsPeriod;
    from: string;
    to: string;
    category: string;
    equipment: string;
    receiver: string;
    releaser: string;
    status: string;
}
export interface ChartDatum {
    label: string;
    value: number;
    id?: string;
    second?: number;
}
const day = 86400000;
export function periodRange(period: AnalyticsPeriod, now: number) {
    const today = manilaParts(new Date(now)).date;
    const d = new Date(`${today}T00:00:00Z`);
    if (period === 'Weekly') {
        const weekday = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - weekday);
    }
    else if (period === 'Monthly')
        d.setUTCDate(1);
    else if (period === 'Quarterly') {
        d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3, 1);
    }
    else if (period === 'Yearly')
        d.setUTCMonth(0, 1);
    return { from: d.toISOString().slice(0, 10), to: today };
}
export function defaultAnalyticsFilters(now = Date.now()): AnalyticsFilters {
    return { period: 'Monthly', ...periodRange('Monthly', now), category: '', equipment: '', receiver: '', releaser: '', status: 'ALL' };
}
export function validateAnalyticsFilters(f: AnalyticsFilters) {
    for (const v of [f.from, f.to])
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)
            throw new Error('Use valid reporting dates (YYYY-MM-DD).');
    if (f.from > f.to)
        throw new Error('Reporting end date must not precede the start date.');
    if ((Date.parse(f.to) - Date.parse(f.from)) / day > 3653)
        throw new Error('Choose a reporting range of ten years or less.');
}
export function analyticsStatus(w: Withdrawal, now: number) {
    if (w.deletedAt)
        return 'ARCHIVED';
    if (w.returnedAt)
        return 'RETURNED';
    if (!isActive(w))
        return 'RETURNED';
    if (Date.parse(w.dueAt) <= now)
        return 'OVERDUE';
    if (manilaParts(w.dueAt).date === manilaParts(new Date(now)).date)
        return 'DUE TODAY';
    if (Date.parse(w.dueAt) - now <= day)
        return 'DUE SOON';
    return 'OUT';
}
export function allReturnEvents(data: TrackerData): ReturnRecord[] {
    const recorded = data.returnRecords || [];
    const withEvents = new Set(recorded.map(r => r.withdrawalId));
    return [...recorded, ...data.withdrawals.filter(w => w.returnedAt && !withEvents.has(w.id)).map(w => ({ id: `legacy-${w.id}`, reference: `legacy-${w.id}`, withdrawalId: w.id, assetId: w.assetId, quantity: w.returnedQuantity ?? w.quantity ?? 1, at: w.returnedAt!, returning: w.returning || '', receiving: w.receiving || '', condition: w.condition || 'Not recorded', remarks: w.remarks || '', returnSignature: w.returnSignature, receivingSignature: w.receivingSignature }))];
}
function rank(entries: {
    label: string;
    id?: string;
    value: number;
}[]): ChartDatum[] {
    const map = new Map<string, ChartDatum>();
    for (const x of entries) {
        const key = x.id || x.label;
        const row = map.get(key) || { label: x.label, id: x.id, value: 0 };
        row.value += x.value;
        map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
const uniqueCount = (rows: Withdrawal[]) => new Set(rows.map(w => w.reference || w.batchId || w.id)).size;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function calculateAnalytics(data: TrackerData, f: AnalyticsFilters, now = Date.now()) {
    validateAnalyticsFilters(f);
    const allAssets = new Map(data.assets.map(a => [a.id, a]));
    const inPeriod = (at: string) => {
        const date = manilaParts(at).date;
        return date >= f.from && date <= f.to;
    };
    const assetMatch = (a: Asset) => !a.archivedAt && (!f.category || (a.category || 'Uncategorized') === f.category) && (!f.equipment || a.id === f.equipment || a.name.toLowerCase().includes(f.equipment.toLowerCase()));
    const assets = data.assets.filter(assetMatch);
    const ids = new Set(assets.map(a => a.id));
    const scope = data.withdrawals.filter(w => !w.deletedAt && ids.has(w.assetId) && (!f.receiver || w.receiver.toLowerCase().includes(f.receiver.toLowerCase())) && (!f.releaser || w.releaser.toLowerCase().includes(f.releaser.toLowerCase())));
    const matchesStatus = (w: Withdrawal) => f.status === 'ALL' || (f.status === 'ACTIVE' && isActive(w)) || analyticsStatus(w, now) === f.status;
    const scoped = scope.filter(matchesStatus);
    const withdrawals = scoped.filter(w => inPeriod(w.withdrawalAt));
    const wMap = new Map(scoped.map(w => [w.id, w]));
    const returns = allReturnEvents(data).filter(r => wMap.has(r.withdrawalId) && inPeriod(r.at));
    const active = scope.filter(isActive);
    const overdue = active.filter(w => Date.parse(w.dueAt) <= now);
    const dueToday = active.filter(w => Date.parse(w.dueAt) > now && manilaParts(w.dueAt).date === manilaParts(new Date(now)).date);
    const upcoming = active.filter(w => Date.parse(w.dueAt) > now && Date.parse(w.dueAt) - now <= day);
    const outIds = new Set(active.map(w => w.assetId));
    const unavailable = assets.filter(a => !outIds.has(a.id) && (a.condition === 'Unserviceable' || a.condition === 'Damage'));
    const available = assets.filter(a => !outIds.has(a.id) && a.condition !== 'Unserviceable' && a.condition !== 'Damage');
    const completed = scoped.filter(w => w.returnedAt && inPeriod(w.returnedAt));
    const onTime = completed.filter(w => Date.parse(w.returnedAt!) <= Date.parse(w.dueAt));
    const transactions = new Map<string, Withdrawal[]>();
    for (const w of withdrawals) {
        const key = w.reference || w.batchId || w.id;
        transactions.set(key, [...(transactions.get(key) || []), w]);
    }
    const completedTransactions = [...transactions.values()].filter(group => {
        const ref = group[0].reference || group[0].batchId || group[0].id;
        return scope.filter(w => (w.reference || w.batchId || w.id) === ref).every(w => !!w.returnedAt);
    }).length;
    const totalWithdrawals = transactions.size;
    const totalReturns = new Set(returns.map(r => r.reference)).size;
    const utilization = assets.length ? outIds.size / assets.length * 100 : 0;
    const compliance = completed.length ? onTime.length / completed.length * 100 : 0;
    const monthly = new Map<string, {
        withdraw: Set<string>;
        returns: Set<string>;
        overdue: number;
    }>();
    const first = new Date(`${f.from.slice(0, 7)}-01T00:00:00Z`);
    const last = f.to.slice(0, 7);
    while (first.toISOString().slice(0, 7) <= last) {
        monthly.set(first.toISOString().slice(0, 7), { withdraw: new Set(), returns: new Set(), overdue: 0 });
        first.setUTCMonth(first.getUTCMonth() + 1);
    }
    for (const w of withdrawals)
        monthly.get(manilaParts(w.withdrawalAt).date.slice(0, 7))?.withdraw.add(w.reference || w.id);
    for (const r of returns)
        monthly.get(manilaParts(r.at).date.slice(0, 7))?.returns.add(r.reference);
    for (const w of scoped) {
        // The original error was likely here, where the expression for the optional chain `monthly.get(...)?.overdue++`
        // was attempting to use the `++` operator directly on the result of the optional chain.
        // The optional chaining operator `?.` does not allow direct assignment or unary operations on its result.
        // To fix this, we need to get the object first, check if it exists, and then increment its property.
        // Or, more concisely, check if the optional chain result exists, and if so, perform the increment.
        const monthEntry = monthly.get(manilaParts(w.dueAt).date.slice(0, 7));
        if (monthEntry) { // Ensure monthEntry exists before incrementing
            if (w.returnedAt ? Date.parse(w.returnedAt) > Date.parse(w.dueAt) : Date.parse(w.dueAt) < now) {
                monthEntry.overdue++;
            }
        }
    }
    const trends: ChartDatum[] = [...monthly].map(([label, m]) => ({ label, value: m.withdraw.size, second: m.returns.size }));
    const frequency = rank(withdrawals.map(w => ({ id: w.assetId, label: w.equipmentSnapshot?.name || allAssets.get(w.assetId)?.name || 'Equipment', value: 1 })));
    const receivers = rank(withdrawals.map(w => ({ label: w.receiver, value: 1 })));
    const releasers = rank(withdrawals.map(w => ({ label: w.releaser, value: 1 })));
    const overdueByReceiver = rank(overdue.map(w => ({ label: w.receiver, value: remainingQuantity(w) })));
    const overdueByCategory = rank(overdue.map(w => ({ label: allAssets.get(w.assetId)?.category || 'Uncategorized', value: remainingQuantity(w) })));
    const longest = [...overdue].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0] || null;
    const grouped = (kind: 'day' | 'week' | 'month') => {
        const buckets = new Map<string, Set<string>>();
        for (const w of withdrawals) {
            const date = manilaParts(w.withdrawalAt).date;
            let key = date;
            if (kind === 'month')
                key = date.slice(0, 7);
            if (kind === 'week') {
                const d = new Date(`${date}T00:00:00Z`);
                d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
                key = d.toISOString().slice(0, 10);
            }
            const bucket = buckets.get(key) || new Set<string>();
            bucket.add(w.reference || w.id);
            buckets.set(key, bucket);
        }
        return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([label, refs]) => ({ label, value: refs.size }));
    };
    return { filters: f, assets, withdrawals, returns, active, overdue, dueToday, upcoming, completed, onTime, late: completed.length - onTime.length, totalEquipment: assets.length, totalQuantity: assets.reduce((s, a) => s + assetCapacity(a), 0), available: available.length, out: outIds.size, unserviceable: unavailable.length, unserviceableOnly: assets.filter(a => a.condition === 'Unserviceable').length, damaged: assets.filter(a => a.condition === 'Damage').length, outstandingUnits: active.reduce((s, w) => s + remainingQuantity(w), 0), overdueUnits: overdue.reduce((s, w) => s + remainingQuantity(w), 0), returnedUnits: returns.reduce((s, r) => s + r.quantity, 0), totalWithdrawals, totalReturns, totalTransactions: totalWithdrawals + totalReturns, completedTransactions, pendingTransactions: totalWithdrawals - completedTransactions, utilization, compliance, averageWithdrawalDays: mean(withdrawals.map(w => Math.max(0, (Date.parse(w.returnedAt || new Date(now).toISOString()) - Date.parse(w.withdrawalAt)) / day))), averageReturnDays: mean(completed.map(w => (Date.parse(w.returnedAt!) - Date.parse(w.withdrawalAt)) / day)), averageOverdueDays: mean(overdue.map(w => (now - Date.parse(w.dueAt)) / day)), longest, frequency, receivers, releasers, overdueByReceiver, overdueByCategory, trends, overdueMonths: [...monthly].map(([label, m]) => ({ label, value: m.overdue })), daily: grouped('day'), weekly: grouped('week'), monthly: grouped('month'), availability: [{ label: 'Available', value: available.length }, { label: 'OUT (not overdue)', value: Math.max(0, outIds.size - new Set(overdue.map(w => w.assetId)).size) }, { label: 'Overdue', value: new Set(overdue.map(w => w.assetId)).size }, { label: 'Unserviceable / Damage', value: unavailable.length }] as ChartDatum[] };
}
export type AnalyticsModel = ReturnType<typeof calculateAnalytics>;
export function analyticsSummary(m: AnalyticsModel): (string | number)[][] {
    return [['Reporting period', `${m.filters.from} to ${m.filters.to} (PHT)`], ['Total transactions', m.totalTransactions], ['Withdrawals (references)', m.totalWithdrawals], ['Return events (references)', m.totalReturns], ['Outstanding equipment records (snapshot)', m.out], ['Outstanding units (snapshot)', m.outstandingUnits], ['Overdue equipment records (snapshot)', m.overdue.length], ['Overdue units (snapshot)', m.overdueUnits], ['Equipment utilization (%)', Number(m.utilization.toFixed(2))], ['Return compliance (%)', Number(m.compliance.toFixed(2))], ['On-time completed equipment returns', m.onTime.length], ['Late completed equipment returns', m.late], ['Completed equipment returns', m.completed.length], ['Units returned in period', m.returnedUnits], ['Average completed return duration (days)', Number(m.averageReturnDays.toFixed(2))], ['Available inventory records', m.available], ['Unserviceable / Damage inventory records', m.unserviceable], ['Total inventory quantity', m.totalQuantity]];
}

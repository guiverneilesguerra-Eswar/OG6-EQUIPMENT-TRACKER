import { useMemo,useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { transactionListRows } from '@/services/transactionFilters';
import type { TransactionNavigationFilters } from '@/services/transactionFilters';
import type { useWithdrawals } from './useWithdrawals';
export function useMovementList(model:ReturnType<typeof useWithdrawals>){const params=useLocalSearchParams<TransactionNavigationFilters & {status?:string;warningHours?:string}>();useEffect(()=>{if(params.status==='OUT')model.setFilter('OUT');},[params.status]);return useMemo(()=>{const window=Number(params.warningHours);const hours=[12,24,48].includes(window)?window:model.data.settings.warningHours;return transactionListRows(model.data,params.status==='OUT'?'OUT':model.filter,model.query,model.now,hours,params);},[model.data.assets,model.data.withdrawals,model.data.returnRecords,model.filter,model.query,model.now,model.data.settings.warningHours,params.status,params.warningHours,params.from,params.to,params.receiver,params.equipment,params.returned]);}

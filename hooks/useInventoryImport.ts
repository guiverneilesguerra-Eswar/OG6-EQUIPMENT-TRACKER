import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useTracker } from './useTracker';
import { selectInventorySpreadsheet, readInventorySpreadsheet, saveSpreadsheet } from '@/services/spreadsheetFiles';
import { createInventoryTemplateWorkbook, createInventoryErrorWorkbook, inventoryWorkbookBytes, parseInventoryWorkbook } from '@/services/inventoryWorkbook';
import { InventoryImportPreview, InventoryImportResult, countInventoryRows, validateInventoryRows } from '@/services/inventoryImportValidation';

type ImportStage = 'idle' | 'selecting' | 'reading' | 'preview' | 'saving' | 'completed' | 'failed';
const pauseForPaint = () => new Promise<void>(resolve => setTimeout(resolve, 30));
export function useInventoryImport() {
  const tracker = useTracker(); const latest = useRef(tracker); latest.current = tracker;
  const mounted = useRef(true); const operation = useRef(false); const batchId = useRef('');
  const [stage, setStage] = useState<ImportStage>('idle');
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [result, setResult] = useState<InventoryImportResult | null>(null);
  const [progress, setProgress] = useState(0); const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState(''); const [toolbarError, setToolbarError] = useState(''); const [feedback, setFeedback] = useState('');
  const [exporting, setExporting] = useState<'template' | 'errors' | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const activePreview = useMemo(() => preview ? { ...preview, rows: validateInventoryRows(preview.rows, tracker.data.assets) } : null, [preview, tracker.data.assets]);
  const counts = useMemo(() => countInventoryRows(activePreview?.rows || []), [activePreview]);
  const isWorking = ['selecting', 'reading', 'saving'].includes(stage) || exporting !== null;
  const close = useCallback(() => { if (operation.current) return; setStage('idle'); setError(''); setPreview(null); setResult(null); batchId.current = ''; }, []);
  const start = useCallback(async () => {
    if (operation.current || latest.current.busy || !latest.current.loaded || !latest.current.canOperate) return;
    operation.current = true; setToolbarError(''); setFeedback(''); setError(''); setResult(null); setPreview(null); setStage('selecting'); setProgress(0.05); setProgressLabel('Select an Excel inventory file'); batchId.current = `IMP-${randomUUID()}`;
    try {
      // Keep this call directly in the press event chain for browser file-picker permissions.
      const file = await selectInventorySpreadsheet();
      if (!mounted.current) return;
      if (!file) { setStage('idle'); return; }
      setStage('reading'); setProgress(0.2); setProgressLabel('Reading selected .xlsx file'); await pauseForPaint();
      const bytes = await readInventorySpreadsheet(file);
      const parsed = await parseInventoryWorkbook(bytes, file.name.slice(0, 200), latest.current.data.assets, (fraction, label) => { if (mounted.current) { setProgress(fraction); setProgressLabel(label); } });
      if (mounted.current) { setPreview(parsed); setStage('preview'); }
    } catch (reason) { if (mounted.current) { setError(reason instanceof Error ? reason.message : 'Unable to read the Excel file. No records were changed.'); setStage('failed'); } }
    finally { operation.current = false; }
  }, []);
  const confirm = useCallback(async () => {
    if (operation.current || latest.current.busy || !activePreview || !counts.valid) return;
    operation.current = true; setError(''); setStage('saving'); setProgress(0.9); setProgressLabel('Saving inventory as one protected batch');
    try {
      await pauseForPaint();
      const saved = await latest.current.importInventory(activePreview, batchId.current);
      if (mounted.current) { setResult(saved); setProgress(1); setStage('completed'); }
    } catch (reason) { if (mounted.current) { setError(reason instanceof Error ? reason.message : 'Import could not be saved. No inventory changes were saved. Please retry.'); setStage('preview'); } }
    finally { operation.current = false; }
  }, [activePreview, counts.valid]);
  const downloadTemplate = useCallback(async () => {
    if (operation.current) return;
    operation.current = true; setExporting('template'); setToolbarError(''); setFeedback('');
    try { const filename = await saveSpreadsheet(await inventoryWorkbookBytes(createInventoryTemplateWorkbook()), 'OG6_Inventory_Import_Template.xlsx'); if (mounted.current) setFeedback(`Template ready: ${filename}`); }
    catch (reason) { if (mounted.current) setToolbarError(reason instanceof Error ? reason.message : 'Unable to download the inventory template.'); }
    finally { operation.current = false; if (mounted.current) setExporting(null); }
  }, []);
  const downloadErrors = useCallback(async () => {
    if (operation.current || !result) return;
    operation.current = true; setExporting('errors'); setError('');
    try { await saveSpreadsheet(await inventoryWorkbookBytes(createInventoryErrorWorkbook(result)), `OG6_Inventory_Import_Errors_${result.batchId}.xlsx`); }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Unable to download the error report. Your imported records remain saved.'); }
    finally { operation.current = false; if (mounted.current) setExporting(null); }
  }, [result]);
  const downloadPreviewErrors = useCallback(async () => {
    if (operation.current || !activePreview) return;
    operation.current = true; setExporting('errors'); setError('');
    try {
      const report: InventoryImportResult = { batchId: batchId.current, filename: activePreview.filename, at: new Date().toISOString(), imported: 0, duplicatesSkipped: counts.duplicate, invalidRows: counts.invalid, totalProcessed: counts.total, rows: activePreview.rows, alreadyCompleted: false };
      await saveSpreadsheet(await inventoryWorkbookBytes(createInventoryErrorWorkbook(report)), `OG6_Inventory_Validation_Errors_${batchId.current}.xlsx`);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Unable to download the validation report.'); }
    finally { operation.current = false; if (mounted.current) setExporting(null); }
  }, [activePreview, counts]);
  return { colors: tracker.colors, stage, visible: stage !== 'idle', preview: activePreview, result, counts, progress, progressLabel, error, toolbarError, feedback, exporting, isWorking, canImport: tracker.loaded && tracker.canOperate && !tracker.busy && !isWorking, trackerBusy: tracker.busy, close, start, confirm, downloadTemplate, downloadErrors, downloadPreviewErrors };
}

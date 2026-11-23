// Source safeguards complement pure stroke tests, not a claim of device testing.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('web pointer lifecycle captures pen/touch/mouse independently and never clears on lift or leave', async () => {
  const hook = await source('../hooks/useSignatureCanvas.ts');
  for (const event of ["'pointerdown'", "'pointermove'", "'pointerup'", "'pointercancel'", "'lostpointercapture'"]) check(hook.includes(event), `Missing lifecycle ${event}`);
  check(hook.includes('setPointerCapture(event.pointerId)') && hook.includes('getCoalescedEvents?.()'), 'Capture pointers and retain high-frequency pen samples');
  check(hook.includes("node.style.touchAction = 'none'") && hook.includes('event.preventDefault()'), 'Suppress browser scrolling only on the signature surface');
  check(!hook.includes("addEventListener('pointerleave'") && hook.includes('endSignatureStroke(session.current, id)'), 'Lift/leave cannot clear ink');
  check(hook.includes('ownUpdates.current.has(input.value)'), 'Stale parent echoes cannot overwrite finished ink');
  check(hook.includes('onPanResponderTerminationRequest: () => false') && hook.includes('onStartShouldSetPanResponderCapture: canDraw'), 'Native drawing owns touch/stylus gestures');
  check(hook.includes("removeEventListener('pointerup'") && hook.includes('cancelAnimationFrame'), 'Subscriptions and rendering frames must be cleaned up');
});
Deno.test('withdrawal and return signatures lock the form and expand without a second stroke store', async () => {
  const [form, hook, pad, modal] = await Promise.all([source('../components/feature/WithdrawalForms.tsx'), source('../hooks/useWithdrawals.ts'), source('../components/feature/SignaturePad.tsx'), source('../components/ui/FormModal.tsx')]);
  check((form.match(/expandable onInteractionChange={m.setSignatureInteractionLocked}/g) || []).length === 3, 'Withdrawal receiver and both return roles use the same expandable pad');
  check(form.includes('interactionLocked={m.signatureInteraction}') && modal.includes('scrollEnabled={!interactionLocked}'), 'Active ink disables form scrolling and closure');
  check(hook.includes('saving.current || signing.current || tracker.busy') && hook.includes('if (withdrawalDraftActive)'), 'Guard submission/closure and resume rather than reset closed drafts');
  check(pad.includes('title="Cancel"') && pad.includes('m.save(onSave)') && pad.includes('onRequestClose={m.toggleExpanded}'), 'Explicit Clear/Cancel/Save and safe device back');
  check(pad.includes('preserveAspectRatio="xMidYMid meet"') && !pad.includes('preserveAspectRatio="none"'), 'Expansion cannot stretch or reduce vector quality');
});
Deno.test('draft hydration precedes screens and stored acknowledgements remain in the original tracker', async () => {
  const [provider, root, drafts, hook, movements, backup] = await Promise.all([source('../contexts/SignatureDraftContext.tsx'), source('../app/_layout.tsx'), source('../services/signatureFormDrafts.ts'), source('../hooks/useWithdrawals.ts'), source('../services/movements.ts'), source('../services/backupValidation.ts')]);
  check(root.includes('<AlertProvider>') && root.includes('<SignatureDraftProvider>'), 'Keep mandatory providers and mount shared draft storage');
  check(provider.includes('ready ? children : null') && provider.includes('writable.current'), 'Do not overwrite a recovering/unreadable draft with empty defaults');
  check(drafts.includes('pendingWrite.catch(() => {}).then') && drafts.includes("'og6.signatureFormDrafts.v1'"), 'Ordered writes use a separate device-local key');
  check(hook.includes('useSignatureDrafts()') && hook.includes('wd?.signature || []') && hook.includes('rd?.receivingSignatureSaved || false'), 'Recover strokes and explicit save flags after a screen remount');
  check(movements.includes('signature: copyReturnSignature(input.signature)') && (backup.match(/releasingSignature: signature.optional\(\)/g) || []).length === 2, 'Independent vector snapshots and backup compatibility');
});

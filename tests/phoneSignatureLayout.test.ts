// Layout/source contracts complement physical portrait/landscape tests.
const source = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('expanded receiving signature keeps controls reachable on short landscape phones', async () => {
  const [pad, controller, theme] = await Promise.all([source('../components/feature/SignaturePad.tsx'), source('../hooks/useSignatureCanvas.ts'), source('../constants/theme.ts')]);
  check(pad.includes('useResponsive()') && pad.includes('compactExpanded = responsive.height < 450'), 'React to orientation and short viewports');
  check(pad.includes('compactExpanded ? styles.shortContent : null') && pad.includes('shortContent: { padding: spacing.sm'), 'Use compact landscape spacing');
  check(pad.includes('!compactExpanded ? <Text') && pad.includes('{controls(true)}') && !pad.includes('Back to return form'), 'Keep Clear/Cancel/Save reachable without redundant landscape controls');
  check(pad.includes('accessibilityLabel="Return to compact signature canvas"') && pad.includes('onRequestClose={m.toggleExpanded}'), 'Header contract and device back remain available in every orientation');
  check(pad.includes('{m.expanded ? <View') && pad.includes('largePad: { flex: 1'), 'Only the visible canvas measures its live bounds');
  check(controller.includes('Keyboard.dismiss()') && controller.includes('bounds.current ='), 'Keyboard dismissal and fresh bounds support the expanded surface');
  check(theme.includes('expandedMinHeight: 120') && theme.includes('controlHeight: 48'), 'Maintain drawable space and accessible control targets');
});

// Source-placement regression checks. These do not simulate device playback.
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
interface SourceFile { url: URL; content: string }
async function uiSources(directory: URL): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const url = new URL(`${entry.name}${entry.isDirectory ? '/' : ''}`, directory);
    if (entry.isDirectory) files.push(...await uiSources(url));
    else if (/\.tsx?$/.test(entry.name)) files.push({ url, content: await Deno.readTextFile(url) });
  }
  return files;
}
Deno.test('sound panels, sliders, uploads and reference action are mounted exclusively in SETTINGS', async () => {
  const settingsUrl = new URL('../app/(tabs)/settings.tsx', import.meta.url);
  const panelUrl = new URL('../components/feature/AlertSoundSettings.tsx', import.meta.url);
  const files = [...await uiSources(new URL('../app/', import.meta.url)), ...await uiSources(new URL('../components/', import.meta.url))];
  let panels = 0; let references = 0;
  for (const file of files) {
    if (/<AlertSoundSettings\b/.test(file.content)) {
      check(file.url.href === settingsUrl.href, `Sound panel mounted outside SETTINGS: ${file.url.pathname}`);
      panels += (file.content.match(/<AlertSoundSettings\b/g) || []).length;
    }
    if (/<VolumeControl\b|useAlertSoundUpload\(/.test(file.content)) {
      check(file.url.href === panelUrl.href, `Audio configuration outside Settings panel: ${file.url.pathname}`);
    }
    if (/m\.openReference/.test(file.content)) {
      check(file.url.href === settingsUrl.href, `Reference action outside SETTINGS: ${file.url.pathname}`);
      references += (file.content.match(/m\.openReference/g) || []).length;
    }
    check(!/upload reference sound/i.test(file.content), `Redundant shared-reference uploader: ${file.url.pathname}`);
  }
  check(panels === 2, 'SETTINGS must mount exactly two independent sound panels.');
  check(references === 1, 'SETTINGS must offer exactly one external reference action.');
  const settings = await Deno.readTextFile(settingsUrl);
  check(settings.includes('channel="notification"') && settings.includes('channel="alarm"'), 'Both independent sound channels must remain.');
});
Deno.test('shared alarm banner retains operational acknowledgement and countdown without configuration buttons', async () => {
  const banner = await Deno.readTextFile(new URL('../components/feature/AlarmStatus.tsx', import.meta.url));
  check(banner.includes('m.acknowledge()'), 'Operational STOP ALARM / ACKNOWLEDGE must remain.');
  check(banner.includes('m.countdown.label'), 'The existing overdue countdown must remain.');
  check(banner.includes('!loaded || !overdue'), 'A sound-setup-only banner must not appear on other tabs.');
  check(!/useRouter|router\.push|<VolumeControl|<AlertSoundSettings|openReference|useAlertSoundUpload|Open sound settings/.test(banner), 'Shared banner must not expose audio configuration.');
});
Deno.test('opening the reference does not replace selected files, save preferences or stop app audio', async () => {
  const hook = await Deno.readTextFile(new URL('../hooks/useSettings.ts', import.meta.url));
  const callback = hook.split('const openReference = useCallback')[1]?.split('}, []);')[0] || '';
  check(callback.includes('await openAlertSoundReference()'), 'The original reference action must be connected.');
  check(callback.includes('catch'), 'Reference-opening failures must provide feedback.');
  check(!/updateSettings|configureAlertAudio|stopSound|playAlert|setPlaybackVolume|audioSelectionPatch/.test(callback), 'Opening a reference must not change active audio or preferences.');
});

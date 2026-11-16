import { palettes } from '../constants/theme.ts';
function luminance(hex: string) { const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722; }
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
Deno.test('OG6 light and dark palettes keep readable text, controls and semantic statuses', () => {
  for (const [name, c] of Object.entries(palettes)) {
    const pairs = [[c.text, c.surface], [c.text, c.surfaceAlt], [c.subtle, c.surface], [c.subtle, c.surfaceAlt], [c.primary, c.blueBg], [c.onAction, c.action], [c.headerText, c.headerSurface], [c.success, c.successBg], [c.danger, c.dangerBg], [c.warning, c.warningBg]];
    for (const [foreground, background] of pairs) if (contrast(foreground, background) < 4.5) throw new Error(`${name} contrast below 4.5:1 for ${foreground} on ${background}`);
  }
});
Deno.test('themes use genuinely different surfaces instead of two dark variants', () => {
  if (luminance(palettes.light.background) < 0.8 || luminance(palettes.dark.background) > 0.1) throw new Error('Light/dark surfaces are not distinct');
  if (JSON.stringify(Object.keys(palettes.dark).sort()) !== JSON.stringify(Object.keys(palettes.light).sort())) throw new Error('Themes must define the same tokens');
});

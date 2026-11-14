// C4S accountability console: smooth layered glass, tactical imagery and luminous status edges.
// Both appearance preferences retain navy surfaces; the light preference is a brighter navy treatment.
const command = {
  navy: '#031A2C', white: '#FFFFFF', headerBg: '#021523',
  headerSurface: 'rgba(2,24,43,0.92)', headerBorder: '#194A70',
  headerText: '#BAD4EE', headerAccent: '#27A5F5', gold: '#D7B971', badgeDanger: '#E53243',
  heroOverlay: 'rgba(1,17,31,0.16)', overlay: 'rgba(0,8,18,0.88)',
  transparent: 'transparent', signalBlue: '#259DF1', signalGreen: '#24B856', signalRed: '#EF4B61',
};
const midnight = {
  ...command, primary: '#48B9FF', action: '#0078D9', background: '#020E18',
  surface: '#041C30', surfaceGlass: 'rgba(2,25,43,0.96)', surfaceAlt: '#082840',
  text: '#F5F9FF', subtle: '#BDD3EA', placeholder: '#99B4CF',
  border: '#1B3E5D', borderBright: '#287FB7', shadow: '#0089E0',
  success: '#76EAA0', successBg: '#043725', warning: '#FFD18A', warningBg: '#543119',
  danger: '#FF9BA6', dangerBg: '#351B28', blueBg: '#063659', muted: '#A6BDD2',
  metricStart: '#08365A', metricEnd: '#021724', wallpaperOverlay: 'rgba(1,13,24,0.94)',
};
export const palettes = {
  light: { ...midnight, background: '#061A2B', surface: '#0B2B44', surfaceGlass: 'rgba(8,36,58,0.97)', surfaceAlt: '#10334F', border: '#2C5676', metricEnd: '#08263A' },
  dark: midnight,
};
export type Colors = typeof palettes.dark;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
// Compact layout tokens keep card density consistent without shrinking touch targets.
export const density = { cardGap: 6, cardPadding: 8, sectionGap: 8, fieldGap: 2, headerGap: 4, iconGap: 4, valueGap: 2 };
export const radius = { sm: 8, md: 16, lg: 20, pill: 99 };
export const type = { tiny: 12, micro: 14, caption: 16, meta: 16, small: 16, label: 20, body: 16, section: 28, title: 32, hero: 48, brand: 48, metric: 56 };
export const leading = { caption: 22, footer: 22, small: 24, compact: 26, label: 26, detail: 26, body: 26, relaxed: 28, long: 30 };
export const layout = { sidebarWidth: 226, mediumSidebarWidth: 186, compactSidebarWidth: 150, contentWidth: 1488, heroHeight: 176, compactHeroHeight: 128, metricHeight: 112, compactMetricHeight: 96, metricIcon: 64, compactMetricIcon: 44, referenceWidth: 1672, pageInset: 24, overviewHeight: 306, lowerHeight: 400, activityHeight: 64, railFraction: 0.349, panelGap: 6 };
export const consoleType = { brand: 48, brandMedium: 36, brandCompact: 24, page: 32, pageCompact: 22, section: 28, sectionCompact: 20, metric: 56, metricCompact: 36, metricLabel: 20, activity: 18, activityMeta: 16, status: 16 };

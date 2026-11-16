// OG6 command center: smooth, layered navy panels, tactical imagery and signal-color edges.
// Both saved appearance variants remain military-dark; the document palette is print-only.
const midnight = {
  navy: '#031426', white: '#FFFFFF', onAction: '#FFFFFF', onAccent: '#FFFFFF',
  headerBg: '#031426', headerSurface: '#052039', headerBorder: '#19486B',
  headerText: '#B7D6F2', headerAccent: '#159FFF', gold: '#E6B953', badgeDanger: '#E52C40',
  heroOverlay: 'rgba(2,17,31,0.10)', overlay: 'rgba(0,7,16,0.86)', transparent: 'transparent',
  signalBlue: '#159FFF', signalGreen: '#0DBF4D', signalRed: '#FF5265',
  primary: '#49BCFF', action: '#006AB8', background: '#010D18', surface: '#041829',
  surfaceGlass: '#041829', surfaceAlt: '#08243C', text: '#F4F8FF', subtle: '#B7D0E7',
  placeholder: '#91ADC6', border: '#15354F', borderBright: '#19486B', shadow: '#008EFF',
  success: '#74EEA7', successBg: '#063023', warning: '#FFD099', warningBg: '#3E2512',
  danger: '#FF919B', dangerBg: '#321D2A', blueBg: '#062D4C', muted: '#A5BCD1',
  metricStart: '#072A47', metricEnd: '#021320', wallpaperOverlay: 'rgba(1,13,24,0.80)',
};
export const palettes = {
  dark: midnight,
  // Preserve the legacy `light` preference and System Default without introducing white UI.
  light: { ...midnight, navy: '#071C30', headerBg: '#071C30', headerSurface: '#0A2943',
    background: '#041524', surface: '#082239', surfaceGlass: '#082239', surfaceAlt: '#0B2C47',
    border: '#24516F', borderBright: '#326383', metricStart: '#0B324F', metricEnd: '#051B2E',
    wallpaperOverlay: 'rgba(4,21,36,0.80)' },
};
export const documentPalette = {
  text: '#10283D', primary: '#0061A8', subtle: '#3D5A70', border: '#A4BACD',
  surface: '#FFFFFF', surfaceAlt: '#EAF3FA',
};
export type Colors = typeof palettes.dark;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const density = { cardGap: 12, cardPadding: 12, sectionGap: 8, fieldGap: 4, headerGap: 4, iconGap: 8, valueGap: 2 };
export const radius = { sm: 8, md: 12, lg: 12, pill: 99 };
export const type = { tiny: 12, micro: 14, caption: 16, meta: 16, small: 16, label: 20, body: 16, section: 22, title: 28, hero: 36, brand: 28, metric: 36 };
export const leading = { caption: 20, footer: 20, small: 22, compact: 24, label: 24, detail: 24, body: 26, relaxed: 26, long: 30 };
export const layout = {
  sidebarWidth: 140, mediumSidebarWidth: 140, compactSidebarWidth: 112, contentWidth: 1280,
  heroHeight: 108, compactHeroHeight: 132, metricHeight: 88, compactMetricHeight: 96,
  metricIcon: 50, compactMetricIcon: 36, referenceWidth: 1024, pageInset: 18,
  overviewHeight: 188, lowerHeight: 244, activityHeight: 44, railFraction: 0.35,
  panelGap: 12, emblemSize: 88, sidebarBrandHeight: 104, navHeight: 40,
  activityTableMinWidth: 500, activityIconWidth: 32, activityKindWidth: 70,
  activityDateWidth: 144, activityStatusWidth: 76, monitorOverdueHeight: 142, monitorDueHeight: 92,
  clockWidth: 212, headerControlHeight: 44,
};
// Dense console data typography matches the reference; forms retain the 16px body scale.
export const consoleType = {
  brand: 28, brandMedium: 26, brandCompact: 22, page: 20, pageCompact: 20,
  section: 18, sectionCompact: 18, metric: 34, metricCompact: 34,
  metricLabel: 12, activity: 12, activityMeta: 10, status: 10,
  subtitle: 14, description: 12, link: 12, nav: 12, clock: 10, timezone: 9,
};

// OG6 reference identity: layered navy command panels, electric-blue accents and tactical imagery.
export const palettes = {
  dark: {
    navy: '#041526', white: '#FFFFFF', onAction: '#FFFFFF', onAccent: '#FFFFFF', headerBg: '#041526', headerSurface: '#06233D', headerBorder: '#245B83', headerText: '#B5D5F0', headerAccent: '#159FFF', gold: '#E6B953', badgeDanger: '#D32C43', heroOverlay: 'rgba(2,17,31,0.14)', overlay: 'rgba(0,8,18,0.82)', transparent: 'transparent', signalBlue: '#0B93F2', signalGreen: '#0AAF4D', signalRed: '#FF586A', primary: '#53B8FF', action: '#006EBD', background: '#020F1B', surface: '#061A2D', surfaceGlass: '#04192B', surfaceAlt: '#0B2842', text: '#F1F7FF', subtle: '#B7D0E7', placeholder: '#91ADC6', border: '#183C59', borderBright: '#245B83', shadow: '#008EFF', success: '#66E79A', successBg: '#053323', warning: '#FFC072', warningBg: '#3A250F', danger: '#FF8A96', dangerBg: '#321C29', blueBg: '#062B49', muted: '#A5BCD1', metricStart: '#062B49', metricEnd: '#041322', wallpaperOverlay: 'rgba(2,15,27,0.68)',
  },
  light: {
    navy: '#EDF6FF', white: '#FFFFFF', onAction: '#FFFFFF', onAccent: '#FFFFFF', headerBg: '#E3EFFA', headerSurface: '#EDF6FF', headerBorder: '#8CACCA', headerText: '#315875', headerAccent: '#0061A8', gold: '#886500', badgeDanger: '#B92436', heroOverlay: 'rgba(237,246,255,0.97)', overlay: 'rgba(4,25,43,0.48)', transparent: 'transparent', signalBlue: '#0073C9', signalGreen: '#108040', signalRed: '#C72F45', primary: '#0061A8', action: '#006EBD', background: '#F0F6FC', surface: '#FFFFFF', surfaceGlass: '#FFFFFF', surfaceAlt: '#EAF3FA', text: '#10283D', subtle: '#3D5A70', placeholder: '#536C80', border: '#A4BACD', borderBright: '#5E91BA', shadow: '#287BB8', success: '#17633B', successBg: '#E3F3E9', warning: '#825000', warningBg: '#FFF0D7', danger: '#A41C30', dangerBg: '#FCE7EB', blueBg: '#E2F1FF', muted: '#536879', metricStart: '#E2F1FF', metricEnd: '#FFFFFF', wallpaperOverlay: 'rgba(240,246,252,0.98)',
  },
};
export type Colors = typeof palettes.dark;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const density = { cardGap: 8, cardPadding: 12, sectionGap: 8, fieldGap: 4, headerGap: 4, iconGap: 8, valueGap: 2 };
export const radius = { sm: 8, md: 16, lg: 20, pill: 99 };
export const type = { tiny: 12, micro: 14, caption: 16, meta: 16, small: 16, label: 20, body: 16, section: 28, title: 32, hero: 48, brand: 48, metric: 56 };
export const receiptPreviewLayout = { initialWidth: 280, minHeight: 160, maxHeight: 420, heightFraction: 0.46, controlHeight: 48, minZoom: 1, maxZoom: 8, zoomSteps: [1, 1.5, 2, 3, 4, 6, 8] };
export const signatureLayout = { compactHeight: 180, expandedMaxWidth: 960, expandedMinHeight: 120, canvasRadius: 12, baselineInset: 32, controlHeight: 48 };
export const leading = { caption: 20, footer: 20, small: 22, compact: 24, label: 24, detail: 24, body: 26, relaxed: 26, long: 30 };
export const layout = { sidebarWidth: 226, mediumSidebarWidth: 140, compactSidebarWidth: 132, contentWidth: 1488, heroHeight: 144, compactHeroHeight: 112, metricHeight: 104, compactMetricHeight: 96, metricIcon: 52, compactMetricIcon: 36, referenceWidth: 1672, pageInset: 16, overviewHeight: 306, lowerHeight: 400, activityHeight: 56, railFraction: 0.349, panelGap: density.cardGap };
export const consoleType = { brand: 40, brandMedium: 32, brandCompact: 24, page: 28, pageCompact: 22, section: 24, sectionCompact: 20, metric: 48, metricCompact: 36, metricLabel: 18, activity: 18, activityMeta: 16, status: 16 };

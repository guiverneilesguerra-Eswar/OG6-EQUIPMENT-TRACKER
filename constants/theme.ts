// OG6 equipment accountability: layered panels, yellow command accents, compact record rhythm.
export const palettes = {
  dark: {
    navy: '#101010', white: '#FFFFFF', onAction: '#121212', onAccent: '#101010', headerBg: '#111111', headerSurface: '#1A1A16', headerBorder: '#625722', headerText: '#DEDACA', headerAccent: '#FFD447', gold: '#FFD447', badgeDanger: '#B92436', heroOverlay: 'rgba(16,16,12,0.90)', overlay: 'rgba(0,0,0,0.82)', transparent: 'transparent', signalBlue: '#FFD447', signalGreen: '#70D89C', signalRed: '#FF8B97', primary: '#FFD447', action: '#FFD447', background: '#0C0D0E', surface: '#191B1D', surfaceGlass: '#191B1D', surfaceAlt: '#242629', text: '#F5F4EF', subtle: '#CDCBC4', placeholder: '#ABA9A0', border: '#505154', borderBright: '#8C792B', shadow: '#B59A2F', success: '#82E2AB', successBg: '#183529', warning: '#FFD447', warningBg: '#3D3318', danger: '#FF9AA5', dangerBg: '#3E1D25', blueBg: '#332D19', muted: '#BAB8B2', metricStart: '#332D19', metricEnd: '#191B1D', wallpaperOverlay: 'rgba(12,13,14,0.95)',
  },
  light: {
    navy: '#F5F2E6', white: '#FFFFFF', onAction: '#121212', onAccent: '#FFFFFF', headerBg: '#F4EBC8', headerSurface: '#FFF9E7', headerBorder: '#B9A76B', headerText: '#514832', headerAccent: '#745500', gold: '#886500', badgeDanger: '#B92436', heroOverlay: 'rgba(250,247,234,0.97)', overlay: 'rgba(36,32,18,0.48)', transparent: 'transparent', signalBlue: '#795A00', signalGreen: '#17663C', signalRed: '#A91E31', primary: '#705200', action: '#F0C438', background: '#F7F5ED', surface: '#FFFFFF', surfaceGlass: '#FFFFFF', surfaceAlt: '#F1EFE5', text: '#20211E', subtle: '#56564E', placeholder: '#65645B', border: '#B6B4A9', borderBright: '#92731D', shadow: '#7C6A30', success: '#17633B', successBg: '#E3F3E9', warning: '#745100', warningBg: '#FFF0BC', danger: '#A41C30', dangerBg: '#FCE7EB', blueBg: '#FFF3CA', muted: '#5D5D54', metricStart: '#FFF3CA', metricEnd: '#FFFFFF', wallpaperOverlay: 'rgba(247,245,237,0.98)',
  },
};
export type Colors = typeof palettes.dark;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const density = { cardGap: 8, cardPadding: 12, sectionGap: 8, fieldGap: 4, headerGap: 4, iconGap: 8, valueGap: 2 };
export const radius = { sm: 8, md: 16, lg: 20, pill: 99 };
export const type = { tiny: 12, micro: 14, caption: 16, meta: 16, small: 16, label: 20, body: 16, section: 28, title: 32, hero: 48, brand: 48, metric: 56 };
export const leading = { caption: 20, footer: 20, small: 22, compact: 24, label: 24, detail: 24, body: 26, relaxed: 26, long: 30 };
export const layout = { sidebarWidth: 226, mediumSidebarWidth: 186, compactSidebarWidth: 150, contentWidth: 1488, heroHeight: 144, compactHeroHeight: 112, metricHeight: 104, compactMetricHeight: 96, metricIcon: 52, compactMetricIcon: 36, referenceWidth: 1672, pageInset: 16, overviewHeight: 306, lowerHeight: 400, activityHeight: 56, railFraction: 0.349, panelGap: density.cardGap };
export const consoleType = { brand: 40, brandMedium: 32, brandCompact: 24, page: 28, pageCompact: 22, section: 24, sectionCompact: 20, metric: 48, metricCompact: 36, metricLabel: 18, activity: 18, activityMeta: 16, status: 16 };

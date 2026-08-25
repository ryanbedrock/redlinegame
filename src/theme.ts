/**
 * Chart colors for JS-rendered SVG (Recharts), following the Bedrock platform
 * token shape. Values mirror the platform palette primitives; hexes live here
 * (not in components) because SVG attributes cannot resolve CSS var() references.
 */
const palette = {
  slate400: '#202b37',
  slate500: '#293644',
  slate800: '#8ea7c2',
  slate1000: '#e2f0f3',
  skydive800: '#37b3cb',
  red700: '#db2713',
  yellow800: '#ce9d18',
} as const;

export const chartTheme = {
  grid: palette.slate500,
  axis: palette.slate800,
  tooltipBg: palette.slate400,
  tooltipBorder: palette.slate500,
  tooltipText: palette.slate1000,
  seriesCritical: palette.red700,
  seriesWarning: palette.yellow800,
  seriesInfo: palette.skydive800,
} as const;

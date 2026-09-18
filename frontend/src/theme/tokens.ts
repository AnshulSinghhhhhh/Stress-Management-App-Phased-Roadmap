/**
 * Design Tokens for Serene Mindful Living / Sanctuary
 * Sourced directly from DESIGN.md and Stitch design brief.
 *
 * CRITICAL SAFETY OVERRIDE:
 * Destructive/error states use warm terracotta (#A36B5E), NEVER raw alarmist red (#BA1A1A).
 */

export const colors = {
  // Canvas & Surfaces
  canvas: '#F9FAF8',
  surface: '#F9FAF8',
  surfaceLowest: '#FFFFFF',
  surfaceLow: '#F2F5F3',
  surfaceContainer: '#E8EFE9',
  surfaceContainerHigh: '#dee8ff',
  surfaceContainerHighest: '#d8e3fa',

  // Deep Serene Slate for text
  onSurface: '#111c2c',
  onSurfacePrimaryText: '#24332C',
  onSurfaceVariant: '#46554E',
  onSurfaceMuted: '#687770',

  // Primary Sage
  primary: '#5B7563',
  primaryDark: '#435c4b',
  onPrimary: '#FFFFFF',
  primaryContainer: '#5B7563',
  onPrimaryContainer: '#DDFBE4',

  // Secondary Moss
  secondary: '#506356',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D3E8D7',
  onSecondaryContainer: '#56695c',

  // Tertiary
  tertiary: '#495a4f',
  tertiaryContainer: '#617367',
  onTertiaryContainer: '#e4f8e9',

  // Borders & Dividers
  outline: '#737973',
  outlineVariant: '#DCE3DD',

  // Safety & Warning — Terracotta (Project-wide override: NO red sirens)
  error: '#A36B5E',
  errorContainer: '#F7ECE9',
  onError: '#FFFFFF',
  onErrorContainer: '#5C2B22',
  terracotta: '#A36B5E',
  terracottaContainer: '#F7ECE9',
  terracottaDark: '#855146',
} as const;

export const typography = {
  fontFamily: {
    display: 'Plus Jakarta Sans, system-ui, sans-serif',
    headline: 'Plus Jakarta Sans, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
    label: 'Inter, system-ui, sans-serif',
  },
  fontSize: {
    display: '2.5rem',
    displayMobile: '2rem',
    headlineLg: '2rem',
    headlineMd: '1.5rem',
    headlineSm: '1.25rem',
    bodyLg: '1.125rem',
    bodyMd: '1rem',
    bodySm: '0.875rem',
    labelLg: '0.9375rem',
    labelMd: '0.8125rem',
    labelSm: '0.75rem',
  },
  lineHeight: {
    display: '3rem',
    headlineLg: '2.5rem',
    headlineMd: '2rem',
    headlineSm: '1.75rem',
    bodyLg: '1.875rem',
    bodyMd: '1.65rem',
    bodySm: '1.45rem',
    labelLg: '1.375rem',
    labelMd: '1.25rem',
    labelSm: '1.125rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
  },
} as const;

export const spacing = {
  xs: '0.375rem',
  sm: '0.75rem',
  md: '1.25rem',
  lg: '2rem',
  xl: '3.5rem',
  gutter: '1.5rem',
  gutterMobile: '1rem',
  margin: '3rem',
  marginMobile: '1.25rem',
} as const;

export const radii = {
  sm: '0.5rem',
  DEFAULT: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '3rem',
  full: '9999px',
} as const;

export const shadows = {
  resting: '0px 4px 20px -4px rgba(36, 51, 44, 0.04), 0px 1px 3px 0px rgba(36, 51, 44, 0.02)',
  lift: '0px 8px 28px -6px rgba(36, 51, 44, 0.06), 0px 2px 6px 0px rgba(36, 51, 44, 0.03)',
  modal: '0px 16px 40px -8px rgba(36, 51, 44, 0.08), 0px 4px 12px 0px rgba(36, 51, 44, 0.02)',
} as const;

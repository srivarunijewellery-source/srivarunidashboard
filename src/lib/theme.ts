/**
 * Rosewater & Garnet - central color tokens.
 *
 * These are the ONLY place the dashboard's brand colors should be defined.
 * Every component should import COLORS and reference it instead of writing
 * hex literals inline - that's what "central" means here: one file to edit
 * to re-theme the app, instead of hunting through every component.
 *
 * (globals.css also defines a parallel set as CSS custom properties
 * (--color-sv-*) for the couple of places that use plain CSS classes rather
 * than inline React styles, e.g. .inv-row:hover. Keep both in sync if you
 * change a value.)
 */
export const COLORS = {
  // Core ramp
  ink: '#45141f',           // primary / headings / sidebar bg / active buttons
  inkMid: '#5c1a2b',        // hover states, secondary emphasis
  inkDeep: '#833044',       // dark header bands (e.g. pivot table TOTAL header)
  inkDarker: '#2c0c14',     // darkest header band (pivot table sticky corner)
  accent: '#b76e79',        // dusty rose - primary accent, chart bars, links
  accentLight: '#d9a3ab',   // light rose - active borders, chart secondary series
  accentMuted: '#c98d95',   // muted rose - sidebar inactive nav text
  pale: '#f0d8db',          // pale rose - active/highlight backgrounds, row hover
  faint: '#fbeee9',         // faint rose - zebra-striped row backgrounds

  // Borders & surfaces
  border: '#ecd9d3',        // default border
  borderLight: '#f6e9e4',   // lighter border / selector track background
  borderAccent: '#e8c2c7',  // emphasized border (e.g. table total row)
  borderCream: '#f2e2dc',   // warm cream border variant (table header dividers)
  bg: '#fdf6f3',            // page background
  white: '#fff',

  // Text
  text: '#2b1013',          // primary body text
  textMuted: '#8f6b64',     // secondary / muted text
  textMutedDark: '#6b4a45', // muted text on light surfaces needing more contrast
  textLabel: '#a1776f',     // uppercase eyebrow/label text
  textFaint: '#b89892',     // faint / disabled text (inactive icons)
  textDisabled: '#ddc6c2',  // disabled table cell values

  // Semantic (unchanged by the re-theme - status colors stay conventional)
  success: '#059669',
  warning: '#f59e0b',
  danger: '#dc2626',

  // Pre-mixed shadow strings (garnet-tinted instead of purple-tinted)
  shadowSoft: 'rgba(69,20,31,0.07)',
  shadowSoftHover: 'rgba(69,20,31,0.18)',
  shadowCard: 'rgba(69,20,31,0.08)',
} as const

/** Chart color sequence for pie/bar category breakdowns - darkest to lightest. */
export const CHART_RAMP = [COLORS.ink, COLORS.inkMid, COLORS.accent, COLORS.accentMuted, COLORS.accentLight, COLORS.pale]

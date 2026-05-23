/**
 * tokens.js
 * Single source of truth for all colors and typography from the Design Document.
 * Import { COLORS, FONTS } in every component instead of hardcoding values.
 */

export const COLORS = {
  // ── Light Mode ──────────────────────────────────────────────────────────────
  light: {
    primary:      '#661F1F', // Deep Burgundy — headings, nav active, CTAs
    primaryHover: '#8B3A3A', // Medium Burgundy — hover, secondary buttons
    primaryLight: '#F5E6E6', // Very light pink — selected states, pill backgrounds
    appBg:        '#CDCBC9', // Warm Gray — main app background
    cardBg:       '#F5F0EE', // Off-White — cards, forms, panels
    elevatedBg:   '#E8E2DF', // Light Taupe — table headers, dividers
    tableHeader:  '#E8E2DF', // alias of elevatedBg — used in inventory/invoice tables
    divider:      '#E0D8D4', // Slightly darker divider line
    textPrimary:  '#222222', // Near-Black — body text
    textSecondary:'#666666', // Medium Gray — sub-labels, placeholders
    textMuted:    '#999999', // Light Gray — timestamps, captions
    nearBlack:    '#1A1A1A', // Deepest dark text
    white:        '#FFFFFF', // Pure White — modals, overlays
    border:       '#E8E2DF', // Input borders
    borderFocus:  '#661F1F', // Input focus border

    // Status — text colors
    statusGreen:  '#1A7A1A',
    statusAmber:  '#CC6600',
    statusRed:    '#CC0000',
    statusBlue:   '#0055CC',
    statusPurple: '#6A1B9A',

    // Status — backgrounds
    statusGreenBg:   '#E8F5E9',
    statusGreenText: '#1A7A1A',
    statusAmberBg:   '#FFF3E0',
    statusAmberText: '#CC6600',
    statusRedBg:     '#FFEBEE',
    statusRedText:   '#CC0000',
    statusBlueBg:    '#E3F2FD',
    statusBlueText:  '#0055CC',
    statusPurpleBg:  '#F3E5F5',
    statusPurpleText:'#6A1B9A',

    linkBlue:     '#0055CC',
  },

  // ── Dark Mode ───────────────────────────────────────────────────────────────
  dark: {
    primary:      '#8B3A3A', // Medium Burgundy — slightly lighter for dark contrast
    primaryHover: '#A34444',
    appBg:        '#1A1A1A', // Deep Charcoal
    cardBg:       '#2A2A2A', // Dark Card BG
    elevatedBg:   '#3A3A3A', // Dark Elevated
    textPrimary:  '#E8E8E8', // Light Gray
    textSecondary:'#999999', // Medium Gray
    white:        '#2A2A2A', // "white" in dark = card bg
    border:       '#3A3A3A',
    borderFocus:  '#8B3A3A',

    // Status — same hues, adjusted for dark backgrounds
    statusGreenBg:  '#1B3A1B',
    statusGreenText:'#66BB6A',
    statusAmberBg:  '#3A2800',
    statusAmberText:'#FFA726',
    statusRedBg:    '#3A1A1A',
    statusRedText:  '#EF5350',
    statusBlueBg:   '#1A2A3A',
    statusBlueText: '#42A5F5',
    statusPurpleBg: '#2A1A3A',
    statusPurpleText:'#AB47BC',

    linkBlue:     '#42A5F5',
  },
};

export const FONTS = {
  heading: "'DM Serif Display', Georgia, serif",
  body:    "'Outfit', 'Segoe UI', sans-serif",
  mono:    "'JetBrains Mono', 'Roboto Mono', monospace",
};

// ── Responsive breakpoints (match Design Document) ───────────────────────────
export const BP = {
  mobile:  '(max-width: 767px)',
  tablet:  '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)',
};

// ── Shadows ───────────────────────────────────────────────────────────────────
export const SHADOWS = {
  card:      '0 2px 8px rgba(0,0,0,0.08)',
  cardHover: '0 6px 24px rgba(102,31,31,0.12)',
  modal:     '0 20px 60px rgba(0,0,0,0.25)',
  // FIX: Added missing `header` token used by sticky page headers
  // (InventoryPage, ItemDetailPage, and any future module headers).
  // Previously undefined → no shadow on sticky headers.
  header:    '0 4px 20px rgba(102,31,31,0.35)',
};

// ── Border radius ─────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  full: '9999px',
};

// ── Typography scale (mirrors Design Document) ───────────────────────────────
// These complement FONTS (which stores font-family strings).
export const TYPOGRAPHY = {
  sans:        FONTS.body,
  mono:        FONTS.mono,
  heading:     FONTS.heading,
  pageTitle:   24,
  sectionHead: 18,
  subheading:  16,
  body:        14,
  label:       12,
  micro:       11,
};

// ── Border radius as pixel numbers (for use in style={{borderRadius: RADII.lg}}) ──
// Note: RADIUS exports string values with 'px' suffix; RADII exports raw numbers.
export const RADII = {
  sm:   6,
  md:   8,
  lg:   12,
  xl:   14,
  full: 9999,
};
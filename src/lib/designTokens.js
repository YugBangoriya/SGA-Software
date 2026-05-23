/**
 * designTokens.js — COMPATIBILITY SHIM
 *
 * All design values now live in lib/tokens.js (the single source of truth).
 * This file re-exports them in the flat shape that inventory and other
 * early-phase components expect, so no import paths need to change.
 *
 * For new components: import directly from './tokens' instead.
 */

import { COLORS as THEME, SHADOWS as THEME_SHADOWS, TYPOGRAPHY, RADII } from './tokens';

// ── Flat light-mode colors (same shape as the old designTokens.COLORS) ────────
export const COLORS = THEME.light;

// ── Dark-mode colors (same shape as old designTokens.DARK_COLORS) ─────────────
export const DARK_COLORS = THEME.dark;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const SHADOWS = THEME_SHADOWS;

// ── Typography scale ──────────────────────────────────────────────────────────
export { TYPOGRAPHY };

// ── Border radii (numbers, no 'px') ───────────────────────────────────────────
export { RADII };
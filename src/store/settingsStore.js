// SGA — Last updated: Fixed infinite loading loop — added loading guard + sets initialized:true on catch
// src/store/settingsStore.js
// Zustand store — single source of truth for all settings across the app.
// Every module that reads GST, dropdowns, business info, etc. uses this store.
//
// FIX (Post-Launch):
//   initSettings had no guard against concurrent calls. If the followUpTemplates
//   collection threw a permission error (missing Firestore rule), initialized
//   was never set to true. Every child component that mounted called initSettings
//   again (since initialized=false), which set loading=true, causing SettingsPage
//   to flash back to the loading screen, unmounting all children — creating an
//   infinite flip-flop loop in production.
//
//   Fix applied:
//   1. Added `|| get().loading` to the guard so concurrent calls are ignored.
//   2. Added `set({ initialized: true })` in the catch block — on failure the
//      store falls back to defaults (safe) but never retries in a tight loop.
//   3. followUpTemplates Firestore rule also added (see firestore.rules).

import { create } from "zustand";
import {
  fetchSettings,
  fetchSystemConfig,
  fetchCustomFields,
  fetchFollowUpTemplates,
  DEFAULT_SETTINGS,
  DEFAULT_SYSTEM_CONFIG,
} from "../lib/settingsService";

const useSettingsStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  settings: DEFAULT_SETTINGS,
  systemConfig: DEFAULT_SYSTEM_CONFIG,
  customFields: [],
  followUpTemplates: [],
  loading: false,
  initialized: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Call once on app boot (in App.jsx or a root component) */
  initSettings: async () => {
    // FIX: also guard on loading to prevent concurrent calls from multiple
    // child components that each call useSettings() on mount.
    if (get().initialized || get().loading) return;

    set({ loading: true });
    try {
      const [settings, systemConfig, customFields, followUpTemplates] = await Promise.all([
        fetchSettings(),
        fetchSystemConfig(),
        fetchCustomFields(),
        fetchFollowUpTemplates(),
      ]);
      set({
        settings,
        systemConfig,
        customFields,
        followUpTemplates,
        initialized: true,
      });
    } catch (err) {
      console.error("Failed to init settings:", err);
      // FIX: always mark initialized even on error — prevents retry loops.
      // The store will use DEFAULT_SETTINGS / DEFAULT_SYSTEM_CONFIG as fallback.
      set({ initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  /** Patch a subset of settings locally (called after a save) */
  patchSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  /** Patch nested dropdowns */
  patchDropdown: (category, values) =>
    set((state) => ({
      settings: {
        ...state.settings,
        dropdowns: { ...state.settings.dropdowns, [category]: values },
      },
    })),

  /** Replace system config */
  patchSystemConfig: (partial) =>
    set((state) => ({ systemConfig: { ...state.systemConfig, ...partial } })),

  /** Replace custom fields list */
  setCustomFields: (fields) => set({ customFields: fields }),

  /** Replace follow-up templates list */
  setFollowUpTemplates: (templates) => set({ followUpTemplates: templates }),

  /** Helpers used by other modules */
  isGSTEnabled: () => Boolean(get().settings.gstNumber?.trim()),
  isInvoiceDbLocked: () => get().systemConfig.invoiceDbLocked === true,

  getDropdown: (category) => get().settings.dropdowns?.[category] || [],
}));

export default useSettingsStore;
// src/store/settingsStore.js
// Zustand store — single source of truth for all settings across the app.
// Every module that reads GST, dropdowns, business info, etc. uses this store.

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
    if (get().initialized) return;
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

// src/hooks/useSettings.js
// Convenience hook — import this in ANY component that needs settings values.
// Replaces all hardcoded dropdown arrays and GST checks from Phases 1–10.

import { useEffect } from "react";
import useSettingsStore from "../store/settingsStore";

export function useSettings() {
  const store = useSettingsStore();

  useEffect(() => {
    store.initSettings();
  }, []);

  return {
    // Full objects
    settings: store.settings,
    systemConfig: store.systemConfig,
    customFields: store.customFields,
    followUpTemplates: store.followUpTemplates,
    loading: store.loading,

    // Convenience getters
    isGSTEnabled: store.isGSTEnabled(),
    gstNumber: store.settings.gstNumber || "",
    businessName: store.settings.businessName || "",
    businessLogoUrl: store.settings.businessLogoUrl || "",
    instagramUrl: store.settings.instagramUrl || "",
    facebookUrl: store.settings.facebookUrl || "",
    googleMapsUrl: store.settings.googleMapsUrl || "",
    invoiceTermsAndConditions: store.settings.invoiceTermsAndConditions || "",
    globalLowStockThreshold: store.settings.globalLowStockThreshold ?? 5,
    isInvoiceDbLocked: store.isInvoiceDbLocked(),

    // Dropdown arrays — drop-in replacements for hardcoded arrays
    cngKitBrands: store.getDropdown("cngKitBrands"),
    cngKitModels: store.getDropdown("cngKitModels"),
    addOns: store.getDropdown("addOns"),
    advancers: store.getDropdown("advancers"),
    vehicleEmissionCategories: store.getDropdown("vehicleEmissionCategories"),
    technicianNames: store.getDropdown("technicianNames"),
    paymentTerms: store.getDropdown("paymentTerms"),

    // Patch helpers (used by Settings components after saves)
    patchSettings: store.patchSettings,
    patchDropdown: store.patchDropdown,
    patchSystemConfig: store.patchSystemConfig,
    setCustomFields: store.setCustomFields,
    setFollowUpTemplates: store.setFollowUpTemplates,
  };
}

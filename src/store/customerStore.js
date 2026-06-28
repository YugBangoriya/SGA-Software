// SGA — Last updated: Added new CNG Kit dropdown categories (cngKits, ckpAdvancers, extraItems, cylinders) to loadSettings for Customer CNG Kit step
/**
 * customerStore.js
 * Zustand store for the Customer Records module.
 */

import { create } from 'zustand';
import {
  fetchAllCustomers,
  fetchCustomerById,
  fetchSettings,
  fetchCustomFields,
  deleteCustomer,
  DEFAULT_DROPDOWN_OPTIONS,
} from '../lib/customerService';

const useCustomerStore = create((set, get) => ({
  // ── Customer list ──────────────────────────────────────────────────────────
  customers:     [],
  isLoadingList: false,
  listError:     null,
  listVersion:   0,

  // ── Selected / active customer ─────────────────────────────────────────────
  activeCustomer:    null,
  isLoadingCustomer: false,
  customerError:     null,

  // ── Search & filter ────────────────────────────────────────────────────────
  searchQuery:      '',
  filterEmission:   '',
  filterTechnician: '',

  // ── Settings & dropdowns ───────────────────────────────────────────────────
  dropdownOptions:   DEFAULT_DROPDOWN_OPTIONS,
  customFields:      [],
  isLoadingSettings: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  loadCustomers: async () => {
    set({ isLoadingList: true, listError: null });
    try {
      const customers = await fetchAllCustomers();
      set({ customers, isLoadingList: false });
    } catch (err) {
      set({ listError: err.message, isLoadingList: false });
    }
  },

  clearCustomers: () => {
    set({ customers: [], listError: null });
  },

  bumpListVersion: () => {
    set((state) => ({ listVersion: state.listVersion + 1 }));
  },

  loadCustomer: async (id) => {
    set({ isLoadingCustomer: true, customerError: null, activeCustomer: null });
    try {
      const customer = await fetchCustomerById(id);
      set({ activeCustomer: customer, isLoadingCustomer: false });
    } catch (err) {
      set({ customerError: err.message, isLoadingCustomer: false });
    }
  },

  refreshActiveCustomer: async () => {
    const { activeCustomer } = get();
    if (!activeCustomer?.id) return;
    try {
      const customer = await fetchCustomerById(activeCustomer.id);
      set({ activeCustomer: customer });
    } catch (_) {}
  },

  loadSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const [settings, customFields] = await Promise.all([
        fetchSettings(),
        fetchCustomFields(),
      ]);
      const dd = settings?.dropdowns || {};
      set({
        dropdownOptions: settings
          ? {
              cngKitBrands:       dd.cngKitBrands           || DEFAULT_DROPDOWN_OPTIONS.cngKitBrands,
              cngKitModels:       DEFAULT_DROPDOWN_OPTIONS.cngKitModels,       // brand-keyed structure — not managed via Settings → Dropdown Values
              tankCapacities:     DEFAULT_DROPDOWN_OPTIONS.tankCapacities,     // not part of Settings → Dropdown Values categories
              advancers:          dd.advancers              || DEFAULT_DROPDOWN_OPTIONS.advancers,
              addOns:             dd.addOns                 || DEFAULT_DROPDOWN_OPTIONS.addOns,
              technicians:        dd.technicianNames        || DEFAULT_DROPDOWN_OPTIONS.technicians,
              emissionCategories: dd.vehicleEmissionCategories || DEFAULT_DROPDOWN_OPTIONS.emissionCategories,
              // NEW — CNG Kit installation fields (configured in Settings → Dropdown Values)
              cngKits:       dd.cngKits       || [],
              ckpAdvancers:  dd.ckpAdvancers  || [],
              extraItems:    dd.extraItems    || [],
              cylinders:     dd.cylinders     || [],
            }
          : DEFAULT_DROPDOWN_OPTIONS,
        customFields:      customFields || [],
        isLoadingSettings: false,
      });
    } catch (_) {
      set({ isLoadingSettings: false });
    }
  },

  /**
   * Delete one or more customers by ID.
   * Removes them optimistically from the local list immediately.
   * @param {string[]} ids — array of Firestore document IDs to delete
   */
  deleteCustomers: async (ids) => {
    // Optimistic removal from local list
    set((state) => ({
      customers: state.customers.filter((c) => !ids.includes(c.id)),
    }));
    get().bumpListVersion();
    // Fire all deletes in parallel
    await Promise.all(ids.map((id) => deleteCustomer(id)));
  },

  patchLocalCustomer: (id, data) => {
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
      activeCustomer:
        state.activeCustomer?.id === id
          ? { ...state.activeCustomer, ...data }
          : state.activeCustomer,
    }));
    get().bumpListVersion();
  },

  addLocalCustomer: (customer) => {
    set((state) => ({
      customers: [customer, ...state.customers],
    }));
    get().bumpListVersion();
  },

  setSearchQuery:      (q) => set({ searchQuery: q }),
  setFilterEmission:   (v) => set({ filterEmission: v }),
  setFilterTechnician: (v) => set({ filterTechnician: v }),
  clearFilters:        ()  => set({ searchQuery: '', filterEmission: '', filterTechnician: '' }),

  getFilteredCustomers: () => {
    const { customers, searchQuery, filterEmission, filterTechnician } = get();
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q)        ||
        c.phone?.toLowerCase().includes(q)       ||
        c.vehicleNo?.toLowerCase().includes(q)   ||
        c.vehicleModel?.toLowerCase().includes(q);
      const matchEmission = !filterEmission   || c.emissionCategory === filterEmission;
      const matchTech     = !filterTechnician || c.technicianName    === filterTechnician;
      return matchSearch && matchEmission && matchTech;
    });
  },
}));

export default useCustomerStore;
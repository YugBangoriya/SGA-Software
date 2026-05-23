/**
 * customerStore.js
 * Zustand store for the Customer Records module.
 * Holds the customer list, active customer, search/filter state, and settings data.
 */

import { create } from 'zustand';
import {
  fetchAllCustomers,
  fetchCustomerById,
  fetchSettings,
  fetchCustomFields,
  DEFAULT_DROPDOWN_OPTIONS,
} from '../lib/customerService';

const useCustomerStore = create((set, get) => ({
  // ── Customer list ──────────────────────────────────────────────────────────
  customers: [],
  isLoadingList: false,
  listError: null,

  // ── Selected / active customer ─────────────────────────────────────────────
  activeCustomer: null,
  isLoadingCustomer: false,
  customerError: null,

  // ── Search & filter ────────────────────────────────────────────────────────
  searchQuery: '',
  filterEmission: '',   // e.g. 'BS6'
  filterTechnician: '', // technician name

  // ── Settings & dropdowns ───────────────────────────────────────────────────
  dropdownOptions: DEFAULT_DROPDOWN_OPTIONS,
  customFields: [],     // SuperAdmin-defined extra columns
  isLoadingSettings: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Load all customers from Firestore */
  loadCustomers: async () => {
    set({ isLoadingList: true, listError: null });
    try {
      const customers = await fetchAllCustomers();
      set({ customers, isLoadingList: false });
    } catch (err) {
      set({ listError: err.message, isLoadingList: false });
    }
  },

  /** Load a single customer into activeCustomer */
  loadCustomer: async (id) => {
    set({ isLoadingCustomer: true, customerError: null, activeCustomer: null });
    try {
      const customer = await fetchCustomerById(id);
      set({ activeCustomer: customer, isLoadingCustomer: false });
    } catch (err) {
      set({ customerError: err.message, isLoadingCustomer: false });
    }
  },

  /** Refresh active customer (e.g. after a re-test date is added) */
  refreshActiveCustomer: async () => {
    const { activeCustomer } = get();
    if (!activeCustomer?.id) return;
    try {
      const customer = await fetchCustomerById(activeCustomer.id);
      set({ activeCustomer: customer });
    } catch (_) {}
  },

  /** Load dropdown options and custom fields from Firestore settings */
  loadSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const [settings, customFields] = await Promise.all([
        fetchSettings(),
        fetchCustomFields(),
      ]);
      set({
        dropdownOptions: settings
          ? {
              cngKitBrands: settings.cngKitBrands || DEFAULT_DROPDOWN_OPTIONS.cngKitBrands,
              cngKitModels: settings.cngKitModels || DEFAULT_DROPDOWN_OPTIONS.cngKitModels,
              tankCapacities: settings.tankCapacities || DEFAULT_DROPDOWN_OPTIONS.tankCapacities,
              advancers: settings.advancers || DEFAULT_DROPDOWN_OPTIONS.advancers,
              addOns: settings.addOns || DEFAULT_DROPDOWN_OPTIONS.addOns,
              technicians: settings.technicians || DEFAULT_DROPDOWN_OPTIONS.technicians,
              emissionCategories: settings.emissionCategories || DEFAULT_DROPDOWN_OPTIONS.emissionCategories,
            }
          : DEFAULT_DROPDOWN_OPTIONS,
        customFields: customFields || [],
        isLoadingSettings: false,
      });
    } catch (_) {
      set({ isLoadingSettings: false });
    }
  },

  /** Update a customer in the local list without re-fetching everything */
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
  },

  /** Prepend a newly created customer to the local list */
  addLocalCustomer: (customer) => {
    set((state) => ({ customers: [customer, ...state.customers] }));
  },

  /** Search & filter setters */
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterEmission: (v) => set({ filterEmission: v }),
  setFilterTechnician: (v) => set({ filterTechnician: v }),
  clearFilters: () => set({ searchQuery: '', filterEmission: '', filterTechnician: '' }),

  /** Computed: filtered customer list */
  getFilteredCustomers: () => {
    const { customers, searchQuery, filterEmission, filterTechnician } = get();
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.vehicleNo?.toLowerCase().includes(q) ||
        c.vehicleModel?.toLowerCase().includes(q);
      const matchEmission = !filterEmission || c.emissionCategory === filterEmission;
      const matchTech = !filterTechnician || c.technicianName === filterTechnician;
      return matchSearch && matchEmission && matchTech;
    });
  },
}));

export default useCustomerStore;

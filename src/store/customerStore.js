/**
 * customerStore.js
 * Zustand store for the Customer Records module.
 * Holds the customer list, active customer, search/filter state, and settings data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG 3 FIX — Blank Customer page (infinite re-render loop):
 *
 *   ROOT CAUSE:
 *     The previous implementation of clearCustomers() incremented listVersion
 *     at the same time as clearing the list. CustomerList's useEffect had
 *     [listVersion] as its dependency and returned clearCustomers() as its
 *     cleanup function. This created a self-triggering loop:
 *
 *       Mount → useEffect runs → cleanup registered
 *       Unmount/re-render → cleanup fires clearCustomers()
 *                         → listVersion bumps
 *                         → useEffect re-runs (dependency changed)
 *                         → cleanup registered again
 *                         → ... infinite loop
 *
 *     React fires cleanup before re-running an effect when a dependency
 *     changes, so any mutation (patchLocalCustomer, addLocalCustomer) that
 *     also bumped listVersion caused the cleanup to fire mid-render, which
 *     cleared the list, which caused another bump, which started the loop.
 *     The component rendered an empty PageShell (gray background, no content)
 *     because customers was [] throughout and isLoadingList toggled too fast
 *     for the skeleton to show — producing the "blank page" symptom.
 *
 *   FIX — Two targeted changes:
 *
 *   1. clearCustomers() → only clears data, does NOT touch listVersion.
 *      Its sole job is to wipe the stale list so the next mount starts fresh.
 *      It does NOT need to signal re-fetch because the mount itself always
 *      calls loadCustomers() unconditionally (see CustomerList fix).
 *
 *   2. New action: bumpListVersion() → increments listVersion only.
 *      Called by patchLocalCustomer() and addLocalCustomer() to signal that
 *      remote data has changed. CustomerList is NOT currently subscribed to
 *      listVersion as a re-fetch trigger (see CustomerList fix), so this is
 *      kept for future use and for any component that opts into reactive
 *      re-fetch behaviour.
 *
 *   HOW CustomerList.jsx now works (see that file for full detail):
 *     useEffect(() => {
 *       loadCustomers();
 *       loadSettings();
 *       return () => clearCustomers();   // clears list on unmount (no version bump)
 *     }, []);                            // runs ONCE on mount — no infinite loop
 *
 *   The list is therefore always fresh on first mount and cleared on unmount,
 *   without any circular dependency between cleanup and effect.
 * ─────────────────────────────────────────────────────────────────────────────
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
  customers:     [],
  isLoadingList: false,
  listError:     null,

  // listVersion is kept in the store for future use (e.g. multi-tab sync,
  // explicit refetch buttons). It is no longer used as a useEffect dependency
  // in CustomerList because doing so caused the infinite re-render loop.
  listVersion: 0,

  // ── Selected / active customer ─────────────────────────────────────────────
  activeCustomer:    null,
  isLoadingCustomer: false,
  customerError:     null,

  // ── Search & filter ────────────────────────────────────────────────────────
  searchQuery:      '',
  filterEmission:   '',   // e.g. 'BS6'
  filterTechnician: '',   // technician name

  // ── Settings & dropdowns ───────────────────────────────────────────────────
  dropdownOptions:   DEFAULT_DROPDOWN_OPTIONS,
  customFields:      [],  // SuperAdmin-defined extra columns
  isLoadingSettings: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Load all customers from Firestore.
   * Called by CustomerList on mount (and on explicit refresh).
   */
  loadCustomers: async () => {
    set({ isLoadingList: true, listError: null });
    try {
      const customers = await fetchAllCustomers();
      set({ customers, isLoadingList: false });
    } catch (err) {
      set({ listError: err.message, isLoadingList: false });
    }
  },

  /**
   * BUG 3 FIX: Clear the customer list WITHOUT bumping listVersion.
   *
   * Called in CustomerList's useEffect cleanup (on unmount). This wipes
   * the stale list from memory so the next mount starts with an empty
   * state and shows the skeleton loader rather than stale data.
   *
   * IMPORTANT: Must NOT increment listVersion here. If it did, the bump
   * would be detected by any component subscribed to [listVersion] in a
   * useEffect dependency array, causing that effect's cleanup to run,
   * which calls clearCustomers() again — creating an infinite loop.
   */
  clearCustomers: () => {
    set({
      customers:  [],
      listError:  null,
      // listVersion intentionally NOT incremented here
    });
  },

  /**
   * Increment listVersion to signal that remote data has changed.
   * Separated from clearCustomers() to prevent the loop described above.
   * Can be used by any component that wants to explicitly trigger a
   * re-fetch in a future implementation (e.g. a "Refresh" button that
   * remounts CustomerList via key prop).
   */
  bumpListVersion: () => {
    set((state) => ({ listVersion: state.listVersion + 1 }));
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
              cngKitBrands:       settings.cngKitBrands       || DEFAULT_DROPDOWN_OPTIONS.cngKitBrands,
              cngKitModels:       settings.cngKitModels       || DEFAULT_DROPDOWN_OPTIONS.cngKitModels,
              tankCapacities:     settings.tankCapacities     || DEFAULT_DROPDOWN_OPTIONS.tankCapacities,
              advancers:          settings.advancers          || DEFAULT_DROPDOWN_OPTIONS.advancers,
              addOns:             settings.addOns             || DEFAULT_DROPDOWN_OPTIONS.addOns,
              technicians:        settings.technicians        || DEFAULT_DROPDOWN_OPTIONS.technicians,
              emissionCategories: settings.emissionCategories || DEFAULT_DROPDOWN_OPTIONS.emissionCategories,
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
   * Update a customer in the local list without re-fetching everything.
   * Applies the patch optimistically to both the list and the active customer.
   * Also calls bumpListVersion() so any future subscriber can react to the change.
   */
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
    // Bump version separately — not inside the set() call above so it
    // cannot interact with the list-clearing logic in clearCustomers().
    get().bumpListVersion();
  },

  /**
   * Prepend a newly created customer to the local list.
   * Also bumps listVersion for consistency.
   */
  addLocalCustomer: (customer) => {
    set((state) => ({
      customers: [customer, ...state.customers],
    }));
    get().bumpListVersion();
  },

  /** Search & filter setters */
  setSearchQuery:      (q) => set({ searchQuery: q }),
  setFilterEmission:   (v) => set({ filterEmission: v }),
  setFilterTechnician: (v) => set({ filterTechnician: v }),
  clearFilters:        ()  => set({ searchQuery: '', filterEmission: '', filterTechnician: '' }),

  /**
   * Computed: filtered customer list.
   * Reads from the live `customers` array in the store.
   */
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
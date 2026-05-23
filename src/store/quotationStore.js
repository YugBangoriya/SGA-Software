// src/store/quotationStore.js
// Phase 5 — Quotation Module
// Zustand store for all quotation-related state

import { create } from "zustand";

const useQuotationStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────────────────
  quotations: [],
  currentQuotation: null,
  isLoading: false,
  isSaving: false,
  isSendingWhatsApp: false,
  error: null,

  // Draft state for create form (persists across step navigation)
  draft: {
    // Customer Info
    customerName: "",
    customerPhone: "",
    customerId: null,          // null if not an existing customer record
    isExistingCustomer: false,

    // Vehicle Info
    vehicleCompany: "",        // from Car Repository or manual
    vehicleModel: "",          // from Car Repository or manual
    vehicleYear: "",
    isManualVehicle: false,    // true when "Not in list" selected
    notInListCompany: "",      // typed company when not in list
    notInListModel: "",        // typed model when not in list

    // Car Repository Links (auto-fetched on model selection)
    carRepositoryId: null,
    carDriveLink: "",
    carReelLinks: [],          // array of Instagram reel URLs

    // Line Items
    lineItems: [
      { id: Date.now(), description: "", quantity: 1, unitPrice: 0 },
    ],
    labourCost: 0,

    // Meta
    notes: "",
  },

  // Filters for list screen
  filters: {
    searchQuery: "",
    dateFrom: "",
    dateTo: "",
  },

  // ─── Actions ──────────────────────────────────────────────────────────────

  setLoading: (val) => set({ isLoading: val }),
  setSaving: (val) => set({ isSaving: val }),
  setSendingWhatsApp: (val) => set({ isSendingWhatsApp: val }),
  setError: (err) => set({ error: err }),
  clearError: () => set({ error: null }),

  setQuotations: (quotations) => set({ quotations }),

  setCurrentQuotation: (q) => set({ currentQuotation: q }),
  clearCurrentQuotation: () => set({ currentQuotation: null }),

  // ─── Draft Management ─────────────────────────────────────────────────────

  updateDraft: (fields) =>
    set((state) => ({
      draft: { ...state.draft, ...fields },
    })),

  resetDraft: () =>
    set({
      draft: {
        customerName: "",
        customerPhone: "",
        customerId: null,
        isExistingCustomer: false,
        vehicleCompany: "",
        vehicleModel: "",
        vehicleYear: "",
        isManualVehicle: false,
        notInListCompany: "",
        notInListModel: "",
        carRepositoryId: null,
        carDriveLink: "",
        carReelLinks: [],
        lineItems: [
          { id: Date.now(), description: "", quantity: 1, unitPrice: 0 },
        ],
        labourCost: 0,
        notes: "",
      },
    }),

  // ─── Line Item Helpers ────────────────────────────────────────────────────

  addLineItem: () =>
    set((state) => ({
      draft: {
        ...state.draft,
        lineItems: [
          ...state.draft.lineItems,
          { id: Date.now(), description: "", quantity: 1, unitPrice: 0 },
        ],
      },
    })),

  removeLineItem: (id) =>
    set((state) => ({
      draft: {
        ...state.draft,
        lineItems: state.draft.lineItems.filter((item) => item.id !== id),
      },
    })),

  updateLineItem: (id, fields) =>
    set((state) => ({
      draft: {
        ...state.draft,
        lineItems: state.draft.lineItems.map((item) =>
          item.id === id ? { ...item, ...fields } : item
        ),
      },
    })),

  // ─── Computed ─────────────────────────────────────────────────────────────

  getDraftSubtotal: () => {
    const { lineItems, labourCost } = get().draft;
    const itemsTotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    return itemsTotal + Number(labourCost || 0);
  },

  // ─── Filter Actions ───────────────────────────────────────────────────────

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  clearFilters: () =>
    set({
      filters: { searchQuery: "", dateFrom: "", dateTo: "" },
    }),

  // ─── Derived: Filtered Quotations ─────────────────────────────────────────

  getFilteredQuotations: () => {
    const { quotations, filters } = get();
    const { searchQuery, dateFrom, dateTo } = filters;

    return quotations.filter((q) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        q.quotationNumber?.toLowerCase().includes(query) ||
        q.customerName?.toLowerCase().includes(query) ||
        q.vehicleModel?.toLowerCase().includes(query) ||
        q.vehicleCompany?.toLowerCase().includes(query);

      const qDate = q.createdAt?.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
      const matchesFrom = !dateFrom || qDate >= new Date(dateFrom);
      const matchesTo = !dateTo || qDate <= new Date(dateTo + "T23:59:59");

      return matchesSearch && matchesFrom && matchesTo;
    });
  },
}));

export default useQuotationStore;

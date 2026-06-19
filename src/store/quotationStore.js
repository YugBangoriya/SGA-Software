// SGA — Last updated: loadPriceTableIntoSections now handles grid-mode sections.
// Grid sections store gridColumns + gridRows snapshots so the form and PDF can
// render proper tables. allItems for a grid section = each row as a selectable item
// (row header = name, first numeric cell = price). getDraftSubtotal handles both modes.
// src/store/quotationStore.js

import { create } from "zustand";

// ─── Fresh sections shape ─────────────────────────────────────────────────────
function freshSections() {
  return {
    kits:      { tableMode: "list", shareFullTable: false, selectedItems: [], allItems: [], gridColumns: [], gridRows: [] },
    advancers: { tableMode: "list", shareFullTable: false, selectedItems: [], allItems: [], gridColumns: [], gridRows: [] },
    extras:    { tableMode: "list", shareFullTable: false, selectedItems: [], allItems: [], gridColumns: [], gridRows: [] },
    cylinders: { tableMode: "list", shareFullTable: false, selectedItems: [], allItems: [], gridColumns: [], gridRows: [] },
  };
}

function freshDraft() {
  return {
    customerName:       "",
    customerPhone:      "",
    customerId:         null,
    isExistingCustomer: false,
    vehicleCompany:     "",
    vehicleModel:       "",
    vehicleYear:        "",
    isManualVehicle:    false,
    notInListCompany:   "",
    notInListModel:     "",
    carRepositoryId:    null,
    carDriveLink:       "",
    carReelLinks:       [],
    // Items
    emissionCategory:   "BS4",
    sections:           freshSections(),
    tableNote:          "",
    priceTables:        null,
    // Labour + notes
    labourCost:         0,
    notes:              "",
    // Legacy (kept for backward compat)
    lineItems: [{ id: Date.now(), description: "", quantity: 1, unitPrice: 0 }],
  };
}

// ─── Convert a grid row to a "selectable item" for the form ───────────────────
// The form's SectionAccordion shows grid rows as selectable items.
// Name = row header (or "Row N"). Price = first numeric cell value.
function gridRowToItem(row, idx) {
  const firstNumeric = Object.values(row.cells || {}).find(
    (v) => v !== "" && !isNaN(parseFloat(v))
  );
  return {
    id:          row.id,
    name:        row.header?.trim() || `Row ${idx + 1}`,
    price:       parseFloat(firstNumeric) || 0,
    isGridRow:   true,
    rowData:     row,      // full row snapshot for PDF use
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const useQuotationStore = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────────────────────────
  quotations:        [],
  currentQuotation:  null,
  isLoading:         false,
  isSaving:          false,
  isSendingWhatsApp: false,
  error:             null,
  draft:             freshDraft(),
  filters: { searchQuery: "", dateFrom: "", dateTo: "" },

  // ─── Basics ────────────────────────────────────────────────────────────────
  setLoading:           (v)  => set({ isLoading: v }),
  setSaving:            (v)  => set({ isSaving: v }),
  setSendingWhatsApp:   (v)  => set({ isSendingWhatsApp: v }),
  setError:             (e)  => set({ error: e }),
  clearError:           ()   => set({ error: null }),
  setQuotations:        (qs) => set({ quotations: qs }),
  setCurrentQuotation:  (q)  => set({ currentQuotation: q }),
  clearCurrentQuotation:()   => set({ currentQuotation: null }),

  updateDraft: (fields) =>
    set((s) => ({ draft: { ...s.draft, ...fields } })),

  resetDraft: () => set({ draft: freshDraft() }),

  // ─── Load price table into sections ────────────────────────────────────────
  // Called when the user reaches Step 3 or changes emission category.
  // Supports both list-mode and grid-mode sections from the price table.
  loadPriceTableIntoSections: (tableData) =>
    set((state) => {
      const KEYS = ["kits", "advancers", "extras", "cylinders"];
      const newSections = { ...state.draft.sections };

      KEYS.forEach((key) => {
        const raw      = tableData?.[key] || {};
        const tableMode = raw.tableMode || "list";
        const isGrid    = tableMode === "grid";

        // allItems: what the form shows when "Share Full Table" is off
        // For grid: convert each row to a selectable item
        // For list: use items array directly
        const allItems = isGrid
          ? (raw.rows || []).map((row, idx) => gridRowToItem(row, idx))
          : (raw.items || []);

        newSections[key] = {
          tableMode,
          shareFullTable:  raw.shareFullByDefault || false,
          selectedItems:   [],
          allItems,
          // Grid snapshot — stored for PDF rendering
          gridColumns:     isGrid ? (raw.columns || []) : [],
          gridRows:        isGrid ? (raw.rows    || []) : [],
        };
      });

      return {
        draft: {
          ...state.draft,
          sections:    newSections,
          tableNote:   tableData?.note || "",
          priceTables: tableData,
        },
      };
    }),

  // ─── Section actions ────────────────────────────────────────────────────────

  updateSection: (key, data) =>
    set((s) => ({
      draft: { ...s.draft, sections: { ...s.draft.sections, [key]: { ...s.draft.sections[key], ...data } } },
    })),

  toggleSectionFullTable: (key) =>
    set((s) => {
      const sec = s.draft.sections[key];
      return {
        draft: {
          ...s.draft,
          sections: { ...s.draft.sections, [key]: { ...sec, shareFullTable: !sec.shareFullTable } },
        },
      };
    }),

  toggleSectionItem: (key, item) =>
    set((s) => {
      const sec    = s.draft.sections[key];
      const exists = sec.selectedItems.some((i) => i.id === item.id);
      const newItems = exists
        ? sec.selectedItems.filter((i) => i.id !== item.id)
        : [...sec.selectedItems, { ...item }];
      return {
        draft: {
          ...s.draft,
          sections: { ...s.draft.sections, [key]: { ...sec, selectedItems: newItems } },
        },
      };
    }),

  updateSectionItemPrice: (key, itemId, price) =>
    set((s) => {
      const sec      = s.draft.sections[key];
      const newItems = sec.selectedItems.map((i) => (i.id === itemId ? { ...i, price } : i));
      return {
        draft: {
          ...s.draft,
          sections: { ...s.draft.sections, [key]: { ...sec, selectedItems: newItems } },
        },
      };
    }),

  setEmissionCategory: (cat) =>
    set((s) => ({
      draft: { ...s.draft, emissionCategory: cat, sections: freshSections(), tableNote: "" },
    })),

  setTableNote:   (note)   => set((s) => ({ draft: { ...s.draft, tableNote:   note   } })),
  setPriceTables: (tables) => set((s) => ({ draft: { ...s.draft, priceTables: tables } })),

  // ─── Legacy line item helpers ───────────────────────────────────────────────
  addLineItem: () =>
    set((s) => ({
      draft: { ...s.draft, lineItems: [...s.draft.lineItems, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }] },
    })),

  removeLineItem: (id) =>
    set((s) => ({ draft: { ...s.draft, lineItems: s.draft.lineItems.filter((i) => i.id !== id) } })),

  updateLineItem: (id, fields) =>
    set((s) => ({
      draft: { ...s.draft, lineItems: s.draft.lineItems.map((i) => (i.id === id ? { ...i, ...fields } : i)) },
    })),

  // ─── Computed subtotal ─────────────────────────────────────────────────────
  // Works for both list-mode and grid-mode sections.
  // In grid mode with shareFullTable: sums first numeric cell of every row.
  // In grid mode without shareFullTable: sums selected row "prices" (first numeric cell).
  getDraftSubtotal: () => {
    const { sections, lineItems, labourCost } = get().draft;
    let itemsTotal = 0;

    if (sections) {
      Object.values(sections).forEach((sec) => {
        const pool = sec.shareFullTable ? (sec.allItems || []) : (sec.selectedItems || []);
        pool.forEach((item) => { itemsTotal += Number(item.price || 0); });
      });
    } else {
      (lineItems || []).forEach((item) => {
        itemsTotal += Number(item.quantity || 1) * Number(item.unitPrice || 0);
      });
    }

    return itemsTotal + Number(labourCost || 0);
  },

  // ─── Filters ────────────────────────────────────────────────────────────────
  setFilter:    (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
  clearFilters: ()     => set({ filters: { searchQuery: "", dateFrom: "", dateTo: "" } }),

  getFilteredQuotations: () => {
    const { quotations, filters } = get();
    const { searchQuery, dateFrom, dateTo } = filters;

    return quotations.filter((q) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        q.quotationNumber?.toLowerCase().includes(query) ||
        (q.customerName || "").toLowerCase().includes(query) ||
        q.vehicleModel?.toLowerCase().includes(query) ||
        q.vehicleCompany?.toLowerCase().includes(query);

      const qDate       = q.createdAt?.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
      const matchesFrom = !dateFrom || qDate >= new Date(dateFrom);
      const matchesTo   = !dateTo   || qDate <= new Date(dateTo + "T23:59:59");

      return matchesSearch && matchesFrom && matchesTo;
    });
  },
}));

export default useQuotationStore;
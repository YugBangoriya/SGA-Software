// SGA — Last updated: Added deleteItem action + fixed fetchItem error state (no more stuck loading)
/**
 * Inventory Store — Shree Ganesh Automobile
 * Zustand global state for the Inventory module.
 *
 * FIX: fetchItem now tracks a separate `itemError` field.
 * Previously if getInventoryItem() threw, `loading` became false but
 * `selectedItem` stayed null — causing ItemDetailPage to show "Loading item..."
 * forever (the condition was `loading || !selectedItem`).
 * Now the detail page can distinguish "still loading" from "load failed".
 */

import { create } from 'zustand';
import {
  getInventoryItems,
  getInventoryItem,
  getCategories,
  getLowStockItems,
  getRestockHistory,
  addInventoryItem,
  replenishInventoryItem,
  updateInventoryItem,
  updateLowStockThreshold,
  addCategory,
  updateCategory,
  deleteCategory,
  deleteInventoryItem,
} from '../lib/inventoryService';

const useInventoryStore = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────────────────────
  items:           [],
  categories:      [],
  lowStockItems:   [],
  selectedItem:    null,
  restockHistory:  [],

  loading:           false,   // list-level loading
  itemLoading:       false,   // item detail loading (separate from list)
  itemError:         null,    // item detail fetch error (null = no error)
  historyLoading:    false,
  categoriesLoading: false,
  error:             null,

  // ─── Fetch Items (list) ────────────────────────────────────────────────

  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const items = await getInventoryItems();
      const lowStockItems = items.filter(
        (item) => item.quantity <= (item.lowStockThreshold ?? 5)
      );
      set({ items, lowStockItems, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // FIX: uses `itemLoading` + `itemError` instead of shared `loading`.
  // ItemDetailPage checks `itemLoading || (!selectedItem && !itemError)`
  // so a fetch failure no longer leaves the page stuck on the spinner.
  fetchItem: async (itemId) => {
    set({ itemLoading: true, itemError: null, selectedItem: null });
    try {
      const item = await getInventoryItem(itemId);
      set({ selectedItem: item, itemLoading: false });
    } catch (err) {
      set({ itemError: err.message, itemLoading: false });
    }
  },

  fetchCategories: async () => {
    set({ categoriesLoading: true });
    try {
      const categories = await getCategories();
      set({ categories, categoriesLoading: false });
    } catch (err) {
      console.error('[InventoryStore] fetchCategories failed:', err);
      set({ categoriesLoading: false });
    }
  },

  fetchRestockHistory: async (itemId) => {
    set({ historyLoading: true });
    try {
      const restockHistory = await getRestockHistory(itemId);
      set({ restockHistory, historyLoading: false });
    } catch (err) {
      console.error('[InventoryStore] fetchRestockHistory failed:', err);
      set({ historyLoading: false, restockHistory: [] });
    }
  },

  refreshLowStock: async () => {
    try {
      const lowStockItems = await getLowStockItems();
      set({ lowStockItems });
    } catch (err) {
      console.error('[InventoryStore] refreshLowStock failed:', err);
    }
  },

  // ─── Mutations — Items ─────────────────────────────────────────────────

  addItem: async (itemData, user) => {
    await addInventoryItem({ itemData, user });
    await get().fetchItems();
  },

  replenishItem: async (itemId, replenishData, user) => {
    await replenishInventoryItem({ itemId, replenishData, user });
    await get().fetchItems();
    if (get().selectedItem?.id === itemId) {
      await get().fetchItem(itemId);
      await get().fetchRestockHistory(itemId);
    }
  },

  updateItem: async (itemId, updates, user) => {
    await updateInventoryItem({ itemId, updates, user });
    await get().fetchItems();
    if (get().selectedItem?.id === itemId) {
      await get().fetchItem(itemId);
    }
  },

  setLowStockThreshold: async (itemId, threshold, user) => {
    await updateLowStockThreshold({ itemId, threshold, user });
    await get().fetchItems();
    if (get().selectedItem?.id === itemId) {
      await get().fetchItem(itemId);
    }
  },

  /**
   * Delete one or more inventory items.
   * Removes them optimistically from the local items list immediately.
   * @param {string[]} ids  — Firestore document IDs to delete
   * @param {object}   user — Firebase Auth user object (for audit log)
   */
  deleteItems: async (ids, user) => {
    // Optimistic removal from local list
    set((state) => ({
      items:         state.items.filter((item) => !ids.includes(item.id)),
      lowStockItems: state.lowStockItems.filter((item) => !ids.includes(item.id)),
    }));
    // Fire all deletes in parallel
    await Promise.all(ids.map((id) => deleteInventoryItem(id, user)));
  },

  // ─── Mutations — Categories ────────────────────────────────────────────

  addCategory: async (name, user) => {
    await addCategory({ name, user });
    await get().fetchCategories();
  },

  updateCategory: async (categoryId, newName, user) => {
    await updateCategory({ categoryId, newName, user });
    await get().fetchCategories();
  },

  deleteCategory: async (categoryId, user) => {
    await deleteCategory({ categoryId, user });
    await get().fetchCategories();
  },

  // ─── Local UI State ────────────────────────────────────────────────────

  setSelectedItem: (item) => set({ selectedItem: item, restockHistory: [], itemError: null }),
  clearSelectedItem: ()   => set({ selectedItem: null, restockHistory: [], itemError: null }),
  clearError: ()          => set({ error: null }),
  clearItemError: ()      => set({ itemError: null }),

  getCategoryName: (categoryId) => {
    if (!categoryId) return '—';
    const cat = get().categories.find((c) => c.id === categoryId);
    return cat?.name || categoryId;
  },
}));

export default useInventoryStore;
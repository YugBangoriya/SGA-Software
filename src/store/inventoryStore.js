/**
 * Inventory Store — Shree Ganesh Automobile
 * Zustand global state for the Inventory module.
 *
 * All Firestore calls are delegated to inventoryService.js.
 * Components call store actions; they never call Firestore directly.
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
} from '../lib/inventoryService';

const useInventoryStore = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────────────────────
  items:           [],        // all inventory items (sorted by name)
  categories:      [],        // all categories
  lowStockItems:   [],        // items at or below their threshold
  selectedItem:    null,      // item currently open in detail view
  restockHistory:  [],        // restock history for selectedItem

  loading:         false,     // main items loading spinner
  historyLoading:  false,     // restock history loading
  categoriesLoading: false,
  error:           null,      // last error message (string | null)

  // ─── Fetch Items ───────────────────────────────────────────────────────

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

  fetchItem: async (itemId) => {
    set({ loading: true, error: null });
    try {
      const item = await getInventoryItem(itemId);
      set({ selectedItem: item, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
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
      set({ historyLoading: false });
    }
  },

  // Convenience: refresh low-stock list without full re-fetch
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
    // Refresh items and low-stock list after add
    await get().fetchItems();
  },

  replenishItem: async (itemId, replenishData, user) => {
    await replenishInventoryItem({ itemId, replenishData, user });
    await get().fetchItems();
    // If detail view is open for this item, refresh it too
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

  setSelectedItem: (item) => set({ selectedItem: item, restockHistory: [] }),
  clearSelectedItem: ()   => set({ selectedItem: null, restockHistory: [] }),
  clearError: ()          => set({ error: null }),

  // Utility: get category name by ID (for display)
  getCategoryName: (categoryId) => {
    if (!categoryId) return '—';
    const cat = get().categories.find((c) => c.id === categoryId);
    return cat?.name || categoryId;
  },
}));

export default useInventoryStore;

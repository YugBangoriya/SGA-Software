// SGA — Last updated: Added toggleTrackingMode action (isUntracked toggle); fetchItems lowStock filter excludes untracked items; added updateLocalPurchasePrice action
/**
 * Inventory Store — Shree Ganesh Automobile
 * Zustand global state for the Inventory module.
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
  updateTrackingMode,
  updateLocalItemPurchasePrice,
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

  loading:           false,
  itemLoading:       false,
  itemError:         null,
  historyLoading:    false,
  categoriesLoading: false,
  error:             null,

  // ─── Fetch Items (list) ────────────────────────────────────────────────

  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const items = await getInventoryItems();
      // Low-stock filter: exclude untracked items (they have no ceiling)
      const lowStockItems = items.filter(
        (item) =>
          item.isUntracked !== true &&
          (item.quantity ?? 0) <= (item.lowStockThreshold ?? 5)
      );
      set({ items, lowStockItems, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

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
   * Toggle tracking mode for an item (tracked ↔ untracked).
   * toUntracked=true  → removes quantity field, sets isUntracked=true
   * toUntracked=false → sets isUntracked=false, seeds quantity with startingQty
   */
  toggleTrackingMode: async (itemId, toUntracked, startingQty = 0, user) => {
    await updateTrackingMode({ itemId, toUntracked, startingQty, user });
    await get().fetchItems();
    if (get().selectedItem?.id === itemId) {
      await get().fetchItem(itemId);
    }
  },

  /**
   * Set purchase price on a Local Item (auto-created from invoice approval).
   * Enables profit/loss calculations for that item going forward.
   */
  updateLocalPurchasePrice: async (itemId, purchasePrice, user) => {
    await updateLocalItemPurchasePrice({ itemId, purchasePrice, user });
    await get().fetchItems();
    if (get().selectedItem?.id === itemId) {
      await get().fetchItem(itemId);
    }
  },

  deleteItems: async (ids, user) => {
    set((state) => ({
      items:         state.items.filter((item) => !ids.includes(item.id)),
      lowStockItems: state.lowStockItems.filter((item) => !ids.includes(item.id)),
    }));
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

  setSelectedItem:  (item) => set({ selectedItem: item, restockHistory: [], itemError: null }),
  clearSelectedItem: ()   => set({ selectedItem: null, restockHistory: [], itemError: null }),
  clearError:        ()   => set({ error: null }),
  clearItemError:    ()   => set({ itemError: null }),

  getCategoryName: (categoryId) => {
    if (!categoryId) return '—';
    const cat = get().categories.find((c) => c.id === categoryId);
    return cat?.name || categoryId;
  },
}));

export default useInventoryStore;
/**
 * reminderStore.js
 * Zustand store for Phase 9: CNG Re-Testing Reminder System.
 *
 * Holds:
 *   - Full reminder log list
 *   - Per-customer reminder history
 *   - Filter/search state
 *   - Loading/error state
 *   - Summary counts (for dashboard widget)
 */

import { create } from 'zustand';
import {
  fetchAllReminders,
  fetchCustomerReminders,
  fetchPendingReminders,
  fetchReminderSummary,
  markCustomerRetested,
} from '../lib/reminderService';

const useReminderStore = create((set, get) => ({
  // ── Reminder log list ──────────────────────────────────────────────────────
  reminders:       [],
  isLoadingList:   false,
  listError:       null,

  // ── Per-customer reminder history ──────────────────────────────────────────
  customerReminders:          {},   // { [customerId]: Reminder[] }
  isLoadingCustomerReminders: {},   // { [customerId]: boolean }

  // ── Filter state ───────────────────────────────────────────────────────────
  filterStatus: '',          // '' | 'pending' | 'completed'
  filterType:   '',          // '' | 'warning_3m' | 'warning_2m' | 'warning_1m' | 'final' | 'overdue'
  searchQuery:  '',

  // ── Dashboard summary ──────────────────────────────────────────────────────
  summary: {
    total:   0,
    pending: 0,
    overdue: 0,
  },
  isLoadingSummary: false,

  // ── Mark re-tested state ───────────────────────────────────────────────────
  isMarkingRetested: false,
  markRetestError:   null,

  // ────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ────────────────────────────────────────────────────────────────────────────

  /** Load all reminders from Firestore */
  loadReminders: async () => {
    set({ isLoadingList: true, listError: null });
    try {
      const reminders = await fetchAllReminders();
      set({ reminders, isLoadingList: false });
    } catch (err) {
      set({ listError: err.message, isLoadingList: false });
    }
  },

  /** Load all pending reminders only (lighter query) */
  loadPendingReminders: async () => {
    set({ isLoadingList: true, listError: null });
    try {
      const reminders = await fetchPendingReminders();
      set({ reminders, isLoadingList: false });
    } catch (err) {
      set({ listError: err.message, isLoadingList: false });
    }
  },

  /** Load reminder history for a specific customer */
  loadCustomerReminders: async (customerId) => {
    set((s) => ({
      isLoadingCustomerReminders: { ...s.isLoadingCustomerReminders, [customerId]: true },
    }));
    try {
      const list = await fetchCustomerReminders(customerId);
      set((s) => ({
        customerReminders:          { ...s.customerReminders, [customerId]: list },
        isLoadingCustomerReminders: { ...s.isLoadingCustomerReminders, [customerId]: false },
      }));
    } catch (err) {
      set((s) => ({
        isLoadingCustomerReminders: { ...s.isLoadingCustomerReminders, [customerId]: false },
      }));
    }
  },

  /** Load dashboard summary counts */
  loadSummary: async () => {
    set({ isLoadingSummary: true });
    try {
      const summary = await fetchReminderSummary();
      set({ summary, isLoadingSummary: false });
    } catch (_) {
      set({ isLoadingSummary: false });
    }
  },

  /** Mark a customer as re-tested (Owner action) */
  markRetested: async (params) => {
    set({ isMarkingRetested: true, markRetestError: null });
    try {
      const result = await markCustomerRetested(params);

      // Update local reminder list — mark relevant entries as completed
      set((s) => ({
        reminders: s.reminders.map((r) =>
          r.customerId === params.customerId && r.status === 'pending'
            ? {
                ...r,
                status:           'completed',
                retestDate:        params.retestDate,
                retestRecordedBy:  params.uid,
              }
            : r
        ),
        customerReminders: {
          ...s.customerReminders,
          // Clear cached customer reminders so next load fetches fresh data
          [params.customerId]: undefined,
        },
        isMarkingRetested: false,
      }));

      return result;
    } catch (err) {
      set({ markRetestError: err.message, isMarkingRetested: false });
      throw err;
    }
  },

  // ── Filter actions ─────────────────────────────────────────────────────────
  setFilterStatus:  (v) => set({ filterStatus: v }),
  setFilterType:    (v) => set({ filterType:   v }),
  setSearchQuery:   (q) => set({ searchQuery:  q }),
  clearFilters:     ()  => set({ filterStatus: '', filterType: '', searchQuery: '' }),

  // ── Computed: filtered reminder list ───────────────────────────────────────
  getFilteredReminders: () => {
    const { reminders, filterStatus, filterType, searchQuery } = get();
    const q = searchQuery.toLowerCase().trim();

    return reminders.filter((r) => {
      const matchStatus = !filterStatus || r.status === filterStatus;

      const matchType = !filterType || (
        filterType === 'overdue'
          ? (r.reminderType === 'final' || r.reminderType?.startsWith('overdue_'))
          : r.reminderType === filterType
      );

      const matchSearch =
        !q ||
        r.customerName?.toLowerCase().includes(q) ||
        r.vehicleNo?.toLowerCase().includes(q)    ||
        r.phone?.includes(q);

      return matchStatus && matchType && matchSearch;
    });
  },

  /** Patch a single reminder entry in the local list (e.g. after status update) */
  patchReminder: (id, data) => {
    set((s) => ({
      reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...data } : r)),
    }));
  },
}));

export default useReminderStore;

// SGA — Last updated: Bug Fix #4 — Fixed Owner dashboard showing 0 for all stats. Root cause: single try/catch meant if invoice query failed (due to Firestore rules evaluating invoiceDbLocked() on missing systemConfig/main doc), ALL stats stayed at 0. Now each query is wrapped independently so failures are isolated.
/**
 * useDashboardStats.js
 * Pulls real-time counts for the 4 Home screen summary widgets and recent activity feed.
 *
 * Returns:
 *   stats.pendingInvoices   — invoices awaiting Owner approval
 *   stats.lowStockItems     — inventory items at or below their threshold
 *   stats.upcomingReminders — CNG reminders due in the next 30 days
 *   stats.pendingFollowUps  — follow-ups with status === 'Pending' (including overdue)
 *   recentActivity          — last 8 audit log entries for the activity feed
 *   outstandingAmount       — sum of balanceDue on PARTIALLY_PAID + UNPAID + EMI + LOAN invoices
 *
 * BUG FIX (Owner dashboard showing 0 for everything):
 *   Previously fetchStats() had ONE try/catch block. The first query reads from the
 *   `invoices` collection. For Owner (not SuperAdmin), the Firestore rule evaluates
 *   `invoiceDbLocked()` which calls get(systemConfig/main). If systemConfig/main
 *   does not exist yet (e.g. before the Owner has visited Invoice DB Controls),
 *   accessing .data.invoiceDbLocked on the null result throws a rule evaluation
 *   error → Firestore DENIES the read → getDocs() throws → the entire catch block
 *   fires → setStats() is never called → all 4 stats stay at 0 (initial state).
 *
 *   Fix: Each query now runs in its own try/catch so that one failing query only
 *   zeros out that particular stat, while all other stats load successfully.
 *   Additionally, the invoice query field name was 'approvalStatus' but the actual
 *   Firestore field is 'status'. Fixed to use the correct field name.
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useDashboardStats() {
  const [stats, setStats] = useState({
    pendingInvoices:   0,
    lowStockItems:     0,
    upcomingReminders: 0,
    pendingFollowUps:  0,
    outstandingAmount: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    let unsubActivity;
    let mounted = true;

    const fetchStats = async () => {
      const results = {
        pendingInvoices:   0,
        lowStockItems:     0,
        upcomingReminders: 0,
        pendingFollowUps:  0,
        outstandingAmount: 0,
      };

      // ── 1. Pending invoices (awaiting Owner approval) ─────────────────────
      // FIX: uses 'status' field (not 'approvalStatus' which doesn't exist).
      // Each query is wrapped independently so one failure doesn't block others.
      try {
        const pendingSnap = await getDocs(
          query(
            collection(db, 'invoices'),
            where('status', '==', 'PENDING')
          )
        );
        results.pendingInvoices = pendingSnap.size;
      } catch (err) {
        console.warn('useDashboardStats: pending invoices query failed:', err.code || err.message);
      }

      // ── 2. Low stock items ────────────────────────────────────────────────
      try {
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        let lowStockItems   = 0;
        inventorySnap.docs.forEach((d) => {
          const inv = d.data();
          const qty       = Number(inv.quantity)           || 0;
          const threshold = Number(inv.lowStockThreshold)  || 0;
          if (threshold > 0 && qty <= threshold) lowStockItems++;
        });
        results.lowStockItems = lowStockItems;
      } catch (err) {
        console.warn('useDashboardStats: inventory query failed:', err.code || err.message);
      }

      // ── 3. Upcoming CNG reminders (next 30 days) ──────────────────────────
      try {
        const now      = Timestamp.now();
        const in30Days = Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        );
        const reminderSnap = await getDocs(
          query(
            collection(db, 'reminderLog'),
            where('nextReminderDate', '>=', now),
            where('nextReminderDate', '<=', in30Days)
          )
        );
        results.upcomingReminders = reminderSnap.size;
      } catch (err) {
        console.warn('useDashboardStats: reminder query failed:', err.code || err.message);
      }

      // ── 4. Pending follow-ups ─────────────────────────────────────────────
      try {
        const followUpSnap = await getDocs(
          query(
            collection(db, 'followUps'),
            where('status', '==', 'Pending')
          )
        );
        results.pendingFollowUps = followUpSnap.size;
      } catch (err) {
        console.warn('useDashboardStats: follow-up query failed:', err.code || err.message);
      }

      // ── 5. Outstanding amount ─────────────────────────────────────────────
      try {
        const outstandingSnap = await getDocs(
          query(
            collection(db, 'invoices'),
            where('paymentStatus', 'in', ['PARTIALLY_PAID', 'UNPAID', 'EMI', 'LOAN'])
          )
        );
        results.outstandingAmount = outstandingSnap.docs.reduce((sum, d) => {
          const inv = d.data();
          return sum + (Number(inv.balanceDue) || 0);
        }, 0);
      } catch (err) {
        console.warn('useDashboardStats: outstanding amount query failed:', err.code || err.message);
      }

      if (mounted) {
        setStats(results);
        setLoading(false);
      }
    };

    fetchStats();

    // ── 6. Recent activity — live listener ───────────────────────────────
    try {
      unsubActivity = onSnapshot(
        query(
          collection(db, 'auditLog'),
          orderBy('timestamp', 'desc'),
          limit(8)
        ),
        (snap) => {
          if (mounted) {
            setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        },
        (err) => console.warn('useDashboardStats activity listener error:', err.code || err.message)
      );
    } catch (err) {
      console.warn('useDashboardStats: could not set up activity listener:', err.message);
    }

    return () => {
      mounted = false;
      if (unsubActivity) unsubActivity();
    };
  }, []);

  return { stats, recentActivity, loading };
}

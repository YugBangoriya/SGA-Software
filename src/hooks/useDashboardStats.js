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

    const fetchStats = async () => {
      try {
        // ── 1. Pending invoices (awaiting Owner approval) ─────────────────
        const pendingSnap = await getDocs(
          query(
            collection(db, 'invoices'),
            where('approvalStatus', '==', 'PENDING')
          )
        );
        const pendingInvoices = pendingSnap.size;

        // ── 2. Low stock items ────────────────────────────────────────────
        const inventorySnap = await getDocs(collection(db, 'inventory'));
        let lowStockItems   = 0;
        inventorySnap.docs.forEach((d) => {
          const inv = d.data();
          const qty       = Number(inv.quantity)           || 0;
          const threshold = Number(inv.lowStockThreshold)  || 0;
          if (threshold > 0 && qty <= threshold) lowStockItems++;
        });

        // ── 3. Upcoming CNG reminders (next 30 days) ──────────────────────
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
        const upcomingReminders = reminderSnap.size;

        // ── 4. Pending follow-ups ─────────────────────────────────────────
        const followUpSnap = await getDocs(
          query(
            collection(db, 'followUps'),
            where('status', '==', 'Pending')
          )
        );
        const pendingFollowUps = followUpSnap.size;

        // ── 5. Outstanding amount ─────────────────────────────────────────
        const outstandingSnap = await getDocs(
          query(
            collection(db, 'invoices'),
            where('paymentStatus', 'in', ['PARTIALLY_PAID', 'UNPAID', 'EMI', 'LOAN'])
          )
        );
        const outstandingAmount = outstandingSnap.docs.reduce((sum, d) => {
          const inv = d.data();
          return sum + (Number(inv.balanceDue) || 0);
        }, 0);

        setStats({
          pendingInvoices,
          lowStockItems,
          upcomingReminders,
          pendingFollowUps,
          outstandingAmount,
        });
      } catch (err) {
        console.error('useDashboardStats fetchStats error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // ── 6. Recent activity — live listener ───────────────────────────────
    unsubActivity = onSnapshot(
      query(
        collection(db, 'auditLog'),
        orderBy('timestamp', 'desc'),
        limit(8)
      ),
      (snap) => {
        setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('useDashboardStats activity listener error:', err)
    );

    return () => {
      if (unsubActivity) unsubActivity();
    };
  }, []);

  return { stats, recentActivity, loading };
}

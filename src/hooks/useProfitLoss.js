/**
 * useProfitLoss.js
 * Calculates per-item and per-invoice profit/loss from approved invoices.
 *
 * Data sources:
 *   /invoices  — items[], labourCost, totalAmount, approvalStatus, date, customerName, vehicleNo, invoiceNo
 *   /inventory — itemName, purchasePrice (used as cost basis)
 *
 * An "approved" invoice is one with approvalStatus === 'APPROVED' (set by Phase 4 workflow).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

function normaliseKey(name) {
  return (name || '').toLowerCase().trim();
}

/**
 * @param {Date|null} startDate
 * @param {Date|null} endDate
 */
export function useProfitLoss(startDate = null, endDate = null) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const calculate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ── 1. Approved invoices ─────────────────────────────────────────────
      let invConstraints = [
        where('approvalStatus', '==', 'APPROVED'),
        orderBy('date', 'desc'),
      ];
      if (startDate) {
        invConstraints.push(where('date', '>=', Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        invConstraints.push(where('date', '<=', Timestamp.fromDate(endOfDay)));
      }

      const invoiceSnap = await getDocs(
        query(collection(db, 'invoices'), ...invConstraints)
      );
      const invoices = invoiceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ── 2. Inventory purchase prices (cost basis) ────────────────────────
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const costMap = {}; // itemName (normalised) → purchasePrice
      inventorySnap.docs.forEach((d) => {
        const inv = d.data();
        costMap[normaliseKey(inv.itemName)] = inv.purchasePrice || 0;
      });

      // ── 3. Per-item aggregation ──────────────────────────────────────────
      const itemMap = {}; // normalised name → aggregate

      // ── 4. Per-invoice P&L ───────────────────────────────────────────────
      const byInvoice = invoices.map((inv) => {
        let invoiceRevenue = 0;
        let invoiceCost    = 0;

        (inv.items || []).forEach((item) => {
          const key        = normaliseKey(item.itemName);
          const qty        = Number(item.quantity)  || 0;
          const sellPrice  = Number(item.unitPrice) || 0;
          const costPrice  = costMap[key]            || 0;

          invoiceRevenue += sellPrice * qty;
          invoiceCost    += costPrice  * qty;

          if (!itemMap[key]) {
            itemMap[key] = {
              itemName:      item.itemName,
              purchasePrice: costPrice,
              totalQtySold:  0,
              totalRevenue:  0,
              totalCost:     0,
              invoiceCount:  0,
            };
          }
          itemMap[key].totalQtySold += qty;
          itemMap[key].totalRevenue += sellPrice * qty;
          itemMap[key].totalCost    += costPrice  * qty;
          itemMap[key].invoiceCount += 1;
        });

        // Labour is pure revenue — no inventory cost
        const labour = Number(inv.labourCost) || 0;
        invoiceRevenue += labour;

        const profit = invoiceRevenue - invoiceCost;
        const margin = invoiceRevenue > 0
          ? parseFloat(((profit / invoiceRevenue) * 100).toFixed(1))
          : 0;

        return {
          id:           inv.id,
          invoiceNo:    inv.invoiceNo    || '—',
          customerName: inv.customerName || '—',
          vehicleNo:    inv.vehicleNo    || '—',
          date:         inv.date,
          paymentStatus:inv.paymentStatus || '',
          revenue:      invoiceRevenue,
          cost:         invoiceCost,
          labour,
          profit,
          margin,
          isLoss:       profit < 0,
        };
      });

      // ── 5. Flatten byItem ────────────────────────────────────────────────
      const byItem = Object.values(itemMap)
        .map((item) => {
          const profit      = item.totalRevenue - item.totalCost;
          const avgSell     = item.totalQtySold > 0
            ? item.totalRevenue / item.totalQtySold
            : 0;
          const profitPerUnit = avgSell - item.purchasePrice;

          return {
            itemName:       item.itemName,
            purchasePrice:  item.purchasePrice,
            avgSellingPrice:parseFloat(avgSell.toFixed(2)),
            totalQtySold:   item.totalQtySold,
            totalRevenue:   item.totalRevenue,
            totalCost:      item.totalCost,
            grossProfit:    profit,
            profitPerUnit:  parseFloat(profitPerUnit.toFixed(2)),
            invoiceCount:   item.invoiceCount,
            isLoss:         profit < 0,
          };
        })
        .sort((a, b) => b.grossProfit - a.grossProfit);

      // ── 6. Summary ───────────────────────────────────────────────────────
      const totalRevenue = byInvoice.reduce((s, i) => s + i.revenue, 0);
      const totalCost    = byInvoice.reduce((s, i) => s + i.cost,    0);
      const grossProfit  = totalRevenue - totalCost;
      const margin       = totalRevenue > 0
        ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(1))
        : 0;

      setData({
        summary: { totalRevenue, totalCost, grossProfit, margin },
        byItem,
        byInvoice,
        invoiceCount: invoices.length,
      });
    } catch (err) {
      console.error('useProfitLoss error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate?.getTime(), endDate?.getTime()]); // eslint-disable-line

  useEffect(() => { calculate(); }, [calculate]);

  return { data, loading, error, refetch: calculate };
}

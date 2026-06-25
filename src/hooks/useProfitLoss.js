// SGA — Last updated: Bug Fix — Three field name corrections:
// (1) query field 'approvalStatus' → 'status' (invoiceStore writes status:'APPROVED' not approvalStatus)
// (2) item.unitPrice → item.sellingPrice (InvoiceStepItems saves sellingPrice, not unitPrice)
// (3) item.itemName → item.name (InvoiceStepItems saves name, not itemName)
// Also fixed: orderBy removed from Firestore query (invoiceDate is a string, not Timestamp;
// sorting is now done in JS). Date range filtering also corrected to use invoiceDate string.
/**
 * useProfitLoss.js
 * Calculates per-item and per-invoice profit/loss from approved invoices.
 *
 * Data sources:
 *   /invoices  — items[], labourCost, totalAmount, status, invoiceDate, customerName, vehicleNo, invoiceNo
 *   /inventory — itemName, purchasePrice (used as cost basis)
 *
 * An "approved" invoice is one with status === 'APPROVED' (set by the Phase 4 approval workflow).
 *
 * FIELD NAME CORRECTIONS (v1.5 bug fix):
 *   • invoices use status:'APPROVED' — NOT approvalStatus:'APPROVED'
 *   • invoice items use sellingPrice — NOT unitPrice
 *   • invoice items use name         — NOT itemName
 *   • invoice date is stored as invoiceDate (YYYY-MM-DD string) — NOT a Timestamp field 'date'
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
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
      // FIX: invoiceStore.js saves the field as 'status', not 'approvalStatus'.
      // Querying 'approvalStatus' returned 0 documents, making all P&L values 0.
      const invoiceSnap = await getDocs(
        query(
          collection(db, 'invoices'),
          where('status', '==', 'APPROVED'),
        )
      );

      let invoices = invoiceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ── Date range filtering (JS-level, since invoiceDate is a YYYY-MM-DD string) ──
      if (startDate) {
        const startStr = startDate.toISOString().split('T')[0];
        invoices = invoices.filter((inv) => (inv.invoiceDate || '') >= startStr);
      }
      if (endDate) {
        const endStr = endDate.toISOString().split('T')[0];
        invoices = invoices.filter((inv) => (inv.invoiceDate || '') <= endStr);
      }

      // Sort by invoiceDate descending in JS
      invoices.sort((a, b) => {
        const da = a.invoiceDate || '';
        const db_ = b.invoiceDate || '';
        return db_ > da ? 1 : db_ < da ? -1 : 0;
      });

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
          // FIX: items use 'name' (not 'itemName') and 'sellingPrice' (not 'unitPrice')
          const key        = normaliseKey(item.name);
          const qty        = Number(item.quantity)     || 0;
          const sellPrice  = Number(item.sellingPrice) || 0;   // FIX: was item.unitPrice
          const costPrice  = costMap[key]               || 0;

          invoiceRevenue += sellPrice * qty;
          invoiceCost    += costPrice  * qty;

          if (!itemMap[key]) {
            itemMap[key] = {
              itemName:      item.name,                // FIX: was item.itemName
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
          customerName: inv.customerName || (inv.customerSnapshot?.name) || '—',
          vehicleNo:    inv.vehicleNo    || (inv.vehicleSnapshot?.registrationNo) || '—',
          date:         inv.invoiceDate,   // FIX: was inv.date; field is actually invoiceDate
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
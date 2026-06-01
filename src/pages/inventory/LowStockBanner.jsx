// SGA — Last updated: Untracked items (isUntracked: true) are excluded from low-stock list — they have no stock ceiling
/**
 * LowStockBanner — Shree Ganesh Automobile
 * Shown at the top of the Inventory page when any TRACKED item is at or
 * below its low-stock threshold. Untracked items are never included.
 */

import { useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { COLORS } from '../../lib/designTokens';

export default function LowStockBanner({ items = [], onItemClick }) {
  const [dismissed, setDismissed] = useState(false);

  // Filter out untracked items — they have no stock ceiling so can never be "low"
  const trackedItems = items.filter((i) => i.isUntracked !== true);

  if (dismissed || trackedItems.length === 0) return null;

  const outOfStock   = trackedItems.filter((i) => (i.quantity ?? 0) <= 0);
  const lowStock     = trackedItems.filter((i) => (i.quantity ?? 0) > 0);
  const criticalCount = outOfStock.length;

  return (
    <div style={{
      background:   criticalCount > 0 ? COLORS.statusRedBg : COLORS.statusAmberBg,
      border:       `1.5px solid ${criticalCount > 0 ? '#F5C6C6' : '#FFD8A0'}`,
      borderRadius: 12,
      marginBottom: 14,
      overflow:     'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: trackedItems.length > 0 ? `1px solid ${criticalCount > 0 ? '#F5C6C6' : '#FFD8A0'}` : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} color={criticalCount > 0 ? COLORS.statusRed : COLORS.statusAmber} />
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: criticalCount > 0 ? COLORS.statusRed : COLORS.statusAmber,
            fontFamily: "'Inter', sans-serif",
          }}>
            {criticalCount > 0
              ? `${criticalCount} item${criticalCount > 1 ? 's' : ''} out of stock · ${lowStock.length} low`
              : `${trackedItems.length} item${trackedItems.length > 1 ? 's' : ''} running low on stock`}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.textSecondary }}
          aria-label="Dismiss low stock alert"
        >
          <X size={16} />
        </button>
      </div>

      {/* Item list */}
      <div style={{ padding: '4px 0 6px' }}>
        {trackedItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '7px 14px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: (item.quantity ?? 0) <= 0 ? COLORS.statusRed : COLORS.statusAmber,
                flexShrink: 0,
              }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: "'Inter', sans-serif" }}>
                  {item.itemName}
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, color: (item.quantity ?? 0) <= 0 ? COLORS.statusRed : COLORS.statusAmber, fontFamily: "'Inter', sans-serif" }}>
                  {(item.quantity ?? 0) <= 0
                    ? 'OUT OF STOCK'
                    : `${item.quantity} left (threshold: ${item.lowStockThreshold})`}
                </span>
              </div>
            </div>
            <ChevronRight size={14} color={COLORS.textMuted} />
          </button>
        ))}

        {trackedItems.length > 5 && (
          <p style={{ margin: '4px 14px 2px', fontSize: 12, color: COLORS.textSecondary, fontFamily: "'Inter', sans-serif" }}>
            + {trackedItems.length - 5} more item{trackedItems.length - 5 > 1 ? 's' : ''} — scroll down to view all
          </p>
        )}
      </div>
    </div>
  );
}
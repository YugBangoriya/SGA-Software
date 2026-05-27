// SGA — Last updated: Added Returned Items indicator in summary strip (clickable, shows modal with per-item return quantities); tracks returnedQuantity field set on return invoice approval
/**
 * Inventory Page (Main List Screen) — Shree Ganesh Automobile
 *
 * Access: Owner (read/write) + Employee (read-only) + SuperAdmin (read/write)
 *
 * Features:
 *  - Searchable, filterable item list
 *  - Color-coded stock level indicators (Green/Amber/Red)
 *  - Low-stock banner at top if any items are below threshold
 *  - Desktop: 7-column table layout
 *  - Mobile: card-style rows with key info
 *  - Owner-only: Add Item button + Replenish button per row
 *  - Summary stats strip at bottom
 *  - Mobile FAB for Add Item
 *  - NEW: Owner/SuperAdmin can enter "Select Mode" via the Trash icon in the
 *    header. In select mode each row shows a checkbox. Selecting one or more
 *    items reveals a bottom delete bar. Deleting requires typing "DELETE" in
 *    a confirmation dialog — same 2-step protection used in Customers,
 *    Invoices, and Quotations.
 *
 * FIX (Phase 3 Bug): useAuthStore exposes `firebaseUser` and `role`, NOT
 * `user` and `userRole`. The old destructure made both undefined, causing
 * isOwnerOrAdmin to always be false (Add button hidden) and all write
 * operations to crash (user.uid on undefined). Fixed with aliased destructure.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, SlidersHorizontal, RefreshCw, Trash2, RotateCcw, X } from 'lucide-react';

import useInventoryStore from '../../store/inventoryStore';
import useAuthStore      from '../../store/authStore';
import { COLORS, TYPOGRAPHY, SHADOWS, RADII } from '../../lib/designTokens';
import { useIsMobile }   from '../../hooks/useMediaQuery';
import { formatCurrency, formatDate } from '../../lib/invoiceHelpers';
import LowStockBanner    from './LowStockBanner';
import AddInventoryModal  from './AddInventoryModal';
import ReplenishModal    from './ReplenishModal';
import HomeButton from '../../components/ui/HomeButton';

// ─── Shared Sub-Components ─────────────────────────────────────────────────

export function StockStatusBadge({ quantity, threshold }) {
  let bg, color, label;
  if (quantity <= 0) {
    bg = COLORS.statusRedBg; color = COLORS.statusRed; label = 'OUT OF STOCK';
  } else if (quantity <= threshold) {
    bg = COLORS.statusAmberBg; color = COLORS.statusAmber; label = 'LOW STOCK';
  } else {
    bg = COLORS.statusGreenBg; color = COLORS.statusGreen; label = 'IN STOCK';
  }
  return (
    <span style={{
      background:   bg,
      color,
      fontSize:     10,
      fontWeight:   700,
      padding:      '3px 8px',
      borderRadius: RADII.full,
      letterSpacing: 0.6,
      fontFamily:   TYPOGRAPHY.sans,
      whiteSpace:   'nowrap',
    }}>
      {label}
    </span>
  );
}

export function QuantityDisplay({ quantity, threshold }) {
  let color;
  if (quantity <= 0)         color = COLORS.statusRed;
  else if (quantity <= threshold) color = COLORS.statusAmber;
  else                       color = COLORS.statusGreen;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 9, height: 9, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{
        fontSize:   18,
        fontWeight: 700,
        color,
        fontFamily: TYPOGRAPHY.mono,
        lineHeight: 1,
      }}>
        {quantity}
      </span>
    </div>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────
// Two-step: user must type "DELETE" before the button activates.
// Identical pattern to CustomerList, InvoiceList, QuotationList.

function DeleteConfirmModal({ count, onConfirm, onCancel, isDeleting }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim() === 'DELETE';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={onCancel}
    >
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '28px 24px',
        maxWidth: 360,
        width: '100%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FFEBEE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={22} color="#CC0000" />
          </div>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#222', textAlign: 'center', fontFamily: TYPOGRAPHY.sans }}>
          Delete {count} Inventory Item{count !== 1 ? 's' : ''}?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5, fontFamily: TYPOGRAPHY.sans }}>
          This action is <strong>permanent</strong> and cannot be undone. The selected item{count !== 1 ? 's' : ''} will be removed from inventory.
        </p>

        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#444', fontFamily: TYPOGRAPHY.sans }}>
          Type <strong style={{ color: '#CC0000' }}>DELETE</strong> to confirm:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE here"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1.5px solid ${confirmed ? '#CC0000' : '#E8E2DF'}`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: TYPOGRAPHY.mono,
            outline: 'none',
            marginBottom: 16,
            letterSpacing: 1,
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && confirmed) onConfirm(); }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1, padding: '11px 0',
              background: 'none',
              border: '1.5px solid #E8E2DF',
              borderRadius: 8,
              color: '#444', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: TYPOGRAPHY.sans,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isDeleting}
            style={{
              flex: 1, padding: '11px 0',
              background: confirmed && !isDeleting ? '#CC0000' : '#E0C4C4',
              border: 'none', borderRadius: 8,
              color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: confirmed && !isDeleting ? 'pointer' : 'not-allowed',
              fontFamily: TYPOGRAPHY.sans,
              transition: 'background 0.2s',
            }}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Table Row ─────────────────────────────────────────────────────

function DesktopRow({ item, getCategoryName, isOwnerOrAdmin, onReplenish, onClick, selectMode, selected, onSelect }) {
  return (
    <div
      onClick={selectMode ? onSelect : onClick}
      style={{
        display:               'grid',
        gridTemplateColumns:   selectMode
          ? '36px 2.5fr 1.2fr 110px 90px 130px 140px 110px'
          : '2.5fr 1.2fr 110px 90px 130px 140px 110px',
        alignItems:            'center',
        padding:               '13px 18px',
        borderBottom:          `1px solid ${COLORS.divider}`,
        cursor:                'pointer',
        transition:            'background 0.15s',
        gap:                   0,
        background:            selected ? '#FFF0F0' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#F0EAE8'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? '#FFF0F0' : 'transparent'; }}
    >
      {/* Checkbox (select mode only) */}
      {selectMode && (
        <div style={{
          width: 20, height: 20,
          border: `2px solid ${selected ? '#CC0000' : '#CCBBBB'}`,
          borderRadius: 4,
          background: selected ? '#CC0000' : '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* Item Name */}
      <div style={{ opacity: selectMode && !selected ? 0.7 : 1 }}>
        <p style={{
          margin:     0,
          fontWeight: 600,
          fontSize:   14,
          color:      COLORS.textPrimary,
          fontFamily: TYPOGRAPHY.sans,
        }}>
          {item.itemName}
        </p>
        {item.notes && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
            {item.notes}
          </p>
        )}
      </div>

      {/* Category */}
      <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, opacity: selectMode && !selected ? 0.7 : 1 }}>
        {getCategoryName(item.categoryId)}
      </span>

      {/* Stock Status */}
      <StockStatusBadge quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />

      {/* Quantity */}
      <QuantityDisplay quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />

      {/* Purchase Price */}
      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono, opacity: selectMode && !selected ? 0.7 : 1 }}>
        {formatCurrency(item.purchasePrice)}
      </span>

      {/* Last Restocked */}
      <div style={{ opacity: selectMode && !selected ? 0.7 : 1 }}>
        <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
          {formatDate(item.lastRestockedDate)}
        </span>
        {item.isLastDateManuallySet && (
          <span style={{
            display:      'inline-block',
            marginLeft:   5,
            fontSize:     10,
            background:   COLORS.statusAmberBg,
            color:        COLORS.statusAmber,
            padding:      '1px 5px',
            borderRadius: 4,
            fontWeight:   700,
          }}>
            M
          </span>
        )}
      </div>

      {/* Actions */}
      {!selectMode && (
        isOwnerOrAdmin ? (
          <button
            onClick={(e) => { e.stopPropagation(); onReplenish(item); }}
            style={{
              background:   'transparent',
              color:        COLORS.primary,
              border:       `1.5px solid ${COLORS.primary}`,
              borderRadius: RADII.md,
              padding:      '5px 12px',
              fontSize:     12,
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   TYPOGRAPHY.sans,
              transition:   'all 0.15s',
              whiteSpace:   'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.primary;
              e.currentTarget.style.color = '#FFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = COLORS.primary;
            }}
          >
            + Replenish
          </button>
        ) : (
          <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>View only</span>
        )
      )}
      {selectMode && <div />}
    </div>
  );
}

// ─── Mobile Card Row ───────────────────────────────────────────────────────

function MobileRow({ item, getCategoryName, isOwnerOrAdmin, onReplenish, onClick, selectMode, selected, onSelect }) {
  return (
    <div
      onClick={selectMode ? onSelect : onClick}
      style={{
        padding:       '14px 16px',
        borderBottom:  `1px solid ${COLORS.divider}`,
        cursor:        'pointer',
        transition:    'background 0.15s',
        background:    selected ? '#FFF0F0' : 'transparent',
        display:       'flex',
        gap:           10,
        alignItems:    'flex-start',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#F0EAE8'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? '#FFF0F0' : 'transparent'; }}
    >
      {/* Checkbox (select mode only) */}
      {selectMode && (
        <div style={{
          width: 20, height: 20, marginTop: 2,
          border: `2px solid ${selected ? '#CC0000' : '#CCBBBB'}`,
          borderRadius: 4,
          background: selected ? '#CC0000' : '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      <div style={{ flex: 1, opacity: selectMode && !selected ? 0.7 : 1 }}>
        {/* Top row: name + badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, paddingRight: 10 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
              {item.itemName}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
              {getCategoryName(item.categoryId)}
            </p>
          </div>
          <StockStatusBadge quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
        </div>

        {/* Bottom row: stats + replenish */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <MetaStat label="Qty">
              <QuantityDisplay quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
            </MetaStat>
            <MetaStat label="Price/Unit">
              <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>
                {formatCurrency(item.purchasePrice)}
              </span>
            </MetaStat>
            <MetaStat label="Restocked">
              <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
                {formatDate(item.lastRestockedDate)}
                {item.isLastDateManuallySet && (
                  <span style={{ marginLeft: 4, fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
                    M
                  </span>
                )}
              </span>
            </MetaStat>
          </div>

          {isOwnerOrAdmin && !selectMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onReplenish(item); }}
              style={{
                background:   COLORS.primary,
                color:        '#FFF',
                border:       'none',
                borderRadius: RADII.md,
                padding:      '7px 14px',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   TYPOGRAPHY.sans,
                flexShrink:   0,
              }}
            >
              + Replenish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaStat({ label, children }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 10, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>
        {label}
      </p>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();

  // ── FIX: authStore exposes `firebaseUser` (not `user`) and `role` (not `userRole`).
  // Aliased destructure so all downstream code using `user` and `userRole` stays unchanged.
  const { firebaseUser: user, role: userRole } = useAuthStore();

  const {
    items, categories, lowStockItems, loading, error,
    fetchItems, fetchCategories, getCategoryName,
    deleteItems,
  } = useInventoryStore();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [showAddModal,       setShowAddModal]        = useState(false);
  const [showReplenishModal, setShowReplenishModal]  = useState(false);
  const [replenishTarget,    setReplenishTarget]     = useState(null);

  // ── Select / Delete state ─────────────────────────────────────────────────
  const [showReturnedModal, setShowReturnedModal] = useState(false);
  const [selectMode,      setSelectMode]      = useState(false);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'superadmin';

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  // Exit select mode when search/category filter changes (prevents confusing state)
  useEffect(() => {
    if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); }
  }, [searchQuery, selectedCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter + search
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        (item.itemName || '').toLowerCase().includes(q) ||
        getCategoryName(item.categoryId).toLowerCase().includes(q) ||
        (item.vendorName || '').toLowerCase().includes(q);
      const matchesCategory =
        selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategoryId, categories]);

  // Summary counts
  const inStockCount    = items.filter((i) => i.quantity > (i.lowStockThreshold ?? 5)).length;
  const lowCount        = items.filter((i) => i.quantity > 0 && i.quantity <= (i.lowStockThreshold ?? 5)).length;
  const outOfStockCount = items.filter((i) => i.quantity <= 0).length;
  // Total returned quantity across all items (from returnedQuantity field updated on return invoice approval)
  const returnedCount = items.reduce((sum, i) => sum + (i.returnedQuantity || 0), 0);
  // Items that have had at least one return
  const returnedItems = items.filter((i) => (i.returnedQuantity || 0) > 0);

  const handleReplenish = (item) => {
    setReplenishTarget(item);
    setShowReplenishModal(true);
  };

  const handleRowClick = (item) => {
    navigate(`/inventory/${item.id}`);
  };

  // ── Select / Delete handlers ───────────────────────────────────────────────
  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      await deleteItems([...selectedIds], user);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error('[InventoryPage] delete failed:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.appBg, paddingBottom: 100 }}>

      {/* ── Page Header ── */}
      <div style={{
        background:  COLORS.primary,
        padding:     isMobile ? '18px 16px 14px' : '22px 28px 18px',
        position:    'sticky',
        top:         0,
        zIndex:      50,
        boxShadow:   '0 4px 20px rgba(102,31,31,0.35)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HomeButton />
            <div>
            <h1 style={{
              color:      '#FFFFFF',
              fontSize:   isMobile ? 20 : 24,
              fontWeight: 700,
              margin:     0,
              fontFamily: TYPOGRAPHY.sans,
            }}>
              {selectMode ? `Select Items to Delete` : 'Inventory'}
            </h1>
            <p style={{
              color:      selectMode ? '#FFB8A0' : '#F0BABA',
              fontSize:   12,
              margin:     '3px 0 0',
              fontFamily: TYPOGRAPHY.sans,
            }}>
              {selectMode
                ? `${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} selected — tap to select`
                : `${items.length} item${items.length !== 1 ? 's' : ''}${lowStockItems.length > 0 ? ` · ${lowStockItems.length} need attention` : ''}`
              }
            </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Select mode cancel button */}
            {selectMode && (
              <button
                onClick={toggleSelectMode}
                style={{
                  background:   'rgba(255,255,255,0.15)',
                  color:        '#FFF',
                  border:       '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: RADII.md,
                  padding:      '8px 14px',
                  cursor:       'pointer',
                  fontSize:     13,
                  fontWeight:   600,
                  fontFamily:   TYPOGRAPHY.sans,
                }}
              >
                Cancel
              </button>
            )}

            {/* Trash icon — owner/admin only, not in select mode */}
            {isOwnerOrAdmin && !selectMode && (
              <button
                onClick={toggleSelectMode}
                title="Select items to delete"
                style={{
                  background:   'rgba(255,255,255,0.12)',
                  color:        '#FFC8C8',
                  border:       '1.5px solid rgba(255,255,255,0.22)',
                  borderRadius: RADII.md,
                  padding:      '8px 10px',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                }}
              >
                <Trash2 size={16} />
              </button>
            )}

            {/* Refresh button — hidden in select mode */}
            {!selectMode && (
              <button
                onClick={() => { fetchItems(); fetchCategories(); }}
                style={{
                  background:   'rgba(255,255,255,0.15)',
                  color:        '#FFF',
                  border:       '1.5px solid rgba(255,255,255,0.3)',
                  borderRadius: RADII.md,
                  padding:      '8px 12px',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          4,
                }}
                title="Refresh"
              >
                <RefreshCw size={15} />
                {!isMobile && <span style={{ fontSize: 12, fontFamily: TYPOGRAPHY.sans }}>Refresh</span>}
              </button>
            )}

            {/* Add button — hidden in select mode */}
            {isOwnerOrAdmin && !selectMode && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  background:   '#FFFFFF',
                  color:        COLORS.primary,
                  border:       'none',
                  borderRadius: RADII.md,
                  padding:      '8px 16px',
                  fontWeight:   700,
                  fontSize:     14,
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                  fontFamily:   TYPOGRAPHY.sans,
                  boxShadow:    '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <Plus size={16} />
                {!isMobile && 'Add Item'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '14px 12px 0' : '20px 24px 0' }}>

        {/* ── Low Stock Banner ── */}
        {!selectMode && lowStockItems.length > 0 && (
          <LowStockBanner
            items={lowStockItems}
            onItemClick={(item) => navigate(`/inventory/${item.id}`)}
          />
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div style={{
            background:   COLORS.statusRedBg,
            border:       `1.5px solid #F5C6C6`,
            borderRadius: RADII.lg,
            padding:      '12px 16px',
            marginBottom: 14,
            color:        COLORS.statusRed,
            fontSize:     14,
            fontFamily:   TYPOGRAPHY.sans,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Search & Filter Bar — hidden in select mode ── */}
        {!selectMode && (
          <div style={{
            background:   COLORS.cardBg,
            borderRadius: RADII.lg,
            padding:      '12px 16px',
            marginBottom: 14,
            boxShadow:    SHADOWS.card,
            display:      'flex',
            gap:          10,
            flexWrap:     'wrap',
            alignItems:   'center',
          }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position:  'absolute',
                  left:      11,
                  top:       '50%',
                  transform: 'translateY(-50%)',
                  color:     COLORS.textSecondary,
                }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, vendor..."
                style={{
                  width:        '100%',
                  padding:      '9px 12px 9px 34px',
                  border:       `1.5px solid ${COLORS.tableHeader}`,
                  borderRadius: RADII.md,
                  fontSize:     14,
                  fontFamily:   TYPOGRAPHY.sans,
                  background:   COLORS.white,
                  color:        COLORS.textPrimary,
                  outline:      'none',
                  boxSizing:    'border-box',
                  transition:   'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
              />
            </div>

            {/* Category Filter */}
            <div style={{ position: 'relative' }}>
              <SlidersHorizontal
                size={14}
                style={{
                  position:      'absolute',
                  left:          10,
                  top:           '50%',
                  transform:     'translateY(-50%)',
                  color:         COLORS.textSecondary,
                  pointerEvents: 'none',
                }}
              />
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                style={{
                  padding:      '9px 12px 9px 30px',
                  border:       `1.5px solid ${COLORS.tableHeader}`,
                  borderRadius: RADII.md,
                  fontSize:     13,
                  fontFamily:   TYPOGRAPHY.sans,
                  background:   COLORS.white,
                  color:        COLORS.textPrimary,
                  outline:      'none',
                  cursor:       'pointer',
                  minWidth:     150,
                  appearance:   'none',
                }}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Clear active filters */}
            {(searchQuery || selectedCategoryId !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategoryId('all'); }}
                style={{
                  background:   COLORS.primaryLight,
                  color:        COLORS.primary,
                  border:       `1px solid ${COLORS.primary}`,
                  borderRadius: RADII.full,
                  padding:      '5px 12px',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                  fontFamily:   TYPOGRAPHY.sans,
                  whiteSpace:   'nowrap',
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* ── Select mode helper text ── */}
        {selectMode && (
          <div style={{
            background:   '#FFF8F8',
            border:       `1.5px solid #F5C6C6`,
            borderRadius: RADII.lg,
            padding:      '10px 16px',
            marginBottom: 14,
            fontSize:     13,
            color:        COLORS.statusRed,
            fontFamily:   TYPOGRAPHY.sans,
          }}>
            Tap any item to select it for deletion. Selected items are highlighted in red.
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width:      36,
              height:     36,
              border:     `3px solid ${COLORS.tableHeader}`,
              borderTopColor: COLORS.primary,
              borderRadius: '50%',
              animation:  'sgaSpin 0.7s linear infinite',
              margin:     '0 auto 12px',
            }} />
            <p style={{ color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, fontSize: 14 }}>
              Loading inventory...
            </p>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && filteredItems.length === 0 && (
          <div style={{
            textAlign:    'center',
            padding:      '56px 20px',
            background:   COLORS.cardBg,
            borderRadius: RADII.xl,
            border:       `1.5px dashed ${COLORS.tableHeader}`,
            boxShadow:    SHADOWS.card,
          }}>
            <Package size={52} style={{ color: COLORS.tableHeader, marginBottom: 14 }} />
            <h3 style={{ color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans, margin: '0 0 8px' }}>
              {searchQuery || selectedCategoryId !== 'all'
                ? 'No items match your search'
                : 'No inventory items yet'}
            </h3>
            <p style={{ color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, fontSize: 14, margin: '0 0 20px' }}>
              {isOwnerOrAdmin
                ? 'Click "Add Item" to add your first inventory item and start tracking stock.'
                : 'Inventory items will appear here once the Owner adds them.'}
            </p>
            {isOwnerOrAdmin && !searchQuery && selectedCategoryId === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  background:   COLORS.primary,
                  color:        '#FFF',
                  border:       'none',
                  borderRadius: RADII.md,
                  padding:      '11px 24px',
                  fontWeight:   600,
                  fontSize:     14,
                  cursor:       'pointer',
                  fontFamily:   TYPOGRAPHY.sans,
                }}
              >
                Add First Item
              </button>
            )}
          </div>
        )}

        {/* ── Item List ── */}
        {!loading && filteredItems.length > 0 && (
          <>
            {/* Desktop column headers */}
            {!isMobile && (
              <div style={{
                display:             'grid',
                gridTemplateColumns: selectMode
                  ? '36px 2.5fr 1.2fr 110px 90px 130px 140px 110px'
                  : '2.5fr 1.2fr 110px 90px 130px 140px 110px',
                background:          COLORS.tableHeader,
                borderRadius:        `${RADII.lg}px ${RADII.lg}px 0 0`,
                padding:             '10px 18px',
                border:              `1px solid ${COLORS.divider}`,
                borderBottom:        'none',
                gap:                 0,
              }}>
                {selectMode && <span />}
                {['Item Name', 'Category', 'Status', 'Qty', 'Price / Unit', 'Last Restocked', ''].map((h) => (
                  <span key={h} style={{
                    fontSize:      11,
                    fontWeight:    700,
                    color:         COLORS.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    fontFamily:    TYPOGRAPHY.sans,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* List container */}
            <div style={{
              background:   COLORS.cardBg,
              borderRadius: isMobile ? RADII.lg : `0 0 ${RADII.lg}px ${RADII.lg}px`,
              border:       `1.5px solid ${COLORS.divider}`,
              overflow:     'hidden',
              boxShadow:    SHADOWS.card,
            }}>
              {filteredItems.map((item) =>
                isMobile ? (
                  <MobileRow
                    key={item.id}
                    item={item}
                    getCategoryName={getCategoryName}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    onReplenish={handleReplenish}
                    onClick={() => handleRowClick(item)}
                    selectMode={selectMode}
                    selected={selectedIds.has(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                ) : (
                  <DesktopRow
                    key={item.id}
                    item={item}
                    getCategoryName={getCategoryName}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    onReplenish={handleReplenish}
                    onClick={() => handleRowClick(item)}
                    selectMode={selectMode}
                    selected={selectedIds.has(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                )
              )}
            </div>

            {/* Result count label */}
            <p style={{
              color:      COLORS.textMuted,
              fontSize:   12,
              fontFamily: TYPOGRAPHY.sans,
              margin:     '8px 0 0',
              textAlign:  'right',
            }}>
              Showing {filteredItems.length} of {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </>
        )}

        {/* ── Summary Strip ── */}
        {!loading && items.length > 0 && !selectMode && (
          <div style={{
            background:   COLORS.cardBg,
            borderRadius: RADII.lg,
            padding:      '12px 18px',
            marginTop:    16,
            border:       `1px solid ${COLORS.divider}`,
            display:      'flex',
            gap:          isMobile ? 14 : 28,
            flexWrap:     'wrap',
            alignItems:   'center',
          }}>
            <SummaryPill label="Total Items"     value={items.length} />
            <div style={{ width: 1, height: 18, background: COLORS.divider }} />
            <SummaryPill label="In Stock"        value={inStockCount}    color={COLORS.statusGreen} />
            <SummaryPill label="Low Stock"       value={lowCount}        color={COLORS.statusAmber} />
            <SummaryPill label="Out of Stock"    value={outOfStockCount} color={COLORS.statusRed} />
            <div style={{ width: 1, height: 18, background: COLORS.divider }} />
            <SummaryPill
              label="Returned Items"
              value={returnedCount}
              color="#8B3A3A"
              onClick={returnedCount > 0 ? () => setShowReturnedModal(true) : undefined}
              clickable={returnedCount > 0}
            />
          </div>
        )}
      </div>

      {/* ── Delete Bottom Bar (shown in select mode when items are selected) ── */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position:   'fixed',
          bottom:     0,
          left:       0,
          right:      0,
          zIndex:     100,
          background: '#CC0000',
          padding:    '14px 20px',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow:  '0 -4px 24px rgba(204,0,0,0.35)',
        }}>
          <span style={{ color: '#FFF', fontSize: 14, fontWeight: 600, fontFamily: TYPOGRAPHY.sans }}>
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background:   '#FFFFFF',
              color:        '#CC0000',
              border:       'none',
              borderRadius: RADII.md,
              padding:      '10px 22px',
              fontSize:     14,
              fontWeight:   700,
              cursor:       'pointer',
              fontFamily:   TYPOGRAPHY.sans,
              display:      'flex',
              alignItems:   'center',
              gap:          6,
            }}
          >
            <Trash2 size={15} />
            Delete {selectedIds.size}
          </button>
        </div>
      )}

      {/* ── Mobile FAB ── */}
      {isOwnerOrAdmin && isMobile && !selectMode && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            position:     'fixed',
            bottom:       82,
            right:        18,
            width:        56,
            height:       56,
            borderRadius: '50%',
            background:   COLORS.primary,
            border:       'none',
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            boxShadow:    '0 4px 18px rgba(102,31,31,0.45)',
            zIndex:       40,
          }}
          aria-label="Add inventory item"
        >
          <Plus size={26} color="#FFFFFF" />
        </button>
      )}

      {/* ── Modals ── */}
      {showAddModal && (
        <AddInventoryModal
          categories={categories}
          user={user}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchItems();
          }}
        />
      )}
      {showReplenishModal && replenishTarget && (
        <ReplenishModal
          item={replenishTarget}
          user={user}
          onClose={() => { setShowReplenishModal(false); setReplenishTarget(null); }}
          onSuccess={() => {
            setShowReplenishModal(false);
            setReplenishTarget(null);
            fetchItems();
          }}
        />
      )}
      {showDeleteModal && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Returned Items Modal ── */}
      {showReturnedModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowReturnedModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px 16px 0 0',
              padding: '20px 20px 32px',
              width: '100%',
              maxWidth: 560,
              maxHeight: '75vh',
              overflow: 'auto',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F5E6E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={17} color="#8B3A3A" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#222', fontFamily: TYPOGRAPHY.sans }}>Returned Items</div>
                  <div style={{ fontSize: 12, color: '#888', fontFamily: TYPOGRAPHY.sans }}>Total returned: {returnedCount} unit{returnedCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <button
                onClick={() => setShowReturnedModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Info note */}
            <div style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#CC6600', fontFamily: TYPOGRAPHY.sans }}>
              These are items returned by customers via Return Invoices (RET_INV). Quantities shown are cumulative totals added back to stock from all approved return invoices.
            </div>

            {/* Items list */}
            {returnedItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 30, fontFamily: TYPOGRAPHY.sans }}>No returned items yet.</div>
            ) : (
              returnedItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px',
                    background: idx % 2 === 0 ? '#FDFAF8' : '#FFFFFF',
                    borderRadius: 8,
                    marginBottom: 6,
                    border: '1px solid #E8E2DF',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#222', fontFamily: TYPOGRAPHY.sans }}>{item.itemName}</div>
                    <div style={{ fontSize: 11, color: '#888', fontFamily: TYPOGRAPHY.sans, marginTop: 2 }}>
                      Current stock: {item.quantity} · Category: {getCategoryName(item.categoryId)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#8B3A3A', fontFamily: TYPOGRAPHY.mono }}>{item.returnedQuantity}</div>
                    <div style={{ fontSize: 10, color: '#888', fontFamily: TYPOGRAPHY.sans }}>returned</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes sgaSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SummaryPill({ label, value, color, onClick, clickable }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: clickable ? 'pointer' : 'default', padding: clickable ? '4px 8px' : '0', borderRadius: 8, transition: 'background 0.15s' }}
      onClick={onClick}
      title={clickable ? `Click to view ${label}` : undefined}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = '#F5EDED'; }}
      onMouseLeave={(e) => { if (clickable) e.currentTarget.style.background = 'transparent'; }}
    >
      {color && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
      <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>{label}:</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: color || COLORS.primary, fontFamily: TYPOGRAPHY.sans }}>
        {value}
      </span>
      {clickable && <span style={{ fontSize: 10, color: color || COLORS.primary, marginLeft: 2 }}>↗</span>}
    </div>
  );
}

/**
 * ItemDetailPage — Shree Ganesh Automobile
 * Full detail view for a single inventory item.
 *
 * Shows:
 *  - Current stock level + status badge
 *  - All item metadata (category, threshold, vendor, purchase price)
 *  - Full restock history table (date, qty added, price/unit, vendor, type)
 *  - Owner: Replenish button + Edit Threshold inline
 *  - Employee: read-only view
 *
 * Route: /inventory/:itemId
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Package, Calendar, Tag,
  TruckIcon, AlertTriangle, Edit2, Check, X, History, Info,
} from 'lucide-react';

import useInventoryStore from '../../store/inventoryStore';
import useAuthStore from '../../store/authStore';
import { COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/designTokens';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { QuantityDisplay, StockStatusBadge } from './index';
import { formatCurrency, formatDate } from '../../lib/invoiceHelpers';
import ReplenishModal from './ReplenishModal';

// ─── Restock History Entry Type Badge ────────────────────────────────────

function EntryTypeBadge({ type }) {
  const isInitial = type === 'INITIAL';
  return (
    <span style={{
      fontSize:     10,
      fontWeight:   700,
      padding:      '2px 8px',
      borderRadius: RADII.full,
      letterSpacing: 0.5,
      fontFamily:   TYPOGRAPHY.sans,
      background:   isInitial ? COLORS.statusBlueBg  : COLORS.statusGreenBg,
      color:        isInitial ? COLORS.statusBlue    : COLORS.statusGreen,
    }}>
      {isInitial ? 'INITIAL' : 'REPLENISH'}
    </span>
  );
}

// ─── Inline Threshold Editor ───────────────────────────────────────────────

function ThresholdEditor({ itemId, currentThreshold, user, onSaved }) {
  const { setLowStockThreshold } = useInventoryStore();
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState(String(currentThreshold));
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const handleSave = async () => {
    if (isNaN(value) || Number(value) < 0) {
      setError('Must be 0 or more');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await setLowStockThreshold(itemId, Number(value), user);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>
          {currentThreshold}
        </span>
        <button
          onClick={() => { setValue(String(currentThreshold)); setEditing(true); }}
          style={{
            background:   'none',
            border:       `1px solid ${COLORS.tableHeader}`,
            borderRadius: RADII.sm,
            padding:      '3px 7px',
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          4,
            color:        COLORS.textSecondary,
          }}
        >
          <Edit2 size={11} />
          <span style={{ fontSize: 11, fontFamily: TYPOGRAPHY.sans }}>Edit</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        autoFocus
        style={{
          width:        70,
          padding:      '5px 8px',
          border:       `1.5px solid ${error ? COLORS.statusRed : COLORS.primary}`,
          borderRadius: RADII.sm,
          fontSize:     13,
          fontFamily:   TYPOGRAPHY.mono,
          outline:      'none',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          background:   COLORS.statusGreen,
          color:        '#FFF',
          border:       'none',
          borderRadius: RADII.sm,
          padding:      '5px 8px',
          cursor:       loading ? 'not-allowed' : 'pointer',
          display:      'flex',
          alignItems:   'center',
        }}
      >
        {loading
          ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} />
          : <Check size={13} />
        }
      </button>
      <button
        onClick={() => { setEditing(false); setError(''); }}
        style={{
          background:   'none',
          border:       `1px solid ${COLORS.tableHeader}`,
          borderRadius: RADII.sm,
          padding:      '5px 8px',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          color:        COLORS.textSecondary,
        }}
      >
        <X size={13} />
      </button>
      {error && (
        <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Detail Row ─────────────────────────────────────────────────────────────

function DetailRow({ label, icon, children }) {
  return (
    <div style={{
      display:       'flex',
      gap:           12,
      padding:       '11px 0',
      borderBottom:  `1px solid ${COLORS.divider}`,
      alignItems:    'flex-start',
    }}>
      <div style={{
        width:          32,
        height:         32,
        borderRadius:   RADII.md,
        background:     COLORS.primaryLight,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        marginTop:      1,
      }}>
        <span style={{ color: COLORS.primary }}>{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{
          margin:        0,
          fontSize:      11,
          color:         COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontFamily:    TYPOGRAPHY.sans,
          marginBottom:  4,
        }}>
          {label}
        </p>
        <div>{children}</div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { itemId }   = useParams();
  const navigate     = useNavigate();
  const isMobile     = useIsMobile();
  const { user, userRole } = useAuthStore();

  const {
    selectedItem,
    restockHistory,
    historyLoading,
    loading,
    fetchItem,
    fetchRestockHistory,
    fetchCategories,
    getCategoryName,
  } = useInventoryStore();

  const [showReplenish, setShowReplenish] = useState(false);

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'superadmin';

  useEffect(() => {
    fetchItem(itemId);
    fetchRestockHistory(itemId);
    fetchCategories();
  }, [itemId]);

  if (loading || !selectedItem) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.appBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width:       36,
            height:      36,
            border:      `3px solid ${COLORS.tableHeader}`,
            borderTopColor: COLORS.primary,
            borderRadius: '50%',
            animation:   'sgaSpin 0.7s linear infinite',
            margin:      '0 auto 12px',
          }} />
          <p style={{ color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>Loading item...</p>
        </div>
        <style>{`@keyframes sgaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const item = selectedItem;

  return (
    <div style={{ minHeight: '100vh', background: COLORS.appBg, paddingBottom: 80 }}>

      {/* ── Page Header ── */}
      <div style={{
        background: COLORS.primary,
        padding:    isMobile ? '16px 16px 14px' : '20px 28px 16px',
        boxShadow:  SHADOWS.header,
        position:   'sticky',
        top:        0,
        zIndex:     50,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/inventory')}
            style={{
              background:   'rgba(255,255,255,0.15)',
              border:       '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: RADII.md,
              padding:      '8px 10px',
              cursor:       'pointer',
              color:        '#FFF',
              display:      'flex',
              alignItems:   'center',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>
              {item.itemName}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>
              {getCategoryName(item.categoryId)} · Item Detail
            </p>
          </div>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowReplenish(true)}
              style={{
                background:   '#FFFFFF',
                color:        COLORS.primary,
                border:       'none',
                borderRadius: RADII.md,
                padding:      '9px 18px',
                fontWeight:   700,
                fontSize:     13,
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                fontFamily:   TYPOGRAPHY.sans,
              }}
            >
              <RefreshCw size={14} />
              {!isMobile && 'Replenish'}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 24px' }}>

        {/* ── Two-column grid on desktop ── */}
        <div style={{
          display:             isMobile ? 'block' : 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap:                 20,
          marginBottom:        20,
        }}>

          {/* Left card — Stock Status */}
          <div style={{
            background:   COLORS.cardBg,
            borderRadius: RADII.xl,
            padding:      '20px',
            boxShadow:    SHADOWS.card,
            border:       `1.5px solid ${COLORS.divider}`,
            marginBottom: isMobile ? 16 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Current Stock
              </h3>
              <StockStatusBadge quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Units in Stock
                </p>
                <QuantityDisplay quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
              </div>
              <div style={{ flex: 1 }} />
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
                  Latest Price/Unit
                </p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono, textAlign: 'right' }}>
                  {formatCurrency(item.purchasePrice)}
                </p>
              </div>
            </div>

            {/* Threshold bar */}
            <div style={{ marginTop: 4 }}>
              <div style={{
                height:       8,
                background:   COLORS.tableHeader,
                borderRadius: RADII.full,
                overflow:     'hidden',
                marginBottom: 6,
              }}>
                <div style={{
                  height:     '100%',
                  borderRadius: RADII.full,
                  background:
                    item.quantity <= 0
                      ? COLORS.statusRed
                      : item.quantity <= (item.lowStockThreshold ?? 5)
                      ? COLORS.statusAmber
                      : COLORS.statusGreen,
                  width: `${Math.min(100, Math.max(4, (item.quantity / Math.max(item.quantity * 1.5, item.lowStockThreshold * 2 || 10)) * 100))}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
                Alert threshold: {item.lowStockThreshold ?? 5} units
              </p>
            </div>

            {/* Employee note */}
            {!isOwnerOrAdmin && (
              <div style={{
                marginTop:    12,
                background:   COLORS.statusBlueBg,
                borderRadius: RADII.md,
                padding:      '8px 12px',
                display:      'flex',
                gap:          6,
                alignItems:   'center',
              }}>
                <Info size={13} color={COLORS.statusBlue} />
                <p style={{ margin: 0, fontSize: 11, color: COLORS.statusBlue, fontFamily: TYPOGRAPHY.sans }}>
                  Only the Owner can replenish inventory
                </p>
              </div>
            )}
          </div>

          {/* Right card — Item Details */}
          <div style={{
            background:   COLORS.cardBg,
            borderRadius: RADII.xl,
            padding:      '20px',
            boxShadow:    SHADOWS.card,
            border:       `1.5px solid ${COLORS.divider}`,
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Item Details
            </h3>

            <DetailRow label="Category" icon={<Tag size={14} />}>
              <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
                {getCategoryName(item.categoryId)}
              </span>
            </DetailRow>

            <DetailRow label="Low Stock Threshold" icon={<AlertTriangle size={14} />}>
              {isOwnerOrAdmin ? (
                <ThresholdEditor
                  itemId={item.id}
                  currentThreshold={item.lowStockThreshold ?? 5}
                  user={user}
                  onSaved={() => fetchItem(item.id)}
                />
              ) : (
                <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>
                  {item.lowStockThreshold ?? 5}
                </span>
              )}
            </DetailRow>

            <DetailRow label="Last Restocked" icon={<Calendar size={14} />}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
                  {formatDate(item.lastRestockedDate)}
                </span>
                {item.isLastDateManuallySet && (
                  <span style={{
                    fontSize:     10,
                    background:   COLORS.statusAmberBg,
                    color:        COLORS.statusAmber,
                    padding:      '2px 6px',
                    borderRadius: RADII.sm,
                    fontWeight:   700,
                    fontFamily:   TYPOGRAPHY.sans,
                  }}>
                    M — Manually set
                  </span>
                )}
              </div>
            </DetailRow>

            <DetailRow label="Vendor / Supplier" icon={<TruckIcon size={14} />}>
              <span style={{ fontSize: 14, color: item.vendorName ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
                {item.vendorName || '—'}
              </span>
            </DetailRow>

            {item.notes && (
              <DetailRow label="Internal Notes" icon={<Info size={14} />}>
                <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, lineHeight: 1.5 }}>
                  {item.notes}
                </span>
              </DetailRow>
            )}

            <DetailRow label="Added By" icon={<Package size={14} />}>
              <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
                {item.createdByName} · {formatDate(item.createdAt)}
              </span>
            </DetailRow>
          </div>
        </div>

        {/* ── Restock History ── */}
        <div style={{
          background:   COLORS.cardBg,
          borderRadius: RADII.xl,
          boxShadow:    SHADOWS.card,
          border:       `1.5px solid ${COLORS.divider}`,
          overflow:     'hidden',
        }}>
          <div style={{
            padding:        '14px 20px',
            borderBottom:   `1px solid ${COLORS.divider}`,
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            background:     COLORS.tableHeader,
          }}>
            <History size={16} color={COLORS.primary} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans }}>
              Restock History
            </h3>
            <span style={{
              marginLeft:   'auto',
              background:   COLORS.primaryLight,
              color:        COLORS.primary,
              fontSize:     11,
              fontWeight:   700,
              padding:      '2px 8px',
              borderRadius: RADII.full,
              fontFamily:   TYPOGRAPHY.sans,
            }}>
              {restockHistory.length} batch{restockHistory.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {historyLoading && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{
                width:       28,
                height:      28,
                border:      `2px solid ${COLORS.tableHeader}`,
                borderTopColor: COLORS.primary,
                borderRadius: '50%',
                animation:   'sgaSpin 0.7s linear infinite',
                margin:      '0 auto',
              }} />
            </div>
          )}

          {!historyLoading && restockHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, fontSize: 14 }}>
              No restock history found.
            </div>
          )}

          {!historyLoading && restockHistory.length > 0 && (
            <>
              {/* Desktop table headers */}
              {!isMobile && (
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: '1.4fr 90px 130px 1.2fr 120px 100px',
                  padding:             '9px 20px',
                  borderBottom:        `1px solid ${COLORS.divider}`,
                }}>
                  {['Date', 'Qty Added', 'Price/Unit', 'Vendor', 'Added By', 'Type'].map((h) => (
                    <span key={h} style={{
                      fontSize:      10,
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

              {restockHistory.map((entry, idx) => (
                isMobile
                  ? <MobileHistoryRow key={entry.id} entry={entry} />
                  : <DesktopHistoryRow key={entry.id} entry={entry} isLast={idx === restockHistory.length - 1} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Replenish Modal ── */}
      {showReplenish && (
        <ReplenishModal
          item={item}
          user={user}
          onClose={() => setShowReplenish(false)}
          onSuccess={() => setShowReplenish(false)}
        />
      )}

      <style>{`@keyframes sgaSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── History Row Sub-Components ────────────────────────────────────────────

function DesktopHistoryRow({ entry, isLast }) {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: '1.4fr 90px 130px 1.2fr 120px 100px',
      padding:             '12px 20px',
      borderBottom:        isLast ? 'none' : `1px solid ${COLORS.divider}`,
      alignItems:          'center',
    }}>
      <div>
        <span style={{ fontSize: 13, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
          {formatDate(entry.date)}
        </span>
        {entry.isDateManuallySet && (
          <span style={{
            marginLeft:   5,
            fontSize:     10,
            background:   COLORS.statusAmberBg,
            color:        COLORS.statusAmber,
            padding:      '1px 5px',
            borderRadius: 3,
            fontWeight:   700,
          }}>
            M
          </span>
        )}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.statusGreen, fontFamily: TYPOGRAPHY.mono }}>
        +{entry.quantityAdded}
      </span>
      <span style={{ fontSize: 13, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>
        {formatCurrency(entry.purchasePrice)}
      </span>
      <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
        {entry.vendorName || '—'}
      </span>
      <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
        {entry.addedByName}
      </span>
      <EntryTypeBadge type={entry.entryType} />
    </div>
  );
}

function MobileHistoryRow({ entry }) {
  return (
    <div style={{ padding: '13px 16px', borderBottom: `1px solid ${COLORS.divider}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
            {formatDate(entry.date)}
          </span>
          {entry.isDateManuallySet && (
            <span style={{ marginLeft: 6, fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
              M
            </span>
          )}
        </div>
        <EntryTypeBadge type={entry.entryType} />
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>Added</p>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.statusGreen, fontFamily: TYPOGRAPHY.mono }}>+{entry.quantityAdded}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>Price/Unit</p>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>{formatCurrency(entry.purchasePrice)}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>Vendor</p>
          <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>{entry.vendorName || '—'}</span>
        </div>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
        Added by {entry.addedByName}
      </p>
      {entry.notes && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, fontStyle: 'italic' }}>
          "{entry.notes}"
        </p>
      )}
    </div>
  );
}
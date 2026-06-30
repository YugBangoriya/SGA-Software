// SGA — Last updated: Added invoiceRef (Invoice/Order Reference) field to track supplier invoice numbers per replenishment batch
/**
 * ReplenishModal — Shree Ganesh Automobile
 * Owner / SuperAdmin only modal to add more stock to an EXISTING inventory item.
 *
 * Differences from AddInventoryModal:
 *  - Item is pre-selected (passed as prop)
 *  - Shows current stock level before replenishment
 *  - Quantity field adds ON TOP of existing quantity (handled in service)
 *  - Purchase price can differ from previous batch (new batch price)
 *  - Date defaults to today; manual change triggers amber highlight
 *  - NEW: invoiceRef — optional alphanumeric supplier invoice / PO reference number
 */

import { useState, useRef, useEffect } from 'react';
import { X, RefreshCw, AlertTriangle, TrendingUp, Package, FileText } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import { COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/designTokens';
import { QuantityDisplay, StockStatusBadge } from './index';
import { formatCurrency } from '../../lib/invoiceHelpers';

// ─── Helpers ───────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

const inputStyle = (hasError = false, extra = {}) => ({
  width:        '100%',
  padding:      '10px 12px',
  border:       `1.5px solid ${hasError ? COLORS.statusRed : COLORS.tableHeader}`,
  borderRadius: RADII.md,
  fontSize:     14,
  fontFamily:   TYPOGRAPHY.sans,
  background:   COLORS.white,
  color:        COLORS.textPrimary,
  outline:      'none',
  boxSizing:    'border-box',
  transition:   'border-color 0.15s',
  ...extra,
});

function FormField({ label, required, hint, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display:       'block',
        fontSize:      12,
        fontWeight:    600,
        color:         error ? COLORS.statusRed : COLORS.textSecondary,
        fontFamily:    TYPOGRAPHY.sans,
        marginBottom:  5,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}>
        {label}
        {required && <span style={{ color: COLORS.statusRed, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ReplenishModal({ item, user, onClose, onSuccess }) {
  const { replenishItem } = useInventoryStore();
  const today = todayISO();

  const [form, setForm] = useState({
    quantityAdded:         '',
    purchasePrice:         String(item.purchasePrice ?? ''),
    sellingPrice:          item.sellingPrice != null ? String(item.sellingPrice) : '',
    dateOrderedOrReceived: today,
    vendorName:            item.vendorName ?? '',
    invoiceRef:            '',   // NEW — always starts blank; each batch has its own supplier invoice
    notes:                 '',
  });

  const [isDateManuallySet, setIsDateManuallySet] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');

  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'dateOrderedOrReceived') {
      setIsDateManuallySet(value !== today);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.quantityAdded || isNaN(form.quantityAdded) || Number(form.quantityAdded) <= 0)
      errs.quantityAdded = 'Enter a valid quantity to add (must be > 0)';
    if (!form.purchasePrice || isNaN(form.purchasePrice) || Number(form.purchasePrice) < 0)
      errs.purchasePrice = 'Enter a valid purchase price for this batch';
    if (!form.dateOrderedOrReceived)
      errs.dateOrderedOrReceived = 'Date is required';
    if (form.sellingPrice !== '' && (isNaN(form.sellingPrice) || Number(form.sellingPrice) < 0))
      errs.sellingPrice = 'Enter a valid selling price (or leave blank)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const newTotal = (item.quantity ?? 0) + (Number(form.quantityAdded) || 0);

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await replenishItem(
        item.id,
        {
          quantityAdded:         Number(form.quantityAdded),
          purchasePrice:         Number(form.purchasePrice),
          sellingPrice:          form.sellingPrice !== '' ? Number(form.sellingPrice) : null,
          dateOrderedOrReceived: form.dateOrderedOrReceived,
          vendorName:            form.vendorName.trim(),
          invoiceRef:            form.invoiceRef.trim(),   // NEW
          notes:                 form.notes.trim(),
          isDateManuallySet,
        },
        user
      );
      onSuccess();
    } catch (err) {
      setApiError(err.message || 'Failed to replenish. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.45)',
        zIndex:         200,
        display:        'flex',
        alignItems:     'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:    COLORS.cardBg,
        borderRadius:  '20px 20px 0 0',
        width:         '100%',
        maxWidth:      580,
        maxHeight:     '92vh',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     SHADOWS.modal,
        animation:     'sgaSlideUp 0.25s ease-out',
      }}>

        {/* Header */}
        <div style={{
          background:     COLORS.primary,
          padding:        '18px 20px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={20} color="#FFF" />
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>
                Replenish Stock
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>
                Adding stock to: {item.itemName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: RADII.md, padding: 8, cursor: 'pointer', color: '#FFF', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Current stock summary card */}
        <div style={{
          margin:       '16px 20px 0',
          background:   COLORS.white,
          borderRadius: RADII.lg,
          padding:      '12px 16px',
          border:       `1.5px solid ${COLORS.divider}`,
          display:      'flex',
          alignItems:   'center',
          gap:          16,
          flexWrap:     'wrap',
        }}>
          <Package size={18} color={COLORS.primary} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
              {item.itemName}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
              Last purchase price: {formatCurrency(item.purchasePrice)} / unit
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>
                Current Stock
              </p>
              <QuantityDisplay quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
            </div>
            {form.quantityAdded && !isNaN(form.quantityAdded) && Number(form.quantityAdded) > 0 && (
              <>
                <TrendingUp size={16} color={COLORS.statusGreen} />
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>
                    After Replenish
                  </p>
                  <span style={{ fontWeight: 700, fontSize: 18, color: COLORS.statusGreen, fontFamily: TYPOGRAPHY.mono }}>
                    {newTotal}
                  </span>
                </div>
              </>
            )}
          </div>
          <StockStatusBadge quantity={item.quantity} threshold={item.lowStockThreshold ?? 5} />
        </div>

        {/* Scrollable form body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 4px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Quantity to Add" required error={errors.quantityAdded}>
              <input
                ref={firstRef}
                type="number"
                min="1"
                step="1"
                value={form.quantityAdded}
                onChange={set('quantityAdded')}
                placeholder="0"
                style={inputStyle(!!errors.quantityAdded, { fontFamily: TYPOGRAPHY.mono })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = errors.quantityAdded ? COLORS.statusRed : COLORS.tableHeader)}
              />
            </FormField>

            <FormField
              label="Purchase Price / Unit (₹)"
              required
              error={errors.purchasePrice}
              hint="New batch price — stored separately for profit tracking"
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={set('purchasePrice')}
                placeholder="0.00"
                style={inputStyle(!!errors.purchasePrice, { fontFamily: TYPOGRAPHY.mono })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = errors.purchasePrice ? COLORS.statusRed : COLORS.tableHeader)}
              />
            </FormField>

            <FormField
              label="Selling Price / Unit (₹)"
              error={errors.sellingPrice}
              hint="Auto-filled in invoices — leave blank to keep current"
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={set('sellingPrice')}
                placeholder="0.00"
                style={inputStyle(!!errors.sellingPrice, {
                  fontFamily:  TYPOGRAPHY.mono,
                  borderColor: COLORS.primary,
                  background:  '#FDFAF8',
                })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = errors.sellingPrice ? COLORS.statusRed : COLORS.primary)}
              />
            </FormField>
          </div>

          {/* Price change notice */}
          {form.purchasePrice &&
            !isNaN(form.purchasePrice) &&
            Number(form.purchasePrice) !== Number(item.purchasePrice) &&
            Number(form.purchasePrice) > 0 && (
            <div style={{
              background:   Number(form.purchasePrice) > Number(item.purchasePrice)
                              ? COLORS.statusAmberBg
                              : COLORS.statusGreenBg,
              borderRadius: RADII.md,
              padding:      '8px 12px',
              marginTop:    -8,
              marginBottom: 14,
              fontSize:     12,
              color:        Number(form.purchasePrice) > Number(item.purchasePrice)
                              ? COLORS.statusAmber
                              : COLORS.statusGreen,
              fontFamily:   TYPOGRAPHY.sans,
            }}>
              {Number(form.purchasePrice) > Number(item.purchasePrice)
                ? `⬆ Price increased from ${formatCurrency(item.purchasePrice)} → ${formatCurrency(form.purchasePrice)} per unit`
                : `⬇ Price decreased from ${formatCurrency(item.purchasePrice)} → ${formatCurrency(form.purchasePrice)} per unit`}
            </div>
          )}

          <FormField
            label="Date Ordered / Received"
            required
            error={errors.dateOrderedOrReceived}
          >
            <input
              type="date"
              value={form.dateOrderedOrReceived}
              onChange={set('dateOrderedOrReceived')}
              style={inputStyle(!!errors.dateOrderedOrReceived, {
                fontFamily:  TYPOGRAPHY.mono,
                background:  isDateManuallySet ? COLORS.statusAmberBg : COLORS.white,
                borderColor: isDateManuallySet ? COLORS.statusAmber   : COLORS.tableHeader,
                color:       isDateManuallySet ? COLORS.statusAmber   : COLORS.textPrimary,
              })}
            />
            {isDateManuallySet && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <AlertTriangle size={12} color={COLORS.statusAmber} />
                <span style={{ fontSize: 11, color: COLORS.statusAmber, fontFamily: TYPOGRAPHY.sans }}>
                  Date manually changed — highlighted in inventory list
                </span>
              </div>
            )}
          </FormField>

          <FormField label="Supplier / Vendor Name" hint="Optional — pre-filled from last entry">
            <input
              value={form.vendorName}
              onChange={set('vendorName')}
              placeholder="e.g. Rama CNG Distributors"
              style={inputStyle()}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
            />
          </FormField>

          {/* NEW — Invoice / Order Reference */}
          <FormField
            label="Invoice / Order Reference"
            hint="Optional — supplier's invoice number or purchase order number for this batch"
          >
            <div style={{ position: 'relative' }}>
              <FileText
                size={13}
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }}
              />
              <input
                value={form.invoiceRef}
                onChange={set('invoiceRef')}
                placeholder="e.g. INV-2026-001, PO-123"
                style={inputStyle(false, { paddingLeft: 32, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.3 })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
              />
            </div>
          </FormField>

          <FormField label="Batch Notes" hint="Optional — e.g. 'Urgent stock refill before Diwali'">
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any notes for this replenishment batch..."
              rows={2}
              style={{
                ...inputStyle(),
                resize:    'vertical',
                minHeight: 60,
              }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
            />
          </FormField>

          {apiError && (
            <div style={{
              background:   COLORS.statusRedBg,
              border:       `1px solid #F5C6C6`,
              borderRadius: RADII.md,
              padding:      '10px 14px',
              color:        COLORS.statusRed,
              fontSize:     13,
              fontFamily:   TYPOGRAPHY.sans,
              marginBottom: 16,
            }}>
              ⚠ {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:        '14px 20px',
          borderTop:      `1px solid ${COLORS.divider}`,
          display:        'flex',
          gap:            10,
          justifyContent: 'flex-end',
          background:     COLORS.cardBg,
          flexShrink:     0,
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background:   'transparent',
              color:        COLORS.textSecondary,
              border:       `1.5px solid ${COLORS.tableHeader}`,
              borderRadius: RADII.md,
              padding:      '10px 20px',
              fontSize:     14,
              fontWeight:   600,
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   TYPOGRAPHY.sans,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background:     loading ? COLORS.primaryHover : COLORS.primary,
              color:          '#FFF',
              border:         'none',
              borderRadius:   RADII.md,
              padding:        '10px 28px',
              fontSize:       14,
              fontWeight:     700,
              cursor:         loading ? 'not-allowed' : 'pointer',
              fontFamily:     TYPOGRAPHY.sans,
              minWidth:       130,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            8,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width:          15,
                  height:         15,
                  border:         '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFF',
                  borderRadius:   '50%',
                  animation:      'sgaSpin 0.7s linear infinite',
                }} />
                Saving...
              </>
            ) : (
              `+ Add ${form.quantityAdded ? Number(form.quantityAdded) : ''} to Stock`
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sgaSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes sgaSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
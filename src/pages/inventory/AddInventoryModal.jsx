/**
 * AddInventoryModal — Shree Ganesh Automobile
 * Owner / SuperAdmin only modal to add a brand-new inventory item.
 *
 * Rules enforced here:
 *  - Only rendered for owner / superadmin (parent also guards)
 *  - Date defaults to today; manual changes get amber highlight + M badge
 *  - Low stock threshold defaults to 5 but is editable per-item
 *  - On success → calls inventoryStore.addItem() → updates global state
 */

import { useState, useRef, useEffect } from 'react';
import { X, Package, Calendar, Tag, Hash, DollarSign, Truck, AlertTriangle, Info } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import { COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/designTokens';

// ─── Helper ────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Shared styled input ───────────────────────────────────────────────────

function FormField({
  label, required, hint, error, children,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display:     'block',
        fontSize:    12,
        fontWeight:  600,
        color:       error ? COLORS.statusRed : COLORS.textSecondary,
        fontFamily:  TYPOGRAPHY.sans,
        marginBottom: 5,
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

const inputStyle = (hasError = false, extraStyle = {}) => ({
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
  ...extraStyle,
});

// ─── Main Component ────────────────────────────────────────────────────────

export default function AddInventoryModal({ categories, user, onClose, onSuccess }) {
  const { addItem } = useInventoryStore();

  const today = todayISO();

  const [form, setForm] = useState({
    itemName:            '',
    categoryId:          '',
    quantityAdded:       '',
    purchasePrice:       '',
    dateOrderedOrReceived: today,
    vendorName:          '',
    lowStockThreshold:   '5',
    notes:               '',
  });

  const [isDateManuallySet, setIsDateManuallySet] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');

  const firstInputRef = useRef(null);

  // Focus first field on mount
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));

    // Track if date was manually changed from today
    if (field === 'dateOrderedOrReceived') {
      setIsDateManuallySet(value !== today);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.itemName.trim())    errs.itemName      = 'Item name is required';
    if (!form.quantityAdded || isNaN(form.quantityAdded) || Number(form.quantityAdded) <= 0)
      errs.quantityAdded = 'Enter a valid quantity (must be > 0)';
    if (!form.purchasePrice || isNaN(form.purchasePrice) || Number(form.purchasePrice) < 0)
      errs.purchasePrice = 'Enter a valid purchase price';
    if (!form.dateOrderedOrReceived)
      errs.dateOrderedOrReceived = 'Date is required';
    if (!form.lowStockThreshold || isNaN(form.lowStockThreshold) || Number(form.lowStockThreshold) < 0)
      errs.lowStockThreshold = 'Enter a valid threshold (0 or more)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await addItem(
        {
          itemName:              form.itemName.trim(),
          categoryId:            form.categoryId,
          quantityAdded:         Number(form.quantityAdded),
          purchasePrice:         Number(form.purchasePrice),
          dateOrderedOrReceived: form.dateOrderedOrReceived,
          vendorName:            form.vendorName.trim(),
          lowStockThreshold:     Number(form.lowStockThreshold),
          notes:                 form.notes.trim(),
          isDateManuallySet,
        },
        user
      );
      onSuccess();
    } catch (err) {
      setApiError(err.message || 'Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Overlay */
    <div
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.45)',
        zIndex:          200,
        display:         'flex',
        alignItems:      'flex-end',
        justifyContent:  'center',
        backdropFilter:  'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div style={{
        background:   COLORS.cardBg,
        borderRadius: '20px 20px 0 0',
        width:        '100%',
        maxWidth:     640,
        maxHeight:    '92vh',
        overflow:     'hidden',
        display:      'flex',
        flexDirection: 'column',
        boxShadow:    SHADOWS.modal,
        animation:    'sgaSlideUp 0.25s ease-out',
      }}>

        {/* Header */}
        <div style={{
          background:  COLORS.primary,
          padding:     '18px 20px',
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'space-between',
          flexShrink:  0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} color="#FFF" />
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>
                Add New Inventory Item
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>
                Owner only · Quantity won't be deducted until invoice approval
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

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 4px' }}>

          {/* Section: Item Details */}
          <SectionHeading icon={<Tag size={14} />} label="Item Details" />

          <FormField label="Item Name" required error={errors.itemName}>
            <input
              ref={firstInputRef}
              value={form.itemName}
              onChange={set('itemName')}
              placeholder="e.g. Lovato CNG Kit — 4 Cylinder"
              style={inputStyle(!!errors.itemName)}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = errors.itemName ? COLORS.statusRed : COLORS.tableHeader)}
            />
          </FormField>

          <FormField label="Category" hint="Manage categories in Settings → Inventory Categories">
            <select
              value={form.categoryId}
              onChange={set('categoryId')}
              style={inputStyle(false, { appearance: 'none', cursor: 'pointer' })}
            >
              <option value="">— Select a category (optional) —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </FormField>

          {/* Section: Stock Details */}
          <SectionHeading icon={<Hash size={14} />} label="Stock Details" />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Quantity Added" required error={errors.quantityAdded}>
              <input
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
              hint="Cost you paid per unit"
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
          </div>

          <FormField
            label="Low Stock Threshold"
            required
            error={errors.lowStockThreshold}
            hint="You'll get an alert when stock falls to this level"
          >
            <input
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={set('lowStockThreshold')}
              placeholder="5"
              style={inputStyle(!!errors.lowStockThreshold, { fontFamily: TYPOGRAPHY.mono })}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = errors.lowStockThreshold ? COLORS.statusRed : COLORS.tableHeader)}
            />
          </FormField>

          {/* Section: Date & Vendor */}
          <SectionHeading icon={<Calendar size={14} />} label="Receipt Details" />

          <FormField
            label="Date Ordered / Received"
            required
            error={errors.dateOrderedOrReceived}
            hint={isDateManuallySet ? undefined : 'Defaults to today — change if backdating a purchase'}
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
              <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        5,
                marginTop:  5,
              }}>
                <AlertTriangle size={12} color={COLORS.statusAmber} />
                <span style={{ fontSize: 11, color: COLORS.statusAmber, fontFamily: TYPOGRAPHY.sans }}>
                  Date manually changed — this will be highlighted in the inventory list
                </span>
              </div>
            )}
          </FormField>

          <FormField label="Supplier / Vendor Name" hint="Optional — for reference in restock history">
            <input
              value={form.vendorName}
              onChange={set('vendorName')}
              placeholder="e.g. Rama CNG Distributors"
              style={inputStyle()}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
            />
          </FormField>

          {/* Section: Notes */}
          <FormField label="Internal Notes" hint="Optional — visible to Owner and SuperAdmin only">
            <textarea
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any internal notes about this item..."
              rows={2}
              style={{
                ...inputStyle(),
                resize:    'vertical',
                minHeight: 64,
              }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
            />
          </FormField>

          {/* Info callout */}
          <div style={{
            background:   COLORS.statusBlueBg,
            border:       `1px solid #B3CCF0`,
            borderRadius: RADII.md,
            padding:      '10px 14px',
            display:      'flex',
            gap:          8,
            alignItems:   'flex-start',
            marginBottom: 16,
          }}>
            <Info size={14} color={COLORS.statusBlue} style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: COLORS.statusBlue, fontFamily: TYPOGRAPHY.sans, lineHeight: 1.5 }}>
              Stock will be added immediately. Deduction from inventory only happens when an Owner <strong>approves</strong> an invoice — not when Employees create one.
            </p>
          </div>

          {/* API error */}
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
              background:   loading ? COLORS.primaryHover : COLORS.primary,
              color:        '#FFF',
              border:       'none',
              borderRadius: RADII.md,
              padding:      '10px 28px',
              fontSize:     14,
              fontWeight:   700,
              cursor:       loading ? 'not-allowed' : 'pointer',
              fontFamily:   TYPOGRAPHY.sans,
              minWidth:     120,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          8,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width:       15,
                  height:      15,
                  border:      '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFF',
                  borderRadius: '50%',
                  animation:   'sgaSpin 0.7s linear infinite',
                }} />
                Adding...
              </>
            ) : (
              '+ Add to Inventory'
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

function SectionHeading({ icon, label }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          6,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottom: `1.5px solid ${COLORS.tableHeader}`,
    }}>
      <span style={{ color: COLORS.primary }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPOGRAPHY.sans }}>
        {label}
      </span>
    </div>
  );
}

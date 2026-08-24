// SGA — Last updated: Migrated COLORS import from designTokens shim to tokens.js directly
/**
 * AddInventoryModal — Shree Ganesh Automobile
 * Owner / SuperAdmin only modal to add a brand-new inventory item.
 */

import { useState, useRef, useEffect } from 'react';
import { X, Package, Calendar, Tag, Hash, Truck, AlertTriangle, Info, ToggleLeft, ToggleRight, Zap, FileText } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import { COLORS as _COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/tokens';
const COLORS = _COLORS.light;

const todayISO = () => new Date().toISOString().split('T')[0];

function FormField({ label, required, hint, error, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: error ? COLORS.statusRed : COLORS.textSecondary,
        fontFamily: TYPOGRAPHY.sans, marginBottom: 5,
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        {label}
        {required && <span style={{ color: COLORS.statusRed, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>{hint}</p>}
      {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>⚠ {error}</p>}
    </div>
  );
}

const inputStyle = (hasError = false, extraStyle = {}) => ({
  width: '100%', padding: '10px 12px',
  border: `1.5px solid ${hasError ? COLORS.statusRed : COLORS.tableHeader}`,
  borderRadius: RADII.md, fontSize: 14, fontFamily: TYPOGRAPHY.sans,
  background: COLORS.white, color: COLORS.textPrimary,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  ...extraStyle,
});

export default function AddInventoryModal({ categories: _propCategories, user, onClose, onSuccess }) {
  // `items` is used for shortcut uniqueness validation.
  // The InventoryPage always loads items before mounting this modal so the
  // list is already populated here under normal usage.
  const { addItem, categories, categoriesLoading, fetchCategories, items } = useInventoryStore();
  const today = todayISO();
  const [isUntracked, setIsUntracked] = useState(false);

  const [form, setForm] = useState({
    itemName:              '',
    shortcut:              '',
    categoryId:            '',
    quantityAdded:         '',
    purchasePrice:         '',
    sellingPrice:          '',
    dateOrderedOrReceived: today,
    vendorName:            '',
    invoiceRef:            '',   // NEW — optional supplier invoice / order reference number
    lowStockThreshold:     '5',
    notes:                 '',
  });

  const [isDateManuallySet, setIsDateManuallySet] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => { firstInputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  useEffect(() => {
    if (categories.length === 0 && !categoriesLoading) fetchCategories();
  }, []); // eslint-disable-line

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'dateOrderedOrReceived') setIsDateManuallySet(value !== today);
  };

  const validate = () => {
    const errs = {};
    if (!form.itemName.trim()) errs.itemName = 'Item name is required';
    if (!isUntracked) {
      if (!form.quantityAdded || isNaN(form.quantityAdded) || Number(form.quantityAdded) <= 0)
        errs.quantityAdded = 'Enter a valid quantity (must be > 0)';
      if (!form.lowStockThreshold || isNaN(form.lowStockThreshold) || Number(form.lowStockThreshold) < 0)
        errs.lowStockThreshold = 'Enter a valid threshold (0 or more)';
    }
    if (form.purchasePrice !== '' && (isNaN(form.purchasePrice) || Number(form.purchasePrice) < 0))
      errs.purchasePrice = 'Enter a valid purchase price';
    if (form.sellingPrice !== '' && (isNaN(form.sellingPrice) || Number(form.sellingPrice) < 0))
      errs.sellingPrice = 'Enter a valid selling price (or leave blank)';
    if (!form.dateOrderedOrReceived) errs.dateOrderedOrReceived = 'Date is required';

    // ── Shortcut uniqueness check ──────────────────────────────────────
    // Two items cannot share the same shortcut — the exact-match pin in
    // InvoiceStepItems only works reliably when shortcuts are unique.
    const trimmedShortcut = form.shortcut.trim();
    if (trimmedShortcut) {
      const duplicate = items.find(
        (i) => i.shortcut && i.shortcut.toLowerCase() === trimmedShortcut.toLowerCase()
      );
      if (duplicate) {
        errs.shortcut = `Shortcut "${trimmedShortcut}" is already used by "${duplicate.itemName}". Each shortcut must be unique.`;
      }
    }

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
          shortcut:              form.shortcut.trim(),
          categoryId:            form.categoryId,
          quantityAdded:         isUntracked ? null : Number(form.quantityAdded),
          purchasePrice:         form.purchasePrice !== '' ? Number(form.purchasePrice) : null,
          sellingPrice:          form.sellingPrice  !== '' ? Number(form.sellingPrice)  : null,
          dateOrderedOrReceived: form.dateOrderedOrReceived,
          vendorName:            form.vendorName.trim(),
          invoiceRef:            form.invoiceRef.trim(),   // NEW
          lowStockThreshold:     isUntracked ? null : Number(form.lowStockThreshold),
          notes:                 form.notes.trim(),
          isDateManuallySet,
          isUntracked,
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
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: COLORS.cardBg, borderRadius: '20px 20px 0 0', width: '100%',
        maxWidth: 640, maxHeight: '92vh', overflow: 'hidden', display: 'flex',
        flexDirection: 'column', boxShadow: SHADOWS.modal, animation: 'sgaSlideUp 0.25s ease-out',
      }}>

        {/* Header */}
        <div style={{ background: COLORS.primary, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} color="#FFF" />
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>Add New Inventory Item</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>Owner only · Quantity deducted only on invoice approval</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: RADII.md, padding: 8, cursor: 'pointer', color: '#FFF', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 4px' }}>

          <SectionHeading icon={<Tag size={14} />} label="Item Details" />

          {/* Item Name */}
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

          {/* Shortcut / Alias field */}
          <FormField
            label="Search Shortcut / Alias"
            hint="Optional — short code for fast search during invoice creation (e.g. 'ms' for 'M.S. Connector')"
          >
            <div style={{ position: 'relative' }}>
              <Zap size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
              <input
                value={form.shortcut}
                onChange={set('shortcut')}
                placeholder="e.g. ms, cng-kit, 12mm"
                style={inputStyle(false, { paddingLeft: 32, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.5 })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
              />
            </div>
          </FormField>

          {/* Category */}
          <FormField
            label="Category"
            hint={categoriesLoading ? 'Loading categories…' : categories.length === 0 ? 'No categories yet — manage in Settings' : 'Manage categories in Settings → Inventory Categories'}
          >
            <div style={{ position: 'relative' }}>
              <select
                value={form.categoryId}
                onChange={set('categoryId')}
                disabled={categoriesLoading}
                style={inputStyle(false, { appearance: 'none', cursor: categoriesLoading ? 'not-allowed' : 'pointer', opacity: categoriesLoading ? 0.6 : 1 })}
              >
                <option value="">{categoriesLoading ? 'Loading…' : '— Select a category (optional) —'}</option>
                {!categoriesLoading && categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </FormField>

          {/* ── Stock Tracking Toggle ── */}
          <SectionHeading icon={<Hash size={14} />} label="Stock & Pricing" />

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isUntracked ? '#FFF8EE' : '#F0FAF0',
            border: `1.5px solid ${isUntracked ? '#FFD8A0' : '#A8D8A8'}`,
            borderRadius: RADII.md, padding: '12px 14px', marginBottom: 16, cursor: 'pointer',
          }}
            onClick={() => { setIsUntracked((prev) => !prev); setErrors({}); }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isUntracked ? '#CC6600' : '#1A7A1A', fontFamily: TYPOGRAPHY.sans }}>
                {isUntracked ? 'Stock tracking OFF — Untracked item' : 'Stock tracking ON — Tracked item'}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginTop: 2 }}>
                {isUntracked
                  ? 'No stock count — sales volume shown instead. Suitable for items you always have on hand.'
                  : 'Quantity is counted, decremented on invoice approval, low-stock alerts apply.'}
              </div>
            </div>
            <div style={{ flexShrink: 0, marginLeft: 12 }}>
              {isUntracked ? <ToggleLeft size={28} color="#CC6600" /> : <ToggleRight size={28} color="#1A7A1A" />}
            </div>
          </div>

          {/* Tracked fields: Qty + Low Stock Threshold */}
          {!isUntracked && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              <FormField label="Quantity Added" required error={errors.quantityAdded}>
                <input
                  type="number" min="1" step="1" value={form.quantityAdded} onChange={set('quantityAdded')} placeholder="0"
                  style={inputStyle(!!errors.quantityAdded, { fontFamily: TYPOGRAPHY.mono })}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                  onBlur={(e)  => (e.target.style.borderColor = errors.quantityAdded ? COLORS.statusRed : COLORS.tableHeader)}
                />
              </FormField>
              <FormField label="Low Stock Threshold" required error={errors.lowStockThreshold} hint="Alert when stock falls to this level">
                <input
                  type="number" min="0" step="1" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} placeholder="5"
                  style={inputStyle(!!errors.lowStockThreshold, { fontFamily: TYPOGRAPHY.mono })}
                  onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                  onBlur={(e)  => (e.target.style.borderColor = errors.lowStockThreshold ? COLORS.statusRed : COLORS.tableHeader)}
                />
              </FormField>
            </div>
          )}

          {/* Purchase Price + Selling Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Purchase Price / Unit (₹)" error={errors.purchasePrice} hint="Cost you paid per unit (optional)">
              <input
                type="number" min="0" step="0.01" value={form.purchasePrice} onChange={set('purchasePrice')} placeholder="0.00"
                style={inputStyle(!!errors.purchasePrice, { fontFamily: TYPOGRAPHY.mono })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = errors.purchasePrice ? COLORS.statusRed : COLORS.tableHeader)}
              />
            </FormField>
            <FormField label="Selling Price / Unit (₹)" error={errors.sellingPrice} hint="Auto-filled in invoices">
              <input
                type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set('sellingPrice')} placeholder="0.00"
                style={inputStyle(!!errors.sellingPrice, { fontFamily: TYPOGRAPHY.mono, borderColor: COLORS.primary, background: '#FDFAF8' })}
                onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
                onBlur={(e)  => (e.target.style.borderColor = errors.sellingPrice ? COLORS.statusRed : COLORS.primary)}
              />
            </FormField>
          </div>

          {form.sellingPrice !== '' && Number(form.sellingPrice) > 0 && (
            <div style={{ background: '#F0FBF0', border: '1px solid #A8D8A8', borderRadius: RADII.md, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#1A7A1A' }}>
                ✓ Selling price <strong>₹{Number(form.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> will auto-fill in invoices.
              </span>
            </div>
          )}

          {/* Date & Vendor & Invoice Ref */}
          <SectionHeading icon={<Calendar size={14} />} label="Receipt Details" />

          <FormField label="Date Ordered / Received" required error={errors.dateOrderedOrReceived} hint={isDateManuallySet ? undefined : 'Defaults to today'}>
            <input
              type="date" value={form.dateOrderedOrReceived} onChange={set('dateOrderedOrReceived')}
              style={inputStyle(!!errors.dateOrderedOrReceived, {
                fontFamily: TYPOGRAPHY.mono,
                background:  isDateManuallySet ? COLORS.statusAmberBg : COLORS.white,
                borderColor: isDateManuallySet ? COLORS.statusAmber   : COLORS.tableHeader,
                color:       isDateManuallySet ? COLORS.statusAmber   : COLORS.textPrimary,
              })}
            />
            {isDateManuallySet && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <AlertTriangle size={12} color={COLORS.statusAmber} />
                <span style={{ fontSize: 11, color: COLORS.statusAmber, fontFamily: TYPOGRAPHY.sans }}>Date manually changed</span>
              </div>
            )}
          </FormField>

          <FormField label="Supplier / Vendor Name" hint="Optional">
            <input
              value={form.vendorName} onChange={set('vendorName')} placeholder="e.g. Rama CNG Distributors"
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
              <FileText size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
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

          <FormField label="Internal Notes" hint="Optional — Owner and SuperAdmin only">
            <textarea
              value={form.notes} onChange={set('notes')} placeholder="Any internal notes about this item..." rows={2}
              style={{ ...inputStyle(), resize: 'vertical', minHeight: 64 }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = COLORS.tableHeader)}
            />
          </FormField>

          <div style={{ background: COLORS.statusBlueBg, border: `1px solid #B3CCF0`, borderRadius: RADII.md, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
            <Info size={14} color={COLORS.statusBlue} style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: COLORS.statusBlue, fontFamily: TYPOGRAPHY.sans, lineHeight: 1.5 }}>
              {isUntracked
                ? 'This item has no stock count. Sales volume will be tracked instead whenever it appears on an approved invoice.'
                : 'Stock added immediately. Deduction only happens when an Owner approves an invoice.'}
            </p>
          </div>

          {apiError && (
            <div style={{ background: COLORS.statusRedBg, border: `1px solid #F5C6C6`, borderRadius: RADII.md, padding: '10px 14px', color: COLORS.statusRed, fontSize: 13, fontFamily: TYPOGRAPHY.sans, marginBottom: 16 }}>
              ⚠ {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${COLORS.divider}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: COLORS.cardBg, flexShrink: 0 }}>
          <button onClick={onClose} disabled={loading} style={{ background: 'transparent', color: COLORS.textSecondary, border: `1.5px solid ${COLORS.tableHeader}`, borderRadius: RADII.md, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: TYPOGRAPHY.sans }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{ background: loading ? COLORS.primaryHover : COLORS.primary, color: '#FFF', border: 'none', borderRadius: RADII.md, padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: TYPOGRAPHY.sans, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? (
              <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} /> Adding...</>
            ) : '+ Add to Inventory'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sgaSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sgaSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SectionHeading({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: `1.5px solid ${COLORS.tableHeader}` }}>
      <span style={{ color: COLORS.primary }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPOGRAPHY.sans }}>{label}</span>
    </div>
  );
}
// SGA — Last updated: Added shortcut uniqueness check in ShortcutEditor — rejects duplicate shortcuts with the conflicting item name shown in the error. Restock entry editing also present.
/**
 * ItemDetailPage — Shree Ganesh Automobile
 * Full detail view for a single inventory item.
 *
 * NEW FEATURES (Request 1 — Item Field Editors):
 *   Owner/SuperAdmin can now inline-edit Category, Vendor/Supplier, and
 *   Last Restocked Date directly from the Item Details card.
 *
 * NEW FEATURES (Request 2 — Restock Entry Editing):
 *   Owner/SuperAdmin can click an Edit button on any restock history row
 *   to open RestockEntryEditModal and correct: date, quantity, purchase price,
 *   invoice/order reference, vendor name, and notes.
 *   When quantity changes, the service runs a Firestore transaction to
 *   atomically adjust the parent item's stock count by the delta.
 *
 * NEW FEATURES (Request 2 — Invoice/Order Ref column):
 *   The restock history table now shows an "Inv. Ref" column and individual
 *   rows show the supplier invoice/order reference number if one was recorded.
 *
 * Route: /inventory/:itemId
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Package, Calendar, Tag, IndianRupee,
  TruckIcon, AlertTriangle, Edit2, Check, X, History, Info, Trash2,
  ToggleLeft, ToggleRight, Zap, FileText, Pencil,
} from 'lucide-react';

import useInventoryStore from '../../store/inventoryStore';
import useAuthStore      from '../../store/authStore';
import { COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/designTokens';
import { useIsMobile }   from '../../hooks/useMediaQuery';
import { QuantityDisplay, StockStatusBadge } from './index';
import { formatCurrency, formatDate, toISODateString } from '../../lib/invoiceHelpers';
import ReplenishModal from './ReplenishModal';

// ─── Shared inline editor helpers ─────────────────────────────────────────────

const inlineInputStyle = (hasError = false, extra = {}) => ({
  padding: '5px 8px',
  border: `1.5px solid ${hasError ? COLORS.statusRed : COLORS.primary}`,
  borderRadius: RADII.sm,
  fontSize: 13,
  fontFamily: TYPOGRAPHY.sans,
  outline: 'none',
  ...extra,
});

function SaveButton({ onClick, loading, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        background: COLORS.statusGreen, color: '#FFF', border: 'none',
        borderRadius: RADII.sm, padding: '5px 8px',
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading
        ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} />
        : <Check size={13} />}
    </button>
  );
}

function CancelButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: `1px solid ${COLORS.tableHeader}`,
        borderRadius: RADII.sm, padding: '5px 8px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', color: COLORS.textSecondary,
      }}
    >
      <X size={13} />
    </button>
  );
}

function EditButton({ onClick, label = 'Edit' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: `1px solid ${COLORS.tableHeader}`,
        borderRadius: RADII.sm, padding: '3px 7px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, color: COLORS.textSecondary,
      }}
    >
      <Edit2 size={11} />
      <span style={{ fontSize: 11, fontFamily: TYPOGRAPHY.sans }}>{label}</span>
    </button>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteItemModal({ itemName, onConfirm, onCancel, isDeleting }) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim() === 'DELETE';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onCancel}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px 24px', maxWidth: 360, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFEBEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={22} color="#CC0000" />
          </div>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#222', textAlign: 'center', fontFamily: TYPOGRAPHY.sans }}>Delete "{itemName}"?</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5, fontFamily: TYPOGRAPHY.sans }}>This will permanently remove the item from inventory. This action cannot be undone.</p>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#444', fontFamily: TYPOGRAPHY.sans }}>Type <strong style={{ color: '#CC0000' }}>DELETE</strong> to confirm:</p>
        <input
          type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE here" autoFocus
          style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${confirmed ? '#CC0000' : '#E8E2DF'}`, borderRadius: 8, fontSize: 14, fontFamily: TYPOGRAPHY.mono, outline: 'none', marginBottom: 16, letterSpacing: 1, boxSizing: 'border-box' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && confirmed) onConfirm(); }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={isDeleting} style={{ flex: 1, padding: '11px 0', background: 'none', border: '1.5px solid #E8E2DF', borderRadius: 8, color: '#444', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: TYPOGRAPHY.sans }}>Cancel</button>
          <button onClick={onConfirm} disabled={!confirmed || isDeleting} style={{ flex: 1, padding: '11px 0', background: confirmed && !isDeleting ? '#CC0000' : '#E0C4C4', border: 'none', borderRadius: 8, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: confirmed && !isDeleting ? 'pointer' : 'not-allowed', fontFamily: TYPOGRAPHY.sans }}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restock Entry Type Badge ──────────────────────────────────────────────────

function EntryTypeBadge({ type }) {
  const isInitial = type === 'INITIAL';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: RADII.full, letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans, background: isInitial ? COLORS.statusBlueBg : COLORS.statusGreenBg, color: isInitial ? COLORS.statusBlue : COLORS.statusGreen }}>
      {isInitial ? 'INITIAL' : 'REPLENISH'}
    </span>
  );
}

// ─── Inline Shortcut / Alias Editor ───────────────────────────────────────────

function ShortcutEditor({ itemId, currentShortcut, user, onSaved }) {
  // `items` is needed to check shortcut uniqueness across ALL inventory items.
  // We exclude the current item (itemId) so an owner can re-save the same
  // shortcut without a false duplicate error.
  const { updateItem, items } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentShortcut || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmedValue = value.trim();

    // ── Shortcut uniqueness check (exclude this item) ────────────────────
    if (trimmedValue) {
      const duplicate = items.find(
        (i) =>
          i.id !== itemId &&
          i.shortcut &&
          i.shortcut.toLowerCase() === trimmedValue.toLowerCase()
      );
      if (duplicate) {
        setError(`Shortcut "${trimmedValue}" is already used by "${duplicate.itemName}". Each shortcut must be unique.`);
        return;
      }
    }

    setLoading(true); setError('');
    try { await updateItem(itemId, { shortcut: trimmedValue }, user); setEditing(false); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.5, color: currentShortcut ? COLORS.textPrimary : COLORS.textMuted, background: currentShortcut ? COLORS.tableHeader : 'transparent', padding: currentShortcut ? '2px 8px' : 0, borderRadius: RADII.sm }}>
        {currentShortcut || 'Not set'}
      </span>
      <EditButton onClick={() => { setValue(currentShortcut || ''); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input type="text" value={value} autoFocus onChange={(e) => { setValue(e.target.value); setError(''); }} placeholder="e.g. ms, cng-kit"
        style={inlineInputStyle(!!error, { width: 120, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.5 })}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
      />
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>{error}</span>}
    </div>
  );
}

// ─── Inline Category Editor ────────────────────────────────────────────────────

function CategoryEditor({ itemId, currentCategoryId, user, onSaved }) {
  const { updateItem, categories, getCategoryName } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentCategoryId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSave = async () => {
    setLoading(true); setError('');
    try { await updateItem(itemId, { categoryId: value }, user); setEditing(false); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const displayName = getCategoryName(currentCategoryId);
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{displayName}</span>
      <EditButton onClick={() => { setValue(currentCategoryId || ''); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select
        value={value} autoFocus onChange={(e) => { setValue(e.target.value); setError(''); }}
        style={inlineInputStyle(!!error, { minWidth: 160, cursor: 'pointer', appearance: 'auto' })}
      >
        <option value="">— No category —</option>
        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
      </select>
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>{error}</span>}
    </div>
  );
}

// ─── Inline Vendor Editor ──────────────────────────────────────────────────────

function VendorEditor({ itemId, currentVendorName, user, onSaved }) {
  const { updateItem } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentVendorName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSave = async () => {
    setLoading(true); setError('');
    try { await updateItem(itemId, { vendorName: value.trim() }, user); setEditing(false); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, color: currentVendorName ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>{currentVendorName || '—'}</span>
      <EditButton onClick={() => { setValue(currentVendorName || ''); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input type="text" value={value} autoFocus onChange={(e) => { setValue(e.target.value); setError(''); }} placeholder="e.g. Rama CNG Distributors"
        style={inlineInputStyle(!!error, { width: 200 })}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
      />
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>{error}</span>}
    </div>
  );
}

// ─── Inline Last Restocked Date Editor ────────────────────────────────────────

function LastRestockedEditor({ itemId, currentDate, isManuallySet, user, onSaved }) {
  const { updateItem } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(toISODateString(currentDate) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSave = async () => {
    if (!value) { setError('Date is required'); return; }
    setLoading(true); setError('');
    try {
      await updateItem(itemId, { lastRestockedDate: new Date(value), isLastDateManuallySet: true }, user);
      setEditing(false); onSaved?.();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{formatDate(currentDate)}</span>
      {isManuallySet && (
        <span style={{ fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '2px 6px', borderRadius: RADII.sm, fontWeight: 700, fontFamily: TYPOGRAPHY.sans }}>M — Manually set</span>
      )}
      <EditButton onClick={() => { setValue(toISODateString(currentDate) || ''); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input type="date" value={value} autoFocus onChange={(e) => { setValue(e.target.value); setError(''); }}
        style={inlineInputStyle(!!error, { fontFamily: TYPOGRAPHY.mono })}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
      />
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>{error}</span>}
      <span style={{ fontSize: 11, color: COLORS.statusAmber, fontFamily: TYPOGRAPHY.sans, width: '100%' }}>
        ⚠ This updates only the displayed date — not the restock history.
      </span>
    </div>
  );
}

// ─── Inline Threshold Editor ───────────────────────────────────────────────────

function ThresholdEditor({ itemId, currentThreshold, user, onSaved }) {
  const { setLowStockThreshold } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentThreshold));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSave = async () => {
    if (isNaN(value) || Number(value) < 0) { setError('Must be 0 or more'); return; }
    setLoading(true); setError('');
    try { await setLowStockThreshold(itemId, Number(value), user); setEditing(false); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>{currentThreshold}</span>
      <EditButton onClick={() => { setValue(String(currentThreshold)); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" min="0" value={value} autoFocus onChange={(e) => { setValue(e.target.value); setError(''); }}
        style={inlineInputStyle(!!error, { width: 70, fontFamily: TYPOGRAPHY.mono })}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
      />
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>{error}</span>}
    </div>
  );
}

// ─── Inline Selling Price Editor ──────────────────────────────────────────────

function SellingPriceEditor({ itemId, currentSellingPrice, user, onSaved }) {
  const { updateItem } = useInventoryStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentSellingPrice != null && currentSellingPrice > 0 ? String(currentSellingPrice) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleSave = async () => {
    const numVal = value.trim() === '' ? null : Number(value);
    if (value.trim() !== '' && (isNaN(numVal) || numVal < 0)) { setError('Must be a valid price (0 or more)'); return; }
    setLoading(true); setError('');
    try { await updateItem(itemId, { sellingPrice: numVal }, user); setEditing(false); onSaved?.(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const displayValue = currentSellingPrice != null && currentSellingPrice > 0 ? formatCurrency(currentSellingPrice) : 'Not set';
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: currentSellingPrice != null && currentSellingPrice > 0 ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.mono }}>{displayValue}</span>
      {currentSellingPrice != null && currentSellingPrice > 0 && (
        <span style={{ fontSize: 10, background: '#E8F5E9', color: '#1A7A1A', padding: '2px 7px', borderRadius: RADII.full, fontWeight: 700, fontFamily: TYPOGRAPHY.sans }}>AUTO-FILL</span>
      )}
      <EditButton onClick={() => { setValue(currentSellingPrice != null && currentSellingPrice > 0 ? String(currentSellingPrice) : ''); setEditing(true); }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{ padding: '5px 8px', background: COLORS.tableHeader, border: `1.5px solid ${COLORS.primary}`, borderRight: 'none', borderRadius: `${RADII.sm} 0 0 ${RADII.sm}`, fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>₹</span>
        <input type="number" min="0" step="0.01" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} placeholder="0.00" autoFocus
          style={{ width: 90, padding: '5px 8px', border: `1.5px solid ${error ? COLORS.statusRed : COLORS.primary}`, borderLeft: 'none', borderRadius: `0 ${RADII.sm} ${RADII.sm} 0`, fontSize: 13, fontFamily: TYPOGRAPHY.mono, outline: 'none' }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
      </div>
      <SaveButton onClick={handleSave} loading={loading} />
      <CancelButton onClick={() => { setEditing(false); setError(''); }} />
      {error && <span style={{ fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans, width: '100%' }}>{error}</span>}
      <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, width: '100%', marginTop: 2 }}>Leave blank to allow manual price entry in invoices</span>
    </div>
  );
}

// ─── Restock Entry Edit Modal ──────────────────────────────────────────────────
//
// Opens when Owner/SuperAdmin clicks the Edit button on a history row.
// Fields: Date, Quantity Added, Purchase Price/Unit, Invoice/Order Ref, Vendor, Notes.
// Quantity change: service runs a Firestore transaction to adjust parent stock count.

function RestockEntryEditModal({ itemId, entry, isUntracked, user, onClose, onSaved }) {
  const { updateRestockEntry } = useInventoryStore();

  const originalQty = Number(entry.quantityAdded);
  const todayISO = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    date:          toISODateString(entry.date) || todayISO,
    quantityAdded: String(entry.quantityAdded || ''),
    purchasePrice: entry.purchasePrice != null ? String(entry.purchasePrice) : '',
    invoiceRef:    entry.invoiceRef || '',
    vendorName:    entry.vendorName || '',
    notes:         entry.notes || '',
  });

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const isDateChanged = form.date !== (toISODateString(entry.date) || todayISO);
  const newQty        = Number(form.quantityAdded) || 0;
  const qtyDelta      = newQty - originalQty;
  const qtyChanged    = !isUntracked && qtyDelta !== 0 && form.quantityAdded !== '';

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.date) errs.date = 'Date is required';
    if (form.quantityAdded !== '' && (!form.quantityAdded || isNaN(form.quantityAdded) || Number(form.quantityAdded) <= 0))
      errs.quantityAdded = 'Quantity must be greater than 0';
    if (form.purchasePrice !== '' && (isNaN(form.purchasePrice) || Number(form.purchasePrice) < 0))
      errs.purchasePrice = 'Must be a valid price';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      const updates = {};
      if (form.date !== (toISODateString(entry.date) || todayISO)) {
        updates.date = form.date;
        updates.isDateManuallySet = true;
      }
      if (form.quantityAdded !== '' && Number(form.quantityAdded) !== originalQty)
        updates.quantityAdded = Number(form.quantityAdded);
      if (form.purchasePrice !== '' && Number(form.purchasePrice) !== entry.purchasePrice)
        updates.purchasePrice = Number(form.purchasePrice);
      updates.invoiceRef = form.invoiceRef.trim();
      updates.vendorName = form.vendorName.trim();
      updates.notes      = form.notes.trim();

      await updateRestockEntry({
        itemId, entryId: entry.id, updates,
        originalQuantityAdded: originalQty,
        isUntracked: !!isUntracked, user,
      });
      onSaved();
    } catch (err) {
      setApiError(err.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const iStyle = (hasError = false, extra = {}) => ({
    width: '100%', padding: '9px 11px',
    border: `1.5px solid ${hasError ? COLORS.statusRed : COLORS.tableHeader}`,
    borderRadius: RADII.md, fontSize: 13, fontFamily: TYPOGRAPHY.sans,
    background: COLORS.white, color: COLORS.textPrimary,
    outline: 'none', boxSizing: 'border-box', ...extra,
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: COLORS.cardBg, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: SHADOWS.modal, animation: 'sgaSlideUp 0.22s ease-out' }}>
        {/* Header */}
        <div style={{ background: COLORS.primary, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Pencil size={18} color="#FFF" />
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>Edit Restock Entry</h2>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>
                {formatDate(entry.date)} · {entry.entryType === 'INITIAL' ? 'Initial stock' : 'Replenishment'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: RADII.md, padding: 8, cursor: 'pointer', color: '#FFF', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px 8px' }}>

          {/* Qty change warning */}
          {qtyChanged && (
            <div style={{ background: Math.abs(qtyDelta) > 0 ? '#FFF8EE' : '#F0FAF0', border: `1px solid ${qtyDelta > 0 ? '#FFD8A0' : '#A8D8A8'}`, borderRadius: RADII.md, padding: '8px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, fontFamily: TYPOGRAPHY.sans, color: qtyDelta > 0 ? '#CC6600' : '#1A7A1A' }}>
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                Changing quantity from <strong>{originalQty}</strong> to <strong>{newQty}</strong> will{' '}
                {qtyDelta > 0 ? 'add' : 'remove'} <strong>{Math.abs(qtyDelta)}</strong> unit{Math.abs(qtyDelta) !== 1 ? 's' : ''}{' '}
                {qtyDelta > 0 ? 'to' : 'from'} current stock. This cannot be undone.
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Date */}
            <div style={{ marginBottom: 4 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Date *</label>
              <input type="date" value={form.date} onChange={setField('date')}
                style={iStyle(!!errors.date, { fontFamily: TYPOGRAPHY.mono, background: isDateChanged ? COLORS.statusAmberBg : COLORS.white, color: isDateChanged ? COLORS.statusAmber : COLORS.textPrimary })} />
              {errors.date && <p style={{ margin: '3px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>⚠ {errors.date}</p>}
            </div>

            {/* Quantity */}
            <div style={{ marginBottom: 4 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Qty Added {isUntracked ? '(display only)' : ''}
              </label>
              <input type="number" min="1" step="1" value={form.quantityAdded} onChange={setField('quantityAdded')} placeholder={String(originalQty)}
                style={iStyle(!!errors.quantityAdded, { fontFamily: TYPOGRAPHY.mono })} />
              {errors.quantityAdded && <p style={{ margin: '3px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>⚠ {errors.quantityAdded}</p>}
              {!isUntracked && <p style={{ margin: '3px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>Was: {originalQty}</p>}
            </div>

            {/* Purchase Price */}
            <div style={{ marginBottom: 4 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Purchase Price / Unit (₹)</label>
              <input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={setField('purchasePrice')} placeholder="0.00"
                style={iStyle(!!errors.purchasePrice, { fontFamily: TYPOGRAPHY.mono })} />
              {errors.purchasePrice && <p style={{ margin: '3px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>⚠ {errors.purchasePrice}</p>}
            </div>

            {/* Invoice / Order Ref */}
            <div style={{ marginBottom: 4 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Invoice / Order Ref</label>
              <div style={{ position: 'relative' }}>
                <FileText size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
                <input value={form.invoiceRef} onChange={setField('invoiceRef')} placeholder="e.g. INV-001, PO-42"
                  style={iStyle(false, { paddingLeft: 28, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.3 })} />
              </div>
            </div>
          </div>

          {/* Vendor */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Vendor / Supplier</label>
            <input value={form.vendorName} onChange={setField('vendorName')} placeholder="e.g. Rama CNG Distributors"
              style={iStyle()} />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>Notes</label>
            <textarea value={form.notes} onChange={setField('notes')} placeholder="Any notes for this batch..." rows={2}
              style={{ ...iStyle(), resize: 'vertical', minHeight: 56 }} />
          </div>

          {apiError && (
            <div style={{ background: COLORS.statusRedBg, border: `1px solid #F5C6C6`, borderRadius: RADII.md, padding: '9px 14px', color: COLORS.statusRed, fontSize: 12, fontFamily: TYPOGRAPHY.sans, marginBottom: 12 }}>
              ⚠ {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${COLORS.divider}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: COLORS.cardBg, flexShrink: 0 }}>
          <button onClick={onClose} disabled={loading} style={{ background: 'transparent', color: COLORS.textSecondary, border: `1.5px solid ${COLORS.tableHeader}`, borderRadius: RADII.md, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: TYPOGRAPHY.sans }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ background: loading ? COLORS.primaryHover : COLORS.primary, color: '#FFF', border: 'none', borderRadius: RADII.md, padding: '9px 24px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: TYPOGRAPHY.sans, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? (
              <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} /> Saving…</>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: `1px solid ${COLORS.divider}`, alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: RADII.md, background: COLORS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <span style={{ color: COLORS.primary }}>{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans, marginBottom: 4 }}>{label}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}

// ─── Desktop History Row ──────────────────────────────────────────────────────

// Columns: Date | Qty | Price/Unit | Inv. Ref | Vendor | Added By | Type | Edit
const HIST_COLS = '1.2fr 80px 120px 120px 1fr 110px 90px 54px';

function DesktopHistoryRow({ entry, isLast, isOwnerOrAdmin, onEdit }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: HIST_COLS, padding: '12px 20px', borderBottom: isLast ? 'none' : `1px solid ${COLORS.divider}`, alignItems: 'center', gap: 8 }}>
      {/* Date */}
      <div>
        <span style={{ fontSize: 13, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{formatDate(entry.date)}</span>
        {entry.isDateManuallySet && (
          <span style={{ marginLeft: 5, fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>M</span>
        )}
        {entry.editedAt && (
          <span style={{ marginLeft: 5, fontSize: 10, background: '#F3E5F5', color: '#6A1B9A', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>edited</span>
        )}
      </div>
      {/* Qty */}
      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.statusGreen, fontFamily: TYPOGRAPHY.mono }}>+{entry.quantityAdded}</span>
      {/* Price */}
      <span style={{ fontSize: 13, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>{formatCurrency(entry.purchasePrice)}</span>
      {/* Inv. Ref */}
      <span style={{ fontSize: 12, color: entry.invoiceRef ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.2 }}>
        {entry.invoiceRef || '—'}
      </span>
      {/* Vendor */}
      <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>{entry.vendorName || '—'}</span>
      {/* Added By */}
      <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>{entry.addedByName}</span>
      {/* Type */}
      <EntryTypeBadge type={entry.entryType} />
      {/* Edit */}
      {isOwnerOrAdmin ? (
        <button
          onClick={() => onEdit(entry)}
          title="Edit this restock entry"
          style={{ background: 'none', border: `1px solid ${COLORS.tableHeader}`, borderRadius: RADII.sm, padding: '4px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: COLORS.textSecondary, whiteSpace: 'nowrap' }}
        >
          <Pencil size={11} />
          <span style={{ fontSize: 10, fontFamily: TYPOGRAPHY.sans }}>Edit</span>
        </button>
      ) : <div />}
    </div>
  );
}

// ─── Mobile History Row ───────────────────────────────────────────────────────

function MobileHistoryRow({ entry, isOwnerOrAdmin, onEdit }) {
  return (
    <div style={{ padding: '13px 16px', borderBottom: `1px solid ${COLORS.divider}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{formatDate(entry.date)}</span>
          {entry.isDateManuallySet && (
            <span style={{ marginLeft: 6, fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>M</span>
          )}
          {entry.editedAt && (
            <span style={{ marginLeft: 6, fontSize: 10, background: '#F3E5F5', color: '#6A1B9A', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>edited</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <EntryTypeBadge type={entry.entryType} />
          {isOwnerOrAdmin && (
            <button onClick={() => onEdit(entry)} style={{ background: 'none', border: `1px solid ${COLORS.tableHeader}`, borderRadius: RADII.sm, padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: COLORS.textSecondary }}>
              <Pencil size={10} /><span style={{ fontSize: 10, fontFamily: TYPOGRAPHY.sans }}>Edit</span>
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
        {entry.invoiceRef && (
          <div>
            <p style={{ margin: 0, fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>Inv. Ref</p>
            <span style={{ fontSize: 12, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono, letterSpacing: 0.2 }}>{entry.invoiceRef}</span>
          </div>
        )}
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>Added by {entry.addedByName}</p>
      {entry.notes && (
        <p style={{ margin: '3px 0 0', fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, fontStyle: 'italic' }}>"{entry.notes}"</p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { itemId } = useParams();
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();

  const { firebaseUser: user, role: userRole } = useAuthStore();

  const {
    selectedItem, restockHistory, historyLoading,
    itemLoading, itemError,
    fetchItem, fetchRestockHistory, fetchCategories,
    getCategoryName, deleteItems, updateItem, toggleTrackingMode,
  } = useInventoryStore();

  const [showReplenish,    setShowReplenish]    = useState(false);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [showTrackingDlg,  setShowTrackingDlg]  = useState(false);
  const [trackingLoading,  setTrackingLoading]  = useState(false);
  const [startingQtyInput, setStartingQtyInput] = useState('');
  const [editingEntry,     setEditingEntry]     = useState(null); // restock entry being edited

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'superadmin';

  useEffect(() => {
    fetchItem(itemId);
    fetchRestockHistory(itemId);
    fetchCategories();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (itemLoading) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.appBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${COLORS.tableHeader}`, borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>Loading item...</p>
        </div>
        <style>{`@keyframes sgaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (itemError || !selectedItem) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.appBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: COLORS.cardBg, borderRadius: RADII.xl, padding: '32px 24px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: SHADOWS.card, border: `1.5px solid ${COLORS.divider}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>Could not load item</h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, lineHeight: 1.5 }}>
            {itemError || 'Item not found. It may have been deleted.'}
          </p>
          <button onClick={() => navigate('/inventory')} style={{ background: COLORS.primary, color: '#FFF', border: 'none', borderRadius: RADII.md, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: TYPOGRAPHY.sans, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Back to Inventory
          </button>
        </div>
        <style>{`@keyframes sgaSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const item = selectedItem;

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try { await deleteItems([item.id], user); navigate('/inventory'); }
    catch (err) { console.error('[ItemDetailPage] delete failed:', err); setIsDeleting(false); setShowDeleteModal(false); }
  };

  const handleEntrySaved = () => {
    setEditingEntry(null);
    fetchItem(item.id);
    fetchRestockHistory(item.id);
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.appBg, paddingBottom: 80 }}>

      {/* ── Page Header ── */}
      <div style={{ background: COLORS.primary, padding: isMobile ? '16px 16px 14px' : '20px 28px 16px', boxShadow: SHADOWS.header, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/inventory')} style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: RADII.md, padding: '8px 10px', cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>{item.itemName}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>{getCategoryName(item.categoryId)} · Item Detail</p>
          </div>
          {isOwnerOrAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDeleteModal(true)} title="Delete this item" style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: RADII.md, padding: '9px 10px', cursor: 'pointer', color: '#FFC8C8', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={15} />
              </button>
              {!item.isUntracked && (
                <button onClick={() => setShowReplenish(true)} style={{ background: '#FFFFFF', color: COLORS.primary, border: 'none', borderRadius: RADII.md, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: TYPOGRAPHY.sans }}>
                  <RefreshCw size={14} />
                  {!isMobile && 'Replenish'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 24px' }}>
        <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* ── Left card — Current Stock ── */}
          <div style={{ background: COLORS.cardBg, borderRadius: RADII.xl, padding: '20px', boxShadow: SHADOWS.card, border: `1.5px solid ${COLORS.divider}`, marginBottom: isMobile ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {item.isUntracked ? 'Sales Volume' : 'Current Stock'}
              </h3>
              {item.isUntracked
                ? <span style={{ fontSize: 10, fontWeight: 700, background: '#F5F0EE', color: '#888', padding: '3px 8px', borderRadius: RADII.full, fontFamily: TYPOGRAPHY.sans, letterSpacing: 0.5 }}>UNTRACKED</span>
                : <StockStatusBadge quantity={item.quantity ?? 0} threshold={item.lowStockThreshold ?? 5} />}
            </div>

            {item.isUntracked ? (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Units Sold (all time)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono, lineHeight: 1 }}>{item.totalSold ?? 0}</span>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>units sold across approved invoices</span>
                </div>
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFF8EE', borderRadius: RADII.md, border: '1px solid #FFD8A0', fontSize: 11, color: '#CC6600', fontFamily: TYPOGRAPHY.sans }}>
                  This item has no stock ceiling. You can sell any quantity without a stock warning.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>Units in Stock</p>
                    <QuantityDisplay quantity={item.quantity ?? 0} threshold={item.lowStockThreshold ?? 5} />
                  </div>
                  <div style={{ flex: 1 }} />
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Latest Price/Unit</p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono, textAlign: 'right' }}>
                      {item.purchasePrice != null ? formatCurrency(item.purchasePrice) : '—'}
                    </p>
                  </div>
                </div>
                <div style={{ height: 8, background: COLORS.tableHeader, borderRadius: RADII.full, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', borderRadius: RADII.full, background: (item.quantity ?? 0) <= 0 ? COLORS.statusRed : (item.quantity ?? 0) <= (item.lowStockThreshold ?? 5) ? COLORS.statusAmber : COLORS.statusGreen, width: `${Math.min(100, Math.max(4, ((item.quantity ?? 0) / Math.max((item.quantity ?? 0) * 1.5, (item.lowStockThreshold ?? 5) * 2 || 10)) * 100))}%`, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>Alert threshold: {item.lowStockThreshold ?? 5} units</p>
              </div>
            )}

            {!item.isUntracked && (item.totalSold ?? 0) > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>
                Total sold (all invoices): <strong style={{ color: COLORS.textPrimary }}>{item.totalSold}</strong> units
              </div>
            )}
            {!isOwnerOrAdmin && (
              <div style={{ marginTop: 12, background: COLORS.statusBlueBg, borderRadius: RADII.md, padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Info size={13} color={COLORS.statusBlue} />
                <p style={{ margin: 0, fontSize: 11, color: COLORS.statusBlue, fontFamily: TYPOGRAPHY.sans }}>Only the Owner can replenish inventory</p>
              </div>
            )}
          </div>

          {/* ── Right card — Item Details ── */}
          <div style={{ background: COLORS.cardBg, borderRadius: RADII.xl, padding: '20px', boxShadow: SHADOWS.card, border: `1.5px solid ${COLORS.divider}` }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item Details</h3>

            {/* Category — now editable */}
            <DetailRow label="Category" icon={<Tag size={14} />}>
              {isOwnerOrAdmin ? (
                <CategoryEditor itemId={item.id} currentCategoryId={item.categoryId} user={user} onSaved={() => fetchItem(item.id)} />
              ) : (
                <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{getCategoryName(item.categoryId)}</span>
              )}
            </DetailRow>

            {/* Low Stock Threshold */}
            <DetailRow label="Low Stock Threshold" icon={<AlertTriangle size={14} />}>
              {isOwnerOrAdmin ? (
                <ThresholdEditor itemId={item.id} currentThreshold={item.lowStockThreshold ?? 5} user={user} onSaved={() => fetchItem(item.id)} />
              ) : (
                <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.mono }}>{item.lowStockThreshold ?? 5}</span>
              )}
            </DetailRow>

            {/* Last Restocked — now editable */}
            <DetailRow label="Last Restocked" icon={<Calendar size={14} />}>
              {isOwnerOrAdmin ? (
                <LastRestockedEditor
                  itemId={item.id}
                  currentDate={item.lastRestockedDate}
                  isManuallySet={item.isLastDateManuallySet}
                  user={user}
                  onSaved={() => fetchItem(item.id)}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>{formatDate(item.lastRestockedDate)}</span>
                  {item.isLastDateManuallySet && (
                    <span style={{ fontSize: 10, background: COLORS.statusAmberBg, color: COLORS.statusAmber, padding: '2px 6px', borderRadius: RADII.sm, fontWeight: 700, fontFamily: TYPOGRAPHY.sans }}>M — Manually set</span>
                  )}
                </div>
              )}
            </DetailRow>

            {/* Vendor / Supplier — now editable */}
            <DetailRow label="Vendor / Supplier" icon={<TruckIcon size={14} />}>
              {isOwnerOrAdmin ? (
                <VendorEditor itemId={item.id} currentVendorName={item.vendorName} user={user} onSaved={() => fetchItem(item.id)} />
              ) : (
                <span style={{ fontSize: 14, color: item.vendorName ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>{item.vendorName || '—'}</span>
              )}
            </DetailRow>

            {/* Search Shortcut */}
            <DetailRow label="Search Shortcut" icon={<Zap size={14} />}>
              {isOwnerOrAdmin ? (
                <ShortcutEditor itemId={item.id} currentShortcut={item.shortcut} user={user} onSaved={() => fetchItem(item.id)} />
              ) : (
                <span style={{ fontSize: 13, fontFamily: TYPOGRAPHY.mono, color: item.shortcut ? COLORS.textPrimary : COLORS.textMuted, background: item.shortcut ? COLORS.tableHeader : 'transparent', padding: item.shortcut ? '2px 8px' : 0, borderRadius: RADII.sm, letterSpacing: 0.5 }}>
                  {item.shortcut || '—'}
                </span>
              )}
            </DetailRow>

            {item.notes && (
              <DetailRow label="Internal Notes" icon={<Info size={14} />}>
                <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, lineHeight: 1.5 }}>{item.notes}</span>
              </DetailRow>
            )}

            {/* Selling Price */}
            <DetailRow label="Selling Price / Unit" icon={<IndianRupee size={14} />}>
              {isOwnerOrAdmin ? (
                <SellingPriceEditor itemId={item.id} currentSellingPrice={item.sellingPrice} user={user} onSaved={() => fetchItem(item.id)} />
              ) : (
                <span style={{ fontSize: 14, color: item.sellingPrice > 0 ? COLORS.textPrimary : COLORS.textMuted, fontFamily: TYPOGRAPHY.mono }}>
                  {item.sellingPrice != null && item.sellingPrice > 0 ? formatCurrency(item.sellingPrice) : '—'}
                </span>
              )}
            </DetailRow>

            {/* Added By */}
            <DetailRow label="Added By" icon={<Package size={14} />}>
              <span style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans }}>{item.createdByName} · {formatDate(item.createdAt)}</span>
            </DetailRow>

            {/* Local Item purchase price missing */}
            {item.category === 'Local Items' && (item.purchasePrice == null || item.purchasePrice === 0) && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFF8EE', border: '1px solid #FFD8A0', borderRadius: RADII.md, display: 'flex', gap: 6, alignItems: 'center' }}>
                <AlertTriangle size={13} color="#CC6600" />
                <span style={{ fontSize: 12, color: '#CC6600', fontFamily: TYPOGRAPHY.sans }}>Purchase price not set — profit/loss for this item is excluded from reports until you enter it above.</span>
              </div>
            )}

            {/* Stock Tracking Mode Toggle */}
            {isOwnerOrAdmin && item.category !== 'Local Items' && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.divider}` }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>Stock Tracking Mode</p>
                <div onClick={() => { setStartingQtyInput(''); setShowTrackingDlg(true); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: item.isUntracked ? '#FFF8EE' : '#F0FAF0', border: `1.5px solid ${item.isUntracked ? '#FFD8A0' : '#A8D8A8'}`, borderRadius: RADII.md, padding: '10px 14px', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.isUntracked ? '#CC6600' : '#1A7A1A', fontFamily: TYPOGRAPHY.sans }}>
                      {item.isUntracked ? 'Untracked — click to enable stock tracking' : 'Tracked — click to disable stock tracking'}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.sans, marginTop: 2 }}>
                      {item.isUntracked ? 'Sales volume only. No stock ceiling.' : 'Quantity counted. Low-stock alerts active.'}
                    </div>
                  </div>
                  {item.isUntracked ? <ToggleLeft size={24} color="#CC6600" /> : <ToggleRight size={24} color="#1A7A1A" />}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Restock History ── */}
        <div style={{ background: COLORS.cardBg, borderRadius: RADII.xl, boxShadow: SHADOWS.card, border: `1.5px solid ${COLORS.divider}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.divider}`, display: 'flex', alignItems: 'center', gap: 8, background: COLORS.tableHeader }}>
            <History size={16} color={COLORS.primary} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.primary, fontFamily: TYPOGRAPHY.sans }}>Restock History</h3>
            <span style={{ marginLeft: 'auto', background: COLORS.primaryLight, color: COLORS.primary, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: RADII.full, fontFamily: TYPOGRAPHY.sans }}>
              {restockHistory.length} batch{restockHistory.length !== 1 ? 'es' : ''}
            </span>
            {isOwnerOrAdmin && restockHistory.length > 0 && (
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, marginLeft: 4 }}>· Click Edit on any row to correct it</span>
            )}
          </div>

          {historyLoading && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ width: 28, height: 28, border: `2px solid ${COLORS.tableHeader}`, borderTopColor: COLORS.primary, borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          )}
          {!historyLoading && restockHistory.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, fontSize: 14 }}>
              No restock history found.
            </div>
          )}
          {!historyLoading && restockHistory.length > 0 && (
            <>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: HIST_COLS, padding: '9px 20px', borderBottom: `1px solid ${COLORS.divider}`, gap: 8 }}>
                  {['Date', 'Qty Added', 'Price/Unit', 'Inv. Ref', 'Vendor', 'Added By', 'Type', ''].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: TYPOGRAPHY.sans }}>{h}</span>
                  ))}
                </div>
              )}
              {restockHistory.map((entry, idx) => (
                isMobile
                  ? <MobileHistoryRow key={entry.id} entry={entry} isOwnerOrAdmin={isOwnerOrAdmin} onEdit={setEditingEntry} />
                  : <DesktopHistoryRow key={entry.id} entry={entry} isLast={idx === restockHistory.length - 1} isOwnerOrAdmin={isOwnerOrAdmin} onEdit={setEditingEntry} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Tracking Mode Dialog ── */}
      {showTrackingDlg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowTrackingDlg(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: item.isUntracked ? '#F0FAF0' : '#FFF8EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.isUntracked ? <ToggleRight size={24} color="#1A7A1A" /> : <ToggleLeft size={24} color="#CC6600" />}
              </div>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#222', textAlign: 'center', fontFamily: TYPOGRAPHY.sans }}>
              {item.isUntracked ? 'Enable Stock Tracking?' : 'Disable Stock Tracking?'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 1.5, fontFamily: TYPOGRAPHY.sans }}>
              {item.isUntracked
                ? 'This will enable quantity tracking for this item. Enter a starting stock quantity below.'
                : `This will discard the current stock count of ${item.quantity ?? 0} units. The item will switch to sales-volume tracking only.`}
            </p>
            {!item.isUntracked && (
              <div style={{ background: '#FFEBEE', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#CC0000', fontFamily: TYPOGRAPHY.sans }}>
                ⚠ Current stock count ({item.quantity ?? 0} units) will be permanently discarded.
              </div>
            )}
            {item.isUntracked && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 6, fontFamily: TYPOGRAPHY.sans }}>Starting Quantity *</label>
                <input type="number" min="0" value={startingQtyInput} onChange={(e) => setStartingQtyInput(e.target.value)} placeholder="Enter starting stock count" autoFocus
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E8E2DF', borderRadius: 8, fontSize: 14, fontFamily: TYPOGRAPHY.mono, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowTrackingDlg(false)} disabled={trackingLoading}
                style={{ flex: 1, padding: '11px 0', background: 'none', border: '1.5px solid #E8E2DF', borderRadius: 8, color: '#444', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: TYPOGRAPHY.sans }}>
                Cancel
              </button>
              <button
                disabled={trackingLoading || (item.isUntracked && startingQtyInput === '')}
                onClick={async () => {
                  setTrackingLoading(true);
                  try { await toggleTrackingMode(item.id, !item.isUntracked, item.isUntracked ? Number(startingQtyInput) : 0, user); setShowTrackingDlg(false); fetchItem(item.id); }
                  catch (err) { console.error(err); }
                  finally { setTrackingLoading(false); }
                }}
                style={{ flex: 1, padding: '11px 0', background: trackingLoading ? '#888' : (item.isUntracked ? '#1A7A1A' : '#CC6600'), border: 'none', borderRadius: 8, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: trackingLoading || (item.isUntracked && startingQtyInput === '') ? 'not-allowed' : 'pointer', fontFamily: TYPOGRAPHY.sans }}>
                {trackingLoading ? 'Saving…' : (item.isUntracked ? 'Enable Tracking' : 'Disable Tracking')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Replenish Modal ── */}
      {showReplenish && (
        <ReplenishModal item={item} user={user} onClose={() => setShowReplenish(false)}
          onSuccess={() => { setShowReplenish(false); fetchItem(item.id); fetchRestockHistory(item.id); }} />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <DeleteItemModal itemName={item.itemName} onConfirm={handleDeleteConfirmed} onCancel={() => setShowDeleteModal(false)} isDeleting={isDeleting} />
      )}

      {/* ── Restock Entry Edit Modal ── */}
      {editingEntry && (
        <RestockEntryEditModal
          itemId={item.id}
          entry={editingEntry}
          isUntracked={item.isUntracked}
          user={user}
          onClose={() => setEditingEntry(null)}
          onSaved={handleEntrySaved}
        />
      )}

      <style>{`
        @keyframes sgaSpin { to { transform: rotate(360deg); } }
        @keyframes sgaSlideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
// SGA — Last updated: Migrated COLORS import from designTokens shim to tokens.js directly
/**
 * CategoryManagerModal — Shree Ganesh Automobile
 * Owner / SuperAdmin only.
 * Manages inventory categories: create, rename, delete.
 *
 * Rendered inside the Settings page (Phase 11) but exported here
 * so it can also be summoned from AddInventoryModal if needed.
 *
 * Rules:
 *  - Duplicate category names are blocked (case-insensitive, enforced in service)
 *  - Cannot delete a category that still has inventory items assigned to it
 *  - Deleting requires a confirmation prompt
 */

import { useState, useRef, useEffect } from 'react';
import { X, Tag, Plus, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import { COLORS as _COLORS, TYPOGRAPHY, RADII, SHADOWS } from '../../lib/tokens';
const COLORS = _COLORS.light;

// ─── Inline edit row for a single category ────────────────────────────────

function CategoryRow({ category, user, onUpdated, onDeleted }) {
  const { updateCategory, deleteCategory } = useInventoryStore();

  const [editing,     setEditing]     = useState(false);
  const [editValue,   setEditValue]   = useState(category.name);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [error,       setError]       = useState('');

  const editInputRef = useRef(null);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const handleSaveEdit = async () => {
    if (!editValue.trim()) { setError('Name cannot be empty'); return; }
    if (editValue.trim() === category.name) { setEditing(false); return; }
    setSaving(true);
    setError('');
    try {
      await updateCategory(category.id, editValue.trim(), user);
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteCategory(category.id, user);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setConfirmDel(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      padding:       '10px 14px',
      borderBottom:  `1px solid ${COLORS.divider}`,
      display:       'flex',
      gap:           10,
      alignItems:    'center',
    }}>
      {/* Color dot */}
      <div style={{
        width:        8,
        height:       8,
        borderRadius: '50%',
        background:   COLORS.primary,
        flexShrink:   0,
      }} />

      {/* Name / Edit field */}
      <div style={{ flex: 1 }}>
        {editing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); setError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') { setEditing(false); setEditValue(category.name); }
            }}
            style={{
              width:        '100%',
              padding:      '6px 10px',
              border:       `1.5px solid ${error ? COLORS.statusRed : COLORS.primary}`,
              borderRadius: RADII.sm,
              fontSize:     14,
              fontFamily:   TYPOGRAPHY.sans,
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
        ) : (
          <span style={{ fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.sans }}>
            {category.name}
          </span>
        )}
        {error && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>
            ⚠ {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {editing ? (
          <>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              style={{
                background:   COLORS.statusGreen,
                color:        '#FFF',
                border:       'none',
                borderRadius: RADII.sm,
                padding:      '5px 10px',
                cursor:       saving ? 'not-allowed' : 'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          4,
                fontSize:     12,
                fontFamily:   TYPOGRAPHY.sans,
                fontWeight:   600,
              }}
            >
              {saving
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} />
                : <Check size={13} />
              }
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setEditValue(category.name); setError(''); }}
              style={{
                background:   'transparent',
                border:       `1px solid ${COLORS.tableHeader}`,
                borderRadius: RADII.sm,
                padding:      '5px 8px',
                cursor:       'pointer',
                color:        COLORS.textSecondary,
                display:      'flex',
                alignItems:   'center',
              }}
            >
              <X size={13} />
            </button>
          </>
        ) : confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans, fontWeight: 600 }}>
              Delete?
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background:   COLORS.statusRed,
                color:        '#FFF',
                border:       'none',
                borderRadius: RADII.sm,
                padding:      '5px 10px',
                cursor:       deleting ? 'not-allowed' : 'pointer',
                fontSize:     12,
                fontFamily:   TYPOGRAPHY.sans,
                fontWeight:   600,
                display:      'flex',
                alignItems:   'center',
                gap:          4,
              }}
            >
              {deleting
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} />
                : 'Yes, delete'
              }
            </button>
            <button
              onClick={() => { setConfirmDel(false); setError(''); }}
              style={{
                background:   'transparent',
                border:       `1px solid ${COLORS.tableHeader}`,
                borderRadius: RADII.sm,
                padding:      '5px 8px',
                cursor:       'pointer',
                color:        COLORS.textSecondary,
                display:      'flex',
                alignItems:   'center',
              }}
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setEditing(true); setEditValue(category.name); }}
              style={{
                background:   'transparent',
                border:       `1px solid ${COLORS.tableHeader}`,
                borderRadius: RADII.sm,
                padding:      '5px 8px',
                cursor:       'pointer',
                color:        COLORS.textSecondary,
                display:      'flex',
                alignItems:   'center',
              }}
              title="Rename category"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                background:   'transparent',
                border:       `1px solid ${COLORS.tableHeader}`,
                borderRadius: RADII.sm,
                padding:      '5px 8px',
                cursor:       'pointer',
                color:        COLORS.statusRed,
                display:      'flex',
                alignItems:   'center',
              }}
              title="Delete category"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function CategoryManagerModal({ user, onClose }) {
  const { categories, categoriesLoading, fetchCategories, addCategory: addCat } = useInventoryStore();

  const [newName,   setNewName]   = useState('');
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState('');

  const newInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleAdd = async () => {
    if (!newName.trim()) { setAddError('Name cannot be empty'); return; }
    setAdding(true);
    setAddError('');
    try {
      await addCat(newName.trim(), user);
      setNewName('');
      newInputRef.current?.focus();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.45)',
        zIndex:         300,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        padding:        '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:    COLORS.cardBg,
        borderRadius:  RADII.xl,
        width:         '100%',
        maxWidth:      480,
        maxHeight:     '85vh',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        boxShadow:     SHADOWS.modal,
        animation:     'sgaFadeIn 0.2s ease-out',
      }}>

        {/* Header */}
        <div style={{
          background:     COLORS.primary,
          padding:        '16px 20px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag size={18} color="#FFF" />
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFF', fontFamily: TYPOGRAPHY.sans }}>
                Inventory Categories
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#F0BABA', fontFamily: TYPOGRAPHY.sans }}>
                Create, rename, or delete categories
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: RADII.md, padding: 8, cursor: 'pointer', color: '#FFF', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Add new category */}
        <div style={{
          padding:     '14px 16px',
          borderBottom: `1px solid ${COLORS.divider}`,
          background:  COLORS.white,
          flexShrink:  0,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: TYPOGRAPHY.sans }}>
            Add New Category
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(''); }}
              placeholder="e.g. CNG Kits, Regulators, Cylinders..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              style={{
                flex:         1,
                padding:      '9px 12px',
                border:       `1.5px solid ${addError ? COLORS.statusRed : COLORS.tableHeader}`,
                borderRadius: RADII.md,
                fontSize:     14,
                fontFamily:   TYPOGRAPHY.sans,
                outline:      'none',
                transition:   'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
              onBlur={(e)  => (e.target.style.borderColor = addError ? COLORS.statusRed : COLORS.tableHeader)}
            />
            <button
              onClick={handleAdd}
              disabled={adding}
              style={{
                background:     adding ? COLORS.primaryHover : COLORS.primary,
                color:          '#FFF',
                border:         'none',
                borderRadius:   RADII.md,
                padding:        '9px 16px',
                cursor:         adding ? 'not-allowed' : 'pointer',
                display:        'flex',
                alignItems:     'center',
                gap:            4,
                fontWeight:     600,
                fontSize:       13,
                fontFamily:     TYPOGRAPHY.sans,
                flexShrink:     0,
              }}
            >
              {adding
                ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaSpin 0.7s linear infinite' }} />
                : <Plus size={15} />
              }
              Add
            </button>
          </div>
          {addError && (
            <p style={{ margin: '5px 0 0', fontSize: 11, color: COLORS.statusRed, fontFamily: TYPOGRAPHY.sans }}>
              <AlertCircle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {addError}
            </p>
          )}
        </div>

        {/* Category list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {categoriesLoading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{
                width:       24,
                height:      24,
                border:      `2px solid ${COLORS.tableHeader}`,
                borderTopColor: COLORS.primary,
                borderRadius: '50%',
                animation:   'sgaSpin 0.7s linear infinite',
                margin:      '0 auto',
              }} />
            </div>
          )}

          {!categoriesLoading && categories.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans, fontSize: 14 }}>
              No categories yet. Add your first one above.
            </div>
          )}

          {!categoriesLoading && categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              user={user}
              onUpdated={() => {}}
              onDeleted={() => {}}
            />
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding:     '10px 16px',
          borderTop:   `1px solid ${COLORS.divider}`,
          background:  COLORS.white,
          flexShrink:  0,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, fontFamily: TYPOGRAPHY.sans }}>
            ⚠ Categories with assigned inventory items cannot be deleted. Reassign items first.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes sgaFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes sgaSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
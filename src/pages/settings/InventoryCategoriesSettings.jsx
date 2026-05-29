// SGA — Last updated: Bug Fix #2 — New component: Inventory Categories inline settings panel (replaces the "No categories yet — manage them in Settings → Inventory Categories" placeholder)
/**
 * InventoryCategoriesSettings.jsx — Shree Ganesh Automobile
 * Inline Settings panel for managing inventory categories.
 * Rendered inside the Settings page → Business tab.
 *
 * Provides the same CRUD (create, rename, delete) as CategoryManagerModal
 * but renders as an inline settings section (not a floating modal).
 *
 * Owner / SuperAdmin only.
 */

import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import useAuthStore from '../../store/authStore';
import { T } from './SettingsUI';

// ─── Single Category Row ───────────────────────────────────────────────────────

function CategoryRow({ category, user }) {
  const { updateCategory, deleteCategory } = useInventoryStore();

  const [editing,    setEditing]    = useState(false);
  const [editValue,  setEditValue]  = useState(category.name);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error,      setError]      = useState('');

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
    } catch (err) {
      setError(err.message);
      setConfirmDel(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${T.border}`,
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      background: '#FFFFFF',
    }}>
      {/* Color dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: T.primary,
        flexShrink: 0,
      }} />

      {/* Name / Edit field */}
      <div style={{ flex: 1 }}>
        {editing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); setError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  handleSaveEdit();
              if (e.key === 'Escape') { setEditing(false); setEditValue(category.name); }
            }}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: `1.5px solid ${error ? '#CC0000' : T.primary}`,
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <span style={{ fontSize: 14, color: T.textPrimary, fontFamily: 'inherit' }}>
            {category.name}
          </span>
        )}
        {error && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#CC0000', fontFamily: 'inherit' }}>
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
                background: '#1A7A1A', color: '#FFF', border: 'none',
                borderRadius: 6, padding: '5px 10px',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              {saving
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaCatSpin 0.7s linear infinite' }} />
                : <Check size={13} />
              }
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setEditValue(category.name); setError(''); }}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                color: T.textSecondary, display: 'flex', alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          </>
        ) : confirmDel ? (
          <>
            <span style={{ fontSize: 12, color: '#CC0000', fontFamily: 'inherit', fontWeight: 600 }}>
              Delete?
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: '#CC0000', color: '#FFF', border: 'none',
                borderRadius: 6, padding: '5px 10px',
                cursor: deleting ? 'not-allowed' : 'pointer',
                fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {deleting
                ? <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaCatSpin 0.7s linear infinite' }} />
                : 'Yes, delete'
              }
            </button>
            <button
              onClick={() => { setConfirmDel(false); setError(''); }}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                color: T.textSecondary, display: 'flex', alignItems: 'center',
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
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                color: T.textSecondary, display: 'flex', alignItems: 'center',
              }}
              title="Rename category"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                color: '#CC0000', display: 'flex', alignItems: 'center',
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

// ─── Main Settings Section Component ──────────────────────────────────────────

export default function InventoryCategoriesSettings() {
  const { firebaseUser: user } = useAuthStore();
  const { categories, categoriesLoading, fetchCategories, addCategory: addCat } = useInventoryStore();

  const [newName,  setNewName]  = useState('');
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState('');

  const newInputRef = useRef(null);

  useEffect(() => {
    fetchCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        background: 'var(--color-card, #F5F0EE)',
        borderRadius: 14,
        border: `1.5px solid ${T.border}`,
        marginBottom: 18,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Section Header */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: `1px solid ${T.border}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Tag size={18} color={T.primary} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.primary }}>
            Inventory Categories
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            Create, rename, or delete categories for inventory items
          </div>
        </div>
      </div>

      {/* Add New Category */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: '#FDFAF9',
        }}
      >
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 700,
          color: T.textSecondary, textTransform: 'uppercase',
          letterSpacing: 0.5, fontFamily: 'inherit',
        }}>
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
              flex: 1,
              padding: '9px 12px',
              border: `1.5px solid ${addError ? '#CC0000' : T.border}`,
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.15s',
              background: '#FFFFFF',
            }}
            onFocus={(e) => (e.target.style.borderColor = T.primary)}
            onBlur={(e)  => (e.target.style.borderColor = addError ? '#CC0000' : T.border)}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{
              background: adding ? '#8B3A3A' : T.primary,
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              padding: '9px 16px',
              cursor: adding ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600,
              fontSize: 13,
              fontFamily: 'inherit',
              flexShrink: 0,
              minHeight: 44,
            }}
          >
            {adding
              ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'sgaCatSpin 0.7s linear infinite' }} />
              : <Plus size={15} />
            }
            Add
          </button>
        </div>
        {addError && (
          <p style={{ margin: '5px 0 0', fontSize: 11, color: '#CC0000', fontFamily: 'inherit' }}>
            <AlertCircle size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            {addError}
          </p>
        )}
      </div>

      {/* Category List */}
      <div>
        {categoriesLoading && (
          <div style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{
              width: 24, height: 24,
              border: `2px solid ${T.border}`,
              borderTopColor: T.primary,
              borderRadius: '50%',
              animation: 'sgaCatSpin 0.7s linear infinite',
              margin: '0 auto',
            }} />
          </div>
        )}

        {!categoriesLoading && categories.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '28px 20px',
            color: T.textSecondary, fontFamily: 'inherit', fontSize: 14,
          }}>
            No categories yet. Add your first one above.
          </div>
        )}

        {!categoriesLoading && categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            user={user}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '10px 20px',
        borderTop: `1px solid ${T.border}`,
        background: '#FFFFFF',
      }}>
        <p style={{ margin: 0, fontSize: 11, color: T.textSecondary, fontFamily: 'inherit' }}>
          ⚠ Categories with assigned inventory items cannot be deleted. Reassign items first.
        </p>
      </div>

      <style>{`
        @keyframes sgaCatSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

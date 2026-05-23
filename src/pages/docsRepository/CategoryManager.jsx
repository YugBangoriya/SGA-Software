// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/components/CategoryManager.jsx
//
//  Side panel (bottom sheet on mobile) for managing
//  document categories: add, rename, delete.
//  Only accessible by Owner and SuperAdmin.
// ─────────────────────────────────────────────────────────
import { useState } from "react";

export default function CategoryManager({
  categories = [],
  docCounts  = {},     // { [categoryId]: number }
  onAdd,
  onRename,
  onDelete,
  onClose,
  darkMode = false,
}) {
  const [newName,      setNewName]      = useState("");
  const [editingId,    setEditingId]    = useState(null);
  const [editValue,    setEditValue]    = useState("");
  const [deletingId,   setDeletingId]   = useState(null);
  const [actionError,  setActionError]  = useState("");
  const [addLoading,   setAddLoading]   = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const bg       = darkMode ? "#1A1A1A" : "#FFFFFF";
  const cardBg   = darkMode ? "#2A2A2A" : "#F5F0EE";
  const text     = darkMode ? "#E8E8E8" : "#222222";
  const subtext  = darkMode ? "#999999" : "#666666";
  const border   = darkMode ? "#3A3A3A" : "#E8E2DF";
  const inputBg  = darkMode ? "#3A3A3A" : "#FFFFFF";

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setActionError("");
    setAddLoading(true);
    try {
      await onAdd(newName.trim());
      setNewName("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRename = async (id) => {
    if (!editValue.trim()) return;
    setActionError("");
    setRenameLoading(true);
    try {
      await onRename(id, editValue.trim());
      setEditingId(null);
      setEditValue("");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setActionError("");
    setDeleteLoading(true);
    try {
      await onDelete(id);
      setDeletingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1050,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: bg,
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 500,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "24px 20px 40px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#661F1F", fontFamily: "'Inter', sans-serif" }}>
              Manage Categories
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: subtext, fontFamily: "'Inter', sans-serif" }}>
              {categories.length} {categories.length === 1 ? "category" : "categories"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20, color: subtext, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {/* Error banner */}
        {actionError && (
          <div style={{ background: "#FFEBEE", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#CC0000", fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            {actionError}
            <button
              onClick={() => setActionError("")}
              style={{ float: "right", background: "transparent", border: "none", color: "#CC0000", cursor: "pointer", fontSize: 14 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Add new category */}
        <div
          style={{
            background: cardBg,
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
            border: `1px solid ${border}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#661F1F", fontFamily: "'Inter', sans-serif", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            New Category
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Category name…"
              style={{
                flex: 1,
                background: inputBg,
                border: `1.5px solid ${border}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                color: text,
                fontFamily: "'Inter', sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || addLoading}
              style={{
                background: newName.trim() ? "#661F1F" : "#CDCBC9",
                color: newName.trim() ? "white" : "#999",
                border: "none",
                borderRadius: 8,
                padding: "0 18px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
                cursor: newName.trim() ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                transition: "background 0.2s",
              }}
            >
              {addLoading ? "Adding…" : "+ Add"}
            </button>
          </div>
        </div>

        {/* Category list */}
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: subtext, fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
            No categories yet. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat) => {
              const count = docCounts[cat.id] || 0;
              const isEditing  = editingId  === cat.id;
              const isDeleting = deletingId === cat.id;

              return (
                <div
                  key={cat.id}
                  style={{
                    background: cardBg,
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    padding: "12px 14px",
                  }}
                >
                  {/* Edit mode */}
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(cat.id);
                          if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          background: inputBg,
                          border: `1.5px solid #661F1F`,
                          borderRadius: 7,
                          padding: "7px 10px",
                          fontSize: 14,
                          color: text,
                          fontFamily: "'Inter', sans-serif",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => handleRename(cat.id)}
                        disabled={renameLoading}
                        style={{ background: "#661F1F", color: "white", border: "none", borderRadius: 7, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                      >
                        {renameLoading ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditValue(""); }}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: subtext, fontSize: 16 }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : isDeleting ? (
                    /* Delete confirmation inline */
                    <div>
                      <div style={{ fontSize: 13, color: "#CC0000", fontFamily: "'Inter', sans-serif", marginBottom: 10 }}>
                        Delete <strong>"{cat.name}"</strong>?
                        {count > 0 && (
                          <span style={{ color: subtext }}> {count} document{count > 1 ? "s" : ""} will become uncategorised.</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setDeletingId(null)}
                          style={{ flex: 1, background: "transparent", border: `1px solid ${border}`, borderRadius: 7, padding: "8px 0", fontSize: 13, color: subtext, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deleteLoading}
                          style={{ flex: 1, background: "#CC0000", border: "none", borderRadius: 7, padding: "8px 0", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                        >
                          {deleteLoading ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal row */
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: text, fontFamily: "'Inter', sans-serif" }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: 12, color: subtext, fontFamily: "'Inter', sans-serif", marginLeft: 8 }}>
                          {count} file{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {/* Rename */}
                      <button
                        onClick={() => { setEditingId(cat.id); setEditValue(cat.name); setDeletingId(null); }}
                        style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#661F1F", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                        title="Rename"
                      >
                        Rename
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => { setDeletingId(cat.id); setEditingId(null); }}
                        style={{ background: "transparent", border: `1px solid #FFCDD2`, borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#CC0000", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                        title="Delete category"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

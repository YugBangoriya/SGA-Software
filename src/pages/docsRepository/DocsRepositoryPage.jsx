// ─────────────────────────────────────────────────────────
//  src/pages/DocsRepository/DocsRepositoryPage.jsx
//
//  Main Docs Repository screen.
//  Access: SuperAdmin + Owner only.
//
//  Layout:
//    • Sticky header with search + actions
//    • Category filter row (horizontal scroll)
//    • Document grid (mobile) / list (toggle)
//    • FAB for upload
//    • All modals (Upload, Preview, Delete, CategoryManager)
// ─────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { useDocsRepository } from "../../hooks/useDocsRepository";
import useAuthStore from "../../store/authStore";
import { canManageDocs } from "../../lib/rbac";
import DocCard from "./DocCard";
import UploadModal from "./UploadModal";
import PreviewModal from "./PreviewModal";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import CategoryManager from "./CategoryManager";

export default function DocsRepositoryPage() {
  const { userRole, userData } = useAuthStore();
  const darkMode = userData?.theme === "dark";

  const {
    documents, categories, loading, error,
    uploadDocument, deleteDocument,
    addCategory, renameCategory, deleteCategory,
  } = useDocsRepository();

  // ── UI state ──────────────────────────────────────────
  const [search,          setSearch]          = useState("");
  const [activeCategory,  setActiveCategory]  = useState(""); // "" = All
  const [viewMode,        setViewMode]        = useState("grid"); // "grid" | "list"
  const [showUpload,      setShowUpload]       = useState(false);
  const [previewDoc,      setPreviewDoc]       = useState(null);
  const [deleteTarget,    setDeleteTarget]     = useState(null);
  const [deleteLoading,   setDeleteLoading]    = useState(false);
  const [showCategoryMgr, setShowCategoryMgr]  = useState(false);
  const [toastMsg,        setToastMsg]         = useState("");

  // ── Access guard ──────────────────────────────────────
  if (!canManageDocs(userRole)) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'Inter', sans-serif", color: "#CC0000" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Access Denied</div>
        <div style={{ fontSize: 14, color: "#666", marginTop: 6 }}>
          The Docs Repository is accessible to Owner and SuperAdmin only.
        </div>
      </div>
    );
  }

  // ── Colours ───────────────────────────────────────────
  const appBg    = darkMode ? "#1A1A1A" : "#CDCBC9";
  const cardBg   = darkMode ? "#2A2A2A" : "#FFFFFF";
  const headerBg = darkMode ? "#2A2A2A" : "#F5F0EE";
  const text      = darkMode ? "#E8E8E8" : "#222222";
  const subtext   = darkMode ? "#999999" : "#666666";
  const border    = darkMode ? "#3A3A3A" : "#E8E2DF";
  const inputBg   = darkMode ? "#3A3A3A" : "#FFFFFF";

  // ── Filtered + searched documents ────────────────────
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchCat = !activeCategory || d.category === activeCategory;
      const matchSearch =
        !search.trim() ||
        d.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (d.categoryName || "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [documents, activeCategory, search]);

  // Count documents per category for CategoryManager
  const docCounts = useMemo(() => {
    const map = {};
    documents.forEach((d) => {
      if (d.category) map[d.category] = (map[d.category] || 0) + 1;
    });
    return map;
  }, [documents]);

  // ── Upload handler ────────────────────────────────────
  const handleUpload = async (file, categoryId, customName, onProgress) => {
    let resolvedCategoryId = categoryId;

    // If user typed a new category inline, create it first
    if (categoryId.startsWith("__new__:")) {
      const catName = categoryId.replace("__new__:", "");
      try {
        // Create category and get its ID
        // Since addCategory doesn't return the ID, we use a workaround:
        // We add the category and then find it in the updated list.
        // This works because onSnapshot updates synchronously in dev.
        await addCategory(catName);
        // Wait a tick for the snapshot to fire
        await new Promise((r) => setTimeout(r, 300));
        const newCat = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase()
        );
        resolvedCategoryId = newCat?.id ?? "";
      } catch {
        resolvedCategoryId = "";
      }
    }

    await uploadDocument(file, resolvedCategoryId, customName, onProgress);
    showToast("Document uploaded successfully!");
  };

  // ── Delete handler ────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDocument(deleteTarget);
      setDeleteTarget(null);
      showToast("Document deleted.");
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Toast ──────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // ─────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────
  return (
    <div style={{ background: appBg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sticky Header ────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "20px 20px 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 4px 16px rgba(102,31,31,0.35)",
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: 22, fontWeight: 700 }}>
              Docs Repository
            </h1>
            <p style={{ margin: "3px 0 0", color: "#F0BABA", fontSize: 13 }}>
              {documents.length} {documents.length === 1 ? "document" : "documents"} stored
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Category manager */}
            <button
              onClick={() => setShowCategoryMgr(true)}
              style={headerBtn}
              title="Manage categories"
            >
              🗂
            </button>
            {/* View toggle */}
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              style={headerBtn}
              title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {viewMode === "grid" ? "☰" : "⊞"}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)",
              color: "#999", fontSize: 16, pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px 10px 38px",
              fontSize: 14,
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              backdropFilter: "blur(4px)",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 10, top: "50%",
                transform: "translateY(-50%)",
                background: "transparent", border: "none",
                color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Category Filter Row ───────────────────────── */}
      <div
        style={{
          background: headerBg,
          borderBottom: `1px solid ${border}`,
          overflowX: "auto",
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {[{ id: "", name: "All" }, ...categories].map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink: 0,
                background: isActive ? "#661F1F" : "transparent",
                color:      isActive ? "#FFFFFF" : (darkMode ? "#BBBBBB" : "#444444"),
                border:     `1.5px solid ${isActive ? "#661F1F" : border}`,
                borderRadius: 20,
                padding:    "6px 14px",
                fontSize:   13,
                fontWeight: isActive ? 700 : 500,
                cursor:     "pointer",
                transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {cat.name}
              {cat.id && (
                <span style={{ marginLeft: 5, opacity: 0.7, fontSize: 11 }}>
                  {docCounts[cat.id] || 0}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Content ──────────────────────────────── */}
      <div style={{ padding: "16px 16px 100px" }}>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: 160,
                  background: darkMode ? "#2A2A2A" : "#E8E2DF",
                  borderRadius: 12,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{ background: "#FFEBEE", borderRadius: 12, padding: "16px 20px", color: "#CC0000", fontSize: 14, marginBottom: 16 }}>
            Failed to load documents: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📂</div>
            <div style={{ color: text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {search || activeCategory ? "No documents found" : "Repository is empty"}
            </div>
            <div style={{ color: subtext, fontSize: 14, marginBottom: 28, maxWidth: 280, margin: "0 auto 28px" }}>
              {search || activeCategory
                ? "Try a different search or category filter."
                : "Upload your first document — price lists, banners, brochures and more."}
            </div>
            {!search && !activeCategory && (
              <button
                onClick={() => setShowUpload(true)}
                style={primaryBtn}
              >
                Upload First Document
              </button>
            )}
          </div>
        )}

        {/* Results count when filtering */}
        {!loading && (search || activeCategory) && filtered.length > 0 && (
          <div style={{ color: subtext, fontSize: 13, marginBottom: 12 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {search ? ` for "${search}"` : ""}
            {activeCategory ? ` in "${categories.find(c => c.id === activeCategory)?.name}"` : ""}
          </div>
        )}

        {/* Grid view */}
        {!loading && viewMode === "grid" && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                view="grid"
                onPreview={setPreviewDoc}
                onDelete={setDeleteTarget}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && viewMode === "list" && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                view="list"
                onPreview={setPreviewDoc}
                onDelete={setDeleteTarget}
                darkMode={darkMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FAB: Upload ───────────────────────────────── */}
      <button
        onClick={() => setShowUpload(true)}
        style={{
          position:     "fixed",
          bottom:       80, // above bottom nav bar
          right:        20,
          width:        56,
          height:       56,
          borderRadius: "50%",
          background:   "#661F1F",
          color:        "white",
          border:       "none",
          boxShadow:    "0 6px 20px rgba(102,31,31,0.45)",
          fontSize:     26,
          cursor:       "pointer",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          zIndex:       40,
          transition:   "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 8px 28px rgba(102,31,31,0.55)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(102,31,31,0.45)";
        }}
        title="Upload document"
        aria-label="Upload document"
      >
        +
      </button>

      {/* ── Toast notification ────────────────────────── */}
      {toastMsg && (
        <div
          style={{
            position:   "fixed",
            bottom:     148,
            left:       "50%",
            transform:  "translateX(-50%)",
            background: "#222222",
            color:      "white",
            borderRadius: 10,
            padding:    "10px 20px",
            fontSize:   13,
            fontWeight: 600,
            boxShadow:  "0 4px 16px rgba(0,0,0,0.3)",
            zIndex:     999,
            whiteSpace: "nowrap",
            animation:  "fadeInUp 0.25s ease",
          }}
        >
          ✓ {toastMsg}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          categories={categories}
          onUpload={handleUpload}
          onClose={() => setShowUpload(false)}
          darkMode={darkMode}
        />
      )}

      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDelete={(doc) => { setPreviewDoc(null); setDeleteTarget(doc); }}
          darkMode={darkMode}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          title="Delete Document"
          message={`"${deleteTarget.fileName}" will be permanently removed from the repository and Firebase Storage. This cannot be undone.`}
          confirmLabel="Delete Permanently"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
          darkMode={darkMode}
        />
      )}

      {showCategoryMgr && (
        <CategoryManager
          categories={categories}
          docCounts={docCounts}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          onClose={() => setShowCategoryMgr(false)}
          darkMode={darkMode}
        />
      )}

      {/* ── Inline CSS for animations ─────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Button style helpers ──────────────────────────────────
const headerBtn = {
  background:   "rgba(255,255,255,0.15)",
  border:       "1px solid rgba(255,255,255,0.25)",
  borderRadius: 9,
  width:        38,
  height:       38,
  display:      "flex",
  alignItems:   "center",
  justifyContent: "center",
  cursor:       "pointer",
  fontSize:     18,
  color:        "white",
  backdropFilter: "blur(4px)",
};

const primaryBtn = {
  background:   "#661F1F",
  color:        "white",
  border:       "none",
  borderRadius: 10,
  padding:      "12px 28px",
  fontSize:     14,
  fontWeight:   700,
  fontFamily:   "'Inter', sans-serif",
  cursor:       "pointer",
};
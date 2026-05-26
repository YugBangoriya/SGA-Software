// SGA — Last updated: Added select-mode + 2-step DELETE confirmation for individual quotation deletion
// src/pages/quotations/QuotationList.jsx
// Phase 5 — Quotation Module — Searchable, filterable list. Owner-only.
//
// NEW: Owner/SuperAdmin can enter "Select Mode" via the Trash icon in the header.
// In select mode each card shows a small checkbox. Selecting one or more reveals
// a red delete bar at the bottom. Deletion requires typing "DELETE" to confirm.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Filter, X, ChevronRight,
  FileText, Loader2, Car, Phone, Trash2,
} from "lucide-react";
import useQuotationStore from "../../store/quotationStore";
import useAuthStore from "../../store/authStore";
import { fetchQuotations, deleteQuotation } from "../../lib/quotationService";
import HomeButton from "../../components/ui/HomeButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}
function formatDate(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    draft: { bg: "#F3E5F5", text: "#6A1B9A", label: "Draft" },
    sent:  { bg: "#E8F5E9", text: "#1A7A1A", label: "Sent"  },
  };
  const c = cfg[status] || cfg.draft;
  return (
    <span className="text-[10px] font-semibold font-sans px-2.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F5F0EE] flex items-center justify-center mb-4">
        <FileText size={28} className="text-[#CDCBC9]" />
      </div>
      <h3 className="text-base font-bold text-[#333] mb-1">
        {hasFilters ? "No quotations match" : "No quotations yet"}
      </h3>
      <p className="text-sm text-[#888] font-sans max-w-xs">
        {hasFilters
          ? "Try adjusting your search or date filters."
          : "Create your first quotation using the button below."}
      </p>
      {hasFilters && (
        <button onClick={onClear}
          className="mt-4 text-sm text-[#661F1F] font-semibold font-sans hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteConfirmModal({ count, onConfirm, onCancel, isDeleting }) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim() === "DELETE";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#FFFFFF", borderRadius: 16,
          padding: "28px 24px", maxWidth: 360, width: "100%",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#FFEBEE",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Trash2 size={22} color="#CC0000" />
          </div>
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#222", textAlign: "center" }}>
          Delete {count} Quotation{count !== 1 ? "s" : ""}?
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#666", textAlign: "center", lineHeight: 1.5 }}>
          This is <strong>permanent</strong> and cannot be undone.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#444" }}>
          Type <strong style={{ color: "#CC0000" }}>DELETE</strong> to confirm:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE here"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px",
            border: `1.5px solid ${confirmed ? "#CC0000" : "#E8E2DF"}`,
            borderRadius: 8, fontSize: 14,
            fontFamily: "'Courier New', monospace", outline: "none",
            marginBottom: 16, letterSpacing: 1,
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && confirmed) onConfirm(); }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              flex: 1, padding: "11px 0",
              background: "none", border: "1.5px solid #E8E2DF",
              borderRadius: 8, color: "#444", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isDeleting}
            style={{
              flex: 1, padding: "11px 0",
              background: confirmed && !isDeleting ? "#CC0000" : "#E0C4C4",
              border: "none", borderRadius: 8,
              color: "#FFFFFF", fontSize: 14, fontWeight: 700,
              cursor: confirmed && !isDeleting ? "pointer" : "not-allowed",
              transition: "background 0.2s",
            }}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quotation Card ───────────────────────────────────────────────────────────
function QuotationCard({ quotation, onClick, selectMode, selected, onSelect }) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onClick}
        className="w-full bg-white rounded-2xl border border-[#E8E2DF] shadow-sm
          hover:shadow-md hover:border-[#C8A0A0] active:bg-[#FDF8F8]
          transition-all text-left overflow-hidden"
        style={{ opacity: selectMode && !selected ? 0.75 : 1 }}
      >
        {/* Top row */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-start gap-2">
            {/* Checkbox in select mode */}
            {selectMode && (
              <div
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 3,
                  border: `2px solid ${selected ? "#CC0000" : "#CCBBBB"}`,
                  background: selected ? "#CC0000" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#661F1F]">
                  {quotation.quotationNumber}
                </span>
                <StatusBadge status={quotation.status} />
                {quotation.isManualVehicle && (
                  <span className="text-[10px] font-semibold font-sans px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#CC6600]">
                    Manual Vehicle
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-[#222] truncate">{quotation.customerName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Car size={11} className="text-[#AAA] flex-shrink-0" />
                <p className="text-xs text-[#666] font-sans truncate">
                  {quotation.vehicleCompany} {quotation.vehicleModel}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-base font-mono font-bold text-[#222]">
              {formatINR(quotation.totalAmount)}
            </span>
            <span className="text-[10px] text-[#AAA] font-sans">
              {formatDate(quotation.createdAt)}
            </span>
          </div>
        </div>

        {/* Bottom row */}
        <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-[#F5F0EE] pt-2">
          <div className="flex items-center gap-1">
            <Phone size={11} className="text-[#AAA]" />
            <span className="text-xs text-[#888] font-sans font-mono">
              +91 {quotation.customerPhone}
            </span>
          </div>
          {!selectMode && (
            <div className="flex items-center gap-1 text-[#661F1F]">
              <span className="text-xs font-semibold font-sans">View</span>
              <ChevronRight size={13} />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuotationList() {
  const navigate = useNavigate();
  const { firebaseUser: currentUser } = useAuthStore();
  const {
    setQuotations, quotations,
    isLoading, setLoading,
    filters, setFilter, clearFilters,
    getFilteredQuotations,
  } = useQuotationStore();

  const [showFilters,     setShowFilters]     = useState(false);
  const [loadError,       setLoadError]       = useState(null);

  // ── Select / Delete state ─────────────────────────────────────────────────
  const [selectMode,      setSelectMode]      = useState(false);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);

  // ─── Load quotations ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchQuotations();
        setQuotations(data);
      } catch (e) {
        console.error(e);
        setLoadError("Failed to load quotations. Pull down to retry.");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredQuotations = getFilteredQuotations();
  const hasActiveFilters = filters.dateFrom || filters.dateTo;

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
    if (!currentUser) return;
    setIsDeleting(true);
    try {
      // Delete all selected in parallel
      await Promise.all([...selectedIds].map((id) => deleteQuotation(id, currentUser)));
      // Remove from local store
      setQuotations(quotations.filter((q) => !selectedIds.has(q.id)));
    } catch (err) {
      console.error("[QuotationList] delete failed:", err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <HomeButton />
              <div>
                <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">Owner</p>
                <h1 className="text-white text-xl font-bold leading-tight">Quotations</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Trash / select mode toggle */}
              {!selectMode && (
                <button
                  onClick={toggleSelectMode}
                  title="Select quotations to delete"
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {selectMode ? (
                <button
                  onClick={toggleSelectMode}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
              ) : (
                <button
                  onClick={() => navigate("/quotations/new")}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white rounded-xl px-4 py-2.5 text-sm font-semibold font-sans transition-colors backdrop-blur-sm"
                >
                  <Plus size={16} />
                  New Quotation
                </button>
              )}
            </div>
          </div>

          {/* Select mode banner */}
          {selectMode && (
            <div className="mt-3 text-center text-white/80 text-xs font-sans">
              {selectedIds.size > 0
                ? `${selectedIds.size} quotation${selectedIds.size !== 1 ? "s" : ""} selected`
                : "Tap a quotation to select it"}
            </div>
          )}

          {/* Search bar — hidden in select mode */}
          {!selectMode && (
            <div className="mt-4 flex gap-2">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA]" />
                <input
                  type="text"
                  placeholder="Search by name, number, or vehicle…"
                  value={filters.searchQuery}
                  onChange={(e) => setFilter("searchQuery", e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/95 text-sm font-sans
                    text-[#222] placeholder-[#AAA] outline-none border-2 border-transparent
                    focus:border-white/50 transition-all"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => setFilter("searchQuery", "")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] hover:text-[#666]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0
                  ${hasActiveFilters || showFilters
                    ? "bg-white text-[#661F1F]"
                    : "bg-white/15 text-white hover:bg-white/25"
                  }`}
              >
                <Filter size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">

        {/* ── Date Filters (expandable) ── */}
        {showFilters && !selectMode && (
          <div className="bg-white rounded-2xl border border-[#E8E2DF] p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#661F1F] font-sans uppercase tracking-wide">
                Filter by Date
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-[#CC0000] font-semibold font-sans hover:underline flex items-center gap-1"
                >
                  <X size={11} /> Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-[#888] font-sans">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-sans
                    text-[#222] outline-none focus:border-[#661F1F] bg-[#FAFAFA]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-[#888] font-sans">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-sans
                    text-[#222] outline-none focus:border-[#661F1F] bg-[#FAFAFA]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Stats strip ── */}
        {!isLoading && filteredQuotations.length > 0 && !selectMode && (
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-xs text-[#666] font-sans">
              <span className="font-bold text-[#333]">{filteredQuotations.length}</span>{" "}
              quotation{filteredQuotations.length !== 1 ? "s" : ""}
              {(filters.searchQuery || hasActiveFilters) ? " found" : " total"}
            </p>
            <p className="text-xs text-[#888] font-sans">
              Total:{" "}
              <span className="font-mono font-bold text-[#333]">
                {formatINR(filteredQuotations.reduce((s, q) => s + (q.totalAmount || 0), 0))}
              </span>
            </p>
          </div>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={28} className="text-[#661F1F] animate-spin" />
            <p className="text-sm text-[#888] font-sans">Loading quotations…</p>
          </div>
        )}

        {/* ── Error ── */}
        {loadError && !isLoading && (
          <div className="bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl px-4 py-4 flex items-center gap-3 mb-4">
            <span className="text-[#CC0000] text-xl">⚠</span>
            <p className="text-sm text-[#CC0000] font-sans">{loadError}</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !loadError && filteredQuotations.length === 0 && (
          <EmptyState
            hasFilters={!!(filters.searchQuery || hasActiveFilters)}
            onClear={clearFilters}
          />
        )}

        {/* ── Quotation cards ── */}
        {!isLoading && !loadError && (
          <div className="flex flex-col gap-3">
            {filteredQuotations.map((q) => (
              <QuotationCard
                key={q.id}
                quotation={q}
                selectMode={selectMode}
                selected={selectedIds.has(q.id)}
                onSelect={() => toggleSelect(q.id)}
                onClick={() => {
                  if (selectMode) { toggleSelect(q.id); return; }
                  navigate(`/quotations/${q.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FAB for mobile ── */}
      {!selectMode && (
        <button
          onClick={() => navigate("/quotations/new")}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#661F1F] text-white
            flex items-center justify-center shadow-2xl shadow-[#661F1F]/40
            hover:bg-[#8B3A3A] active:scale-95 transition-all z-20 sm:hidden"
        >
          <Plus size={22} />
        </button>
      )}

      {/* ── Delete Bottom Bar ── */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#CC0000",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, zIndex: 60,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.25)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#FFF" }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: "#FFFFFF", color: "#CC0000", border: "none", borderRadius: 8,
              padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Trash2 size={14} /> Delete {selectedIds.size}
          </button>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
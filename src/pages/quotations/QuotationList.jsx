// SGA — Last updated: Added HomeButton to header for quick home navigation
// src/pages/quotations/QuotationList.jsx
// Phase 5 — Quotation Module
// Searchable, filterable list of all quotations. Owner-only.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Filter, X, ChevronRight,
  FileText, Loader2, Car, Phone, Calendar, Hash
} from "lucide-react";
import useQuotationStore from "../../store/quotationStore";
import { fetchQuotations } from "../../lib/quotationService";
import HomeButton from '../../components/ui/HomeButton';

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
    sent:  { bg: "#E8F5E9", text: "#1A7A1A", label: "Sent" },
  };
  const c = cfg[status] || cfg.draft;
  return (
    <span className="text-[10px] font-semibold font-sans px-2.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
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

// ─── Quotation Card ───────────────────────────────────────────────────────────
function QuotationCard({ quotation, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-[#E8E2DF] shadow-sm
        hover:shadow-md hover:border-[#C8A0A0] active:bg-[#FDF8F8]
        transition-all text-left overflow-hidden"
    >
      {/* Top row */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Quotation number + status */}
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

          {/* Customer name */}
          <p className="text-base font-bold text-[#222] truncate">{quotation.customerName}</p>

          {/* Vehicle */}
          <div className="flex items-center gap-1 mt-0.5">
            <Car size={11} className="text-[#AAA] flex-shrink-0" />
            <p className="text-xs text-[#666] font-sans truncate">
              {quotation.vehicleCompany} {quotation.vehicleModel}
            </p>
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
      <div className="px-4 pb-3 flex items-center justify-between gap-2
        border-t border-[#F5F0EE] mt-0 pt-2">
        <div className="flex items-center gap-1">
          <Phone size={11} className="text-[#AAA]" />
          <span className="text-xs text-[#888] font-sans font-mono">
            +91 {quotation.customerPhone}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[#661F1F]">
          <span className="text-xs font-semibold font-sans">View</span>
          <ChevronRight size={13} />
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuotationList() {
  const navigate = useNavigate();
  const {
    setQuotations,
    isLoading, setLoading,
    filters, setFilter, clearFilters,
    getFilteredQuotations,
  } = useQuotationStore();

  const [showFilters, setShowFilters] = useState(false);
  const [loadError, setLoadError]     = useState(null);

  // ─── Load quotations ──────────────────────────────────────────────────
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
  }, []);

  const filteredQuotations = getFilteredQuotations();
  const hasActiveFilters = filters.dateFrom || filters.dateTo;

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
            <button
              onClick={() => navigate("/quotations/new")}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white
                rounded-xl px-4 py-2.5 text-sm font-semibold font-sans transition-colors backdrop-blur-sm"
            >
              <Plus size={16} />
              New Quotation
            </button>
          </div>

          {/* ── Search bar ── */}
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
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">

        {/* ── Date Filters (expandable) ── */}
        {showFilters && (
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
        {!isLoading && filteredQuotations.length > 0 && (
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
                onClick={() => navigate(`/quotations/${q.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FAB for mobile ── */}
      <button
        onClick={() => navigate("/quotations/new")}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-[#661F1F] text-white
          flex items-center justify-center shadow-2xl shadow-[#661F1F]/40
          hover:bg-[#8B3A3A] active:scale-95 transition-all z-20 sm:hidden"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
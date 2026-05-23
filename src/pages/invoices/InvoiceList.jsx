// ============================================================
// InvoiceList.jsx — Invoice list + Pending Approvals section
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Filter, X, Clock, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceCard from "../../components/invoices/InvoiceCard";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import { formatCurrency, formatDate } from "../../lib/invoiceHelpers";

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "EMI", label: "EMI" },
  { value: "LOAN", label: "Loan" },
];

export default function InvoiceList() {
  const navigate = useNavigate();
  const { firebaseUser: currentUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    invoices, pendingInvoices, dbLocked, dbLockedBy,
    subscribeInvoices, subscribeSystemConfig, loadSettings,
    approveInvoice, rejectInvoice, loading, cleanup,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilter, setShowFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [approvalLoading, setApprovalLoading] = useState({});
  const [confirmReject, setConfirmReject] = useState(null);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  useEffect(() => {
    const unsubConfig = subscribeSystemConfig();
    loadSettings();
    const unsubInvoices = subscribeInvoices(role);
    return () => {
      if (unsubConfig) unsubConfig();
      if (unsubInvoices) unsubInvoices();
    };
  }, []);

  // ── Filter logic ──────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchName = inv.customerSnapshot?.name?.toLowerCase().includes(q);
        const matchPhone = inv.customerSnapshot?.phone?.includes(q);
        const matchVehicle = inv.vehicleSnapshot?.registrationNo?.toLowerCase().includes(q);
        const matchNo = inv.invoiceNo?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchVehicle && !matchNo) return false;
      }

      // Status
      if (statusFilter !== "ALL") {
        if (statusFilter === "PENDING" && inv.status !== "PENDING") return false;
        if (statusFilter !== "PENDING" && inv.paymentStatus !== statusFilter) return false;
      }

      // Date range
      if (dateFrom || dateTo) {
        const invDate = inv.invoiceDate?.toDate
          ? inv.invoiceDate.toDate()
          : inv.invoiceDate
          ? new Date(inv.invoiceDate + "T00:00:00")
          : null;
        if (invDate) {
          if (dateFrom && invDate < new Date(dateFrom + "T00:00:00")) return false;
          if (dateTo && invDate > new Date(dateTo + "T23:59:59")) return false;
        }
      }

      return true;
    });
  }, [invoices, search, statusFilter, dateFrom, dateTo]);

  // ── Approve ────────────────────────────────────────────
  const handleApprove = async (invoiceId) => {
    if (!currentUser) return;
    setApprovalLoading((p) => ({ ...p, [invoiceId]: "approving" }));
    try {
      await approveInvoice(invoiceId, currentUser);
    } catch (err) {
      alert("Approval failed: " + err.message);
    } finally {
      setApprovalLoading((p) => ({ ...p, [invoiceId]: null }));
    }
  };

  // ── Reject ─────────────────────────────────────────────
  const handleReject = async (invoiceId) => {
    if (!currentUser) return;
    setApprovalLoading((p) => ({ ...p, [invoiceId]: "rejecting" }));
    try {
      await rejectInvoice(invoiceId, currentUser);
    } catch (err) {
      alert("Rejection failed: " + err.message);
    } finally {
      setApprovalLoading((p) => ({ ...p, [invoiceId]: null }));
      setConfirmReject(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 80 }}>
      {/* ── Header ────────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "20px 18px 16px",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 700, margin: 0 }}>
              Invoices
            </h1>
            <div style={{ color: "#F0BABA", fontSize: 12, fontFamily: "Arial, sans-serif", marginTop: 2 }}>
              {invoices.length} total
              {pendingInvoices.length > 0 && (
                <span style={{ marginLeft: 8, background: "#FF9800", color: "#FFFFFF", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                  {pendingInvoices.length} pending
                </span>
              )}
            </div>
          </div>
          {(isOwnerOrAbove || role === "employee") && (
            <button
              onClick={() => navigate("/invoices/new")}
              style={{
                background: "#FFFFFF",
                color: "#661F1F",
                border: "none",
                borderRadius: 10,
                padding: "9px 14px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <Plus size={16} /> New
            </button>
          )}
        </div>

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <Search size={15} color="rgba(255,255,255,0.6)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search by name, phone, vehicle, invoice no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 36px 10px 36px",
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              color: "#FFFFFF",
              fontSize: 13,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setShowFilter(!showFilter)}
            style={{
              position: "absolute",
              right: search ? 30 : 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: showFilter ? "rgba(255,255,255,0.25)" : "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.8)",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <Filter size={15} />
          </button>
        </div>
      </div>

      {/* ── Filter panel ─────────────────────────────── */}
      {showFilter && (
        <div
          style={{
            background: isDark ? "#2A2A2A" : "#FFFFFF",
            borderBottom: `1px solid ${border}`,
            padding: "12px 18px",
          }}
        >
          {/* Status chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: `1.5px solid ${statusFilter === f.value ? "#661F1F" : border}`,
                  background: statusFilter === f.value ? "#661F1F" : "none",
                  color: statusFilter === f.value ? "#FFFFFF" : textSecondary,
                  fontSize: 12,
                  fontWeight: statusFilter === f.value ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Date range */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 3, fontFamily: "Arial, sans-serif" }}>From</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: "100%", padding: "7px 10px", border: `1px solid ${border}`,
                  borderRadius: 6, background: isDark ? "#1A1A1A" : "#F5F0EE",
                  color: textPrimary, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 3, fontFamily: "Arial, sans-serif" }}>To</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: "100%", padding: "7px 10px", border: `1px solid ${border}`,
                  borderRadius: 6, background: isDark ? "#1A1A1A" : "#F5F0EE",
                  color: textPrimary, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 16px", maxWidth: 640, margin: "0 auto" }}>
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {/* ── Pending Approvals Section ──────────────── */}
        {!dbLocked && isOwnerOrAbove && pendingInvoices.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Clock size={16} color="#FF9800" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#CC6600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                Pending Approval ({pendingInvoices.length})
              </span>
            </div>

            {pendingInvoices.map((inv) => {
              const al = approvalLoading[inv.id];
              return (
                <div
                  key={inv.id}
                  style={{
                    background: isDark ? "#2A2A2A" : "#FFFAF0",
                    border: "1.5px solid #FFD888",
                    borderRadius: 12,
                    padding: "14px 14px 12px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 13, color: "#661F1F" }}>
                          {inv.invoiceNo}
                        </span>
                        <InvoiceStatusBadge invoice="PENDING" size="xs" />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, marginTop: 3 }}>
                        {inv.customerSnapshot?.name}
                      </div>
                      <div style={{ fontSize: 12, color: textSecondary, marginTop: 1 }}>
                        {inv.vehicleSnapshot?.registrationNo} · Created by {inv.createdByName}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
                        {formatCurrency(inv.totalAmount)}
                      </div>
                      <div style={{ fontSize: 11, color: textSecondary }}>
                        {formatDate(inv.invoiceDate || inv.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Approve / Reject buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleApprove(inv.id)}
                      disabled={!!al}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        background: al === "approving" ? "#888" : "#1A7A1A",
                        border: "none",
                        borderRadius: 8,
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: al ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        fontFamily: "inherit",
                        transition: "background 0.15s",
                      }}
                    >
                      <CheckCircle2 size={15} />
                      {al === "approving" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      onClick={() => setConfirmReject(inv.id)}
                      disabled={!!al}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        background: al === "rejecting" ? "#888" : "none",
                        border: "1.5px solid #CC0000",
                        borderRadius: 8,
                        color: "#CC0000",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: al ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        fontFamily: "inherit",
                      }}
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── All Invoices ───────────────────────────── */}
        {!dbLocked && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {statusFilter === "ALL" ? "All Invoices" : STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                <span style={{ fontWeight: 400, marginLeft: 6 }}>({filteredInvoices.length})</span>
              </span>
              {isOwnerOrAbove && (
                <button
                  onClick={() => navigate("/invoices/pending-payments")}
                  style={{
                    background: "none",
                    border: `1px solid ${border}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    color: "#CC6600",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Pending Payments →
                </button>
              )}
            </div>

            {filteredInvoices.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 20px",
                  background: isDark ? "#2A2A2A" : "#FFFFFF",
                  borderRadius: 14,
                  border: `1.5px dashed ${border}`,
                  color: textSecondary,
                }}
              >
                <AlertTriangle size={36} color="#CCBBBB" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>No invoices found</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {search ? "Try a different search term." : "Create your first invoice."}
                </div>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  onClick={(id) => navigate(`/invoices/${id}`)}
                  darkMode={isDark}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* ── Reject confirmation dialog ────────────────── */}
      {confirmReject && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 20,
          }}
          onClick={() => setConfirmReject(null)}
        >
          <div
            style={{
              background: isDark ? "#2A2A2A" : "#FFFFFF",
              borderRadius: 16,
              padding: "24px 22px",
              maxWidth: 360,
              width: "100%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#FFEBEE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle size={26} color="#CC0000" />
              </div>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, textAlign: "center", margin: "0 0 8px" }}>
              Reject Invoice?
            </h3>
            <p style={{ fontSize: 13, color: textSecondary, textAlign: "center", margin: "0 0 20px" }}>
              This will permanently delete the invoice. The employee will need to create a new one.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmReject(null)}
                style={{
                  flex: 1, padding: "10px 0", background: "none",
                  border: `1.5px solid ${border}`, borderRadius: 8,
                  color: textPrimary, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(confirmReject)}
                style={{
                  flex: 1, padding: "10px 0", background: "#CC0000",
                  border: "none", borderRadius: 8,
                  color: "#FFFFFF", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
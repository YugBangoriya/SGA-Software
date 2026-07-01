// SGA — Last updated: Added Edit button in header for Owner/SuperAdmin; navigates to /invoices/:id/edit
// ============================================================
// InvoiceDetail.jsx — View, reprint, resend, approve invoice
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Download, Send, CheckCircle2, XCircle, Trash2,
  Phone, Car, Package, CreditCard, Calendar, Edit, AlertTriangle,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import {
  formatCurrency, formatDate, getDisplayStatus,
  generateAndDownloadPDF, sendInvoiceViaWhatsApp, isReturnInvoice,
  PAYMENT_METHOD_LABELS,
} from "../../lib/invoiceHelpers";

export default function InvoiceDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { firebaseUser: currentUser, role } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    currentInvoice, loadInvoice, dbLocked, dbLockedBy,
    businessSettings, approveInvoice, approveReturnInvoice, rejectInvoice,
    deleteInvoice, subscribeSystemConfig, loadSettings,
    logPdfDownload, logWhatsAppSent, loading, error,
  } = useInvoiceStore();

  const isDark = theme === "dark";
  const isOwnerOrAbove = ["owner", "superadmin"].includes(role);
  const justCreated = searchParams.get("created") === "true";

  const [pdfLoading, setPdfLoading] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [actionMsg, setActionMsg] = useState(justCreated ? "Invoice created successfully!" : null);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const sectionBg = isDark ? "#1A1A1A" : "#F5F0EE";

  useEffect(() => {
    subscribeSystemConfig();
    loadSettings();
    if (id) loadInvoice(id);
    if (justCreated) setTimeout(() => setActionMsg(null), 4000);
  }, [id]);

  const inv = currentInvoice;
  const displayStatus = inv ? getDisplayStatus(inv) : null;

  // ── PDF download ─────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!currentUser) return;
    setPdfLoading(true);
    try {
      await generateAndDownloadPDF(inv, businessSettings);
      await logPdfDownload(id, inv.invoiceNo, currentUser);
    } catch (err) {
      alert("PDF generation failed: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // ── WhatsApp send ─────────────────────────────────────
  const handleWhatsApp = async () => {
    if (!currentUser) return;
    setWaLoading(true);
    try {
      const phone = inv.customerSnapshot?.phone;
      if (!phone) throw new Error("No phone number on customer record.");
      await sendInvoiceViaWhatsApp(id, phone);
      await logWhatsAppSent(id, inv.invoiceNo, phone, currentUser);
      setActionMsg("Invoice sent via WhatsApp!");
      setTimeout(() => setActionMsg(null), 3500);
    } catch (err) {
      alert("WhatsApp send failed: " + err.message);
    } finally {
      setWaLoading(false);
    }
  };

  // ── Approve ───────────────────────────────────────────
  const handleApprove = async () => {
    if (!currentUser) return;
    setApprovalLoading("approving");
    try {
      const isReturn = inv?.invoiceType === "RETURN" || inv?.invoiceNo?.startsWith("RET_INV");
      if (isReturn) {
        await approveReturnInvoice(id, currentUser);
        setActionMsg("Return invoice approved! Items added back to inventory.");
      } else {
        await approveInvoice(id, currentUser);
        setActionMsg("Invoice approved! Inventory deducted.");
      }
      setTimeout(() => setActionMsg(null), 3500);
    } catch (err) {
      alert("Approval failed: " + err.message);
    } finally {
      setApprovalLoading(null);
    }
  };

  // ── Reject ────────────────────────────────────────────
  const handleReject = async () => {
    if (!currentUser) return;
    setApprovalLoading("rejecting");
    try {
      await rejectInvoice(id, currentUser);
      navigate("/invoices");
    } catch (err) {
      alert("Rejection failed: " + err.message);
      setApprovalLoading(null);
    }
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async () => {
    if (!currentUser) return;
    try {
      await deleteInvoice(id, currentUser);
      navigate("/invoices");
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const SectionCard = ({ icon: Icon, title, children }) => (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${border}` }}>
        <Icon size={15} color="#661F1F" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Arial, sans-serif" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, mono, amber, bold, green, red }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: amber ? "#CC6600" : green ? "#1A7A1A" : red ? "#CC0000" : textPrimary, fontFamily: mono ? "'Courier New', monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );

  if (loading && !inv) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#661F1F", fontSize: 16 }}>Loading invoice...</div>
      </div>
    );
  }

  if (error && !inv) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#CC0000", fontSize: 14 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 100 }}>
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          background: "#661F1F",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button onClick={() => navigate("/invoices")} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#FFFFFF", display: "flex" }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 15, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
            {inv?.invoiceNo || "Invoice"}
          </div>
          {inv && (
            <div style={{ marginTop: 3 }}>
              <InvoiceStatusBadge invoice={inv} size="xs" />
            </div>
          )}
        </div>
        {isOwnerOrAbove && inv && (
          <button
            onClick={() => navigate(`/invoices/${id}/edit`)}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#FFFFFF", display: "flex" }}
            title="Edit invoice"
          >
            <Edit size={16} />
          </button>
        )}
        {isOwnerOrAbove && inv && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#FFAAAA", display: "flex" }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* ── Success message ──────────────────────────── */}
      {actionMsg && (
        <div
          style={{
            background: "#E8F5E9",
            borderBottom: "1px solid #C8E6C9",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} color="#1A7A1A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A7A1A" }}>{actionMsg}</span>
        </div>
      )}

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {inv && !dbLocked && (
          <>
            {/* ── Pending approval actions ─────────────── */}
            {inv.status === "PENDING" && isOwnerOrAbove && (
              <div
                style={{
                  background: isDark ? "#2A2218" : "#FFFAF0",
                  border: "2px solid #FFD888",
                  borderRadius: 12,
                  padding: "14px",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <AlertTriangle size={16} color="#CC6600" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#CC6600" }}>
                    Awaiting Your Approval
                  </span>
                </div>
                <p style={{ fontSize: 12, color: textSecondary, margin: "0 0 12px" }}>
                  Approving will deduct the selected items from live inventory.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleApprove}
                    disabled={approvalLoading === "approving"}
                    style={{ flex: 1, padding: "10px 0", background: "#1A7A1A", border: "none", borderRadius: 8, color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}
                  >
                    <CheckCircle2 size={15} />
                    {approvalLoading === "approving" ? "Approving..." : "Approve Invoice"}
                  </button>
                  <button
                    onClick={() => setConfirmReject(true)}
                    disabled={approvalLoading === "rejecting"}
                    style={{ flex: 1, padding: "10px 0", background: "none", border: "1.5px solid #CC0000", borderRadius: 8, color: "#CC0000", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}
                  >
                    <XCircle size={15} />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* ── Customer ─────────────────────────────── */}
            <SectionCard icon={Phone} title="Customer">
              <Row label="Name" value={inv.customerSnapshot?.name || "—"} bold />
              <Row label="Phone" value={inv.customerSnapshot?.phone || "—"} />
              {inv.customerSnapshot?.alternatePhone && (
                <Row label="Alt. Phone" value={inv.customerSnapshot.alternatePhone} />
              )}
            </SectionCard>

            {/* ── Vehicle ──────────────────────────────── */}
            <SectionCard icon={Car} title="Vehicle">
              <Row label="Reg. No." value={inv.vehicleSnapshot?.registrationNo || "—"} mono bold />
              <Row label="Make / Model" value={`${inv.vehicleSnapshot?.make || ""} ${inv.vehicleSnapshot?.model || ""}`.trim() || "—"} />
              {inv.vehicleSnapshot?.year && <Row label="Year" value={inv.vehicleSnapshot.year} />}
              {inv.vehicleSnapshot?.emissionCategory && <Row label="Emission" value={inv.vehicleSnapshot.emissionCategory} />}
            </SectionCard>

            {/* ── Items ────────────────────────────────── */}
            <SectionCard icon={Package} title={`Items (${(inv.items || []).length})`}>
              {(inv.items || []).map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: idx < (inv.items.length - 1) ? `1px solid ${border}` : "none" }}>
                  <div>
                    <div style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: textSecondary }}>{item.quantity} × {formatCurrency(item.sellingPrice)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
                    {formatCurrency(item.sellingPrice * item.quantity)}
                  </span>
                </div>
              ))}
              {parseFloat(inv.labourCost || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <span style={{ fontSize: 13, color: textPrimary }}>Labour</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
                    {formatCurrency(inv.labourCost)}
                  </span>
                </div>
              )}
            </SectionCard>

            {/* ── Totals ───────────────────────────────── */}
            <SectionCard icon={CreditCard} title="Totals & Payment">
              <Row label="Subtotal" value={formatCurrency(inv.subtotal || 0)} mono />
              {inv.gstEnabled && (
                <>
                  <Row label="CGST (9%)" value={formatCurrency(inv.cgst || 0)} mono />
                  <Row label="SGST (9%)" value={formatCurrency(inv.sgst || 0)} mono />
                </>
              )}
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 8, marginTop: 4 }}>
                {/* Show discount breakdown if discount was applied */}
                {parseFloat(inv.discountAmount || 0) > 0 ? (
                  <>
                    <Row label="Invoice Total" value={formatCurrency(inv.preDiscountTotal || inv.totalAmount || 0)} mono />
                    <Row label="Discount" value={`- ${formatCurrency(inv.discountAmount)}`} mono amber />
                    <div style={{ borderTop: `1px solid ${border}`, paddingTop: 6, marginTop: 4 }}>
                      <Row label="Revised Total" value={formatCurrency(inv.totalAmount || 0)} mono bold green />
                    </div>
                  </>
                ) : (
                  <Row label="Total Amount" value={formatCurrency(inv.totalAmount || 0)} mono bold />
                )}
                <Row label="Amount Paid" value={formatCurrency(inv.amountPaid || 0)} mono green />
                <Row
                  label="Balance Due"
                  value={formatCurrency(Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)))}
                  mono bold
                  red={Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)) > 0}
                  green={Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0)) === 0}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <Row label="Payment Method" value={PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod || "—"} />
                {inv.loanProvider && <Row label="Provider" value={inv.loanProvider} />}
                {inv.emiAmount && <Row label="EMI / Month" value={formatCurrency(inv.emiAmount)} mono />}
                {inv.loanCompletionDate && <Row label="Est. Completion" value={formatDate(inv.loanCompletionDate)} />}
                {inv.paymentNote && <Row label="Note" value={inv.paymentNote} />}
              </div>
            </SectionCard>

            {/* ── Invoice Date ─────────────────────────── */}
            <SectionCard icon={Calendar} title="Invoice Info">
              <Row
                label="Invoice Date"
                value={formatDate(inv.invoiceDate || inv.createdAt)}
                amber={inv.isDateOverridden}
              />
              {inv.isDateOverridden && (
                <div style={{ fontSize: 11, color: "#CC6600", background: "#FFF3E0", borderRadius: 6, padding: "5px 8px", marginBottom: 6 }}>
                  ⚠ Date was manually overridden
                </div>
              )}
              {inv.dueDate && <Row label="Due Date" value={formatDate(inv.dueDate)} />}
              <Row label="Created By" value={inv.createdByName || "—"} />
              <Row label="Created At" value={formatDate(inv.createdAt)} />
              {inv.approvedByName && <Row label="Approved By" value={inv.approvedByName} />}
              {inv.approvedAt && <Row label="Approved At" value={formatDate(inv.approvedAt)} />}
            </SectionCard>
          </>
        )}
      </div>

      {/* ── Action buttons bar ──────────────────────────── */}
      {inv && !dbLocked && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: isDark ? "#1A1A1A" : "#FFFFFF",
            borderTop: `1px solid ${border}`,
            padding: "12px 16px",
            display: "flex",
            gap: 10,
            maxWidth: 640,
            margin: "0 auto",
            zIndex: 50,
            boxSizing: "border-box",
          }}
        >
          {/* PDF Download */}
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "none",
              border: `1.5px solid #661F1F`,
              borderRadius: 10,
              color: "#661F1F",
              fontWeight: 700,
              fontSize: 13,
              cursor: pdfLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              fontFamily: "inherit",
              opacity: pdfLoading ? 0.7 : 1,
            }}
          >
            <Download size={15} />
            {pdfLoading ? "Generating..." : "PDF"}
          </button>

          {/* WhatsApp send */}
          <button
            onClick={handleWhatsApp}
            disabled={waLoading}
            style={{
              flex: 2,
              padding: "11px 0",
              background: waLoading ? "#888" : "#25D366",
              border: "none",
              borderRadius: 10,
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 13,
              cursor: waLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              fontFamily: "inherit",
              boxShadow: waLoading ? "none" : "0 2px 10px rgba(37,211,102,0.4)",
            }}
          >
            <Send size={15} />
            {waLoading ? "Sending..." : "Send via WhatsApp"}
          </button>
        </div>
      )}

      {/* ── Reject confirmation ───────────────────────── */}
      {confirmReject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: cardBg, borderRadius: 16, padding: "24px 22px", maxWidth: 340, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, textAlign: "center", margin: "0 0 8px" }}>Reject Invoice?</h3>
            <p style={{ fontSize: 13, color: textSecondary, textAlign: "center", margin: "0 0 20px" }}>This will permanently delete the invoice.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmReject(false)} style={{ flex: 1, padding: "10px 0", background: "none", border: `1.5px solid ${border}`, borderRadius: 8, color: textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleReject} style={{ flex: 1, padding: "10px 0", background: "#CC0000", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: cardBg, borderRadius: 16, padding: "24px 22px", maxWidth: 340, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, textAlign: "center", margin: "0 0 8px" }}>Delete Invoice?</h3>
            <p style={{ fontSize: 13, color: textSecondary, textAlign: "center", margin: "0 0 20px" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "10px 0", background: "none", border: `1.5px solid ${border}`, borderRadius: 8, color: textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: "10px 0", background: "#CC0000", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// SGA — Last updated: Multi-method payment support — added payment history timeline, "Record Payment" button (AddPaymentEntryModal), delete entry handler, and computeTotalPaid for accurate balance calculations on all invoices (new entries model + legacy amountPaid backward-compat)
// ============================================================
// InvoiceDetail.jsx — View, reprint, resend, approve invoice
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Download, Send, CheckCircle2, XCircle, Trash2,
  Phone, Car, Package, CreditCard, Calendar, Edit, AlertTriangle, Plus,
} from "lucide-react";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import AddPaymentEntryModal from "../../components/invoices/AddPaymentEntryModal";
import {
  formatCurrency, formatDate, getDisplayStatus,
  generateAndDownloadPDF, sendInvoiceViaWhatsApp, isReturnInvoice,
  PAYMENT_METHOD_LABELS, computeTotalPaid,
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
    deleteInvoice, deletePaymentEntry, subscribeSystemConfig, loadSettings,
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
  const [loadDone, setLoadDone] = useState(false);
  // Payment entry management
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const sectionBg = isDark ? "#1A1A1A" : "#F5F0EE";

  useEffect(() => {
    setLoadDone(false);
    subscribeSystemConfig();
    loadSettings();
    if (id) {
      loadInvoice(id).finally(() => setLoadDone(true));
    } else {
      setLoadDone(true);
    }
    if (justCreated) setTimeout(() => setActionMsg(null), 4000);
  }, [id]);

  const inv = currentInvoice;
  const displayStatus = inv ? getDisplayStatus(inv) : null;

  // Compute totals using backward-compat shim
  const totalPaid  = inv ? computeTotalPaid(inv) : 0;
  const balanceDue = inv ? Math.max(0, (inv.totalAmount || 0) - totalPaid) : 0;

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

  // ── Delete invoice ─────────────────────────────────────
  const handleDelete = async () => {
    if (!currentUser) return;
    try {
      await deleteInvoice(id, currentUser);
      navigate("/invoices");
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // ── Delete a payment entry ─────────────────────────────
  const handleDeleteEntry = async (entryId) => {
    if (!currentUser || !entryId) return;
    setDeletingEntryId(entryId);
    try {
      await deletePaymentEntry(id, entryId, currentUser);
      setConfirmDeleteEntryId(null);
    } catch (err) {
      alert("Failed to delete payment entry: " + err.message);
    } finally {
      setDeletingEntryId(null);
    }
  };

  const SectionCard = ({ icon: Icon, title, children }) => (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
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

  if (!loadDone || (loading && !inv)) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#661F1F", fontSize: 16 }}>Loading invoice...</div>
      </div>
    );
  }

  if (error && !inv) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#CC0000", fontSize: 14, fontFamily: "Arial, sans-serif" }}>{error}</div>
        <button onClick={() => { setLoadDone(false); loadInvoice(id).finally(() => setLoadDone(true)); }} style={{ background: "#661F1F", color: "#FFF", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13 }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, paddingBottom: 100 }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ background: "#661F1F", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 40, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
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
            onClick={() => navigate(inv.status === "PENDING" ? `/invoices/${id}/edit-items` : `/invoices/${id}/edit`)}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#FFFFFF", display: "flex" }}
            title={inv.status === "PENDING" ? "Edit invoice items before approving" : "Edit dates / GST / discount / loan details"}
          >
            <Edit size={16} />
          </button>
        )}
        {isOwnerOrAbove && inv && (
          <button onClick={() => setConfirmDelete(true)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", color: "#FF8A8A", display: "flex" }} title="Delete Invoice">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* ── Success / action banner ──────────────────── */}
      {actionMsg && (
        <div style={{ background: "#E8F5E9", borderBottom: "1px solid #C8E6C9", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} color="#1A7A1A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A7A1A" }}>{actionMsg}</span>
        </div>
      )}

      {/* ── DB Lock banner ───────────────────────────── */}
      {dbLocked && (
        <div style={{ padding: "12px 16px" }}>
          <DBLockedBanner lockedBy={dbLockedBy} />
        </div>
      )}

      <div style={{ padding: "12px 16px", maxWidth: 640, margin: "0 auto" }}>
        {inv && !dbLocked && (
          <>
            {/* ── PENDING approval card ─────────────────── */}
            {inv.status === "PENDING" && isOwnerOrAbove && (
              <div style={{ background: "#FFF8E1", border: "1.5px solid #FFB74D", borderRadius: 12, padding: "16px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <AlertTriangle size={16} color="#CC6600" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#CC6600" }}>Awaiting Your Approval</span>
                </div>
                <p style={{ fontSize: 12, color: textSecondary, margin: "0 0 10px" }}>
                  Review the items below before approving. Approving will deduct the selected items from live inventory.
                </p>
                <button
                  onClick={() => navigate(`/invoices/${id}/edit-items`)}
                  style={{ width: "100%", padding: "9px 0", marginBottom: 10, background: "none", border: "1.5px solid #CC6600", borderRadius: 8, color: "#CC6600", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit" }}
                >
                  <Edit size={14} />
                  Edit Items / Labour / Payment
                </button>
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
              {inv.customerSnapshot?.alternatePhone && <Row label="Alt. Phone" value={inv.customerSnapshot.alternatePhone} />}
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

            {/* ── Totals & Payment ─────────────────────── */}
            <SectionCard icon={CreditCard} title="Totals & Payment">
              {/* ── Subtotal / GST / Discount breakdown ── */}
              <Row label="Subtotal" value={formatCurrency(inv.subtotal || 0)} mono />
              {inv.gstEnabled && (
                <>
                  <Row label="CGST (9%)" value={formatCurrency(inv.cgst || 0)} mono />
                  <Row label="SGST (9%)" value={formatCurrency(inv.sgst || 0)} mono />
                </>
              )}
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 8, marginTop: 4 }}>
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
              </div>

              {/* ── Payment Records ─────────────────────── */}
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 8 }}>
                {Array.isArray(inv.paymentEntries) && inv.paymentEntries.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontFamily: "Arial, sans-serif" }}>
                      Payment Records ({inv.paymentEntries.length})
                    </div>
                    {inv.paymentEntries.map((entry, idx) => (
                      <div key={entry.id || idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: isDark ? "#1A2A1A" : "#F0FFF4", borderRadius: 8, marginBottom: 6, border: `1px solid ${isDark ? "#2A3A2A" : "#C8E6C9"}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: textPrimary, fontWeight: 600 }}>
                            {PAYMENT_METHOD_LABELS[entry.method] || entry.method}
                          </div>
                          <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                            {entry.date ? new Date(entry.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            {entry.reference ? ` · ${entry.reference}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
                          {formatCurrency(entry.amount)}
                        </span>
                        {isOwnerOrAbove && inv.status === "APPROVED" && (
                          <button
                            onClick={() => setConfirmDeleteEntryId(entry.id)}
                            disabled={deletingEntryId === entry.id}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#CC0000", display: "flex", opacity: deletingEntryId === entry.id ? 0.5 : 1 }}
                            title="Delete this payment entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : parseFloat(inv.amountPaid || 0) > 0 ? (
                  /* Legacy invoice — no paymentEntries array, show old flat field */
                  <Row label="Amount Paid" value={formatCurrency(inv.amountPaid || 0)} mono green />
                ) : null}

                {/* Total Paid / Balance Due */}
                <div style={{ marginTop: 8 }}>
                  <Row label="Total Paid" value={formatCurrency(totalPaid)} mono green={totalPaid > 0} />
                  <Row label="Balance Due" value={formatCurrency(balanceDue)} mono bold red={balanceDue > 0} green={balanceDue === 0} />
                </div>
              </div>

              {/* ── Loan / EMI details ───────────────────── */}
              <div style={{ marginTop: 8 }}>
                {inv.paymentMethod && (
                  <Row label="Payment Arrangement" value={PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod || "—"} />
                )}
                {inv.loanProvider && <Row label="Loan Provider" value={inv.loanProvider} />}
                {inv.emiAmount && <Row label="EMI / Month" value={formatCurrency(inv.emiAmount)} mono />}
                {inv.loanCompletionDate && <Row label="Est. Completion" value={formatDate(inv.loanCompletionDate)} />}
                {inv.paymentNote && <Row label="Invoice Note" value={inv.paymentNote} />}
              </div>

              {/* ── Record Payment button ────────────────── */}
              {isOwnerOrAbove && inv.status === "APPROVED" && balanceDue > 0 && (
                <button
                  onClick={() => setShowAddPayment(true)}
                  style={{
                    width: "100%",
                    marginTop: 14,
                    padding: "11px 0",
                    background: "#1A7A1A",
                    border: "none",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontFamily: "inherit",
                    boxShadow: "0 2px 8px rgba(26,122,26,0.25)",
                  }}
                >
                  <Plus size={15} />
                  Record Payment ({formatCurrency(balanceDue)} remaining)
                </button>
              )}
            </SectionCard>

            {/* ── Invoice Info ─────────────────────────── */}
            <SectionCard icon={Calendar} title="Invoice Info">
              <Row label="Invoice Date" value={formatDate(inv.invoiceDate || inv.createdAt)} amber={inv.isDateOverridden} />
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
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: isDark ? "#1A1A1A" : "#FFFFFF", borderTop: `1px solid ${border}`, padding: "12px 16px", display: "flex", gap: 10, maxWidth: 640, margin: "0 auto", zIndex: 50, boxSizing: "border-box" }}>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{ flex: 1, padding: "11px 0", background: "none", border: "1.5px solid #661F1F", borderRadius: 10, color: "#661F1F", fontWeight: 700, fontSize: 13, cursor: pdfLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", opacity: pdfLoading ? 0.7 : 1 }}
          >
            <Download size={15} />
            {pdfLoading ? "Generating..." : "PDF"}
          </button>
          <button
            onClick={handleWhatsApp}
            disabled={waLoading}
            style={{ flex: 2, padding: "11px 0", background: waLoading ? "#888" : "#25D366", border: "none", borderRadius: 10, color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: waLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: "inherit", boxShadow: waLoading ? "none" : "0 2px 10px rgba(37,211,102,0.4)" }}
          >
            <Send size={15} />
            {waLoading ? "Sending..." : "Send via WhatsApp"}
          </button>
        </div>
      )}

      {/* ── Add Payment Modal ─────────────────────────── */}
      {showAddPayment && inv && (
        <AddPaymentEntryModal
          invoice={inv}
          balanceDue={balanceDue}
          onClose={() => setShowAddPayment(false)}
          onSuccess={() => setActionMsg("Payment recorded successfully!")}
          darkMode={isDark}
        />
      )}

      {/* ── Confirm delete payment entry ──────────────── */}
      {confirmDeleteEntryId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: cardBg, borderRadius: 16, padding: "24px 22px", maxWidth: 340, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, textAlign: "center", margin: "0 0 8px" }}>Delete Payment Entry?</h3>
            <p style={{ fontSize: 13, color: textSecondary, textAlign: "center", margin: "0 0 20px" }}>
              This will remove this payment from the record and recalculate the balance due. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteEntryId(null)} style={{ flex: 1, padding: "10px 0", background: "none", border: `1.5px solid ${border}`, borderRadius: 8, color: textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => handleDeleteEntry(confirmDeleteEntryId)} disabled={!!deletingEntryId} style={{ flex: 1, padding: "10px 0", background: "#CC0000", border: "none", borderRadius: 8, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: deletingEntryId ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {deletingEntryId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
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
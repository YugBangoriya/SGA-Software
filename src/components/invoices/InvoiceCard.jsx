// SGA — Last updated: Added isPendingPayment prop for distinct teal/blue highlight on partial-payment invoices; different color from return invoice (burgundy-rose) highlight
// ============================================================
// InvoiceCard.jsx — Invoice list card with status, date flag
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { Car, Phone, Calendar, IndianRupee, ChevronRight } from "lucide-react";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import { formatCurrency, formatDate, getDisplayStatus } from "../../lib/invoiceHelpers";

// ── Color scheme for return invoices (existing) ─────────────────────────
// Light: soft rose background  #FDF6F6 / border #EDD8D8
// Dark:  dark rose             #2A2020 / border #4A2828

// ── Color scheme for partial/pending-payment invoices (NEW) ─────────────
// Uses a cool teal/blue tone — clearly distinct from the warm rose of returns
// Light: soft sky-blue background  #F0F7FF / border #C8DFFF
// Dark:  dark steel blue           #1A2433 / border #2A3D55

export default function InvoiceCard({ invoice, onClick, darkMode, isReturn }) {
  const displayStatus = getDisplayStatus(invoice);
  const isDark = darkMode;

  // Determine if this invoice has a pending / partial payment
  const isPendingPayment = ["PARTIALLY_PAID", "UNPAID", "EMI", "LOAN"].includes(invoice.paymentStatus)
    && invoice.status === "APPROVED";  // Only approved invoices with pending payment get the tint

  // Return invoices: warm rose tint (existing behaviour, unchanged)
  // Partial-payment invoices: cool teal-blue tint (new)
  // Normal invoices: plain white / dark card

  let cardBackground, cardBorder;

  if (isReturn) {
    cardBackground = isDark ? "#2A2020" : "#FDF6F6";
    cardBorder     = isDark ? "#4A2828" : "#EDD8D8";
  } else if (isPendingPayment) {
    cardBackground = isDark ? "#1A2433" : "#F0F7FF";
    cardBorder     = isDark ? "#2A3D55" : "#C8DFFF";
  } else {
    cardBackground = isDark ? "#2A2A2A" : "#FFFFFF";
    cardBorder     = isDark ? "#3A3A3A" : "#E8E2DF";
  }

  const card = {
    background:    cardBackground,
    border:        `1.5px solid ${cardBorder}`,
    borderRadius:  12,
    padding:       "14px 16px",
    cursor:        "pointer",
    transition:    "all 0.18s ease",
    display:       "flex",
    flexDirection: "column",
    gap:           10,
    boxShadow:     "0 2px 8px rgba(0,0,0,0.06)",
    marginBottom:  10,
  };

  const textPrimary   = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  return (
    <div
      style={card}
      onClick={() => onClick(invoice.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(102,31,31,0.12)";
        e.currentTarget.style.borderColor = isReturn
          ? "#8B3A3A"
          : isPendingPayment
          ? "#5588CC"
          : "#8B3A3A";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
        e.currentTarget.style.borderColor = cardBorder;
      }}
    >
      {/* Top row: invoice number + status badge + type badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily:    "'Courier New', monospace",
              fontWeight:    700,
              fontSize:      14,
              color:         isReturn ? "#8B3A3A" : isPendingPayment ? "#1A4A8A" : "#661F1F",
              letterSpacing: 0.5,
            }}
          >
            {invoice.invoiceNo}
          </span>

          {/* RETURN badge — shown on return invoices */}
          {isReturn && (
            <span
              style={{
                background:    "#F5E6E6",
                color:         "#8B3A3A",
                fontSize:      9,
                fontWeight:    700,
                padding:       "2px 6px",
                borderRadius:  4,
                fontFamily:    "Arial, sans-serif",
                letterSpacing: 0.5,
                border:        "1px solid #E8C8C8",
              }}
            >
              RETURN
            </span>
          )}

          {/* PARTIAL / PENDING badge — shown on pending-payment invoices that are NOT return invoices */}
          {isPendingPayment && !isReturn && (
            <span
              style={{
                background:    "#E3F2FD",
                color:         "#1A4A8A",
                fontSize:      9,
                fontWeight:    700,
                padding:       "2px 6px",
                borderRadius:  4,
                fontFamily:    "Arial, sans-serif",
                letterSpacing: 0.5,
                border:        "1px solid #BBDEFB",
              }}
            >
              PENDING PMT
            </span>
          )}

          {/* Date override indicator */}
          {invoice.isDateOverridden && (
            <span
              style={{
                background:    "#FFF3E0",
                color:         "#CC6600",
                fontSize:      9,
                fontWeight:    700,
                padding:       "2px 6px",
                borderRadius:  4,
                fontFamily:    "Arial, sans-serif",
                letterSpacing: 0.3,
                border:        "1px solid #FFB74D",
              }}
            >
              M
            </span>
          )}
        </div>
        <InvoiceStatusBadge invoice={invoice} size="sm" />
      </div>

      {/* Customer name + vehicle */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Phone size={13} color={textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
            {invoice.customerSnapshot?.name || "Unknown Customer"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Car size={13} color={textSecondary} />
          <span style={{ fontSize: 12, color: textSecondary }}>
            {invoice.vehicleSnapshot?.registrationNo || "—"}
            {invoice.vehicleSnapshot?.make && ` · ${invoice.vehicleSnapshot.make} ${invoice.vehicleSnapshot.model || ""}`}
          </span>
        </div>
      </div>

      {/* Bottom row: date + amount + chevron */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar
            size={12}
            color={invoice.isDateOverridden ? "#CC6600" : textSecondary}
          />
          <span
            style={{
              fontSize:   12,
              color:      invoice.isDateOverridden ? "#CC6600" : textSecondary,
              fontWeight: invoice.isDateOverridden ? 600 : 400,
            }}
          >
            {formatDate(invoice.invoiceDate)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IndianRupee size={13} color={textPrimary} />
          <span
            style={{
              fontSize:   14,
              fontWeight: 700,
              color:      textPrimary,
              fontFamily: "'Courier New', monospace",
            }}
          >
            {formatCurrency(invoice.totalAmount).replace("₹", "")}
          </span>
          <ChevronRight size={16} color={textSecondary} />
        </div>
      </div>

      {/* Pending payment balance row */}
      {["PARTIALLY_PAID", "UNPAID", "EMI", "LOAN"].includes(displayStatus) && (
        <div
          style={{
            background:    isPendingPayment ? "#E8F0FF" : (displayStatus === "UNPAID" ? "#FFEBEE" : "#FFF3E0"),
            borderRadius:  6,
            padding:       "6px 10px",
            display:       "flex",
            justifyContent: "space-between",
            alignItems:    "center",
            border:        `1px solid ${isPendingPayment ? "#C0D4F8" : (displayStatus === "UNPAID" ? "#FFCDD2" : "#FFE0B2")}`,
          }}
        >
          <span style={{ fontSize: 11, color: "#666", fontFamily: "Arial, sans-serif" }}>
            Balance Due
          </span>
          <span
            style={{
              fontSize:   12,
              fontWeight: 700,
              color:      isPendingPayment ? "#1A4A8A" : (displayStatus === "UNPAID" ? "#CC0000" : "#CC6600"),
              fontFamily: "'Courier New', monospace",
            }}
          >
            {formatCurrency(
              Math.max(0, (invoice.totalAmount || 0) - (invoice.amountPaid || 0))
            )}
          </span>
        </div>
      )}
    </div>
  );
}
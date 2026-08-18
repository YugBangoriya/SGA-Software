// SGA — Last updated: Fixed ₹ glyph rendering in PDF — replaced formatCurrency with formatCurrencyPDF (uses "Rs." prefix) throughout all <Text> nodes; Helvetica WinAnsiEncoding does not include U+20B9 so the ₹ symbol was rendering as "1" in generated PDFs
// ============================================================
// InvoicePDF.jsx — @react-pdf/renderer Invoice Template
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import LOGO_BASE64 from "../../assets/logo_base64";
import {
  formatCurrencyPDF,
  formatDate,
  DEFAULT_TERMS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  computeTotalPaid,
} from "../../lib/invoiceHelpers";

// ── Colors ────────────────────────────────────────────────
const C = {
  primary:      "#661F1F",
  primaryLight: "#8B3A3A",
  bg:           "#FFFFFF",
  cardBg:       "#F5F0EE",
  border:       "#E8E2DF",
  textDark:     "#222222",
  textMid:      "#555555",
  textLight:    "#888888",
  green:        "#1A7A1A",
  greenBg:      "#E8F5E9",
  amber:        "#CC6600",
  amberBg:      "#FFF3E0",
  red:          "#CC0000",
  redBg:        "#FFEBEE",
  blue:         "#0055CC",
  blueBg:       "#E3F2FD",
  purple:       "#6A1B9A",
  purpleBg:     "#F3E5F5",
  tableHeaderBg: "#661F1F",
  tableAltRow:  "#FAF6F5",
};

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 36, paddingBottom: 60, paddingHorizontal: 44,
    fontFamily: "Helvetica", fontSize: 10, color: C.textDark,
  },

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    marginBottom: 20, paddingBottom: 16,
    borderBottomWidth: 2, borderBottomColor: C.primary,
  },
  logoBox:       { width: 72, height: 72, marginRight: 16 },
  logo:          { width: 72, height: 72, objectFit: "contain" },
  businessInfo:  { flex: 1 },
  businessName:  { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  businessTagline: { fontSize: 9, color: C.primaryLight, marginBottom: 5, letterSpacing: 1, textTransform: "uppercase" },
  businessDetail:  { fontSize: 9, color: C.textMid, marginBottom: 2 },
  invoiceTitleBox: { alignItems: "flex-end", justifyContent: "flex-end" },
  invoiceTitle:    { fontSize: 26, fontFamily: "Helvetica-Bold", color: C.primary, letterSpacing: 2, textTransform: "uppercase" },
  invoiceNo:       { fontSize: 11, fontFamily: "Courier", color: C.textDark, marginTop: 4 },
  invoiceDateRow:  { fontSize: 9, color: C.textMid, marginTop: 3 },

  // GST Strip
  gstStrip:  { backgroundColor: C.cardBg, borderRadius: 4, padding: "6 12", marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.primary },
  gstText:   { fontSize: 9, color: C.textMid },
  gstValue:  { fontFamily: "Helvetica-Bold", color: C.textDark },

  // Customer + Vehicle panel
  infoRow:         { flexDirection: "row", gap: 12, marginBottom: 16 },
  infoPanel:       { flex: 1, backgroundColor: C.cardBg, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border },
  infoPanelTitle:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
  infoLine:        { flexDirection: "row", marginBottom: 3 },
  infoLabel:       { fontSize: 9, color: C.textLight, width: 80 },
  infoValue:       { fontSize: 9, color: C.textDark, fontFamily: "Helvetica-Bold", flex: 1 },

  // Items table
  tableTitle:      { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  table:           { marginBottom: 0, borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: "hidden" },
  tableHeader:     { flexDirection: "row", backgroundColor: C.tableHeaderBg, padding: "7 10" },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow:        { flexDirection: "row", padding: "7 10", borderTopWidth: 1, borderTopColor: C.border },
  tableRowAlt:     { backgroundColor: C.tableAltRow },
  tableCell:       { fontSize: 9, color: C.textDark },
  tableCellMono:   { fontSize: 9, color: C.textDark, fontFamily: "Courier" },
  colNo:           { width: 28 },
  colDesc:         { flex: 1 },
  colQty:          { width: 44, textAlign: "center" },
  colPrice:        { width: 72, textAlign: "right" },
  colTotal:        { width: 80, textAlign: "right" },
  labourRow:       { flexDirection: "row", padding: "7 10", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: "#FBF8F7" },

  // Totals
  totalsSection:   { flexDirection: "row", justifyContent: "flex-end", marginTop: 0, borderTopWidth: 2, borderTopColor: C.primary },
  totalsBox:       { width: 240, padding: "10 12" },
  totalLine:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel:      { fontSize: 9, color: C.textMid },
  totalValue:      { fontSize: 9, color: C.textDark, fontFamily: "Courier" },
  dividerLine:     { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 4 },
  grandTotalLine:  { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  grandTotalValue: { fontSize: 11, fontFamily: "Courier-Bold", color: C.primary },

  // Payment section
  paymentSection:    { flexDirection: "row", gap: 12, marginTop: 14 },
  paymentPanel:      { flex: 1, backgroundColor: C.cardBg, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border },
  paymentPanelTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
  statusBadge:       { borderRadius: 99, padding: "3 10", alignSelf: "flex-start", marginTop: 4 },
  statusBadgeText:   { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },

  // Payment entry row (in totals box)
  entryLine: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 3,
    paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  entryLabel: { fontSize: 8, color: C.textMid, flex: 1 },
  entryValue: { fontSize: 8, color: C.green,   fontFamily: "Courier" },

  // Signature
  signatureSection: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  signatureBox:     { width: "45%", alignItems: "center" },
  signatureLine:    { borderTopWidth: 1, borderTopColor: C.textMid, width: "100%", marginBottom: 4, paddingTop: 32 },
  signatureLabel:   { fontSize: 9, color: C.textMid, textAlign: "center" },

  // Terms
  termsSection: { marginTop: 16, padding: 12, backgroundColor: C.cardBg, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  termsTitle:   { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  termsText:    { fontSize: 8, color: C.textLight, lineHeight: 1.5 },

  // Footer
  footer:     { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: C.textLight },
});

// ── Status badge colors ────────────────────────────────────
const getStatusStyle = (status) => {
  const map = {
    PAID:           { bg: C.greenBg,  color: C.green  },
    PARTIALLY_PAID: { bg: C.amberBg,  color: C.amber  },
    UNPAID:         { bg: C.redBg,    color: C.red    },
    EMI:            { bg: C.blueBg,   color: C.blue   },
    LOAN:           { bg: C.blueBg,   color: C.blue   },
    PENDING:        { bg: C.purpleBg, color: C.purple },
    APPROVED:       { bg: C.blueBg,   color: C.blue   },
  };
  return map[status] || map.UNPAID;
};

// ── Format a date string from an ISO date string (not Timestamp) ───────────
function fmtDateStr(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Main PDF Document ──────────────────────────────────────
export default function InvoicePDFDocument({ invoice, businessSettings }) {
  const biz     = businessSettings || {};
  const customer = invoice.customerSnapshot || {};
  const vehicle  = invoice.vehicleSnapshot  || {};
  const items    = invoice.items    || [];
  const labourCost      = parseFloat(invoice.labourCost      || 0);
  const gstEnabled      = invoice.gstEnabled && biz.gstNumber;
  const cgst            = parseFloat(invoice.cgst            || 0);
  const sgst            = parseFloat(invoice.sgst            || 0);
  const discountAmount  = parseFloat(invoice.discountAmount  || 0);
  const preDiscountTotal = parseFloat(invoice.preDiscountTotal || invoice.totalAmount || 0);
  const totalAmount     = parseFloat(invoice.totalAmount     || 0);

  // ── totalPaid: backward-compat shim ─────────────────────
  // Reads paymentEntries[] if present; falls back to legacy amountPaid scalar.
  const totalPaid  = computeTotalPaid(invoice);
  const balanceDue = Math.max(0, totalAmount - totalPaid);

  const displayStatus  = invoice.status === "PENDING" ? "PENDING" : invoice.paymentStatus || "UNPAID";
  const statusSt       = getStatusStyle(displayStatus);
  const terms          = biz.invoiceTermsAndConditions || DEFAULT_TERMS;

  // Whether this invoice has multi-entry payment data
  const hasEntries  = Array.isArray(invoice.paymentEntries) && invoice.paymentEntries.length > 0;
  const multiEntry  = hasEntries && invoice.paymentEntries.length > 1;

  // Collect distinct payment methods from entries (for Payment Details panel)
  const entryMethods = hasEntries
    ? [...new Set(invoice.paymentEntries.map(e => PAYMENT_METHOD_LABELS[e.method] || e.method))]
    : [];

  return (
    <Document
      title={invoice.invoiceNo || "Invoice"}
      author="Shree Ganesh Automobile"
      subject="CNG Kit Installation Invoice"
    >
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ─────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Image src={biz.businessLogoUrl || LOGO_BASE64} style={styles.logo} />
          </View>
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>{biz.businessName || "Shree Ganesh Automobile"}</Text>
            <Text style={styles.businessTagline}>CNG Kit Installation Specialists</Text>
            {biz.businessPhone  && <Text style={styles.businessDetail}>Ph: {biz.businessPhone}</Text>}
            {biz.businessAddress && <Text style={styles.businessDetail}>{biz.businessAddress}</Text>}
            {gstEnabled && biz.gstNumber && <Text style={styles.businessDetail}>GSTIN: {biz.gstNumber}</Text>}
          </View>
          <View style={styles.invoiceTitleBox}>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceNo}>{invoice.invoiceNo || "—"}</Text>
            <Text style={styles.invoiceDateRow}>Date: {formatDate(invoice.invoiceDate)}</Text>
            {invoice.dueDate && <Text style={styles.invoiceDateRow}>Due: {formatDate(invoice.dueDate)}</Text>}
            {invoice.isDateOverridden && <Text style={[styles.invoiceDateRow, { color: C.amber }]}>⚠ Date manually changed</Text>}
          </View>
        </View>

        {/* ── CUSTOMER + VEHICLE INFO ─────────────────────── */}
        <View style={styles.infoRow}>
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>Bill To</Text>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{customer.name || "—"}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{customer.phone || "—"}</Text>
            </View>
            {customer.alternatePhone && (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>Alt. Phone</Text>
                <Text style={styles.infoValue}>{customer.alternatePhone}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>Vehicle Details</Text>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Reg. No.</Text>
              <Text style={styles.infoValue}>{vehicle.registrationNo || "—"}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Make / Model</Text>
              <Text style={styles.infoValue}>{vehicle.make} {vehicle.model}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Year</Text>
              <Text style={styles.infoValue}>{vehicle.year || "—"}</Text>
            </View>
            {vehicle.emissionCategory && (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>Emission</Text>
                <Text style={styles.infoValue}>{vehicle.emissionCategory}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── ITEMS TABLE ─────────────────────────────────── */}
        <Text style={styles.tableTitle}>Items &amp; Services</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNo]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>

          {items.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tableCell,     styles.colNo]}>{idx + 1}</Text>
              <Text style={[styles.tableCell,     styles.colDesc]}>{item.name || item.itemName}</Text>
              <Text style={[styles.tableCellMono, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCellMono, styles.colPrice]}>{formatCurrencyPDF(item.sellingPrice)}</Text>
              <Text style={[styles.tableCellMono, styles.colTotal]}>{formatCurrencyPDF(item.sellingPrice * item.quantity)}</Text>
            </View>
          ))}

          {labourCost > 0 && (
            <View style={styles.labourRow}>
              <Text style={[styles.tableCell,     styles.colNo]}>{items.length + 1}</Text>
              <Text style={[styles.tableCell,     styles.colDesc]}>Labour / Installation Charges</Text>
              <Text style={[styles.tableCellMono, styles.colQty]}>1</Text>
              <Text style={[styles.tableCellMono, styles.colPrice]}>{formatCurrencyPDF(labourCost)}</Text>
              <Text style={[styles.tableCellMono, styles.colTotal]}>{formatCurrencyPDF(labourCost)}</Text>
            </View>
          )}
        </View>

        {/* ── TOTALS ──────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrencyPDF(invoice.subtotal || 0)}</Text>
            </View>

            {gstEnabled && (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>CGST (9%)</Text>
                  <Text style={styles.totalValue}>{formatCurrencyPDF(cgst)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>SGST (9%)</Text>
                  <Text style={styles.totalValue}>{formatCurrencyPDF(sgst)}</Text>
                </View>
              </>
            )}

            <View style={styles.dividerLine} />

            {discountAmount > 0 ? (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Invoice Total</Text>
                  <Text style={[styles.totalValue, { color: C.textMid }]}>{formatCurrencyPDF(preDiscountTotal)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={[styles.totalLabel, { color: C.amber }]}>Discount</Text>
                  <Text style={[styles.totalValue, { color: C.amber }]}>- {formatCurrencyPDF(discountAmount)}</Text>
                </View>
                <View style={styles.dividerLine} />
                <View style={styles.grandTotalLine}>
                  <Text style={styles.grandTotalLabel}>REVISED TOTAL</Text>
                  <Text style={styles.grandTotalValue}>{formatCurrencyPDF(totalAmount)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.grandTotalLine}>
                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                <Text style={styles.grandTotalValue}>{formatCurrencyPDF(totalAmount)}</Text>
              </View>
            )}

            <View style={[styles.dividerLine, { marginTop: 8 }]} />

            {/* ── Payment entries / Amount Paid ───────────────────
                Multi-entry: render a compact ledger showing each payment
                with date, method, and amount, then a "Total Paid" sum line.
                Single-entry or legacy: render the familiar single "Amount Paid" row.
             ─────────────────────────────────────────────────────── */}
            {multiEntry ? (
              <>
                <View style={[styles.totalLine, { marginTop: 4 }]}>
                  <Text style={[styles.totalLabel, { fontFamily: "Helvetica-Bold", color: C.textDark }]}>
                    Payments Received
                  </Text>
                </View>
                {invoice.paymentEntries.map((entry, idx) => (
                  <View key={entry.id || idx} style={styles.entryLine}>
                    <Text style={styles.entryLabel}>
                      {entry.date ? fmtDateStr(entry.date) : "—"} · {PAYMENT_METHOD_LABELS[entry.method] || entry.method}
                      {entry.reference ? ` (${entry.reference})` : ""}
                    </Text>
                    <Text style={styles.entryValue}>{formatCurrencyPDF(entry.amount)}</Text>
                  </View>
                ))}
                <View style={[styles.totalLine, { marginTop: 2 }]}>
                  <Text style={[styles.totalLabel, { fontFamily: "Helvetica-Bold" }]}>Total Paid</Text>
                  <Text style={[styles.totalValue, { color: C.green, fontFamily: "Courier-Bold" }]}>{formatCurrencyPDF(totalPaid)}</Text>
                </View>
              </>
            ) : (
              /* Single entry or legacy invoice — classic "Amount Paid" line */
              <View style={[styles.totalLine, { marginTop: 4 }]}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={[styles.totalValue, { color: C.green }]}>{formatCurrencyPDF(totalPaid)}</Text>
              </View>
            )}

            <View style={styles.totalLine}>
              <Text style={[styles.totalLabel, { fontFamily: "Helvetica-Bold" }]}>Balance Due</Text>
              <Text style={[styles.totalValue, { color: balanceDue > 0 ? C.red : C.green, fontFamily: "Courier-Bold" }]}>
                {formatCurrencyPDF(balanceDue)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── PAYMENT DETAILS ─────────────────────────────── */}
        <View style={styles.paymentSection}>
          <View style={styles.paymentPanel}>
            <Text style={styles.paymentPanelTitle}>Payment Details</Text>

            {/* Show methods from entries (may be multiple), or legacy paymentMethod */}
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>
                {entryMethods.length > 0
                  ? entryMethods.join(", ")
                  : (PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod || "—")}
              </Text>
            </View>

            {invoice.loanProvider && (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>Provider</Text>
                <Text style={styles.infoValue}>{invoice.loanProvider}</Text>
              </View>
            )}
            {invoice.emiAmount && (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>EMI / Month</Text>
                <Text style={styles.infoValue}>{formatCurrencyPDF(invoice.emiAmount)}</Text>
              </View>
            )}
            {invoice.loanCompletionDate && (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>Est. Completion</Text>
                <Text style={styles.infoValue}>{formatDate(invoice.loanCompletionDate)}</Text>
              </View>
            )}
          </View>

          <View style={[styles.paymentPanel, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={styles.paymentPanelTitle}>Payment Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusSt.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusSt.color }]}>
                {PAYMENT_STATUS_LABELS[displayStatus] || displayStatus}
              </Text>
            </View>
            {invoice.paymentNote && (
              <Text style={[styles.infoLine, { fontSize: 8, color: C.textLight, marginTop: 6 }]}>
                {invoice.paymentNote}
              </Text>
            )}
          </View>
        </View>

        {/* ── TERMS ───────────────────────────────────────── */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
          <Text style={styles.termsText}>{terms}</Text>
        </View>

        {/* ── SIGNATURE ───────────────────────────────────── */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Customer Signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Authorised Signatory{"\n"}Shree Ganesh Automobile
            </Text>
          </View>
        </View>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{invoice.invoiceNo} — Shree Ganesh Automobile</Text>
          <Text style={styles.footerText}>Thank you for your business!</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
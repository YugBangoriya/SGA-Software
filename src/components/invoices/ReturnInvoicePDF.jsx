// SGA — Last updated: Fixed ₹ glyph rendering in PDF — replaced formatCurrency with formatCurrencyPDF (uses "Rs." prefix) in all <Text> nodes; Helvetica does not include U+20B9, causing ₹ to render as "1" in generated PDFs
// ============================================================
// ReturnInvoicePDF.jsx — @react-pdf/renderer Return Invoice Template
// Shree Ganesh Automobile
// ============================================================

import {
  Document, Page, Text, View, Image, StyleSheet,
} from "@react-pdf/renderer";
import LOGO_BASE64 from "../../assets/logo_base64";
import {
  formatCurrencyPDF, formatDate, DEFAULT_TERMS, PAYMENT_METHOD_LABELS,
} from "../../lib/invoiceHelpers";

const C = {
  primary:      "#8B3A3A",
  primaryLight: "#B85C5C",
  bg:           "#FFFFFF",
  cardBg:       "#FFF8F8",
  border:       "#E8D8D8",
  textDark:     "#222222",
  textMid:      "#555555",
  textLight:    "#888888",
  amber:        "#CC6600",
  amberBg:      "#FFF3E0",
  green:        "#1A7A1A",
  greenBg:      "#E8F5E9",
  red:          "#CC0000",
  tableHeaderBg: "#8B3A3A",
  tableAltRow:  "#FDF8F8",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 36, paddingBottom: 60, paddingHorizontal: 44,
    fontFamily: "Helvetica", fontSize: 10, color: C.textDark,
  },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    marginBottom: 20, paddingBottom: 16,
    borderBottomWidth: 2, borderBottomColor: C.primary,
  },
  logoBox:        { width: 72, height: 72, marginRight: 16 },
  logo:           { width: 72, height: 72, objectFit: "contain" },
  businessInfo:   { flex: 1 },
  businessName:   { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  businessDetail: { fontSize: 9, color: C.textMid, marginBottom: 2 },
  invoiceTitleBox:{ alignItems: "flex-end", justifyContent: "flex-end" },
  invoiceTitle:   { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.primary, letterSpacing: 1 },
  returnBadge:    { backgroundColor: C.amberBg, borderRadius: 4, padding: "3 8", marginTop: 4, alignSelf: "flex-end" },
  returnBadgeText:{ fontSize: 9, fontFamily: "Helvetica-Bold", color: C.amber, letterSpacing: 1 },
  invoiceNo:      { fontSize: 11, color: C.textDark, marginTop: 4, fontFamily: "Courier" },
  invoiceDateRow: { fontSize: 9, color: C.textMid, marginTop: 3 },

  infoRow:        { flexDirection: "row", gap: 12, marginBottom: 16 },
  infoPanel:      { flex: 1, backgroundColor: C.cardBg, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border },
  infoPanelTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },
  infoLine:       { flexDirection: "row", marginBottom: 3 },
  infoLabel:      { fontSize: 9, color: C.textLight, width: 80 },
  infoValue:      { fontSize: 9, color: C.textDark, fontFamily: "Helvetica-Bold", flex: 1 },

  tableTitle:      { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  table:           { marginBottom: 0, borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: "hidden" },
  tableHeader:     { flexDirection: "row", backgroundColor: C.tableHeaderBg, padding: "7 10" },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow:        { flexDirection: "row", padding: "7 10", borderTopWidth: 1, borderTopColor: C.border },
  tableRowAlt:     { backgroundColor: C.tableAltRow },
  tableCell:       { fontSize: 9, color: C.textDark },
  tableCellMono:   { fontSize: 9, color: C.textDark, fontFamily: "Courier" },
  colNo:           { width: 22 },
  colDesc:         { flex: 1 },
  colQty:          { width: 36, textAlign: "center" },
  colOrigPrice:    { width: 72, textAlign: "right" },
  colReturnPrice:  { width: 72, textAlign: "right" },
  colTotal:        { width: 72, textAlign: "right" },

  totalsSection:   { flexDirection: "row", justifyContent: "flex-end", marginTop: 0, borderTopWidth: 2, borderTopColor: C.primary },
  totalsBox:       { width: 220, padding: "10 12" },
  totalLine:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel:      { fontSize: 9, color: C.textMid },
  totalValue:      { fontSize: 9, color: C.textDark, fontFamily: "Courier" },
  dividerLine:     { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 4 },
  grandTotalLine:  { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  grandTotalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  grandTotalValue: { fontSize: 11, fontFamily: "Courier-Bold",   color: C.primary },

  paymentSection:    { flexDirection: "row", gap: 12, marginTop: 14 },
  paymentPanel:      { flex: 1, backgroundColor: C.cardBg, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border },
  paymentPanelTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4 },

  returnNotice:    { backgroundColor: C.amberBg, borderRadius: 4, padding: "8 12", marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.amber },
  returnNoticeText:{ fontSize: 9, color: C.amber, fontFamily: "Helvetica-Bold" },

  termsSection:    { marginTop: 16, padding: 12, backgroundColor: C.cardBg, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  termsTitle:      { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  termsText:       { fontSize: 8, color: C.textLight, lineHeight: 1.5 },

  signatureSection:{ flexDirection: "row", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border },
  signatureBox:    { width: "45%", alignItems: "center" },
  signatureLine:   { borderTopWidth: 1, borderTopColor: C.textMid, width: "100%", marginBottom: 4, paddingTop: 32 },
  signatureLabel:  { fontSize: 9, color: C.textMid, textAlign: "center" },

  footer:          { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  footerText:      { fontSize: 8, color: C.textLight },
});

export default function ReturnInvoicePDFDocument({ invoice, businessSettings }) {
  const biz = businessSettings || {};
  const customer         = invoice.customerSnapshot || {};
  const returnItems      = invoice.returnItems      || [];
  const totalReturnAmount = parseFloat(invoice.totalReturnAmount || 0);
  const terms            = biz.invoiceTermsAndConditions || DEFAULT_TERMS;

  // Human-readable refund method label using the shared label map.
  // Handles legacy raw values (e.g. "CASH") and new values (e.g. "BANK_TRANSFER").
  const refundMethodLabel =
    PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod || "—";

  return (
    <Document
      title={invoice.invoiceNo || "Return Invoice"}
      author="Shree Ganesh Automobile"
      subject="Return Invoice"
    >
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ── */}
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Image src={biz.businessLogoUrl || LOGO_BASE64} style={styles.logo} />
          </View>
          <View style={styles.businessInfo}>
            <Text style={styles.businessName}>
              {biz.businessName || "Shree Ganesh Automobile"}
            </Text>
            <Text style={[styles.businessDetail, { color: C.primaryLight, letterSpacing: 1 }]}>
              CNG Kit Installation Specialists
            </Text>
            {biz.businessPhone   && <Text style={styles.businessDetail}>Ph: {biz.businessPhone}</Text>}
            {biz.businessAddress && <Text style={styles.businessDetail}>{biz.businessAddress}</Text>}
          </View>
          <View style={styles.invoiceTitleBox}>
            <Text style={styles.invoiceTitle}>RETURN INVOICE</Text>
            <View style={styles.returnBadge}>
              <Text style={styles.returnBadgeText}>RETURN / REFUND</Text>
            </View>
            <Text style={styles.invoiceNo}>{invoice.invoiceNo || "—"}</Text>
            <Text style={styles.invoiceDateRow}>
              Date: {formatDate(invoice.returnDate || invoice.invoiceDate)}
            </Text>
          </View>
        </View>

        {/* ── RETURN NOTICE ── */}
        <View style={styles.returnNotice}>
          <Text style={styles.returnNoticeText}>
            ⚠  This is a return / refund invoice. Items have been returned to stock.
          </Text>
        </View>

        {/* ── CUSTOMER + RETURN DETAILS ── */}
        <View style={styles.infoRow}>
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>Customer</Text>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{customer.name || "—"}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{customer.phone || "—"}</Text>
            </View>
          </View>

          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>Return Details</Text>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Invoice No.</Text>
              <Text style={styles.infoValue}>{invoice.invoiceNo || "—"}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Return Date</Text>
              <Text style={styles.infoValue}>
                {formatDate(invoice.returnDate || invoice.invoiceDate)}
              </Text>
            </View>
            {/* Fixed: was invoice.paymentMethod (raw enum) — now uses PAYMENT_METHOD_LABELS */}
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>Refund Method</Text>
              <Text style={styles.infoValue}>{refundMethodLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── RETURNED ITEMS TABLE ── */}
        <Text style={styles.tableTitle}>Returned Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNo]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colOrigPrice]}>Orig. Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colReturnPrice]}>Return Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Return Total</Text>
          </View>

          {returnItems.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.tableCell,     styles.colNo]}>{idx + 1}</Text>
              <Text style={[styles.tableCell,     styles.colDesc]}>{item.name}</Text>
              <Text style={[styles.tableCellMono, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCellMono, styles.colOrigPrice]}>{formatCurrencyPDF(item.originalPrice)}</Text>
              <Text style={[styles.tableCellMono, styles.colReturnPrice]}>{formatCurrencyPDF(item.returnPrice)}</Text>
              <Text style={[styles.tableCellMono, styles.colTotal]}>
                {formatCurrencyPDF(parseFloat(item.returnPrice || 0) * (item.quantity || 1))}
              </Text>
            </View>
          ))}
        </View>

        {/* ── TOTALS ── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.dividerLine} />
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>TOTAL REFUND</Text>
              <Text style={styles.grandTotalValue}>{formatCurrencyPDF(totalReturnAmount)}</Text>
            </View>
            <View style={[styles.dividerLine, { marginTop: 6 }]} />
            <View style={[styles.totalLine, { marginTop: 4 }]}>
              <Text style={[styles.totalLabel, { color: C.amber }]}>Refund Paid to Customer</Text>
              <Text style={[styles.totalValue, { color: C.amber, fontFamily: "Courier-Bold" }]}>
                {formatCurrencyPDF(totalReturnAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── PAYMENT NOTE ── */}
        {invoice.paymentNote && (
          <View style={styles.paymentSection}>
            <View style={[styles.paymentPanel, { flex: 1 }]}>
              <Text style={styles.paymentPanelTitle}>Note</Text>
              <Text style={{ fontSize: 9, color: C.textMid }}>{invoice.paymentNote}</Text>
            </View>
          </View>
        )}

        {/* ── TERMS ── */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
          <Text style={styles.termsText}>{terms}</Text>
        </View>

        {/* ── SIGNATURE ── */}
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

        {/* ── FOOTER ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{invoice.invoiceNo} — Shree Ganesh Automobile</Text>
          <Text style={styles.footerText}>Return / Refund Invoice</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
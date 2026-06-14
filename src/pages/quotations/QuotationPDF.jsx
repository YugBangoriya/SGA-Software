// SGA — Last updated: Fixed business settings field names to match /settings/main schema —
//   businessLogoUrl (was logoUrl), businessAddress (was address), businessPhone (was phone),
//   instagramUrl/facebookUrl/googleMapsUrl (was nested socialLinks.*). Added phone number
//   display below business name in header. Standardized date format to short month
//   (DD Mon YYYY) to match QuotationList.jsx and the Invoice module.
// src/pages/quotations/QuotationPDF.jsx
// Phase 5 — Quotation Module
// PDF layout using @react-pdf/renderer.
// All styling is done via StyleSheet (no Tailwind, no external CSS).
// Follows PRD Section 3.6.2 layout specification exactly.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from "@react-pdf/renderer";

// NOTE: We intentionally do NOT use Font.register() here.
// External font URLs (e.g. Google Fonts) cause network failures inside
// @react-pdf/renderer on production PWAs, crashing the PDF render pipeline.
// InvoicePDF.jsx uses the same built-in approach successfully.
// Built-in PDF fonts used:
//   "Helvetica"        → replaces "Inter"  (body, headings, labels)
//   "Helvetica-Bold"   → replaces "Inter" w/ fontWeight 700
//   "Courier"          → replaces "Mono"   (numbers, IDs, amounts)

// ─── Color tokens from Design Document ────────────────────────────────────────
const C = {
  burgundy: "#661F1F",
  burgundyMed: "#8B3A3A",
  burgundyLight: "#C8A0A0",
  offWhite: "#F5F0EE",
  warmGray: "#CDCBC9",
  nearBlack: "#222222",
  gray: "#666666",
  lightTaupe: "#E8E2DF",
  green: "#1A7A1A",
  blue: "#0055CC",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.nearBlack,
    backgroundColor: C.white,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },

  // ─── Header ───────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: C.burgundy,
    paddingBottom: 14,
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  businessLogo: {
    width: 52,
    height: 52,
    borderRadius: 4,
    marginBottom: 6,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
  },
  businessSubInfo: {
    fontSize: 8.5,
    color: C.gray,
    fontFamily: "Helvetica",
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  quotationLabel: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  quotationNumberText: {
    fontFamily: "Courier",
    fontSize: 12,
    color: C.nearBlack,
    marginTop: 2,
  },
  quotationDate: {
    fontSize: 9,
    color: C.gray,
    marginTop: 2,
    fontFamily: "Helvetica",
  },

  // ─── Info Grid (Customer + Vehicle) ───────────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  infoBox: {
    flex: 1,
    backgroundColor: C.offWhite,
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.burgundy,
  },
  infoBoxTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 9,
    color: C.gray,
    width: 80,
    fontFamily: "Helvetica",
  },
  infoValue: {
    fontSize: 9,
    color: C.nearBlack,
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },

  // ─── Items Table ──────────────────────────────────────────────────────────
  tableSection: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.burgundy,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 8.5,
    color: C.white,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lightTaupe,
  },
  tableRowAlt: {
    backgroundColor: C.offWhite,
  },
  cellDescription: { flex: 3 },
  cellQty: { flex: 1, textAlign: "center" },
  cellUnit: { flex: 1.5, textAlign: "right" },
  cellTotal: { flex: 1.5, textAlign: "right" },
  tableCell: {
    fontSize: 9.5,
    color: C.nearBlack,
    fontFamily: "Helvetica",
  },
  tableCellMono: {
    fontSize: 9.5,
    color: C.nearBlack,
    fontFamily: "Courier",
  },

  // ─── Labour Row ───────────────────────────────────────────────────────────
  labourRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lightTaupe,
    backgroundColor: "#FFF8F8",
  },
  labourLabel: {
    flex: 3,
    fontSize: 9.5,
    color: C.burgundyMed,
    fontFamily: "Helvetica-Bold",
  },

  // ─── Total Row ────────────────────────────────────────────────────────────
  totalContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    marginBottom: 18,
  },
  totalBox: {
    backgroundColor: C.burgundy,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  totalLabel: {
    fontSize: 10,
    color: "#F0BABA",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalAmount: {
    fontSize: 15,
    color: C.white,
    fontFamily: "Courier-Bold",
  },

  // ─── Disclaimer ───────────────────────────────────────────────────────────
  disclaimer: {
    backgroundColor: "#FFF8E8",
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: "#CC6600",
    padding: 8,
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 8.5,
    color: "#7A4400",
    fontFamily: "Helvetica-Oblique",
  },

  // ─── Car Media Section ────────────────────────────────────────────────────
  carMediaSection: {
    backgroundColor: C.offWhite,
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  carMediaTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  carMediaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 6,
  },
  carMediaIcon: {
    fontSize: 9,
    color: C.burgundy,
    width: 12,
    fontFamily: "Helvetica",
  },
  carMediaLinkLabel: {
    fontSize: 9,
    color: C.gray,
    width: 80,
    fontFamily: "Helvetica",
  },
  carMediaLink: {
    fontSize: 9,
    color: C.blue,
    flex: 1,
    fontFamily: "Helvetica",
    textDecoration: "underline",
  },

  // ─── Social Links ─────────────────────────────────────────────────────────
  socialSection: {
    borderTopWidth: 1,
    borderTopColor: C.lightTaupe,
    paddingTop: 10,
    marginTop: 6,
  },
  socialTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.burgundy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  socialRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  socialLinkWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  socialPlatform: {
    fontSize: 8,
    color: C.gray,
    fontFamily: "Helvetica",
  },
  socialLink: {
    fontSize: 8.5,
    color: C.blue,
    fontFamily: "Helvetica",
    textDecoration: "underline",
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: C.warmGray,
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 7.5,
    color: C.gray,
    fontFamily: "Helvetica",
  },
  footerRight: {
    fontSize: 7.5,
    color: C.gray,
    fontFamily: "Courier",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount) {
  const num = Number(amount || 0);
  return `Rs.${num.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function QuotationPDFDocument({ quotation, businessSettings }) {
  const settings = businessSettings || {};

  const itemsTotal = (quotation.lineItems || []).reduce(
    (sum, item) => sum + (item.total || item.quantity * item.unitPrice || 0),
    0
  );
  const grandTotal = itemsTotal + Number(quotation.labourCost || 0);

  const hasCarMedia =
    quotation.carDriveLink || (quotation.carReelLinks || []).length > 0;

  return (
    <Document
      title={`Quotation ${quotation.quotationNumber}`}
      author={settings.businessName || "Shree Ganesh Automobile"}
      subject="Quotation"
    >
      <Page size="A4" style={styles.page}>
        {/* ── HEADER ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {settings.businessLogoUrl ? (
              <Image src={settings.businessLogoUrl} style={styles.businessLogo} />
            ) : null}
            <Text style={styles.businessName}>
              {settings.businessName || "Shree Ganesh Automobile"}
            </Text>
            {settings.businessPhone ? (
              <Text style={styles.businessSubInfo}>Ph: {settings.businessPhone}</Text>
            ) : null}
            {settings.businessAddress ? (
              <Text style={styles.businessSubInfo}>{settings.businessAddress}</Text>
            ) : null}
            {settings.gstNumber ? (
              <Text style={styles.businessSubInfo}>
                GSTIN: {settings.gstNumber}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.quotationLabel}>Quotation</Text>
            <Text style={styles.quotationNumberText}>
              {quotation.quotationNumber}
            </Text>
            <Text style={styles.quotationDate}>
              Date: {formatDate(quotation.createdAt)}
            </Text>
          </View>
        </View>

        {/* ── CUSTOMER + VEHICLE INFO ── */}
        <View style={styles.infoGrid}>
          {/* Customer */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Customer Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{quotation.customerName || "-"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{quotation.customerPhone || "-"}</Text>
            </View>
          </View>

          {/* Vehicle */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Vehicle Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoValue}>{quotation.vehicleCompany || "-"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model</Text>
              <Text style={styles.infoValue}>{quotation.vehicleModel || "-"}</Text>
            </View>
            {quotation.vehicleYear ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Year</Text>
                <Text style={styles.infoValue}>{quotation.vehicleYear}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={styles.tableSection}>
          <Text style={styles.sectionTitle}>Itemized Quotation</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDescription]}>
              Description
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.cellQty,
                { textAlign: "center" },
              ]}
            >
              Qty
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.cellUnit,
                { textAlign: "right" },
              ]}
            >
              Unit Price
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.cellTotal,
                { textAlign: "right" },
              ]}
            >
              Amount
            </Text>
          </View>

          {/* Line Items */}
          {(quotation.lineItems || []).map((item, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 !== 0 && styles.tableRowAlt]}
            >
              <Text style={[styles.tableCell, styles.cellDescription]}>
                {item.description || "-"}
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellQty,
                  { textAlign: "center" },
                ]}
              >
                {item.quantity}
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellUnit,
                  { textAlign: "right" },
                ]}
              >
                {formatINR(item.unitPrice)}
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellTotal,
                  { textAlign: "right" },
                ]}
              >
                {formatINR(item.total || item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}

          {/* Labour Row */}
          {Number(quotation.labourCost) > 0 && (
            <View style={styles.labourRow}>
              <Text style={[styles.labourLabel, styles.cellDescription]}>
                Labour / Installation Charges
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellQty,
                  { textAlign: "center" },
                ]}
              >
                1
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellUnit,
                  { textAlign: "right" },
                ]}
              >
                {formatINR(quotation.labourCost)}
              </Text>
              <Text
                style={[
                  styles.tableCellMono,
                  styles.cellTotal,
                  { textAlign: "right" },
                ]}
              >
                {formatINR(quotation.labourCost)}
              </Text>
            </View>
          )}
        </View>

        {/* ── GRAND TOTAL ── */}
        <View style={styles.totalContainer}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>{formatINR(grandTotal)}</Text>
          </View>
        </View>

        {/* ── DISCLAIMER ── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Note: Prices are subject to change. Please contact us for the
            latest pricing. This quotation is valid for a limited period and
            is not a final invoice.
          </Text>
        </View>

        {/* ── CAR MEDIA LINKS ── */}
        {hasCarMedia && (
          <View style={styles.carMediaSection}>
            <Text style={styles.carMediaTitle}>
              {quotation.vehicleCompany} {quotation.vehicleModel} - Media &amp; Reference
            </Text>

            {quotation.carDriveLink ? (
              <View style={styles.carMediaRow}>
                <Text style={styles.carMediaIcon}>[IMG]</Text>
                <Text style={styles.carMediaLinkLabel}>Photos &amp; Images</Text>
                <Link src={quotation.carDriveLink} style={styles.carMediaLink}>
                  View on Google Drive
                </Link>
              </View>
            ) : null}

            {(quotation.carReelLinks || []).map((reelUrl, i) => (
              <View key={i} style={styles.carMediaRow}>
                <Text style={styles.carMediaIcon}>[VID]</Text>
                <Text style={styles.carMediaLinkLabel}>
                  Installation Video {i + 1}
                </Text>
                <Link src={reelUrl} style={styles.carMediaLink}>
                  Watch on Instagram
                </Link>
              </View>
            ))}
          </View>
        )}

        {/* ── SOCIAL LINKS ── */}
        <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>Connect With Us</Text>
          <View style={styles.socialRow}>
            {settings.instagramUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Instagram:</Text>
                <Link
                  src={settings.instagramUrl}
                  style={styles.socialLink}
                >
                  {settings.instagramUrl}
                </Link>
              </View>
            )}
            {settings.facebookUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Facebook:</Text>
                <Link
                  src={settings.facebookUrl}
                  style={styles.socialLink}
                >
                  {settings.facebookUrl}
                </Link>
              </View>
            )}
            {settings.googleMapsUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Location:</Text>
                <Link
                  src={settings.googleMapsUrl}
                  style={styles.socialLink}
                >
                  Find us on Google Maps
                </Link>
              </View>
            )}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {settings.businessName || "Shree Ganesh Automobile"} |{" "}
            {settings.businessPhone || ""}
          </Text>
          <Text style={styles.footerRight}>{quotation.quotationNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}
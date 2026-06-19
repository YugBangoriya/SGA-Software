// SGA — Last updated: Three fixes — (1) "Invalid Date" resolved: fmtDate gracefully
// handles Firestore serverTimestamp sentinel by falling back to today's date.
// (2) Total Amount section removed entirely from the PDF.
// (3) "FULL GRID" / "FULL TABLE" green badge removed from section headers —
// customers only need to see the table content, not internal metadata.
// src/pages/quotations/QuotationPDF.jsx

import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image, Link,
} from "@react-pdf/renderer";

// Fonts: built-in only — no Font.register() / external URLs
// Helvetica / Helvetica-Bold / Courier

const C = {
  burgundy:      "#661F1F",
  burgundyMed:   "#8B3A3A",
  burgundyLight: "#C8A0A0",
  offWhite:      "#F5F0EE",
  warmGray:      "#CDCBC9",
  lightTaupe:    "#E8E2DF",
  nearBlack:     "#222222",
  gray:          "#666666",
  green:         "#1A7A1A",
  blue:          "#0055CC",
  white:         "#FFFFFF",
  amber:         "#CC6600",
  amberLight:    "#FFF8E8",
  altRow:        "#F9F5F5",
};

const SECTION_LABELS = {
  kits:      "Kit Company",
  advancers: "CKP Advancer",
  extras:    "Extras",
  cylinders: "Cylinder Options",
};
const SECTION_ORDER = ["kits", "advancers", "extras", "cylinders"];

const styles = StyleSheet.create({
  page: {
    fontFamily:        "Helvetica",
    fontSize:          10,
    color:             C.nearBlack,
    backgroundColor:   C.white,
    paddingTop:        36,
    paddingBottom:     52,
    paddingHorizontal: 44,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: C.burgundy,
    paddingBottom:     14,
    marginBottom:      14,
  },
  businessLogo: { width: 52, height: 52, borderRadius: 4, marginBottom: 6, objectFit: "contain" },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.burgundy },
  bizInfo:      { fontSize: 8.5, color: C.gray, marginTop: 1 },
  qLabel:       { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.burgundy, letterSpacing: 2 },
  qNumber:      { fontFamily: "Courier", fontSize: 12, color: C.nearBlack, marginTop: 2 },
  qDate:        { fontSize: 9, color: C.gray, marginTop: 2 },
  emBadge:      { marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: "#E3F2FD", borderRadius: 4 },
  emBadgeText:  { fontSize: 8, color: "#1A3A8A", fontFamily: "Helvetica-Bold" },

  // ── Info grid ─────────────────────────────────────────────────────────────
  infoGrid:     { flexDirection: "row", gap: 12, marginBottom: 14 },
  infoBox:      { flex: 1, backgroundColor: C.offWhite, borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.burgundy },
  infoBoxTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  infoRow:      { flexDirection: "row", marginBottom: 3 },
  infoLabel:    { fontSize: 9, color: C.gray, width: 80 },
  infoValue:    { fontSize: 9, color: C.nearBlack, flex: 1, fontFamily: "Helvetica-Bold" },

  // ── Section header label (above each table) ───────────────────────────────
  // NOTE: No badge rendered here anymore — customers don't need to see
  // whether it is "full grid" or "selected rows".
  sectionHeader:     {
    flexDirection:  "row",
    alignItems:     "center",
    backgroundColor: C.burgundy,
    borderRadius:    4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop:       10,
    marginBottom:    2,
  },
  sectionHeaderText: {
    fontSize:    8.5,
    fontFamily:  "Helvetica-Bold",
    color:       C.white,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── LIST table ─────────────────────────────────────────────────────────────
  listHeader:     { flexDirection: "row", backgroundColor: C.burgundyMed, paddingVertical: 5, paddingHorizontal: 8 },
  listHeaderCell: { fontSize: 8, color: C.white, fontFamily: "Helvetica-Bold" },
  listRow:        { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.lightTaupe },
  listRowAlt:     { backgroundColor: C.altRow },
  cellDesc:       { flex: 3 },
  cellPrice:      { flex: 1.5, textAlign: "right" },
  cellText:       { fontSize: 9.5, color: C.nearBlack },
  cellMono:       { fontSize: 9.5, color: C.nearBlack, fontFamily: "Courier" },

  // ── GRID table ─────────────────────────────────────────────────────────────
  // Column header row
  gridColHeaderRow:        { flexDirection: "row" },
  gridColHeaderCell:       { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.burgundyLight, alignItems: "center" },
  gridColHeaderCellFilled: { backgroundColor: C.burgundy },
  gridColHeaderCellEmpty:  { backgroundColor: C.lightTaupe },
  gridColHeaderText:       { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white, textAlign: "center" },
  gridColHeaderTextEmpty:  { fontSize: 8, color: C.gray, textAlign: "center" },
  gridCornerCell:          { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.burgundyLight, backgroundColor: C.burgundy },

  // Data rows
  gridDataRow:             { flexDirection: "row" },
  gridDataRowAlt:          { backgroundColor: C.altRow },
  gridRowHeaderCell:       { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.lightTaupe, justifyContent: "center" },
  gridRowHeaderCellFilled: { backgroundColor: C.burgundyMed },
  gridRowHeaderCellEmpty:  { backgroundColor: C.offWhite },
  gridRowHeaderText:       { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.white },
  gridRowHeaderTextEmpty:  { fontSize: 8.5, color: C.gray },
  gridDataCell:            { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.lightTaupe, alignItems: "center" },
  gridDataText:            { fontSize: 8.5, color: C.nearBlack, fontFamily: "Courier", textAlign: "center" },

  // ── Labour ────────────────────────────────────────────────────────────────
  labourRow:   { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.lightTaupe, backgroundColor: "#FFF8F8" },
  labourLabel: { flex: 3, fontSize: 9.5, color: C.burgundyMed, fontFamily: "Helvetica-Bold" },

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  disclaimer:     { backgroundColor: C.amberLight, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: C.amber, padding: 8, marginBottom: 12, marginTop: 10 },
  disclaimerText: { fontSize: 8.5, color: "#7A4400", fontFamily: "Helvetica-Oblique" },

  // ── Notes (tableNote from Manage Quotations) ───────────────────────────────
  notesBox:   { backgroundColor: C.offWhite, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: C.burgundyMed, padding: 10, marginBottom: 14 },
  notesTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  notesText:  { fontSize: 9, color: C.nearBlack, lineHeight: 1.5 },

  // ── Car media ──────────────────────────────────────────────────────────────
  carMediaBox:   { backgroundColor: C.offWhite, borderRadius: 6, padding: 10, marginBottom: 12 },
  carMediaTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  carMediaRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 4, gap: 6 },
  carMediaLbl:   { fontSize: 9, color: C.gray, width: 80 },
  carMediaLink:  { fontSize: 9, color: C.blue, flex: 1, textDecoration: "underline" },

  // ── Social links ───────────────────────────────────────────────────────────
  socialSection: { borderTopWidth: 1, borderTopColor: C.lightTaupe, paddingTop: 10, marginTop: 6 },
  socialTitle:   { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  socialRow:     { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  socialLinkWrap:{ flexDirection: "row", alignItems: "center", gap: 4 },
  socialPlatform:{ fontSize: 8, color: C.gray },
  socialLink:    { fontSize: 8.5, color: C.blue, textDecoration: "underline" },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer:     { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: C.warmGray, paddingTop: 7 },
  footerLeft: { fontSize: 7.5, color: C.gray },
  footerRight:{ fontSize: 7.5, color: C.gray, fontFamily: "Courier" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return `Rs.${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

// FIX: "Invalid Date" — serverTimestamp() is a Firestore sentinel that has no
// .toDate() method when immediately returned from createQuotation before Firestore
// resolves it server-side. We now fall back to today's date in that case.
function fmtDate(ts) {
  try {
    if (!ts) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    // Firestore Timestamp object
    if (typeof ts.toDate === "function") {
      const d = ts.toDate();
      if (!isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    // JS Date or number or string
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    // Last resort: today
    return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRID TABLE RENDERER
//  • Column headers with content → Deep Burgundy (#661F1F) bg, white bold text
//  • Row headers with content    → Medium Burgundy (#8B3A3A) bg, white bold text
//  • Empty / unnamed headers     → light taupe bg, gray text (normal cell)
//  • Data cells                  → alternating white / off-white, monospace
// ══════════════════════════════════════════════════════════════════════════════
function GridTable({ gridColumns = [], gridRows = [] }) {
  if (gridColumns.length === 0 || gridRows.length === 0) return null;

  const hasColHeaders = gridColumns.some((c) => c.header?.trim());
  const hasRowHeaders = gridRows.some((r)  => r.header?.trim());
  const rowHdrFlex    = hasRowHeaders ? 1.4 : 0;

  return (
    <View>
      {/* Column header row */}
      {hasColHeaders && (
        <View style={styles.gridColHeaderRow}>
          {hasRowHeaders && <View style={[styles.gridCornerCell, { flex: rowHdrFlex }]}><Text style={styles.gridColHeaderText}> </Text></View>}
          {gridColumns.map((col) => {
            const filled = col.header?.trim();
            return (
              <View key={col.id} style={[styles.gridColHeaderCell, filled ? styles.gridColHeaderCellFilled : styles.gridColHeaderCellEmpty, { flex: 1 }]}>
                <Text style={filled ? styles.gridColHeaderText : styles.gridColHeaderTextEmpty}>{col.header || ""}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Data rows */}
      {gridRows.map((row, ri) => {
        const isAlt     = ri % 2 !== 0;
        const rowFilled = row.header?.trim();
        return (
          <View key={row.id} style={[styles.gridDataRow, isAlt && !rowFilled && styles.gridDataRowAlt]}>
            {hasRowHeaders && (
              <View style={[styles.gridRowHeaderCell, rowFilled ? styles.gridRowHeaderCellFilled : styles.gridRowHeaderCellEmpty, { flex: rowHdrFlex }]}>
                <Text style={rowFilled ? styles.gridRowHeaderText : styles.gridRowHeaderTextEmpty}>{row.header || ""}</Text>
              </View>
            )}
            {gridColumns.map((col) => (
              <View key={col.id} style={[styles.gridDataCell, { flex: 1 }, isAlt && rowFilled && { backgroundColor: "#FDF8F8" }]}>
                <Text style={styles.gridDataText}>{row.cells?.[col.id] ?? ""}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  LIST TABLE RENDERER
// ══════════════════════════════════════════════════════════════════════════════
function ListTable({ items = [] }) {
  if (items.length === 0) return null;
  return (
    <View>
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderCell, styles.cellDesc]}>Description</Text>
        <Text style={[styles.listHeaderCell, styles.cellPrice, { textAlign: "right" }]}>Price</Text>
      </View>
      {items.map((item, i) => (
        <View key={item.id || i} style={[styles.listRow, i % 2 !== 0 && styles.listRowAlt]}>
          <Text style={[styles.cellText, styles.cellDesc]}>{item.name || item.description || "—"}</Text>
          <Text style={[styles.cellMono, styles.cellPrice, { textAlign: "right" }]}>
            {fmtINR(item.price ?? (item.quantity * item.unitPrice) ?? item.total ?? 0)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECTIONS RENDERER
//  FIX: Section header no longer includes the FULL GRID / FULL TABLE badge.
//  Customers only need to see the table content, not internal labels.
// ══════════════════════════════════════════════════════════════════════════════
function SectionsRenderer({ sections, labourCost }) {
  return (
    <View>
      {SECTION_ORDER.map((key) => {
        const section = sections[key];
        if (!section) return null;

        const isGrid       = section.tableMode === "grid";
        const shareFullTbl = section.shareFullTable;

        if (isGrid) {
          const cols = section.gridColumns || [];
          const rows = section.gridRows    || [];
          if (cols.length === 0 || rows.length === 0) return null;

          const visibleRows = shareFullTbl
            ? rows
            : rows.filter((r) => (section.selectedItems || []).some((s) => s.id === r.id));
          if (visibleRows.length === 0) return null;

          return (
            <View key={key}>
              {/* Section label — NO badge, clean header only */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{SECTION_LABELS[key] || key}</Text>
              </View>
              <GridTable gridColumns={cols} gridRows={visibleRows} />
            </View>
          );
        }

        // List mode
        const pool = shareFullTbl ? (section.allItems || []) : (section.selectedItems || []);
        if (pool.length === 0) return null;

        return (
          <View key={key}>
            {/* Section label — NO badge */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{SECTION_LABELS[key] || key}</Text>
            </View>
            <ListTable items={pool} />
          </View>
        );
      })}

      {/* Labour */}
      {Number(labourCost) > 0 && (
        <View style={styles.labourRow}>
          <Text style={[styles.labourLabel, styles.cellDesc]}>Labour / Installation Charges</Text>
          <Text style={[styles.cellMono, styles.cellPrice, { textAlign: "right" }]}>
            {fmtINR(labourCost)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEGACY LINE ITEMS RENDERER
// ══════════════════════════════════════════════════════════════════════════════
function LegacyRenderer({ lineItems, labourCost }) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Itemized Quotation</Text>
      </View>
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderCell, styles.cellDesc]}>Description</Text>
        <Text style={[styles.listHeaderCell, styles.cellPrice, { textAlign: "right" }]}>Price</Text>
      </View>
      {(lineItems || []).map((item, i) => (
        <View key={i} style={[styles.listRow, i % 2 !== 0 && styles.listRowAlt]}>
          <Text style={[styles.cellText, styles.cellDesc]}>{item.description || "—"}</Text>
          <Text style={[styles.cellMono, styles.cellPrice, { textAlign: "right" }]}>
            {fmtINR(item.total || (item.quantity * item.unitPrice))}
          </Text>
        </View>
      ))}
      {Number(labourCost) > 0 && (
        <View style={styles.labourRow}>
          <Text style={[styles.labourLabel, styles.cellDesc]}>Labour / Installation Charges</Text>
          <Text style={[styles.cellMono, styles.cellPrice, { textAlign: "right" }]}>
            {fmtINR(labourCost)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Emission category label map ──────────────────────────────────────────────
const EM_LABELS = {
  BS4:      "BS4",
  BS6_4INJ: "BS6 – 4 Injector",
  BS6_8INJ: "BS6 – 8 Injector",
};

// ══════════════════════════════════════════════════════════════════════════════
//  EXPORTED PDF DOCUMENT
//  REMOVED: Grand Total section — client confirmed quotations should only
//  show the price tables, without a highlighted total at the bottom.
// ══════════════════════════════════════════════════════════════════════════════
export function QuotationPDFDocument({ quotation, businessSettings }) {
  const s         = businessSettings || {};
  const useNewFmt = !!(quotation.sections);
  const hasMedia  = quotation.carDriveLink || (quotation.carReelLinks || []).length > 0;
  const emLabel   = quotation.emissionCategory
    ? (EM_LABELS[quotation.emissionCategory] || quotation.emissionCategory)
    : null;

  return (
    <Document
      title={`Quotation ${quotation.quotationNumber}`}
      author={s.businessName || "Shree Ganesh Automobile"}
      subject="Quotation"
    >
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            {s.businessLogoUrl && <Image src={s.businessLogoUrl} style={styles.businessLogo} />}
            <Text style={styles.businessName}>{s.businessName || "Shree Ganesh Automobile"}</Text>
            {s.businessPhone   && <Text style={styles.bizInfo}>Ph: {s.businessPhone}</Text>}
            {s.businessAddress && <Text style={styles.bizInfo}>{s.businessAddress}</Text>}
            {s.gstNumber       && <Text style={styles.bizInfo}>GSTIN: {s.gstNumber}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.qLabel}>Quotation</Text>
            <Text style={styles.qNumber}>{quotation.quotationNumber}</Text>
            {/* FIX: fmtDate now safely handles Firestore sentinel timestamps */}
            <Text style={styles.qDate}>Date: {fmtDate(quotation.createdAt)}</Text>
            {emLabel && (
              <View style={styles.emBadge}>
                <Text style={styles.emBadgeText}>Category: {emLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Customer + Vehicle info ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Customer Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{quotation.customerName || "(General Quotation)"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>
                {quotation.customerPhone ? `+91 ${quotation.customerPhone}` : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Vehicle Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoValue}>{quotation.vehicleCompany || "—"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model</Text>
              <Text style={styles.infoValue}>{quotation.vehicleModel || "—"}</Text>
            </View>
            {quotation.vehicleYear && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Year</Text>
                <Text style={styles.infoValue}>{quotation.vehicleYear}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Price tables ── */}
        {useNewFmt
          ? <SectionsRenderer sections={quotation.sections} labourCost={quotation.labourCost} />
          : <LegacyRenderer   lineItems={quotation.lineItems} labourCost={quotation.labourCost} />}

        {/* ── TOTAL AMOUNT: REMOVED ──────────────────────────────────────────
            Client confirmed the quotation should only show the price tables.
            No total amount is displayed or highlighted.
        ─────────────────────────────────────────────────────────────────── */}

        {/* ── Disclaimer ── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Note: Prices are subject to change. Please contact us for the latest pricing.
            This quotation is valid for a limited period and is not a final invoice.
          </Text>
        </View>

        {/* ── Notes (tableNote from Manage Quotations) ── */}
        {quotation.tableNote ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{quotation.tableNote}</Text>
          </View>
        ) : null}

        {/* ── Car media links ── */}
        {hasMedia && (
          <View style={styles.carMediaBox}>
            <Text style={styles.carMediaTitle}>
              {quotation.vehicleCompany} {quotation.vehicleModel} – Media &amp; Reference
            </Text>
            {quotation.carDriveLink && (
              <View style={styles.carMediaRow}>
                <Text style={styles.carMediaLbl}>Photos &amp; Images</Text>
                <Link src={quotation.carDriveLink} style={styles.carMediaLink}>View on Google Drive</Link>
              </View>
            )}
            {(quotation.carReelLinks || []).map((url, i) => (
              <View key={i} style={styles.carMediaRow}>
                <Text style={styles.carMediaLbl}>Installation Video {i + 1}</Text>
                <Link src={url} style={styles.carMediaLink}>Watch on Instagram</Link>
              </View>
            ))}
          </View>
        )}

        {/* ── Social links ── */}
        <View style={styles.socialSection}>
          <Text style={styles.socialTitle}>Connect With Us</Text>
          <View style={styles.socialRow}>
            {s.instagramUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Instagram:</Text>
                <Link src={s.instagramUrl} style={styles.socialLink}>{s.instagramUrl}</Link>
              </View>
            )}
            {s.facebookUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Facebook:</Text>
                <Link src={s.facebookUrl} style={styles.socialLink}>{s.facebookUrl}</Link>
              </View>
            )}
            {s.googleMapsUrl && (
              <View style={styles.socialLinkWrap}>
                <Text style={styles.socialPlatform}>Location:</Text>
                <Link src={s.googleMapsUrl} style={styles.socialLink}>Find us on Google Maps</Link>
              </View>
            )}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {s.businessName || "Shree Ganesh Automobile"}
            {s.businessPhone ? ` | ${s.businessPhone}` : ""}
          </Text>
          <Text style={styles.footerRight}>{quotation.quotationNumber}</Text>
        </View>

      </Page>
    </Document>
  );
}
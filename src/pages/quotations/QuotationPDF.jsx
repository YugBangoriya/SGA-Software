// SGA — Last updated: Logo always rendered in quotation PDF header — imported LOGO_BASE64
// as fallback; <Image> now uses src={s.businessLogoUrl || LOGO_BASE64} instead of the
// conditional render that left the logo blank when businessLogoUrl was absent or null.
// Prior fixes retained: header flex layout, & entity fix, link box redesign,
// businessWebsiteUrl in Connect With Us section.
// src/pages/quotations/QuotationPDF.jsx

import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image, Link,
} from "@react-pdf/renderer";
import LOGO_BASE64 from "../../assets/logo_base64";

// Colours — matches SGA design tokens
const C = {
  burgundy:      "#661F1F",
  burgundyMed:   "#8B3A3A",
  burgundyLight: "#C8A0A0",
  offWhite:      "#F5F0EE",
  warmGray:      "#CDCBC9",
  lightTaupe:    "#E8E2DF",
  nearBlack:     "#222222",
  gray:          "#666666",
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

  // ── Header ────────────────────────────────────────────────────────────────
  // FIX: Added flex:1 to left panel and flexShrink:0 to right panel so the
  // "Quotation" heading no longer overflows into / overlaps the left column.
  headerRow: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: C.burgundy,
    paddingBottom:     14,
    marginBottom:      14,
  },
  headerLeft: {
    flex:        1,          // takes all available horizontal space
    marginRight: 20,         // gap between business info and quotation details
  },
  headerRight: {
    flexShrink:  0,          // never compress — keeps quotation number legible
    alignItems:  "flex-end",
    minWidth:    130,
  },
  // Logo beside text (same row layout as InvoicePDF)
  businessLogo: { width: 52, height: 52, borderRadius: 4, marginRight: 10, objectFit: "contain", flexShrink: 0 },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.burgundy },
  bizInfo:      { fontSize: 8.5, color: C.gray, marginTop: 1 },
  qLabel:       { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.burgundy, letterSpacing: 2 },
  qNumber:      { fontFamily: "Courier", fontSize: 11, color: C.nearBlack, marginTop: 2 },
  qDate:        { fontSize: 9,  color: C.gray, marginTop: 2 },
  emBadge:      { marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: "#E3F2FD", borderRadius: 4 },
  emBadgeText:  { fontSize: 8, color: "#1A3A8A", fontFamily: "Helvetica-Bold" },

  // ── Info grid ──────────────────────────────────────────────────────────────
  infoGrid:     { flexDirection: "row", gap: 12, marginBottom: 14 },
  infoBox:      { flex: 1, backgroundColor: C.offWhite, borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.burgundy },
  infoBoxTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  infoRow:      { flexDirection: "row", marginBottom: 3 },
  infoLabel:    { fontSize: 9, color: C.gray, width: 80 },
  infoValue:    { fontSize: 9, color: C.nearBlack, flex: 1, fontFamily: "Helvetica-Bold" },

  // ── Section header label ───────────────────────────────────────────────────
  sectionHeader:     { flexDirection: "row", alignItems: "center", backgroundColor: C.burgundy, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 8, marginTop: 10, marginBottom: 2 },
  sectionHeaderText: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.white, textTransform: "uppercase", letterSpacing: 1 },

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
  gridColHeaderRow:        { flexDirection: "row" },
  gridColHeaderCell:       { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.burgundyLight, alignItems: "center" },
  gridColHeaderCellFilled: { backgroundColor: C.burgundy },
  gridColHeaderCellEmpty:  { backgroundColor: C.lightTaupe },
  gridColHeaderText:       { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.white, textAlign: "center" },
  gridColHeaderTextEmpty:  { fontSize: 8, color: C.gray, textAlign: "center" },
  gridCornerCell:          { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.burgundyLight, backgroundColor: C.burgundy },
  gridDataRow:             { flexDirection: "row" },
  gridDataRowAlt:          { backgroundColor: C.altRow },
  gridRowHeaderCell:       { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.lightTaupe, justifyContent: "center" },
  gridRowHeaderCellFilled: { backgroundColor: C.burgundyMed },
  gridRowHeaderCellEmpty:  { backgroundColor: C.offWhite },
  gridRowHeaderText:       { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.white },
  gridRowHeaderTextEmpty:  { fontSize: 8.5, color: C.gray },
  gridDataCell:            { flex: 1, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0.5, borderColor: C.lightTaupe, alignItems: "center" },
  gridDataText:            { fontSize: 8.5, color: C.nearBlack, fontFamily: "Courier", textAlign: "center" },

  // ── Labour ─────────────────────────────────────────────────────────────────
  labourRow:   { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.lightTaupe, backgroundColor: "#FFF8F8" },
  labourLabel: { flex: 3, fontSize: 9.5, color: C.burgundyMed, fontFamily: "Helvetica-Bold" },

  // ── Disclaimer ─────────────────────────────────────────────────────────────
  disclaimer:     { backgroundColor: C.amberLight, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: C.amber, padding: 8, marginBottom: 12, marginTop: 10 },
  disclaimerText: { fontSize: 8.5, color: "#7A4400", fontFamily: "Helvetica-Oblique" },

  // ── Notes ──────────────────────────────────────────────────────────────────
  notesBox:   { backgroundColor: C.offWhite, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: C.burgundyMed, padding: 10, marginBottom: 14 },
  notesTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.burgundy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
  notesText:  { fontSize: 9, color: C.nearBlack, lineHeight: 1.5 },

  // ── Combined Link Box ──────────────────────────────────────────────────────
  // Placed between customer info and price tables (Feature 3 from prior session).
  // Redesigned: no badge boxes — platform names are plain bold text (this session).
  linkBoxContainer: {
    flexDirection:    "row",
    borderWidth:      1,
    borderColor:      C.lightTaupe,
    borderRadius:     6,
    backgroundColor:  C.offWhite,
    marginBottom:     14,
    overflow:         "hidden",
  },
  linkBoxLeft: {
    flex:             1,
    padding:          10,
    borderRightWidth: 1,
    borderRightColor: C.lightTaupe,
  },
  linkBoxRight: {
    flex:    1,
    padding: 10,
  },
  linkBoxTitle: {
    fontSize:      8,
    fontFamily:    "Helvetica-Bold",
    color:         C.burgundy,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom:  7,
  },
  // Car media rows
  carMediaRow:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 5, gap: 5 },
  carMediaLbl:  { fontSize: 8.5, color: C.gray, width: 75 },
  carMediaLink: { fontSize: 8.5, color: C.blue, flex: 1, textDecoration: "underline" },
  // Social / link rows — FIX: bold text label replaces the old coloured badge box
  socialRow:    { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  // Bold platform name (e.g. "Instagram", "Facebook", "Google Maps", "Website")
  socialLabel:  { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.nearBlack, width: 72, flexShrink: 0 },
  // Clickable link text (e.g. "Visit Instagram Page")
  socialLink:   { fontSize: 8.5, color: C.blue, textDecoration: "underline", flex: 1 },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer:     { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: C.warmGray, paddingTop: 7 },
  footerLeft: { fontSize: 7.5, color: C.gray },
  footerRight: { fontSize: 7.5, color: C.gray, fontFamily: "Courier" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return `Rs.${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

function fmtDate(ts) {
  try {
    if (!ts) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    if (typeof ts.toDate === "function") {
      const d = ts.toDate();
      if (!isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMBINED LINK BOX
//  - Left panel: car media links (Google Drive + Instagram Reels)
//  - Right panel: "Connect With Us" — Instagram, Facebook, Google Maps, Website
//
//  FIX (this session): Removed coloured badge boxes (IG/FB/GM views).
//  Platform names are now plain Helvetica-Bold text followed by the link.
//  This renders cleanly in all PDF viewers and matches the client request.
//
//  FIX (this session): &amp; HTML entity replaced with plain & — @react-pdf/renderer
//  <Text> does not decode HTML entities; they appeared literally in the PDF.
//
//  Placement: between customer/vehicle info and the price tables.
// ══════════════════════════════════════════════════════════════════════════════
function CombinedLinkBox({ quotation, businessSettings: s }) {
  const hasMedia  = !!(quotation.carDriveLink || (quotation.carReelLinks || []).length > 0);
  const hasSocial = !!(s.instagramUrl || s.facebookUrl || s.googleMapsUrl || s.businessWebsiteUrl);

  if (!hasMedia && !hasSocial) return null;

  // ── Right panel content (shared across layout variants) ─────────────────
  const ConnectPanel = () => (
    <View style={hasMedia ? styles.linkBoxRight : { padding: 10 }}>
      <Text style={styles.linkBoxTitle}>Connect With Us</Text>

      {s.instagramUrl && (
        <View style={styles.socialRow}>
          <Text style={styles.socialLabel}>Instagram</Text>
          <Link src={s.instagramUrl} style={styles.socialLink}>Visit Instagram Page</Link>
        </View>
      )}
      {s.facebookUrl && (
        <View style={styles.socialRow}>
          <Text style={styles.socialLabel}>Facebook</Text>
          <Link src={s.facebookUrl} style={styles.socialLink}>Visit Facebook Page</Link>
        </View>
      )}
      {s.googleMapsUrl && (
        <View style={styles.socialRow}>
          <Text style={styles.socialLabel}>Google Maps</Text>
          <Link src={s.googleMapsUrl} style={styles.socialLink}>Find Us on Google Maps</Link>
        </View>
      )}
      {s.businessWebsiteUrl && (
        <View style={styles.socialRow}>
          <Text style={styles.socialLabel}>Website</Text>
          <Link src={s.businessWebsiteUrl} style={styles.socialLink}>Visit Our Website</Link>
        </View>
      )}
    </View>
  );

  // ── Left panel content ───────────────────────────────────────────────────
  const MediaPanel = () => (
    <View style={styles.linkBoxLeft}>
      {/* FIX: plain & instead of &amp; — PDF Text does not decode HTML entities */}
      <Text style={styles.linkBoxTitle}>
        {quotation.vehicleCompany} {quotation.vehicleModel} - Media
      </Text>
      {quotation.carDriveLink && (
        <View style={styles.carMediaRow}>
          <Text style={styles.carMediaLbl}>Photos & Images</Text>
          <Link src={quotation.carDriveLink} style={styles.carMediaLink}>
            View on Google Drive
          </Link>
        </View>
      )}
      {(quotation.carReelLinks || []).map((url, i) => (
        <View key={i} style={styles.carMediaRow}>
          <Text style={styles.carMediaLbl}>Video {i + 1}</Text>
          <Link src={url} style={styles.carMediaLink}>Watch on Instagram</Link>
        </View>
      ))}
    </View>
  );

  // Split layout: media left, social right
  if (hasMedia && hasSocial) {
    return (
      <View style={styles.linkBoxContainer}>
        <MediaPanel />
        <ConnectPanel />
      </View>
    );
  }

  // Only car media (no social) — full width
  if (hasMedia) {
    return (
      <View style={[styles.linkBoxContainer, { flexDirection: "column" }]}>
        <MediaPanel />
      </View>
    );
  }

  // Only social links (no car media) — full width
  return (
    <View style={[styles.linkBoxContainer, { flexDirection: "column" }]}>
      <ConnectPanel />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRID TABLE RENDERER
// ══════════════════════════════════════════════════════════════════════════════
function GridTable({ gridColumns = [], gridRows = [] }) {
  if (gridColumns.length === 0 || gridRows.length === 0) return null;
  const hasColHeaders = gridColumns.some((c) => c.header?.trim());
  const hasRowHeaders = gridRows.some((r)  => r.header?.trim());
  const rowHdrFlex    = hasRowHeaders ? 1.4 : 0;

  return (
    <View>
      {hasColHeaders && (
        <View style={styles.gridColHeaderRow}>
          {hasRowHeaders && (
            <View style={[styles.gridCornerCell, { flex: rowHdrFlex }]}>
              <Text style={styles.gridColHeaderText}> </Text>
            </View>
          )}
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
//  SECTIONS RENDERER (Manage Quotations grid/list format)
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
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{SECTION_LABELS[key] || key}</Text>
              </View>
              <GridTable gridColumns={cols} gridRows={visibleRows} />
            </View>
          );
        }

        const pool = shareFullTbl ? (section.allItems || []) : (section.selectedItems || []);
        if (pool.length === 0) return null;
        return (
          <View key={key}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{SECTION_LABELS[key] || key}</Text>
            </View>
            <ListTable items={pool} />
          </View>
        );
      })}

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
//  LEGACY LINE ITEMS RENDERER (older quotation format)
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

// Emission category readable label
const EM_LABELS = {
  BS4:      "BS4",
  BS6_4INJ: "BS6 - 4 Injector",
  BS6_8INJ: "BS6 - 8 Injector",
};

// ══════════════════════════════════════════════════════════════════════════════
//  EXPORTED PDF DOCUMENT
//
//  Page layout order:
//   1. Header — business info (left, flex:1) | Quotation title+number (right, flexShrink:0)
//   2. Customer + Vehicle info grid
//   3. Combined Link Box (car media left, Connect With Us right) — before tables
//   4. Price tables (SectionsRenderer or LegacyRenderer)
//   5. Disclaimer
//   6. Notes (tableNote)
//   7. Footer (fixed, every page)
// ══════════════════════════════════════════════════════════════════════════════
export function QuotationPDFDocument({ quotation, businessSettings }) {
  const s         = businessSettings || {};
  const useNewFmt = !!(quotation.sections);
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

        {/* ── 1. Header ── */}
        {/* FIX: headerLeft has flex:1, headerRight has flexShrink:0 — prevents
            "Quotation" heading from overflowing into / crowding the left column */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {/* Row layout: logo on the left, business info on the right — matches InvoicePDF */}
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Image
                src={s.businessLogoUrl || LOGO_BASE64}
                style={styles.businessLogo}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.businessName}>{s.businessName || "Shree Ganesh Automobile"}</Text>
                {s.businessPhone   && <Text style={styles.bizInfo}>Ph: {s.businessPhone}</Text>}
                {s.businessAddress && <Text style={styles.bizInfo}>{s.businessAddress}</Text>}
                {s.gstNumber       && <Text style={styles.bizInfo}>GSTIN: {s.gstNumber}</Text>}
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.qLabel}>Quotation</Text>
            <Text style={styles.qNumber}>{quotation.quotationNumber}</Text>
            <Text style={styles.qDate}>Date: {fmtDate(quotation.createdAt)}</Text>
            {emLabel && (
              <View style={styles.emBadge}>
                <Text style={styles.emBadgeText}>Category: {emLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 2. Customer + Vehicle info grid ── */}
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
                {quotation.customerPhone ? `+91 ${quotation.customerPhone}` : "-"}
              </Text>
            </View>
          </View>
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
            {quotation.vehicleYear && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Year</Text>
                <Text style={styles.infoValue}>{quotation.vehicleYear}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 3. Combined Link Box (before price tables) ── */}
        <CombinedLinkBox quotation={quotation} businessSettings={s} />

        {/* ── 4. Price tables ── */}
        {useNewFmt
          ? <SectionsRenderer sections={quotation.sections} labourCost={quotation.labourCost} />
          : <LegacyRenderer   lineItems={quotation.lineItems} labourCost={quotation.labourCost} />}

        {/* ── 5. Disclaimer ── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Note: Prices are subject to change. Please contact us for the latest pricing.
            This quotation is valid for a limited period and is not a final invoice.
          </Text>
        </View>

        {/* ── 6. Notes ── */}
        {quotation.tableNote ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{quotation.tableNote}</Text>
          </View>
        ) : null}

        {/* ── 7. Footer (fixed on every page) ── */}
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
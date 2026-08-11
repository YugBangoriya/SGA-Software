// SGA — Last updated: New file — ShortcutListPDF: printable A4 reference sheet (2 sections per row, 4 columns total: Item | Shortcut || Item | Shortcut) for all inventory items and their shortcuts

/**
 * ShortcutListPDF — @react-pdf/renderer Component
 *
 * Generates a printable A4 PDF reference sheet listing all inventory items
 * and their shortcuts. Layout: two side-by-side sections per row, so each
 * page effectively shows 4 columns: Item | Shortcut || Item | Shortcut.
 *
 * Items are sorted alphabetically. Items without a shortcut show an empty
 * shortcut cell so employees can see all items and reference existing shortcuts.
 *
 * Fonts: built-in Helvetica / Helvetica-Bold / Courier only — external
 * Google Fonts URLs fail in @react-pdf/renderer production builds.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

// ── Brand colours ────────────────────────────────────────────────────────────
const C = {
  primary:    '#661F1F',
  primaryMid: '#8B3A3A',
  bg:         '#FFFFFF',
  altRow:     '#FAF6F5',
  border:     '#E8E2DF',
  divider:    '#D4CCC8',
  textDark:   '#222222',
  textMid:    '#555555',
  textLight:  '#999999',
  headerBg:   '#661F1F',
  headerText: '#FFFFFF',
};

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    backgroundColor:    C.bg,
    paddingTop:         30,
    paddingBottom:      44,
    paddingHorizontal:  26,
    fontFamily:         'Helvetica',
    fontSize:           9,
    color:              C.textDark,
  },

  // ── Title block ────────────────────────────────────────────────────────────
  titleBlock: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-end',
    marginBottom:      12,
    paddingBottom:     8,
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  titleLeft: { flex: 1 },
  title: {
    fontSize:   15,
    fontFamily: 'Helvetica-Bold',
    color:      C.primary,
  },
  subtitle: {
    fontSize:      8,
    color:         C.primaryMid,
    marginTop:     2,
    letterSpacing: 0.4,
  },
  dateText: {
    fontSize: 7.5,
    color:    C.textLight,
  },

  // ── Outer row (holds left section + divider + right section) ──────────────
  tableRow: {
    flexDirection: 'row',
    alignItems:    'stretch',
  },

  // ── One half-section (Item col + Shortcut col) ────────────────────────────
  section: {
    flex:          1,
    flexDirection: 'row',
  },

  // ── Vertical gap / rule between the two halves ────────────────────────────
  midGap: {
    width:           14,
    flexShrink:      0,
    justifyContent:  'center',
    alignItems:      'center',
  },
  midLine: {
    width:           1,
    flex:            1,
    backgroundColor: C.divider,
  },

  // ── Header cells ──────────────────────────────────────────────────────────
  headerItemCell: {
    flex:              3,
    backgroundColor:   C.headerBg,
    paddingVertical:   5,
    paddingHorizontal: 7,
  },
  headerShortcutCell: {
    flex:              1.1,
    backgroundColor:   C.primaryMid,
    paddingVertical:   5,
    paddingHorizontal: 6,
    borderLeftWidth:   1,
    borderLeftColor:   'rgba(255,255,255,0.22)',
  },
  headerCellText: {
    fontSize:      7.5,
    fontFamily:    'Helvetica-Bold',
    color:         C.headerText,
    letterSpacing: 0.8,
  },

  // ── Data cells ────────────────────────────────────────────────────────────
  dataItemCell: {
    flex:              3,
    paddingVertical:   5,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderRightWidth:  1,
    borderRightColor:  C.border,
    justifyContent:    'center',
  },
  dataShortcutCell: {
    flex:              1.1,
    paddingVertical:   5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    justifyContent:    'center',
  },

  itemText: {
    fontSize:   8.5,
    color:      C.textDark,
    fontFamily: 'Helvetica',
  },
  shortcutText: {
    fontSize:      9,
    color:         C.primaryMid,
    fontFamily:    'Helvetica-Bold',
    letterSpacing: 0.4,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position:        'absolute',
    bottom:          18,
    left:            26,
    right:           26,
    flexDirection:   'row',
    justifyContent:  'space-between',
    borderTopWidth:  1,
    borderTopColor:  C.border,
    paddingTop:      4,
  },
  footerText: {
    fontSize: 7,
    color:    C.textLight,
  },
});

// ── Sub-components ───────────────────────────────────────────────────────────

/** Fixed header row that repeats on every page */
function TableHeader() {
  const half = (
    <View style={styles.section}>
      <View style={styles.headerItemCell}>
        <Text style={styles.headerCellText}>ITEM NAME</Text>
      </View>
      <View style={styles.headerShortcutCell}>
        <Text style={styles.headerCellText}>SHORTCUT</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.tableRow} fixed>
      {half}
      <View style={styles.midGap}>
        <View style={[styles.midLine, { backgroundColor: C.primaryMid }]} />
      </View>
      {half}
    </View>
  );
}

/** One data row — contains a left item and (optionally) a right item */
function DataRow({ left, right, isEven }) {
  const bg = isEven ? C.altRow : C.bg;

  const renderHalf = (item) => {
    if (!item) {
      // Empty right cell when item count is odd
      return (
        <View style={styles.section}>
          <View style={[styles.dataItemCell, { backgroundColor: bg }]}>
            <Text style={styles.itemText}> </Text>
          </View>
          <View style={[styles.dataShortcutCell, { backgroundColor: bg }]}>
            <Text style={styles.itemText}> </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={[styles.dataItemCell, { backgroundColor: bg }]}>
          <Text style={styles.itemText}>{item.itemName || ''}</Text>
        </View>
        <View style={[styles.dataShortcutCell, { backgroundColor: bg }]}>
          {item.shortcut
            ? <Text style={styles.shortcutText}>{item.shortcut}</Text>
            : <Text style={styles.itemText}> </Text>
          }
        </View>
      </View>
    );
  };

  return (
    <View style={styles.tableRow}>
      {renderHalf(left)}
      <View style={styles.midGap}>
        <View style={[styles.midLine, { backgroundColor: bg === C.altRow ? C.border : C.border }]} />
      </View>
      {renderHalf(right)}
    </View>
  );
}

// ── Main document component ──────────────────────────────────────────────────

export default function ShortcutListPDF({ items }) {
  // Sort all items alphabetically by name
  const sorted = [...items].sort((a, b) =>
    (a.itemName || '').localeCompare(b.itemName || '')
  );

  // Pair consecutive items: [item0, item1], [item2, item3], …
  const pairs = [];
  for (let i = 0; i < sorted.length; i += 2) {
    pairs.push([sorted[i], sorted[i + 1] ?? null]);
  }

  const today = new Date().toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });

  return (
    <Document title="Inventory Shortcuts Reference — Shree Ganesh Automobile">
      <Page size="A4" style={styles.page}>

        {/* ── Title block ── */}
        <View style={styles.titleBlock} fixed>
          <View style={styles.titleLeft}>
            <Text style={styles.title}>Inventory Shortcuts Reference</Text>
            <Text style={styles.subtitle}>
              Shree Ganesh Automobile &nbsp;·&nbsp; {sorted.length} item{sorted.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.dateText}>Printed: {today}</Text>
        </View>

        {/* ── Column headers ── */}
        <TableHeader />

        {/* ── Data rows ── */}
        {pairs.map(([left, right], idx) => (
          <DataRow key={idx} left={left} right={right} isEven={idx % 2 === 0} />
        ))}

        {/* ── Footer with page numbers ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Shree Ganesh Automobile — Inventory Shortcuts Reference
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}

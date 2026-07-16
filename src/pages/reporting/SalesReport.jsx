// SGA — Last updated: New feature — Sales Report with per-invoice item breakdown, stock movement summary, PDF and CSV export
/**
 * SalesReport.jsx
 * Owner + SuperAdmin only.
 *
 * Generates a monthly sales report containing:
 *   Section 1 — Invoice Details: every approved non-return invoice for the
 *               selected month, sorted ascending by date, showing items sold
 *               and quantities.
 *   Section 2 — Item Stock Movement: all items sold that month sorted
 *               alphabetically with opening qty, qty sold, and closing qty
 *               (closing = current live inventory).
 *
 * Exports:
 *   • PDF  — via @react-pdf/renderer (built-in fonts, no CORS issues)
 *   • CSV  — two CSV downloads: one for invoice details, one for item summary
 */

import { useState }                                           from "react";
import { collection, getDocs }                                from "firebase/firestore";
import { db }                                                 from "@/lib/firebase";
import { exportToCSV }                                        from "@/lib/csvExport";
import { isReturnInvoice }                                    from "@/lib/invoiceHelpers";
import { fetchSettings }                                      from "@/lib/settingsService";
import { useNavigate }                                        from "react-router-dom";
import HomeButton                                             from "@/components/ui/HomeButton";
import {
  FileText, Download, BarChart2, Package,
  AlertCircle, Loader, ChevronLeft,
} from "lucide-react";
import {
  Document, Page, View, Text, StyleSheet,
} from "@react-pdf/renderer";
import { pdf } from "@react-pdf/renderer";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear  = new Date().getFullYear();
const YEARS        = Array.from({ length: 5 }, (_, i) => currentYear - i);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  // "YYYY-MM-DD" → "01 Apr 2026"
  const [y, m, d] = dateStr.split("-");
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][
    parseInt(m, 10) - 1
  ] ?? m;
  return `${d} ${mo} ${y}`;
}

function fmtINR(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── PDF Document ─────────────────────────────────────────────────────────────
const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    paddingTop: 28, paddingBottom: 32, paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
  },
  // Header
  header: { marginBottom: 16 },
  headerBusiness: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#661F1F" },
  headerTitle:    { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#222222", marginTop: 3 },
  headerSub:      { fontSize: 8,  color: "#666666", marginTop: 2 },
  divider:        { borderBottomWidth: 1.5, borderBottomColor: "#661F1F", marginTop: 10, marginBottom: 14 },

  // Section label
  sectionLabel: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF",
    backgroundColor: "#661F1F",
    padding: "4 8", marginBottom: 6,
  },

  // Table
  table: { display: "flex", flexDirection: "column", width: "100%", marginBottom: 16 },
  tableHead: {
    flexDirection: "row", backgroundColor: "#E8E2DF",
    borderBottomWidth: 1, borderBottomColor: "#CCBBBB",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: "#E8E2DF",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: "#E8E2DF",
    backgroundColor: "#FDFAF8",
  },
  thCell: {
    fontFamily: "Helvetica-Bold", fontSize: 7.5,
    color: "#661F1F", padding: "4 6",
  },
  tdCell: {
    fontSize: 7.5, color: "#222222", padding: "3.5 6",
  },
  tdMuted: {
    fontSize: 7.5, color: "#666666", padding: "3.5 6",
  },

  // Column widths — Section 1
  colNo:       { width: "20%"  },
  colDate:     { width: "12%"  },
  colCustomer: { width: "18%"  },
  colItems:    { width: "50%"  },

  // Column widths — Section 2
  colItem:     { width: "40%" },
  colOpen:     { width: "20%" },
  colSold:     { width: "20%" },
  colClose:    { width: "20%" },

  // Summary strip
  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryBox: {
    flex: 1, border: "1 solid #E8E2DF", borderRadius: 4,
    padding: "6 8", backgroundColor: "#F5F0EE",
  },
  summaryLabel: { fontSize: 6.5, color: "#888888", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#661F1F", marginTop: 2 },

  // Footer
  pageFooter: {
    position: "absolute", bottom: 16, left: 28, right: 28,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 0.5, borderTopColor: "#CCBBBB", paddingTop: 4,
  },
  footerText: { fontSize: 6.5, color: "#AAAAAA" },

  // Notes
  noteBox: {
    backgroundColor: "#FFF8E1", border: "0.5 solid #FFD888",
    borderRadius: 3, padding: "4 6", marginBottom: 10,
  },
  noteText: { fontSize: 7, color: "#664400" },
});

function SalesReportPDFDoc({ invoices, itemSummary, monthLabel, businessName, stats }) {
  return (
    <Document title={`Sales Report — ${monthLabel}`}>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.headerBusiness}>{businessName}</Text>
          <Text style={pdfStyles.headerTitle}>Sales Report — {monthLabel}</Text>
          <Text style={pdfStyles.headerSub}>Generated on {fmtDate(new Date().toISOString().slice(0,10))}</Text>
        </View>
        <View style={pdfStyles.divider} />

        {/* Summary */}
        <View style={pdfStyles.summaryRow}>
          <View style={pdfStyles.summaryBox}>
            <Text style={pdfStyles.summaryLabel}>Total Invoices</Text>
            <Text style={pdfStyles.summaryValue}>{stats.totalInvoices}</Text>
          </View>
          <View style={pdfStyles.summaryBox}>
            <Text style={pdfStyles.summaryLabel}>Total Qty Sold</Text>
            <Text style={pdfStyles.summaryValue}>{stats.totalQty}</Text>
          </View>
          <View style={pdfStyles.summaryBox}>
            <Text style={pdfStyles.summaryLabel}>Total Revenue</Text>
            <Text style={pdfStyles.summaryValue}>{fmtINR(stats.totalRevenue)}</Text>
          </View>
          <View style={pdfStyles.summaryBox}>
            <Text style={pdfStyles.summaryLabel}>Labour Revenue</Text>
            <Text style={pdfStyles.summaryValue}>{fmtINR(stats.totalLabour)}</Text>
          </View>
        </View>

        {/* Section 1: Invoice Details */}
        <Text style={pdfStyles.sectionLabel}>SECTION 1 — INVOICE DETAILS (SORTED BY DATE)</Text>

        <View style={pdfStyles.table}>
          {/* Head */}
          <View style={pdfStyles.tableHead}>
            <Text style={[pdfStyles.thCell, pdfStyles.colNo]}>Invoice No</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colDate]}>Date</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colCustomer]}>Customer</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colItems]}>Items Sold</Text>
          </View>
          {invoices.length === 0 ? (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tdMuted, { width: "100%", textAlign: "center", padding: "8 6" }]}>
                No approved invoices found for this period.
              </Text>
            </View>
          ) : (
            invoices.map((inv, idx) => {
              const itemsText = (inv.items || [])
                .map(it => `${it.name || "—"} × ${it.quantity ?? 1}`)
                .join("  |  ");
              return (
                <View key={inv.id} style={idx % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
                  <Text style={[pdfStyles.tdCell, pdfStyles.colNo, { fontFamily: "Courier" }]}>
                    {inv.invoiceNo}
                  </Text>
                  <Text style={[pdfStyles.tdCell, pdfStyles.colDate]}>{fmtDate(inv.invoiceDate)}</Text>
                  <Text style={[pdfStyles.tdCell, pdfStyles.colCustomer]}>
                    {inv.customerSnapshot?.name || "—"}
                  </Text>
                  <Text style={[pdfStyles.tdMuted, pdfStyles.colItems]}>{itemsText}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Section 2: Item Stock Movement */}
        <Text style={pdfStyles.sectionLabel}>SECTION 2 — ITEM STOCK MOVEMENT</Text>

        <View style={pdfStyles.noteBox}>
          <Text style={pdfStyles.noteText}>
            Opening Qty = Closing Qty + Qty Sold in this period. Closing Qty = live inventory count at time of report generation.
          </Text>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHead}>
            <Text style={[pdfStyles.thCell, pdfStyles.colItem]}>Item Name</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colOpen, { textAlign: "right" }]}>Opening Qty</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colSold,  { textAlign: "right" }]}>Sold This Month</Text>
            <Text style={[pdfStyles.thCell, pdfStyles.colClose, { textAlign: "right" }]}>Closing Qty</Text>
          </View>
          {itemSummary.length === 0 ? (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tdMuted, { width: "100%", textAlign: "center", padding: "8 6" }]}>
                No item data available.
              </Text>
            </View>
          ) : (
            itemSummary.map((item, idx) => (
              <View key={item.name} style={idx % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
                <Text style={[pdfStyles.tdCell, pdfStyles.colItem]}>{item.name}</Text>
                <Text style={[pdfStyles.tdCell, pdfStyles.colOpen,  { textAlign: "right" }]}>{item.openingQty}</Text>
                <Text style={[pdfStyles.tdCell, pdfStyles.colSold,  { textAlign: "right", color: "#CC6600" }]}>{item.qtySold}</Text>
                <Text style={[pdfStyles.tdCell, pdfStyles.colClose, { textAlign: "right" }]}>{item.closingQty}</Text>
              </View>
            ))
          )}
        </View>

        {/* Page footer */}
        <View style={pdfStyles.pageFooter} fixed>
          <Text style={pdfStyles.footerText}>{businessName} — Sales Report — {monthLabel}</Text>
          <Text style={pdfStyles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesReport() {
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear,  setSelectedYear]  = useState(currentYear);
  const [report,        setReport]        = useState(null);   // null = not generated yet
  const [loading,       setLoading]       = useState(false);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [error,         setError]         = useState(null);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      // 1. Fetch all invoices from Firestore and filter in JS
      const snap = await getDocs(collection(db, "invoices"));
      const allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Keep only approved, non-return invoices for the selected month
      const monthInvoices = allInvoices.filter(inv =>
        inv.status === "APPROVED" &&
        !isReturnInvoice(inv) &&
        (inv.invoiceDate || "").startsWith(monthStr)
      );

      // Sort ascending by date (earliest first)
      monthInvoices.sort((a, b) =>
        (a.invoiceDate || "") < (b.invoiceDate || "") ? -1 : 1
      );

      // 2. Fetch current inventory quantities
      const invSnap = await getDocs(collection(db, "inventory"));
      const inventoryMap = {};
      invSnap.docs.forEach(d => {
        const data = d.data();
        if (data.itemName) {
          inventoryMap[data.itemName.toLowerCase().trim()] = {
            name:       data.itemName,
            currentQty: typeof data.quantity === "number" ? data.quantity : 0,
          };
        }
      });

      // 3. Aggregate items sold
      const itemSalesMap = {};
      let totalQty     = 0;
      let totalRevenue = 0;
      let totalLabour  = 0;

      monthInvoices.forEach(inv => {
        totalLabour  += Number(inv.labourCost) || 0;
        totalRevenue += Number(inv.totalAmount) || 0;

        (inv.items || []).forEach(item => {
          const key    = (item.name || "").toLowerCase().trim();
          const qty    = Number(item.quantity)     || 0;
          const price  = Number(item.sellingPrice) || Number(item.unitPrice) || 0;
          totalQty += qty;

          if (!itemSalesMap[key]) {
            itemSalesMap[key] = { name: item.name || key, qtySold: 0 };
          }
          itemSalesMap[key].qtySold += qty;
        });
      });

      // 4. Build item summary (sorted alphabetically)
      const itemSummary = Object.entries(itemSalesMap)
        .map(([key, data]) => {
          const inv = inventoryMap[key] || { currentQty: 0 };
          return {
            name:       data.name,
            openingQty: inv.currentQty + data.qtySold,
            qtySold:    data.qtySold,
            closingQty: inv.currentQty,
          };
        })
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setReport({
        invoices:    monthInvoices,
        itemSummary,
        stats: {
          totalInvoices: monthInvoices.length,
          totalQty,
          totalRevenue,
          totalLabour,
        },
      });
    } catch (err) {
      console.error("SalesReport generate error:", err);
      setError("Failed to load report data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!report) return;
    setPdfLoading(true);
    try {
      const settings   = await fetchSettings();
      const businessName = settings?.businessName || "Shree Ganesh Automobile";
      const monthLabel   = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

      const blob = await pdf(
        <SalesReportPDFDoc
          invoices={report.invoices}
          itemSummary={report.itemSummary}
          monthLabel={monthLabel}
          businessName={businessName}
          stats={report.stats}
        />
      ).toBlob();

      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = `SalesReport_${MONTHS[selectedMonth - 1]}_${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Export CSV (Invoice Detail) ────────────────────────────────────────────
  const handleExportInvoiceCSV = () => {
    if (!report) return;
    const rows = [];
    report.invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        rows.push({
          invoiceNo:    inv.invoiceNo || "—",
          date:         inv.invoiceDate || "—",
          customer:     inv.customerSnapshot?.name || "—",
          phone:        inv.customerSnapshot?.phone || "—",
          vehicleNo:    inv.vehicleSnapshot?.registrationNo || "—",
          itemName:     item.name || "—",
          qty:          item.quantity ?? 1,
          unitPrice:    item.sellingPrice ?? item.unitPrice ?? 0,
          lineTotal:    ((item.quantity ?? 1) * (item.sellingPrice ?? item.unitPrice ?? 0)).toFixed(2),
          paymentStatus: inv.paymentStatus || "—",
        });
      });
    });

    exportToCSV(rows, `SalesReport_Invoices_${MONTHS[selectedMonth - 1]}_${selectedYear}`, [
      { key: "invoiceNo",    label: "Invoice No"     },
      { key: "date",         label: "Date"           },
      { key: "customer",     label: "Customer"       },
      { key: "phone",        label: "Phone"          },
      { key: "vehicleNo",    label: "Vehicle No"     },
      { key: "itemName",     label: "Item Name"      },
      { key: "qty",          label: "Qty Sold"       },
      { key: "unitPrice",    label: "Unit Price (₹)" },
      { key: "lineTotal",    label: "Line Total (₹)" },
      { key: "paymentStatus",label: "Payment Status" },
    ]);
  };

  // ── Export CSV (Item Summary) ──────────────────────────────────────────────
  const handleExportItemCSV = () => {
    if (!report) return;
    exportToCSV(report.itemSummary, `SalesReport_Items_${MONTHS[selectedMonth - 1]}_${selectedYear}`, [
      { key: "name",       label: "Item Name"         },
      { key: "openingQty", label: "Opening Qty"       },
      { key: "qtySold",    label: "Qty Sold (Month)"  },
      { key: "closingQty", label: "Closing Qty"       },
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const monthLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div style={{ background: "#CDCBC9", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Page Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #661F1F 0%, #8B3A3A 100%)",
        padding: "24px 20px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <HomeButton />
          <div>
            <h2 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 800, margin: 0, fontFamily: "system-ui" }}>
              Sales Report
            </h2>
            <p style={{ color: "#F0BABA", fontSize: 12, margin: "2px 0 0", fontFamily: "system-ui" }}>
              Monthly invoice &amp; stock movement summary
            </p>
          </div>
        </div>
      </div>

      {/* ── Picker Card ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{
          background: "#FFFFFF", borderRadius: 14, padding: 20,
          border: "1.5px solid #E8E2DF",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: "#661F1F", margin: "0 0 14px",
            fontFamily: "system-ui",
          }}>
            Select Period
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Month select */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 5, fontFamily: "system-ui", fontWeight: 600 }}>
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid #E8E2DF", borderRadius: 8,
                  fontSize: 14, color: "#222", background: "#F5F0EE",
                  fontFamily: "system-ui", cursor: "pointer",
                  outline: "none",
                }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year select */}
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 5, fontFamily: "system-ui", fontWeight: 600 }}>
                Year
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid #E8E2DF", borderRadius: 8,
                  fontSize: 14, color: "#222", background: "#F5F0EE",
                  fontFamily: "system-ui", cursor: "pointer",
                  outline: "none",
                }}
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                height: 44, padding: "0 24px",
                background: loading ? "#8B3A3A" : "#661F1F",
                color: "#FFFFFF", border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "system-ui",
                display: "flex", alignItems: "center", gap: 8,
                opacity: loading ? 0.8 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading ? (
                <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <BarChart2 size={16} />
              )}
              {loading ? "Generating…" : "Generate Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ margin: "12px 16px 0" }}>
          <div style={{
            background: "#FFEBEE", border: "1.5px solid #F0BABA",
            borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
            color: "#CC0000", fontSize: 13, fontFamily: "system-ui",
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        </div>
      )}

      {/* ── Report ── */}
      {report && (
        <div style={{ padding: "14px 16px 0" }}>

          {/* Summary strip */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10, marginBottom: 14,
          }}>
            {[
              { label: "Total Invoices",  value: report.stats.totalInvoices,            color: "#661F1F" },
              { label: "Total Qty Sold",  value: report.stats.totalQty,                 color: "#0055CC" },
              { label: "Total Revenue",   value: fmtINR(report.stats.totalRevenue),     color: "#1A7A1A" },
              { label: "Labour Revenue",  value: fmtINR(report.stats.totalLabour),      color: "#CC6600" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#FFFFFF", border: "1.5px solid #E8E2DF",
                borderRadius: 12, padding: "12px 14px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}>
                <p style={{ fontSize: 11, color: "#666", margin: "0 0 4px", fontFamily: "system-ui", fontWeight: 600 }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: 0, fontFamily: "system-ui" }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Export buttons */}
          <div style={{
            background: "#F5F0EE", border: "1.5px solid #E8E2DF",
            borderRadius: 10, padding: "10px 14px",
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 12, color: "#666", fontFamily: "system-ui", fontWeight: 600, marginRight: 4 }}>
              Export:
            </span>

            <button
              onClick={handleExportPDF}
              disabled={pdfLoading || report.invoices.length === 0}
              style={{
                height: 38, padding: "0 16px",
                background: "#661F1F", color: "#FFFFFF",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "system-ui",
                display: "flex", alignItems: "center", gap: 6,
                opacity: (pdfLoading || report.invoices.length === 0) ? 0.6 : 1,
              }}
            >
              {pdfLoading ? <Loader size={14} /> : <FileText size={14} />}
              Full Report PDF
            </button>

            <button
              onClick={handleExportInvoiceCSV}
              disabled={report.invoices.length === 0}
              style={{
                height: 38, padding: "0 16px",
                background: "transparent", color: "#661F1F",
                border: "1.5px solid #661F1F", borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "system-ui",
                display: "flex", alignItems: "center", gap: 6,
                opacity: report.invoices.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={14} />
              Invoice CSV
            </button>

            <button
              onClick={handleExportItemCSV}
              disabled={report.itemSummary.length === 0}
              style={{
                height: 38, padding: "0 16px",
                background: "transparent", color: "#1A4A8A",
                border: "1.5px solid #1A4A8A", borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "system-ui",
                display: "flex", alignItems: "center", gap: 6,
                opacity: report.itemSummary.length === 0 ? 0.5 : 1,
              }}
            >
              <Package size={14} />
              Item Summary CSV
            </button>
          </div>

          {/* ── Section 1: Invoice Details ── */}
          <div style={{
            background: "#FFFFFF", borderRadius: 14,
            border: "1.5px solid #E8E2DF",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            marginBottom: 14, overflow: "hidden",
          }}>
            {/* Section header */}
            <div style={{
              background: "#661F1F", padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} color="#FFFFFF" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: "system-ui" }}>
                  Section 1 — Invoice Details
                </span>
              </div>
              <span style={{
                background: "rgba(255,255,255,0.2)", color: "#FFFFFF",
                fontSize: 11, fontFamily: "system-ui", fontWeight: 600,
                padding: "2px 8px", borderRadius: 20,
              }}>
                {monthLabel} · {report.invoices.length} invoice{report.invoices.length !== 1 ? "s" : ""}
              </span>
            </div>

            {report.invoices.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#888", fontSize: 13, fontFamily: "system-ui" }}>
                No approved invoices found for {monthLabel}.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "system-ui" }}>
                  <thead>
                    <tr style={{ background: "#F5F0EE" }}>
                      {["Invoice No", "Date", "Customer", "Items Sold", "Payment Status"].map(h => (
                        <th key={h} style={{
                          padding: "10px 14px", textAlign: "left",
                          fontSize: 11, fontWeight: 700, color: "#661F1F",
                          borderBottom: "1.5px solid #E8E2DF",
                          whiteSpace: "nowrap",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.invoices.map((inv, idx) => (
                      <tr key={inv.id} style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#FDFAF8" }}>
                        <td style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid #F0EAE6",
                          fontFamily: "monospace", fontSize: 12, color: "#222",
                          whiteSpace: "nowrap",
                        }}>
                          {inv.invoiceNo || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0EAE6", color: "#555", whiteSpace: "nowrap" }}>
                          {fmtDate(inv.invoiceDate)}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0EAE6", color: "#222", maxWidth: 140 }}>
                          {inv.customerSnapshot?.name || "—"}
                        </td>
                        {/* Items column */}
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0EAE6" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(inv.items || []).map((item, ii) => (
                              <span key={ii} style={{
                                background: "#F5F0EE", border: "1px solid #E8E2DF",
                                borderRadius: 6, padding: "2px 8px",
                                fontSize: 11, color: "#333",
                              }}>
                                {item.name || "—"} &times; {item.quantity ?? 1}
                              </span>
                            ))}
                            {inv.labourCost > 0 && (
                              <span style={{
                                background: "#FFF8F0", border: "1px solid #FFD088",
                                borderRadius: 6, padding: "2px 8px",
                                fontSize: 11, color: "#CC6600",
                              }}>
                                Labour {fmtINR(inv.labourCost)}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Payment status */}
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0EAE6" }}>
                          <StatusBadge status={inv.paymentStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Section 2: Item Stock Movement ── */}
          <div style={{
            background: "#FFFFFF", borderRadius: 14,
            border: "1.5px solid #E8E2DF",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}>
            {/* Section header */}
            <div style={{
              background: "#1A4A8A", padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={16} color="#FFFFFF" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: "system-ui" }}>
                  Section 2 — Item Stock Movement
                </span>
              </div>
              <span style={{
                background: "rgba(255,255,255,0.2)", color: "#FFFFFF",
                fontSize: 11, fontFamily: "system-ui", fontWeight: 600,
                padding: "2px 8px", borderRadius: 20,
              }}>
                {report.itemSummary.length} item{report.itemSummary.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Note about opening/closing */}
            <div style={{
              background: "#FFF8E1", borderBottom: "1px solid #FFD888",
              padding: "8px 14px", fontSize: 11, color: "#664400", fontFamily: "system-ui",
            }}>
              <strong>Note:</strong> Opening Qty = Closing Qty + Qty Sold in this period.
              Closing Qty reflects the live inventory count at the time this report was generated.
            </div>

            {report.itemSummary.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#888", fontSize: 13, fontFamily: "system-ui" }}>
                No item sales data for {monthLabel}.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "system-ui" }}>
                  <thead>
                    <tr style={{ background: "#EEF3FF" }}>
                      {[
                        { label: "Item Name",          align: "left"  },
                        { label: "Opening Stock",      align: "right" },
                        { label: "Qty Sold This Month",align: "right" },
                        { label: "Closing Stock",      align: "right" },
                      ].map(h => (
                        <th key={h.label} style={{
                          padding: "10px 14px", textAlign: h.align,
                          fontSize: 11, fontWeight: 700, color: "#1A4A8A",
                          borderBottom: "1.5px solid #D0DCFF",
                          whiteSpace: "nowrap",
                        }}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.itemSummary.map((item, idx) => (
                      <tr key={item.name} style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#F7F9FF" }}>
                        <td style={{
                          padding: "10px 14px", borderBottom: "1px solid #EEF0F8",
                          fontWeight: 600, color: "#222",
                        }}>
                          {item.name}
                        </td>
                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #EEF0F8", textAlign: "right", color: "#555" }}>
                          {item.openingQty}
                        </td>
                        <td style={{
                          padding: "10px 14px", borderBottom: "1px solid #EEF0F8", textAlign: "right",
                          fontWeight: 700, color: "#CC6600",
                        }}>
                          − {item.qtySold}
                        </td>
                        <td style={{
                          padding: "10px 14px", borderBottom: "1px solid #EEF0F8", textAlign: "right",
                          fontWeight: 700,
                          color: item.closingQty <= 0 ? "#CC0000" : item.closingQty < 3 ? "#CC6600" : "#1A7A1A",
                        }}>
                          {item.closingQty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Inline status badge ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PAID:           { bg: "#E8F5E9", color: "#1A7A1A", label: "Paid"          },
    PARTIALLY_PAID: { bg: "#FFF3E0", color: "#CC6600", label: "Partial"       },
    UNPAID:         { bg: "#FFEBEE", color: "#CC0000", label: "Unpaid"        },
    EMI:            { bg: "#E3F2FD", color: "#0055CC", label: "EMI"           },
    LOAN:           { bg: "#E3F2FD", color: "#0055CC", label: "Loan"          },
    DEBIT:          { bg: "#FFF3E0", color: "#CC6600", label: "Debit"         },
  };
  const cfg = map[status] || { bg: "#F0F0F0", color: "#666", label: status || "—" };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      borderRadius: 999, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

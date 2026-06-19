// SGA — Last updated: Added Grid Mode to each table editor. Grid mode supports named
// column headers and row headers (both optional). When a header is present it appears
// in burgundy (matching the price list image). When absent, the cell renders as a normal
// data cell. Each section independently toggles between List Mode and Grid Mode.
// List Mode (existing simple name+price pairs) is preserved as-is.
// src/pages/quotations/ManageQuotations.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, Check, ArrowLeft, X, ToggleLeft, ToggleRight,
  Table, List, Columns,
} from "lucide-react";
import {
  fetchQuotationPriceTable,
  saveQuotationPriceTable,
  EMISSION_CATEGORIES,
  defaultPriceTable,
} from "../../lib/quotationService";
import HomeButton from "../../components/ui/HomeButton";

// ─── Table section config ─────────────────────────────────────────────────────
const TABLE_TYPES = [
  { key: "kits",      label: "Kit Company",      emoji: "🔧", hint: "CNG kit brands and models" },
  { key: "advancers", label: "CKP Advancer",     emoji: "⚡", hint: "Advancer types and prices" },
  { key: "extras",    label: "Extras",           emoji: "➕", hint: "Additional accessories and add-ons" },
  { key: "cylinders", label: "Cylinder Options", emoji: "🔵", hint: "Tank and cylinder variants" },
];

// ─── ID generator ─────────────────────────────────────────────────────────────
function genId() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatINR(n) {
  const num = Number(n || 0);
  return "₹" + num.toLocaleString("en-IN");
}

// ─── Ensure section has both list and grid fields ─────────────────────────────
function normSection(raw = {}) {
  return {
    tableMode:          raw.tableMode          ?? "list",
    items:              raw.items              ?? [],
    shareFullByDefault: raw.shareFullByDefault ?? false,
    columns:            raw.columns            ?? [],
    rows:               raw.rows               ?? [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  LIST EDITOR  (original simple name + price list)
// ══════════════════════════════════════════════════════════════════════════════
function ListEditor({ section, onChange }) {
  const items = section.items || [];

  const updateItem = (id, fields) =>
    onChange({ ...section, items: items.map((it) => (it.id === id ? { ...it, ...fields } : it)) });

  const addItem = () =>
    onChange({ ...section, items: [...items, { id: genId(), name: "", price: 0 }] });

  const removeItem = (id) =>
    onChange({ ...section, items: items.filter((it) => it.id !== id) });

  return (
    <div className="p-4">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_120px_36px] gap-2 mb-2 px-1">
          <span className="text-[11px] text-[#888] font-sans font-semibold">Item / Description</span>
          <span className="text-[11px] text-[#888] font-sans font-semibold text-right">Price (₹)</span>
          <span />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id}
            className="grid grid-cols-[1fr_120px_36px] gap-2 items-center bg-[#FAFAFA] rounded-xl border border-[#EEE] p-2">
            <input
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              placeholder="Item name…"
              className="h-9 px-3 rounded-lg border border-[#E8E2DF] text-sm font-sans text-[#222]
                placeholder-[#BBB] outline-none bg-white focus:border-[#661F1F]
                focus:ring-2 focus:ring-[#661F1F]/10 transition-all" />
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AAA] text-sm">₹</span>
              <input
                type="number" inputMode="decimal" min={0}
                value={item.price || ""}
                onChange={(e) => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full h-9 pl-6 pr-2 rounded-lg border border-[#E8E2DF] text-sm font-mono
                  text-right bg-white text-[#222] placeholder-[#BBB] outline-none
                  focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10 transition-all" />
            </div>
            <button onClick={() => removeItem(item.id)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#CCC]
                hover:text-[#CC0000] hover:bg-[#FFEBEE] transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addItem}
        className="mt-3 w-full h-10 rounded-xl border-2 border-dashed border-[#CDCBC9]
          flex items-center justify-center gap-2 text-sm text-[#888] font-sans
          hover:border-[#8B3A3A] hover:text-[#661F1F] hover:bg-[#FDF8F8] transition-all">
        <Plus size={15} /> Add item
      </button>
      {items.length === 0 && (
        <p className="text-center text-[13px] text-[#AAA] font-sans py-2">
          No items yet. Add your first item above.
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRID EDITOR  (rows × columns, optional headers, like the price list image)
// ══════════════════════════════════════════════════════════════════════════════
// Colour logic (matches the PDF output):
//   • Column header cells    → burgundy (#661F1F) bg, white text input
//   • Row header cells       → medium burgundy (#8B3A3A) bg, white text input
//   • Empty/unnamed header   → light taupe bg, gray placeholder (still editable)
//   • Regular data cells     → white bg, dark text
// ─────────────────────────────────────────────────────────────────────────────

const COL_HDR_FILLED   = "bg-[#661F1F] text-white";
const COL_HDR_EMPTY    = "bg-[#E8E2DF] text-[#666]";
const ROW_HDR_FILLED   = "bg-[#8B3A3A] text-white";
const ROW_HDR_EMPTY    = "bg-[#E8E2DF] text-[#666]";
const CELL_NORMAL      = "bg-white text-[#222]";
const CELL_ALT         = "bg-[#F5F0EE] text-[#222]";

function GridEditor({ section, onChange }) {
  const columns = section.columns || [];
  const rows    = section.rows    || [];

  // ── Column ops ──────────────────────────────────────────────────────────────
  const addColumn = () => {
    const newCol = { id: genId(), header: "" };
    onChange({
      ...section,
      columns: [...columns, newCol],
      rows: rows.map((r) => ({ ...r, cells: { ...r.cells, [newCol.id]: "" } })),
    });
  };

  const removeColumn = (colId) => {
    onChange({
      ...section,
      columns: columns.filter((c) => c.id !== colId),
      rows: rows.map((r) => {
        const { [colId]: _removed, ...rest } = r.cells || {};
        return { ...r, cells: rest };
      }),
    });
  };

  const updateColHeader = (colId, header) =>
    onChange({ ...section, columns: columns.map((c) => (c.id === colId ? { ...c, header } : c)) });

  // ── Row ops ─────────────────────────────────────────────────────────────────
  const addRow = () => {
    const newRow = {
      id:     genId(),
      header: "",
      cells:  Object.fromEntries(columns.map((c) => [c.id, ""])),
    };
    onChange({ ...section, rows: [...rows, newRow] });
  };

  const removeRow = (rowId) =>
    onChange({ ...section, rows: rows.filter((r) => r.id !== rowId) });

  const updateRowHeader = (rowId, header) =>
    onChange({ ...section, rows: rows.map((r) => (r.id === rowId ? { ...r, header } : r)) });

  const updateCell = (rowId, colId, value) =>
    onChange({
      ...section,
      rows: rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      ),
    });

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (columns.length === 0) {
    return (
      <div className="p-6 text-center">
        <Columns size={28} className="text-[#CDCBC9] mx-auto mb-3" />
        <p className="text-sm text-[#888] font-sans mb-4">
          Grid is empty. Add a column to start building your price table.
        </p>
        <button onClick={addColumn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#661F1F]
            text-white text-sm font-semibold font-sans hover:bg-[#8B3A3A] transition-colors">
          <Plus size={14} /> Add First Column
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Grid info */}
      <p className="text-xs text-[#888] font-sans mb-3">
        <strong>Tips:</strong> Column and row headers are optional.
        Filled headers appear in <span className="text-[#661F1F] font-bold">burgundy</span> in the PDF.
        Leave a header blank to render that row/column as a normal data cell.
      </p>

      {/* Scrollable table container */}
      <div className="overflow-x-auto rounded-xl border border-[#E8E2DF] shadow-sm">
        <table className="border-collapse" style={{ minWidth: `${(columns.length + 1) * 140}px` }}>
          {/* ── HEADER ROW ── */}
          <thead>
            <tr>
              {/* Top-left corner cell: "Row ╲ Col" label */}
              <th className="border border-[#E8E2DF] bg-[#F5F0EE] p-0 w-[160px]">
                <div className="px-2 py-1.5 text-[10px] text-[#AAA] font-sans text-center">
                  Row ╲ Col
                </div>
              </th>

              {/* Column header cells */}
              {columns.map((col) => {
                const isFilled = col.header.trim() !== "";
                return (
                  <th key={col.id} className="border border-[#E8E2DF] p-0 w-[140px]">
                    <div className={`flex flex-col ${isFilled ? "bg-[#661F1F]" : "bg-[#E8E2DF]"}`}>
                      <input
                        value={col.header}
                        onChange={(e) => updateColHeader(col.id, e.target.value)}
                        placeholder="Column header…"
                        className={`w-full h-9 px-2 text-xs font-semibold font-sans
                          outline-none bg-transparent text-center
                          ${isFilled ? "text-white placeholder-white/50" : "text-[#666] placeholder-[#AAA]"}`}
                      />
                      {/* Delete column button */}
                      <button
                        onClick={() => removeColumn(col.id)}
                        title="Delete column"
                        className={`w-full py-0.5 text-[10px] flex items-center justify-center gap-1
                          hover:bg-black/10 transition-colors border-t
                          ${isFilled ? "border-white/20 text-white/70 hover:text-white" : "border-[#CCC] text-[#AAA] hover:text-[#CC0000]"}`}
                      >
                        <Trash2 size={9} /> col
                      </button>
                    </div>
                  </th>
                );
              })}

              {/* Add column button */}
              <th className="border border-dashed border-[#CDCBC9] p-0 w-[50px] bg-[#FAFAFA]">
                <button
                  onClick={addColumn}
                  title="Add column"
                  className="w-full h-full flex items-center justify-center text-[#888]
                    hover:text-[#661F1F] hover:bg-[#FDF8F8] transition-colors p-2">
                  <Plus size={16} />
                </button>
              </th>
            </tr>
          </thead>

          {/* ── DATA ROWS ── */}
          <tbody>
            {rows.map((row, rowIdx) => {
              const isAltRow    = rowIdx % 2 !== 0;
              const rowHdrFilled = row.header.trim() !== "";

              return (
                <tr key={row.id}>
                  {/* Row header cell */}
                  <td className={`border border-[#E8E2DF] p-0 ${rowHdrFilled ? "bg-[#8B3A3A]" : isAltRow ? "bg-[#F5F0EE]" : "bg-white"}`}>
                    <input
                      value={row.header}
                      onChange={(e) => updateRowHeader(row.id, e.target.value)}
                      placeholder="Row name… (optional)"
                      className={`w-full h-9 px-3 text-[13px] font-sans outline-none bg-transparent
                        ${rowHdrFilled ? "text-white placeholder-white/50 font-semibold" : "text-[#666] placeholder-[#AAA]"}`}
                    />
                  </td>

                  {/* Data cells */}
                  {columns.map((col) => {
                    const cellBg = rowHdrFilled
                      ? (isAltRow ? "bg-[#FAFAFA]" : "bg-white")
                      : (isAltRow ? "bg-[#F5F0EE]" : "bg-white");
                    return (
                      <td key={col.id} className={`border border-[#E8E2DF] p-0 ${cellBg}`}>
                        <input
                          value={row.cells?.[col.id] ?? ""}
                          onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                          placeholder="—"
                          className="w-full h-9 px-3 text-sm font-mono text-[#222]
                            placeholder-[#CCC] outline-none bg-transparent text-center
                            focus:bg-[#FDF8F8] transition-colors"
                        />
                      </td>
                    );
                  })}

                  {/* Delete row button */}
                  <td className="border border-[#E8E2DF] p-0 bg-[#FAFAFA] w-[40px]">
                    <button
                      onClick={() => removeRow(row.id)}
                      title="Delete row"
                      className="w-full h-9 flex items-center justify-center text-[#CCC]
                        hover:text-[#CC0000] hover:bg-[#FFEBEE] transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Add row button */}
            <tr>
              <td
                colSpan={columns.length + 2}
                className="border border-dashed border-[#CDCBC9] bg-[#FAFAFA] p-0"
              >
                <button
                  onClick={addRow}
                  className="w-full py-2.5 flex items-center justify-center gap-2
                    text-sm text-[#888] font-sans hover:text-[#661F1F] hover:bg-[#FDF8F8] transition-colors">
                  <Plus size={14} /> Add Row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Grid summary */}
      <p className="text-xs text-[#AAA] font-sans mt-2">
        {columns.length} column{columns.length !== 1 ? "s" : ""} · {rows.length} row{rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TABLE EDITOR  (wraps List + Grid editors with mode switcher)
// ══════════════════════════════════════════════════════════════════════════════
function TableEditor({ tableKey, label, emoji, hint, section, onChange }) {
  const [expanded, setExpanded] = useState(true);

  const tableMode           = section.tableMode || "list";
  const shareFullByDefault  = section.shareFullByDefault || false;

  const setMode = (mode) => {
    const updated = { ...section, tableMode: mode };
    // If switching to grid and no columns yet, add an initial column
    if (mode === "grid" && (!updated.columns || updated.columns.length === 0)) {
      updated.columns = [{ id: genId(), header: "" }];
      updated.rows    = updated.rows || [];
    }
    onChange(updated);
  };

  const toggleShareDefault = () =>
    onChange({ ...section, shareFullByDefault: !shareFullByDefault });

  // Count for subtitle
  const itemCount = tableMode === "list"
    ? (section.items || []).length
    : `${(section.columns || []).length}×${(section.rows || []).length}`;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm mb-4">
      {/* ── Header bar ── */}
      <div className="bg-[#F5F0EE] border-b border-[#E8E2DF]">
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Expand toggle */}
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
            <span className="text-lg">{emoji}</span>
            <div>
              <p className="text-sm font-bold text-[#222]">{label}</p>
              <p className="text-xs text-[#888] font-sans">
                {hint} ·{" "}
                <span className="font-semibold text-[#661F1F]">
                  {tableMode === "grid" ? `${itemCount} grid` : `${itemCount} items`}
                </span>
              </p>
            </div>
            <span className="ml-auto text-[#AAA]">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {/* Share Full Table default toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleShareDefault(); }}
            title="When enabled, new quotations will default to sharing the full table"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold font-sans
              transition-all flex-shrink-0
              ${shareFullByDefault
                ? "bg-[#E8F5E9] border-[#B8E0B8] text-[#1A7A1A]"
                : "bg-white border-[#E8E2DF] text-[#888] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}
          >
            {shareFullByDefault ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            Share Full Default
          </button>
        </div>

        {/* ── Mode switcher bar ── */}
        {expanded && (
          <div className="flex items-center gap-1 px-4 pb-3">
            <span className="text-[10px] text-[#888] font-sans font-semibold uppercase tracking-wide mr-2">Mode:</span>
            <button
              onClick={() => setMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans
                transition-all
                ${tableMode === "list"
                  ? "bg-[#661F1F] text-white shadow-sm"
                  : "bg-white border border-[#E8E2DF] text-[#666] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}
            >
              <List size={12} /> List
            </button>
            <button
              onClick={() => setMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans
                transition-all
                ${tableMode === "grid"
                  ? "bg-[#661F1F] text-white shadow-sm"
                  : "bg-white border border-[#E8E2DF] text-[#666] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}
            >
              <Table size={12} /> Grid (Rows × Columns)
            </button>
            {tableMode === "grid" && (
              <span className="ml-2 text-[10px] text-[#0055CC] font-sans bg-[#E3F2FD] px-2 py-0.5 rounded-full">
                Named headers appear in burgundy in PDF
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {expanded && (
        tableMode === "grid"
          ? <GridEditor section={section} onChange={onChange} />
          : <ListEditor  section={section} onChange={onChange} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ManageQuotations() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("BS4");

  const [tables, setTables] = useState({
    BS4:      defaultPriceTable(),
    BS6_4INJ: defaultPriceTable(),
    BS6_8INJ: defaultPriceTable(),
  });

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);
  const [loadError,  setLoadError]  = useState(null);
  const [saveError,  setSaveError]  = useState(null);

  // ── Load all tables on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [bs4, bs6_4, bs6_8] = await Promise.all([
          fetchQuotationPriceTable("BS4"),
          fetchQuotationPriceTable("BS6_4INJ"),
          fetchQuotationPriceTable("BS6_8INJ"),
        ]);
        const ensureSections = (table) => {
          const t = table || defaultPriceTable();
          return {
            kits:      normSection(t.kits),
            advancers: normSection(t.advancers),
            extras:    normSection(t.extras),
            cylinders: normSection(t.cylinders),
            note:      t.note || "",
          };
        };
        setTables({
          BS4:      ensureSections(bs4),
          BS6_4INJ: ensureSections(bs6_4),
          BS6_8INJ: ensureSections(bs6_8),
        });
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Update a section ──────────────────────────────────────────────────────
  const updateSection = useCallback((emCat, sectionKey, sectionData) => {
    setTables((prev) => ({
      ...prev,
      [emCat]: { ...prev[emCat], [sectionKey]: sectionData },
    }));
  }, []);

  const updateNote = useCallback((emCat, note) => {
    setTables((prev) => ({ ...prev, [emCat]: { ...prev[emCat], note } }));
  }, []);

  // ── Save current tab ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      await saveQuotationPriceTable(activeTab, tables[activeTab]);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Save all tabs ─────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaving(true); setSaveError(null); setSaveOk(false);
    try {
      await Promise.all(EMISSION_CATEGORIES.map(({ id }) => saveQuotationPriceTable(id, tables[id])));
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      setSaveError("Failed to save all. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const activeTable = tables[activeTab];

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-24">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/quotations")}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center
              text-white hover:bg-white/25 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">Quotations</p>
            <h1 className="text-white text-lg font-bold leading-tight">Manage Price Tables</h1>
          </div>
          <button onClick={handleSaveAll} disabled={saving || loading}
            className="flex items-center gap-1.5 bg-white/20 text-white border border-white/30
              rounded-xl px-3 py-2 text-xs font-semibold font-sans hover:bg-white/30
              transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save All"}
          </button>
        </div>

        {/* Emission category tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-0 flex gap-1 overflow-x-auto">
          {EMISSION_CATEGORIES.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-bold font-sans rounded-t-xl
                transition-all whitespace-nowrap border-b-2
                ${activeTab === id
                  ? "bg-[#CDCBC9] text-[#661F1F] border-transparent"
                  : "bg-white/10 text-white/70 hover:bg-white/20 border-transparent"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="text-[#661F1F] animate-spin" />
          <span className="text-sm text-[#888] font-sans">Loading price tables…</span>
        </div>
      )}

      {/* Load error */}
      {loadError && !loading && (
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl p-4">
            <AlertTriangle size={16} className="text-[#CC0000] flex-shrink-0" />
            <p className="text-sm text-[#CC0000] font-sans">Failed to load: {loadError}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !loadError && (
        <div className="max-w-3xl mx-auto px-4 pt-6">

          {/* Info banner */}
          <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-xl p-3 mb-5 flex items-start gap-2">
            <Table size={14} className="text-[#0055CC] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#1A3A8A] font-sans">
              <strong>List Mode</strong> — simple name + price pairs.&nbsp;
              <strong>Grid Mode</strong> — rows × columns like the physical price list.
              Column and row headers are optional; when named they appear in{" "}
              <strong style={{ color: "#661F1F" }}>burgundy</strong> in the quotation PDF.
            </p>
          </div>

          {/* Save OK toast */}
          {saveOk && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1A7A1A] text-white
              rounded-xl px-5 py-3 text-sm font-semibold font-sans shadow-2xl flex items-center gap-2">
              <Check size={16} /> Saved successfully!
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8]
              rounded-xl p-3 mb-4">
              <AlertTriangle size={14} className="text-[#CC0000] flex-shrink-0" />
              <p className="text-sm text-[#CC0000] font-sans">{saveError}</p>
              <button onClick={() => setSaveError(null)} className="ml-auto text-[#CC0000]">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Four table editors */}
          {TABLE_TYPES.map(({ key, label, emoji, hint }) => (
            <TableEditor
              key={`${activeTab}_${key}`}
              tableKey={key}
              label={label}
              emoji={emoji}
              hint={hint}
              section={activeTable[key] || normSection()}
              onChange={(data) => updateSection(activeTab, key, data)}
            />
          ))}

          {/* Note box */}
          <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm mb-6">
            <div className="bg-[#F5F0EE] px-5 py-3 border-b border-[#E8E2DF]">
              <p className="text-sm font-bold text-[#222]">📝 Notes</p>
              <p className="text-xs text-[#888] font-sans">
                Printed at the bottom of every quotation for{" "}
                {EMISSION_CATEGORIES.find((c) => c.id === activeTab)?.label} vehicles.
              </p>
            </div>
            <div className="p-4">
              <textarea rows={4}
                value={activeTable.note || ""}
                onChange={(e) => updateNote(activeTab, e.target.value)}
                placeholder="Enter notes for this emission category — e.g. warranty terms, RTO requirements, validity period…"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8E2DF] text-sm font-sans
                  text-[#222] placeholder-[#BBB] bg-[#FAFAFA] outline-none resize-none
                  focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10 transition-all"
              />
            </div>
          </div>

          {/* Save (this tab) */}
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-xl bg-[#661F1F] text-white font-bold font-sans text-sm
              hover:bg-[#8B3A3A] transition-colors shadow-lg shadow-[#661F1F]/25
              flex items-center justify-center gap-2 disabled:opacity-60 mb-10">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : <><Save size={16} /> Save {EMISSION_CATEGORIES.find((c) => c.id === activeTab)?.label} Table</>}
          </button>

          {/* Summary strip */}
          <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm mb-6">
            <div className="bg-[#F5F0EE] px-5 py-3 border-b border-[#E8E2DF]">
              <p className="text-xs font-bold text-[#661F1F] font-sans uppercase tracking-widest">Summary</p>
            </div>
            <div className="divide-y divide-[#F0EBE8]">
              {EMISSION_CATEGORIES.map(({ id, label }) => {
                const t = tables[id];
                return (
                  <div key={id} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#333] font-sans">{label}</span>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {TABLE_TYPES.map(({ key, emoji }) => {
                        const sec  = t[key] || {};
                        const mode = sec.tableMode || "list";
                        const cnt  = mode === "grid"
                          ? `${(sec.rows || []).length}×${(sec.columns || []).length}`
                          : (sec.items || []).length;
                        return (
                          <span key={key} className="text-xs text-[#888] font-sans" title={key}>
                            {emoji} {cnt}
                            {mode === "grid" && (
                              <span className="ml-0.5 text-[9px] text-[#0055CC]">G</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
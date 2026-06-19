// SGA — Last updated: Three fixes — (1) Grid rows in "Pick Items" mode no longer
// show a misleading single price. Multi-column grids have no meaningful single price;
// instead all cell values are shown as a compact preview (e.g. "41000 · 1500 · 2500").
// Price override button removed for grid rows. (2) Subtotal bar removed from Step 3
// since PDF no longer shows a total amount. (3) Total footer removed from Step 4
// review card for the same reason.
// src/pages/quotations/CreateQuotationForm.jsx

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, ChevronUp, X, Car, User, FileText,
  Check, ChevronRight, Loader2, ExternalLink, AlertTriangle,
  ToggleLeft, ToggleRight, Package, Table,
} from "lucide-react";
import useQuotationStore from "../../store/quotationStore";
import {
  createQuotation, notifyCarNotInRepository,
  fetchCarRepository, fetchBusinessSettings, searchCustomers,
  fetchQuotationPriceTable, EMISSION_CATEGORIES,
} from "../../lib/quotationService";
import { useAuth } from "../../hooks/useAuth";

const STEPS = [
  { id: 1, label: "Customer", icon: User     },
  { id: 2, label: "Vehicle",  icon: Car      },
  { id: 3, label: "Items",    icon: FileText },
  { id: 4, label: "Review",   icon: Check    },
];

const TABLE_SECTIONS = [
  { key: "kits",      label: "Kit Company",      emoji: "🔧" },
  { key: "advancers", label: "CKP Advancer",     emoji: "⚡" },
  { key: "extras",    label: "Extras",           emoji: "➕" },
  { key: "cylinders", label: "Cylinder Options", emoji: "🔵" },
];

function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 px-4">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isDone   = currentStep > step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${isDone ? "bg-[#1A7A1A] shadow-md" : isActive ? "bg-[#661F1F] shadow-lg shadow-[#661F1F]/30" : "bg-[#E8E2DF]"}`}>
                {isDone ? <Check size={16} className="text-white" /> : <Icon size={16} className={isActive ? "text-white" : "text-[#999]"} />}
              </div>
              <span className={`text-[10px] font-semibold font-sans tracking-wide
                ${isActive ? "text-[#661F1F]" : isDone ? "text-[#1A7A1A]" : "text-[#999]"}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-[2px] w-10 sm:w-16 mx-1 mb-5 transition-all duration-500
                ${currentStep > step.id ? "bg-[#1A7A1A]" : "bg-[#E8E2DF]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, optional, error, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium font-sans text-[#444] tracking-wide flex items-center gap-1.5">
        {label}
        {required && <span className="text-[#CC0000]">*</span>}
        {optional && <span className="text-[#AAA] text-[10px] font-normal">(optional)</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-[11px] text-[#888] font-sans">{hint}</p>}
      {error && <p className="text-[11px] text-[#CC0000] font-sans">{error}</p>}
    </div>
  );
}

function Input({ error, className = "", ...props }) {
  return (
    <input className={`w-full h-11 px-3 rounded-lg border text-sm font-sans bg-white
      text-[#222] placeholder-[#AAA] outline-none transition-all
      focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
      ${error ? "border-[#CC0000]" : "border-[#E8E2DF]"} ${className}`}
      {...props}
    />
  );
}

function StepCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2DF] overflow-hidden mb-2">
      <div className="bg-[#F5F0EE] px-5 py-4 border-b border-[#E8E2DF]">
        <h2 className="text-base font-bold text-[#222]">{title}</h2>
        {subtitle && <p className="text-xs text-[#888] font-sans mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 px-1">
      <span className="text-xs text-[#888] font-sans w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#222] font-sans font-semibold flex-1">{value || "—"}</span>
    </div>
  );
}

// ─── Compact grid preview used in the Step 3 "Full Grid" selected state ───────
function GridPreview({ gridColumns = [], gridRows = [] }) {
  if (gridColumns.length === 0 && gridRows.length === 0) return null;
  const hasColHeaders = gridColumns.some((c) => c.header?.trim());
  const hasRowHeaders = gridRows.some((r)  => r.header?.trim());

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8E2DF]">
      <table className="border-collapse text-xs font-sans" style={{ minWidth: `${(gridColumns.length + 1) * 100}px` }}>
        {hasColHeaders && (
          <thead>
            <tr>
              {hasRowHeaders && <th className="border border-[#E8E2DF] bg-[#661F1F] px-3 py-2 text-white text-center font-semibold" />}
              {gridColumns.map((col) => (
                <th key={col.id}
                  className={`border border-[#E8E2DF] px-3 py-2 text-center font-semibold
                    ${col.header?.trim() ? "bg-[#661F1F] text-white" : "bg-[#E8E2DF] text-[#888]"}`}>
                  {col.header || "—"}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {gridRows.map((row, ri) => (
            <tr key={row.id} className={ri % 2 === 1 ? "bg-[#F5F0EE]" : "bg-white"}>
              {hasRowHeaders && (
                <td className={`border border-[#E8E2DF] px-3 py-2 font-semibold
                  ${row.header?.trim() ? "bg-[#8B3A3A] text-white" : "bg-[#E8E2DF] text-[#888]"}`}>
                  {row.header || "—"}
                </td>
              )}
              {gridColumns.map((col) => (
                <td key={col.id} className="border border-[#E8E2DF] px-3 py-2 text-center font-mono text-[#222]">
                  {row.cells?.[col.id] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section Accordion ────────────────────────────────────────────────────────
function SectionAccordion({ sectionKey, label, emoji, section, onToggleFull, onToggleItem }) {
  const [expanded, setExpanded] = useState(true);
  const { tableMode = "list", shareFullTable, selectedItems = [], allItems = [], gridColumns = [], gridRows = [] } = section;
  const isGrid = tableMode === "grid";

  const itemCount = shareFullTable
    ? (isGrid ? gridRows.length : allItems.length)
    : selectedItems.length;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-[#F5F0EE] border-b border-[#E8E2DF]">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
            <span className="text-lg">{emoji}</span>
            <div>
              <p className="text-sm font-bold text-[#222] flex items-center gap-1.5">
                {label}
                {isGrid && (
                  <span className="text-[9px] bg-[#E3F2FD] text-[#0055CC] px-1.5 py-0.5 rounded font-semibold">GRID</span>
                )}
              </p>
              <p className="text-xs text-[#888] font-sans">
                {isGrid ? `${gridColumns.length} col × ${gridRows.length} row` : `${allItems.length} items`}
                {itemCount > 0 && (
                  <span className={`ml-2 font-semibold ${shareFullTable ? "text-[#1A7A1A]" : "text-[#661F1F]"}`}>
                    · {shareFullTable ? (isGrid ? "Full grid" : "Full table") : `${itemCount} selected`}
                  </span>
                )}
              </p>
            </div>
            <span className="ml-auto text-[#AAA]">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {/* Toggle */}
          <button onClick={onToggleFull}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold
              font-sans transition-all flex-shrink-0
              ${shareFullTable
                ? "bg-[#E8F5E9] border-[#B8E0B8] text-[#1A7A1A]"
                : "bg-white border-[#E8E2DF] text-[#888] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}>
            {shareFullTable ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {shareFullTable ? (isGrid ? "Full Grid" : "Full Table") : "Pick Items"}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4">

          {/* ── GRID MODE ── */}
          {isGrid ? (
            gridColumns.length === 0 && gridRows.length === 0 ? (
              <div className="text-center py-6">
                <Table size={24} className="text-[#CDCBC9] mx-auto mb-2" />
                <p className="text-sm text-[#AAA] font-sans">
                  No grid data yet.{" "}
                  <span className="text-[#661F1F] font-semibold">Add rows and columns in Manage Quotations →</span>
                </p>
              </div>
            ) : shareFullTable ? (
              /* Full grid — show compact preview */
              <div>
                <div className="flex items-center gap-2 mb-3 bg-[#E8F5E9] border border-[#B8E0B8] rounded-xl px-3 py-2">
                  <Check size={14} className="text-[#1A7A1A] flex-shrink-0" />
                  <p className="text-xs text-[#1A7A1A] font-sans font-semibold">
                    Full grid ({gridColumns.length} columns × {gridRows.length} rows) will appear in the quotation PDF.
                  </p>
                </div>
                <GridPreview gridColumns={gridColumns} gridRows={gridRows} />
              </div>
            ) : (
              /* Pick rows mode — FIX: no price shown, all cell values shown as preview */
              <div>
                <p className="text-xs text-[#888] font-sans mb-3">
                  Select rows to include in the quotation PDF.
                </p>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {allItems.map((item) => {
                    const isSelected = selectedItems.some((s) => s.id === item.id);
                    // Show all non-empty cell values as a compact horizontal list
                    const cellValues = Object.values(item.rowData?.cells || {})
                      .filter(Boolean)
                      .slice(0, 5);

                    return (
                      <div key={item.id}
                        className={`rounded-xl border transition-all overflow-hidden cursor-pointer
                          ${isSelected ? "border-[#661F1F] bg-[#FDF0F0]" : "border-[#E8E2DF] bg-white hover:border-[#CDCBC9]"}`}
                        onClick={() => onToggleItem(item)}
                      >
                        <div className="flex items-start gap-3 px-3 py-2.5">
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5
                            ${isSelected ? "bg-[#661F1F] border-[#661F1F]" : "border-[#CCC]"}`}>
                            {isSelected && <Check size={11} className="text-white" />}
                          </div>
                          {/* Row info — name + cell values preview, NO price */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-sans ${isSelected ? "text-[#222] font-semibold" : "text-[#555]"}`}>
                              {item.name || "—"}
                            </p>
                            {cellValues.length > 0 && (
                              <p className="text-[11px] text-[#AAA] font-mono mt-0.5 truncate">
                                {cellValues.join(" · ")}
                              </p>
                            )}
                          </div>
                          {/* No price displayed — grid rows have multiple values, not a single price */}
                        </div>
                      </div>
                    );
                  })}

                  {allItems.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-[#AAA] font-sans">
                        No rows in this grid yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* ── LIST MODE ── */
            allItems.length === 0 ? (
              <div className="text-center py-6">
                <Package size={24} className="text-[#CDCBC9] mx-auto mb-2" />
                <p className="text-sm text-[#AAA] font-sans">
                  No items yet.{" "}
                  <span className="text-[#661F1F] font-semibold">Add items in Manage Quotations →</span>
                </p>
              </div>
            ) : shareFullTable ? (
              <div>
                <div className="flex items-center gap-2 mb-3 bg-[#E8F5E9] border border-[#B8E0B8] rounded-xl px-3 py-2">
                  <Check size={14} className="text-[#1A7A1A] flex-shrink-0" />
                  <p className="text-xs text-[#1A7A1A] font-sans font-semibold">
                    All {allItems.length} items from this table will appear in the quotation PDF.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {allItems.map((item) => (
                    <div key={item.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-[#F5F0EE] rounded-xl text-sm font-sans">
                      <span className="text-[#333] flex-1 truncate">{item.name || "—"}</span>
                      <span className="text-[#661F1F] font-mono font-semibold flex-shrink-0">{formatINR(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* List pick items mode — price + override retained for list sections */
              <div>
                <p className="text-xs text-[#888] font-sans mb-3">Select items. Tap ✏ to override price.</p>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {allItems.map((item) => {
                    const [overriding, setOverriding] = useState(false);
                    const isSelected   = selectedItems.some((s) => s.id === item.id);
                    const selectedItem = selectedItems.find((s) => s.id === item.id);
                    return (
                      <div key={item.id}
                        className={`rounded-xl border transition-all overflow-hidden
                          ${isSelected ? "border-[#661F1F] bg-[#FDF0F0]" : "border-[#E8E2DF] bg-white hover:border-[#CDCBC9]"}`}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <button onClick={() => onToggleItem(item)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                              ${isSelected ? "bg-[#661F1F] border-[#661F1F]" : "border-[#CCC]"}`}>
                            {isSelected && <Check size={11} className="text-white" />}
                          </button>
                          <span className={`flex-1 text-sm font-sans ${isSelected ? "text-[#222] font-semibold" : "text-[#555]"}`}>
                            {item.name}
                          </span>
                          <span className={`text-sm font-mono font-semibold flex-shrink-0
                            ${isSelected && selectedItem?.price !== item.price ? "text-[#CC6600]" : isSelected ? "text-[#661F1F]" : "text-[#888]"}`}>
                            {isSelected && selectedItem ? formatINR(selectedItem.price) : formatINR(item.price)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateQuotationForm() {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();

  const {
    draft, updateDraft, resetDraft,
    toggleSectionFullTable, toggleSectionItem,
    loadPriceTableIntoSections, setEmissionCategory,
  } = useQuotationStore();

  const [step,      setStep]      = useState(1);
  const [errors,    setErrors]    = useState({});
  const [isSaving,  setIsSaving]  = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [carRepo,   setCarRepo]   = useState([]);
  const [carLoading,setCarLoading]= useState(true);
  const [selectedCompanyData, setSelectedCompanyData] = useState(null);
  const [bizSettings,     setBizSettings]     = useState(null);
  const [tableLoading,    setTableLoading]    = useState(false);
  const [tableError,      setTableError]      = useState(null);
  const [customerQuery,   setCustomerQuery]   = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDrop,setShowCustomerDrop]= useState(false);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [repo, settings] = await Promise.all([fetchCarRepository(), fetchBusinessSettings()]);
        setCarRepo(repo); setBizSettings(settings);
      } catch (e) { console.error(e); }
      finally { setCarLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    (async () => {
      setTableLoading(true); setTableError(null);
      try {
        const table = await fetchQuotationPriceTable(draft.emissionCategory);
        loadPriceTableIntoSections(table);
      } catch { setTableError("Could not load price table. Check your connection."); }
      finally  { setTableLoading(false); }
    })();
  }, [draft.emissionCategory, step]); // eslint-disable-line

  useEffect(() => {
    if (!customerQuery.trim() || draft.isExistingCustomer) { setCustomerResults([]); setShowCustomerDrop(false); return; }
    setSearchLoading(true);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await searchCustomers(customerQuery);
        setCustomerResults(res); setShowCustomerDrop(res.length > 0);
      } catch { setCustomerResults([]); }
      finally  { setSearchLoading(false); }
    }, 350);
    return () => clearTimeout(searchTimeout.current);
  }, [customerQuery, draft.isExistingCustomer]);

  const handleCompanyChange = (company) => {
    updateDraft({ vehicleCompany: company, vehicleModel: "", carDriveLink: "", carReelLinks: [], isManualVehicle: company === "__not_in_list__" });
    setSelectedCompanyData(carRepo.find((c) => c.name === company) || null);
    setErrors((p) => ({ ...p, vehicleCompany: undefined, vehicleModel: undefined }));
  };

  const handleModelSelect = (model) => {
    updateDraft({ vehicleModel: model.name, carDriveLink: model.driveLink || "", carReelLinks: model.reelLinks || [] });
    setErrors((p) => ({ ...p, vehicleModel: undefined }));
  };

  const selectCustomer = (c) => {
    updateDraft({ customerName: c.name, customerPhone: c.phone?.replace(/\D/g, "") || "", customerId: c.id, isExistingCustomer: true });
    setCustomerQuery(c.name); setShowCustomerDrop(false);
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (draft.customerPhone?.trim() && draft.customerPhone.replace(/\D/g, "").length !== 10)
        e.customerPhone = "If entering a phone number, it must be 10 digits";
    }
    if (s === 2) {
      if (!draft.vehicleCompany) { e.vehicleCompany = "Select a vehicle company"; }
      else if (draft.vehicleCompany === "__not_in_list__") {
        if (!draft.notInListCompany?.trim()) e.notInListCompany = "Enter vehicle company name";
        if (!draft.notInListModel?.trim())   e.notInListModel   = "Enter vehicle model name";
      } else if (!draft.vehicleModel) { e.vehicleModel = "Select a vehicle model"; }
    }
    if (s === 3) {
      const hasAny = Object.values(draft.sections || {}).some((sec) =>
        sec.shareFullTable
          ? (sec.tableMode === "grid" ? sec.gridRows?.length > 0 : sec.allItems?.length > 0)
          : sec.selectedItems?.length > 0
      );
      if (!hasAny && !Number(draft.labourCost)) e.sections = "Add at least one item or a labour charge";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, 4)); };
  const goBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const handleSubmit = async () => {
    if (!validateStep(3)) { setStep(3); return; }
    if (!user?.uid) { setSaveError("Session expired. Please log in again."); return; }
    setIsSaving(true); setSaveError(null);
    try {
      const created = await createQuotation(draft, user.uid, displayName || user.email || "Unknown");
      if (draft.isManualVehicle) {
        await notifyCarNotInRepository({
          vehicleCompany: draft.notInListCompany, vehicleModel: draft.notInListModel,
          quotationId: created.id, quotationNumber: created.quotationNumber,
          createdBy: user.uid, createdByName: displayName || user.email,
        });
      }
      resetDraft();
      navigate(`/quotations/${created.id}`, { state: { newlyCreated: true, quotation: created, bizSettings } });
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save quotation. Please try again.");
    } finally { setIsSaving(false); }
  };

  // Review: collect sections for display in Step 4
  const allSectionItemsForReview = () => {
    const result = [];
    TABLE_SECTIONS.forEach(({ key, label }) => {
      const sec = draft.sections?.[key];
      if (!sec) return;
      if (sec.tableMode === "grid" && sec.shareFullTable) {
        result.push({ key, label, isGrid: true, isFullGrid: true, gridColumns: sec.gridColumns, gridRows: sec.gridRows });
      } else if (sec.tableMode === "grid" && !sec.shareFullTable && sec.selectedItems?.length > 0) {
        result.push({ key, label, isGrid: true, isFullGrid: false, items: sec.selectedItems });
      } else if (sec.tableMode === "list") {
        const pool = sec.shareFullTable ? sec.allItems : sec.selectedItems;
        if (pool?.length > 0) result.push({ key, label, isGrid: false, items: pool });
      }
    });
    return result;
  };

  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/quotations")}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors">
            <X size={18} />
          </button>
          <div className="flex-1">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">New Quotation</p>
            <h1 className="text-white text-lg font-bold leading-tight">Create Quotation</h1>
          </div>
          <div className="text-[#F0BABA] text-xs font-sans">Step {step} of {STEPS.length}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <StepIndicator currentStep={step} />

        {/* ── STEP 1: Customer (optional) ── */}
        {step === 1 && (
          <StepCard title="Customer Information" subtitle="Both fields are optional — leave blank for a general quotation">
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-2 bg-[#E3F2FD] border border-[#90CAF9] rounded-xl px-3 py-2.5">
                <span className="text-lg flex-shrink-0">ℹ️</span>
                <p className="text-xs text-[#1A3A8A] font-sans">
                  Customer name and phone are <strong>optional</strong>. Create a general price quotation without customer details.
                </p>
              </div>
              <Field label="Customer Name" optional hint="Search existing customers or type a new name">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA]" />
                  <input
                    className="w-full h-11 pl-9 pr-3 rounded-lg border border-[#E8E2DF] text-sm font-sans
                      bg-white text-[#222] placeholder-[#AAA] outline-none transition-all
                      focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                    placeholder="Search or enter customer name… (optional)"
                    value={draft.isExistingCustomer ? draft.customerName : customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      updateDraft({ customerName: e.target.value, customerId: null, isExistingCustomer: false });
                    }}
                    onFocus={() => customerResults.length > 0 && setShowCustomerDrop(true)}
                  />
                  {searchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] animate-spin" />}
                  {draft.isExistingCustomer && (
                    <button onClick={() => { updateDraft({ customerName: "", customerId: null, isExistingCustomer: false }); setCustomerQuery(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] hover:text-[#CC0000]">
                      <X size={14} />
                    </button>
                  )}
                  {showCustomerDrop && customerResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-[#E8E2DF] overflow-hidden">
                      {customerResults.map((c) => (
                        <button key={c.id} onClick={() => selectCustomer(c)}
                          className="w-full px-4 py-3 text-left hover:bg-[#FDF6F6] transition-colors flex items-start gap-3 border-b border-[#F0EBE8] last:border-b-0">
                          <div className="w-8 h-8 rounded-full bg-[#F0E0E0] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User size={14} className="text-[#661F1F]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#222] font-sans">{c.name}</p>
                            <p className="text-xs text-[#888] font-sans">{c.phone} · {c.vehicleNo || "No vehicle"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="WhatsApp Number" optional error={errors.customerPhone} hint="10-digit number for WhatsApp delivery">
                <div className="flex gap-2">
                  <div className="h-11 px-3 rounded-lg border border-[#E8E2DF] bg-[#F5F0EE] flex items-center text-sm text-[#666] font-sans flex-shrink-0">+91</div>
                  <Input type="tel" inputMode="numeric" placeholder="98765 43210 (optional)" maxLength={10}
                    value={draft.customerPhone}
                    onChange={(e) => updateDraft({ customerPhone: e.target.value.replace(/\D/g, "") })}
                    error={errors.customerPhone} />
                </div>
              </Field>
            </div>
          </StepCard>
        )}

        {/* ── STEP 2: Vehicle ── */}
        {step === 2 && (
          <StepCard title="Vehicle Details" subtitle="Select the car model for this quotation">
            {carLoading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 size={20} className="text-[#661F1F] animate-spin" />
                <span className="text-sm text-[#888] font-sans">Loading car repository…</span>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <Field label="Vehicle Company" required error={errors.vehicleCompany}>
                  <div className="relative">
                    <select value={draft.vehicleCompany} onChange={(e) => handleCompanyChange(e.target.value)}
                      className={`w-full h-11 px-3 pr-9 rounded-lg border text-sm font-sans bg-white text-[#222]
                        outline-none appearance-none transition-all focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                        ${errors.vehicleCompany ? "border-[#CC0000]" : "border-[#E8E2DF]"}
                        ${!draft.vehicleCompany ? "text-[#AAA]" : ""}`}>
                      <option value="">Select vehicle company…</option>
                      {carRepo.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      <option value="__not_in_list__">⚠ Not in list (enter manually)</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] pointer-events-none" />
                  </div>
                </Field>
                {draft.vehicleCompany === "__not_in_list__" && (
                  <div className="bg-[#FFF8E0] border border-[#FFD166] rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#7A4400] font-sans">SuperAdmin will be notified to add this model.</p>
                    </div>
                    <Field label="Vehicle Company Name" required error={errors.notInListCompany}>
                      <Input placeholder="e.g., Tata Motors" value={draft.notInListCompany}
                        onChange={(e) => updateDraft({ notInListCompany: e.target.value })} error={errors.notInListCompany} />
                    </Field>
                    <Field label="Vehicle Model Name" required error={errors.notInListModel}>
                      <Input placeholder="e.g., Nexon 2024" value={draft.notInListModel}
                        onChange={(e) => updateDraft({ notInListModel: e.target.value })} error={errors.notInListModel} />
                    </Field>
                  </div>
                )}
                {draft.vehicleCompany && draft.vehicleCompany !== "__not_in_list__" && selectedCompanyData && (
                  <Field label="Vehicle Model" required error={errors.vehicleModel}>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                      {(selectedCompanyData.models || []).map((model, i) => {
                        const isSelected = draft.vehicleModel === model.name;
                        return (
                          <button key={i} onClick={() => handleModelSelect(model)}
                            className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3
                              ${isSelected ? "border-[#661F1F] bg-[#FDF0F0] shadow-md" : "border-[#E8E2DF] bg-white hover:border-[#8B3A3A]"}`}>
                            <div className="flex items-center gap-3">
                              <Car size={16} className={isSelected ? "text-[#661F1F]" : "text-[#AAA]"} />
                              <span className={`text-sm font-sans font-semibold ${isSelected ? "text-[#661F1F]" : "text-[#333]"}`}>{model.name}</span>
                            </div>
                            {isSelected && <Check size={16} className="text-[#661F1F]" />}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                <Field label="Vehicle Year (optional)">
                  <Input type="number" inputMode="numeric" placeholder="e.g., 2022"
                    min={1990} max={new Date().getFullYear() + 1}
                    value={draft.vehicleYear} onChange={(e) => updateDraft({ vehicleYear: e.target.value })} />
                </Field>
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 3: Items ── */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            {errors.sections && (
              <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-[#CC0000] flex-shrink-0" />
                <p className="text-sm text-[#CC0000] font-sans">{errors.sections}</p>
              </div>
            )}

            {/* Emission category */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2DF] overflow-hidden">
              <div className="bg-[#F5F0EE] px-5 py-3 border-b border-[#E8E2DF]">
                <h2 className="text-base font-bold text-[#222]">Items &amp; Pricing</h2>
                <p className="text-xs text-[#888] font-sans mt-0.5">Select emission category, then pick items from the price tables.</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-[#444] font-sans mb-3">Vehicle Emission Category</p>
                <div className="flex gap-2 flex-wrap">
                  {EMISSION_CATEGORIES.map(({ id, label }) => (
                    <button key={id} onClick={() => { setEmissionCategory(id); setTableError(null); }}
                      className={`flex-1 min-w-[80px] py-2.5 px-3 rounded-xl border text-xs font-bold font-sans
                        transition-all whitespace-nowrap
                        ${draft.emissionCategory === id
                          ? "bg-[#661F1F] text-white border-[#661F1F] shadow-md"
                          : "bg-white text-[#555] border-[#E8E2DF] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {tableLoading && (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 size={22} className="text-[#661F1F] animate-spin" />
                <span className="text-sm text-[#888] font-sans">Loading price tables…</span>
              </div>
            )}
            {tableError && !tableLoading && (
              <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-[#CC0000] flex-shrink-0" />
                <p className="text-sm text-[#CC0000] font-sans">{tableError}</p>
              </div>
            )}

            {!tableLoading && !tableError && (
              <>
                {TABLE_SECTIONS.map(({ key, label, emoji }) => {
                  const section = draft.sections?.[key] || { tableMode: "list", shareFullTable: false, selectedItems: [], allItems: [], gridColumns: [], gridRows: [] };
                  return (
                    <SectionAccordion key={key} sectionKey={key} label={label} emoji={emoji} section={section}
                      onToggleFull={() => toggleSectionFullTable(key)}
                      onToggleItem={(item) => toggleSectionItem(key, item)} />
                  );
                })}

                {/* Labour */}
                <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm">
                  <div className="bg-[#FDF8F8] border-b border-[#E8D8D8] px-5 py-3">
                    <p className="text-sm font-bold text-[#661F1F]">Labour / Installation Charges</p>
                    <p className="text-xs text-[#888] font-sans mt-0.5">Appears as a separate line on the quotation PDF</p>
                  </div>
                  <div className="p-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA] text-sm font-sans">₹</span>
                      <input type="number" inputMode="decimal" min={0} placeholder="0"
                        value={draft.labourCost || ""}
                        onChange={(e) => updateDraft({ labourCost: parseFloat(e.target.value) || 0 })}
                        className="w-full h-11 pl-7 pr-3 rounded-xl border border-[#E8E2DF] text-sm font-mono
                          text-right bg-[#FAFAFA] text-[#222] outline-none
                          focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10" />
                    </div>
                  </div>
                </div>

                {draft.tableNote && (
                  <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#1A3A8A] font-sans uppercase tracking-wide mb-1.5">📝 Note (printed at bottom of PDF)</p>
                    <p className="text-sm text-[#1A3A8A] font-sans leading-relaxed">{draft.tableNote}</p>
                  </div>
                )}

                {/* FIX: Subtotal bar removed — quotation PDF no longer shows a total amount */}
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <StepCard title="Review Quotation" subtitle="Confirm all details before saving">
            <div className="flex flex-col gap-4">
              <ReviewRow label="Customer" value={draft.customerName || "(not specified)"} />
              <ReviewRow label="Phone"    value={draft.customerPhone ? `+91 ${draft.customerPhone}` : "(not specified)"} />
              <ReviewRow label="Vehicle"  value={draft.isManualVehicle ? `${draft.notInListCompany} ${draft.notInListModel} (manual)` : `${draft.vehicleCompany} ${draft.vehicleModel}`} />
              {draft.vehicleYear && <ReviewRow label="Year" value={draft.vehicleYear} />}
              <ReviewRow label="Category" value={EMISSION_CATEGORIES.find((c) => c.id === draft.emissionCategory)?.label || draft.emissionCategory} />

              {/* Items summary */}
              {(() => {
                const sections = allSectionItemsForReview();
                return sections.length > 0 ? (
                  <div className="bg-white border border-[#E8E2DF] rounded-xl overflow-hidden">
                    <div className="bg-[#F5F0EE] px-4 py-2 border-b border-[#E8E2DF]">
                      <p className="text-xs font-semibold text-[#661F1F] font-sans uppercase tracking-wide">Items</p>
                    </div>
                    {/* FIX: Total amount footer removed from review card */}
                    <div className="divide-y divide-[#F0EBE8] p-3 flex flex-col gap-2">
                      {sections.map((s) => (
                        <div key={s.key}>
                          <p className="text-[10px] font-semibold text-[#888] font-sans uppercase tracking-wider mb-1">{s.label}</p>
                          {s.isGrid && s.isFullGrid ? (
                            <GridPreview gridColumns={s.gridColumns} gridRows={s.gridRows} />
                          ) : (
                            (s.items || []).map((item, i) => (
                              <div key={item.id || i} className="flex justify-between gap-2 py-1 px-2 rounded-lg">
                                <p className="text-sm text-[#222] font-sans truncate">{item.name}</p>
                                {!s.isGrid && <p className="text-sm font-mono font-semibold text-[#333] flex-shrink-0">{formatINR(item.price)}</p>}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                      {Number(draft.labourCost || 0) > 0 && (
                        <div className="flex justify-between gap-2 py-2 px-2 rounded-lg bg-[#FDF8F8]">
                          <p className="text-sm text-[#661F1F] font-semibold font-sans">Labour / Installation</p>
                          <p className="text-sm font-mono font-semibold text-[#661F1F]">{formatINR(draft.labourCost)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}

              {draft.tableNote && (
                <div className="bg-[#F5F0EE] border border-[#E8E2DF] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#661F1F] font-sans mb-1">📝 Note</p>
                  <p className="text-xs text-[#555] font-sans">{draft.tableNote}</p>
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl px-4 py-3">
                  <AlertTriangle size={15} className="text-[#CC0000] flex-shrink-0" />
                  <p className="text-sm text-[#CC0000] font-sans">{saveError}</p>
                </div>
              )}
            </div>
          </StepCard>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button onClick={goBack} disabled={isSaving}
              className="flex-1 h-12 rounded-xl border-2 border-[#661F1F] text-[#661F1F]
                font-semibold font-sans text-sm hover:bg-[#FDF0F0] transition-colors disabled:opacity-50">
              ← Back
            </button>
          )}
          {step < 4 && (
            <button onClick={goNext} disabled={tableLoading}
              className="flex-1 h-12 rounded-xl bg-[#661F1F] text-white font-semibold font-sans text-sm
                hover:bg-[#8B3A3A] transition-colors shadow-lg shadow-[#661F1F]/25
                flex items-center justify-center gap-2 disabled:opacity-60">
              Continue <ChevronRight size={16} />
            </button>
          )}
          {step === 4 && (
            <button onClick={handleSubmit} disabled={isSaving}
              className="flex-1 h-12 rounded-xl bg-[#661F1F] text-white font-bold font-sans text-sm
                hover:bg-[#8B3A3A] transition-colors shadow-lg shadow-[#661F1F]/25
                flex items-center justify-center gap-2 disabled:opacity-60">
              {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save Quotation</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
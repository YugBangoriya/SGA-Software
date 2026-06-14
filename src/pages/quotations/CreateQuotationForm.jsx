// SGA — Last updated: Fixed Car Repository company dropdown — corrected field name from
// non-existent 'company.company' to 'company.name' (matches carRepositoryService.js schema),
// so Vehicle Company options in Quotation creation are now selectable and sync correctly
// with the Car Repository.
// src/components/quotations/CreateQuotationForm.jsx
// Phase 5 — Quotation Module
// Multi-step quotation creation form. Owner-only.
// IMPORTANT: No inventory reads or writes anywhere in this component.
//
// FIX (Phase 5 Bug): Previously used `{ currentUser, userProfile }` from
// useAuth(), but the hook returns `{ user, displayName, ... }` — neither
// `currentUser` nor `userProfile` exist on the returned object. Both were
// always `undefined`, causing the form submission to crash with:
//   "Cannot read properties of undefined (reading 'uid')"
// Fixed: destructure `user` (maps to firebaseUser) and `displayName` instead,
// and update all downstream usages accordingly.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, ChevronDown, ChevronUp, Plus, Trash2,
  Car, User, FileText, Send, AlertTriangle, X,
  Check, ChevronRight, Loader2, ExternalLink
} from "lucide-react";
import useQuotationStore from "../../store/quotationStore";
import {
  createQuotation,
  notifyCarNotInRepository,
  fetchCarRepository,
  fetchBusinessSettings,
  searchCustomers,
} from "../../lib/quotationService";
import { useAuth } from "../../hooks/useAuth";

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Customer",  icon: User },
  { id: 2, label: "Vehicle",   icon: Car },
  { id: 3, label: "Items",     icon: FileText },
  { id: 4, label: "Review",    icon: Check },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(amount) {
  const n = Number(amount || 0);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

// ─── Sub-component: Step Indicator ───────────────────────────────────────────
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 px-4">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive   = currentStep === step.id;
        const isComplete = currentStep > step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isComplete ? "bg-[#1A7A1A] shadow-md" : isActive ? "bg-[#661F1F] shadow-lg shadow-[#661F1F]/30" : "bg-[#E8E2DF]"}`}
              >
                {isComplete
                  ? <Check size={16} className="text-white" />
                  : <Icon size={16} className={isActive ? "text-white" : "text-[#999]"} />
                }
              </div>
              <span className={`text-[10px] font-semibold font-sans tracking-wide
                ${isActive ? "text-[#661F1F]" : isComplete ? "text-[#1A7A1A]" : "text-[#999]"}`}>
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

// ─── Sub-component: Field wrapper ─────────────────────────────────────────────
function Field({ label, required, error, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium font-sans text-[#444] tracking-wide">
        {label}{required && <span className="text-[#CC0000] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-[#888] font-sans">{hint}</p>}
      {error && <p className="text-[11px] text-[#CC0000] font-sans">{error}</p>}
    </div>
  );
}

// ─── Sub-component: Input ─────────────────────────────────────────────────────
function Input({ error, className = "", ...props }) {
  return (
    <input
      className={`w-full h-11 px-3 rounded-lg border text-sm font-sans
        bg-white text-[#222] placeholder-[#AAA] outline-none transition-all
        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
        ${error ? "border-[#CC0000]" : "border-[#E8E2DF]"}
        ${className}`}
      {...props}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateQuotationForm() {
  const navigate = useNavigate();

  // useAuth() returns { user, role, uid, displayName, isSuperAdmin, isOwner, ... }
  // `user` is the Firebase user object (firebaseUser).
  // `displayName` is userDoc.name || firebaseUser.displayName || 'User'.
  // There is NO `currentUser` or `userProfile` — previous code always got undefined.
  const { user, displayName } = useAuth();

  const {
    draft, updateDraft, resetDraft,
    addLineItem, removeLineItem, updateLineItem,
    getDraftSubtotal,
  } = useQuotationStore();

  const [step, setStep]           = useState(1);
  const [errors, setErrors]       = useState({});
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Car Repository data
  const [carRepo, setCarRepo]               = useState([]);  // [{id, name, models:[{name,driveLink,reelLinks}]}]
  const [carLoading, setCarLoading]         = useState(true);
  const [selectedCompanyData, setSelectedCompanyData] = useState(null);

  // Customer search
  const [customerQuery, setCustomerQuery]   = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const customerSearchTimeout = useRef(null);

  // Business settings (for PDF)
  const [bizSettings, setBizSettings] = useState(null);

  // ─── Load car repository + business settings ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [repo, settings] = await Promise.all([
          fetchCarRepository(),
          fetchBusinessSettings(),
        ]);
        setCarRepo(repo);
        setBizSettings(settings);
      } catch (e) {
        console.error("Failed to load car repo / settings:", e);
      } finally {
        setCarLoading(false);
      }
    })();
  }, []);

  // ─── Customer search (debounced) ─────────────────────────────────────────
  useEffect(() => {
    if (!customerQuery.trim() || draft.isExistingCustomer) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    setCustomerSearchLoading(true);
    clearTimeout(customerSearchTimeout.current);
    customerSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchCustomers(customerQuery);
        setCustomerResults(results);
        setShowCustomerDropdown(results.length > 0);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(customerSearchTimeout.current);
  }, [customerQuery, draft.isExistingCustomer]);

  // ─── Company change handler ───────────────────────────────────────────────
  const handleCompanyChange = (company) => {
    updateDraft({
      vehicleCompany: company,
      vehicleModel: "",
      carDriveLink: "",
      carReelLinks: [],
      isManualVehicle: company === "__not_in_list__",
    });
    const found = carRepo.find((c) => c.name === company);
    setSelectedCompanyData(found || null);
    setErrors((prev) => ({ ...prev, vehicleCompany: undefined, vehicleModel: undefined }));
  };

  // ─── Model select handler ─────────────────────────────────────────────────
  const handleModelSelect = (model) => {
    updateDraft({
      vehicleModel:  model.name,
      carDriveLink:  model.driveLink || "",
      carReelLinks:  model.reelLinks || [],
    });
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  };

  // ─── Customer select handler ──────────────────────────────────────────────
  const selectCustomer = (customer) => {
    updateDraft({
      customerName:       customer.name,
      customerPhone:      customer.phone?.replace(/\D/g, "") || "",
      customerId:         customer.id,
      isExistingCustomer: true,
    });
    setCustomerQuery(customer.name);
    setShowCustomerDropdown(false);
    setErrors((prev) => ({ ...prev, customerName: undefined, customerPhone: undefined }));
  };

  // ─── Step validation ──────────────────────────────────────────────────────
  const validateStep = (s) => {
    const newErrors = {};
    if (s === 1) {
      if (!draft.customerName?.trim()) newErrors.customerName = "Customer name is required";
      if (!draft.customerPhone?.trim() || draft.customerPhone.replace(/\D/g, "").length !== 10)
        newErrors.customerPhone = "Enter a valid 10-digit phone number";
    }
    if (s === 2) {
      if (!draft.vehicleCompany) {
        newErrors.vehicleCompany = "Select a vehicle company";
      } else if (draft.vehicleCompany === "__not_in_list__") {
        if (!draft.notInListCompany?.trim()) newErrors.notInListCompany = "Enter vehicle company name";
        if (!draft.notInListModel?.trim())   newErrors.notInListModel   = "Enter vehicle model name";
      } else {
        if (!draft.vehicleModel) newErrors.vehicleModel = "Select a vehicle model";
      }
    }
    if (s === 3) {
      const validItems = draft.lineItems.filter((i) => i.description.trim());
      if (validItems.length === 0) newErrors.lineItems = "Add at least one item to the quotation";
      validItems.forEach((item, i) => {
        if (item.unitPrice == null || item.unitPrice < 0)
          newErrors[`item_${i}_price`] = "Enter a valid price";
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4));
  };
  const goBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep(3)) { setStep(3); return; }

    // ── NULL-USER GUARD (⚠️ Bug 5.2 — addressed) ─────────────────────────────
    // `user` can be null if the Firebase session expires while the user has the
    // form open (e.g. left the tab idle). The optional chaining `user?.uid || ""`
    // below prevents a crash, but silently writing a quotation with an empty
    // creatorUid would create a data integrity problem and confuse audit logs.
    // We now catch this explicitly before attempting any Firestore write:
    if (!user?.uid) {
      setSaveError("Your session has expired. Please log in again to save the quotation.");
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    setIsSaving(true);
    setSaveError(null);
    try {
      // `user` is the Firebase user object (was previously `currentUser` — undefined).
      // `displayName` is the resolved display name (was previously `userProfile?.name
      //  || currentUser.email` — both undefined, causing a crash).
      const creatorUid  = user?.uid  || "";
      const creatorName = displayName || user?.email || "Unknown";

      const created = await createQuotation(draft, creatorUid, creatorName);

      // If manual vehicle — notify SuperAdmin
      if (draft.isManualVehicle) {
        await notifyCarNotInRepository({
          vehicleCompany:  draft.notInListCompany,
          vehicleModel:    draft.notInListModel,
          quotationId:     created.id,
          quotationNumber: created.quotationNumber,
          createdBy:       creatorUid,
          createdByName:   creatorName,
        });
      }

      resetDraft();
      navigate(`/quotations/${created.id}`, {
        state: { newlyCreated: true, quotation: created, bizSettings },
      });
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save quotation. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Line item total ──────────────────────────────────────────────────────
  const subtotal = getDraftSubtotal();

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-24">
      {/* Page header */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/quotations")}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex-1">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">New Quotation</p>
            <h1 className="text-white text-lg font-bold leading-tight">Create Quotation</h1>
          </div>
          <div className="text-[#F0BABA] text-xs font-sans">
            Step {step} of {STEPS.length}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <StepIndicator currentStep={step} />

        {/* ── STEP 1: Customer ── */}
        {step === 1 && (
          <StepCard title="Customer Information" subtitle="Who is this quotation for?">
            <div className="flex flex-col gap-5">
              {/* Customer search / name */}
              <Field label="Customer Name" required error={errors.customerName}
                hint="Search existing customers or type a new name">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA]" />
                  <input
                    className={`w-full h-11 pl-9 pr-3 rounded-lg border text-sm font-sans
                      bg-white text-[#222] placeholder-[#AAA] outline-none transition-all
                      focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                      ${errors.customerName ? "border-[#CC0000]" : "border-[#E8E2DF]"}`}
                    placeholder="Search or enter customer name…"
                    value={draft.isExistingCustomer ? draft.customerName : customerQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerQuery(val);
                      updateDraft({ customerName: val, customerId: null, isExistingCustomer: false });
                    }}
                    onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                  />
                  {customerSearchLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] animate-spin" />
                  )}
                  {draft.isExistingCustomer && (
                    <button
                      onClick={() => { updateDraft({ customerName: "", customerId: null, isExistingCustomer: false }); setCustomerQuery(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] hover:text-[#CC0000]"
                    >
                      <X size={14} />
                    </button>
                  )}

                  {/* Customer dropdown */}
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-[#E8E2DF] overflow-hidden">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selectCustomer(c)}
                          className="w-full px-4 py-3 text-left hover:bg-[#FDF6F6] transition-colors flex items-start gap-3 border-b border-[#F0EBE8] last:border-b-0"
                        >
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

              {/* Phone */}
              <Field label="WhatsApp Number" required error={errors.customerPhone}
                hint="10-digit number — quotation will be sent here">
                <div className="flex gap-2">
                  <div className="h-11 px-3 rounded-lg border border-[#E8E2DF] bg-[#F5F0EE] flex items-center text-sm text-[#666] font-sans flex-shrink-0">
                    +91
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    maxLength={10}
                    value={draft.customerPhone}
                    onChange={(e) => updateDraft({ customerPhone: e.target.value.replace(/\D/g, "") })}
                    error={errors.customerPhone}
                  />
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
                {/* Company Dropdown */}
                <Field label="Vehicle Company" required error={errors.vehicleCompany}>
                  <div className="relative">
                    <select
                      value={draft.vehicleCompany}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      className={`w-full h-11 px-3 pr-9 rounded-lg border text-sm font-sans
                        bg-white text-[#222] outline-none appearance-none transition-all
                        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                        ${errors.vehicleCompany ? "border-[#CC0000]" : "border-[#E8E2DF]"}
                        ${!draft.vehicleCompany ? "text-[#AAA]" : ""}`}
                    >
                      <option value="">Select vehicle company…</option>
                      {carRepo.map((company) => (
                        <option key={company.id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                      <option value="__not_in_list__">⚠ Not in list (enter manually)</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] pointer-events-none" />
                  </div>
                </Field>

                {/* "Not in list" — manual entry */}
                {draft.vehicleCompany === "__not_in_list__" && (
                  <div className="bg-[#FFF8E0] border border-[#FFD166] rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-[#7A4400] font-sans">Manual Vehicle Entry</p>
                        <p className="text-xs text-[#9A6400] font-sans mt-0.5">
                          SuperAdmin will be notified to add this model to the Car Repository.
                          No media links will be available for this quotation.
                        </p>
                      </div>
                    </div>
                    <Field label="Vehicle Company Name" required error={errors.notInListCompany}>
                      <Input
                        placeholder="e.g., Tata Motors"
                        value={draft.notInListCompany}
                        onChange={(e) => updateDraft({ notInListCompany: e.target.value })}
                        error={errors.notInListCompany}
                      />
                    </Field>
                    <Field label="Vehicle Model Name" required error={errors.notInListModel}>
                      <Input
                        placeholder="e.g., Nexon 2024"
                        value={draft.notInListModel}
                        onChange={(e) => updateDraft({ notInListModel: e.target.value })}
                        error={errors.notInListModel}
                      />
                    </Field>
                  </div>
                )}

                {/* Model selection (from Car Repository) */}
                {draft.vehicleCompany && draft.vehicleCompany !== "__not_in_list__" && selectedCompanyData && (
                  <Field label="Vehicle Model" required error={errors.vehicleModel}>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                      {(selectedCompanyData.models || []).map((model, i) => {
                        const isSelected = draft.vehicleModel === model.name;
                        return (
                          <button
                            key={i}
                            onClick={() => handleModelSelect(model)}
                            className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3
                              ${isSelected
                                ? "border-[#661F1F] bg-[#FDF0F0] shadow-md"
                                : "border-[#E8E2DF] bg-white hover:border-[#8B3A3A] hover:bg-[#FDF6F6]"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <Car size={16} className={isSelected ? "text-[#661F1F]" : "text-[#AAA]"} />
                              <span className={`text-sm font-sans font-semibold ${isSelected ? "text-[#661F1F]" : "text-[#333]"}`}>
                                {model.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {model.driveLink && (
                                <span className="text-[10px] bg-[#E8F5E9] text-[#1A7A1A] px-2 py-0.5 rounded-full font-sans font-semibold">
                                  Photos
                                </span>
                              )}
                              {(model.reelLinks || []).length > 0 && (
                                <span className="text-[10px] bg-[#E3F2FD] text-[#0055CC] px-2 py-0.5 rounded-full font-sans font-semibold">
                                  {model.reelLinks.length} Reel{model.reelLinks.length > 1 ? "s" : ""}
                                </span>
                              )}
                              {isSelected && <Check size={16} className="text-[#661F1F]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {/* Car media preview after selection */}
                {draft.vehicleModel && !draft.isManualVehicle && (draft.carDriveLink || draft.carReelLinks.length > 0) && (
                  <div className="bg-[#F0FAF0] border border-[#B8E0B8] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#1A7A1A] font-sans uppercase tracking-wide mb-3">
                      ✓ Media links attached to this quotation
                    </p>
                    <div className="flex flex-col gap-2">
                      {draft.carDriveLink && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#666] font-sans w-20">Photos:</span>
                          <a href={draft.carDriveLink} target="_blank" rel="noreferrer"
                            className="text-[11px] text-[#0055CC] font-sans hover:underline flex items-center gap-1 truncate">
                            Google Drive <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                      {draft.carReelLinks.map((reel, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-[#666] font-sans w-20">Reel {i + 1}:</span>
                          <a href={reel} target="_blank" rel="noreferrer"
                            className="text-[11px] text-[#0055CC] font-sans hover:underline flex items-center gap-1 truncate">
                            Instagram <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vehicle year (optional) */}
                <Field label="Vehicle Year (optional)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g., 2022"
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    value={draft.vehicleYear}
                    onChange={(e) => updateDraft({ vehicleYear: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </StepCard>
        )}

        {/* ── STEP 3: Line Items ── */}
        {step === 3 && (
          <StepCard title="Items & Pricing" subtitle="Add parts, CNG kit components, and labour charges">
            <div className="flex flex-col gap-4">
              {errors.lineItems && (
                <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-lg px-4 py-3">
                  <AlertTriangle size={15} className="text-[#CC0000] flex-shrink-0" />
                  <p className="text-sm text-[#CC0000] font-sans">{errors.lineItems}</p>
                </div>
              )}

              {/* Column headers (desktop hint) */}
              <div className="hidden sm:grid grid-cols-[1fr_80px_100px_40px] gap-2 px-1">
                <span className="text-[11px] text-[#888] font-sans font-semibold">Description</span>
                <span className="text-[11px] text-[#888] font-sans font-semibold text-center">Qty</span>
                <span className="text-[11px] text-[#888] font-sans font-semibold text-right">Unit Price (₹)</span>
                <span />
              </div>

              {/* Line items */}
              {draft.lineItems.map((item, i) => (
                <div key={item.id}
                  className="bg-white rounded-xl border border-[#E8E2DF] overflow-hidden shadow-sm">
                  <div className="p-3 flex flex-col sm:grid sm:grid-cols-[1fr_80px_100px_40px] gap-2 items-start sm:items-center">
                    <input
                      placeholder={`Item ${i + 1} — e.g., CNG Kit Type 4`}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-sans
                        bg-[#FAFAFA] text-[#222] placeholder-[#BBB] outline-none
                        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full h-10 px-2 rounded-lg border border-[#E8E2DF] text-sm font-sans
                        text-center bg-[#FAFAFA] text-[#222] outline-none
                        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                    />
                    <div className="relative w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA] text-sm font-sans">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="0"
                        value={item.unitPrice || ""}
                        onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className={`w-full h-10 pl-6 pr-2 rounded-lg border text-sm font-mono
                          text-right bg-[#FAFAFA] text-[#222] outline-none
                          focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                          ${errors[`item_${i}_price`] ? "border-[#CC0000]" : "border-[#E8E2DF]"}`}
                      />
                    </div>
                    <button
                      onClick={() => { if (draft.lineItems.length > 1) removeLineItem(item.id); }}
                      disabled={draft.lineItems.length === 1}
                      className="w-10 h-10 rounded-lg flex items-center justify-center
                        text-[#CCC] hover:text-[#CC0000] hover:bg-[#FFEBEE] transition-colors
                        disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Row total */}
                  {item.description.trim() && (
                    <div className="px-3 pb-2 flex justify-end">
                      <span className="text-xs text-[#888] font-mono">
                        {item.quantity} × {formatINR(item.unitPrice)} ={" "}
                        <span className="text-[#333] font-semibold">
                          {formatINR(item.quantity * item.unitPrice)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Add item button */}
              <button
                onClick={addLineItem}
                className="w-full h-11 rounded-xl border-2 border-dashed border-[#CDCBC9]
                  flex items-center justify-center gap-2 text-sm text-[#888] font-sans
                  hover:border-[#8B3A3A] hover:text-[#661F1F] hover:bg-white transition-all"
              >
                <Plus size={16} />
                Add another item
              </button>

              {/* Labour Cost */}
              <div className="bg-[#FDF8F8] border border-[#E8D8D8] rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#661F1F] font-sans">Labour / Installation Charges</p>
                    <p className="text-xs text-[#888] font-sans mt-0.5">Appears as a separate line on the PDF</p>
                  </div>
                  <div className="relative w-36 flex-shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA] text-sm font-sans">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="0"
                      value={draft.labourCost || ""}
                      onChange={(e) => updateDraft({ labourCost: parseFloat(e.target.value) || 0 })}
                      className="w-full h-11 pl-7 pr-2 rounded-lg border border-[#E8D8D8] text-sm font-mono
                        text-right bg-white text-[#222] outline-none
                        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                    />
                  </div>
                </div>
              </div>

              {/* Subtotal bar */}
              <div className="bg-[#661F1F] rounded-xl px-5 py-4 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[#F0BABA] text-[10px] font-sans uppercase tracking-widest">Total Quotation Amount</p>
                  <p className="text-white text-2xl font-bold font-mono mt-0.5">
                    {formatINR(subtotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#F0BABA] text-[10px] font-sans">
                    {draft.lineItems.length} item{draft.lineItems.length !== 1 ? "s" : ""} + labour
                  </p>
                  <p className="text-[#FFD0D0] text-xs font-sans mt-1">Excl. GST</p>
                </div>
              </div>

              {/* Notes (optional) */}
              <Field label="Internal Notes (optional)"
                hint="Not printed on PDF — for your reference only">
                <textarea
                  rows={3}
                  placeholder="Add any internal notes about this quotation…"
                  value={draft.notes}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2DF] text-sm font-sans
                    bg-white text-[#222] placeholder-[#AAA] outline-none resize-none
                    focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                />
              </Field>
            </div>
          </StepCard>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <StepCard title="Review Quotation" subtitle="Confirm all details before saving">
            <div className="flex flex-col gap-4">
              {/* Summary card */}
              <ReviewRow label="Customer"     value={draft.customerName} />
              <ReviewRow label="Phone"        value={`+91 ${draft.customerPhone}`} />
              <ReviewRow
                label="Vehicle"
                value={draft.isManualVehicle
                  ? `${draft.notInListCompany} ${draft.notInListModel} (manual entry)`
                  : `${draft.vehicleCompany} ${draft.vehicleModel}`}
              />
              {draft.vehicleYear && <ReviewRow label="Year" value={draft.vehicleYear} />}

              {/* Media links summary */}
              {!draft.isManualVehicle && (draft.carDriveLink || draft.carReelLinks.length > 0) && (
                <div className="bg-[#F0FAF0] border border-[#B8E0B8] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#1A7A1A] font-sans mb-1">
                    ✓ Car media links will be included in PDF
                  </p>
                  <p className="text-xs text-[#666] font-sans">
                    {draft.carDriveLink ? "1 Google Drive photo link" : ""}
                    {draft.carDriveLink && draft.carReelLinks.length > 0 ? " + " : ""}
                    {draft.carReelLinks.length > 0 ? `${draft.carReelLinks.length} Instagram reel${draft.carReelLinks.length > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
              )}

              {/* Manual vehicle warning */}
              {draft.isManualVehicle && (
                <div className="bg-[#FFF8E0] border border-[#FFD166] rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#7A4400] font-sans">
                    SuperAdmin will be notified to add <strong>{draft.notInListCompany} {draft.notInListModel}</strong> to the Car Repository.
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="bg-white border border-[#E8E2DF] rounded-xl overflow-hidden">
                <div className="bg-[#F5F0EE] px-4 py-2 border-b border-[#E8E2DF]">
                  <p className="text-xs font-semibold text-[#661F1F] font-sans uppercase tracking-wide">Line Items</p>
                </div>
                <div className="divide-y divide-[#F0EBE8]">
                  {draft.lineItems.filter(i => i.description.trim()).map((item, i) => (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-[#222] font-sans">{item.description}</p>
                        <p className="text-xs text-[#888] font-sans">
                          {item.quantity} × {formatINR(item.unitPrice)}
                        </p>
                      </div>
                      <p className="text-sm font-mono font-semibold text-[#333] flex-shrink-0">
                        {formatINR(item.quantity * item.unitPrice)}
                      </p>
                    </div>
                  ))}
                  {Number(draft.labourCost) > 0 && (
                    <div className="px-4 py-3 flex items-center justify-between gap-2 bg-[#FDF8F8]">
                      <p className="text-sm text-[#661F1F] font-semibold font-sans">Labour / Installation</p>
                      <p className="text-sm font-mono font-semibold text-[#661F1F]">{formatINR(draft.labourCost)}</p>
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 bg-[#661F1F] flex items-center justify-between">
                  <p className="text-[#F0BABA] text-xs font-sans uppercase tracking-wide font-semibold">Total</p>
                  <p className="text-white text-lg font-mono font-bold">{formatINR(subtotal)}</p>
                </div>
              </div>

              {/* Error */}
              {saveError && (
                <div className="flex items-center gap-2 bg-[#FFEBEE] border border-[#F0B8B8] rounded-lg px-4 py-3">
                  <AlertTriangle size={15} className="text-[#CC0000] flex-shrink-0" />
                  <p className="text-sm text-[#CC0000] font-sans">{saveError}</p>
                </div>
              )}

              {/* What happens next */}
              <div className="bg-[#F5F0EE] rounded-xl p-4 border border-[#E8E2DF]">
                <p className="text-xs font-semibold text-[#661F1F] font-sans uppercase tracking-wide mb-2">What happens next</p>
                <ul className="flex flex-col gap-1.5">
                  {[
                    "Quotation is saved with a sequential number (QT-YYYY-NNN)",
                    "You can generate a PDF and preview it immediately",
                    "Send via WhatsApp with one tap",
                    "Quotation does NOT affect inventory — it is for pricing only",
                  ].map((txt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#661F1F] text-sm mt-0.5 flex-shrink-0">›</span>
                      <p className="text-xs text-[#555] font-sans">{txt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </StepCard>
        )}

        {/* ── Navigation Buttons ── */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={goBack}
              disabled={isSaving}
              className="flex-1 h-12 rounded-xl border-2 border-[#661F1F] text-[#661F1F]
                font-semibold font-sans text-sm hover:bg-[#FDF0F0] transition-colors
                disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          {step < 4 && (
            <button
              onClick={goNext}
              className="flex-1 h-12 rounded-xl bg-[#661F1F] text-white font-semibold font-sans text-sm
                hover:bg-[#8B3A3A] active:bg-[#5A1515] transition-colors shadow-lg shadow-[#661F1F]/25
                flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={16} />
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 h-12 rounded-xl bg-[#661F1F] text-white font-bold font-sans text-sm
                hover:bg-[#8B3A3A] transition-colors shadow-lg shadow-[#661F1F]/25
                flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving…</>
              ) : (
                <><Check size={16} /> Save Quotation</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

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
      <span className="text-xs text-[#888] font-sans w-20 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#222] font-sans font-semibold flex-1">{value || "—"}</span>
    </div>
  );
}
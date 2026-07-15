// SGA — Last updated: New file — Edit Quotation form. Allows Owner/SuperAdmin to edit
// Phone Number, Vehicle (Company + Model + Year), and Items on an existing quotation.
// Resets pdfUrl after saving so the PDF is regenerated on the next view.
// src/pages/quotations/EditQuotationForm.jsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Check, Loader2, Car, X, ChevronDown,
  AlertTriangle, Plus, Trash2,
} from "lucide-react";
import {
  fetchQuotationById, fetchCarRepository, updateQuotation,
  EMISSION_CATEGORIES,
} from "../../lib/quotationService";
import { useAuth } from "../../hooks/useAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

function Field({ label, required, optional, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium font-sans text-[#444] tracking-wide flex items-center gap-1.5">
        {label}
        {required && <span className="text-[#CC0000]">*</span>}
        {optional && <span className="text-[#AAA] text-[10px] font-normal">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-[#CC0000] font-sans">{error}</p>}
    </div>
  );
}

function Input({ error, className = "", ...props }) {
  return (
    <input
      className={`w-full h-11 px-3 rounded-lg border text-sm font-sans bg-white
        text-[#222] placeholder-[#AAA] outline-none transition-all
        focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
        ${error ? "border-[#CC0000]" : "border-[#E8E2DF]"} ${className}`}
      {...props}
    />
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2DF] overflow-hidden mb-4">
      <div className="bg-[#F5F0EE] px-5 py-4 border-b border-[#E8E2DF]">
        <h2 className="text-base font-bold text-[#222]">{title}</h2>
        {subtitle && <p className="text-xs text-[#888] font-sans mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EditQuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { uid, displayName, email } = useAuth();

  // ── Load state ──────────────────────────────────────────────────────────────
  const [isLoading,  setIsLoading]  = useState(true);
  const [loadError,  setLoadError]  = useState(null);
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveError,  setSaveError]  = useState(null);
  const [quotation,  setQuotation]  = useState(null);

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [customerPhone,     setCustomerPhone]     = useState("");
  const [vehicleCompany,    setVehicleCompany]    = useState("");
  const [vehicleModel,      setVehicleModel]      = useState("");
  const [vehicleYear,       setVehicleYear]       = useState("");
  const [isManualVehicle,   setIsManualVehicle]   = useState(false);
  const [notInListCompany,  setNotInListCompany]  = useState("");
  const [notInListModel,    setNotInListModel]    = useState("");
  // Items: [{id, description, quantity, unitPrice}]
  const [items,             setItems]             = useState([]);
  const [labourCost,        setLabourCost]        = useState(0);
  const [emissionCategory,  setEmissionCategory]  = useState("BS6_4INJ");

  // ── Car repo ────────────────────────────────────────────────────────────────
  const [carRepo,            setCarRepo]            = useState([]);
  const [selectedCompany,    setSelectedCompany]    = useState(null);
  const [carRepoLoading,     setCarRepoLoading]     = useState(true);

  // ── Validation errors ────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  // ── Load quotation + car repo ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [q, repo] = await Promise.all([
          fetchQuotationById(id),
          fetchCarRepository(),
        ]);
        if (!q) throw new Error("Quotation not found.");
        setQuotation(q);
        setCarRepo(repo);

        // Pre-fill form from stored quotation data
        setCustomerPhone(q.customerPhone?.replace(/\D/g, "") || "");
        setVehicleCompany(q.isManualVehicle ? "__not_in_list__" : (q.vehicleCompany || ""));
        setVehicleModel(q.vehicleModel || "");
        setVehicleYear(q.vehicleYear || "");
        setIsManualVehicle(!!q.isManualVehicle);
        setNotInListCompany(q.notInListCompany || q.vehicleCompany || "");
        setNotInListModel(q.notInListModel || q.vehicleModel || "");
        setLabourCost(Number(q.labourCost) || 0);
        setEmissionCategory(q.emissionCategory || "BS6_4INJ");

        // Pre-fill selected company data for model picker
        if (!q.isManualVehicle && q.vehicleCompany) {
          setSelectedCompany(repo.find((c) => c.name === q.vehicleCompany) || null);
        }

        // Convert lineItems to editable format
        const editableItems = (q.lineItems || [])
          .filter((li) => li.itemType !== "labour")
          .map((li, idx) => ({
            id:          li.itemId || `item-${idx}`,
            description: li.description || "",
            quantity:    li.quantity    || 1,
            unitPrice:   li.unitPrice   || 0,
          }));
        setItems(editableItems);

      } catch (e) {
        setLoadError(e.message || "Failed to load quotation.");
      } finally {
        setIsLoading(false);
        setCarRepoLoading(false);
      }
    })();
  }, [id]);

  // ── Item helpers ─────────────────────────────────────────────────────────────
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (itemId) =>
    setItems((prev) => prev.filter((i) => i.id !== itemId));

  const updateItem = (itemId, field, value) =>
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i))
    );

  // ── Company select ───────────────────────────────────────────────────────────
  const handleCompanyChange = (company) => {
    if (company === "__not_in_list__") {
      setVehicleCompany("__not_in_list__");
      setIsManualVehicle(true);
      setVehicleModel("");
      setSelectedCompany(null);
    } else {
      setVehicleCompany(company);
      setIsManualVehicle(false);
      setVehicleModel("");
      setSelectedCompany(carRepo.find((c) => c.name === company) || null);
    }
    setErrors((p) => ({ ...p, vehicleCompany: undefined, vehicleModel: undefined }));
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (customerPhone && customerPhone.replace(/\D/g, "").length !== 10) {
      e.customerPhone = "Phone number must be 10 digits";
    }
    if (!vehicleCompany) {
      e.vehicleCompany = "Please select a vehicle company";
    } else if (vehicleCompany === "__not_in_list__") {
      if (!notInListCompany.trim()) e.notInListCompany = "Enter vehicle company name";
      if (!notInListModel.trim())   e.notInListModel   = "Enter vehicle model name";
    } else if (!vehicleModel) {
      e.vehicleModel = "Please select a vehicle model";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    if (!uid) { setSaveError("Session expired. Please log in again."); return; }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Build lineItems from the edited items array
      const lineItems = items
        .filter((item) => item.description.trim())
        .map((item) => ({
          itemId:      item.id,
          description: item.description.trim(),
          quantity:    Number(item.quantity) || 1,
          unitPrice:   Number(item.unitPrice) || 0,
          total:       (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
          sectionKey:  "custom",
          itemType:    "item",
        }));

      // Add labour as a lineItem if present
      if (Number(labourCost) > 0) {
        lineItems.push({
          itemId:      "labour",
          description: "Labour / Installation Charges",
          quantity:    1,
          unitPrice:   Number(labourCost),
          total:       Number(labourCost),
          sectionKey:  "labour",
          itemType:    "labour",
        });
      }

      const updates = {
        customerPhone:    customerPhone ? `+91 ${customerPhone.replace(/\D/g, "")}` : "",
        vehicleCompany:   isManualVehicle ? notInListCompany.trim() : vehicleCompany,
        vehicleModel:     isManualVehicle ? notInListModel.trim()   : vehicleModel,
        vehicleYear:      vehicleYear,
        isManualVehicle,
        notInListCompany: isManualVehicle ? notInListCompany.trim() : "",
        notInListModel:   isManualVehicle ? notInListModel.trim()   : "",
        emissionCategory,
        labourCost:       Number(labourCost),
        lineItems,
        // Recalculate car media links from repo
        carDriveLink:  (!isManualVehicle && selectedCompany?.models?.find((m) => m.name === vehicleModel)?.driveLink) || quotation.carDriveLink || "",
        carReelLinks:  (!isManualVehicle && selectedCompany?.models?.find((m) => m.name === vehicleModel)?.reelLinks) || quotation.carReelLinks || [],
      };

      await updateQuotation(id, updates, uid, displayName || email || "Unknown");
      navigate(`/quotations/${id}`, { state: { updated: true } });
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#CDCBC9] flex items-center justify-center">
        <Loader2 size={28} className="text-[#661F1F] animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#CDCBC9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg border border-[#E8E2DF]">
          <AlertTriangle size={36} className="text-[#CC0000] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#222] mb-2">Unable to Load</h2>
          <p className="text-sm text-[#888] font-sans mb-6">{loadError}</p>
          <button onClick={() => navigate(`/quotations/${id}`)}
            className="w-full h-11 rounded-xl bg-[#661F1F] text-white font-semibold font-sans text-sm">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Render: form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/quotations/${id}`)}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">Edit</p>
            <h1 className="text-white text-lg font-bold leading-tight font-mono">
              {quotation?.quotationNumber}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* ── 1. Phone Number ─────────────────────────────────────────── */}
        <SectionCard
          title="Customer Phone"
          subtitle="Update the WhatsApp number for this quotation"
        >
          <Field label="WhatsApp Number" optional error={errors.customerPhone}>
            <div className="flex gap-2">
              <div className="h-11 px-3 rounded-lg border border-[#E8E2DF] bg-[#F5F0EE] flex items-center text-sm text-[#666] font-sans flex-shrink-0">
                +91
              </div>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210 (optional)"
                maxLength={10}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                error={errors.customerPhone}
              />
            </div>
          </Field>
        </SectionCard>

        {/* ── 2. Vehicle ──────────────────────────────────────────────── */}
        <SectionCard
          title="Vehicle Details"
          subtitle="Update vehicle company, model, and year"
        >
          <div className="flex flex-col gap-5">
            {/* Company selector */}
            <Field label="Vehicle Company" required error={errors.vehicleCompany}>
              <div className="relative">
                <select
                  value={vehicleCompany}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className={`w-full h-11 px-3 pr-9 rounded-lg border text-sm font-sans bg-white text-[#222]
                    outline-none appearance-none transition-all
                    focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10
                    ${errors.vehicleCompany ? "border-[#CC0000]" : "border-[#E8E2DF]"}
                    ${!vehicleCompany ? "text-[#AAA]" : ""}`}
                >
                  <option value="">Select vehicle company…</option>
                  {carRepo.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__not_in_list__">⚠ Not in list (enter manually)</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] pointer-events-none" />
              </div>
            </Field>

            {/* Manual entry */}
            {vehicleCompany === "__not_in_list__" && (
              <div className="bg-[#FFF8E0] border border-[#FFD166] rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#7A4400] font-sans">SuperAdmin will be notified to add this model.</p>
                </div>
                <Field label="Vehicle Company Name" required error={errors.notInListCompany}>
                  <Input
                    placeholder="e.g., Tata Motors"
                    value={notInListCompany}
                    onChange={(e) => setNotInListCompany(e.target.value)}
                    error={errors.notInListCompany}
                  />
                </Field>
                <Field label="Vehicle Model Name" required error={errors.notInListModel}>
                  <Input
                    placeholder="e.g., Nexon 2024"
                    value={notInListModel}
                    onChange={(e) => setNotInListModel(e.target.value)}
                    error={errors.notInListModel}
                  />
                </Field>
              </div>
            )}

            {/* Model picker */}
            {vehicleCompany && vehicleCompany !== "__not_in_list__" && selectedCompany && (
              <Field label="Vehicle Model" required error={errors.vehicleModel}>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                  {(selectedCompany.models || []).map((model, i) => {
                    const isSelected = vehicleModel === model.name;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setVehicleModel(model.name);
                          setErrors((p) => ({ ...p, vehicleModel: undefined }));
                        }}
                        className={`w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3
                          ${isSelected
                            ? "border-[#661F1F] bg-[#FDF0F0] shadow-md"
                            : "border-[#E8E2DF] bg-white hover:border-[#8B3A3A]"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <Car size={16} className={isSelected ? "text-[#661F1F]" : "text-[#AAA]"} />
                          <span className={`text-sm font-sans font-semibold ${isSelected ? "text-[#661F1F]" : "text-[#333]"}`}>
                            {model.name}
                          </span>
                        </div>
                        {isSelected && <Check size={16} className="text-[#661F1F]" />}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Year */}
            <Field label="Vehicle Year" optional>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g., 2022"
                min={1990}
                max={new Date().getFullYear() + 1}
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
              />
            </Field>

            {/* Emission Category */}
            <Field label="Emission Category" optional>
              <div className="flex gap-2 flex-wrap">
                {EMISSION_CATEGORIES.map(({ id: catId, label }) => (
                  <button
                    key={catId}
                    onClick={() => setEmissionCategory(catId)}
                    className={`flex-1 min-w-[80px] py-2.5 px-3 rounded-xl border text-xs font-bold font-sans
                      transition-all whitespace-nowrap
                      ${emissionCategory === catId
                        ? "bg-[#661F1F] text-white border-[#661F1F] shadow-md"
                        : "bg-white text-[#555] border-[#E8E2DF] hover:border-[#8B3A3A] hover:text-[#661F1F]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* ── 3. Items ─────────────────────────────────────────────────── */}
        <SectionCard
          title="Items"
          subtitle="Edit item names and prices. Add or remove items as needed."
        >
          <div className="flex flex-col gap-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-[#F5F0EE] rounded-xl border border-[#E8E2DF] p-3 flex flex-col gap-2"
              >
                {/* Item header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#888] font-sans uppercase tracking-wide">
                    Item {idx + 1}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[#CC0000] hover:text-[#AA0000] transition-colors p-1"
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Description */}
                <input
                  type="text"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-sans bg-white
                    text-[#222] placeholder-[#AAA] outline-none
                    focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
                />
                {/* Qty + Price */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-[#888] font-sans mb-1 block">Qty</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-mono bg-white
                        text-[#222] outline-none focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10 text-center"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] text-[#888] font-sans mb-1 block">Unit Price (₹)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E8E2DF] text-sm font-mono bg-white
                        text-[#222] outline-none focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10 text-right"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] text-[#888] font-sans mb-1 block">Total</label>
                    <div className="h-10 px-3 rounded-lg border border-[#E8E2DF] bg-[#F5F0EE] flex items-center justify-end">
                      <span className="text-sm font-mono font-semibold text-[#661F1F]">
                        {formatINR((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add item */}
            <button
              onClick={addItem}
              className="w-full h-11 rounded-xl border-2 border-dashed border-[#CDCBC9]
                text-[#888] font-sans text-sm font-semibold
                hover:border-[#8B3A3A] hover:text-[#661F1F] transition-colors
                flex items-center justify-center gap-2"
            >
              <Plus size={15} /> Add Item
            </button>
          </div>

          {/* Labour */}
          <div className="mt-5 bg-[#FDF8F8] border border-[#E8D8D8] rounded-xl p-4">
            <p className="text-sm font-bold text-[#661F1F] mb-3">Labour / Installation Charges</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA] text-sm font-sans">₹</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={labourCost || ""}
                onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                className="w-full h-11 pl-7 pr-3 rounded-xl border border-[#E8E2DF] text-sm font-mono
                  text-right bg-[#FAFAFA] text-[#222] outline-none
                  focus:border-[#661F1F] focus:ring-2 focus:ring-[#661F1F]/10"
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Note about PDF ────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 bg-[#FFF8E0] border border-[#FFD166] rounded-xl px-4 py-3 mb-6">
          <AlertTriangle size={14} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#7A4400] font-sans">
            Saving will reset the stored PDF. You will need to regenerate and download the PDF again from the quotation detail screen.
          </p>
        </div>

        {/* ── Error ────────────────────────────────────────────────────── */}
        {saveError && (
          <div className="flex items-start gap-2 bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl px-4 py-3 mb-6">
            <AlertTriangle size={14} className="text-[#CC0000] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#CC0000] font-sans">{saveError}</p>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/quotations/${id}`)}
            disabled={isSaving}
            className="flex-1 h-12 rounded-xl border-2 border-[#661F1F] text-[#661F1F]
              font-semibold font-sans text-sm hover:bg-[#FDF0F0] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-12 rounded-xl bg-[#661F1F] text-white font-bold font-sans text-sm
              hover:bg-[#8B3A3A] transition-colors shadow-lg shadow-[#661F1F]/25
              flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving…</>
            ) : (
              <><Check size={16} /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

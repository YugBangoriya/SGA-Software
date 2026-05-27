// SGA — Last updated: New file — Return Invoice creation wizard (RET_INV format, items re-added to inventory on approval)
// ============================================================
// CreateReturnInvoice.jsx — Return Invoice Creation (4 Steps)
// Shree Ganesh Automobile
// ============================================================
// Steps: 1) Select Customer  2) Select Return Items + Prices
//        3) Payment/Return Amount  4) Review & Submit
// Key differences from normal invoice:
//   - No labour step
//   - Items are ADDED BACK to inventory on approval (not deducted)
//   - Price fields: original paid price + actual return amount (can differ)
//   - Invoice format: RET_INV-YYYY-NNNN
//   - Payment = amount returned TO customer (not received from customer)

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Package, CreditCard, CheckCircle, ArrowLeft, ArrowRight, X,
  Search, Plus, Minus, Trash2, AlertTriangle,
} from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import useInvoiceStore from "../../store/invoiceStore";
import useAuthStore from "../../store/authStore";
import useThemeStore from "../../store/themeStore";
import InvoiceStepCustomer from "../../components/invoices/InvoiceStepCustomer";
import DBLockedBanner from "../../components/invoices/DBLockedBanner";
import { formatCurrency, RETURN_PAYMENT_METHODS } from "../../lib/invoiceHelpers";

const STEPS = [
  { id: 1, label: "Customer", icon: User, description: "Select customer" },
  { id: 2, label: "Items", icon: Package, description: "Select return items" },
  { id: 3, label: "Payment", icon: CreditCard, description: "Return payment" },
  { id: 4, label: "Review", icon: CheckCircle, description: "Review & submit" },
];

const DEFAULT_FORM = {
  customerId: null,
  customerSnapshot: null,
  vehicleSnapshot: null,
  returnItems: [],   // { inventoryItemId, name, quantity, originalPrice, returnPrice }
  returnDate: new Date().toISOString().split("T")[0],
  paymentMethod: "CASH",
  totalReturnAmount: 0,
  paymentNote: "",
  invoiceType: "RETURN",
};

// ── Step 2: Select Return Items ────────────────────────────────────────────
function ReturnItemsStep({ data, onChange, darkMode }) {
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const returnItems = data.returnItems || [];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "inventory"), orderBy("itemName", "asc"));
        const snap = await getDocs(q);
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Inventory load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredInventory = inventory.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.itemName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  const addItem = (invItem) => {
    const already = returnItems.find((i) => i.inventoryItemId === invItem.id);
    if (already) return;
    const newItems = [
      ...returnItems,
      {
        inventoryItemId: invItem.id,
        name: invItem.itemName,
        quantity: 1,
        originalPrice: "",   // customer originally paid — manual entry
        returnPrice: "",     // actual return amount — manual entry
      },
    ];
    onChange({ returnItems: newItems, totalReturnAmount: computeTotal(newItems) });
    setShowPicker(false);
    setSearch("");
  };

  const removeItem = (idx) => {
    const newItems = returnItems.filter((_, i) => i !== idx);
    onChange({ returnItems: newItems, totalReturnAmount: computeTotal(newItems) });
  };

  const updateItem = (idx, field, value) => {
    const newItems = returnItems.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    onChange({ returnItems: newItems, totalReturnAmount: computeTotal(newItems) });
  };

  const computeTotal = (items) => {
    return items.reduce((sum, item) => {
      const qty = parseInt(item.quantity || 0, 10);
      const price = parseFloat(item.returnPrice || 0);
      return sum + qty * price;
    }, 0);
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px",
    border: `1.5px solid ${border}`, borderRadius: 8,
    background: inputBg, color: textPrimary,
    fontSize: 13, outline: "none",
    fontFamily: "'Courier New', monospace",
    boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Select items being returned. For each item, enter the price the customer originally paid and the amount you are refunding back.
      </div>

      {/* Added items list */}
      {returnItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {returnItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: cardBg,
                border: `1.5px solid ${border}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 10,
              }}
            >
              {/* Item name + remove */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                  {item.name}
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#CC0000", padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Quantity */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  Quantity
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => updateItem(idx, "quantity", Math.max(1, (item.quantity || 1) - 1))}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${border}`, background: inputBg, color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 700, color: textPrimary, fontFamily: "'Courier New', monospace", minWidth: 24, textAlign: "center" }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateItem(idx, "quantity", (item.quantity || 1) + 1)}
                    style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${border}`, background: inputBg, color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Original price + return price */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Original Price Paid *
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: textSecondary, fontSize: 13, pointerEvents: "none" }}>₹</span>
                    <input
                      type="number" min={0} step={0.01}
                      placeholder="Original price"
                      value={item.originalPrice}
                      onChange={(e) => updateItem(idx, "originalPrice", e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 22 }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#CC6600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
                    Return Amount *
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#CC6600", fontSize: 13, pointerEvents: "none" }}>₹</span>
                    <input
                      type="number" min={0} step={0.01}
                      placeholder="Amount to return"
                      value={item.returnPrice}
                      onChange={(e) => updateItem(idx, "returnPrice", e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 22, borderColor: "#CC6600" }}
                    />
                  </div>
                </div>
              </div>

              {/* Per-item return total */}
              {item.returnPrice && parseFloat(item.returnPrice) > 0 && (
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: 12, color: "#CC6600", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
                    Return: {formatCurrency(parseFloat(item.returnPrice) * (item.quantity || 1))}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Total return amount */}
          <div
            style={{
              background: "#FFF3E0",
              border: "1.5px solid #FFB74D",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#CC6600" }}>Total Return Amount</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#CC6600", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(computeTotal(returnItems))}
            </span>
          </div>
        </div>
      )}

      {/* Add item button */}
      <button
        onClick={() => setShowPicker(true)}
        style={{
          width: "100%", padding: "12px 0",
          background: "none", border: `2px dashed ${border}`,
          borderRadius: 10, color: "#661F1F", fontWeight: 600, fontSize: 14,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, fontFamily: "inherit",
        }}
      >
        <Plus size={16} /> Add Return Item
      </button>

      {/* Item picker modal */}
      {showPicker && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 200 }}
          onClick={() => { setShowPicker(false); setSearch(""); }}
        >
          <div
            style={{
              background: isDark ? "#1A1A1A" : "#FFFFFF",
              borderRadius: "16px 16px 0 0",
              padding: "20px 16px",
              width: "100%",
              maxHeight: "70vh",
              overflow: "auto",
              maxWidth: 640,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>Select Item to Return</span>
              <button onClick={() => { setShowPicker(false); setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search size={14} color={textSecondary} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text" autoFocus
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "10px 10px 10px 32px",
                  border: `1.5px solid ${border}`, borderRadius: 8,
                  background: isDark ? "#2A2A2A" : "#F5F0EE",
                  color: textPrimary, fontSize: 13, outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
            {loading ? (
              <div style={{ textAlign: "center", color: textSecondary, padding: 20 }}>Loading...</div>
            ) : filteredInventory.length === 0 ? (
              <div style={{ textAlign: "center", color: textSecondary, padding: 20 }}>No items found</div>
            ) : (
              filteredInventory.map((invItem) => {
                const alreadyAdded = returnItems.some((i) => i.inventoryItemId === invItem.id);
                return (
                  <div
                    key={invItem.id}
                    onClick={() => !alreadyAdded && addItem(invItem)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                      border: `1.5px solid ${alreadyAdded ? border : "#661F1F"}`,
                      background: alreadyAdded ? cardBg : (isDark ? "#2A2A2A" : "#FDF8F8"),
                      cursor: alreadyAdded ? "not-allowed" : "pointer",
                      opacity: alreadyAdded ? 0.5 : 1,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{invItem.itemName}</div>
                      <div style={{ fontSize: 11, color: textSecondary }}>Stock: {invItem.quantity}</div>
                    </div>
                    {alreadyAdded ? (
                      <span style={{ fontSize: 11, color: textSecondary }}>Added</span>
                    ) : (
                      <Plus size={16} color="#661F1F" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Return Payment ─────────────────────────────────────────────────
function ReturnPaymentStep({ data, onChange, darkMode }) {
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#2A2A2A" : "#FFFFFF";

  const totalReturnAmount = parseFloat(data.totalReturnAmount || 0);
  const paymentMethod = data.paymentMethod || "CASH";

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    border: `1.5px solid ${border}`, borderRadius: 8,
    background: inputBg, color: textPrimary,
    fontSize: 14, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: textSecondary,
    display: "block", marginBottom: 5,
    textTransform: "uppercase", letterSpacing: 0.4,
    fontFamily: "Arial, sans-serif",
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
        Record how the return amount was paid back to the customer.
      </div>

      {/* Return total summary */}
      <div
        style={{
          background: "#FFF3E0",
          border: "1.5px solid #FFB74D",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 18,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#CC6600" }}>Total Return Amount</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#CC6600", fontFamily: "'Courier New', monospace" }}>
          {formatCurrency(totalReturnAmount)}
        </span>
      </div>

      {/* Return date */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Return Date</label>
        <input
          type="date"
          value={data.returnDate || new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange({ returnDate: e.target.value })}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
      </div>

      {/* Payment method for refund */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Refund Method *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {RETURN_PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => onChange({ paymentMethod: m.value })}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: `1.5px solid ${paymentMethod === m.value ? "#661F1F" : border}`,
                background: paymentMethod === m.value ? "#661F1F" : inputBg,
                color: paymentMethod === m.value ? "#FFFFFF" : textPrimary,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment note */}
      <div>
        <label style={labelStyle}>Note (optional)</label>
        <input
          placeholder="e.g. Cash returned to customer, UPI refund ref..."
          value={data.paymentNote || ""}
          onChange={(e) => onChange({ paymentNote: e.target.value })}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
      </div>
    </div>
  );
}

// ── Step 4: Review ─────────────────────────────────────────────────────────
function ReturnReviewStep({ data, darkMode }) {
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const sectionBg = isDark ? "#1A1A1A" : "#F5F0EE";

  const customer = data.customerSnapshot || {};
  const returnItems = data.returnItems || [];
  const totalReturnAmount = parseFloat(data.totalReturnAmount || 0);

  const Section = ({ title, children }) => (
    <div style={{ background: sectionBg, borderRadius: 10, padding: "14px 16px", marginBottom: 12, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#661F1F", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Arial, sans-serif", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${border}` }}>
        {title}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, mono, amber }) => (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: amber ? "#CC6600" : textPrimary, fontFamily: mono ? "'Courier New', monospace" : "inherit" }}>{value}</span>
    </div>
  );

  return (
    <div>
      <div style={{ background: "#FFF3E0", border: "1.5px solid #FFB74D", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertTriangle size={18} color="#CC6600" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#CC6600" }}>Return Invoice — Pending Approval</div>
          <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
            On approval, all selected items will be <strong>added back</strong> to inventory stock.
          </div>
        </div>
      </div>

      <Section title="Customer">
        <Row label="Name" value={customer.name || "—"} />
        <Row label="Phone" value={customer.phone || "—"} />
      </Section>

      <Section title={`Return Items (${returnItems.length})`}>
        {returnItems.map((item, idx) => (
          <div key={idx} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: idx < returnItems.length - 1 ? `1px solid ${border}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{item.name}</div>
              <span style={{ fontSize: 12, color: "#CC6600", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
                {formatCurrency(parseFloat(item.returnPrice || 0) * (item.quantity || 1))}
              </span>
            </div>
            <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
              Qty: {item.quantity} · Originally paid: {formatCurrency(item.originalPrice)} · Returning: {formatCurrency(item.returnPrice)} each
            </div>
          </div>
        ))}
      </Section>

      <Section title="Return Payment">
        <Row label="Total Return Amount" value={formatCurrency(totalReturnAmount)} mono amber />
        <Row label="Refund Method" value={data.paymentMethod || "—"} />
        <Row label="Return Date" value={data.returnDate || "—"} />
        {data.paymentNote && <Row label="Note" value={data.paymentNote} />}
      </Section>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CreateReturnInvoice() {
  const navigate = useNavigate();
  const { firebaseUser: currentUser } = useAuthStore();
  const { theme } = useThemeStore();
  const { createReturnInvoice, dbLocked, dbLockedBy, loading, error, clearError } = useInvoiceStore();
  const isDark = theme === "dark";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => { clearError(); }, []);

  const bg = isDark ? "#1A1A1A" : "#CDCBC9";
  const cardBg = isDark ? "#2A2A2A" : "#FFFFFF";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  const updateForm = (updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const canAdvance = () => {
    if (step === 1) return !!form.customerId;
    if (step === 2) {
      const items = form.returnItems || [];
      if (items.length === 0) return false;
      return items.every((i) => i.returnPrice !== "" && parseFloat(i.returnPrice) >= 0);
    }
    if (step === 3) return !!form.paymentMethod;
    return true;
  };

  const handleSubmit = async () => {
    if (!currentUser) { setSubmitError("Authentication error."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const invoiceId = await createReturnInvoice(form, currentUser);
      navigate(`/invoices/${invoiceId}?created=true`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <InvoiceStepCustomer data={form} onChange={updateForm} darkMode={isDark} />;
      case 2: return <ReturnItemsStep data={form} onChange={updateForm} darkMode={isDark} />;
      case 3: return <ReturnPaymentStep data={form} onChange={updateForm} darkMode={isDark} />;
      case 4: return <ReturnReviewStep data={form} darkMode={isDark} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ── */}
      <div
        style={{
          background: "#8B3A3A",
          padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 12,
          position: "sticky", top: 0, zIndex: 50,
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={() => navigate("/invoices")}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", color: "#FFFFFF", display: "flex" }}
        >
          <X size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            Return Invoice
            <span style={{ background: "rgba(255,255,255,0.2)", fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600, letterSpacing: 0.5 }}>
              RET_INV
            </span>
          </div>
          <div style={{ color: "rgba(255,220,200,0.8)", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
            Step {step} of {STEPS.length} — {STEPS[step - 1].description}
          </div>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div style={{ background: isDark ? "#2A2A2A" : "#FFFFFF", borderBottom: `1px solid ${border}`, padding: "14px 18px", overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = s.id < step;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <div
                  onClick={() => isDone && setStep(s.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: isDone ? "pointer" : "default", opacity: !isActive && !isDone ? 0.45 : 1, minWidth: 54 }}
                >
                  <div
                    style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: isDone ? "#1A7A1A" : isActive ? "#8B3A3A" : (isDark ? "#333" : "#E8E2DF"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 2px 8px rgba(139,58,58,0.35)" : "none",
                    }}
                  >
                    {isDone ? <CheckCircle size={16} color="#FFFFFF" /> : <Icon size={15} color={isActive ? "#FFFFFF" : (isDark ? "#888" : "#999")} />}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isDone ? "#1A7A1A" : isActive ? "#8B3A3A" : textSecondary, fontFamily: "Arial, sans-serif", letterSpacing: 0.3 }}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div style={{ width: 24, height: 2, background: idx < step - 1 ? "#1A7A1A" : (isDark ? "#333" : "#E8E2DF"), marginBottom: 14, transition: "background 0.3s" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, padding: "18px 16px", maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {dbLocked && <DBLockedBanner lockedBy={dbLockedBy} />}

        {!dbLocked && (
          <div style={{ background: cardBg, borderRadius: 14, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: `1px solid ${border}` }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#8B3A3A", margin: 0, marginBottom: 4 }}>
                {step === 1 && "Select Customer"}
                {step === 2 && "Select Return Items"}
                {step === 3 && "Return Payment Details"}
                {step === 4 && "Review & Submit"}
              </h2>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0 }}>
                {step === 1 && "Search and select the customer requesting the return."}
                {step === 2 && "Select items being returned and enter original & return prices."}
                {step === 3 && "Record how the refund was paid back to the customer."}
                {step === 4 && "Review all return details before creating the return invoice."}
              </p>
            </div>

            {renderStep()}

            {(submitError || error) && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFEBEE", borderRadius: 8, border: "1px solid #FFCDD2", color: "#CC0000", fontSize: 13 }}>
                {submitError || error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      {!dbLocked && (
        <div style={{ position: "sticky", bottom: 0, background: isDark ? "#1A1A1A" : "#FFFFFF", borderTop: `1px solid ${border}`, padding: "12px 18px", display: "flex", gap: 10, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{ flex: 1, padding: "12px 0", background: "none", border: `1.5px solid ${border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 600, color: textPrimary, fontFamily: "inherit" }}
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              style={{ flex: 2, padding: "12px 0", background: canAdvance() ? "#8B3A3A" : (isDark ? "#333" : "#E0D8D4"), border: "none", borderRadius: 10, cursor: canAdvance() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 700, color: canAdvance() ? "#FFFFFF" : textSecondary, fontFamily: "inherit", transition: "all 0.15s" }}
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || dbLocked}
              style={{ flex: 2, padding: "13px 0", background: submitting ? "#888" : "#8B3A3A", border: "none", borderRadius: 10, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#FFFFFF", fontFamily: "inherit", transition: "all 0.15s" }}
            >
              {submitting ? "Creating..." : "Create Return Invoice →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

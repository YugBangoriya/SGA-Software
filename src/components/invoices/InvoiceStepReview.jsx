// SGA — Last updated: Added inline-editable customer name/phone for Unnamed Customer (Cash Memo) invoices; accepts onChange prop
// ============================================================
// InvoiceStepReview.jsx — Step 5: Review & Submit
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useRef } from "react";
import { User, Car, Package, Wrench, CreditCard, Calendar, CheckCircle, Pencil, Check, X, Receipt } from "lucide-react";
import { formatCurrency, formatDate, PAYMENT_METHODS } from "../../lib/invoiceHelpers";
import InvoiceStatusBadge from "./InvoiceStatusBadge";

// Default values for unnamed customer — must match InvoiceStepCustomer.jsx constants
const UNNAMED_NAME_DEFAULT = "Cash Memo - Unnamed Customer";
const UNNAMED_PHONE_DEFAULT = "XXXXX-XXXXX";

export default function InvoiceStepReview({ data, onChange, darkMode }) {
  const isDark = darkMode;
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const sectionBg = isDark ? "#1A1A1A" : "#F5F0EE";

  const customer = data.customerSnapshot || {};
  const vehicle = data.vehicleSnapshot || {};
  const items = data.items || [];
  const labourCost = parseFloat(data.labourCost || 0);
  const totalAmount = parseFloat(data.totalAmount || 0);
  const discountAmount = parseFloat(data.discountAmount || 0);
  const preDiscountTotal = parseFloat(data.preDiscountTotal || totalAmount);
  const amountPaid = parseFloat(data.amountPaid || 0);
  const balanceDue = Math.max(0, totalAmount - amountPaid);
  const paymentStatus = data.paymentStatus || "UNPAID";
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === data.paymentMethod)?.label || data.paymentMethod;
  const invoiceDate = data.invoiceDate
    ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const hasDiscount = discountAmount > 0;
  const isUnnamed = data.isUnnamed || false;

  // ── Unnamed customer inline edit state ──────────────────
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [nameVal, setNameVal] = useState(customer.name || UNNAMED_NAME_DEFAULT);
  const [phoneVal, setPhoneVal] = useState(customer.phone || UNNAMED_PHONE_DEFAULT);
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  const commitName = () => {
    const trimmed = nameVal.trim() || UNNAMED_NAME_DEFAULT;
    setNameVal(trimmed);
    setEditingName(false);
    if (onChange) {
      onChange({
        customerSnapshot: {
          ...customer,
          name: trimmed,
        },
      });
    }
  };

  const commitPhone = () => {
    const trimmed = phoneVal.trim() || UNNAMED_PHONE_DEFAULT;
    setPhoneVal(trimmed);
    setEditingPhone(false);
    if (onChange) {
      onChange({
        customerSnapshot: {
          ...customer,
          phone: trimmed,
        },
      });
    }
  };

  const startEditName = () => {
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const startEditPhone = () => {
    setEditingPhone(true);
    setTimeout(() => phoneInputRef.current?.focus(), 50);
  };

  // ── Shared sub-components ────────────────────────────────
  const Section = ({ icon: Icon, title, children }) => (
    <div
      style={{
        background: sectionBg,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 12,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${border}`,
        }}
      >
        <Icon size={15} color="#661F1F" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#661F1F",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontFamily: "Arial, sans-serif",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, mono, amber, bold, green, red, strike }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 5,
      }}
    >
      <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: bold ? 700 : 500,
          color: amber ? "#CC6600" : green ? "#1A7A1A" : red ? "#CC0000" : textPrimary,
          fontFamily: mono ? "'Courier New', monospace" : "inherit",
          textDecoration: strike ? "line-through" : "none",
          opacity: strike ? 0.6 : 1,
        }}
      >
        {value}
      </span>
    </div>
  );

  // ── Editable field row (for unnamed customer) ────────────
  const EditableRow = ({ label, value, editing, onStartEdit, onCommit, inputRef, inputValue, onInputChange, onKeyDown }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
        gap: 10,
      }}
    >
      <span style={{ fontSize: 12, color: textSecondary, flexShrink: 0 }}>{label}</span>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "flex-end" }}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onCommit}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: textPrimary,
              background: isDark ? "#2A2A2A" : "#FFFFFF",
              border: `1.5px solid #4A6CF7`,
              borderRadius: 6,
              padding: "4px 8px",
              outline: "none",
              fontFamily: "inherit",
              minWidth: 0,
              flex: 1,
              maxWidth: 200,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={onCommit}
            style={{
              background: "#4A6CF7",
              border: "none",
              borderRadius: 5,
              padding: "4px 7px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Check size={12} color="#FFFFFF" />
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: value === UNNAMED_NAME_DEFAULT || value === UNNAMED_PHONE_DEFAULT
                ? textSecondary
                : textPrimary,
              fontStyle: value === UNNAMED_NAME_DEFAULT || value === UNNAMED_PHONE_DEFAULT
                ? "italic"
                : "normal",
            }}
          >
            {value}
          </span>
          <button
            onClick={onStartEdit}
            title="Edit"
            style={{
              background: "none",
              border: `1px solid ${isDark ? "#555" : "#DDD"}`,
              borderRadius: 5,
              padding: "3px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#4A6CF7",
            }}
          >
            <Pencil size={11} color="#4A6CF7" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Status notice */}
      <div
        style={{
          background: "#E3F2FD",
          border: "1.5px solid #90CAF9",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <CheckCircle size={18} color="#0055CC" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0055CC" }}>
            Ready to Submit
          </div>
          <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
            This invoice will be created as <strong>PENDING</strong> and will require
            Owner approval before inventory is deducted and PDF is sent.
          </div>
        </div>
      </div>

      {/* Customer — Unnamed (editable) or Named */}
      {isUnnamed ? (
        <Section icon={Receipt} title="Customer (Cash Memo)">
          {/* Hint banner */}
          <div
            style={{
              background: isDark ? "rgba(74,108,247,0.12)" : "#EEF2FF",
              border: `1px solid ${isDark ? "#3A4A8A" : "#C7D2FE"}`,
              borderRadius: 7,
              padding: "7px 10px",
              marginBottom: 10,
              fontSize: 11,
              color: isDark ? "#8899FF" : "#4A6CF7",
              lineHeight: 1.5,
            }}
          >
            <strong>Optional:</strong> Edit the name or phone to create a customer record. Leave
            as-is to keep this as an anonymous cash memo.
          </div>
          <EditableRow
            label="Name"
            value={nameVal}
            editing={editingName}
            onStartEdit={startEditName}
            onCommit={commitName}
            inputRef={nameInputRef}
            inputValue={nameVal}
            onInputChange={setNameVal}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setNameVal(customer.name || UNNAMED_NAME_DEFAULT); setEditingName(false); }
            }}
          />
          <EditableRow
            label="Phone"
            value={phoneVal}
            editing={editingPhone}
            onStartEdit={startEditPhone}
            onCommit={commitPhone}
            inputRef={phoneInputRef}
            inputValue={phoneVal}
            onInputChange={setPhoneVal}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPhone();
              if (e.key === "Escape") { setPhoneVal(customer.phone || UNNAMED_PHONE_DEFAULT); setEditingPhone(false); }
            }}
          />
        </Section>
      ) : (
        <Section icon={User} title="Customer">
          <Row label="Name" value={customer.name || "—"} bold />
          <Row label="Phone" value={customer.phone || "—"} />
          {customer.alternatePhone && <Row label="Alt. Phone" value={customer.alternatePhone} />}
        </Section>
      )}

      {/* Vehicle */}
      <Section icon={Car} title="Vehicle">
        <Row label="Reg. No." value={vehicle.registrationNo || "—"} mono bold />
        <Row label="Make / Model" value={`${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "—"} />
        {vehicle.year && <Row label="Year" value={vehicle.year} />}
        {vehicle.emissionCategory && <Row label="Emission" value={vehicle.emissionCategory} />}
      </Section>

      {/* Items */}
      <Section icon={Package} title={`Items (${items.length})`}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 6,
              marginBottom: 6,
              borderBottom: idx < items.length - 1 ? `1px solid ${border}` : "none",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: textPrimary, fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: textSecondary }}>
                {item.quantity} × {formatCurrency(item.sellingPrice)}
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(item.sellingPrice * item.quantity)}
            </span>
          </div>
        ))}
        {labourCost > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Wrench size={13} color="#888" />
              <span style={{ fontSize: 13, color: textPrimary }}>Labour</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(labourCost)}
            </span>
          </div>
        )}
      </Section>

      {/* Payment */}
      <Section icon={CreditCard} title="Payment">
        <Row label="Subtotal" value={formatCurrency(data.subtotal || 0)} mono />
        {data.gstEnabled && (
          <>
            <Row label="CGST (9%)" value={formatCurrency(data.cgst || 0)} mono />
            <Row label="SGST (9%)" value={formatCurrency(data.sgst || 0)} mono />
          </>
        )}
        <div
          style={{
            borderTop: `1px solid ${border}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          {/* If discount exists: show Invoice Total (struck out), Discount, Revised Total */}
          {hasDiscount ? (
            <>
              <Row label="Invoice Total" value={formatCurrency(preDiscountTotal)} mono />
              <Row label="Discount" value={`- ${formatCurrency(discountAmount)}`} mono amber />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                  padding: "6px 10px",
                  background: "#E8F5E9",
                  borderRadius: 6,
                  border: "1px solid #C8E6C9",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1A7A1A" }}>Revised Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1A7A1A", fontFamily: "'Courier New', monospace" }}>
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </>
          ) : (
            <Row label="Total Amount" value={formatCurrency(totalAmount)} mono bold />
          )}
          <Row label="Amount Paid" value={formatCurrency(amountPaid)} mono />
          <Row
            label="Balance Due"
            value={formatCurrency(balanceDue)}
            mono
            bold
            amber={balanceDue > 0}
          />
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Row label="Method" value={methodLabel} />
          <InvoiceStatusBadge invoice={paymentStatus} size="xs" />
        </div>
        {data.loanProvider && <Row label="Provider" value={data.loanProvider} />}
        {data.emiAmount && (
          <Row label="EMI / Month" value={formatCurrency(data.emiAmount)} mono />
        )}
        {data.loanCompletionDate && (
          <Row label="Completion" value={new Date(data.loanCompletionDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
        )}
      </Section>

      {/* Date */}
      <Section icon={Calendar} title="Invoice Date">
        <Row
          label="Invoice Date"
          value={invoiceDate}
          amber={data.isDateOverridden}
        />
        {data.isDateOverridden && (
          <div
            style={{
              fontSize: 11,
              color: "#CC6600",
              background: "#FFF3E0",
              borderRadius: 6,
              padding: "5px 8px",
              marginTop: 4,
            }}
          >
            ⚠ Date manually changed — will be highlighted with "M" tag in list views.
          </div>
        )}
        {data.dueDate && (
          <Row
            label="Due Date"
            value={new Date(data.dueDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          />
        )}
      </Section>
    </div>
  );
}
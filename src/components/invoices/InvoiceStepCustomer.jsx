// ============================================================
// InvoiceStepCustomer.jsx — Step 1: Customer Selector
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Search, User, Car, ChevronRight, X, Phone, UserPlus } from "lucide-react";

export default function InvoiceStepCustomer({ data, onChange, darkMode }) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const selected = data.customerId || null;

  const isDark = darkMode;
  const bg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";
  const inputBg = isDark ? "#2A2A2A" : "#FFFFFF";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "customers"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load customers:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.vehicleRegistrationNo?.toLowerCase().includes(q) ||
      c.vehicleModel?.toLowerCase().includes(q)
    );
  });

  const selectCustomer = (customer) => {
    onChange({
      customerId: customer.id,
      customerSnapshot: {
        name: customer.name,
        phone: customer.phone,
        alternatePhone: customer.alternatePhone || "",
      },
      vehicleSnapshot: {
        registrationNo: customer.vehicleRegistrationNo || "",
        make: customer.vehicleCompany || "",
        model: customer.vehicleModel || "",
        year: customer.vehicleYear || "",
        emissionCategory: customer.emissionCategory || "",
      },
    });
  };

  const clearSelection = () => {
    onChange({ customerId: null, customerSnapshot: null, vehicleSnapshot: null });
  };

  const selectedCustomer = customers.find((c) => c.id === selected);

  // ── Selected state ─────────────────────────────────────
  if (selectedCustomer) {
    return (
      <div>
        <div
          style={{
            background: "#F0FAF0",
            border: "2px solid #4CAF50",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#E8F5E9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User size={18} color="#1A7A1A" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                  {selectedCustomer.name}
                </div>
                <div style={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone size={11} color="#666" />
                  {selectedCustomer.phone}
                </div>
              </div>
            </div>
            <button
              onClick={clearSelection}
              style={{
                background: "none",
                border: "1px solid #E8E2DF",
                borderRadius: 6,
                padding: "5px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#666",
              }}
            >
              <X size={12} /> Change
            </button>
          </div>

          {/* Vehicle details */}
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Car size={14} color="#666" />
              <span style={{ fontSize: 12, color: "#444", fontWeight: 600 }}>
                {selectedCustomer.vehicleRegistrationNo || "No Reg."}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {selectedCustomer.vehicleCompany} {selectedCustomer.vehicleModel}
              {selectedCustomer.vehicleYear && ` (${selectedCustomer.vehicleYear})`}
            </div>
            {selectedCustomer.emissionCategory && (
              <div
                style={{
                  background: "#E3F2FD",
                  color: "#0055CC",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {selectedCustomer.emissionCategory}
              </div>
            )}
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#1A7A1A", fontWeight: 600, textAlign: "center" }}>
          ✓ Customer selected — click Next to continue
        </p>
      </div>
    );
  }

  // ── Search & select ────────────────────────────────────
  return (
    <div>
      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search
          size={16}
          color="#888"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        />
        <input
          type="text"
          placeholder="Search by name, phone, or vehicle number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "12px 12px 12px 38px",
            background: inputBg,
            border: `1.5px solid ${border}`,
            borderRadius: 8,
            fontSize: 14,
            color: textPrimary,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: textSecondary }}>
            Loading customers...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: textSecondary }}>
            <div style={{ marginBottom: 12 }}>
              {search ? "No customers match your search." : "No customers found in the system."}
            </div>
            <button
              onClick={() => navigate("/customers/new")}
              style={{
                background: "#661F1F",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "inherit",
              }}
            >
              <UserPlus size={15} /> Create New Customer
            </button>
          </div>
        ) : (
          filtered.map((customer) => (
            <div
              key={customer.id}
              onClick={() => selectCustomer(customer)}
              style={{
                background: bg,
                border: `1.5px solid ${border}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#661F1F";
                e.currentTarget.style.background = isDark ? "#2E2020" : "#FDF8F8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.background = bg;
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#F5E6E6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User size={18} color="#661F1F" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                  {customer.name}
                </div>
                <div style={{ fontSize: 12, color: textSecondary, display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Phone size={10} /> {customer.phone}
                  </span>
                  {customer.vehicleRegistrationNo && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Car size={10} /> {customer.vehicleRegistrationNo}
                    </span>
                  )}
                  {customer.vehicleModel && (
                    <span>{customer.vehicleCompany} {customer.vehicleModel}</span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} color={textSecondary} />
            </div>
          ))
        )}
      </div>

      {/* Always-visible Create New Customer link */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}`, textAlign: "center" }}>
          <button
            onClick={() => navigate("/customers/new")}
            style={{
              background: "none",
              border: `1.5px solid #661F1F`,
              borderRadius: 8,
              padding: "9px 18px",
              fontWeight: 700,
              fontSize: 13,
              color: "#661F1F",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "inherit",
            }}
          >
            <UserPlus size={14} /> Create New Customer
          </button>
        </div>
      )}
    </div>
  );
}
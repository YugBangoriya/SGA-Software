// SGA — Last updated: Extended item search to include shortcut/alias field for fast lookup during invoice creation
// ============================================================
// InvoiceStepItems.jsx — Step 2: Line Items from Inventory
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Plus, Minus, Trash2, Search, Package, AlertTriangle, X, Pencil, Check, PlusCircle, Tag,
} from "lucide-react";
import { formatCurrency } from "../../lib/invoiceHelpers";

export default function InvoiceStepItems({ data, onChange, darkMode }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  // Track which item's price is being edited: inventoryItemId → true/false
  const [editingPriceId, setEditingPriceId] = useState(null);
  // Local draft price while editing
  const [priceDraft, setPriceDraft] = useState("");
  // Unlisted / Local Item inline form
  const [showUnlistedForm, setShowUnlistedForm] = useState(false);
  const [unlistedName,  setUnlistedName]  = useState("");
  const [unlistedPrice, setUnlistedPrice] = useState("");
  const [unlistedQty,   setUnlistedQty]   = useState("1");
  const [unlistedError, setUnlistedError] = useState("");

  const items = data.items || [];
  const isDark = darkMode;
  const bg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

  // ── WHY WE LOAD INVENTORY EVEN WHEN invoiceDbLocked IS TRUE (⚠️ Bug 4.1) ──────
  // The SuperAdmin invoice DB lock targets the /invoices Firestore collection
  // exclusively (enforced at the security rule level via systemConfig.invoiceDbLocked).
  // The /inventory collection has its own separate security rules and is NOT affected
  // by the lock flag in any way.
  //
  // Loading the inventory picker here while the DB is locked is safe because:
  //   1. Employees cannot reach this step if the DB is locked — CreateInvoice checks
  //      the lock flag before rendering and shows a "Database Locked" banner instead.
  //   2. Even if somehow reached, submitting a new invoice while locked will fail at
  //      the Firestore write step (the /invoices collection rules deny all writes).
  //   3. Showing the inventory picker with no ability to submit is harmless — the
  //      employee sees read-only item data, nothing is written.
  //
  // Adding a lock check here would be over-engineering and would create a second
  // code path that diverges from the single authoritative lock at CreateInvoice level.
  // ───────────────────────────────────────────────────────────────────────────────
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
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.itemName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      // NEW — search by shortcut/alias so typing e.g. "ms" finds "M.S. Connector"
      (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  });

  // ── Effective price for an inventory item ─────────────────
  // Priority: sellingPrice (if set and > 0) → 0 (NOT purchase price)
  // Per client request: if selling price is not configured, default to 0
  // so the user is forced/prompted to set a price manually.
  const getEffectivePrice = (invItem) => {
    if (invItem.sellingPrice != null && invItem.sellingPrice > 0) {
      return invItem.sellingPrice;
    }
    return 0;
  };

  const addItem = (invItem) => {
    const existing = items.find((i) => i.inventoryItemId === invItem.id);
    if (existing) {
      updateQty(invItem.id, existing.quantity + 1);
      setShowPicker(false);
      setSearch("");
      return;
    }
    const effectivePrice = getEffectivePrice(invItem);
    onChange({
      items: [
        ...items,
        {
          inventoryItemId:  invItem.id,
          name:             invItem.itemName,
          category:         invItem.category || "",
          quantity:         1,
          sellingPrice:     effectivePrice,
          purchasePrice:    invItem.purchasePrice || 0,
          availableQty:     invItem.quantity || 0,
          // Flag whether the price came from the inventory's selling price field
          // or was defaulted to 0 (no selling price configured)
          priceSource:      (invItem.sellingPrice != null && invItem.sellingPrice > 0)
                              ? "inventory_selling"
                              : "not_set",
        },
      ],
    });
    setShowPicker(false);
    setSearch("");
  };

  const removeItem = (inventoryItemId) => {
    onChange({ items: items.filter((i) => i.inventoryItemId !== inventoryItemId) });
    if (editingPriceId === inventoryItemId) setEditingPriceId(null);
  };

  const updateQty = (inventoryItemId, qty) => {
    if (qty < 1) return;
    onChange({
      items: items.map((i) =>
        i.inventoryItemId === inventoryItemId ? { ...i, quantity: qty } : i
      ),
    });
  };

  // ── Price editing ─────────────────────────────────────────
  const startEditPrice = (item) => {
    setEditingPriceId(item.inventoryItemId);
    setPriceDraft(item.sellingPrice != null ? String(item.sellingPrice) : "0");
  };

  const commitPrice = (inventoryItemId) => {
    const parsed = parseFloat(priceDraft);
    const newPrice = isNaN(parsed) || parsed < 0 ? 0 : parseFloat(parsed.toFixed(2));
    onChange({
      items: items.map((i) =>
        i.inventoryItemId === inventoryItemId
          ? { ...i, sellingPrice: newPrice, priceSource: "manual_override" }
          : i
      ),
    });
    setEditingPriceId(null);
    setPriceDraft("");
  };

  const cancelEditPrice = () => {
    setEditingPriceId(null);
    setPriceDraft("");
  };

  // ── Add Unlisted / Local Item ─────────────────────────────────────────────
  const submitUnlisted = () => {
    const name  = unlistedName.trim();
    const price = parseFloat(unlistedPrice);
    const qty   = parseInt(unlistedQty, 10);
    if (!name)                      { setUnlistedError("Item name is required"); return; }
    if (isNaN(price) || price < 0)  { setUnlistedError("Enter a valid selling price (0 or more)"); return; }
    if (isNaN(qty)   || qty < 1)    { setUnlistedError("Enter a valid quantity (min 1)"); return; }
    onChange({
      items: [
        ...items,
        {
          inventoryItemId: null,
          name,
          category:        "Local Items",
          quantity:        qty,
          sellingPrice:    parseFloat(price.toFixed(2)),
          purchasePrice:   null,
          availableQty:    Infinity,
          isLocalItem:     true,
          isUntracked:     true,
          priceSource:     "local_item",
        },
      ],
    });
    setUnlistedName("");
    setUnlistedPrice("");
    setUnlistedQty("1");
    setUnlistedError("");
    setShowUnlistedForm(false);
    setShowPicker(false);
  };

  const itemsTotal = items.reduce(
    (s, i) => s + (i.sellingPrice || 0) * i.quantity, 0
  );

  return (
    <div>
      {/* Selected items list */}
      {items.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          {items.map((item) => {
            const isOverQty = !item.isUntracked && item.quantity > item.availableQty;
            const isPriceNotSet = item.priceSource === "not_set" || item.sellingPrice === 0;
            const isManual = item.priceSource === "manual_override";
            const isEditing = editingPriceId === item.inventoryItemId;
            return (
              <div
                key={item.inventoryItemId}
                style={{
                  background: isDark ? "#2A2A2A" : "#FFFFFF",
                  border: `1.5px solid ${isOverQty ? "#CC0000" : isPriceNotSet ? "#F5A030" : border}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{item.name}</span>
                  {item.isLocalItem && (
                    <span style={{ fontSize: 9, background: '#FFF3E0', color: '#CC6600', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>LOCAL</span>
                  )}
                </div>
                    <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                      {item.isUntracked ? "Untracked — no stock limit" : `Stock: ${item.availableQty} available`}
                      {isOverQty && (
                        <span style={{ color: "#CC0000", marginLeft: 8, fontWeight: 600 }}>
                          ⚠ Exceeds stock
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.inventoryItemId)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#CC0000", padding: 4 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  {/* Qty stepper */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => updateQty(item.inventoryItemId, item.quantity - 1)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: `1px solid ${border}`,
                        background: isDark ? "#333" : "#F5F0EE", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: textPrimary,
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateQty(item.inventoryItemId, parseInt(e.target.value) || 1)}
                      style={{
                        width: 48, textAlign: "center", padding: "4px 0",
                        border: `1.5px solid ${border}`, borderRadius: 6,
                        background: isDark ? "#2A2A2A" : "#FFFFFF",
                        color: textPrimary, fontSize: 13, fontFamily: "inherit",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => updateQty(item.inventoryItemId, item.quantity + 1)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: `1px solid ${border}`,
                        background: isDark ? "#333" : "#F5F0EE", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: textPrimary,
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Price — EDITABLE ──────────────────────────────────── */}
                  {isEditing ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4, flex: 1,
                    }}>
                      <span style={{ fontSize: 13, color: textSecondary }}>₹</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceDraft}
                        autoFocus
                        onChange={(e) => setPriceDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitPrice(item.inventoryItemId);
                          if (e.key === "Escape") cancelEditPrice();
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "5px 8px",
                          border: `1.5px solid #661F1F`,
                          borderRadius: 6,
                          background: isDark ? "#2A2A2A" : "#FFFFFF",
                          color: textPrimary,
                          fontSize: 13,
                          fontFamily: "'Courier New', monospace",
                          outline: "none",
                          maxWidth: 110,
                          boxSizing: "border-box",
                        }}
                      />
                      {/* Confirm */}
                      <button
                        onClick={() => commitPrice(item.inventoryItemId)}
                        style={{
                          background: "#1A7A1A", border: "none", borderRadius: 5,
                          padding: "5px 8px", cursor: "pointer",
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <Check size={12} color="#FFFFFF" />
                      </button>
                      {/* Cancel */}
                      <button
                        onClick={cancelEditPrice}
                        style={{
                          background: isDark ? "#444" : "#E8E2DF", border: "none", borderRadius: 5,
                          padding: "5px 7px", cursor: "pointer",
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <X size={12} color={textSecondary} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5, flex: 1,
                      background: isDark ? "#222" : "#F9F6F4",
                      borderRadius: 6, padding: "5px 10px",
                      border: `1.5px solid ${isPriceNotSet ? "#F5A030" : (isDark ? "#3A3A3A" : "#E0D8D4")}`,
                      cursor: "pointer",
                      minWidth: 0,
                    }}
                    onClick={() => startEditPrice(item)}
                    title="Click to edit price"
                    >
                      <span style={{ fontSize: 12, color: textSecondary }}>₹</span>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: isPriceNotSet ? "#CC6600" : textPrimary,
                        fontFamily: "'Courier New', monospace", flex: 1,
                      }}>
                        {(item.sellingPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      {/* Source badge */}
                      <span style={{
                        fontSize: 9,
                        background: isManual
                          ? "#EBF5FB"
                          : isPriceNotSet
                            ? "#FFF3E0"
                            : "#E8F5E9",
                        color: isManual
                          ? "#0055CC"
                          : isPriceNotSet
                            ? "#CC6600"
                            : "#1A7A1A",
                        borderRadius: 3, padding: "1px 5px",
                        fontWeight: 700, display: "inline-block",
                        whiteSpace: "nowrap",
                        marginRight: 2,
                      }}>
                        {isManual ? "EDITED" : isPriceNotSet ? "SET PRICE" : "SELL"}
                      </span>
                      <Pencil size={10} color={textSecondary} style={{ flexShrink: 0 }} />
                    </div>
                  )}

                  {/* Line total */}
                  <div
                    style={{
                      minWidth: 80, textAlign: "right",
                      fontSize: 14, fontWeight: 700, color: "#661F1F",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {formatCurrency((item.sellingPrice || 0) * item.quantity)}
                  </div>
                </div>

                {/* Warning when price is 0 / not configured */}
                {isPriceNotSet && !isEditing && (
                  <div style={{
                    marginTop: 7,
                    padding: "5px 8px",
                    background: "#FFF8E1",
                    borderRadius: 5,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <AlertTriangle size={11} color="#CC6600" />
                    <span style={{ fontSize: 11, color: "#CC6600" }}>
                      No selling price set in inventory — price is ₹0. Click the price field above to set it.
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Subtotal strip */}
          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", background: "#F5E6E6", borderRadius: 8,
              border: "1px solid #E8C8C8", marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: "#661F1F", fontWeight: 600 }}>Items Subtotal</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
              {formatCurrency(itemsTotal)}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center", padding: "30px 20px",
            background: cardBg, borderRadius: 10,
            border: `1.5px dashed ${border}`, marginBottom: 16, color: textSecondary,
          }}
        >
          <Package size={32} color="#CCBBBB" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>No items added yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Click "Add Item from Inventory" below</div>
        </div>
      )}

      {/* Add item button */}
      <button
        onClick={() => setShowPicker(true)}
        style={{
          width: "100%", padding: "12px 0",
          background: "none", border: `2px dashed #8B3A3A`,
          borderRadius: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          color: "#661F1F", fontSize: 14, fontWeight: 600,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#FDF8F8")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Plus size={16} /> Add Item from Inventory
      </button>

      {/* Inventory picker modal */}
      {showPicker && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 1000, padding: "0",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPicker(false); setSearch(""); } }}
        >
          <div
            style={{
              background: isDark ? "#1A1A1A" : "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              width: "100%", maxWidth: 600,
              maxHeight: "75vh", display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Picker header */}
            <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>
                  Select from Inventory
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => { setShowUnlistedForm(true); setSearch(""); }}
                    title="Add item not in inventory"
                    style={{
                      background: "none",
                      border: "1.5px solid #CC6600",
                      borderRadius: 6,
                      padding: "5px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      color: "#CC6600",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  >
                    <PlusCircle size={13} /> Unlisted Item
                  </button>
                  <button
                    onClick={() => { setShowPicker(false); setSearch(""); setShowUnlistedForm(false); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Price source legend */}
              <div style={{
                display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 10, background: "#E8F5E9", color: "#1A7A1A",
                  borderRadius: 4, padding: "2px 7px", fontWeight: 600,
                }}>
                  ✓ SELL = Selling price set
                </span>
                <span style={{
                  fontSize: 10, background: "#FFF3E0", color: "#CC6600",
                  borderRadius: 4, padding: "2px 7px", fontWeight: 600,
                }}>
                  ₹0 = No selling price — you can set it after adding
                </span>
              </div>

              <div style={{ position: "relative" }}>
                <Search size={15} color="#888" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  autoFocus
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 9px 9px 32px",
                    border: `1.5px solid ${border}`, borderRadius: 8,
                    background: isDark ? "#2A2A2A" : "#F5F0EE",
                    color: textPrimary, fontSize: 13, outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>
            </div>

            {/* ── Unlisted Item Form ── */}
            {showUnlistedForm && (
              <div style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${border}`,
                background: isDark ? "#1A1A2A" : "#FFF8F0",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#CC6600", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Tag size={14} color="#CC6600" /> Add Unlisted Item (Local Item)
                </div>

                {/* Name */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: textSecondary, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Item Name *
                  </label>
                  <input
                    autoFocus
                    value={unlistedName}
                    onChange={(e) => { setUnlistedName(e.target.value); setUnlistedError(""); }}
                    placeholder="e.g. Rubber Hose Clamp"
                    onKeyDown={(e) => { if (e.key === "Enter") submitUnlisted(); }}
                    style={{
                      width: "100%", padding: "9px 10px",
                      border: `1.5px solid ${border}`, borderRadius: 7,
                      background: isDark ? "#2A2A2A" : "#FFFFFF",
                      color: textPrimary, fontSize: 13, outline: "none",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#CC6600")}
                    onBlur={(e)  => (e.target.style.borderColor = border)}
                  />
                </div>

                {/* Price + Qty */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: textSecondary, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number" min="0" step="0.01"
                      value={unlistedPrice}
                      onChange={(e) => { setUnlistedPrice(e.target.value); setUnlistedError(""); }}
                      placeholder="0.00"
                      style={{
                        width: "100%", padding: "9px 10px",
                        border: `1.5px solid ${border}`, borderRadius: 7,
                        background: isDark ? "#2A2A2A" : "#FFFFFF",
                        color: textPrimary, fontSize: 13, outline: "none",
                        fontFamily: "'Courier New', monospace", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#CC6600")}
                      onBlur={(e)  => (e.target.style.borderColor = border)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: textSecondary, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Quantity *
                    </label>
                    <input
                      type="number" min="1" step="1"
                      value={unlistedQty}
                      onChange={(e) => { setUnlistedQty(e.target.value); setUnlistedError(""); }}
                      style={{
                        width: "100%", padding: "9px 10px",
                        border: `1.5px solid ${border}`, borderRadius: 7,
                        background: isDark ? "#2A2A2A" : "#FFFFFF",
                        color: textPrimary, fontSize: 13, outline: "none",
                        fontFamily: "'Courier New', monospace", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#CC6600")}
                      onBlur={(e)  => (e.target.style.borderColor = border)}
                    />
                  </div>
                </div>

                {/* Error */}
                {unlistedError && (
                  <div style={{ fontSize: 12, color: "#CC0000", marginBottom: 6 }}>
                    ⚠ {unlistedError}
                  </div>
                )}

                {/* Info note */}
                <div style={{
                  fontSize: 11, color: "#CC6600",
                  background: "#FFF3E0", borderRadius: 5,
                  padding: "6px 10px", marginBottom: 10, lineHeight: 1.5,
                }}>
                  💡 This item will appear in <strong>Local Items</strong> in your inventory after the invoice is approved. You can set its purchase price there to enable profit tracking.
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setShowUnlistedForm(false); setUnlistedError(""); }}
                    style={{
                      flex: 1, padding: "9px 0",
                      background: "none", border: `1px solid ${border}`,
                      borderRadius: 7, color: textSecondary,
                      fontWeight: 600, fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    ← Back to list
                  </button>
                  <button
                    onClick={submitUnlisted}
                    style={{
                      flex: 2, padding: "9px 0",
                      background: "#CC6600", border: "none",
                      borderRadius: 7, color: "#FFFFFF",
                      fontWeight: 700, fontSize: 13,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    + Add to Invoice
                  </button>
                </div>
              </div>
            )}

            {/* Picker list */}
            <div style={{ overflowY: "auto", flex: 1, padding: "10px 14px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 30, color: textSecondary }}>Loading...</div>
              ) : filteredInventory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: textSecondary }}>No items found.</div>
              ) : (
                filteredInventory.map((item) => {
                  const isUntracked = item.isUntracked === true;
            const outOfStock = !isUntracked && (item.quantity || 0) === 0;
                  const alreadyAdded = items.find((i) => i.inventoryItemId === item.id);
                  const effectivePrice = getEffectivePrice(item);
                  const hasSellingPrice = item.sellingPrice != null && item.sellingPrice > 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !outOfStock && addItem(item)}
                      style={{
                        padding: "11px 12px",
                        borderRadius: 8,
                        marginBottom: 6,
                        border: `1px solid ${alreadyAdded ? "#4CAF50" : border}`,
                        background: alreadyAdded ? "#F0FAF0" : outOfStock ? (isDark ? "#2A1A1A" : "#FFF5F5") : bg,
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                        opacity: outOfStock ? 0.6 : 1,
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!outOfStock) e.currentTarget.style.borderColor = "#661F1F";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = alreadyAdded ? "#4CAF50" : border;
                      }}
                    >
                      <Package size={16} color={outOfStock ? "#CC0000" : "#661F1F"} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                          {item.itemName}
                          {alreadyAdded && (
                            <span style={{ marginLeft: 8, fontSize: 10, color: "#1A7A1A", fontWeight: 600 }}>
                              ✓ Added
                            </span>
                          )}
                          {/* NEW — show shortcut badge in picker */}
                          {item.shortcut && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#E3F2FD', color: '#0055CC', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: "'Courier New', monospace", letterSpacing: 0.5 }}>
                              {item.shortcut}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: textSecondary, marginTop: 1 }}>
                          {item.category && <span>{item.category} · </span>}
                          {isUntracked ? "Untracked — no limit" : `Stock: ${item.quantity || 0}`}
                          {outOfStock && <span style={{ color: "#CC0000", fontWeight: 600 }}> (Out of stock)</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700,
                          color: hasSellingPrice ? "#661F1F" : "#CC6600",
                          fontFamily: "'Courier New', monospace",
                        }}>
                          {hasSellingPrice ? formatCurrency(effectivePrice) : "₹0.00"}
                        </div>
                        <div style={{
                          fontSize: 9,
                          background: hasSellingPrice ? "#E8F5E9" : "#FFF3E0",
                          color: hasSellingPrice ? "#1A7A1A" : "#CC6600",
                          borderRadius: 3, padding: "1px 5px",
                          fontWeight: 700, display: "inline-block", marginTop: 2,
                        }}>
                          {hasSellingPrice ? "SELL" : "₹0"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
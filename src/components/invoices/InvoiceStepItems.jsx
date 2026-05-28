// SGA — Last updated: Selling price now auto-filled from inventory sellingPrice field; price field is READ-ONLY in invoice (no manual edits allowed); picker shows selling price instead of purchase price
// ============================================================
// InvoiceStepItems.jsx — Step 2: Line Items from Inventory
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  Plus, Minus, Trash2, Search, Package, AlertTriangle, X, Lock,
} from "lucide-react";
import { formatCurrency } from "../../lib/invoiceHelpers";

export default function InvoiceStepItems({ data, onChange, darkMode }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const items = data.items || [];
  const isDark = darkMode;
  const bg = isDark ? "#2A2A2A" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#F5F0EE";
  const border = isDark ? "#3A3A3A" : "#E8E2DF";
  const textPrimary = isDark ? "#E8E8E8" : "#222222";
  const textSecondary = isDark ? "#999999" : "#666666";

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

  // ── Determine the effective selling price for an inventory item ──────
  // Priority: sellingPrice field (set in inventory) → fallback to purchasePrice
  const getEffectivePrice = (invItem) => {
    if (invItem.sellingPrice != null && invItem.sellingPrice > 0) {
      return invItem.sellingPrice;
    }
    return invItem.purchasePrice || 0;
  };

  const addItem = (invItem) => {
    const existing = items.find((i) => i.inventoryItemId === invItem.id);
    if (existing) {
      updateQty(invItem.id, existing.quantity + 1);
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
          // or fell back to purchase price — used to display a tooltip
          priceSource:      (invItem.sellingPrice != null && invItem.sellingPrice > 0)
                              ? "inventory_selling"
                              : "purchase_fallback",
        },
      ],
    });
    setShowPicker(false);
    setSearch("");
  };

  const removeItem = (inventoryItemId) => {
    onChange({ items: items.filter((i) => i.inventoryItemId !== inventoryItemId) });
  };

  const updateQty = (inventoryItemId, qty) => {
    if (qty < 1) return;
    onChange({
      items: items.map((i) =>
        i.inventoryItemId === inventoryItemId ? { ...i, quantity: qty } : i
      ),
    });
  };

  // NOTE: updatePrice is intentionally removed — prices are locked to inventory values.

  const itemsTotal = items.reduce(
    (s, i) => s + i.sellingPrice * i.quantity, 0
  );

  return (
    <div>
      {/* Selected items list */}
      {items.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          {items.map((item) => {
            const isOverQty = item.quantity > item.availableQty;
            const isFallback = item.priceSource === "purchase_fallback";
            return (
              <div
                key={item.inventoryItemId}
                style={{
                  background: isDark ? "#2A2A2A" : "#FFFFFF",
                  border: `1.5px solid ${isOverQty ? "#CC0000" : border}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                      Stock: {item.availableQty} available
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

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
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

                  {/* Price — READ-ONLY, locked from inventory */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4, flex: 1,
                    background: isDark ? "#222" : "#F9F6F4",
                    borderRadius: 6, padding: "5px 10px",
                    border: `1.5px solid ${isDark ? "#3A3A3A" : "#E0D8D4"}`,
                    opacity: 0.9,
                  }}>
                    <Lock size={11} color={isDark ? "#666" : "#AAAAAA"} />
                    <span style={{ fontSize: 12, color: textSecondary, marginLeft: 2 }}>₹</span>
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: textPrimary,
                      fontFamily: "'Courier New', monospace", flex: 1,
                    }}>
                      {item.sellingPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    {isFallback && (
                      <span style={{
                        fontSize: 9, background: "#FFF3E0", color: "#CC6600",
                        borderRadius: 4, padding: "1px 5px", fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}>
                        COST
                      </span>
                    )}
                  </div>

                  {/* Line total */}
                  <div
                    style={{
                      minWidth: 80, textAlign: "right",
                      fontSize: 14, fontWeight: 700, color: "#661F1F",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {formatCurrency(item.sellingPrice * item.quantity)}
                  </div>
                </div>

                {/* Fallback warning — shown when no selling price was set in inventory */}
                {isFallback && (
                  <div style={{
                    marginTop: 7,
                    padding: "5px 8px",
                    background: "#FFF8E1",
                    borderRadius: 5,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <AlertTriangle size={11} color="#CC6600" />
                    <span style={{ fontSize: 11, color: "#CC6600" }}>
                      No selling price set in inventory — using purchase price. Set a selling price in Inventory to fix this.
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
                <button
                  onClick={() => { setShowPicker(false); setSearch(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Price source legend */}
              <div style={{
                display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap",
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
                  COST = Using purchase price
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

            {/* Picker list */}
            <div style={{ overflowY: "auto", flex: 1, padding: "10px 14px" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 30, color: textSecondary }}>Loading...</div>
              ) : filteredInventory.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: textSecondary }}>No items found.</div>
              ) : (
                filteredInventory.map((item) => {
                  const outOfStock = (item.quantity || 0) === 0;
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
                        </div>
                        <div style={{ fontSize: 11, color: textSecondary, marginTop: 1 }}>
                          {item.category && <span>{item.category} · </span>}
                          Stock: {item.quantity || 0}
                          {outOfStock && <span style={{ color: "#CC0000", fontWeight: 600 }}> (Out of stock)</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#661F1F", fontFamily: "'Courier New', monospace" }}>
                          {formatCurrency(effectivePrice)}
                        </div>
                        <div style={{
                          fontSize: 9,
                          background: hasSellingPrice ? "#E8F5E9" : "#FFF3E0",
                          color: hasSellingPrice ? "#1A7A1A" : "#CC6600",
                          borderRadius: 3, padding: "1px 5px",
                          fontWeight: 700, display: "inline-block", marginTop: 2,
                        }}>
                          {hasSellingPrice ? "SELL" : "COST"}
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
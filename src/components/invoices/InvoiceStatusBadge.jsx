// ============================================================
// InvoiceStatusBadge.jsx
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { STATUS_BADGE_CONFIG, getDisplayStatus } from "../../lib/invoiceHelpers";

export default function InvoiceStatusBadge({ invoice, size = "sm" }) {
  const displayStatus = typeof invoice === "string" ? invoice : getDisplayStatus(invoice);
  const config = STATUS_BADGE_CONFIG[displayStatus] || STATUS_BADGE_CONFIG.UNPAID;

  const fontSize = size === "xs" ? "10px" : size === "sm" ? "11px" : "13px";
  const padding = size === "xs" ? "2px 6px" : size === "sm" ? "3px 9px" : "5px 12px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: config.bg,
        color: config.color,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 999,
        whiteSpace: "nowrap",
        fontFamily: "Arial, sans-serif",
        letterSpacing: 0.3,
      }}
    >
      <span
        style={{
          width: size === "xs" ? 5 : 6,
          height: size === "xs" ? 5 : 6,
          borderRadius: "50%",
          background: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

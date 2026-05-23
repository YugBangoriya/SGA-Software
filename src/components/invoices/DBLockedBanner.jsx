// ============================================================
// DBLockedBanner.jsx — Shown when SuperAdmin locks invoice DB
// Phase 4 — Shree Ganesh Automobile
// ============================================================

import { ShieldAlert } from "lucide-react";

export default function DBLockedBanner({ lockedBy }) {
  return (
    <div
      style={{
        margin: "0 0 20px",
        padding: "16px 20px",
        background: "#FFF0F0",
        border: "2px solid #CC0000",
        borderRadius: 12,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <ShieldAlert size={24} color="#CC0000" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div
          style={{
            color: "#CC0000",
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 4,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Invoice Database Locked
        </div>
        <div
          style={{
            color: "#AA0000",
            fontSize: 13,
            fontFamily: "Arial, sans-serif",
            lineHeight: 1.5,
          }}
        >
          All invoice records are currently inaccessible. The database has been locked
          {lockedBy ? ` by ${lockedBy}` : ""} for backup maintenance.
          Invoice operations are disabled until the database is unlocked by the SuperAdmin.
        </div>
      </div>
    </div>
  );
}

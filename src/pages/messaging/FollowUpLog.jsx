/**
 * FollowUpLog.jsx
 * Full-page tracker showing all follow-ups with status.
 *
 * Columns: Contact, Platform, Scheduled Date, Message Preview, Status, Actions
 * Status filters: All / Pending / Sent / Replied / No Response / Failed
 *
 * Route: /messaging/follow-ups
 * Access: Owner + SuperAdmin only
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useMessagingStore, { PLATFORM_CONFIG, formatTimestamp } from "../../store/messagingStore";
import { PlatformBadge } from "./index.jsx";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#CC6600", bg: "#FFF3E0", dot: "#FF9800" },
  sent: { label: "Sent", color: "#0055CC", bg: "#E3F2FD", dot: "#1877F2" },
  replied: { label: "Replied", color: "#1A7A1A", bg: "#E8F5E9", dot: "#4CAF50" },
  no_response: { label: "No Response", color: "#666666", bg: "#F5F5F5", dot: "#AAAAAA" },
  failed: { label: "Failed", color: "#CC0000", bg: "#FFEBEE", dot: "#F44336" },
};

const ALL_STATUSES = ["all", "pending", "sent", "replied", "no_response", "failed"];

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        border: `1px solid ${cfg.dot}33`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Single follow-up row ─────────────────────────────────────────────────────
function FollowUpRow({ followUp, onMarkStatus, onOpenConversation }) {
  const [updating, setUpdating] = useState(false);

  const isPending = followUp.status === "pending";
  const scheduledDate = followUp.scheduledAt?.toDate
    ? followUp.scheduledAt.toDate()
    : followUp.scheduledAt
    ? new Date(followUp.scheduledAt)
    : null;

  const isOverdue = isPending && scheduledDate && scheduledDate < new Date();

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await onMarkStatus(followUp.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(140px,1.5fr) 80px minmax(100px,1fr) minmax(180px,2fr) 110px 140px",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        background: isOverdue ? "#FFF8F0" : "var(--color-card)",
        transition: "background 0.1s",
      }}
    >
      {/* Contact */}
      <div>
        <button
          onClick={() => onOpenConversation(followUp.conversationId)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#661F1F",
            fontWeight: 600,
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            textAlign: "left",
            padding: 0,
            textDecoration: "underline",
            textDecorationColor: "#661F1F40",
          }}
        >
          {followUp.contactName || followUp.contactId}
        </button>
      </div>

      {/* Platform */}
      <div>
        <PlatformBadge platform={followUp.platform} size="sm" />
      </div>

      {/* Scheduled date */}
      <div>
        <div
          style={{
            fontSize: 13,
            color: isOverdue ? "#CC0000" : "var(--color-text)",
            fontFamily: "'Inter', sans-serif",
            fontWeight: isOverdue ? 600 : 400,
          }}
        >
          {scheduledDate
            ? scheduledDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </div>
        {isOverdue && (
          <div style={{ fontSize: 10, color: "#CC0000", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
            OVERDUE
          </div>
        )}
        {followUp.sentAt && (
          <div style={{ fontSize: 10, color: "var(--color-text-secondary)", fontFamily: "'Inter', sans-serif" }}>
            Sent: {formatTimestamp(followUp.sentAt)}
          </div>
        )}
      </div>

      {/* Message preview */}
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          fontFamily: "'Inter', sans-serif",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={followUp.customMessage}
      >
        {followUp.customMessage || "—"}
      </div>

      {/* Status */}
      <div>
        <StatusBadge status={followUp.status} />
        {followUp.failureReason && (
          <div
            style={{
              fontSize: 10,
              color: "#CC0000",
              marginTop: 2,
              fontFamily: "'Inter', sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={followUp.failureReason}
          >
            {followUp.failureReason}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 5 }}>
        {followUp.status === "sent" && (
          <>
            <button
              onClick={() => handleStatusChange("replied")}
              disabled={updating}
              title="Mark as replied"
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#E8F5E9",
                color: "#1A7A1A",
                border: "1px solid #1A7A1A33",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              ✓ Replied
            </button>
            <button
              onClick={() => handleStatusChange("no_response")}
              disabled={updating}
              title="Mark as no response"
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#F5F5F5",
                color: "#666",
                border: "1px solid #AAA33",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              No Reply
            </button>
          </>
        )}
        {followUp.status === "failed" && (
          <button
            onClick={() => handleStatusChange("pending")}
            disabled={updating}
            title="Retry sending"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: "#FFF3E0",
              color: "#CC6600",
              border: "1px solid #CC660033",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            ↻ Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FollowUpLog() {
  const navigate = useNavigate();
  const { followUps, setActiveConversationId } = useMessagingStore();

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = followUps.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.contactName?.toLowerCase().includes(q) ||
        f.customMessage?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Status counts
  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = s === "all" ? followUps.length : followUps.filter((f) => f.status === s).length;
    return acc;
  }, {});

  const handleMarkStatus = async (followUpId, newStatus) => {
    const ref = doc(db, "followUps", followUpId);
    await updateDoc(ref, { status: newStatus });
  };

  const handleOpenConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    navigate("/messaging");
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 40 }}>
      {/* Page header */}
      <div
        style={{
          background: "var(--color-card)",
          borderBottom: "1px solid var(--color-border)",
          padding: "20px 24px 16px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => navigate("/messaging")}
              style={{
                background: "none",
                border: "none",
                color: "#661F1F",
                fontSize: 20,
                cursor: "pointer",
                padding: "2px 6px",
                display: "flex",
                alignItems: "center",
              }}
            >
              ←
            </button>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Follow-Up Log
              </h1>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Track all scheduled follow-up messages
              </p>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Search follow-ups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-bg)",
                  color: "var(--color-text)",
                  fontSize: 13,
                  fontFamily: "'Inter', sans-serif",
                  outline: "none",
                  width: 200,
                }}
              />
            </div>
          </div>

          {/* Status filter chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {ALL_STATUSES.map((s) => {
              const cfg = s === "all" ? { label: "All", color: "#661F1F" } : STATUS_CONFIG[s];
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${isActive ? (cfg?.color || "#661F1F") : "var(--color-border)"}`,
                    background: isActive ? `${cfg?.color || "#661F1F"}15` : "var(--color-card)",
                    color: isActive ? (cfg?.color || "#661F1F") : "var(--color-text-secondary)",
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {cfg?.label || s}
                  {counts[s] > 0 && (
                    <span
                      style={{
                        background: isActive ? (cfg?.color || "#661F1F") : "var(--color-bg)",
                        color: isActive ? "#fff" : "var(--color-text-secondary)",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 10,
                        padding: "1px 5px",
                        minWidth: 16,
                        textAlign: "center",
                      }}
                    >
                      {counts[s]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 0" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px,1.5fr) 80px minmax(100px,1fr) minmax(180px,2fr) 110px 140px",
            gap: 12,
            padding: "10px 16px",
            background: "var(--color-bg)",
            borderRadius: "10px 10px 0 0",
            border: "1px solid var(--color-border)",
            borderBottom: "none",
          }}
        >
          {["Contact", "Platform", "Scheduled", "Message", "Status", "Actions"].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "0 0 10px 10px",
            overflow: "hidden",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                fontFamily: "'Inter', sans-serif",
                background: "var(--color-card)",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>⏰</div>
              {searchQuery
                ? `No follow-ups matching "${searchQuery}"`
                : statusFilter !== "all"
                ? `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase() || statusFilter} follow-ups`
                : "No follow-ups scheduled yet. Schedule one from a conversation."}
            </div>
          ) : (
            filtered.map((f) => (
              <FollowUpRow
                key={f.id}
                followUp={f}
                onMarkStatus={handleMarkStatus}
                onOpenConversation={handleOpenConversation}
              />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--color-text-secondary)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Showing {filtered.length} of {followUps.length} follow-ups
          </div>
        )}
      </div>
    </div>
  );
}

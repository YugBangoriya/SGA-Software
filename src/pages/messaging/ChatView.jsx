/**
 * ChatView.jsx
 * Center panel — shows the full message thread for the active conversation.
 *
 * Features:
 *   - Message thread with auto-scroll to bottom
 *   - Contact header with platform badge + back button (mobile)
 *   - Follow-up scheduler button in header toolbar
 *   - First-reply follow-up prompt (auto-shown after owner's first reply)
 *   - Car quick-send overlay (Phase 6 integration)
 *   - Date separators between messages
 *   - Loading skeleton state
 */

import { useEffect, useRef, useCallback } from "react";
import useMessagingStore, { PLATFORM_CONFIG, formatTimestamp } from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";
import MessageBubble from "./MessageBubble";
import ReplyInput from "./ReplyInput";
import { PlatformBadge } from "./index.jsx";

// Phase 6 component — car quick-send. Import path assumes Phase 6 is present.
// If Phase 6 is not yet built, this will be a no-op placeholder.
let CarQuickSend;
try {
  CarQuickSend = require("../carRepository/CarQuickSend").default;
} catch {
  CarQuickSend = null;
}

// ─── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ date }) {
  const label = (() => {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  })();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        margin: "4px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
          background: "var(--color-bg)",
          padding: "2px 10px",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          fontFamily: "'Inter', sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function MessagesLoadingSkeleton() {
  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: i % 2 === 0 ? "flex-start" : "flex-end",
          }}
        >
          <div
            style={{
              width: `${40 + (i * 17) % 40}%`,
              height: 44,
              borderRadius: 12,
              background: "var(--color-border)",
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ─── First-reply follow-up prompt banner ──────────────────────────────────────
function FirstReplyFollowUpPrompt() {
  const { setShowFirstReplyFollowUpPrompt, setShowFollowUpModal } = useMessagingStore();

  return (
    <div
      style={{
        margin: "8px 16px",
        padding: "12px 16px",
        background: "#FFF3E0",
        border: "1.5px solid #CC6600",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#CC6600",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          ⏰ Schedule a follow-up?
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6B4400",
            fontFamily: "'Inter', sans-serif",
            marginTop: 2,
          }}
        >
          Send an automatic reminder in 7–15 days if no reply
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => {
            setShowFollowUpModal(true);
            setShowFirstReplyFollowUpPrompt(false);
          }}
          style={{
            padding: "7px 14px",
            borderRadius: 7,
            background: "#CC6600",
            color: "#fff",
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Schedule
        </button>
        <button
          onClick={() => setShowFirstReplyFollowUpPrompt(false)}
          style={{
            padding: "7px 10px",
            borderRadius: 7,
            background: "none",
            color: "#CC6600",
            border: "1.5px solid #CC6600",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ─── Chat header ──────────────────────────────────────────────────────────────
function ChatHeader({ conversation }) {
  const { setActiveConversationId, setShowFollowUpModal } = useMessagingStore();
  const cfg = PLATFORM_CONFIG[conversation?.platform] || {};

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-card)",
        flexShrink: 0,
      }}
    >
      {/* Back button (mobile only) */}
      <button
        className="lg:hidden"
        onClick={() => setActiveConversationId(null)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#661F1F",
          fontSize: 20,
          padding: "2px 8px 2px 0",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        ←
      </button>

      {/* Avatar */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: cfg.bgColor || "#F0F0F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          color: cfg.color || "#666",
          border: `1.5px solid ${cfg.color || "#ddd"}33`,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {conversation?.contactProfilePic ? (
          <img
            src={conversation.contactProfilePic}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          (conversation?.contactName || "?")[0].toUpperCase()
        )}
      </div>

      {/* Name + platform + phone */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text)",
              fontFamily: "'Inter', sans-serif",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {conversation?.contactName || conversation?.contactId}
          </span>
          <PlatformBadge platform={conversation?.platform} size="sm" />
        </div>
        {conversation?.contactPhone && (
          <div
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
              fontFamily: "'Inter', sans-serif",
              marginTop: 1,
            }}
          >
            {conversation.contactPhone}
          </div>
        )}
      </div>

      {/* Follow-up button in header */}
      <button
        onClick={() => setShowFollowUpModal(true)}
        title="Schedule follow-up"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          borderRadius: 8,
          background: conversation?.hasFollowUp ? "#FFF3E0" : "var(--color-bg)",
          border: `1.5px solid ${conversation?.hasFollowUp ? "#CC6600" : "var(--color-border)"}`,
          color: conversation?.hasFollowUp ? "#CC6600" : "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: conversation?.hasFollowUp ? 600 : 400,
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          flexShrink: 0,
        }}
      >
        ⏰{" "}
        <span className="hidden sm:inline">
          {conversation?.hasFollowUp ? "Follow-up set" : "Follow-up"}
        </span>
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ChatView() {
  const {
    messages,
    messagesLoading,
    activeConversationId,
    showFirstReplyFollowUpPrompt,
    showCarQuickSend,
    carQuickSendQuery,
    setShowCarQuickSend,
    setReplyDraft,
    getActiveConversation,
  } = useMessagingStore();

  const { currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const conversation = getActiveConversation();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle car quick-send selection
  const handleCarSelect = useCallback(
    (carData) => {
      // carData: { carName, driveLink, reelLinks }
      // The actual WhatsApp template send is handled by the store's sendReply
      // For now, populate the draft with a summary (template send happens server-side)
      setReplyDraft(`/car:${carData.id}`);
      setShowCarQuickSend(false);
    },
    [setReplyDraft, setShowCarQuickSend]
  );

  // Group messages by date for date separators
  const groupedMessages = (() => {
    const groups = [];
    let lastDate = null;

    for (const msg of messages) {
      const ts = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date();
      const dateStr = ts.toDateString();

      if (dateStr !== lastDate) {
        groups.push({ type: "date", date: ts, key: `date_${dateStr}` });
        lastDate = dateStr;
      }
      groups.push({ type: "message", msg, key: msg.id });
    }
    return groups;
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-bg)",
        position: "relative",
      }}
    >
      {/* Header */}
      {conversation && <ChatHeader conversation={conversation} />}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingTop: 8,
          paddingBottom: 4,
          overscrollBehavior: "contain",
        }}
      >
        {messagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: 14,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>💬</div>
            No messages yet in this conversation.
            <br />
            Send the first message to start the conversation.
          </div>
        ) : (
          groupedMessages.map((item) =>
            item.type === "date" ? (
              <DateSeparator key={item.key} date={item.date} />
            ) : (
              <MessageBubble key={item.key} message={item.msg} />
            )
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* First-reply follow-up prompt */}
      {showFirstReplyFollowUpPrompt && <FirstReplyFollowUpPrompt />}

      {/* Car quick-send overlay */}
      {showCarQuickSend && CarQuickSend && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--color-card)",
            borderTop: "1px solid var(--color-border)",
            maxHeight: "60%",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#661F1F",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              🚗 Car Quick-Send
            </span>
            <button
              onClick={() => {
                setShowCarQuickSend(false);
                setReplyDraft("");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "var(--color-text-secondary)",
              }}
            >
              ×
            </button>
          </div>
          <CarQuickSend
            searchQuery={carQuickSendQuery}
            onSelect={handleCarSelect}
            mode="messaging"
          />
        </div>
      )}

      {/* Reply input */}
      <ReplyInput />
    </div>
  );
}

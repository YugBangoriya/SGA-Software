/**
 * ConversationList.jsx
 * Left panel showing all conversations sorted by most recent message.
 * Features:
 *   - Platform filter chips (All / WhatsApp / Instagram / Facebook)
 *   - Search bar
 *   - Unread count badges
 *   - Platform badge (WA / IG / FB) on each item
 *   - Follow-up indicator
 *   - Scroll position preserved on mobile back navigation
 */

import { useRef, useEffect, useCallback, useState } from "react";
import useMessagingStore, { PLATFORM_CONFIG, formatTimestamp } from "../../store/messagingStore";
import { useConversationSearch } from "../../hooks/useMessaging";
import { useAuth } from "../../hooks/useAuth";
import { PlatformBadge } from "./index.jsx";

// ─── Filter chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, value, current, count, color, onClick }) {
  const isActive = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: 20,
        border: isActive ? `1.5px solid ${color || "#661F1F"}` : "1.5px solid var(--color-border)",
        background: isActive ? (color ? `${color}18` : "#661F1F18") : "var(--color-card)",
        color: isActive ? (color || "#661F1F") : "var(--color-text-secondary)",
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            background: isActive ? (color || "#661F1F") : "var(--color-bg)",
            color: isActive ? "#fff" : "var(--color-text-secondary)",
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 10,
            padding: "1px 5px",
            minWidth: 16,
            textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Conversation item ────────────────────────────────────────────────────────
function ConversationItem({ conv, isActive, onClick }) {
  const hasUnread = conv.unreadCount > 0;
  const cfg = PLATFORM_CONFIG[conv.platform] || {};

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        width: "100%",
        border: "none",
        borderBottom: "1px solid var(--color-border)",
        background: isActive
          ? "#661F1F10"
          : hasUnread
          ? "var(--color-bg)"
          : "var(--color-card)",
        borderLeft: isActive ? "3px solid #661F1F" : "3px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.1s ease",
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: cfg.bgColor || "#F0F0F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            border: `1.5px solid ${cfg.color || "#ddd"}33`,
            overflow: "hidden",
          }}
        >
          {conv.contactProfilePic ? (
            <img
              src={conv.contactProfilePic}
              alt={conv.contactName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: cfg.color, fontSize: 20, fontWeight: 700 }}>
              {(conv.contactName || "?")[0].toUpperCase()}
            </span>
          )}
        </div>
        {/* Platform badge overlay */}
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            background: cfg.color || "#888",
            color: "#fff",
            fontSize: 8,
            fontWeight: 700,
            borderRadius: 4,
            padding: "1px 4px",
            border: "1.5px solid var(--color-card)",
            letterSpacing: 0.2,
          }}
        >
          {cfg.shortLabel || "?"}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: hasUnread ? 700 : 500,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {conv.contactName || conv.contactId}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
              whiteSpace: "nowrap",
              flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {formatTimestamp(conv.lastMessageAt)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
          <p
            style={{
              fontSize: 13,
              color: hasUnread ? "var(--color-text)" : "var(--color-text-secondary)",
              fontWeight: hasUnread ? 500 : 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              margin: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {conv.lastMessageBy === "owner" && (
              <span style={{ color: "#661F1F", fontWeight: 600 }}>You: </span>
            )}
            {conv.lastMessage || "No messages yet"}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Follow-up indicator */}
            {conv.hasFollowUp && (
              <span
                title="Follow-up scheduled"
                style={{
                  fontSize: 12,
                  color: "#CC6600",
                }}
              >
                ⏰
              </span>
            )}
            {/* Unread badge */}
            {hasUnread && (
              <span
                style={{
                  background: "#661F1F",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: "2px 6px",
                  minWidth: 18,
                  textAlign: "center",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConversationList() {
  const {
    conversations,
    activeConversationId,
    platformFilter,
    conversationListScrollTop,
    setPlatformFilter,
    setActiveConversationId,
    setConversationListScrollTop,
  } = useMessagingStore();

  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);

  // Restore scroll position when returning from chat on mobile
  useEffect(() => {
    if (!activeConversationId && scrollRef.current) {
      scrollRef.current.scrollTop = conversationListScrollTop;
    }
  }, [activeConversationId, conversationListScrollTop]);

  // Save scroll position when leaving
  const handleConversationClick = useCallback(
    (convId) => {
      if (scrollRef.current) {
        setConversationListScrollTop(scrollRef.current.scrollTop);
      }
      setActiveConversationId(convId);
    },
    [setActiveConversationId, setConversationListScrollTop]
  );

  const filtered = useConversationSearch(conversations, searchQuery, platformFilter);

  // Counts per platform for filter chip badges
  const counts = {
    all: conversations.length,
    whatsapp: conversations.filter((c) => c.platform === "whatsapp").length,
    instagram: conversations.filter((c) => c.platform === "instagram").length,
    facebook: conversations.filter((c) => c.platform === "facebook").length,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-card)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg)",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Messages
        </h2>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-secondary)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 32px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "var(--color-card)",
              color: "var(--color-text)",
              fontSize: 13,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-secondary)",
                fontSize: 16,
                padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Platform filter chips */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 10,
            overflowX: "auto",
            paddingBottom: 2,
            scrollbarWidth: "none",
          }}
        >
          <FilterChip
            label="All"
            value="all"
            current={platformFilter}
            count={counts.all}
            onClick={setPlatformFilter}
          />
          <FilterChip
            label="WhatsApp"
            value="whatsapp"
            current={platformFilter}
            count={counts.whatsapp}
            color="#25D366"
            onClick={setPlatformFilter}
          />
          <FilterChip
            label="Instagram"
            value="instagram"
            current={platformFilter}
            count={counts.instagram}
            color="#E1306C"
            onClick={setPlatformFilter}
          />
          <FilterChip
            label="Facebook"
            value="facebook"
            current={platformFilter}
            count={counts.facebook}
            color="#1877F2"
            onClick={setPlatformFilter}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: 14,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {searchQuery
              ? `No conversations matching "${searchQuery}"`
              : platformFilter !== "all"
              ? `No ${platformFilter} conversations yet`
              : "No conversations yet. Messages will appear here when customers reach out."}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConversationId}
              onClick={() => handleConversationClick(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
